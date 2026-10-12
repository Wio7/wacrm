import { describe, expect, it } from 'vitest';

import { cargaManual, MAX_ARCHIVOS_POR_CARGA } from './fuentes';

const ruta = (n: number) =>
  `subidas/00000000-0000-4000-8000-${String(n).padStart(12, '0')}.pdf`;

describe('cargaManual', () => {
  it('acepta lo que el panel sube al bucket', async () => {
    const docs = await cargaManual([
      { path: ruta(1), nombre: '  Cas 1234-2019.pdf ' },
    ]).documentos();
    expect(docs).toEqual([{ pdfPath: ruta(1), nombre: 'Cas 1234-2019.pdf' }]);
  });

  it('usa la ruta como nombre si no llega uno', async () => {
    const [doc] = await cargaManual([{ path: ruta(2) }]).documentos();
    expect(doc.nombre).toBe(ruta(2));
  });

  it.each([
    ['nada', undefined],
    ['una lista vacía', []],
    ['algo que no es una lista', { path: ruta(1) }],
  ])('rechaza %s', async (_, archivos) => {
    await expect(cargaManual(archivos).documentos()).rejects.toThrow(
      /ningún archivo/
    );
  });

  it.each([
    '../otra-carpeta/x.pdf',
    'subidas/../../etc/passwd',
    'subidas/no-es-un-uuid.pdf',
    `${ruta(1)}.exe`,
    'https://example.test/x.pdf',
  ])('rechaza la ruta %s', async (path) => {
    await expect(cargaManual([{ path }]).documentos()).rejects.toThrow(/ruta/);
  });

  it('pone un tope de archivos por carga', async () => {
    const muchos = Array.from(
      { length: MAX_ARCHIVOS_POR_CARGA + 1 },
      (_, i) => ({ path: ruta(i) })
    );
    await expect(cargaManual(muchos).documentos()).rejects.toThrow(
      /como máximo/
    );
  });
});
