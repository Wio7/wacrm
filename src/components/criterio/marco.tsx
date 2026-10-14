'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BotonInstalar } from './instalar';
import { Bookmark, ChevronLeft, MessageSquare, Scale, Search, User } from 'lucide-react';

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
    <div className="flex min-h-dvh text-slate-900">
      {/* Sidebar de escritorio con glassmorphism */}
      <aside
        aria-label="Navegación principal"
        className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white/70 p-5 backdrop-blur-xl shadow-xs md:flex"
      >
        <div className="mb-7 flex items-center gap-3 px-2">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 text-white shadow-md shadow-indigo-600/20 ring-1 ring-white/30 transition-transform duration-200 hover:scale-105">
            <Scale className="size-5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black tracking-tight text-slate-900">
                Juri<span className="text-indigo-600">Pro</span>App
              </span>
              <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-indigo-700 uppercase">
                Legal
              </span>
            </div>
            <span className="text-xs text-slate-400">Jurisprudencia y Asistente IA</span>
          </div>
        </div>

        <nav role="navigation" aria-label="Secciones" className="space-y-1.5">
          {PESTANAS.map(({ href, label, Icono }) => {
            const activa = esActiva(ruta, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={activa ? 'page' : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                  activa
                    ? 'bg-gradient-to-r from-indigo-50 to-indigo-100/60 font-semibold text-indigo-700 shadow-xs ring-1 ring-indigo-200/60'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-950 active:scale-[0.99]'
                }`}
              >
                <Icono
                  className={`size-5 transition-transform duration-200 group-hover:scale-110 ${
                    activa ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-100">
          <BotonInstalar className="w-full justify-center" />
        </div>
      </aside>

      {/* Área de contenido central */}
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col md:max-w-3xl">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-md shadow-xs md:border-b md:border-slate-200/50 md:bg-white/70 md:px-8 md:py-4">
          {atras && (
            <button
              onClick={() => history.back()}
              className="flex size-10 -ml-1.5 items-center justify-center rounded-xl text-slate-600 transition-all duration-150 hover:bg-slate-100 hover:text-indigo-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
              aria-label="Volver atrás"
            >
              <ChevronLeft className="size-6" />
            </button>
          )}
          <h1 className="text-lg font-bold tracking-tight text-slate-900 md:text-2xl">
            {titulo}
          </h1>
          <BotonInstalar className="ml-auto md:hidden" />
        </header>

        <main className="flex-1 px-4 py-5 pb-28 md:px-8 md:py-6 md:pb-12">
          {children}
        </main>
      </div>

      {/* Barra de pestañas inferior para celular con efecto píldora activa */}
      <nav
        role="navigation"
        aria-label="Navegación móvil"
        className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-center justify-around border-t border-slate-200/80 bg-white/85 px-3 py-1.5 pb-[calc(0.4rem+env(safe-area-inset-bottom))] backdrop-blur-xl shadow-lg shadow-slate-900/10 md:hidden"
      >
        {PESTANAS.map(({ href, label, Icono }) => {
          const activa = esActiva(ruta, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={activa ? 'page' : undefined}
              className={`relative flex min-h-[48px] flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1 text-[11px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 active:scale-95 ${
                activa
                  ? 'bg-indigo-50/90 font-semibold text-indigo-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icono
                className={`size-5 transition-transform duration-200 ${
                  activa ? 'scale-110 text-indigo-600' : 'text-slate-400'
                }`}
              />
              <span className="leading-none">{label}</span>
              {activa && (
                <span className="absolute -bottom-1 h-0.5 w-6 rounded-full bg-indigo-600" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export const campo =
  'w-full min-h-[48px] rounded-xl border border-slate-200/90 bg-white/90 px-4 py-3 text-base text-slate-900 shadow-xs outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus-visible:outline-none';

export const boton =
  'inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-3 text-base font-semibold text-white shadow-sm shadow-indigo-600/20 transition-all duration-200 hover:from-indigo-500 hover:to-indigo-600 hover:shadow-md hover:shadow-indigo-600/25 active:scale-[0.99] active:from-indigo-700 active:to-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none';
