import { describe, expect, it } from 'vitest';

import { extracto } from './busqueda';
import { citaDe, subarbol } from './catalogo';
import type { Tema } from './tipos';
import { inicioDelDiaEnLima, limitesDelAsistente } from './uso';

const tema = (id: string, parent_id: string | null): Tema => ({
  id,
  parent_id,
  slug: `slug-${id}`,
  nombre: id,
  descripcion: null,
  orden: 0,
});

describe('citaDe', () => {
  it('arma la cita como se escribe en un escrito', () => {
    expect(
      citaDe({
        tipo: 'casacion',
        numero: '1234-2019',
        procedencia: 'Lima',
        sala: 'Sala Civil Permanente',
        fecha: '2020-03-10',
      })
    ).toBe('Casación N.° 1234-2019 Lima, Sala Civil Permanente, 10/03/2020');
  });

  it('omite lo que falta sin dejar comas sueltas', () => {
    expect(
      citaDe({
        tipo: 'pleno_casatorio',
        numero: null,
        procedencia: null,
        sala: null,
        fecha: null,
      })
    ).toBe('Pleno casatorio');
  });
});

describe('subarbol', () => {
  const temas = [
    tema('civil', null),
    tema('contratos', 'civil'),
    tema('compraventa', 'contratos'),
    tema('acto', 'civil'),
    tema('penal', null),
  ];

  it('incluye el tema y todo lo que cuelga de él, por id o por slug', () => {
    expect(subarbol(temas, 'contratos')).toEqual(['contratos', 'compraventa']);
    expect(subarbol(temas, 'slug-civil').sort()).toEqual(
      ['acto', 'civil', 'compraventa', 'contratos'].sort()
    );
  });

  it('un tema que no existe no trae nada', () => {
    expect(subarbol(temas, 'laboral')).toEqual([]);
  });
});

describe('extracto', () => {
  it('aplana los saltos y corta lo largo', () => {
    expect(extracto('uno\n\n  dos')).toBe('uno dos');
    expect(extracto('a'.repeat(400))).toHaveLength(281);
    expect(extracto(null)).toBeNull();
  });
});

describe('límite de uso del asistente', () => {
  it('el día empieza a la medianoche de Lima, no a la de UTC', () => {
    // 03:00 UTC es todavía las 22:00 del día anterior en Lima.
    expect(
      inicioDelDiaEnLima(new Date('2026-10-13T03:00:00Z')).toISOString()
    ).toBe('2026-10-12T05:00:00.000Z');
    expect(
      inicioDelDiaEnLima(new Date('2026-10-13T05:00:00Z')).toISOString()
    ).toBe('2026-10-13T05:00:00.000Z');
  });

  it('usa los valores por defecto si la variable falta o no sirve', () => {
    expect(limitesDelAsistente({})).toEqual({ porMinuto: 5, porDia: 60 });
    expect(
      limitesDelAsistente({
        JURIS_ASISTENTE_POR_MINUTO: '0',
        JURIS_ASISTENTE_POR_DIA: '200',
      })
    ).toEqual({ porMinuto: 5, porDia: 200 });
  });
});
