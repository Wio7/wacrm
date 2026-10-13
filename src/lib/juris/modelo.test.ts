import { afterEach, describe, expect, it, vi } from 'vitest';
import * as z from 'zod/v4';

import {
  modeloJuris,
  pedirJson,
  proveedorJuris,
  transcribirPdf,
} from './modelo';
import { esquemaEstricto } from './modelo-openai';

const Esquema = z.object({
  numero: z.string().nullable(),
  anio: z.number().int().nullable(),
  // Un campo que se llama como una palabra de JSON Schema.
  format: z.enum(['a', 'b']),
});

function responder(cuerpo: unknown, status = 200) {
  const fetchMock = vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify(cuerpo), { status })
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const mensaje = (partes: unknown[]) => ({
  model: 'gpt-6.1-sol',
  status: 'completed',
  output: [
    { type: 'reasoning', content: [] },
    { type: 'message', content: partes },
  ],
});

const enviado = (fetchMock: ReturnType<typeof responder>) =>
  JSON.parse(String(fetchMock.mock.calls[0][1]!.body));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('proveedorJuris', () => {
  it('respeta el que se elige', () => {
    expect(proveedorJuris({ JURIS_PROVIDER: 'OpenAI ' })).toBe('openai');
    expect(proveedorJuris({ JURIS_PROVIDER: 'anthropic' })).toBe('anthropic');
    expect(() => proveedorJuris({ JURIS_PROVIDER: 'deepseek' })).toThrow(
      /no es válido/
    );
  });

  it('sin elegir, usa el que tenga clave', () => {
    expect(proveedorJuris({ OPENAI_API_KEY: 'k' })).toBe('openai');
    expect(proveedorJuris({ ANTHROPIC_API_KEY: 'k' })).toBe('anthropic');
    expect(
      proveedorJuris({ OPENAI_API_KEY: 'k', ANTHROPIC_API_KEY: 'k' })
    ).toBe('anthropic');
  });

  it('cada proveedor tiene su modelo por defecto, y JURIS_MODEL manda', () => {
    expect(modeloJuris({ JURIS_PROVIDER: 'openai' })).toBe('gpt-6.1-sol');
    expect(modeloJuris({ JURIS_PROVIDER: 'anthropic' })).toBe(
      'claude-sonnet-5-5'
    );
    expect(
      modeloJuris({ JURIS_PROVIDER: 'openai', JURIS_MODEL: 'gpt-6-luna' })
    ).toBe('gpt-6-luna');
  });
});

describe('esquemaEstricto', () => {
  it('quita lo que el modo estricto no acepta sin tocar los nombres de campos', () => {
    const esquema = esquemaEstricto(Esquema) as {
      properties: Record<string, unknown>;
      required: string[];
      additionalProperties: boolean;
    };
    expect(Object.keys(esquema.properties)).toEqual([
      'numero',
      'anio',
      'format',
    ]);
    expect(esquema.required).toEqual(['numero', 'anio', 'format']);
    expect(esquema.additionalProperties).toBe(false);
    const plano = JSON.stringify(esquema);
    expect(plano).not.toContain('"$schema"');
    expect(plano).not.toContain('"minimum"');
    expect(plano).not.toContain('"maximum"');
  });
});

describe('OpenAI', () => {
  const conOpenAi = () => {
    vi.stubEnv('JURIS_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', 'clave-de-prueba');
    vi.stubEnv('JURIS_MODEL', '');
  };
  const pedido = {
    sistema: 'Eres un fichador.',
    texto: 'Casación 1234-2019',
    maxTokens: 1000,
    esfuerzo: 'medium' as const,
  };

  it('pide un JSON estricto, sin que OpenAI guarde nada, y lo valida', async () => {
    conOpenAi();
    const fetchMock = responder(
      mensaje([
        {
          type: 'output_text',
          text: '{"numero":"1234-2019","anio":2019,"format":"a"}',
        },
      ])
    );
    const { datos, modelo } = await pedirJson(Esquema, pedido);
    expect(datos).toEqual({ numero: '1234-2019', anio: 2019, format: 'a' });
    expect(modelo).toBe('gpt-6.1-sol');

    const body = enviado(fetchMock);
    expect(body.store).toBe(false);
    expect(body.model).toBe('gpt-6.1-sol');
    expect(body.text.format).toMatchObject({
      type: 'json_schema',
      strict: true,
    });
    expect(body.input[0]).toEqual({ role: 'system', content: pedido.sistema });
    expect(fetchMock.mock.calls[0][1]!.headers).toMatchObject({
      Authorization: 'Bearer clave-de-prueba',
    });
  });

  it('rechaza un JSON que no tiene la forma pedida', async () => {
    conOpenAi();
    responder(mensaje([{ type: 'output_text', text: '{"numero":7}' }]));
    await expect(pedirJson(Esquema, pedido)).rejects.toThrow(/forma esperada/);
  });

  it('manda el PDF como archivo al transcribir', async () => {
    conOpenAi();
    const fetchMock = responder(
      mensaje([{ type: 'output_text', text: 'VISTOS; y CONSIDERANDO…' }])
    );
    expect(await transcribirPdf(new Uint8Array([37, 80, 68, 70]))).toBe(
      'VISTOS; y CONSIDERANDO…'
    );
    const [archivo, texto] = enviado(fetchMock).input[1].content;
    expect(archivo).toMatchObject({
      type: 'input_file',
      file_data: 'data:application/pdf;base64,JVBERg==',
    });
    expect(texto.type).toBe('input_text');
  });

  it('una página sin texto se transcribe como vacía', async () => {
    conOpenAi();
    responder(mensaje([{ type: 'output_text', text: '[sin texto]' }]));
    expect(await transcribirPdf(new Uint8Array([1]))).toBe('');
  });

  it.each([
    [
      'una negativa',
      mensaje([{ type: 'refusal', refusal: 'No puedo.' }]),
      /declinó/,
    ],
    [
      'una respuesta cortada',
      {
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' },
      },
      /cortada/,
    ],
    ['una respuesta vacía', mensaje([]), /no devolvió nada/],
  ])('avisa de %s', async (_, cuerpo, esperado) => {
    conOpenAi();
    responder(cuerpo);
    await expect(pedirJson(Esquema, pedido)).rejects.toThrow(esperado);
  });

  it.each([
    [401, { error: { code: 'invalid_api_key' } }, /no es válida/],
    [429, { error: { code: 'insufficient_quota' } }, /no tiene saldo/],
    [429, { error: { code: 'rate_limit_exceeded' } }, /pidió esperar/],
    [500, { error: { message: 'boom' } }, /respondió 500: boom/],
  ])('explica un %i del proveedor', async (status, cuerpo, esperado) => {
    conOpenAi();
    responder(cuerpo, status);
    await expect(pedirJson(Esquema, pedido)).rejects.toThrow(esperado);
  });

  it('sin clave lo dice antes de llamar', async () => {
    vi.stubEnv('JURIS_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', '');
    const fetchMock = responder({});
    await expect(pedirJson(Esquema, pedido)).rejects.toThrow(
      /Falta OPENAI_API_KEY/
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
