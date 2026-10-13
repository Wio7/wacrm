// ============================================================
// El registro de uso y el límite de preguntas al asistente.
//
// Cada búsqueda y cada pregunta queda en `juris_consultas` (069). De ahí
// salen tres cosas: las búsquedas recientes del usuario, saber qué temas
// hace falta cargar, y el límite de uso — cada pregunta al asistente es
// una llamada pagada al modelo.
//
// El límite se cuenta en la base y no en memoria: el servidor corre en
// funciones que nacen y mueren, y un contador en memoria se reinicia
// con cada una.
//
//   JURIS_ASISTENTE_POR_MINUTO   por defecto 5
//   JURIS_ASISTENTE_POR_DIA      por defecto 60 (día de Lima)
// ============================================================

import { checkRateLimit } from '@/lib/rate-limit';

import type { ContextoJuris } from './acceso';
import { JurisError } from './tipos';

const entero = (valor: string | undefined, defecto: number) => {
  const n = Number.parseInt(valor ?? '', 10);
  return Number.isInteger(n) && n > 0 ? n : defecto;
};

export const limitesDelAsistente = (
  env: Record<string, string | undefined> = process.env
) => ({
  porMinuto: entero(env.JURIS_ASISTENTE_POR_MINUTO, 5),
  porDia: entero(env.JURIS_ASISTENTE_POR_DIA, 60),
});

/** La medianoche de Lima (UTC−5, sin horario de verano) más reciente. */
export function inicioDelDiaEnLima(ahora = new Date()): Date {
  const CINCO_HORAS = 5 * 60 * 60 * 1000;
  const enLima = new Date(ahora.getTime() - CINCO_HORAS);
  enLima.setUTCHours(0, 0, 0, 0);
  return new Date(enLima.getTime() + CINCO_HORAS);
}

async function preguntasDesde(
  ctx: ContextoJuris,
  desde: Date
): Promise<number> {
  const { count, error } = await ctx.supabase
    .from('juris_consultas')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.userId)
    .eq('tipo', 'asistente')
    .gte('created_at', desde.toISOString());
  if (error) throw error;
  return count ?? 0;
}

/** Lanza si el usuario ya agotó sus preguntas del minuto o del día. */
export async function exigirCupoDelAsistente(
  ctx: ContextoJuris
): Promise<void> {
  const { porMinuto, porDia } = limitesDelAsistente();

  // El admin de Wio no tiene cuenta en el módulo y sus preguntas no se
  // registran, así que no hay qué contar en la base.
  if (!ctx.accountId) {
    const cupo = checkRateLimit(`juris-asistente:${ctx.userId}`, {
      limit: porMinuto,
      windowMs: 60_000,
    });
    if (!cupo.success) {
      throw new JurisError(
        'limite_de_uso',
        'Espera un momento antes de preguntar de nuevo.'
      );
    }
    return;
  }

  const [minuto, dia] = await Promise.all([
    preguntasDesde(ctx, new Date(Date.now() - 60_000)),
    preguntasDesde(ctx, inicioDelDiaEnLima()),
  ]);
  if (minuto >= porMinuto) {
    throw new JurisError(
      'limite_de_uso',
      'Espera un momento antes de preguntar de nuevo.'
    );
  }
  if (dia >= porDia) {
    throw new JurisError(
      'limite_de_uso',
      `Llegaste al límite de ${porDia} preguntas al asistente por hoy. Mañana vuelves a tenerlas; el buscador sigue disponible.`
    );
  }
}

interface Consulta {
  tipo: 'busqueda' | 'asistente';
  pregunta: string;
  respuesta?: string | null;
  resolucionesCitadas?: string[];
  sinResultados: boolean;
  duracionMs: number;
}

/** Deja la consulta en el registro. Nunca hace fallar lo que registra. */
export async function registrarConsulta(
  ctx: ContextoJuris,
  consulta: Consulta
): Promise<void> {
  if (!ctx.accountId) return;
  const { error } = await ctx.supabase.from('juris_consultas').insert({
    account_id: ctx.accountId,
    user_id: ctx.userId,
    tipo: consulta.tipo,
    pregunta: consulta.pregunta,
    respuesta: consulta.respuesta ?? null,
    resoluciones_citadas: consulta.resolucionesCitadas ?? [],
    sin_resultados: consulta.sinResultados,
    duracion_ms: Math.round(consulta.duracionMs),
  });
  if (error) console.error('[juris uso] could not log the query:', error);
}
