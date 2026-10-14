'use client';

import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';

interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const INSTALADA = 'criterio-instalada';

function yaInstalada(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if ((navigator as { standalone?: boolean }).standalone) return true;
  try {
    return localStorage.getItem(INSTALADA) === '1';
  } catch {
    return false;
  }
}

function marcarInstalada() {
  try {
    localStorage.setItem(INSTALADA, '1');
  } catch {}
}

/**
 * Botón "Descargar app". Aparece en el navegador y desaparece cuando la
 * app ya está instalada (o cuando se abre desde el ícono instalado).
 * En iPhone no hay instalación automática: muestra cómo hacerlo a mano.
 */
export function BotonInstalar({ className = '' }: { className?: string }) {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [ios, setIos] = useState(false);
  const [visible, setVisible] = useState(false);
  const [ayuda, setAyuda] = useState(false);

  useEffect(() => {
    navigator.serviceWorker
      ?.register('/criterio-sw.js', { scope: '/criterio' })
      .catch(() => {});
    if (yaInstalada()) return;

    const esIos =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !/crios|fxios/i.test(navigator.userAgent);
    // En iPhone no llega beforeinstallprompt: se muestra desde el inicio.
    const mostrarIos = setTimeout(() => {
      setIos(esIos);
      setVisible(esIos);
    }, 0);

    const alOfrecer = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
      setVisible(true);
    };
    const alInstalar = () => {
      marcarInstalada();
      setVisible(false);
    };
    window.addEventListener('beforeinstallprompt', alOfrecer);
    window.addEventListener('appinstalled', alInstalar);
    return () => {
      clearTimeout(mostrarIos);
      window.removeEventListener('beforeinstallprompt', alOfrecer);
      window.removeEventListener('appinstalled', alInstalar);
    };
  }, []);

  if (!visible) return null;

  async function instalar() {
    if (ios) {
      setAyuda(true);
      return;
    }
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    if (outcome === 'accepted') {
      marcarInstalada();
      setVisible(false);
    }
    setEvento(null);
  }

  return (
    <>
      <button
        onClick={instalar}
        className={`inline-flex items-center gap-1.5 rounded-full bg-indigo-700 px-3 py-1.5 text-sm font-semibold text-white active:bg-indigo-800 ${className}`}
      >
        <Download className="size-4" />
        Descargar app
      </button>
      {ayuda && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center"
          onClick={() => setAyuda(false)}
        >
          <div className="w-full rounded-t-2xl bg-white p-6 text-slate-800 sm:max-w-sm sm:rounded-2xl">
            <h2 className="text-lg font-bold">Instalar en iPhone</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px]">
              <li>
                Toca el botón <b>Compartir</b> (el cuadrado con la flecha) de
                Safari.
              </li>
              <li>
                Elige <b>Agregar a pantalla de inicio</b>.
              </li>
              <li>
                Toca <b>Agregar</b>. Criterio aparecerá con su ícono.
              </li>
            </ol>
            <button
              onClick={() => {
                marcarInstalada();
                setVisible(false);
              }}
              className="mt-5 w-full rounded-xl bg-indigo-700 px-4 py-3 font-semibold text-white"
            >
              Ya la agregué
            </button>
          </div>
        </div>
      )}
    </>
  );
}
