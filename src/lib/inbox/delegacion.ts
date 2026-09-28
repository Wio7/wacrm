// Cómo se cuenta en pantalla el pase del jefe de ventas a un asesor (062).

import type { Conversation } from "@/types";

const MOTIVO: Record<string, string> = {
  agendo: "agendó",
  "24h": "a las 24 h",
  manual: "a mano",
};

/**
 * "Pasado a Alex · agendó", o null si la conversación no se pasó.
 * `nombre` traduce un user_id al nombre que se ve en el equipo.
 */
export function textoDeDelegacion(
  conv: Pick<Conversation, "delegated_at" | "delegation_reason" | "assigned_agent_id">,
  nombre: (userId: string | null | undefined) => string | null,
): string | null {
  if (!conv.delegated_at) return null;
  const quien = nombre(conv.assigned_agent_id) ?? "un asesor";
  const por = conv.delegation_reason ? MOTIVO[conv.delegation_reason] : null;
  return por ? `Pasado a ${quien} · ${por}` : `Pasado a ${quien}`;
}
