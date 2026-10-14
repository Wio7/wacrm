'use client';

import { useState } from 'react';
import {
  AlertCircle,
  FileQuestion,
  Search,
  Sparkles,
  X,
} from 'lucide-react';

import { api, type Resumen } from '@/components/criterio/api';
import { campo, Marco } from '@/components/criterio/marco';
import { Tarjeta } from '@/components/criterio/tarjeta';

type Resultado = Resumen & { extracto: string | null };

const SUGERENCIAS = [
  'Casación Civil',
  'Despido incausado',
  'Simulación absoluta',
  'Prescripción adquisitiva',
  'Indemnización daños',
];

function TarjetaSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200/90 border-l-4 border-l-slate-300 bg-white p-5 shadow-xs">
      <div className="space-y-3">
        <div className="h-4 w-28 rounded-md animate-shimmer" />
        <div className="h-5 w-4/5 rounded-md animate-shimmer" />
        <div className="h-3 w-1/2 rounded-md animate-shimmer" />
        <div className="space-y-2 pt-2">
          <div className="h-3.5 w-full rounded-md animate-shimmer" />
          <div className="h-3.5 w-11/12 rounded-md animate-shimmer" />
        </div>
      </div>
    </div>
  );
}

export default function Buscar() {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function ejecutarBusqueda(termino: string) {
    const consulta = termino.trim();
    if (consulta.length < 2) return;
    setCargando(true);
    setError('');
    try {
      const datos = await api<{ resultados: Resultado[] }>(
        `buscar?q=${encodeURIComponent(consulta)}`
      );
      setResultados(datos.resultados);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    ejecutarBusqueda(q);
  }

  function seleccionarSugerencia(s: string) {
    setQ(s);
    ejecutarBusqueda(s);
  }

  function limpiar() {
    setQ('');
    setResultados(null);
    setError('');
  }

  return (
    <Marco titulo="Buscar">
      {/* Barra de búsqueda interactiva */}
      <form onSubmit={buscar} className="relative">
        <div className="relative flex items-center">
          <div className="pointer-events-none absolute left-3.5 flex items-center justify-center">
            <Search
              className={`size-5 transition-all duration-200 ${
                cargando
                  ? 'animate-pulse text-indigo-600 scale-110'
                  : 'text-slate-400'
              }`}
            />
          </div>
          <input
            type="search"
            enterKeyHint="search"
            placeholder="Casación, artículo o tema…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={`${campo} pl-11 pr-12`}
            aria-label="Buscar resoluciones"
          />
          {q && !cargando && (
            <button
              type="button"
              onClick={limpiar}
              aria-label="Borrar búsqueda"
              className="absolute right-3 flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:scale-95 transition-all"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </form>

      {/* Sugerencias rápidas cuando no hay búsqueda activa */}
      {!resultados && !cargando && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500 mr-0.5">
            <Sparkles className="size-3 text-indigo-500" />
            Sugerencias:
          </span>
          {SUGERENCIAS.map((sug) => (
            <button
              key={sug}
              type="button"
              onClick={() => seleccionarSugerencia(sug)}
              className="rounded-full border border-slate-200/80 bg-white/80 px-2.5 py-1 text-xs text-slate-600 shadow-2xs transition-all duration-150 hover:border-indigo-300 hover:bg-indigo-50/70 hover:text-indigo-700 active:scale-95"
            >
              {sug}
            </button>
          ))}
        </div>
      )}

      {/* Encabezado de resultados */}
      {resultados && !cargando && (
        <div className="mt-4 flex items-center justify-between px-1">
          <p className="text-xs font-medium text-slate-500">
            Resultados encontrados
          </p>
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200/60">
            {resultados.length} {resultados.length === 1 ? 'resolución' : 'resoluciones'}
          </span>
        </div>
      )}

      {/* Lista de resultados o estados */}
      <div className="mt-4 space-y-3">
        {/* Esqueletos durante la carga */}
        {cargando && (
          <div className="space-y-3">
            <TarjetaSkeleton />
            <TarjetaSkeleton />
            <TarjetaSkeleton />
          </div>
        )}

        {/* Mensaje de error amigable */}
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/70 p-4 text-red-800">
            <AlertCircle className="size-5 shrink-0 text-red-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Ocurrió un inconveniente</p>
              <p className="mt-0.5 text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Estado vacío tras búsqueda sin resultados */}
        {!cargando && resultados?.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center backdrop-blur-xs">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-xs mb-3">
              <FileQuestion className="size-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              No encontramos resoluciones
            </h3>
            <p className="mt-1 max-w-xs text-xs text-slate-500">
              No hubo coincidencias para «{q}». Intenta verificar el número o utilizar palabras clave más amplias.
            </p>
          </div>
        )}

        {/* Tarjetas de resultados con animación escalonada */}
        {!cargando &&
          resultados?.map((r, i) => (
            <div
              key={r.id}
              className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300 fill-mode-both"
              style={{ animationDelay: `${Math.min(i * 50, 300)}ms` }}
            >
              <Tarjeta r={r} extracto={r.extracto} />
            </div>
          ))}

        {/* Estado inicial educativo */}
        {!resultados && !cargando && (
          <div className="mt-8 flex flex-col items-center justify-center text-center px-4">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-100 to-indigo-50 text-indigo-600 shadow-inner mb-3.5">
              <Search className="size-7" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">
              Encuentra criterios vinculantes
            </h2>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500">
              Busca por número de casación, artículo legal o temática jurídica para fundamentar tus escritos y defensas.
            </p>
          </div>
        )}
      </div>
    </Marco>
  );
}
