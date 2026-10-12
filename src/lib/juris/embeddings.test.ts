import { afterEach, describe, expect, it, vi } from 'vitest';

import { crearEmbeddings, DIMENSIONES } from './embeddings';

const vector = (semilla: number, dim = DIMENSIONES) =>
  Array.from({ length: dim }, () => semilla);

function responder(crear: (input: string[]) => unknown) {
  const fetchMock = vi.fn(
    async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify(crear(body.input)), { status: 200 });
    }
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('crearEmbeddings', () => {
  it('sin clave no hay servicio', () => {
    expect(crearEmbeddings({})).toBeNull();
    expect(crearEmbeddings({ JURIS_EMBEDDINGS_PROVIDER: 'openai' })).toBeNull();
  });

  it('rechaza un proveedor desconocido', () => {
    expect(() =>
      crearEmbeddings({ JURIS_EMBEDDINGS_PROVIDER: 'otro' })
    ).toThrow(/no es válido/);
  });

  it('Voyage: distingue documentos de consultas y respeta el orden por índice', async () => {
    const fetchMock = responder((input) => ({
      // Devueltos al revés a propósito.
      data: input.map((_, i) => ({ index: i, embedding: vector(i) })).reverse(),
    }));
    const servicio = crearEmbeddings({ VOYAGE_API_KEY: 'k' })!;
    expect(servicio.modelo).toBe('voyage:voyage-4');

    const docs = await servicio.documentos(['a', 'b', 'c']);
    expect(docs.map((v) => v[0])).toEqual([0, 1, 2]);
    expect(
      JSON.parse(String(fetchMock.mock.calls[0][1]!.body)).input_type
    ).toBe('document');

    await servicio.consulta('simulación absoluta');
    expect(
      JSON.parse(String(fetchMock.mock.calls[1][1]!.body)).input_type
    ).toBe('query');
  });

  it('OpenAI: pide la dimensión de la columna', async () => {
    const fetchMock = responder((input) => ({
      data: input.map((_, i) => ({ index: i, embedding: vector(1) })),
    }));
    const servicio = crearEmbeddings({
      JURIS_EMBEDDINGS_PROVIDER: 'openai',
      OPENAI_API_KEY: 'k',
    })!;
    await servicio.documentos(['a']);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]!.body));
    expect(body).toMatchObject({
      model: 'text-embedding-3-small',
      dimensions: DIMENSIONES,
    });
  });

  it('parte en lotes las cargas grandes', async () => {
    const fetchMock = responder((input) => ({
      data: input.map((_, i) => ({ index: i, embedding: vector(1) })),
    }));
    const servicio = crearEmbeddings({ VOYAGE_API_KEY: 'k' })!;
    const docs = await servicio.documentos(
      Array.from({ length: 150 }, (_, i) => `t${i}`)
    );
    expect(docs).toHaveLength(150);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('falla si el modelo devuelve otra dimensión que la de la base', async () => {
    responder((input) => ({
      data: input.map((_, i) => ({ index: i, embedding: vector(1, 1536) })),
    }));
    const servicio = crearEmbeddings({ VOYAGE_API_KEY: 'k' })!;
    await expect(servicio.documentos(['a'])).rejects.toThrow(
      /1536 dimensiones/
    );
  });

  it('falla si faltan vectores o índices, en vez de emparejarlos mal', async () => {
    responder(() => ({ data: [{ embedding: vector(1) }] }));
    const servicio = crearEmbeddings({ VOYAGE_API_KEY: 'k' })!;
    await expect(servicio.documentos(['a'])).rejects.toThrow(/índices/);

    responder(() => ({ data: [] }));
    await expect(servicio.documentos(['a'])).rejects.toThrow(
      /un vector por texto/
    );
  });

  it('cuenta el error del proveedor', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('invalid api key', { status: 401 }))
    );
    const servicio = crearEmbeddings({ VOYAGE_API_KEY: 'k' })!;
    await expect(servicio.documentos(['a'])).rejects.toThrow(
      /Voyage respondió 401/
    );
  });
});
