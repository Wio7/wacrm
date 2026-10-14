'use client';

import { useState } from 'react';

import { BotonInstalar } from '@/components/criterio/instalar';
import { boton, campo } from '@/components/criterio/marco';
import { createClient } from '@/lib/supabase/client';

export default function Entrar() {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError('');
    const { error } = await createClient().auth.signInWithPassword({
      email: correo.trim().toLowerCase(),
      password: clave,
    });
    if (error) {
      setError('Correo o contraseña incorrectos.');
      setCargando(false);
      return;
    }
    window.location.href = '/criterio';
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center bg-slate-50 px-6">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-indigo-700 text-3xl font-bold text-white">
          C
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Criterio</h1>
        <p className="mt-1 text-sm text-slate-500">
          Jurisprudencia peruana en tu celular
        </p>
      </div>
      <form onSubmit={entrar} className="space-y-3">
        <input
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="Correo"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          className={campo}
          required
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Contraseña"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          className={campo}
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className={boton} disabled={cargando}>
          {cargando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <div className="mt-6 flex justify-center">
        <BotonInstalar />
      </div>
    </div>
  );
}
