import { cuentaDe } from '@/lib/juris/acceso';
import { ruta } from '@/lib/juris/http';

/** DELETE /api/juris/alertas/[temaId] — dejar de seguir un tema. */
export const DELETE = ruta<{ temaId: string }>(
  async (ctx, _request, { temaId }) => {
    cuentaDe(ctx);
    const { error } = await ctx.supabase
      .from('juris_alertas')
      .delete()
      .eq('user_id', ctx.userId)
      .eq('tema_id', temaId);
    if (error) throw error;
    return { ok: true };
  }
);
