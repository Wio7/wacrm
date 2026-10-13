import { NextResponse } from 'next/server';

import { cuentaDe } from '@/lib/juris/acceso';
import { cuerpo, ruta, texto } from '@/lib/juris/http';

const MAX_NOMBRE = 120;
const MAX_NOTAS = 10_000;

/**
 * GET /api/juris/carpetas
 *
 * Las carpetas del usuario (una por caso), con cuántas resoluciones
 * tiene cada una. La que se tocó más recientemente va primero.
 */
export const GET = ruta(async (ctx) => {
  cuentaDe(ctx);
  const { data, error } = await ctx.supabase
    .from('juris_carpetas')
    .select(
      'id, nombre, notas, created_at, updated_at, juris_carpeta_resoluciones(count)'
    )
    .order('updated_at', { ascending: false });
  if (error) throw error;

  return {
    carpetas: (data ?? []).map(
      ({ juris_carpeta_resoluciones: dentro, ...carpeta }) => ({
        ...carpeta,
        resoluciones: (dentro as unknown as { count: number }[])[0]?.count ?? 0,
      })
    ),
  };
});

/** POST /api/juris/carpetas   { "nombre": "…", "notas": "…" } */
export const POST = ruta(async (ctx, request) => {
  const datos = await cuerpo(request);
  const nombre = texto(datos.nombre, MAX_NOMBRE);
  if (!nombre) {
    return NextResponse.json(
      { error: 'Ponle un nombre a la carpeta.' },
      { status: 400 }
    );
  }
  const { data, error } = await ctx.supabase
    .from('juris_carpetas')
    .insert({
      account_id: cuentaDe(ctx),
      user_id: ctx.userId,
      nombre,
      notas: texto(datos.notas, MAX_NOTAS),
    })
    .select('id, nombre, notas, created_at, updated_at')
    .single();
  if (error) throw error;
  return NextResponse.json(
    { carpeta: { ...data, resoluciones: 0 } },
    { status: 201 }
  );
});
