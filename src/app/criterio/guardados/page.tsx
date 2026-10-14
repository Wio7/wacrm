'use client';

import { useEffect, useState } from 'react';

import { api, type Resumen } from '@/components/criterio/api';
import { Marco } from '@/components/criterio/marco';
import { Tarjeta } from '@/components/criterio/tarjeta';

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
      <div className="space-y-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!lista && !error && (
          <p className="text-sm text-slate-500">Cargando…</p>
        )}
        {lista?.length === 0 && (
          <p className="text-sm text-slate-500">
            Aún no guardaste resoluciones. Toca «Guardar» en una para tenerla
            aquí.
          </p>
        )}
        {lista?.map((r) => (
          <Tarjeta key={r.id} r={r} />
        ))}
      </div>
    </Marco>
  );
}
