// ============================================================
// La cola de ingesta: de un PDF a una ficha lista para revisar.
//
// Tres pasos por resolución (migración 071): texto → ficha → fragmentos.
// Cada llamada al modelo puede tardar más de lo que el servidor deja
// vivir a una función, así que el trabajo avanza de a pocos y guarda
// dónde va: si se acaba el tiempo, el trabajo vuelve a 'pendiente' con
// su paso y su cursor, y la siguiente pasada lo retoma ahí.
//
// Un fallo NO se reintenta solo: reintentar a ciegas es volver a pagar
// la misma llamada. El trabajo queda en 'error' con el motivo a la vista
// y el admin decide cuándo reintentar (retoma en el paso que falló).
//
// Corre con la service-role: no hay usuario en una pasada de cron.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

import { toVectorLiteral } from '@/lib/ai/embeddings';

import { crearEmbeddings } from './embeddings';
import { armarFicha } from './ficha';
import { fragmentar } from './fragmentos';
import { transcribirPdf } from './modelo';
import { esEscaneo, leerPdf, recortarPdf, unirPaginas } from './pdf';
import { BUCKET_PDFS, JurisError, type Job, type Tema } from './tipos';

/** Cuánto trabaja una pasada antes de soltar (el servidor corta a 300 s). */
const PRESUPUESTO_MS = 200_000;
/** Lo que se reserva para una llamada al modelo; con menos no se empieza. */
const RESERVA_MS = 100_000;
/** Páginas de un escaneo que se transcriben por llamada. */
const PAGINAS_POR_TANDA = 6;
/** Menos texto que esto no es una resolución: algo salió mal al leer. */
const MIN_TEXTO = 400;

type Avance = 'listo' | 'sin_tiempo';

class Reloj {
  private readonly fin: number;
  constructor(presupuestoMs: number) {
    this.fin = Date.now() + presupuestoMs;
  }
  alcanza(ms = RESERVA_MS) {
    return this.fin - Date.now() > ms;
  }
}

async function actualizarJob(
  db: SupabaseClient,
  id: string,
  cambios: Partial<Job> & Record<string, unknown>
) {
  const { error } = await db.from('juris_jobs').update(cambios).eq('id', id);
  if (error) throw error;
}

async function actualizarResolucion(
  db: SupabaseClient,
  id: string,
  cambios: Record<string, unknown>
) {
  const { error } = await db
    .from('juris_resoluciones')
    .update(cambios)
    .eq('id', id);
  if (error) throw error;
}

const candado = () => new Date(Date.now() + 6 * 60_000).toISOString();

// ------------------------------------------------------------
// Paso 1 — texto
// ------------------------------------------------------------
async function pasoTexto(
  db: SupabaseClient,
  job: Job,
  reloj: Reloj
): Promise<Avance> {
  const { data: resolucion, error } = await db
    .from('juris_resoluciones')
    .select('pdf_path, paginas')
    .eq('id', job.resolucion_id)
    .single();
  if (error) throw error;
  if (!resolucion.pdf_path) {
    throw new JurisError('sin_pdf', 'La resolución no tiene un PDF asociado.');
  }

  const descarga = await db.storage
    .from(BUCKET_PDFS)
    .download(resolucion.pdf_path);
  if (descarga.error) {
    throw new JurisError(
      'pdf_no_encontrado',
      `No se pudo descargar el PDF: ${descarga.error.message}`
    );
  }
  const bytes = new Uint8Array(await descarga.data.arrayBuffer());

  let paginas = resolucion.paginas as number | null;
  let transcrito = job.parcial ?? '';
  let cursor = job.cursor;

  // Primera vez: si el PDF trae su texto, se usa y no hay nada que transcribir.
  if (cursor === 0 && !transcrito) {
    const leido = await leerPdf(bytes);
    paginas = leido.paginas;
    await actualizarResolucion(db, job.resolucion_id, { paginas });
    if (!esEscaneo(leido)) {
      await guardarTexto(db, job, unirPaginas(leido.textos), 'pdf');
      return 'listo';
    }
  }

  // Escaneo: lo transcribe el modelo, por tandas, guardando el avance.
  const total = paginas ?? 0;
  while (cursor < total) {
    if (!reloj.alcanza()) return 'sin_tiempo';
    const tanda = await recortarPdf(bytes, cursor, PAGINAS_POR_TANDA);
    const texto = await transcribirPdf(tanda);
    transcrito = [transcrito, texto].filter(Boolean).join('\n\n');
    cursor = Math.min(cursor + PAGINAS_POR_TANDA, total);
    await actualizarJob(db, job.id, {
      cursor,
      parcial: transcrito,
      bloqueado_hasta: candado(),
    });
  }

  await guardarTexto(db, job, transcrito, 'ia');
  return 'listo';
}

async function guardarTexto(
  db: SupabaseClient,
  job: Job,
  texto: string,
  origen: 'pdf' | 'ia'
) {
  if (texto.trim().length < MIN_TEXTO) {
    throw new JurisError(
      'sin_texto',
      'No se pudo sacar texto del PDF. Revisa que sea una resolución y que se lea bien.'
    );
  }
  await actualizarResolucion(db, job.resolucion_id, {
    texto_completo: texto,
    texto_origen: origen,
  });
  await actualizarJob(db, job.id, { paso: 'ficha', cursor: 0, parcial: null });
}

// ------------------------------------------------------------
// Paso 2 — ficha
// ------------------------------------------------------------
async function pasoFicha(
  db: SupabaseClient,
  job: Job,
  reloj: Reloj
): Promise<Avance> {
  if (!reloj.alcanza()) return 'sin_tiempo';

  const [{ data: resolucion, error }, { data: temas, error: errTemas }] =
    await Promise.all([
      db
        .from('juris_resoluciones')
        .select('texto_completo')
        .eq('id', job.resolucion_id)
        .single(),
      db
        .from('juris_temas')
        .select('id, parent_id, slug, nombre, descripcion, orden'),
    ]);
  if (error) throw error;
  if (errTemas) throw errTemas;

  const texto = (resolucion.texto_completo as string | null) ?? '';
  const { ficha, avisos, cruda, modelo } = await armarFicha(
    texto,
    (temas ?? []) as Tema[]
  );

  await actualizarResolucion(db, job.resolucion_id, {
    tipo: ficha.tipo,
    numero: ficha.numero,
    anio: ficha.anio,
    procedencia: ficha.procedencia,
    sala: ficha.sala,
    fecha: ficha.fecha,
    sumilla: ficha.sumilla,
    criterio: ficha.criterio,
    hechos: ficha.hechos,
    articulos: ficha.articulos,
    fallo: ficha.fallo,
    ficha_ia: cruda,
    ficha_avisos: avisos,
    modelo_ficha: modelo,
  });

  // Los temas son una sugerencia: se reemplazan los que hubiera y quien
  // revisa los confirma o los cambia.
  const { error: errBorrar } = await db
    .from('juris_resolucion_temas')
    .delete()
    .eq('resolucion_id', job.resolucion_id);
  if (errBorrar) throw errBorrar;

  const porSlug = new Map(
    (temas ?? []).map((t) => [t.slug as string, t.id as string])
  );
  const filas = ficha.temas_sugeridos.map((slug, i) => ({
    resolucion_id: job.resolucion_id,
    tema_id: porSlug.get(slug)!,
    principal: i === 0,
  }));
  if (filas.length > 0) {
    const { error: errTemasRes } = await db
      .from('juris_resolucion_temas')
      .insert(filas);
    if (errTemasRes) throw errTemasRes;
  }

  await actualizarJob(db, job.id, { paso: 'fragmentos' });
  return 'listo';
}

// ------------------------------------------------------------
// Paso 3 — fragmentos y embeddings
// ------------------------------------------------------------
async function pasoFragmentos(db: SupabaseClient, job: Job): Promise<Avance> {
  const { data: resolucion, error } = await db
    .from('juris_resoluciones')
    .select('texto_completo, ficha_avisos, estado')
    .eq('id', job.resolucion_id)
    .single();
  if (error) throw error;

  const fragmentos = fragmentar(
    (resolucion.texto_completo as string | null) ?? ''
  );
  const avisos = ((resolucion.ficha_avisos as string[] | null) ?? []).filter(
    (a) => !a.startsWith(AVISO_SIN_SEMANTICA)
  );

  // Si los embeddings fallan, los fragmentos se guardan igual: la
  // resolución tiene que poder encontrarse por texto. Queda el aviso.
  let vectores: number[][] | null = null;
  let modelo: string | null = null;
  try {
    const servicio = crearEmbeddings();
    if (servicio) {
      vectores = await servicio.documentos(fragmentos);
      modelo = servicio.modelo;
    } else {
      avisos.push(
        `${AVISO_SIN_SEMANTICA}: no hay clave de embeddings configurada.`
      );
    }
  } catch (err) {
    avisos.push(
      `${AVISO_SIN_SEMANTICA}: ${err instanceof Error ? err.message : err}`
    );
  }

  // Reemplazar, no añadir: repetir el paso no debe duplicar fragmentos.
  const { error: errBorrar } = await db
    .from('juris_resolucion_chunks')
    .delete()
    .eq('resolucion_id', job.resolucion_id);
  if (errBorrar) throw errBorrar;

  if (fragmentos.length > 0) {
    const { error: errInsertar } = await db
      .from('juris_resolucion_chunks')
      .insert(
        fragmentos.map((content, i) => ({
          resolucion_id: job.resolucion_id,
          chunk_index: i,
          content,
          embedding: vectores ? toVectorLiteral(vectores[i]) : null,
        }))
      );
    if (errInsertar) throw errInsertar;
  }

  await actualizarResolucion(db, job.resolucion_id, {
    embeddings_modelo: modelo,
    ficha_avisos: avisos,
    // Una resolución ya publicada que se vuelve a indexar sigue publicada.
    ...(resolucion.estado === 'borrador'
      ? { estado: 'pendiente_revision' }
      : {}),
  });
  return 'listo';
}

export const AVISO_SIN_SEMANTICA = 'Sin búsqueda semántica';

// ------------------------------------------------------------
// La cola
// ------------------------------------------------------------
async function procesarJob(
  db: SupabaseClient,
  job: Job,
  reloj: Reloj
): Promise<void> {
  try {
    let paso = job.paso;
    for (;;) {
      // Se relee tras cada paso: el paso de texto mueve cursor y parcial.
      const actual: Job =
        paso === job.paso ? job : { ...job, paso, cursor: 0, parcial: null };
      const avance =
        paso === 'texto'
          ? await pasoTexto(db, actual, reloj)
          : paso === 'ficha'
            ? await pasoFicha(db, actual, reloj)
            : await pasoFragmentos(db, actual);

      if (avance === 'sin_tiempo') {
        await actualizarJob(db, job.id, {
          estado: 'pendiente',
          bloqueado_hasta: null,
        });
        return;
      }
      if (paso === 'fragmentos') break;
      paso = paso === 'texto' ? 'ficha' : 'fragmentos';
    }
    await actualizarJob(db, job.id, {
      estado: 'listo',
      error: null,
      bloqueado_hasta: null,
      finished_at: new Date().toISOString(),
    });
  } catch (err) {
    const mensaje =
      err instanceof JurisError
        ? err.message
        : `Error inesperado: ${err instanceof Error ? err.message : String(err)}`;
    console.error('[juris ingesta] job failed:', job.id, err);
    await actualizarJob(db, job.id, {
      estado: 'error',
      error: mensaje.slice(0, 1000),
      bloqueado_hasta: null,
    }).catch((e) =>
      console.error('[juris ingesta] could not record failure:', e)
    );
  }
}

/**
 * Trabaja la cola hasta vaciarla o quedarse sin tiempo. Se puede llamar
 * desde varios sitios a la vez: cada llamada se lleva trabajos distintos.
 */
export async function procesarCola(
  db: SupabaseClient,
  opts: { presupuestoMs?: number } = {}
): Promise<{ procesados: number }> {
  const reloj = new Reloj(opts.presupuestoMs ?? PRESUPUESTO_MS);
  let procesados = 0;

  while (reloj.alcanza()) {
    const { data, error } = await db.rpc('juris_tomar_job');
    if (error) throw error;
    const job = (Array.isArray(data) ? data[0] : data) as Job | undefined;
    if (!job?.id) break;
    await procesarJob(db, job, reloj);
    procesados += 1;
  }

  return { procesados };
}
