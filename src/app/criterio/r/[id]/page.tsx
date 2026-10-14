'use client';

import { use, useEffect, useState } from 'react';

import { api, titulo, type Resumen } from '@/components/criterio/api';
import { Marco } from '@/components/criterio/marco';

interface Ficha extends Resumen {
  hechos: string | null;
  cita: string;
  favorito: boolean;
  pdf_url: string | null;
  temas: { id: string; nombre: string }[];
}

const FALLO: Record<string, string> = {
  fundada: 'Fundada',
  fundada_en_parte: 'Fundada en parte',
  infundada: 'Infundada',
  improcedente: 'Improcedente',
  otro: 'Otro',
};

function Bloque({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {t}
      </h2>
      <div className="mt-1 text-[15px] leading-relaxed text-slate-800">
        {children}
      </div>
    </section>
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

  useEffect(() => {
    api<{ resolucion: Ficha }>(`resoluciones/${id}`)
      .then((d) => setR(d.resolucion))
      .catch((e: Error) => setError(e.message));
  }, [id]);

  async function alternarGuardado() {
    if (!r) return;
    const guardar = !r.favorito;
    setR({ ...r, favorito: guardar });
    try {
      await (guardar
        ? api('favoritos', {
            method: 'POST',
            body: JSON.stringify({ resolucion_id: r.id }),
          })
        : api(`favoritos/${r.id}`, { method: 'DELETE' }));
    } catch {
      setR({ ...r, favorito: !guardar });
    }
  }

  async function copiar() {
    if (!r) return;
    await navigator.clipboard.writeText(r.cita);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <Marco titulo="Resolución" atras>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!r && !error && <p className="text-sm text-slate-500">Cargando…</p>}
      {r && (
        <article>
          <h2 className="text-xl font-bold">{titulo(r)}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {[r.sala, r.procedencia, r.fecha].filter(Boolean).join(' · ')}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={alternarGuardado}
              className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${
                r.favorito
                  ? 'bg-indigo-700 text-white'
                  : 'border border-slate-300 bg-white text-slate-800'
              }`}
            >
              {r.favorito ? 'Guardada' : 'Guardar'}
            </button>
            <button
              onClick={copiar}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800"
            >
              {copiado ? 'Cita copiada' : 'Copiar cita'}
            </button>
          </div>

          {r.sumilla && <Bloque t="Sumilla">{r.sumilla}</Bloque>}
          {r.criterio && <Bloque t="Criterio">{r.criterio}</Bloque>}
          {r.hechos && <Bloque t="Hechos">{r.hechos}</Bloque>}
          {r.articulos.length > 0 && (
            <Bloque t="Artículos">{r.articulos.join(' · ')}</Bloque>
          )}
          {r.fallo && <Bloque t="Fallo">{FALLO[r.fallo] ?? r.fallo}</Bloque>}
          {r.temas.length > 0 && (
            <Bloque t="Temas">
              <div className="flex flex-wrap gap-1.5">
                {r.temas.map((t) => (
                  <span
                    key={t.id}
                    className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-indigo-800"
                  >
                    {t.nombre}
                  </span>
                ))}
              </div>
            </Bloque>
          )}
          {r.pdf_url && (
            <a
              href={r.pdf_url}
              target="_blank"
              rel="noreferrer"
              className="mt-6 block rounded-xl bg-indigo-700 px-4 py-3 text-center font-semibold text-white"
            >
              Ver PDF completo
            </a>
          )}
        </article>
      )}
    </Marco>
  );
}
