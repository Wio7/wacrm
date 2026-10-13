import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/flows/admin-client';
import { citaDe, COLUMNAS_FICHA, type Resumen } from '@/lib/juris/catalogo';
import { ruta } from '@/lib/juris/http';
import { BUCKET_PDFS } from '@/lib/juris/tipos';

/** Cuánto vive el enlace al PDF. Lo justo para abrirlo. */
const PDF_SEGUNDOS = 10 * 60;

/**
 * GET /api/juris/resoluciones/[id]
 *
 * La ficha completa de una resolución publicada: sus datos, sus temas,
 * la cita lista para pegar, si el usuario la tiene en favoritos y un
 * enlace temporal al PDF.
 *
 * El bucket es privado y la app no tiene permiso sobre él: el enlace lo
 * firma el servidor, y sólo después de que la lectura de arriba — con
 * la sesión del usuario — confirmó que puede ver la resolución.
 */
export const GET = ruta<{ id: string }>(async (ctx, _request, { id }) => {
  const { data, error } = await ctx.supabase
    .from('juris_resoluciones')
    .select(COLUMNAS_FICHA)
    .eq('id', id)
    .eq('estado', 'publicada')
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return NextResponse.json(
      { error: 'No se encontró la resolución.' },
      { status: 404 }
    );
  }
  const { pdf_path: pdfPath, ...ficha } = data as unknown as Resumen & {
    pdf_path: string | null;
  };

  const [temas, favorito, pdf] = await Promise.all([
    ctx.supabase
      .from('juris_resolucion_temas')
      .select('principal, juris_temas(id, slug, nombre)')
      .eq('resolucion_id', id),
    ctx.supabase
      .from('juris_favoritos')
      .select('id', { count: 'exact', head: true })
      .eq('resolucion_id', id)
      .eq('user_id', ctx.userId),
    pdfPath
      ? supabaseAdmin()
          .storage.from(BUCKET_PDFS)
          .createSignedUrl(pdfPath, PDF_SEGUNDOS)
      : null,
  ]);
  if (temas.error) throw temas.error;
  if (pdf?.error)
    console.error('[juris ficha] could not sign the PDF url:', pdf.error);

  return {
    resolucion: {
      ...ficha,
      cita: citaDe(ficha),
      temas: (temas.data ?? []).map((t) => ({
        ...(t.juris_temas as unknown as {
          id: string;
          slug: string;
          nombre: string;
        }),
        principal: t.principal,
      })),
      favorito: (favorito.count ?? 0) > 0,
      pdf_url: pdf?.data?.signedUrl ?? null,
      pdf_expira_en: pdf?.data?.signedUrl ? PDF_SEGUNDOS : null,
    },
  };
});
