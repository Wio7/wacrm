'use client';

import { useEffect, useState } from 'react';

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
    setMensaje({ ok: true, texto: 'Listo, tu contraseña se actualizó.' });
  }

  async function salir() {
    await createClient().auth.signOut();
    window.location.href = '/criterio/entrar';
  }

  return (
    <Marco titulo="Cuenta">
      <p className="text-sm text-slate-500">Entraste como</p>
      <p className="font-medium">{correo}</p>

      <form onSubmit={cambiar} className="mt-6 space-y-3">
        <h2 className="font-semibold">Cambiar contraseña</h2>
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Nueva contraseña"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          className={campo}
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Repite la nueva contraseña"
          value={repetir}
          onChange={(e) => setRepetir(e.target.value)}
          className={campo}
        />
        {mensaje && (
          <p
            className={`text-sm ${mensaje.ok ? 'text-emerald-700' : 'text-red-600'}`}
          >
            {mensaje.texto}
          </p>
        )}
        <button className={boton} disabled={cargando}>
          {cargando ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>

      <button
        onClick={salir}
        className="mt-10 w-full rounded-xl border border-slate-300 px-4 py-3 font-medium text-slate-700"
      >
        Cerrar sesión
      </button>
    </Marco>
  );
}
