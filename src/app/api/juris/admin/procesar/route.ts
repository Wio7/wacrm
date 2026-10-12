import { after, NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/flows/admin-client';
import { requireAdminWio } from '@/lib/juris/acceso';
import { respuestaDeError } from '@/lib/juris/http';
import { procesarCola } from '@/lib/juris/ingesta';

/**
 * POST /api/juris/admin/procesar  (admin de Wio)
 *
 * Empuja la cola. El panel lo llama mientras haya trabajos pendientes:
 * una pasada se queda sin tiempo a mitad de un escaneo largo y alguien
 * tiene que arrancar la siguiente. Llamarlo de más no hace daño — cada
 * pasada se lleva trabajos distintos — y es también lo que se usa
 * después de pulsar "Reintentar".
 */
export const maxDuration = 300;

export async function POST() {
  try {
    await requireAdminWio();
    after(() =>
      procesarCola(supabaseAdmin()).catch((err) =>
        console.error('[juris procesar] queue run failed:', err)
      )
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return respuestaDeError(err);
  }
}
