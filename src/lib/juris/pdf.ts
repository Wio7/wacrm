// ============================================================
// Leer un PDF de resolución.
//
// Dos clases de PDF llegan aquí: los que traen el texto dentro (se saca
// tal cual) y los escaneados, que son fotos de papel y casi no traen
// texto. Los segundos los transcribe el modelo de IA por tandas de
// páginas; `recortarPdf` arma cada tanda.
// ============================================================

import { PDFDocument } from 'pdf-lib';
import { extractText, getDocumentProxy } from 'unpdf';

import { JurisError } from './tipos';

/** Menos de esto por página, en promedio, y lo tratamos como escaneo:
 *  un sello o una numeración suelta no son el texto de la resolución. */
const MIN_CARACTERES_POR_PAGINA = 200;

export interface PdfLeido {
  paginas: number;
  /** El texto de cada página, en orden. */
  textos: string[];
}

export async function leerPdf(bytes: Uint8Array): Promise<PdfLeido> {
  try {
    // pdf.js se queda con el buffer que recibe; se le pasa una copia para
    // que el original siga sirviendo (hay que recortarlo si es escaneo).
    const pdf = await getDocumentProxy(bytes.slice());
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    return { paginas: totalPages, textos: text.map((t) => t.trim()) };
  } catch (err) {
    throw new JurisError(
      'pdf_ilegible',
      `No se pudo abrir el PDF: ${err instanceof Error ? err.message : err}`
    );
  }
}

export function esEscaneo({ paginas, textos }: PdfLeido): boolean {
  if (paginas === 0) return true;
  const caracteres = textos.reduce((n, t) => n + t.length, 0);
  return caracteres / paginas < MIN_CARACTERES_POR_PAGINA;
}

export function unirPaginas(textos: string[]): string {
  return textos.filter(Boolean).join('\n\n').trim();
}

/** Un PDF nuevo con `cuantas` páginas a partir de `desde` (base 0). */
export async function recortarPdf(
  bytes: Uint8Array,
  desde: number,
  cuantas: number
): Promise<Uint8Array> {
  const origen = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = origen.getPageCount();
  const indices: number[] = [];
  for (let i = desde; i < Math.min(desde + cuantas, total); i++)
    indices.push(i);

  const recorte = await PDFDocument.create();
  for (const pagina of await recorte.copyPages(origen, indices)) {
    recorte.addPage(pagina);
  }
  return recorte.save();
}
