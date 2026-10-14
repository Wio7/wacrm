'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bookmark,
  Search,
  Sparkles,
} from 'lucide-react';

import { api, type Resumen } from '@/components/criterio/api';
import { Marco } from '@/components/criterio/marco';
import { Tarjeta } from '@/components/criterio/tarjeta';

function TarjetaSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200/90 border-l-4 border-l-slate-300 bg-white p-5 shadow-xs">
      <div className="space-y-3">
        <div className="h-4 w-28 rounded-md animate-shimmer" />
        <div className="h-5 w-4/5 rounded-md animate-shimmer" />
        <div className="h-3 w-1/2 rounded-md animate-shimmer" />
      </div>
    </div>
  );
}

export default function Guardados() {
  const [lista, setLista] = useState<Resumen[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ favoritos: Resumen[] }>('favoritos')
      .then((d) => setLista(d.favoritos))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <Marco titulo="Guardados">
      <div className="space-y-4">
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/70 p-4 text-red-800">
            <AlertCircle className="size-5 shrink-0 text-red-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Ocurrió un error al cargar guardados</p>
              <p className="mt-0.5 text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Esqueletos durante la carga */}
        {!lista && !error && (
          <div className="space-y-3">
            <TarjetaSkeleton />
            <TarjetaSkeleton />
          </div>
        )}

        {/* Encabezado informativo cuando hay guardados */}
        {lista && lista.length > 0 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-slate-500">
              Colección personal
            </span>
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200/60">
              {lista.length} {lista.length === 1 ? 'resolución' : 'resoluciones'}
            </span>
          </div>
        )}

        {/* Estado vacío con ilustración y llamada a la acción */}
        {lista?.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/70 p-8 text-center backdrop-blur-xs mt-4">
            <div className="flex size-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-indigo-100 to-indigo-50 text-indigo-600 shadow-inner mb-4">
              <Bookmark className="size-8 stroke-[1.75]" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Aún no tienes resoluciones guardadas
            </h2>
            <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-slate-500">
              Guarda las casaciones más relevantes para acceder a sus sumillas, criterios y citas en cualquier momento.
            </p>

            <Link
              href="/criterio"
              className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/25 transition-all duration-200 hover:from-indigo-500 hover:to-indigo-600 active:scale-95"
            >
              <Search className="size-4" />
              <span>Explorar jurisprudencia</span>
              <ArrowRight className="size-3.5 opacity-80" />
            </Link>
          </div>
        )}

        {/* Lista de tarjetas guardadas */}
        {lista && lista.length > 0 && (
          <div className="space-y-3">
            {lista.map((r, i) => (
              <div
                key={r.id}
                className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300 fill-mode-both"
                style={{ animationDelay: `${Math.min(i * 50, 250)}ms` }}
              >
                <Tarjeta r={r} />
              </div>
            ))}

            <p className="pt-2 text-center text-[11px] text-slate-400">
              Toca una resolución para revisar su texto completo o retirar de guardados
            </p>
          </div>
        )}
      </div>
    </Marco>
  );
}
