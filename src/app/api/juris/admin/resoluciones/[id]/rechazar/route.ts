import { NextResponse } from 'next/server';

import { requireAdminWio } from '@/lib/juris/acceso';
import { respuestaDeError } from '@/lib/juris/http';

/**
 * POST /api/juris/admin/resoluciones/[id]/rechazar  (admin de Wio)
 *
 *   { "motivo": "No es una casación civil" }
 *
 * Saca la resolución de la cola de revisión (y de la app, si estaba
 * publicada). No borra nada: queda en 'rechazada' con su motivo.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase } = await requireAdminWio();
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as {
      motivo?: unknown;
    } | null;
    const motivo =
      typeof body?.motivo === 'string' && body.motivo.trim()
        ? body.motivo.trim().slice(0, 500)
        : null;

    const { data, error } = await supabase
      .from('juris_resoluciones')
      .update({ estado: 'rechazada', motivo_rechazo: motivo })
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: 'No se encontró la resolución.' },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return respuestaDeError(err);
  }
}
