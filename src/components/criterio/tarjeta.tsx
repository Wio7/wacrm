'use client';

import Link from 'next/link';

import { titulo, type Resumen } from './api';

export function Tarjeta({
  r,
  extracto,
}: {
  r: Resumen;
  extracto?: string | null;
}) {
  return (
    <Link
      href={`/criterio/r/${r.id}`}
      className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50"
    >
      <p className="text-[15px] font-semibold text-slate-900">{titulo(r)}</p>
      <p className="mt-0.5 text-xs text-slate-500">
        {[r.sala, r.procedencia, r.fecha].filter(Boolean).join(' · ')}
      </p>
      {(r.sumilla || extracto) && (
        <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-slate-700">
          {r.sumilla ?? extracto}
        </p>
      )}
    </Link>
  );
}
