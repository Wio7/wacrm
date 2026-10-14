'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Scale,
  Sparkles,
  User,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

import { BotonInstalar } from '@/components/criterio/instalar';
import { createClient } from '@/lib/supabase/client';

export default function EntrarPage() {
  return (
    <Suspense fallback={null}>
      <EntrarInner />
    </Suspense>
  );
}

function EntrarInner() {
  const searchParams = useSearchParams();
  const modoInicial = searchParams.get('modo') === 'registro' ? 'registro' : 'entrar';

  const [tab, setTab] = useState<'entrar' | 'registro'>(modoInicial);
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [repetirClave, setRepetirClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [cargando, setCargando] = useState(false);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setExito('');
    setCargando(true);

    const supabase = createClient();
    const emailNormalizado = correo.trim().toLowerCase();

    if (tab === 'registro') {
      if (clave !== repetirClave) {
        setError('Las contraseñas no coinciden.');
        setCargando(false);
        return;
      }
      if (clave.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.');
        setCargando(false);
        return;
      }

      const { data, error: errSignup } = await supabase.auth.signUp({
        email: emailNormalizado,
        password: clave,
        options: {
          data: {
            full_name: nombre.trim(),
            app: 'juripro',
          },
        },
      });

      if (errSignup) {
        setError(errSignup.message || 'Error al crear la cuenta. Inténtalo de nuevo.');
        setCargando(false);
        return;
      }

      if (data.session) {
        setExito('¡Cuenta creada con éxito! Redirigiendo a JuriProApp...');
        setTimeout(() => {
          window.location.href = '/criterio';
        }, 1200);
      } else {
        setExito('Cuenta registrada. Por favor revisa tu correo para confirmar tu cuenta o inicia sesión.');
        setCargando(false);
      }
    } else {
      // Iniciar sesión
      const { error: errSignin } = await supabase.auth.signInWithPassword({
        email: emailNormalizado,
        password: clave,
      });

      if (errSignin) {
        setError('Correo o contraseña incorrectos.');
        setCargando(false);
        return;
      }

      window.location.href = '/criterio';
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-indigo-50/40 to-slate-100/90 px-4 py-8">
      {/* Luces y orbes ambientales decorativos */}
      <div className="pointer-events-none absolute -top-28 -right-28 size-96 rounded-full bg-gradient-to-br from-indigo-500/15 via-violet-500/15 to-transparent blur-3xl animate-pulse [animation-duration:8s]" />
      <div className="pointer-events-none absolute -bottom-28 -left-28 size-96 rounded-full bg-gradient-to-tr from-violet-500/15 via-indigo-500/15 to-transparent blur-3xl animate-pulse [animation-duration:10s]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Tarjeta de autenticación con glassmorphism */}
        <div className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-2xl shadow-indigo-950/10 backdrop-blur-xl ring-1 ring-slate-900/5 sm:p-8">
          {/* Logo y Encabezado de JuriProApp */}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-white/60 transition-transform duration-300 hover:scale-105">
              <Scale className="size-7" />
            </div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                Juri<span className="text-indigo-600">Pro</span>App
              </h1>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 tracking-wide uppercase">
                Legal
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Jurisprudencia sistematizada y asistente de IA en tu dispositivo
            </p>
          </div>

          {/* Selector de pestañas: Iniciar Sesión / Registro */}
          <div className="mb-6 grid grid-cols-2 rounded-2xl bg-slate-100/80 p-1 border border-slate-200/60">
            <button
              type="button"
              onClick={() => {
                setTab('entrar');
                setError('');
                setExito('');
              }}
              className={`rounded-xl py-2 text-xs font-bold transition-all duration-200 ${
                tab === 'entrar'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('registro');
                setError('');
                setExito('');
              }}
              className={`rounded-xl py-2 text-xs font-bold transition-all duration-200 ${
                tab === 'registro'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Crear Cuenta
            </button>
          </div>

          {/* Formulario */}
          <form onSubmit={handleAuth} className="space-y-3.5">
            {tab === 'registro' && (
              <div className="relative">
                <div className="pointer-events-none absolute left-3.5 top-4 text-slate-400">
                  <User className="size-4" />
                </div>
                <input
                  id="nombre"
                  type="text"
                  placeholder=" "
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  className="peer w-full min-h-[50px] rounded-xl border border-slate-200/90 bg-white/95 pl-10 pr-4 pt-4 pb-1 text-sm text-slate-900 shadow-2xs outline-none transition-all duration-200 focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                />
                <label
                  htmlFor="nombre"
                  className="pointer-events-none absolute left-10 top-1 text-[11px] font-semibold text-slate-400 transition-all duration-200 peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:text-slate-400 peer-focus:top-1 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:text-indigo-600"
                >
                  Nombre completo
                </label>
              </div>
            )}

            {/* Input Correo */}
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
                className="peer w-full min-h-[50px] rounded-xl border border-slate-200/90 bg-white/95 pl-10 pr-4 pt-4 pb-1 text-sm text-slate-900 shadow-2xs outline-none transition-all duration-200 focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
              />
              <label
                htmlFor="correo"
                className="pointer-events-none absolute left-10 top-1 text-[11px] font-semibold text-slate-400 transition-all duration-200 peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:text-slate-400 peer-focus:top-1 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:text-indigo-600"
              >
                Correo electrónico
              </label>
            </div>

            {/* Input Contraseña */}
            <div className="relative">
              <div className="pointer-events-none absolute left-3.5 top-4 text-slate-400">
                <Lock className="size-4" />
              </div>
              <input
                id="clave"
                type={verClave ? 'text' : 'password'}
                autoComplete={tab === 'registro' ? 'new-password' : 'current-password'}
                placeholder=" "
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                required
                className="peer w-full min-h-[50px] rounded-xl border border-slate-200/90 bg-white/95 pl-10 pr-11 pt-4 pb-1 text-sm text-slate-900 shadow-2xs outline-none transition-all duration-200 focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
              />
              <label
                htmlFor="clave"
                className="pointer-events-none absolute left-10 top-1 text-[11px] font-semibold text-slate-400 transition-all duration-200 peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:text-slate-400 peer-focus:top-1 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:text-indigo-600"
              >
                Contraseña {tab === 'registro' && '(mín. 6 caracteres)'}
              </label>
              <button
                type="button"
                onClick={() => setVerClave(!verClave)}
                aria-label={verClave ? 'Ocultar contraseña' : 'Ver contraseña'}
                className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:scale-95 transition-all"
              >
                {verClave ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>

            {/* Confirmar contraseña en registro */}
            {tab === 'registro' && (
              <div className="relative">
                <div className="pointer-events-none absolute left-3.5 top-4 text-slate-400">
                  <ShieldCheck className="size-4" />
                </div>
                <input
                  id="repetirClave"
                  type={verClave ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder=" "
                  value={repetirClave}
                  onChange={(e) => setRepetirClave(e.target.value)}
                  required
                  className="peer w-full min-h-[50px] rounded-xl border border-slate-200/90 bg-white/95 pl-10 pr-4 pt-4 pb-1 text-sm text-slate-900 shadow-2xs outline-none transition-all duration-200 focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                />
                <label
                  htmlFor="repetirClave"
                  className="pointer-events-none absolute left-10 top-1 text-[11px] font-semibold text-slate-400 transition-all duration-200 peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:text-slate-400 peer-focus:top-1 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:text-indigo-600"
                >
                  Confirmar contraseña
                </label>
              </div>
            )}

            {/* Mensajes de error o éxito */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50/90 px-3.5 py-2.5 text-xs text-red-800 animate-in fade-in-50 duration-150">
                <AlertCircle className="size-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}
            {exito && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/90 px-3.5 py-2.5 text-xs text-emerald-800 animate-in fade-in-50 duration-150">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                <span>{exito}</span>
              </div>
            )}

            {/* Botón principal */}
            <button
              type="submit"
              disabled={cargando}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-3 text-sm font-bold text-white shadow-md shadow-indigo-600/25 transition-all duration-200 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cargando ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>{tab === 'registro' ? 'Creando cuenta…' : 'Iniciando sesión…'}</span>
                </>
              ) : (
                <span>{tab === 'registro' ? 'Crear mi cuenta en JuriProApp' : 'Iniciar sesión en JuriProApp'}</span>
              )}
            </button>
          </form>

          {/* Acceso directo a demostración */}
          <div className="mt-5 border-t border-slate-100 pt-4 text-center">
            <Link
              href="/criterio"
              className="group inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-800 transition-colors"
            >
              <Sparkles className="size-3.5 text-indigo-600 group-hover:scale-110 transition-transform" />
              <span>O explora la aplicación en modo demostración</span>
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Botón de instalación PWA */}
          <div className="mt-4 flex justify-center">
            <BotonInstalar />
          </div>
        </div>

        {/* Enlace al inicio de la app */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            ← Volver a la presentación de JuriProApp
          </Link>
        </div>
      </div>
    </div>
  );
}
