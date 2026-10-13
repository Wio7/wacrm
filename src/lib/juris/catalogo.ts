// ============================================================
// Leer el catálogo desde la app: listados, fichas y cómo se cita una
// resolución. Todo con el cliente del usuario — RLS decide qué ve — y
// además filtrando 'publicada', para que ni el admin de Wio vea por la
// API de la app algo que la app no debe mostrar.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  FALLOS,
  NOMBRE_TIPO,
  TIPOS_RESOLUCION,
  type Fallo,
  type Tema,
  type TipoResolucion,
} from './tipos';

/** Lo que se muestra de una resolución en un listado o en una tarjeta. */
export const COLUMNAS_RESUMEN =
  'id, tipo, numero, anio, procedencia, sala, fecha, sumilla, criterio, articulos, fallo, publicada_at';

/** La ficha completa, sin el texto ni lo interno de la ingesta. */
export const COLUMNAS_FICHA = `${COLUMNAS_RESUMEN}, hechos, url_fuente, pdf_path, paginas`;

export interface Resumen {
  id: string;
  tipo: TipoResolucion | null;
  numero: string | null;
  anio: number | null;
  procedencia: string | null;
  sala: string | null;
  fecha: string | null;
  sumilla: string | null;
  criterio: string | null;
  articulos: string[];
  fallo: Fallo | null;
  publicada_at: string | null;
}

const fechaLarga = (iso: string) => {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
};

/**
 * La resolución como se cita en un escrito:
 * "Casación N.° 1234-2019 Lima, Sala Civil Permanente, 10/03/2020".
 */
export function citaDe(
  r: Pick<Resumen, 'tipo' | 'numero' | 'procedencia' | 'sala' | 'fecha'>
): string {
  const cabeza = [
    r.tipo ? NOMBRE_TIPO[r.tipo] : 'Resolución',
    r.numero ? `N.° ${r.numero}` : null,
    r.procedencia,
  ]
    .filter(Boolean)
    .join(' ');
  return [cabeza, r.sala, r.fecha ? fechaLarga(r.fecha) : null]
    .filter(Boolean)
    .join(', ');
}

/** El tema y todo lo que cuelga de él: filtrar por "Contratos" incluye
 *  lo que está bajo "Compraventa". Acepta id o slug. */
export function subarbol(temas: Tema[], idOSlug: string): string[] {
  const raiz = temas.find((t) => t.id === idOSlug || t.slug === idOSlug);
  if (!raiz) return [];
  const ids = [raiz.id];
  for (let i = 0; i < ids.length; i++) {
    for (const t of temas) if (t.parent_id === ids[i]) ids.push(t.id);
  }
  return ids;
}

export async function leerTemas(db: SupabaseClient): Promise<Tema[]> {
  const { data, error } = await db
    .from('juris_temas')
    .select('id, parent_id, slug, nombre, descripcion, orden')
    .order('orden');
  if (error) throw error;
  return (data ?? []) as Tema[];
}

export interface Filtros {
  tema?: string | null;
  tipo?: string | null;
  anio?: string | null;
  sala?: string | null;
  fallo?: string | null;
  articulo?: string | null;
  pagina?: string | null;
}

export const POR_PAGINA = 20;

// Lo que tiene sentido en un filtro de texto: sin comodines de LIKE ni
// la sintaxis de filtros de PostgREST.
const textoDeFiltro = (s: string) =>
  s
    .replace(/[%_,()*\\]/g, ' ')
    .trim()
    .slice(0, 80);

export async function listarResoluciones(db: SupabaseClient, f: Filtros) {
  const pagina = Math.max(1, Number.parseInt(f.pagina ?? '1', 10) || 1);
  const desde = (pagina - 1) * POR_PAGINA;

  let temaIds: string[] | null = null;
  if (f.tema) {
    temaIds = subarbol(await leerTemas(db), f.tema);
    if (temaIds.length === 0) return { resoluciones: [], total: 0, pagina };
  }

  let consulta = db
    .from('juris_resoluciones')
    .select(
      temaIds
        ? `${COLUMNAS_RESUMEN}, juris_resolucion_temas!inner(tema_id)`
        : COLUMNAS_RESUMEN,
      { count: 'exact' }
    )
    .eq('estado', 'publicada');

  if (temaIds)
    consulta = consulta.in('juris_resolucion_temas.tema_id', temaIds);
  if (f.tipo && (TIPOS_RESOLUCION as readonly string[]).includes(f.tipo)) {
    consulta = consulta.eq('tipo', f.tipo);
  }
  if (f.fallo && (FALLOS as readonly string[]).includes(f.fallo)) {
    consulta = consulta.eq('fallo', f.fallo);
  }
  const anio = Number.parseInt(f.anio ?? '', 10);
  if (Number.isInteger(anio)) consulta = consulta.eq('anio', anio);
  const sala = textoDeFiltro(f.sala ?? '');
  if (sala) consulta = consulta.ilike('sala', `%${sala}%`);
  const articulo = textoDeFiltro(f.articulo ?? '');
  if (articulo) consulta = consulta.ilike('articulos_texto', `%${articulo}%`);

  const { data, error, count } = await consulta
    .order('publicada_at', { ascending: false })
    .order('id')
    .range(desde, desde + POR_PAGINA - 1);
  if (error) throw error;

  // El join con los temas sólo servía para filtrar; no va en la respuesta.
  const resoluciones = (
    (data ?? []) as unknown as Record<string, unknown>[]
  ).map((fila) => {
    const resumen = { ...fila };
    delete resumen.juris_resolucion_temas;
    return resumen as unknown as Resumen;
  });
  return { resoluciones, total: count ?? 0, pagina };
}

/** Los resúmenes de `ids`, en el mismo orden; los que no se pueden leer
 *  (despublicados, borrados) simplemente no vienen. */
export async function resumenesPorId(
  db: SupabaseClient,
  ids: string[]
): Promise<Resumen[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db
    .from('juris_resoluciones')
    .select(COLUMNAS_RESUMEN)
    .eq('estado', 'publicada')
    .in('id', ids);
  if (error) throw error;
  const porId = new Map(((data ?? []) as Resumen[]).map((r) => [r.id, r]));
  return ids.map((id) => porId.get(id)).filter((r): r is Resumen => Boolean(r));
}
