import { cuentaDe } from '@/lib/juris/acceso';
import { ruta } from '@/lib/juris/http';

const RECIENTES = 10;

/**
 * GET /api/juris/consultas
 *
 * Las últimas búsquedas del usuario, sin repetir, para la pantalla de
 * inicio de la app.
 */
export const GET = ruta(async (ctx) => {
  cuentaDe(ctx);
  const { data, error } = await ctx.supabase
    .from('juris_consultas')
    .select('pregunta, created_at')
    .eq('user_id', ctx.userId)
    .eq('tipo', 'busqueda')
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw error;

  const vistas = new Set<string>();
  const recientes: { q: string; buscada_at: string }[] = [];
  for (const fila of data ?? []) {
    const clave = (fila.pregunta as string).toLowerCase();
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    recientes.push({
      q: fila.pregunta as string,
      buscada_at: fila.created_at as string,
    });
    if (recientes.length === RECIENTES) break;
  }
  return { recientes };
});
