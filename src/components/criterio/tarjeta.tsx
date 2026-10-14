'use client';

import Link from 'next/link';
import { Calendar, ChevronRight, FileText, Scale } from 'lucide-react';

import { titulo, type Resumen } from './api';

const TIPOS_LABEL: Record<string, string> = {
  casacion: 'Casación',
  pleno_casatorio: 'Pleno Casatorio',
  precedente_vinculante: 'Precedente',
  acuerdo_plenario: 'Acuerdo',
};

export function Tarjeta({
  r,
  extracto,
  className = '',
}: {
  r: Resumen;
  extracto?: string | null;
  className?: string;
}) {
  const metadata = [r.sala, r.procedencia].filter(Boolean).join(' · ');
  const tipoNombre = r.tipo ? (TIPOS_LABEL[r.tipo] ?? r.tipo) : null;

  return (
    <Link
      href={`/criterio/r/${r.id}`}
      className={`group relative block rounded-2xl border border-slate-200/90 border-l-4 border-l-indigo-600 bg-white/95 p-4.5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md hover:shadow-indigo-950/5 active:scale-[0.99] active:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 flex-1">
          {tipoNombre && (
            <div className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50/90 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-200/50">
              <Scale className="size-3 text-indigo-600" />
              <span>{tipoNombre}</span>
            </div>
          )}
          <h2 className="text-[15px] font-bold tracking-tight text-slate-900 group-hover:text-indigo-700 transition-colors leading-snug">
            {titulo(r)}
          </h2>
        </div>

        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
          <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>

      {(metadata || r.fecha) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 font-medium">
          {metadata && <span>{metadata}</span>}
          {metadata && r.fecha && <span>·</span>}
          {r.fecha && (
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Calendar className="size-3" />
              {r.fecha}
            </span>
          )}
        </div>
      )}

      {(r.sumilla || extracto) && (
        <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-slate-600 font-normal">
          {r.sumilla ?? extracto}
        </p>
      )}

      {r.articulos && r.articulos.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          <FileText className="size-3 text-slate-400" />
          <span className="text-[11px] font-medium text-slate-500">
            {r.articulos.slice(0, 3).join(', ')}
            {r.articulos.length > 3 && ` +${r.articulos.length - 3}`}
          </span>
        </div>
      )}
    </Link>
  );
}
