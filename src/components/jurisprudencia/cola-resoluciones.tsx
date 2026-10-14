'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  FileUp,
  FolderSearch,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import {
  BUCKET_PDFS,
  ESTADOS_RESOLUCION,
  NOMBRE_ESTADO,
  NOMBRE_TIPO,
  type EstadoJob,
  type EstadoResolucion,
  type PasoJob,
  type TipoResolucion,
} from '@/lib/juris/tipos';

const MAX_BYTES = 32 * 1024 * 1024;
const MAX_ARCHIVOS = 20;
/** Cada cuánto se mira la cola mientras hay trabajos en curso. */
const SONDEO_MS = 5_000;
/** Cada cuánto, como mucho, se empuja la cola desde el panel. */
const EMPUJE_MS = 25_000;

interface JobFila {
  estado: EstadoJob;
  paso: PasoJob;
  cursor: number;
  error: string | null;
}

interface Fila {
  id: string;
  archivo_nombre: string | null;
  tipo: TipoResolucion | null;
  numero: string | null;
  procedencia: string | null;
  sala: string | null;
  fecha: string | null;
  estado: EstadoResolucion;
  texto_origen: 'pdf' | 'ia' | null;
  ficha_avisos: string[];
  paginas: number | null;
  pdf_path: string | null;
  created_at: string;
  job: JobFila | null;
}

const COLUMNAS =
  'id, archivo_nombre, tipo, numero, procedencia, sala, fecha, estado, texto_origen, ficha_avisos, paginas, pdf_path, created_at, juris_jobs(estado, paso, cursor, error)';

function titulo(f: Fila) {
  if (!f.numero) return f.archivo_nombre ?? 'Sin nombre';
  const tipo = f.tipo ? NOMBRE_TIPO[f.tipo] : 'Resolución';
  return `${tipo} N.° ${f.numero}${f.procedencia ? ` ${f.procedencia}` : ''}`;
}

function avance(f: Fila): string | null {
  const job = f.job;
  if (!job || job.estado === 'listo') return null;
  if (job.estado === 'error') return job.error ?? 'Falló';
  if (job.estado === 'pendiente' && job.paso === 'texto' && job.cursor === 0)
    return 'En cola';
  if (job.paso === 'texto') {
    return job.cursor > 0
      ? `Transcribiendo el escaneo (pág. ${job.cursor} de ${f.paginas ?? '?'})`
      : 'Leyendo el PDF';
  }
  return job.paso === 'ficha' ? 'Armando la ficha' : 'Indexando';
}

const COLOR_ESTADO: Record<EstadoResolucion, string> = {
  borrador: 'border-border text-muted-foreground',
  pendiente_revision: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  publicada: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  rechazada: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
};

export function ColaResoluciones() {
  const supabase = useMemo(() => createClient(), []);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<EstadoResolucion | 'todas'>('todas');
  const entrada = useRef<HTMLInputElement>(null);
  const ultimoEmpuje = useRef(0);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from('juris_resoluciones')
      .select(COLUMNAS)
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) {
      console.error('[jurisprudencia] list failed:', error.message);
      toast.error('No se pudieron cargar las resoluciones');
    } else {
      setFilas(
        (data ?? []).map((r) => {
          const { juris_jobs: jobs, ...resto } = r as typeof r & {
            juris_jobs: JobFila | JobFila[] | null;
          };
          return {
            ...(resto as Omit<Fila, 'job'>),
            job: Array.isArray(jobs) ? (jobs[0] ?? null) : jobs,
          };
        })
      );
    }
    setCargando(false);
  }, [supabase]);

  const empujar = useCallback(async () => {
    ultimoEmpuje.current = Date.now();
    await fetch('/api/juris/admin/procesar', { method: 'POST' }).catch(
      () => undefined
    );
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Mientras haya trabajos en curso: mirar la cola y, si alguno quedó
  // esperando (una pasada se quedó sin tiempo), arrancar otra.
  const enCurso = filas.some(
    (f) => f.job?.estado === 'pendiente' || f.job?.estado === 'procesando'
  );
  const hayPendientes = filas.some((f) => f.job?.estado === 'pendiente');
  useEffect(() => {
    if (!enCurso) return;
    const reloj = setInterval(() => {
      cargar();
      if (hayPendientes && Date.now() - ultimoEmpuje.current > EMPUJE_MS)
        empujar();
    }, SONDEO_MS);
    return () => clearInterval(reloj);
  }, [enCurso, hayPendientes, cargar, empujar]);

  const subir = async (lista: FileList | null) => {
    const archivos = Array.from(lista ?? []);
    if (entrada.current) entrada.current.value = '';
    if (archivos.length === 0) return;
    if (archivos.length > MAX_ARCHIVOS) {
      toast.error(`Sube como máximo ${MAX_ARCHIVOS} PDFs por vez`);
      return;
    }
    const invalido = archivos.find(
      (a) => a.type !== 'application/pdf' || a.size > MAX_BYTES
    );
    if (invalido) {
      toast.error(`"${invalido.name}" no es un PDF o pesa más de 32 MB`);
      return;
    }

    const subidos: { path: string; nombre: string }[] = [];
    try {
      for (const [i, archivo] of archivos.entries()) {
        setSubiendo(`Subiendo ${i + 1} de ${archivos.length}…`);
        const path = `subidas/${crypto.randomUUID()}.pdf`;
        const { error } = await supabase.storage
          .from(BUCKET_PDFS)
          .upload(path, archivo, { contentType: 'application/pdf' });
        if (error) throw new Error(`${archivo.name}: ${error.message}`);
        subidos.push({ path, nombre: archivo.name });
      }

      setSubiendo('Poniendo en cola…');
      const res = await fetch('/api/juris/admin/ingesta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archivos: subidos }),
      });
      const cuerpo = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(cuerpo.error || 'No se pudieron poner en cola');

      ultimoEmpuje.current = Date.now();
      toast.success(
        subidos.length === 1 ? 'PDF en cola' : `${subidos.length} PDFs en cola`
      );
    } catch (err) {
      // Lo que ya subió y no llegó a la cola quedaría huérfano en el bucket.
      if (subidos.length > 0) {
        await supabase.storage
          .from(BUCKET_PDFS)
          .remove(subidos.map((s) => s.path));
      }
      toast.error(err instanceof Error ? err.message : 'No se pudo subir');
    } finally {
      setSubiendo(null);
      cargar();
    }
  };

  const reintentar = async (f: Fila) => {
    const { error } = await supabase
      .from('juris_jobs')
      .update({ estado: 'pendiente', error: null })
      .eq('resolucion_id', f.id);
    if (error) {
      toast.error('No se pudo reintentar');
      return;
    }
    await empujar();
    cargar();
  };

  const eliminar = async (f: Fila) => {
    const aviso =
      f.estado === 'publicada'
        ? `"${titulo(f)}" está publicada: dejará de verse en la app y se quitará de los favoritos y carpetas de quien la tenga guardada. ¿Eliminarla?`
        : `¿Eliminar "${titulo(f)}"?`;
    if (!window.confirm(aviso)) return;

    const { error } = await supabase
      .from('juris_resoluciones')
      .delete()
      .eq('id', f.id);
    if (error) {
      toast.error('No se pudo eliminar');
      return;
    }
    if (f.pdf_path)
      await supabase.storage.from(BUCKET_PDFS).remove([f.pdf_path]);
    setFilas((prev) => prev.filter((x) => x.id !== f.id));
  };

  const visibles =
    filtro === 'todas' ? filas : filas.filter((f) => f.estado === filtro);
  const cuenta = (e: EstadoResolucion) =>
    filas.filter((f) => f.estado === e).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(['todas', ...ESTADOS_RESOLUCION] as const).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setFiltro(e)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filtro === e
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {e === 'todas'
                ? `Todas (${filas.length})`
                : `${NOMBRE_ESTADO[e]} (${cuenta(e)})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={cargar} aria-label="Actualizar">
            <RefreshCw className="size-4" />
          </Button>
          <input
            ref={entrada}
            type="file"
            accept="application/pdf"
            multiple
            hidden
            onChange={(e) => subir(e.target.files)}
          />
          <Button
            onClick={() => entrada.current?.click()}
            disabled={subiendo !== null}
          >
            {subiendo ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileUp className="size-4" />
            )}
            {subiendo ?? 'Subir PDFs'}
          </Button>
        </div>
      </div>

      {cargando ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="text-primary size-7 animate-spin" />
          <p className="text-xs text-muted-foreground">Cargando resoluciones...</p>
        </div>
      ) : visibles.length === 0 ? (
        <div className="border-border/80 bg-card/40 rounded-2xl border border-dashed py-16 px-6 text-center animate-in fade-in-0 duration-200">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-xs mb-4">
            {filas.length === 0 ? (
              <FileText className="size-7" />
            ) : (
              <FolderSearch className="size-7" />
            )}
          </div>
          <h3 className="text-base font-semibold text-foreground">
            {filas.length === 0
              ? 'No hay resoluciones registradas'
              : 'Sin resultados en este estado'}
          </h3>
          <p className="mt-1.5 max-w-md mx-auto text-sm text-muted-foreground leading-relaxed">
            {filas.length === 0
              ? 'Aún no has cargado documentos. Sube los archivos PDF de resoluciones, casaciones o plenos jurisdiccionales para que la IA los procese automáticamente.'
              : 'No se encontraron resoluciones con el filtro seleccionado. Puedes cambiar de filtro o subir nuevos expedientes.'}
          </p>
          {filas.length === 0 && (
            <div className="mt-5">
              <Button
                variant="default"
                size="sm"
                onClick={() => entrada.current?.click()}
                disabled={subiendo !== null}
                className="gap-2 font-medium"
              >
                <FileUp className="size-4" />
                Subir primeros PDFs
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-xs">
                <th className="px-4 py-3 font-medium">Resolución</th>
                <th className="px-4 py-3 font-medium">Sala y fecha</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {visibles.map((f) => {
                const progreso = avance(f);
                const fallo = f.job?.estado === 'error';
                return (
                  <tr key={f.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={`/jurisprudencia/${f.id}`}
                        className="text-foreground font-medium hover:underline"
                      >
                        {titulo(f)}
                      </Link>
                      {f.numero && f.archivo_nombre ? (
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {f.archivo_nombre}
                        </p>
                      ) : null}
                      {f.texto_origen === 'ia' ? (
                        <p className="mt-1 text-xs text-amber-300">
                          Escaneo transcrito por IA: cotejar con el PDF
                        </p>
                      ) : null}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {f.sala ?? '—'}
                      <br />
                      <span className="text-xs">{f.fecha ?? ''}</span>
                    </td>
                    <td className="px-4 py-3">
                      {progreso ? (
                        <span
                          className={`inline-flex items-start gap-1.5 text-xs ${
                            fallo ? 'text-rose-300' : 'text-muted-foreground'
                          }`}
                        >
                          {fallo ? (
                            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                          ) : (
                            <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin" />
                          )}
                          <span className="max-w-xs">{progreso}</span>
                        </span>
                      ) : (
                        <Badge
                          variant="outline"
                          className={COLOR_ESTADO[f.estado]}
                        >
                          {NOMBRE_ESTADO[f.estado]}
                        </Badge>
                      )}
                      {!progreso &&
                      f.ficha_avisos.length > 0 &&
                      f.estado !== 'publicada' ? (
                        <p className="mt-1 text-xs text-amber-300">
                          {f.ficha_avisos.length} aviso
                          {f.ficha_avisos.length === 1 ? '' : 's'}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {fallo ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => reintentar(f)}
                          >
                            <RotateCcw className="size-3.5" />
                            Reintentar
                          </Button>
                        ) : null}
                        <Link
                          href={`/jurisprudencia/${f.id}`}
                          className={buttonVariants({
                            variant: 'outline',
                            size: 'sm',
                          })}
                        >
                          {f.estado === 'publicada' ? 'Ver' : 'Revisar'}
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => eliminar(f)}
                          aria-label="Eliminar"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
