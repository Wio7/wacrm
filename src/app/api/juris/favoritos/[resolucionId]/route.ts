import { cuentaDe } from '@/lib/juris/acceso';
import { ruta } from '@/lib/juris/http';

/** DELETE /api/juris/favoritos/[resolucionId] — quitarla de favoritos. */
export const DELETE = ruta<{ resolucionId: string }>(
  async (ctx, _request, { resolucionId }) => {
    cuentaDe(ctx);
    const { error } = await ctx.supabase
      .from('juris_favoritos')
      .delete()
      .eq('user_id', ctx.userId)
      .eq('resolucion_id', resolucionId);
    if (error) throw error;
    return { ok: true };
  }
);
