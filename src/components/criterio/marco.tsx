'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BotonInstalar } from './instalar';
import { Bookmark, MessageSquare, Search, User } from 'lucide-react';

const PESTANAS = [
  { href: '/criterio', label: 'Buscar', Icono: Search },
  { href: '/criterio/asistente', label: 'Asistente', Icono: MessageSquare },
  { href: '/criterio/guardados', label: 'Guardados', Icono: Bookmark },
  { href: '/criterio/cuenta', label: 'Cuenta', Icono: User },
];

function esActiva(ruta: string, href: string) {
  return href === '/criterio'
    ? ruta === href || ruta.startsWith('/criterio/r/')
    : ruta.startsWith(href);
}

/**
 * En el celular: encabezado arriba y pestañas abajo, como una app.
 * En la computadora: menú lateral a la izquierda y contenido más ancho.
 */
export function Marco({
  titulo,
  children,
  atras,
}: {
  titulo: string;
  children: React.ReactNode;
  atras?: boolean;
}) {
  const ruta = usePathname();
  return (
    <div className="flex min-h-dvh bg-slate-50 text-slate-900">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-700 text-lg font-bold text-white">
            C
          </div>
          <span className="text-lg font-bold">Criterio</span>
        </div>
        <nav className="space-y-1">
          {PESTANAS.map(({ href, label, Icono }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                esActiva(ruta, href)
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icono className="size-5" />
              {label}
            </Link>
          ))}
        </nav>
        <BotonInstalar className="mt-auto justify-center" />
      </aside>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col md:max-w-3xl">
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur md:border-none md:bg-slate-50/95 md:px-8 md:pt-6">
          {atras && (
            <button
              onClick={() => history.back()}
              className="-ml-1 rounded-full px-2 py-1 text-lg text-indigo-700"
              aria-label="Volver"
            >
              ‹
            </button>
          )}
          <h1 className="text-lg font-bold md:text-2xl">{titulo}</h1>
          <BotonInstalar className="ml-auto md:hidden" />
        </header>
        <main className="flex-1 px-4 py-4 pb-28 md:px-8 md:pb-10">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {PESTANAS.map(({ href, label, Icono }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] ${
              esActiva(ruta, href) ? 'text-indigo-700' : 'text-slate-500'
            }`}
          >
            <Icono className="size-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export const campo =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100';
export const boton =
  'w-full rounded-xl bg-indigo-700 px-4 py-3 text-base font-semibold text-white disabled:opacity-50 active:bg-indigo-800';
