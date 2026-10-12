import { describe, expect, it } from 'vitest';

import { verificarFicha, type FichaIa } from './ficha';

const TEXTO = `CASACIÓN N.° 1234-2019 LIMA
Sala Civil Permanente de la Corte Suprema de Justicia de la República.
Lima, diez de marzo de dos mil veinte. 10/03/2020.
Sumilla: Hay simulación absoluta cuando las partes no quieren acto alguno.
La Sala aplica el artículo 219 inciso 5 y el artículo 190 del Código Civil,
así como el artículo 386 del Código Procesal Civil.
Declararon FUNDADO el recurso.`;

const SLUGS = new Set(['nulidad-simulacion-absoluta', 'nulidad-fin-ilicito']);

const ficha = (cambios: Partial<FichaIa> = {}): FichaIa => ({
  tipo: 'casacion',
  numero: '1234-2019',
  anio: 2019,
  procedencia: 'Lima',
  sala: 'Sala Civil Permanente',
  fecha: '2020-03-10',
  sumilla: 'Hay simulación absoluta cuando las partes no quieren acto alguno.',
  criterio: 'La simulación absoluta acarrea la nulidad del acto.',
  hechos: 'El demandante pidió la nulidad de una compraventa.',
  articulos: ['CC art. 219 inc. 5', 'CC art. 190', 'CPC art. 386'],
  fallo: 'fundada',
  temas_sugeridos: ['nulidad-simulacion-absoluta'],
  ...cambios,
});

describe('verificarFicha', () => {
  it('deja intacta una ficha que el texto respalda', () => {
    const { ficha: f, avisos } = verificarFicha(ficha(), TEXTO, SLUGS);
    expect(f).toEqual(ficha());
    expect(avisos).toEqual([]);
  });

  it('vacía un número de casación que no está en el texto', () => {
    const { ficha: f, avisos } = verificarFicha(
      ficha({ numero: '4321-2019' }),
      TEXTO,
      SLUGS
    );
    expect(f.numero).toBeNull();
    expect(avisos.some((a) => a.includes('4321-2019'))).toBe(true);
  });

  it('no da por bueno un número que sólo aparece pegado a otros dígitos', () => {
    // "234" está dentro de "1234", pero no es el número de la casación.
    const { ficha: f } = verificarFicha(
      ficha({ numero: '234-2019' }),
      TEXTO,
      SLUGS
    );
    expect(f.numero).toBeNull();
  });

  it('quita los artículos que el texto no menciona y conserva los demás', () => {
    const { ficha: f, avisos } = verificarFicha(
      ficha({
        articulos: [
          'CC art. 219 inc. 5',
          'CC art. 1969',
          'principio de buena fe',
        ],
      }),
      TEXTO,
      SLUGS
    );
    expect(f.articulos).toEqual(['CC art. 219 inc. 5']);
    expect(avisos.filter((a) => a.includes('se quitó'))).toHaveLength(2);
  });

  it('vacía el año y la fecha que no se sostienen', () => {
    const { ficha: f } = verificarFicha(
      ficha({ anio: 2015, fecha: '2021-13-45' }),
      TEXTO,
      SLUGS
    );
    expect(f.anio).toBeNull();
    expect(f.fecha).toBeNull();

    const otra = verificarFicha(ficha({ fecha: '1998-03-10' }), TEXTO, SLUGS);
    expect(otra.ficha.fecha).toBeNull();
  });

  it('descarta los temas que no existen en el árbol y los repetidos', () => {
    const { ficha: f } = verificarFicha(
      ficha({
        temas_sugeridos: [
          'nulidad-simulacion-absoluta',
          'tema-inventado',
          'nulidad-simulacion-absoluta',
        ],
      }),
      TEXTO,
      SLUGS
    );
    expect(f.temas_sugeridos).toEqual(['nulidad-simulacion-absoluta']);
  });

  it('trata los textos en blanco como vacíos y avisa si falta algo para citar', () => {
    const { ficha: f, avisos } = verificarFicha(
      ficha({ sala: '   ', sumilla: '' }),
      TEXTO,
      SLUGS
    );
    expect(f.sala).toBeNull();
    expect(f.sumilla).toBeNull();
    expect(avisos.some((a) => a.includes('Faltan datos para citarla'))).toBe(
      true
    );
  });
});
