// ============================================================
// Embeddings del catálogo de jurisprudencia.
//
// Un servicio, dos proveedores: Voyage (por defecto, multilingüe) u
// OpenAI. El resto del código sólo conoce `EmbeddingsService`.
//
// TODO el catálogo tiene que estar embebido con UN mismo modelo: los
// vectores de dos modelos no se comparan entre sí. Por eso la clave es
// de la plataforma (variable de entorno) y no de cada cuenta, y por eso
// cada resolución anota con qué modelo se embebió. Cambiar de modelo
// obliga a recalcular todo.
//
//   JURIS_EMBEDDINGS_PROVIDER   voyage (defecto) | openai
//   JURIS_EMBEDDINGS_MODEL      voyage-4 | text-embedding-3-small
//   VOYAGE_API_KEY / OPENAI_API_KEY
//
// Sin clave no hay servicio: los fragmentos se guardan sin vector y la
// búsqueda por texto sigue funcionando.
// ============================================================

import { JurisError } from './tipos';

/** La dimensión de `juris_resolucion_chunks.embedding` (migración 068). */
export const DIMENSIONES = 1024;

const LOTE = 64;
const TIMEOUT_MS = 60_000;

export interface EmbeddingsService {
  /** `proveedor:modelo`, tal como se anota en la resolución. */
  readonly modelo: string;
  /** Vectores de fragmentos a guardar, en el orden de entrada. */
  documentos(textos: string[]): Promise<number[][]>;
  /** Vector de lo que busca el usuario. */
  consulta(texto: string): Promise<number[]>;
}

type Uso = 'document' | 'query';
type Pedir = (textos: string[], uso: Uso) => Promise<unknown>;

interface Respuesta {
  data?: { embedding?: unknown; index?: unknown }[];
}

async function post(
  proveedor: string,
  url: string,
  clave: string,
  cuerpo: unknown
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${clave}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new JurisError(
      'embeddings_red',
      `No se pudo conectar con ${proveedor}: ${err instanceof Error ? err.message : err}`
    );
  }
  if (!res.ok) {
    const detalle = (await res.text().catch(() => '')).slice(0, 300);
    throw new JurisError(
      'embeddings_http',
      `${proveedor} respondió ${res.status} al pedir embeddings. ${detalle}`
    );
  }
  return res.json();
}

/** Ordena por `index` y exige la dimensión de la columna. */
function vectores(json: unknown, esperados: number): number[][] {
  const filas = (json as Respuesta | null)?.data;
  if (!Array.isArray(filas) || filas.length !== esperados) {
    throw new JurisError(
      'embeddings_forma',
      'La respuesta de embeddings no trae un vector por texto.'
    );
  }
  // Sin índice no hay forma de saber qué vector es de qué fragmento, y
  // asumir el orden pegaría el vector de uno en otro sin que nadie lo note.
  if (filas.some((f) => typeof f.index !== 'number')) {
    throw new JurisError(
      'embeddings_forma',
      'La respuesta de embeddings no trae índices.'
    );
  }
  return [...filas]
    .sort((a, b) => (a.index as number) - (b.index as number))
    .map((f) => {
      const v = f.embedding;
      if (!Array.isArray(v) || v.length !== DIMENSIONES) {
        throw new JurisError(
          'embeddings_dimension',
          `El modelo de embeddings devolvió ${Array.isArray(v) ? v.length : 0} dimensiones y la base espera ${DIMENSIONES}.`
        );
      }
      return v as number[];
    });
}

function servicio(modelo: string, pedir: Pedir): EmbeddingsService {
  const lote = async (textos: string[], uso: Uso) => {
    const salida: number[][] = [];
    for (let i = 0; i < textos.length; i += LOTE) {
      const parte = textos.slice(i, i + LOTE);
      salida.push(...vectores(await pedir(parte, uso), parte.length));
    }
    return salida;
  };
  return {
    modelo,
    documentos: (textos) => lote(textos, 'document'),
    consulta: async (texto) => (await lote([texto], 'query'))[0],
  };
}

type Entorno = Record<string, string | undefined>;

/** El servicio configurado, o `null` si no hay clave. */
export function crearEmbeddings(
  env: Entorno = process.env
): EmbeddingsService | null {
  const proveedor = (env.JURIS_EMBEDDINGS_PROVIDER || 'voyage')
    .trim()
    .toLowerCase();

  if (proveedor === 'openai') {
    const clave = env.OPENAI_API_KEY?.trim();
    if (!clave) return null;
    const modelo =
      env.JURIS_EMBEDDINGS_MODEL?.trim() || 'text-embedding-3-small';
    return servicio(`openai:${modelo}`, (input) =>
      post('OpenAI', 'https://api.openai.com/v1/embeddings', clave, {
        model: modelo,
        input,
        dimensions: DIMENSIONES,
      })
    );
  }

  if (proveedor === 'voyage') {
    const clave = env.VOYAGE_API_KEY?.trim();
    if (!clave) return null;
    const modelo = env.JURIS_EMBEDDINGS_MODEL?.trim() || 'voyage-4';
    // Voyage distingue entre lo que se guarda y lo que se busca; decirle
    // cuál es cuál mejora la recuperación. 1024 es su dimensión por defecto.
    return servicio(`voyage:${modelo}`, (input, uso) =>
      post('Voyage', 'https://api.voyageai.com/v1/embeddings', clave, {
        model: modelo,
        input,
        input_type: uso,
      })
    );
  }

  throw new JurisError(
    'embeddings_proveedor',
    `JURIS_EMBEDDINGS_PROVIDER="${proveedor}" no es válido; usa "voyage" u "openai".`
  );
}
