// ============================================================
// Proveedor: OpenAI (Responses API).
//
//   OPENAI_API_KEY   la misma clave sirve para los embeddings
//
// `store: false` en cada petición: OpenAI no guarda de su lado ni lo que
// se le manda ni lo que contesta. Por aquí pasan los casos de los
// usuarios, no sólo resoluciones públicas.
// ============================================================

import * as z from 'zod/v4';

import type { Pedido, Respuesta } from './modelo';
import { JurisError } from './tipos';

const URL_RESPONSES = 'https://api.openai.com/v1/responses';
/** El servidor corta a los 300 s; que la llamada se rinda antes. */
const TIMEOUT_MS = 240_000;

// Palabras de JSON Schema que zod emite y el modo estricto no acepta.
const NO_ADMITIDAS = new Set([
  '$schema',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'pattern',
  'format',
  'default',
]);

function depurar(nodo: unknown): unknown {
  if (Array.isArray(nodo)) return nodo.map(depurar);
  if (nodo === null || typeof nodo !== 'object') return nodo;
  return Object.fromEntries(
    Object.entries(nodo)
      .filter(([clave]) => !NO_ADMITIDAS.has(clave))
      .map(([clave, valor]) => [
        clave,
        // Dentro de `properties` las claves son nombres de campos, no
        // palabras del esquema: un campo llamado "format" se queda.
        clave === 'properties' && valor && typeof valor === 'object'
          ? Object.fromEntries(
              Object.entries(valor).map(([campo, sub]) => [campo, depurar(sub)])
            )
          : depurar(valor),
      ])
  );
}

/** El esquema de zod como JSON Schema que el modo estricto acepta. */
export function esquemaEstricto(esquema: z.ZodType): unknown {
  return depurar(z.toJSONSchema(esquema));
}

interface Parte {
  type?: string;
  text?: string;
  refusal?: string;
}

interface CuerpoRespuesta {
  model?: string;
  status?: string;
  incomplete_details?: { reason?: string } | null;
  output?: { type?: string; content?: Parte[] }[];
  error?: { message?: string; code?: string; type?: string } | null;
}

export async function pedirOpenAi(
  model: string,
  pedido: Pedido
): Promise<Respuesta> {
  const clave = process.env.OPENAI_API_KEY?.trim();
  if (!clave) {
    throw new JurisError(
      'falta_clave',
      'Falta OPENAI_API_KEY en el servidor: sin ella no se pueden armar fichas.'
    );
  }

  const cuerpo = {
    model,
    store: false,
    max_output_tokens: pedido.maxTokens,
    reasoning: { effort: pedido.esfuerzo },
    input: [
      { role: 'system', content: pedido.sistema },
      {
        role: 'user',
        content: [
          ...(pedido.pdf
            ? [
                {
                  type: 'input_file',
                  filename: 'paginas.pdf',
                  file_data: `data:application/pdf;base64,${Buffer.from(pedido.pdf).toString('base64')}`,
                },
              ]
            : []),
          { type: 'input_text', text: pedido.texto },
        ],
      },
    ],
    ...(pedido.esquema
      ? {
          text: {
            format: {
              type: 'json_schema',
              name: 'respuesta',
              schema: esquemaEstricto(pedido.esquema),
              strict: true,
            },
          },
        }
      : {}),
  };

  let res: Response;
  try {
    res = await fetch(URL_RESPONSES, {
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
      'ia_red',
      `No se pudo conectar con el proveedor de IA: ${err instanceof Error ? err.message : err}`
    );
  }

  const json = (await res.json().catch(() => null)) as CuerpoRespuesta | null;

  if (!res.ok) {
    const error = json?.error;
    if (res.status === 401) {
      throw new JurisError(
        'clave_invalida',
        'La clave OPENAI_API_KEY no es válida.'
      );
    }
    // Un 429 puede ser "espera un momento" o "no hay saldo": se arreglan
    // de formas muy distintas y conviene decir cuál es.
    if (error?.code === 'insufficient_quota') {
      throw new JurisError(
        'sin_saldo',
        'La cuenta de OpenAI no tiene saldo. Recárgala en platform.openai.com → Billing.'
      );
    }
    if (res.status === 429) {
      throw new JurisError(
        'limite',
        'El proveedor de IA pidió esperar (límite de uso). Reintenta en unos minutos.'
      );
    }
    throw new JurisError(
      'ia_http',
      `El proveedor de IA respondió ${res.status}: ${error?.message ?? 'sin detalle'}`
    );
  }

  if (json?.status === 'incomplete') {
    const motivo = json.incomplete_details?.reason;
    if (motivo === 'content_filter') {
      throw new JurisError(
        'ia_declino',
        'El modelo declinó procesar este documento. Llena la ficha a mano.'
      );
    }
    throw new JurisError(
      'ia_cortada',
      'La respuesta del modelo quedó cortada por su longitud.'
    );
  }

  const partes = (json?.output ?? [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content ?? []);
  if (partes.some((p) => p.type === 'refusal')) {
    throw new JurisError(
      'ia_declino',
      'El modelo declinó procesar este documento. Llena la ficha a mano.'
    );
  }

  const texto = partes
    .filter((p) => p.type === 'output_text' && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
  return { texto, modelo: json?.model ?? model };
}
