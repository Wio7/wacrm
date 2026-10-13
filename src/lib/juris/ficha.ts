// ============================================================
// La ficha de una resolución, armada por el modelo y comprobada aquí.
//
// Una casación inventada es un error grave, y pedirle al modelo que no
// invente no alcanza: `verificarFicha` coteja contra el texto lo que se
// puede cotejar (el número, el año, la fecha, cada artículo) y descarta
// lo que no aparece. Lo descartado queda anotado en `avisos` para quien
// revisa. Aun así nada se publica sin que una persona lo lea.
// ============================================================

import * as z from 'zod/v4';

import { enteroALetras } from '@/lib/legal/numero-a-letras';

import { pedirJson } from './modelo';
import { FALLOS, TIPOS_RESOLUCION, type Tema } from './tipos';

export const FichaIa = z.object({
  tipo: z.enum(TIPOS_RESOLUCION).nullable(),
  numero: z.string().nullable(),
  anio: z.number().int().nullable(),
  procedencia: z.string().nullable(),
  sala: z.string().nullable(),
  fecha: z.string().nullable(),
  sumilla: z.string().nullable(),
  criterio: z.string().nullable(),
  hechos: z.string().nullable(),
  articulos: z.array(z.string()),
  fallo: z.enum(FALLOS).nullable(),
  temas_sugeridos: z.array(z.string()),
});
export type FichaIa = z.infer<typeof FichaIa>;

const SISTEMA = `Eres un asistente que ficha resoluciones de la Corte Suprema del Perú para un catálogo de jurisprudencia que usan abogados. Una persona revisará tu ficha contra el PDF antes de publicarla.

Trabaja únicamente con el texto de la resolución que recibes. No uses lo que sepas de otras resoluciones, de doctrina o de la ley: si un dato no está escrito en el texto, su campo va en null (o la lista, vacía). Un campo vacío le cuesta un minuto a quien revisa; un dato inventado puede terminar citado en un escrito judicial. Nunca completes ni corrijas un número de casación, una fecha o un artículo.

Campos:
- tipo: casacion, pleno_casatorio, precedente_vinculante o acuerdo_plenario, según cómo se identifica la propia resolución.
- numero: el número tal como aparece, sin la palabra "Casación" ni el lugar. Ejemplo: "1234-2019".
- anio: el año que forma parte del número de la resolución.
- procedencia: el distrito judicial o lugar que acompaña al número. Ejemplo: "Lima".
- sala: la sala que resuelve, con su nombre completo.
- fecha: la fecha en que se emite la resolución, en formato AAAA-MM-DD.
- sumilla: la sumilla de la resolución, copiada. Si la resolución no trae sumilla, null.
- criterio: el criterio jurisprudencial que fija o aplica la Sala, en dos a cuatro oraciones, fiel a sus considerandos y sin añadir valoraciones.
- hechos: los hechos relevantes del caso y lo que se pidió, en un párrafo breve. No incluyas nombres de personas naturales: di "el demandante", "la demandada", "el comprador".
- articulos: las normas que la Sala cita como fundamento de su decisión, una por elemento, con la forma "CC art. 219 inc. 5", "CPC art. 386", "Const. art. 139 inc. 3". Solo las que aparecen en el texto.
- fallo: fundada, fundada_en_parte, infundada, improcedente u otro, según lo que la Sala declara sobre el recurso. Si no queda claro, null.
- temas_sugeridos: de la lista de temas que recibes, los slugs que mejor describen de qué trata la resolución, el más específico primero. Entre uno y tres. Si ninguno corresponde, lista vacía.`;

function listaDeTemas(temas: Tema[]): string {
  const hijos = new Map<string | null, Tema[]>();
  for (const t of temas) {
    const grupo = hijos.get(t.parent_id) ?? [];
    grupo.push(t);
    hijos.set(t.parent_id, grupo);
  }
  const lineas: string[] = [];
  const bajar = (padre: string | null, nivel: number) => {
    const grupo = (hijos.get(padre) ?? []).sort((a, b) => a.orden - b.orden);
    for (const t of grupo) {
      lineas.push(`${'  '.repeat(nivel)}- ${t.slug}: ${t.nombre}`);
      bajar(t.id, nivel + 1);
    }
  };
  bajar(null, 0);
  return lineas.join('\n');
}

export interface FichaVerificada {
  ficha: FichaIa;
  avisos: string[];
}

/** El número, como aparece suelto en un texto: sin dígitos pegados. */
const aparece = (texto: string, numero: string) =>
  new RegExp(`(?<!\\d)0*${numero}(?!\\d)`).test(texto);

const sinTildes = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Con qué empieza una palabra que sigue contando: si viene detrás, el
// número del texto es otro más largo ("dos mil" dentro de "dos mil veinte").
const SIGUE_EL_NUMERO =
  '(?:y\\s+)?(?:un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieci|veint|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|doscient|trescient|cuatrocient|quinient|seiscient|setecient|ochocient|novecient|mil)';

/**
 * El año aparece en el texto, en cifras o en letras. Las resoluciones
 * peruanas fechan en letras ("catorce de marzo de dos mil veintitrés"):
 * exigir las cifras vaciaría la fecha de casi todas.
 */
function apareceElAnio(texto: string, anio: number): boolean {
  if (aparece(texto, String(anio))) return true;
  const letras = sinTildes(enteroALetras(anio)).replace(/\s+/g, '\\s+');
  return new RegExp(
    `(?<![a-z])${letras}(?![a-z])(?!\\s+${SIGUE_EL_NUMERO})`
  ).test(sinTildes(texto));
}

const gruposDeDigitos = (s: string) => s.match(/\d+/g) ?? [];

const limpio = (s: string | null) => {
  const t = s?.trim();
  return t ? t : null;
};

function fechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const d = new Date(`${fecha}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha;
}

/**
 * Coteja la ficha contra el texto y descarta lo que no se sostiene.
 * No decide si la ficha es buena — eso es de quien revisa —; sólo quita
 * lo que el texto no respalda.
 */
export function verificarFicha(
  cruda: FichaIa,
  texto: string,
  slugsValidos: ReadonlySet<string>
): FichaVerificada {
  const avisos: string[] = [];
  const ficha: FichaIa = {
    ...cruda,
    numero: limpio(cruda.numero),
    procedencia: limpio(cruda.procedencia),
    sala: limpio(cruda.sala),
    fecha: limpio(cruda.fecha),
    sumilla: limpio(cruda.sumilla),
    criterio: limpio(cruda.criterio),
    hechos: limpio(cruda.hechos),
  };

  if (ficha.numero) {
    const grupos = gruposDeDigitos(ficha.numero);
    if (grupos.length === 0 || !grupos.every((g) => aparece(texto, g))) {
      avisos.push(
        `El número «${ficha.numero}» no aparece en el texto; se dejó vacío.`
      );
      ficha.numero = null;
    }
  }

  if (ficha.anio !== null && !apareceElAnio(texto, ficha.anio)) {
    avisos.push(`El año ${ficha.anio} no aparece en el texto; se dejó vacío.`);
    ficha.anio = null;
  }

  if (ficha.fecha) {
    if (!fechaValida(ficha.fecha)) {
      avisos.push(
        `La fecha «${ficha.fecha}» no es una fecha válida; se dejó vacía.`
      );
      ficha.fecha = null;
    } else if (!apareceElAnio(texto, Number(ficha.fecha.slice(0, 4)))) {
      avisos.push(
        `El año de la fecha ${ficha.fecha} no aparece en el texto; se dejó vacía.`
      );
      ficha.fecha = null;
    }
  }

  const articulos: string[] = [];
  for (const articulo of cruda.articulos.map((a) => a.trim()).filter(Boolean)) {
    // El primer número es el del artículo; los demás (inciso, numeral)
    // suelen venir escritos en letras o pegados, y no se exigen.
    const [numero] = gruposDeDigitos(articulo);
    if (!numero || !aparece(texto, numero)) {
      avisos.push(
        `«${articulo}» no aparece en el texto; se quitó de los artículos.`
      );
      continue;
    }
    if (!articulos.includes(articulo)) articulos.push(articulo);
  }
  ficha.articulos = articulos;

  ficha.temas_sugeridos = [...new Set(cruda.temas_sugeridos)].filter((slug) =>
    slugsValidos.has(slug)
  );

  if (!ficha.numero || !ficha.sala || !ficha.fecha || !ficha.tipo) {
    avisos.push(
      'Faltan datos para citarla (tipo, número, sala o fecha): complétalos desde el PDF.'
    );
  }

  return { ficha, avisos };
}

/** Arma la ficha de una resolución a partir de su texto. */
export async function armarFicha(
  texto: string,
  temas: Tema[]
): Promise<FichaVerificada & { cruda: FichaIa; modelo: string }> {
  const { datos, modelo } = await pedirJson(FichaIa, {
    sistema: SISTEMA,
    texto: `<temas>\n${listaDeTemas(temas)}\n</temas>\n\n<resolucion>\n${texto}\n</resolucion>\n\nArma la ficha de esta resolución.`,
    maxTokens: 16_000,
    esfuerzo: 'medium',
  });
  const verificada = verificarFicha(
    datos,
    texto,
    new Set(temas.map((t) => t.slug))
  );
  return { ...verificada, cruda: datos, modelo };
}
