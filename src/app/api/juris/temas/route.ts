import { leerTemas } from '@/lib/juris/catalogo';
import { ruta } from '@/lib/juris/http';

/**
 * GET /api/juris/temas
 *
 * El árbol de temas, plano: cada tema trae su `parent_id` y la app arma
 * los niveles. Vienen ordenados por `orden`.
 */
export const GET = ruta(async (ctx) => ({
  temas: await leerTemas(ctx.supabase),
}));
