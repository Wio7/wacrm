import { NextResponse } from 'next/server';

import { cuentaDe } from '@/lib/juris/acceso';
import { resumenesPorId } from '@/lib/juris/catalogo';
import { cuerpo, ruta, texto } from '@/lib/juris/http';

const MAX_NOMBRE = 120;
const MAX_NOTAS = 10_000;

const NO_ESTA = () =>
  NextResponse.json({ error: 'No se encontró la carpeta.' }, { status: 404 });

/**
 * GET /api/juris/carpetas/[id]
 *
 * La carpeta con sus resoluciones y la nota de cada una, en el orden en
 * que se fueron añadiendo.
 */
export const GET = ruta<{ id: string }>(async (ctx, _request, { id }) => {
  cuentaDe(ctx);
  const { data: carpeta, error } = await ctx.supabase
    .from('juris_carpetas')
    .select('id, nombre, notas, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!carpeta) return NO_ESTA();

  const { data: dentro, error: errDentro } = await ctx.supabase
    .from('juris_carpeta_resoluciones')
    .select('resolucion_id, nota, created_at')
    .eq('carpeta_id', id)
    .order('created_at');
  if (errDentro) throw errDentro;

  const notas = new Map(
    (dentro ?? []).map((d) => [
      d.resolucion_id as string,
      { nota: d.nota as string | null, agregada_at: d.created_at as string },
    ])
  );
  const resumenes = await resumenesPorId(ctx.supabase, [...notas.keys()]);
  return {
    carpeta: {
      ...carpeta,
      resoluciones: resumenes.map((r) => ({ ...r, ...notas.get(r.id) })),
    },
  };
});

/** PATCH /api/juris/carpetas/[id]   { "nombre"?: "…", "notas"?: "…" | null } */
export const PATCH = ruta<{ id: string }>(async (ctx, request, { id }) => {
  cuentaDe(ctx);
  const datos = await cuerpo(request);
  const cambios: Record<string, string | null> = {};
  if ('nombre' in datos) {
    const nombre = texto(datos.nombre, MAX_NOMBRE);
    if (!nombre) {
      return NextResponse.json(
        { error: 'El nombre no puede quedar vacío.' },
        { status: 400 }
      );
    }
    cambios.nombre = nombre;
  }
  if ('notas' in datos) cambios.notas = texto(datos.notas, MAX_NOTAS);
  if (Object.keys(cambios).length === 0) {
    return NextResponse.json(
      { error: 'No hay nada que cambiar.' },
      { status: 400 }
    );
  }

  const { data, error } = await ctx.supabase
    .from('juris_carpetas')
    .update(cambios)
    .eq('id', id)
    .select('id, nombre, notas, created_at, updated_at')
    .maybeSingle();
  if (error) throw error;
  return data ? { carpeta: data } : NO_ESTA();
});

/** DELETE /api/juris/carpetas/[id] — la carpeta y lo que tiene dentro. */
export const DELETE = ruta<{ id: string }>(async (ctx, _request, { id }) => {
  cuentaDe(ctx);
  const { error } = await ctx.supabase
    .from('juris_carpetas')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return { ok: true };
});
