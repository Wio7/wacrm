// ============================================================
// El buscador: híbrido (palabras + significado), fusionado en la base
// con RRF (migración 073).
//
// El embedding de la consulta es opcional: si no hay clave de
// embeddings, o el proveedor falla, se busca sólo por palabras. Un
// buscador que devuelve menos es mejor que uno que devuelve un error.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { toVectorLiteral } from '@/lib/ai/embeddings';

import { resumenesPorId, type Resumen } from './catalogo';
import { crearEmbeddings } from './embeddings';

export const MAX_CONSULTA = 500;

/** El vector de la consulta como literal de pgvector, o null. */
export async function embeddingDeConsulta(
  texto: string
): Promise<string | null> {
  try {
    const servicio = crearEmbeddings();
    if (!servicio) return null;
    return toVectorLiteral(await servicio.consulta(texto));
  } catch (err) {
    console.error(
      '[juris búsqueda] query embedding failed, lexical only:',
      err
    );
    return null;
  }
}

/** Lo que rodea a la consulta dentro del fragmento, para mostrarlo. */
export function extracto(fragmento: string | null, largo = 280): string | null {
  if (!fragmento) return null;
  const plano = fragmento.replace(/\s+/g, ' ').trim();
  return plano.length <= largo ? plano : `${plano.slice(0, largo).trimEnd()}…`;
}

export interface Resultado extends Resumen {
  puntaje: number;
  extracto: string | null;
}

export async function buscar(
  db: SupabaseClient,
  consulta: string,
  limite = 20
): Promise<Resultado[]> {
  const { data, error } = await db.rpc('juris_buscar', {
    p_query: consulta,
    p_embedding: await embeddingDeConsulta(consulta),
    p_limit: limite,
  });
  if (error) throw error;

  const filas = (data ?? []) as {
    resolucion_id: string;
    puntaje: number;
    fragmento: string | null;
  }[];
  const resumenes = await resumenesPorId(
    db,
    filas.map((f) => f.resolucion_id)
  );
  const porId = new Map(resumenes.map((r) => [r.id, r]));

  return filas.flatMap((f) => {
    const resumen = porId.get(f.resolucion_id);
    return resumen
      ? [{ ...resumen, puntaje: f.puntaje, extracto: extracto(f.fragmento) }]
      : [];
  });
}

export interface Fragmento {
  chunk_id: string;
  resolucion_id: string;
  chunk_index: number;
  content: string;
  puntaje: number;
}

/** Los fragmentos más relevantes, para dárselos al asistente. */
export async function fragmentosRelevantes(
  db: SupabaseClient,
  consulta: string,
  limite = 10
): Promise<Fragmento[]> {
  const { data, error } = await db.rpc('juris_fragmentos', {
    p_query: consulta,
    p_embedding: await embeddingDeConsulta(consulta),
    p_limit: limite,
  });
  if (error) throw error;
  return (data ?? []) as Fragmento[];
}
