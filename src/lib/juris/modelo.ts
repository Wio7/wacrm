// ============================================================
// El modelo de IA del módulo de jurisprudencia.
//
// A diferencia de la IA que le contesta a los clientes por WhatsApp —
// cada cuenta con su propia clave —, aquí la clave es de la plataforma:
// el catálogo lo arma Wio y es el mismo para todas las cuentas.
//
//   JURIS_PROVIDER   openai | anthropic. Sin definir, el que tenga clave.
//   JURIS_MODEL      modelo; por defecto el de cada proveedor (abajo).
//
// El resto del módulo no sabe qué proveedor hay detrás: pide con
// `pedirTexto` / `pedirJson` / `transcribirPdf`. Sumar un proveedor es
// un archivo `modelo-<nombre>.ts` y una línea en PROVEEDORES.
// ============================================================

import type * as z from 'zod/v4';

import { pedirClaude } from './modelo-claude';
import { pedirOpenAi } from './modelo-openai';
import { JurisError } from './tipos';

export interface Pedido {
  sistema: string;
  texto: string;
  /** Un PDF que el modelo tiene que leer (un escaneo, por tandas). */
  pdf?: Uint8Array;
  maxTokens: number;
  /** Cuánto razona: bajo para transcribir, medio para armar la ficha. */
  esfuerzo: 'low' | 'medium' | 'high';
  /** Si va, la respuesta es un JSON con esta forma. */
  esquema?: z.ZodType;
}

export interface Respuesta {
  texto: string;
  /** El modelo que de verdad contestó. */
  modelo: string;
}

const PROVEEDORES = {
  openai: { modelo: 'gpt-6.1-sol', pedir: pedirOpenAi },
  anthropic: { modelo: 'claude-sonnet-5-5', pedir: pedirClaude },
} as const;

export type Proveedor = keyof typeof PROVEEDORES;

type Entorno = Record<string, string | undefined>;

export function proveedorJuris(env: Entorno = process.env): Proveedor {
  const elegido = env.JURIS_PROVIDER?.trim().toLowerCase();
  if (elegido) {
    if (elegido in PROVEEDORES) return elegido as Proveedor;
    throw new JurisError(
      'proveedor',
      `JURIS_PROVIDER="${elegido}" no es válido; usa "openai" o "anthropic".`
    );
  }
  return !env.ANTHROPIC_API_KEY && env.OPENAI_API_KEY ? 'openai' : 'anthropic';
}

export function modeloJuris(env: Entorno = process.env): string {
  return env.JURIS_MODEL?.trim() || PROVEEDORES[proveedorJuris(env)].modelo;
}

export async function pedirTexto(pedido: Pedido): Promise<Respuesta> {
  const { pedir } = PROVEEDORES[proveedorJuris()];
  const respuesta = await pedir(modeloJuris(), pedido);
  const texto = respuesta.texto.trim();
  if (!texto) {
    throw new JurisError('ia_vacia', 'El modelo no devolvió nada.');
  }
  return { ...respuesta, texto };
}

/** Pide una respuesta con la forma de `esquema` y la valida. */
export async function pedirJson<E extends z.ZodType>(
  esquema: E,
  pedido: Omit<Pedido, 'esquema'>
): Promise<{ datos: z.infer<E>; modelo: string }> {
  const { texto, modelo } = await pedirTexto({ ...pedido, esquema });
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
  const { texto } = await pedirTexto({
    sistema: SISTEMA_TRANSCRIPCION,
    texto: 'Transcribe estas páginas.',
    pdf,
    maxTokens: 32_000,
    esfuerzo: 'low',
  });
  return texto === '[sin texto]' ? '' : texto;
}
