// ============================================================
// Proveedor: Claude (API de Anthropic).
//
//   ANTHROPIC_API_KEY   clave de la API (no es la suscripción de Claude)
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';

import type { Pedido, Respuesta } from './modelo';
import { JurisError } from './tipos';

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

export async function pedirClaude(
  model: string,
  pedido: Pedido
): Promise<Respuesta> {
  const respaldo = CON_RESPALDO.test(model);
  const contenido: Anthropic.Beta.BetaContentBlockParam[] = [
    ...(pedido.pdf
      ? [
          {
            type: 'document' as const,
            source: {
              type: 'base64' as const,
              media_type: 'application/pdf' as const,
              data: Buffer.from(pedido.pdf).toString('base64'),
            },
          },
        ]
      : []),
    { type: 'text', text: pedido.texto },
  ];

  let mensaje: Anthropic.Beta.BetaMessage;
  try {
    // En streaming aunque sólo se use el mensaje final: una transcripción
    // larga tarda minutos y una petición normal se cortaría antes.
    mensaje = await claude()
      .beta.messages.stream({
        model,
        max_tokens: pedido.maxTokens,
        system: pedido.sistema,
        messages: [{ role: 'user', content: contenido }],
        output_config: {
          effort: pedido.esfuerzo,
          ...(pedido.esquema
            ? { format: betaZodOutputFormat(pedido.esquema) }
            : {}),
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
    .join('');
  return { texto, modelo: mensaje.model };
}
