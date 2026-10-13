import { NextResponse } from 'next/server';

import { toErrorResponse } from '@/lib/auth/account';

import { requireJuris, type ContextoJuris } from './acceso';
import { JurisError } from './tipos';

// Errores de Postgres que son culpa de lo que se pidió, no del servidor.
const DE_LA_PETICION: Record<string, [number, string]> = {
  '23505': [409, 'Ya existe.'],
  '23503': [404, 'No existe la resolución, el tema o la carpeta.'],
  '23514': [400, 'Los datos no son válidos.'],
  '22P02': [400, 'El identificador no es válido.'],
  '42501': [403, 'No tienes permiso para eso.'],
};

/** Un JurisError trae un mensaje pensado para mostrarse; lo demás sigue
 *  el camino de siempre (401 / 403 / 500 sin detalles internos). */
export function respuestaDeError(err: unknown): NextResponse {
  if (err instanceof JurisError) {
    return NextResponse.json(
      { error: err.message, codigo: err.codigo },
      { status: err.codigo === 'limite_de_uso' ? 429 : 400 }
    );
  }
  const codigo = (err as { code?: unknown } | null)?.code;
  if (typeof codigo === 'string' && codigo in DE_LA_PETICION) {
    const [status, error] = DE_LA_PETICION[codigo];
    return NextResponse.json({ error }, { status });
  }
  return toErrorResponse(err);
}

/**
 * Envuelve una ruta de la app: resuelve quién llama, corre el manejador
 * y convierte lo que devuelva (o lo que falle) en una respuesta.
 */
export function ruta<P = Record<string, never>>(
  manejar: (ctx: ContextoJuris, request: Request, params: P) => Promise<unknown>
) {
  return async (request: Request, extra: { params: Promise<P> }) => {
    try {
      const ctx = await requireJuris();
      const salida = await manejar(ctx, request, await extra.params);
      return salida instanceof Response ? salida : NextResponse.json(salida);
    } catch (err) {
      return respuestaDeError(err);
    }
  };
}

/** El cuerpo JSON de la petición como objeto, o {} si no es uno. */
export async function cuerpo(
  request: Request
): Promise<Record<string, unknown>> {
  const json = await request.json().catch(() => null);
  return json && typeof json === 'object' && !Array.isArray(json)
    ? (json as Record<string, unknown>)
    : {};
}

export const texto = (valor: unknown, max: number): string | null =>
  typeof valor === 'string' && valor.trim() ? valor.trim().slice(0, max) : null;
