'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bookmark, MessageSquare, Search, User } from 'lucide-react';

const PESTANAS = [
  { href: '/criterio', label: 'Buscar', Icono: Search },
  { href: '/criterio/asistente', label: 'Asistente', Icono: MessageSquare },
  { href: '/criterio/guardados', label: 'Guardados', Icono: Bookmark },
  { href: '/criterio/cuenta', label: 'Cuenta', Icono: User },
];

/** Encabezado, contenido y barra de pestañas abajo, como una app. */
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
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        {atras && (
          <button
            onClick={() => history.back()}
            className="-ml-1 rounded-full px-2 py-1 text-lg text-indigo-700"
            aria-label="Volver"
          >
            ‹
          </button>
        )}
        <h1 className="text-lg font-bold">{titulo}</h1>
      </header>
      <main className="flex-1 px-4 py-4 pb-28">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        {PESTANAS.map(({ href, label, Icono }) => {
          const activa =
            href === '/criterio'
              ? ruta === href || ruta.startsWith('/criterio/r/')
              : ruta.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] ${
                activa ? 'text-indigo-700' : 'text-slate-500'
              }`}
            >
              <Icono className="size-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export const campo =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100';
export const boton =
  'w-full rounded-xl bg-indigo-700 px-4 py-3 text-base font-semibold text-white disabled:opacity-50 active:bg-indigo-800';
