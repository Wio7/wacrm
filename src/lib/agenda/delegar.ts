// ============================================================
// Del jefe de ventas al asesor (062).
//
// El prospecto nuevo nace del jefe de ventas, que lo califica con la IA.
// En cuanto agenda, su conversación pasa al asesor con el que agendó; y
// si en 24 horas nadie la pasó, el cron se la pasa al menos cargado.
//
// La regla vive en la base (`delegar_conversacion`): sólo pasa lo que
// tiene el jefe y no se pasó antes, y deja anotado quién, cuándo y por
// qué. Aquí sólo se la llama.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

import { notifyConversation } from "@/lib/push/send";

/** La función no existe: 062 sin aplicar. No es un error, es "todavía no". */
const falta062 = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === "PGRST202" || error.code === "42883" || /delegar_/.test(error.message ?? ""));

/**
 * El prospecto agendó con `asesorId`: sus conversaciones que todavía
 * tiene el jefe de ventas pasan a ese asesor. Devuelve cuántas pasaron.
 */
export async function pasarAlAgendar(
  db: SupabaseClient,
  args: { accountId: string; contactId: string; asesorId: string },
): Promise<number> {
  const { data: convs } = await db
    .from("conversations")
    .select("id")
    .eq("account_id", args.accountId)
    .eq("contact_id", args.contactId)
    .is("delegated_at", null)
    .not("assigned_agent_id", "is", null)
    .limit(10);

  let pasadas = 0;
  for (const conv of convs ?? []) {
    const { data, error } = await db.rpc("delegar_conversacion", {
      p_conversation_id: conv.id,
      p_motivo: "agendo",
      p_asesor: args.asesorId,
    });
    if (error) {
      if (!falta062(error)) console.error("[reparto] no se pudo pasar al asesor:", error.message);
      return pasadas;
    }
    if (data) pasadas += 1;
  }
  return pasadas;
}

/**
 * Las que el jefe de ventas lleva 24 horas sin pasar, al asesor menos
 * cargado. Al asesor le suena el celular: le llegó un cliente.
 */
export async function pasarLasVencidas(db: SupabaseClient): Promise<{ pasadas: number }> {
  const { data, error } = await db.rpc("delegar_vencidas", { p_horas: 24 });
  if (error) {
    if (!falta062(error)) console.error("[reparto] delegar_vencidas falló:", error.message);
    return { pasadas: 0 };
  }

  const filas = (data ?? []) as { conversation_id: string; account_id: string; agent_id: string }[];
  for (const f of filas) {
    await notifyConversation(db, {
      accountId: f.account_id,
      conversationId: f.conversation_id,
      assignedAgentId: f.agent_id,
      title: "Te pasaron un cliente",
      body: "Lleva un día conversando con Golden y todavía no tenía asesor. Ahora es tuyo.",
    }).catch((err) => console.error("[reparto] aviso al asesor falló:", err));
  }
  return { pasadas: filas.length };
}
