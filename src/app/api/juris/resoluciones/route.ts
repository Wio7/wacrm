import { listarResoluciones, POR_PAGINA } from '@/lib/juris/catalogo';
import { ruta } from '@/lib/juris/http';

/**
 * GET /api/juris/resoluciones
 *
 * Resoluciones publicadas, de la más reciente a la más antigua.
 *
 *   ?tema=      id o slug; incluye todo lo que cuelga de ese tema
 *   ?tipo=      casacion | pleno_casatorio | precedente_vinculante | acuerdo_plenario
 *   ?anio=      2019
 *   ?sala=      texto que contenga el nombre de la sala
 *   ?fallo=     fundada | fundada_en_parte | infundada | improcedente | otro
 *   ?articulo=  texto que contenga el artículo ("219", "CC art. 219")
 *   ?pagina=    1, 2, … (20 por página)
 */
export const GET = ruta(async (ctx, request) => {
  const q = new URL(request.url).searchParams;
  const lista = await listarResoluciones(ctx.supabase, {
    tema: q.get('tema'),
    tipo: q.get('tipo'),
    anio: q.get('anio'),
    sala: q.get('sala'),
    fallo: q.get('fallo'),
    articulo: q.get('articulo'),
    pagina: q.get('pagina'),
  });
  return { ...lista, porPagina: POR_PAGINA };
});
