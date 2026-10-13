import { NextResponse } from 'next/server';

import { cuentaDe } from '@/lib/juris/acceso';
import { cuerpo, ruta, texto } from '@/lib/juris/http';

const MAX_NOTA = 4000;

type Params = { id: string; resolucionId: string };

/** PATCH …/carpetas/[id]/resoluciones/[resolucionId]   { "nota": "…" | null } */
export const PATCH = ruta<Params>(
  async (ctx, request, { id, resolucionId }) => {
    cuentaDe(ctx);
    const { data, error } = await ctx.supabase
      .from('juris_carpeta_resoluciones')
      .update({ nota: texto((await cuerpo(request)).nota, MAX_NOTA) })
      .eq('carpeta_id', id)
      .eq('resolucion_id', resolucionId)
      .select('resolucion_id')
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: 'Esa resolución no está en la carpeta.' },
        { status: 404 }
      );
    }
    return { ok: true };
  }
);

/** DELETE …/carpetas/[id]/resoluciones/[resolucionId] — sacarla de la carpeta. */
export const DELETE = ruta<Params>(
  async (ctx, _request, { id, resolucionId }) => {
    cuentaDe(ctx);
    const { error } = await ctx.supabase
      .from('juris_carpeta_resoluciones')
      .delete()
      .eq('carpeta_id', id)
      .eq('resolucion_id', resolucionId);
    if (error) throw error;
    return { ok: true };
  }
);
