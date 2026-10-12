// ============================================================
// De dónde llegan las resoluciones.
//
// Hoy hay una sola fuente: el admin sube los PDFs a mano desde el
// panel. `FuenteIngesta` es el enchufe para las que vengan después (un
// portal oficial, una carpeta compartida): cada una deja sus PDFs en el
// bucket y devuelve qué encolar; de ahí en adelante todas siguen el
// mismo camino — la cola, la ficha, la revisión de una persona.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { JurisError } from './tipos';

export interface DocumentoFuente {
  /** Ruta del PDF dentro del bucket `juris-pdfs`. */
  pdfPath: string;
  /** El nombre con el que se reconoce el archivo en el panel. */
  nombre: string;
  /** Enlace a la publicación oficial, si la fuente lo conoce. */
  urlFuente?: string | null;
}

export interface FuenteIngesta {
  readonly id: string;
  /** Los documentos nuevos de esta fuente, ya guardados en el bucket. */
  documentos(): Promise<DocumentoFuente[]>;
}

const RUTA_SUBIDA = /^subidas\/[0-9a-f-]{36}\.pdf$/;
export const MAX_ARCHIVOS_POR_CARGA = 20;

/** Lo que el panel subió directo a Storage. */
export function cargaManual(archivos: unknown): FuenteIngesta {
  return {
    id: 'carga_manual',
    async documentos() {
      if (!Array.isArray(archivos) || archivos.length === 0) {
        throw new JurisError('carga_vacia', 'No llegó ningún archivo.');
      }
      if (archivos.length > MAX_ARCHIVOS_POR_CARGA) {
        throw new JurisError(
          'carga_grande',
          `Sube como máximo ${MAX_ARCHIVOS_POR_CARGA} PDFs por vez.`
        );
      }
      return archivos.map((a) => {
        const { path, nombre } = (a ?? {}) as {
          path?: unknown;
          nombre?: unknown;
        };
        if (typeof path !== 'string' || !RUTA_SUBIDA.test(path)) {
          throw new JurisError(
            'carga_ruta',
            'La ruta de un archivo no es válida.'
          );
        }
        return {
          pdfPath: path,
          nombre:
            typeof nombre === 'string' && nombre.trim()
              ? nombre.trim().slice(0, 200)
              : path,
        };
      });
    },
  };
}

/**
 * Crea una resolución en borrador por documento y la pone en la cola.
 * Devuelve los ids de las resoluciones creadas.
 */
export async function encolar(
  db: SupabaseClient,
  fuente: FuenteIngesta,
  creadoPor: string | null
): Promise<string[]> {
  const documentos = await fuente.documentos();

  const { data, error } = await db
    .from('juris_resoluciones')
    .insert(
      documentos.map((d) => ({
        pdf_path: d.pdfPath,
        archivo_nombre: d.nombre,
        url_fuente: d.urlFuente ?? null,
        creado_por: creadoPor,
        estado: 'borrador',
      }))
    )
    .select('id');
  if (error) throw error;

  const ids = (data ?? []).map((r) => r.id as string);
  const { error: errJobs } = await db
    .from('juris_jobs')
    .insert(ids.map((id) => ({ resolucion_id: id })));
  if (errJobs) throw errJobs;

  return ids;
}
