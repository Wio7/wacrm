'use client';

import { useState } from 'react';

import { api, type Resumen } from '@/components/criterio/api';
import { campo, Marco } from '@/components/criterio/marco';
import { Tarjeta } from '@/components/criterio/tarjeta';

type Resultado = Resumen & { extracto: string | null };

export default function Buscar() {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setCargando(true);
    setError('');
    try {
      const datos = await api<{ resultados: Resultado[] }>(
        `buscar?q=${encodeURIComponent(q.trim())}`
      );
      setResultados(datos.resultados);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <Marco titulo="Buscar">
      <form onSubmit={buscar}>
        <input
          type="search"
          enterKeyHint="search"
          placeholder="Casación, artículo o tema…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={campo}
        />
      </form>
      <div className="mt-4 space-y-3">
        {cargando && <p className="text-sm text-slate-500">Buscando…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!cargando && resultados?.length === 0 && (
          <p className="text-sm text-slate-500">
            No encontré resoluciones para esa búsqueda.
          </p>
        )}
        {!cargando &&
          resultados?.map((r) => (
            <Tarjeta key={r.id} r={r} extracto={r.extracto} />
          ))}
        {!resultados && !cargando && (
          <p className="pt-8 text-center text-sm text-slate-500">
            Busca por número de casación, artículo o lo que necesites
            fundamentar.
          </p>
        )}
      </div>
    </Marco>
  );
}
