import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/flows/admin-client';
import { procesarCola } from '@/lib/juris/ingesta';

/**
 * GET /api/juris/cron
 *
 * Trabaja la cola de ingesta sin que nadie tenga el panel abierto. No
 * hace falta para el día a día — el panel empuja la cola mientras está
 * a la vista —, pero termina lo que quedó a medias si se cierra la
 * pestaña en plena carga.
 *
 * Misma autenticación que /api/calls/cron: `x-cron-secret` con
 * AUTOMATION_CRON_SECRET (un pinger externo) o `Authorization: Bearer`
 * con CRON_SECRET (Vercel Cron).
 */
export const maxDuration = 300;

function secretMatches(
  supplied: string,
  expected: string | undefined
): boolean {
  if (!expected) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const headerSecret = process.env.AUTOMATION_CRON_SECRET;
  const vercelSecret = process.env.CRON_SECRET;
  if (!headerSecret && !vercelSecret) {
    return NextResponse.json({ error: 'cron not configured' }, { status: 503 });
  }

  const bearer = (request.headers.get('authorization') ?? '').replace(
    /^Bearer\s+/i,
    ''
  );
  const authorized =
    secretMatches(request.headers.get('x-cron-secret') ?? '', headerSecret) ||
    secretMatches(bearer, vercelSecret);
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { procesados } = await procesarCola(supabaseAdmin());
    return NextResponse.json({ ok: true, procesados });
  } catch (err) {
    console.error('[juris cron] queue run failed:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
