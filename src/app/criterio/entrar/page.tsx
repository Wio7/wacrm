'use client';

import { useState } from 'react';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Scale,
} from 'lucide-react';

import { BotonInstalar } from '@/components/criterio/instalar';
import { createClient } from '@/lib/supabase/client';

export default function Entrar() {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
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
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100/80 px-4 py-8">
      {/* Luces y formas ambientales decorativas */}
      <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-gradient-to-br from-indigo-400/20 to-violet-500/20 blur-3xl animate-pulse [animation-duration:8s]" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-gradient-to-tr from-violet-400/20 to-indigo-500/20 blur-3xl animate-pulse [animation-duration:10s]" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Tarjeta de inicio con glassmorphism */}
        <div className="rounded-3xl border border-white/70 bg-white/85 p-7 shadow-xl shadow-indigo-950/5 backdrop-blur-xl ring-1 ring-slate-900/5 sm:p-8">
          {/* Logo y Encabezado */}
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 text-3xl font-extrabold text-white shadow-lg shadow-indigo-600/30 ring-2 ring-white/50 transition-transform duration-300 hover:scale-105">
              C
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Criterio
              </h1>
              <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 uppercase">
                Legal
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Jurisprudencia sistematizada en tu dispositivo
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={entrar} className="space-y-4">
            {/* Input con floating label: Correo */}
            <div className="relative">
              <div className="pointer-events-none absolute left-3.5 top-4 text-slate-400">
                <Mail className="size-4" />
              </div>
              <input
                id="correo"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder=" "
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
                className="peer w-full min-h-[52px] rounded-xl border border-slate-200/90 bg-white/90 pl-10 pr-4 pt-4 pb-1 text-sm text-slate-900 shadow-2xs outline-none transition-all duration-200 focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
              />
              <label
                htmlFor="correo"
                className="pointer-events-none absolute left-10 top-1 text-[11px] font-semibold text-slate-400 transition-all duration-200 peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:text-slate-400 peer-focus:top-1 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:text-indigo-600"
              >
                Correo electrónico
              </label>
            </div>

            {/* Input con floating label: Contraseña */}
            <div className="relative">
              <div className="pointer-events-none absolute left-3.5 top-4 text-slate-400">
                <Lock className="size-4" />
              </div>
              <input
                id="clave"
                type={verClave ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder=" "
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                required
                className="peer w-full min-h-[52px] rounded-xl border border-slate-200/90 bg-white/90 pl-10 pr-11 pt-4 pb-1 text-sm text-slate-900 shadow-2xs outline-none transition-all duration-200 focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
              />
              <label
                htmlFor="clave"
                className="pointer-events-none absolute left-10 top-1 text-[11px] font-semibold text-slate-400 transition-all duration-200 peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:text-slate-400 peer-focus:top-1 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:text-indigo-600"
              >
                Contraseña
              </label>
              <button
                type="button"
                onClick={() => setVerClave(!verClave)}
                aria-label={verClave ? 'Ocultar contraseña' : 'Ver contraseña'}
                className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:scale-95 transition-all"
              >
                {verClave ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>

            {/* Mensaje de error amigable */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50/80 px-3.5 py-2.5 text-xs text-red-800 animate-in fade-in-50 duration-150">
                <AlertCircle className="size-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Botón de acceso con spinner y degradado */}
            <button
              type="submit"
              disabled={cargando}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition-all duration-200 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.99] active:from-indigo-700 active:to-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cargando ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Iniciando sesión…</span>
                </>
              ) : (
                <span>Iniciar sesión</span>
              )}
            </button>
          </form>

          {/* Botón de instalación / PWA */}
          <div className="mt-6 flex justify-center border-t border-slate-100 pt-5">
            <BotonInstalar />
          </div>
        </div>
      </div>
    </div>
  );
}
