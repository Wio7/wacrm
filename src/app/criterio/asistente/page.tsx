'use client';

import Link from 'next/link';
import { useState } from 'react';

import { api, titulo, type Resumen } from '@/components/criterio/api';
import { boton, campo, Marco } from '@/components/criterio/marco';

type Cita = Resumen & { cita: string };
interface Respuesta {
  respuesta: string;
  citas: Cita[];
  aviso: string;
}

/** El texto trae marcas [RES:<id>]; cada una se vuelve un enlace. */
function Texto({ texto, citas }: { texto: string; citas: Cita[] }) {
  const porId = new Map(citas.map((c) => [c.id, c]));
  return (
    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">
      {texto.split(/(\[RES:[^\]]+\])/).map((parte, i) => {
        const id = parte.match(/^\[RES:([^\]]+)\]$/)?.[1];
        if (!id) return parte;
        const c = porId.get(id);
        return c ? (
          <Link
            key={i}
            href={`/criterio/r/${c.id}`}
            className="font-medium text-indigo-700 underline"
          >
            ({titulo(c)})
          </Link>
        ) : null;
      })}
    </p>
  );
}

export default function Asistente() {
  const [pregunta, setPregunta] = useState('');
  const [hilo, setHilo] = useState<{ p: string; r: Respuesta }[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function preguntar(e: React.FormEvent) {
    e.preventDefault();
    const p = pregunta.trim();
    if (p.length < 5) return;
    setCargando(true);
    setError('');
    try {
      const r = await api<Respuesta>('asistente', {
        method: 'POST',
        body: JSON.stringify({ pregunta: p }),
      });
      setHilo((h) => [...h, { p, r }]);
      setPregunta('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <Marco titulo="Asistente">
      <div className="space-y-5">
        {hilo.length === 0 && (
          <p className="text-sm text-slate-500">
            Pregunta en lenguaje natural. Responde solo con resoluciones del
            catálogo y cita cada una.
          </p>
        )}
        {hilo.map(({ p, r }, i) => (
          <div key={i} className="space-y-2">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-700 px-4 py-2.5 text-[15px] text-white">
              {p}
            </p>
            <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white p-4">
              <Texto texto={r.respuesta} citas={r.citas} />
              {r.aviso && (
                <p className="mt-3 text-xs text-slate-500">{r.aviso}</p>
              )}
            </div>
          </div>
        ))}
        {cargando && (
          <p className="text-sm text-slate-500">
            Revisando la jurisprudencia… puede tardar unos segundos.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <form onSubmit={preguntar} className="space-y-2">
          <textarea
            rows={3}
            placeholder="¿Cuándo procede la nulidad de un acto jurídico por simulación?"
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            className={campo}
          />
          <button className={boton} disabled={cargando}>
            Preguntar
          </button>
        </form>
      </div>
    </Marco>
  );
}
