// ============================================================
// El modelo de IA del módulo de jurisprudencia (Claude).
//
// A diferencia de la IA que le contesta a los clientes por WhatsApp —
// cada cuenta con su propia clave —, aquí la clave es de la plataforma:
// el catálogo lo arma Wio y es el mismo para todas las cuentas.
//
//   ANTHROPIC_API_KEY   clave de la API (no es la suscripción de Claude)
//   JURIS_MODEL         modelo; por defecto claude-sonnet-5-5
//
// Todo lo que el resto del módulo le pide al modelo pasa por `pedir`.
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type * as z from 'zod/v4';

import { JurisError } from './tipos';

export const MODELO_POR_DEFECTO = 'claude-sonnet-5-5';

export const modeloJuris = () =>
  process.env.JURIS_MODEL?.trim() || MODELO_POR_DEFECTO;

// Los modelos que aceptan que la API reintente sola, en otro modelo,
// una petición que sus filtros de seguridad declinaron.
const CON_RESPALDO = /^claude-(sonnet-5-5|opus-5|fable-5-1)/;
const BETA_RESPALDO = 'server-side-fallback-2026-07-01';

let cliente: Anthropic | null = null;

function claude(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new JurisError(
      'falta_clave',
      'Falta ANTHROPIC_API_KEY en el servidor: sin ella no se pueden armar fichas.'
    );
  }
  // El servidor corta a los 300 s; que la llamada se rinda antes.
  cliente ??= new Anthropic({ timeout: 240_000, maxRetries: 1 });
  return cliente;
}

type Contenido = Anthropic.Beta.BetaContentBlockParam[];

interface Pedido {
  sistema: string;
  contenido: Contenido;
  maxTokens: number;
  /** Cuánto razona: bajo para transcribir, medio para armar la ficha. */
  esfuerzo: 'low' | 'medium' | 'high';
  formato?: ReturnType<typeof betaZodOutputFormat>;
}

export interface Respuesta {
  texto: string;
  /** El modelo que de verdad contestó (puede ser el de respaldo). */
  modelo: string;
}

async function pedir(pedido: Pedido): Promise<Respuesta> {
  const model = modeloJuris();
  const respaldo = CON_RESPALDO.test(model);

  let mensaje: Anthropic.Beta.BetaMessage;
  try {
    // En streaming aunque sólo se use el mensaje final: una transcripción
    // larga tarda minutos y una petición normal se cortaría antes.
    mensaje = await claude()
      .beta.messages.stream({
        model,
        max_tokens: pedido.maxTokens,
        system: pedido.sistema,
        messages: [{ role: 'user', content: pedido.contenido }],
        output_config: {
          effort: pedido.esfuerzo,
          ...(pedido.formato ? { format: pedido.formato } : {}),
        },
        ...(respaldo
          ? { betas: [BETA_RESPALDO], fallbacks: 'default' as const }
          : {}),
      })
      .finalMessage();
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new JurisError(
        'clave_invalida',
        'La clave ANTHROPIC_API_KEY no es válida.'
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new JurisError(
        'limite',
        'El proveedor de IA pidió esperar (límite de uso). Reintenta en unos minutos.'
      );
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new JurisError(
        'ia_red',
        `No se pudo conectar con el proveedor de IA: ${err.message}`
      );
    }
    if (err instanceof Anthropic.APIError) {
      throw new JurisError(
        'ia_http',
        `El proveedor de IA respondió ${err.status}: ${err.message}`
      );
    }
    throw err;
  }

  if (mensaje.stop_reason === 'refusal') {
    throw new JurisError(
      'ia_declino',
      'El modelo declinó procesar este documento. Llena la ficha a mano.'
    );
  }
  if (mensaje.stop_reason === 'max_tokens') {
    throw new JurisError(
      'ia_cortada',
      'La respuesta del modelo quedó cortada por su longitud.'
    );
  }

  const texto = mensaje.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  if (!texto) {
    throw new JurisError('ia_vacia', 'El modelo no devolvió nada.');
  }
  return { texto, modelo: mensaje.model };
}

/** Pide una respuesta con la forma de `esquema` y la valida. */
export async function pedirJson<E extends z.ZodType>(
  esquema: E,
  pedido: Omit<Pedido, 'formato'>
): Promise<{ datos: z.infer<E>; modelo: string }> {
  const { texto, modelo } = await pedir({
    ...pedido,
    formato: betaZodOutputFormat(esquema),
  });
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    throw new JurisError('ia_json', 'El modelo no devolvió un JSON válido.');
  }
  const leido = esquema.safeParse(crudo);
  if (!leido.success) {
    throw new JurisError(
      'ia_json',
      'La respuesta del modelo no tiene la forma esperada.'
    );
  }
  return { datos: leido.data, modelo };
}

const SISTEMA_TRANSCRIPCION = `Eres un transcriptor de resoluciones judiciales peruanas escaneadas.

Transcribe el texto de las páginas del PDF, completo y en orden, exactamente como está escrito. Esta transcripción se usará para citar la resolución, así que la fidelidad importa más que la legibilidad:

- No resumas, no corrijas, no completes ni reformules. Copia los números (de expediente, de casación, de artículos, fechas, montos) tal como aparecen.
- Si una palabra o un tramo no se puede leer, escribe [ilegible] en su lugar. Nunca adivines.
- Deja fuera los sellos, las firmas, las rúbricas y los números de página o de folio.
- Separa los párrafos con una línea en blanco.

Devuelve solo la transcripción, sin comentarios antes ni después. Si las páginas no tienen texto, devuelve exactamente: [sin texto]`;

/** Transcribe las páginas de un PDF escaneado (ya recortado a una tanda). */
export async function transcribirPdf(pdf: Uint8Array): Promise<string> {
  const { texto } = await pedir({
    sistema: SISTEMA_TRANSCRIPCION,
    contenido: [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: Buffer.from(pdf).toString('base64'),
        },
      },
      { type: 'text', text: 'Transcribe estas páginas.' },
    ],
    maxTokens: 32_000,
    esfuerzo: 'low',
  });
  return texto === '[sin texto]' ? '' : texto;
}
