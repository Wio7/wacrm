import { describe, expect, it } from 'vitest';

import { fragmentar } from './fragmentos';

const palabras = (n: number, prefijo = 'p') =>
  Array.from({ length: n }, (_, i) => `${prefijo}${i}`).join(' ');
const cuenta = (s: string) => (s.match(/\S+/g) ?? []).length;

describe('fragmentar', () => {
  it('no devuelve nada para un texto vacío', () => {
    expect(fragmentar('')).toEqual([]);
    expect(fragmentar('  \n\n  ')).toEqual([]);
  });

  it('deja entero un texto que cabe en un fragmento', () => {
    const texto = `${palabras(50, 'a')}\n\n${palabras(50, 'b')}`;
    expect(fragmentar(texto)).toEqual([texto]);
  });

  it('ningún fragmento pasa del máximo de palabras', () => {
    const texto = Array.from({ length: 40 }, (_, i) =>
      palabras(120, `q${i}_`)
    ).join('\n\n');
    const fragmentos = fragmentar(texto);
    expect(fragmentos.length).toBeGreaterThan(1);
    for (const f of fragmentos) expect(cuenta(f)).toBeLessThanOrEqual(1000);
  });

  it('cada fragmento empieza repitiendo el final del anterior', () => {
    const texto = Array.from({ length: 30 }, (_, i) =>
      palabras(100, `q${i}_`)
    ).join('\n\n');
    const fragmentos = fragmentar(texto, { palabras: 300, solape: 50 });
    for (let i = 1; i < fragmentos.length; i++) {
      const cola = fragmentos[i - 1].match(/\S+/g)!.slice(-50).join(' ');
      expect(fragmentos[i].startsWith(cola)).toBe(true);
    }
  });

  it('no corta un párrafo que cabe', () => {
    const parrafos = Array.from({ length: 10 }, (_, i) =>
      palabras(90, `q${i}_`)
    );
    const fragmentos = fragmentar(parrafos.join('\n\n'), {
      palabras: 300,
      solape: 30,
    });
    for (const p of parrafos) {
      expect(fragmentos.some((f) => f.includes(p))).toBe(true);
    }
  });

  it('parte en ventanas un párrafo que solo no cabe, sin perder palabras', () => {
    const fragmentos = fragmentar(palabras(2500), {
      palabras: 500,
      solape: 50,
    });
    for (const f of fragmentos) expect(cuenta(f)).toBeLessThanOrEqual(500);
    const vistas = new Set(fragmentos.flatMap((f) => f.match(/\S+/g)!));
    expect(vistas.size).toBe(2500);
  });

  it('es determinista', () => {
    const texto = Array.from({ length: 20 }, (_, i) =>
      palabras(130, `q${i}_`)
    ).join('\n\n');
    expect(fragmentar(texto)).toEqual(fragmentar(texto));
  });
});
