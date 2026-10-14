'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Mail,
  ShieldCheck,
  User,
} from 'lucide-react';

import { boton, campo, Marco } from '@/components/criterio/marco';
import { createClient } from '@/lib/supabase/client';

export default function Cuenta() {
  const [correo, setCorreo] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string }>();
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setCorreo(data.user?.email ?? ''));
  }, []);

  async function cambiar(e: React.FormEvent) {
    e.preventDefault();
    if (nueva.length < 8) {
      setMensaje({ ok: false, texto: 'Usa al menos 8 caracteres.' });
      return;
    }
    if (nueva !== repetir) {
      setMensaje({ ok: false, texto: 'Las contraseñas no coinciden.' });
      return;
    }
    setCargando(true);
    const { error } = await createClient().auth.updateUser({
      password: nueva,
    });
    setCargando(false);
    if (error) {
      setMensaje({
        ok: false,
        texto:
          error.code === 'same_password'
            ? 'La nueva contraseña debe ser distinta de la actual.'
            : 'No se pudo cambiar. Intenta de nuevo.',
      });
      return;
    }
    setNueva('');
    setRepetir('');
    setMensaje({ ok: true, texto: 'Listo, tu contraseña se actualizó correctamente.' });
  }

  async function salir() {
    await createClient().auth.signOut();
    window.location.href = '/criterio/entrar';
  }

  const inicial = correo ? correo[0].toUpperCase() : 'U';

  return (
    <Marco titulo="Cuenta">
      <div className="space-y-6">
        {/* Tarjeta de perfil de usuario */}
        <section className="rounded-3xl border border-slate-200/90 bg-white/95 p-5 md:p-6 shadow-xs backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 text-xl font-bold text-white shadow-md shadow-indigo-600/20 ring-2 ring-white/50">
              {inicial}
            </div>
            <div className="space-y-0.5 overflow-hidden">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Sesión iniciada
              </span>
              <p className="truncate text-base font-bold text-slate-900">
                {correo || 'Cargando cuenta…'}
              </p>
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-medium text-slate-500">
                  Acceso activo
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Tarjeta de seguridad: cambio de contraseña */}
        <section className="rounded-3xl border border-slate-200/90 bg-white/95 p-5 md:p-6 shadow-xs backdrop-blur-sm">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="flex size-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <KeyRound className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-slate-900">
                Seguridad y Contraseña
              </h2>
              <p className="text-xs text-slate-400">
                Actualiza tu clave de acceso
              </p>
            </div>
          </div>

          <form onSubmit={cambiar} className="space-y-3.5">
            <div>
              <label
                htmlFor="nueva-clave"
                className="mb-1 block text-xs font-medium text-slate-600"
              >
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  id="nueva-clave"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  value={nueva}
                  onChange={(e) => setNueva(e.target.value)}
                  className={campo}
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="repetir-clave"
                className="mb-1 block text-xs font-medium text-slate-600"
              >
                Confirmar nueva contraseña
              </label>
              <div className="relative">
                <input
                  id="repetir-clave"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repite la contraseña"
                  value={repetir}
                  onChange={(e) => setRepetir(e.target.value)}
                  className={campo}
                  required
                />
              </div>
            </div>

            {/* Banner de alerta para mensajes */}
            {mensaje && (
              <div
                className={`flex items-start gap-2.5 rounded-2xl border p-3.5 text-xs animate-in fade-in-50 duration-150 ${
                  mensaje.ok
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-red-200 bg-red-50 text-red-900'
                }`}
              >
                {mensaje.ok ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="size-4 shrink-0 text-red-600 mt-0.5" />
                )}
                <span className="font-medium leading-relaxed">
                  {mensaje.texto}
                </span>
              </div>
            )}

            <button type="submit" className={boton} disabled={cargando}>
              {cargando ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Guardando cambios…</span>
                </>
              ) : (
                <span>Guardar contraseña</span>
              )}
            </button>
          </form>
        </section>

        {/* Tarjeta de acción peligrosa: Cerrar sesión */}
        <section className="rounded-3xl border border-slate-200/90 bg-white/95 p-5 md:p-6 shadow-xs backdrop-blur-sm">
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Cerrar sesión en este dispositivo
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Tendrás que ingresar nuevamente con tus credenciales.
              </p>
            </div>

            <button
              type="button"
              onClick={salir}
              aria-label="Cerrar sesión de la cuenta"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-2.5 text-sm font-semibold text-rose-700 shadow-2xs transition-all duration-200 hover:border-rose-300 hover:bg-rose-100 hover:text-rose-800 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <LogOut className="size-4" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </section>
      </div>
    </Marco>
  );
}
