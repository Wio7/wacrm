// ============================================================
// Partir el texto de una resolución en fragmentos para buscar.
//
// Por palabras, no por caracteres: una resolución se lee por
// considerandos, y un fragmento de 800 a 1000 palabras suele llevar un
// razonamiento entero. Respeta los párrafos (no corta un considerando a
// la mitad si cabe) y cada fragmento arranca repitiendo el final del
// anterior, para que una idea que cae justo en el corte quede completa
// en alguno de los dos.
//
// Puro y determinista: el mismo texto da siempre los mismos fragmentos.
// ============================================================

const PALABRAS = 1000;
const SOLAPE = 150;

const palabrasDe = (texto: string) => texto.match(/\S+/g) ?? [];

export function fragmentar(
  texto: string,
  opts: { palabras?: number; solape?: number } = {}
): string[] {
  const max = Math.max(2, opts.palabras ?? PALABRAS);
  const solape = Math.max(
    0,
    Math.min(opts.solape ?? SOLAPE, Math.floor(max / 2))
  );
  // Lo que cabe de texto nuevo en cada fragmento, dejando sitio al solape.
  const cuerpoMax = max - solape;

  const limpio = texto.replace(/\r\n/g, '\n').trim();
  if (!limpio) return [];

  // Párrafos; el que solo no cabe se corta en ventanas de palabras.
  const piezas: string[] = [];
  for (const parrafo of limpio.split(/\n\s*\n/)) {
    const palabras = palabrasDe(parrafo);
    if (palabras.length === 0) continue;
    if (palabras.length <= cuerpoMax) {
      piezas.push(parrafo.trim());
      continue;
    }
    for (let i = 0; i < palabras.length; i += cuerpoMax) {
      piezas.push(palabras.slice(i, i + cuerpoMax).join(' '));
    }
  }

  const fragmentos: string[] = [];
  let actual: string[] = [];
  let cuenta = 0;
  let cola = '';

  const cerrar = () => {
    if (actual.length === 0) return;
    const cuerpo = actual.join('\n\n');
    fragmentos.push(cola ? `${cola}\n\n${cuerpo}` : cuerpo);
    cola = solape ? palabrasDe(cuerpo).slice(-solape).join(' ') : '';
    actual = [];
    cuenta = 0;
  };

  for (const pieza of piezas) {
    const n = palabrasDe(pieza).length;
    if (actual.length > 0 && cuenta + n > cuerpoMax) cerrar();
    actual.push(pieza);
    cuenta += n;
  }
  cerrar();

  return fragmentos;
}
