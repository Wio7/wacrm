import { NextResponse } from 'next/server';

import { cuentaDe } from '@/lib/juris/acceso';
import { cuerpo, ruta, texto } from '@/lib/juris/http';

/**
 * GET /api/juris/alertas
 *
 * Los temas que el usuario sigue. Cuando se publica una resolución en
 * uno de ellos (o en algo que cuelga de él), recibe un aviso.
 */
export const GET = ruta(async (ctx) => {
  cuentaDe(ctx);
  const { data, error } = await ctx.supabase
    .from('juris_alertas')
    .select('created_at, juris_temas(id, parent_id, slug, nombre)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return {
    alertas: (data ?? []).map((a) => ({
      ...(a.juris_temas as unknown as Record<string, unknown>),
      seguido_at: a.created_at,
    })),
  };
});

/** POST /api/juris/alertas   { "tema_id": "…" } — seguir un tema. */
export const POST = ruta(async (ctx, request) => {
  const temaId = texto((await cuerpo(request)).tema_id, 64);
  if (!temaId) {
    return NextResponse.json({ error: 'Falta tema_id.' }, { status: 400 });
  }
  const { error } = await ctx.supabase
    .from('juris_alertas')
    .upsert(
      { account_id: cuentaDe(ctx), user_id: ctx.userId, tema_id: temaId },
      { onConflict: 'user_id,tema_id', ignoreDuplicates: true }
    );
  if (error) throw error;
  return { ok: true };
});
