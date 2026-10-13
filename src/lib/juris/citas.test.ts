import { describe, expect, it } from 'vitest';

import { SIN_COBERTURA, validarCitas, type Fuente } from './citas';

const A = '00000000-0000-0000-0000-0000000000a1';
const B = '00000000-0000-0000-0000-0000000000b2';

const FUENTES: Fuente[] = [
  {
    alias: 'R1',
    id: A,
    numero: '1234-2019',
    articulos: ['CC art. 219 inc. 5'],
  },
  { alias: 'R2', id: B, numero: '777-2021', articulos: ['CC art. 190'] },
];

const TEXTO_FUENTES = `La simulación absoluta acarrea la nulidad conforme al artículo 219 inciso 5.
Se sigue el criterio de la Casación 4567-2015 sobre la valoración conjunta de los indicios,
y el artículo 197 del Código Procesal Civil.`;

const validar = (respuesta: string) =>
  validarCitas(respuesta, FUENTES, TEXTO_FUENTES);

describe('validarCitas', () => {
  it('deja pasar una respuesta sostenida en las fuentes y pone los ids reales', () => {
    const r = validar(
      'Hay simulación absoluta cuando no existe voluntad real [RES:R1].\n\nEl precio irrisorio es un indicio [RES:R2].'
    );
    expect(r.texto).toBe(
      `Hay simulación absoluta cuando no existe voluntad real [RES:${A}].\n\nEl precio irrisorio es un indicio [RES:${B}].`
    );
    expect(r.citadas).toEqual([A, B]);
    expect(r.descartes).toEqual([]);
  });

  it('elimina la cita a una resolución que no se le pasó', () => {
    const r = validar(
      'La nulidad procede por simulación absoluta [RES:R1] [RES:R9].'
    );
    expect(r.texto).toBe(
      `La nulidad procede por simulación absoluta [RES:${A}].`
    );
    expect(r.citadas).toEqual([A]);
    expect(r.descartes).toHaveLength(1);
  });

  it('elimina el párrafo que sólo se apoyaba en una fuente inexistente', () => {
    const r = validar(
      'La nulidad procede por simulación absoluta [RES:R1].\n\nAdemás, el plazo es de diez años [RES:R7].'
    );
    expect(r.texto).toBe(
      `La nulidad procede por simulación absoluta [RES:${A}].`
    );
  });

  it('si no queda ninguna cita válida, no hay respuesta', () => {
    expect(validar('El plazo es de diez años [RES:R7].').texto).toBeNull();
    expect(validar('El plazo es de diez años.').texto).toBeNull();
    expect(validar('').texto).toBeNull();
  });

  it('respeta cuando el modelo dice que las fuentes no cubren la pregunta', () => {
    expect(validar(SIN_COBERTURA).texto).toBeNull();
    expect(
      validar(`${SIN_COBERTURA}\n\nPero en general… [RES:R1]`).texto
    ).toBeNull();
  });

  it('elimina el párrafo que nombra en prosa una casación ajena a las fuentes', () => {
    const r = validar(
      'Procede la nulidad [RES:R1].\n\nAsí lo dijo también la Casación N.° 9999-2018, que es vinculante [RES:R1].'
    );
    expect(r.texto).toBe(`Procede la nulidad [RES:${A}].`);
    expect(r.descartes.some((d) => d.includes('9999-2018'))).toBe(true);
  });

  it('acepta nombrar el número de una fuente o uno que su texto menciona', () => {
    const r = validar(
      'La Casación 1234-2019 lo declara así [RES:R1], siguiendo a la Casación 4567 – 2015 [RES:R1].'
    );
    expect(r.texto).not.toBeNull();
  });

  it('elimina el párrafo que cita un artículo que las fuentes no traen', () => {
    const r = validar(
      'Es nulo por el artículo 219 [RES:R1].\n\nPrescribe a los diez años según el art. 2001 [RES:R1].\n\nLos indicios se valoran en conjunto, artículos 197 y siguientes [RES:R2].'
    );
    expect(r.texto).toBe(
      `Es nulo por el artículo 219 [RES:${A}].\n\nLos indicios se valoran en conjunto, artículos 197 y siguientes [RES:${B}].`
    );
    expect(r.descartes.some((d) => d.includes('2001'))).toBe(true);
  });

  it('acepta un artículo que está en la ficha aunque no en los fragmentos', () => {
    expect(validar('Rige el artículo 190 [RES:R2].').texto).not.toBeNull();
  });

  it('entiende varias fuentes en una misma marca y no repite las citadas', () => {
    const r = validar(
      'Así lo sostienen ambas [RES:R1, R2]. Y de nuevo [RES:r1].'
    );
    expect(r.texto).toBe(
      `Así lo sostienen ambas [RES:${A}] [RES:${B}]. Y de nuevo [RES:${A}].`
    );
    expect(r.citadas).toEqual([A, B]);
  });
});
