import { NextResponse } from 'next/server';

import { requireAdminWio } from '@/lib/juris/acceso';
import { respuestaDeError } from '@/lib/juris/http';

/**
 * POST /api/juris/admin/resoluciones/[id]/publicar  (admin de Wio)
 *
 * El único camino por el que una resolución llega a la app. Deja
 * escrito quién la revisó y cuándo; la base rechaza la publicación si
 * falta eso o lo mínimo para citarla (juris_resoluciones_publicable).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, userId } = await requireAdminWio();
    const { id } = await params;

    // Sin fragmentos el asistente no tiene de dónde citarla: todavía se
    // está procesando, o la ingesta falló antes de terminar.
    const { count, error: errFragmentos } = await supabase
      .from('juris_resolucion_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('resolucion_id', id);
    if (errFragmentos) throw errFragmentos;
    if (!count) {
      return NextResponse.json(
        { error: 'Esta resolución aún no termina de procesarse.' },
        { status: 409 }
      );
    }

    const ahora = new Date().toISOString();
    const { data, error } = await supabase
      .from('juris_resoluciones')
      .update({
        estado: 'publicada',
        revisado_por: userId,
        revisado_at: ahora,
        publicada_at: ahora,
        motivo_rechazo: null,
      })
      .eq('id', id)
      .neq('estado', 'publicada')
      .select('id')
      .maybeSingle();

    if (error) {
      if (error.code === '23514') {
        return NextResponse.json(
          {
            error:
              'Para publicar hacen falta el tipo, el número, la sala, la fecha y el PDF o el enlace a la fuente.',
          },
          { status: 400 }
        );
      }
      throw error;
    }
    if (!data) {
      return NextResponse.json(
        { error: 'No se encontró la resolución o ya estaba publicada.' },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return respuestaDeError(err);
  }
}
