import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { esEscaneo, leerPdf, recortarPdf, unirPaginas } from './pdf';

/** Un PDF de `paginas` páginas; con texto, o en blanco como un escaneo. */
async function pdf(paginas: number, conTexto: boolean): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fuente = await doc.embedFont(StandardFonts.Helvetica);
  for (let p = 1; p <= paginas; p++) {
    const pagina = doc.addPage([595, 842]);
    if (!conTexto) continue;
    for (let linea = 0; linea < 12; linea++) {
      pagina.drawText(
        `Pagina ${p}: considerando ${linea} sobre la nulidad del acto juridico.`,
        { x: 40, y: 780 - linea * 20, size: 11, font: fuente }
      );
    }
  }
  return doc.save();
}

describe('leerPdf', () => {
  it('saca el texto de cada página de un PDF que lo trae', async () => {
    const leido = await leerPdf(await pdf(3, true));
    expect(leido.paginas).toBe(3);
    expect(leido.textos).toHaveLength(3);
    expect(leido.textos[1]).toContain('Pagina 2: considerando 0');
    expect(esEscaneo(leido)).toBe(false);
    expect(unirPaginas(leido.textos)).toContain('Pagina 3');
  });

  it('reconoce un escaneo por lo poco que trae de texto', async () => {
    const leido = await leerPdf(await pdf(4, false));
    expect(leido.paginas).toBe(4);
    expect(esEscaneo(leido)).toBe(true);
  });

  it('no estropea los bytes que recibe', async () => {
    const bytes = await pdf(2, true);
    const copia = bytes.slice();
    await leerPdf(bytes);
    expect(bytes).toEqual(copia);
  });

  it('falla con un mensaje claro si no es un PDF', async () => {
    await expect(
      leerPdf(new TextEncoder().encode('esto no es un pdf'))
    ).rejects.toThrow(/No se pudo abrir el PDF/);
  });
});

describe('recortarPdf', () => {
  it('arma una tanda con las páginas pedidas', async () => {
    const bytes = await pdf(7, true);
    const tanda = await leerPdf(await recortarPdf(bytes, 3, 2));
    expect(tanda.paginas).toBe(2);
    expect(tanda.textos[0]).toContain('Pagina 4:');
    expect(tanda.textos[1]).toContain('Pagina 5:');
  });

  it('la última tanda trae las páginas que queden', async () => {
    const tanda = await leerPdf(await recortarPdf(await pdf(7, true), 6, 6));
    expect(tanda.paginas).toBe(1);
    expect(tanda.textos[0]).toContain('Pagina 7:');
  });
});
