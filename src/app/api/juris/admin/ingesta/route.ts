import { after, NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/flows/admin-client';
import { requireAdminWio } from '@/lib/juris/acceso';
import { cargaManual, encolar } from '@/lib/juris/fuentes';
import { respuestaDeError } from '@/lib/juris/http';
import { procesarCola } from '@/lib/juris/ingesta';

/**
 * POST /api/juris/admin/ingesta  (admin de Wio)
 *
 * Registra los PDFs que el panel ya subió a Storage y los pone en la
 * cola. Los archivos no pasan por aquí: el navegador los sube directo
 * al bucket, así un PDF pesado no choca con el límite de tamaño de las
 * funciones del servidor.
 *
 *   { "archivos": [{ "path": "subidas/<uuid>.pdf", "nombre": "Cas 1234-2019.pdf" }] }
 *
 * Responde de inmediato y trabaja la cola después: leer un PDF y armar
 * su ficha tarda más de lo que conviene tener a alguien esperando.
 */
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireAdminWio();
    const body = (await request.json().catch(() => null)) as {
      archivos?: unknown;
    } | null;

    // Con la sesión del admin: la política de la tabla es la que decide.
    const ids = await encolar(supabase, cargaManual(body?.archivos), userId);

    after(() =>
      procesarCola(supabaseAdmin()).catch((err) =>
        console.error('[juris ingesta] queue run failed:', err)
      )
    );

    return NextResponse.json({ ok: true, resoluciones: ids });
  } catch (err) {
    return respuestaDeError(err);
  }
}
