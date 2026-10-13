import { NextResponse } from 'next/server';

import { cuentaDe } from '@/lib/juris/acceso';
import { cuerpo, ruta, texto } from '@/lib/juris/http';

const MAX_NOTA = 4000;

/**
 * POST /api/juris/carpetas/[id]/resoluciones
 *
 *   { "resolucion_id": "…", "nota": "…" }
 *
 * Añade una resolución a la carpeta. Si ya estaba, actualiza su nota
 * (cuando llega una) y no la duplica.
 */
export const POST = ruta<{ id: string }>(async (ctx, request, { id }) => {
  cuentaDe(ctx);
  const datos = await cuerpo(request);
  const resolucionId = texto(datos.resolucion_id, 64);
  if (!resolucionId) {
    return NextResponse.json(
      { error: 'Falta resolucion_id.' },
      { status: 400 }
    );
  }

  // Sin `nota` en la petición no se toca la que ya tuviera.
  const fila: Record<string, string | null> = {
    carpeta_id: id,
    resolucion_id: resolucionId,
  };
  if ('nota' in datos) fila.nota = texto(datos.nota, MAX_NOTA);
  const { error } = await ctx.supabase
    .from('juris_carpeta_resoluciones')
    .upsert(fila, { onConflict: 'carpeta_id,resolucion_id' });
  if (error) {
    // La política no deja escribir en una carpeta ajena o inexistente.
    if (error.code === '42501') {
      return NextResponse.json(
        { error: 'No se encontró la carpeta.' },
        { status: 404 }
      );
    }
    throw error;
  }

  // Para que la carpeta suba en "lo último que toqué".
  await ctx.supabase
    .from('juris_carpetas')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id);
  return { ok: true };
});
