import { NextResponse } from 'next/server';

import { cuentaDe } from '@/lib/juris/acceso';
import { resumenesPorId } from '@/lib/juris/catalogo';
import { cuerpo, ruta, texto } from '@/lib/juris/http';

/**
 * GET /api/juris/favoritos
 *
 * Las resoluciones que el usuario guardó, de la más reciente a la más
 * antigua. Una que se despublicó deja de venir, pero no se pierde: si
 * vuelve a publicarse, reaparece.
 */
export const GET = ruta(async (ctx) => {
  cuentaDe(ctx);
  const { data, error } = await ctx.supabase
    .from('juris_favoritos')
    .select('resolucion_id, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const guardadoEn = new Map(
    (data ?? []).map((f) => [f.resolucion_id as string, f.created_at as string])
  );
  const resumenes = await resumenesPorId(ctx.supabase, [...guardadoEn.keys()]);
  return {
    favoritos: resumenes.map((r) => ({
      ...r,
      guardado_at: guardadoEn.get(r.id),
    })),
  };
});

/**
 * POST /api/juris/favoritos   { "resolucion_id": "…" }
 *
 * Guardar dos veces la misma no es un error.
 */
export const POST = ruta(async (ctx, request) => {
  const resolucionId = texto((await cuerpo(request)).resolucion_id, 64);
  if (!resolucionId) {
    return NextResponse.json(
      { error: 'Falta resolucion_id.' },
      { status: 400 }
    );
  }
  const { error } = await ctx.supabase.from('juris_favoritos').upsert(
    {
      account_id: cuentaDe(ctx),
      user_id: ctx.userId,
      resolucion_id: resolucionId,
    },
    { onConflict: 'user_id,resolucion_id', ignoreDuplicates: true }
  );
  if (error) throw error;
  return { ok: true };
});
