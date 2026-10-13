// ============================================================
// El asistente: una pregunta en lenguaje natural, una respuesta que
// sólo dice lo que dicen las resoluciones del catálogo.
//
//   1. Se recuperan los fragmentos más relevantes (búsqueda híbrida).
//   2. El modelo contesta SÓLO con ellos y cita cada afirmación.
//   3. El servidor valida las citas (citas.ts). Lo que no se sostiene
//      se quita; si no queda nada, la respuesta es NO_ENCONTRE.
//
// Al usuario le llega el texto ya validado, nunca el del modelo tal
// cual. Por eso no se transmite palabra a palabra mientras el modelo
// escribe: no se puede validar una respuesta que aún no terminó.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { fragmentosRelevantes, type Fragmento } from './busqueda';
import { citaDe, resumenesPorId, type Resumen } from './catalogo';
import {
  AVISO,
  NO_ENCONTRE,
  SIN_COBERTURA,
  validarCitas,
  type Fuente,
} from './citas';
import { pedirTexto } from './modelo';

export const MAX_PREGUNTA = 2000;
const FRAGMENTOS = 10;

const SISTEMA = `Eres un asistente de jurisprudencia para abogados en el Perú. Respondes preguntas usando únicamente los fragmentos de resoluciones de la Corte Suprema que recibes en <fuentes>.

Lo que escribas puede terminar citado en un escrito judicial, así que el respaldo de cada afirmación importa más que dar una respuesta completa:

- Usa solo lo que dicen los fragmentos. No añadas lo que sepas de otras resoluciones, de doctrina o de la ley, aunque estés seguro: quien te lee no tiene cómo distinguirlo de lo que sí está respaldado.
- Después de cada afirmación pon la marca de la resolución que la respalda, con el identificador de <fuentes>: [RES:R1]. Si la respaldan dos, pon las dos: [RES:R1] [RES:R2]. Cada párrafo debe llevar al menos una marca.
- No menciones números de casación, artículos ni fechas que no aparezcan en los fragmentos.
- Si los fragmentos no responden la pregunta, o solo la rozan, responde exactamente ${SIN_COBERTURA} y nada más. Es una respuesta correcta y útil: le dice al abogado que tiene que buscar en otro lado.
- Si las resoluciones discrepan entre sí, dilo y cita cada postura.

Responde en español, de forma directa, en párrafos breves separados por una línea en blanco. Sin títulos, sin introducción y sin advertencias al final: la aplicación ya muestra su propio aviso.`;

export interface CitaTarjeta extends Resumen {
  /** Lista para pegar en un escrito. */
  cita: string;
}

export interface RespuestaAsistente {
  /** Texto validado, con marcas `[RES:<id>]` donde va cada tarjeta. */
  respuesta: string;
  citas: CitaTarjeta[];
  sinResultados: boolean;
  aviso: string;
}

const SIN_RESULTADOS: RespuestaAsistente = {
  respuesta: NO_ENCONTRE,
  citas: [],
  sinResultados: true,
  aviso: AVISO,
};

function armarFuentes(fragmentos: Fragmento[], resumenes: Resumen[]) {
  const porId = new Map(resumenes.map((r) => [r.id, r]));
  const fuentes: Fuente[] = [];
  const bloques: string[] = [];

  for (const resumen of resumenes) {
    const suyos = fragmentos
      .filter((f) => f.resolucion_id === resumen.id)
      .sort((a, b) => a.chunk_index - b.chunk_index);
    if (suyos.length === 0) continue;
    const alias = `R${fuentes.length + 1}`;
    fuentes.push({
      alias,
      id: resumen.id,
      numero: resumen.numero,
      articulos: resumen.articulos,
    });
    bloques.push(
      `<resolucion id="${alias}" cita="${citaDe(resumen)}">\n${suyos
        .map((f) => `<fragmento>\n${f.content}\n</fragmento>`)
        .join('\n')}\n</resolucion>`
    );
  }

  const texto = fragmentos
    .filter((f) => porId.has(f.resolucion_id))
    .map((f) => f.content)
    .join('\n\n');
  return { fuentes, bloques, texto };
}

export async function responder(
  db: SupabaseClient,
  pregunta: string
): Promise<RespuestaAsistente> {
  const fragmentos = await fragmentosRelevantes(db, pregunta, FRAGMENTOS);
  if (fragmentos.length === 0) return SIN_RESULTADOS;

  // En el orden en que la búsqueda las encontró: la más relevante es R1.
  const ids = [...new Set(fragmentos.map((f) => f.resolucion_id))];
  const resumenes = await resumenesPorId(db, ids);
  const { fuentes, bloques, texto } = armarFuentes(fragmentos, resumenes);
  if (fuentes.length === 0) return SIN_RESULTADOS;

  const { texto: crudo } = await pedirTexto({
    sistema: SISTEMA,
    texto: `<fuentes>\n${bloques.join('\n')}\n</fuentes>\n\n<pregunta>\n${pregunta}\n</pregunta>`,
    maxTokens: 6000,
    esfuerzo: 'medium',
  });

  const validada = validarCitas(crudo, fuentes, texto);
  if (validada.descartes.length > 0) {
    console.warn(
      '[juris asistente] descartado al validar:',
      validada.descartes
    );
  }
  if (!validada.texto) return SIN_RESULTADOS;

  const porId = new Map(resumenes.map((r) => [r.id, r]));
  return {
    respuesta: validada.texto,
    citas: validada.citadas.map((id) => {
      const resumen = porId.get(id)!;
      return { ...resumen, cita: citaDe(resumen) };
    }),
    sinResultados: false,
    aviso: AVISO,
  };
}
