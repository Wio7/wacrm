import { NextResponse } from 'next/server';

import { buscar, MAX_CONSULTA } from '@/lib/juris/busqueda';
import { ruta } from '@/lib/juris/http';
import { registrarConsulta } from '@/lib/juris/uso';

/**
 * GET /api/juris/buscar?q=
 *
 * Búsqueda híbrida en el catálogo: por palabras (número de casación,
 * artículo, término exacto) y por significado, fusionadas con RRF en la
 * base (migración 073). Devuelve hasta 20 resoluciones, de más a menos
 * relevante, cada una con un extracto del fragmento que la trajo.
 *
 *   ?q=         lo que se busca (obligatorio)
 *   ?registrar=0  no dejarla en las búsquedas recientes (la app lo usa
 *                 mientras el usuario todavía está escribiendo)
 */
export const GET = ruta(async (ctx, request) => {
  const params = new URL(request.url).searchParams;
  const q = (params.get('q') ?? '').trim().slice(0, MAX_CONSULTA);
  if (q.length < 2) {
    return NextResponse.json(
      { error: 'Escribe qué quieres buscar.' },
      { status: 400 }
    );
  }

  const inicio = performance.now();
  const resultados = await buscar(ctx.supabase, q);
  const duracionMs = performance.now() - inicio;

  if (params.get('registrar') !== '0') {
    await registrarConsulta(ctx, {
      tipo: 'busqueda',
      pregunta: q,
      resolucionesCitadas: resultados.map((r) => r.id),
      sinResultados: resultados.length === 0,
      duracionMs,
    });
  }

  return { q, resultados, duracion_ms: Math.round(duracionMs) };
});
