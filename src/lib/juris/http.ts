import { NextResponse } from 'next/server';

import { toErrorResponse } from '@/lib/auth/account';

import { JurisError } from './tipos';

/** Un JurisError trae un mensaje pensado para mostrarse; lo demás sigue
 *  el camino de siempre (401 / 403 / 500 sin detalles internos). */
export function respuestaDeError(err: unknown): NextResponse {
  if (err instanceof JurisError) {
    return NextResponse.json(
      { error: err.message, codigo: err.codigo },
      { status: 400 }
    );
  }
  return toErrorResponse(err);
}
