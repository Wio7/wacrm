// ============================================================
// La regla de oro, del lado del servidor.
//
// El asistente contesta citando con `[RES:R1]`, donde R1…Rn son las
// resoluciones que se le pasaron. Nada de lo que escribe llega al
// usuario sin pasar por aquí:
//
//   · Una cita a algo que no se le pasó se elimina. Si el párrafo sólo
//     se apoyaba en citas así, se elimina el párrafo: lo que decía
//     descansaba en una fuente que no existe.
//   · Un párrafo que nombra un número de resolución o un artículo que
//     no está en las fuentes se elimina, aunque no lleve marca de cita.
//     Es la forma en que una casación inventada se cuela "en prosa".
//   · Si después de eso no queda ninguna cita válida, no hay respuesta:
//     se contesta NO_ENCONTRE.
//
// Puro: no llama a nadie, se prueba solo.
// ============================================================

export const NO_ENCONTRE =
  'No encontré jurisprudencia en la base para esa consulta.';

export const AVISO =
  'Herramienta de apoyo. Verifique la resolución completa antes de citarla.';

/** Lo que el modelo escribe cuando las fuentes no responden la pregunta. */
export const SIN_COBERTURA = 'SIN_COBERTURA';

export interface Fuente {
  /** Cómo la conoce el modelo: R1, R2… */
  alias: string;
  /** El id real de la resolución. */
  id: string;
  numero: string | null;
  articulos: string[];
}

export interface CitasValidadas {
  /** El texto ya limpio, con `[RES:<id real>]`; null si no se sostiene. */
  texto: string | null;
  /** Ids de las resoluciones citadas, en orden de aparición. */
  citadas: string[];
  /** Qué se quitó y por qué, para el registro del servidor. */
  descartes: string[];
}

const MARCA = /\[RES:\s*([^\]]*)\]/g;
// "1234-2019", "1234 – 2019": un número de resolución con su año.
const NUMERO_RESOLUCION = /(?<!\d)(\d{1,6})\s*[-–]\s*((?:19|20)\d{2})(?!\d)/g;
const ARTICULO = /\bart(?:[íi]culos?|s?\.)\s*(\d{1,4})(?!\d)/gi;

const normalizar = (numero: string, anio: string) =>
  `${Number(numero)}-${anio}`;

function numerosDe(texto: string): Set<string> {
  return new Set(
    [...texto.matchAll(NUMERO_RESOLUCION)].map((m) => normalizar(m[1], m[2]))
  );
}

const aparece = (texto: string, numero: string) =>
  new RegExp(`(?<!\\d)${numero}(?!\\d)`).test(texto);

/**
 * @param respuesta    lo que escribió el modelo
 * @param fuentes      las resoluciones que se le pasaron
 * @param textoFuentes el texto de los fragmentos que se le pasaron
 */
export function validarCitas(
  respuesta: string,
  fuentes: Fuente[],
  textoFuentes: string
): CitasValidadas {
  const descartes: string[] = [];
  if (!respuesta.trim() || respuesta.includes(SIN_COBERTURA)) {
    return { texto: null, citadas: [], descartes };
  }

  const porAlias = new Map(fuentes.map((f) => [f.alias.toUpperCase(), f]));
  const numerosPermitidos = numerosDe(
    `${textoFuentes}\n${fuentes.map((f) => f.numero ?? '').join('\n')}`
  );
  const articulosDeFichas = fuentes.flatMap((f) => f.articulos).join(' | ');
  const citadas: string[] = [];

  const parrafos = respuesta
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((parrafo) => {
      let validas = 0;
      let invalidas = 0;
      const ids: string[] = [];

      // Una marca puede traer varias: [RES:R1, R2].
      const limpio = parrafo.replace(MARCA, (_, dentro: string) => {
        const marcas: string[] = [];
        for (const alias of dentro.split(/[\s,;]+/).filter(Boolean)) {
          const fuente = porAlias.get(alias.toUpperCase());
          if (fuente) {
            validas += 1;
            ids.push(fuente.id);
            marcas.push(`[RES:${fuente.id}]`);
          } else {
            invalidas += 1;
            descartes.push(`cita a una fuente que no se pasó: ${alias}`);
          }
        }
        return marcas.join(' ');
      });

      if (invalidas > 0 && validas === 0) {
        descartes.push('párrafo apoyado sólo en fuentes inexistentes');
        return null;
      }

      // Sobre la prosa, sin las marcas: un id real (un UUID) puede traer
      // dentro algo con forma de número de resolución.
      const prosa = parrafo.replace(MARCA, '');

      const ajeno = [...numerosDe(prosa)].find(
        (n) => !numerosPermitidos.has(n)
      );
      if (ajeno) {
        descartes.push(`párrafo que nombra una resolución ajena: ${ajeno}`);
        return null;
      }

      const articulo = [...prosa.matchAll(ARTICULO)]
        .map((m) => m[1])
        .find(
          (n) => !aparece(textoFuentes, n) && !aparece(articulosDeFichas, n)
        );
      if (articulo) {
        descartes.push(
          `párrafo que cita un artículo ajeno a las fuentes: ${articulo}`
        );
        return null;
      }

      for (const id of ids) if (!citadas.includes(id)) citadas.push(id);
      // Quitar una marca puede dejar un espacio suelto antes del punto.
      return limpio
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\s+([.,;:])/g, '$1')
        .trim();
    })
    .filter((p): p is string => Boolean(p));

  if (citadas.length === 0) {
    return { texto: null, citadas: [], descartes };
  }
  return { texto: parrafos.join('\n\n'), citadas, descartes };
}
