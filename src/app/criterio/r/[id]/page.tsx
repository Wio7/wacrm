'use client';

import { use, useEffect, useState } from 'react';
import {
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Calendar,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FileDown,
  FileText,
  Gavel,
  History,
  Scale,
  Sparkles,
  Tag,
} from 'lucide-react';

import { api, titulo, type Resumen } from '@/components/criterio/api';
import { Marco } from '@/components/criterio/marco';

interface Ficha extends Resumen {
  hechos: string | null;
  cita: string;
  favorito: boolean;
  pdf_url: string | null;
  temas: { id: string; nombre: string }[];
}

const FALLO_LABEL: Record<string, { texto: string; estilo: string }> = {
  fundada: {
    texto: 'Fundada',
    estilo: 'bg-emerald-50 text-emerald-700 ring-emerald-200/60 border-emerald-200',
  },
  fundada_en_parte: {
    texto: 'Fundada en parte',
    estilo: 'bg-amber-50 text-amber-700 ring-amber-200/60 border-amber-200',
  },
  infundada: {
    texto: 'Infundada',
    estilo: 'bg-rose-50 text-rose-700 ring-rose-200/60 border-rose-200',
  },
  improcedente: {
    texto: 'Improcedente',
    estilo: 'bg-slate-100 text-slate-700 ring-slate-200/60 border-slate-200',
  },
  otro: {
    texto: 'Otro',
    estilo: 'bg-slate-100 text-slate-700 ring-slate-200/60 border-slate-200',
  },
};

function SeccionColapsable({
  tituloSeccion,
  icono: Icono,
  children,
  inicioAbierto = true,
}: {
  tituloSeccion: string;
  icono: React.ElementType;
  children: React.ReactNode;
  inicioAbierto?: boolean;
}) {
  const [abierto, setAbierto] = useState(inicioAbierto);

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-xs transition-all duration-200">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className="flex w-full min-h-[48px] items-center justify-between gap-3 px-5 py-3.5 text-left font-semibold text-slate-800 transition-colors hover:bg-slate-50/80 active:bg-slate-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-inset"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
            <Icono className="size-4" />
          </div>
          <span className="text-sm tracking-tight text-slate-900">
            {tituloSeccion}
          </span>
        </div>
        <ChevronDown
          className={`size-4 text-slate-400 transition-transform duration-200 ${
            abierto ? 'rotate-180 text-indigo-600' : ''
          }`}
        />
      </button>

      {abierto && (
        <div className="border-t border-slate-100 px-5 pt-3.5 pb-5 text-[15px] leading-relaxed text-slate-700 animate-in fade-in-50 duration-150">
          {children}
        </div>
      )}
    </section>
  );
}

function ResolucionSkeleton() {
  return (
    <div className="space-y-4">
      {/* Hero skeleton */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs">
        <div className="space-y-3">
          <div className="h-5 w-24 rounded-md animate-shimmer" />
          <div className="h-7 w-4/5 rounded-md animate-shimmer" />
          <div className="h-4 w-3/5 rounded-md animate-shimmer" />
          <div className="grid grid-cols-2 gap-2 pt-2">
            <div className="h-11 rounded-xl animate-shimmer" />
            <div className="h-11 rounded-xl animate-shimmer" />
          </div>
        </div>
      </div>
      {/* Blocks skeleton */}
      <div className="h-28 rounded-2xl border border-slate-200/90 bg-white p-5 animate-shimmer" />
      <div className="h-36 rounded-2xl border border-slate-200/90 bg-white p-5 animate-shimmer" />
    </div>
  );
}

export default function Resolucion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [r, setR] = useState<Ficha>();
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api<{ resolucion: Ficha }>(`resoluciones/${id}`)
      .then((d) => setR(d.resolucion))
      .catch((e: Error) => setError(e.message));
  }, [id]);

  async function alternarGuardado() {
    if (!r || guardando) return;
    setGuardando(true);
    const nuevoEstado = !r.favorito;
    setR({ ...r, favorito: nuevoEstado });
    try {
      await (nuevoEstado
        ? api('favoritos', {
            method: 'POST',
            body: JSON.stringify({ resolucion_id: r.id }),
          })
        : api(`favoritos/${r.id}`, { method: 'DELETE' }));
    } catch {
      setR({ ...r, favorito: !nuevoEstado });
    } finally {
      setGuardando(false);
    }
  }

  async function copiar() {
    if (!r) return;
    await navigator.clipboard.writeText(r.cita);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const falloInfo = r?.fallo ? FALLO_LABEL[r.fallo] : null;

  return (
    <Marco titulo="Resolución" atras>
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/70 p-4 text-red-800">
          <AlertCircle className="size-5 shrink-0 text-red-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">No se pudo cargar la resolución</p>
            <p className="mt-0.5 text-red-700">{error}</p>
          </div>
        </div>
      )}

      {!r && !error && <ResolucionSkeleton />}

      {r && (
        <article className="space-y-4">
          {/* Hero Section Card */}
          <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-indigo-50/15 to-white p-5 md:p-6 shadow-xs backdrop-blur-sm">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200/60">
                  <Scale className="size-3.5 text-indigo-600" />
                  {r.tipo ? r.tipo.toUpperCase() : 'RESOLUCIÓN'}
                </span>

                {falloInfo && (
                  <span
                    className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 border ${falloInfo.estilo}`}
                  >
                    <Gavel className="size-3 mr-1" />
                    {falloInfo.texto}
                  </span>
                )}
              </div>

              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 leading-tight">
                {titulo(r)}
              </h2>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-500 pt-1">
                {[r.sala, r.procedencia].filter(Boolean).join(' · ')}
                {r.fecha && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 text-slate-600">
                      <Calendar className="size-3.5 text-slate-400" />
                      {r.fecha}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Acciones principales */}
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={alternarGuardado}
                disabled={guardando}
                aria-label={r.favorito ? 'Quitar de guardados' : 'Guardar resolución'}
                className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                  r.favorito
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-sm shadow-indigo-600/25 ring-1 ring-indigo-700'
                    : 'border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                {r.favorito ? (
                  <>
                    <BookmarkCheck className="size-4" />
                    <span>Guardada</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="size-4" />
                    <span>Guardar</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={copiar}
                aria-label="Copiar cita formal al portapapeles"
                className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                  copiado
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                {copiado ? (
                  <>
                    <Check className="size-4 text-emerald-600" />
                    <span>¡Copiada!</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-4 text-slate-500" />
                    <span>Copiar cita</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Secciones colapsables de contenido legal */}
          {r.criterio && (
            <SeccionColapsable
              tituloSeccion="Criterio Jurídico"
              icono={Sparkles}
              inicioAbierto={true}
            >
              <p className="whitespace-pre-line">{r.criterio}</p>
            </SeccionColapsable>
          )}

          {r.sumilla && (
            <SeccionColapsable
              tituloSeccion="Sumilla"
              icono={FileText}
              inicioAbierto={true}
            >
              <p className="whitespace-pre-line">{r.sumilla}</p>
            </SeccionColapsable>
          )}

          {r.hechos && (
            <SeccionColapsable
              tituloSeccion="Hechos y Antecedentes"
              icono={History}
              inicioAbierto={false}
            >
              <p className="whitespace-pre-line">{r.hechos}</p>
            </SeccionColapsable>
          )}

          {/* Artículos jurídicos aplicados */}
          {r.articulos.length > 0 && (
            <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-xs">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Scale className="size-3.5 text-indigo-600" />
                Artículos y Normas Aplicadas
              </h3>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {r.articulos.map((art, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    {art}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Temas / Descriptores con efecto pill hover */}
          {r.temas.length > 0 && (
            <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-xs">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Tag className="size-3.5 text-indigo-600" />
                Materias y Temas
              </h3>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {r.temas.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1 rounded-full border border-indigo-200/70 bg-indigo-50/80 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-2xs transition-all duration-150 hover:-translate-y-0.5 hover:bg-indigo-100 hover:border-indigo-300 cursor-default"
                  >
                    {t.nombre}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Enlace al PDF oficial completo */}
          {r.pdf_url && (
            <div className="pt-2">
              <a
                href={r.pdf_url}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-3 text-center text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition-all duration-200 hover:from-indigo-500 hover:to-indigo-600 hover:shadow-md hover:shadow-indigo-600/25 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              >
                <FileDown className="size-4" />
                <span>Ver documento PDF completo</span>
                <ExternalLink className="size-3.5 opacity-70 ml-0.5" />
              </a>
            </div>
          )}

          {/* Barra de acción fija inferior en celular para acceso rápido */}
          <div className="fixed inset-x-0 bottom-16 z-20 mx-auto max-w-md px-4 pb-2 pt-1 pointer-events-none md:hidden">
            <div className="pointer-events-auto flex items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white/90 p-2 shadow-lg backdrop-blur-md">
              <button
                type="button"
                onClick={alternarGuardado}
                className={`flex flex-1 min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition-all active:scale-95 ${
                  r.favorito
                    ? 'bg-indigo-700 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                {r.favorito ? (
                  <BookmarkCheck className="size-3.5" />
                ) : (
                  <Bookmark className="size-3.5" />
                )}
                <span>{r.favorito ? 'Guardada' : 'Guardar'}</span>
              </button>

              <button
                type="button"
                onClick={copiar}
                className="flex flex-1 min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/80 active:scale-95 transition-all"
              >
                {copiado ? (
                  <Check className="size-3.5 text-emerald-600" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                <span>{copiado ? 'Copiada' : 'Cita'}</span>
              </button>

              {r.pdf_url && (
                <a
                  href={r.pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Abrir PDF"
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:scale-95 transition-all"
                >
                  <FileDown className="size-4" />
                </a>
              )}
            </div>
          </div>
        </article>
      )}
    </Marco>
  );
}
