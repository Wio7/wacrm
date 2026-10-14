'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Scale,
  Sparkles,
  Search,
  BookOpen,
  Bookmark,
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  User,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Smartphone,
  ExternalLink,
  Copy,
  Check,
  FileText,
  Gavel,
  ChevronRight,
  Flame,
} from 'lucide-react';
import { BotonInstalar } from '@/components/criterio/instalar';
import { createClient } from '@/lib/supabase/client';

export default function JuriProAppHome() {
  const [tabAuth, setTabAuth] = useState<'registro' | 'login'>('registro');
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [errorAuth, setErrorAuth] = useState('');
  const [exitoAuth, setExitoAuth] = useState('');
  const [cargandoAuth, setCargandoAuth] = useState(false);

  // Estados de la Demostración Interactiva
  const [demoPestana, setDemoPestana] = useState<'buscador' | 'asistente' | 'ficha'>('buscador');
  const [demoQuery, setDemoQuery] = useState('Nulidad de acto jurídico por simulación');
  const [demoFiltro, setDemoFiltro] = useState<'civil' | 'laboral' | 'penal'>('civil');
  const [demoCopied, setDemoCopied] = useState(false);
  const [demoAsistentePregunta, setDemoAsistentePregunta] = useState('');
  const [demoAsistenteRespuesta, setDemoAsistenteRespuesta] = useState<string | null>(null);
  const [demoPensando, setDemoPensando] = useState(false);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setErrorAuth('');
    setExitoAuth('');
    setCargandoAuth(true);

    const supabase = createClient();
    const emailNorm = correo.trim().toLowerCase();

    if (tabAuth === 'registro') {
      if (clave.length < 6) {
        setErrorAuth('La contraseña debe tener mínimo 6 caracteres.');
        setCargandoAuth(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: emailNorm,
        password: clave,
        options: {
          data: {
            full_name: nombre.trim(),
            app: 'juripro',
          },
        },
      });

      if (error) {
        setErrorAuth(error.message || 'Error al crear la cuenta.');
        setCargandoAuth(false);
        return;
      }

      if (data.session) {
        setExitoAuth('¡Cuenta creada! Entrando a JuriProApp...');
        setTimeout(() => {
          window.location.href = '/criterio';
        }, 1000);
      } else {
        setExitoAuth('Cuenta registrada con éxito. Ya puedes iniciar sesión o explorar la demo.');
        setCargandoAuth(false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: emailNorm,
        password: clave,
      });

      if (error) {
        setErrorAuth('Correo o contraseña incorrectos.');
        setCargandoAuth(false);
        return;
      }

      window.location.href = '/criterio';
    }
  }

  function ejecutarPreguntaDemo(p: string) {
    setDemoAsistentePregunta(p);
    setDemoPensando(true);
    setDemoAsistenteRespuesta(null);

    setTimeout(() => {
      setDemoPensando(false);
      if (p.includes('simulación')) {
        setDemoAsistenteRespuesta(
          'Conforme a la Casación N.° 2187-2022 Lima (Sala Civil Transitoria), la nulidad por simulación absoluta procede cuando las partes conciertan deliberadamente celebrar un acto aparente sin voluntad real de producir efectos jurídicos entre sí. El órgano jurisdiccional debe valorar los indicios (precio irrisorio, parentesco cercano, retención de la posesión por el vendedor) bajo la regla del Art. 219 inc. 5 del Código Civil.'
        );
      } else if (p.includes('despido')) {
        setDemoAsistenteRespuesta(
          'Según el Precedente Vinculante Cas. Lab. N.° 1459-2021 del Callao, el despido incausado se configura cuando se extingue el vínculo laboral sin expresar causa justa prevista en la ley. Da derecho a la reposición laboral si el trabajador laboró más de 4 horas diarias y superó el período de prueba (Art. 22 del D.S. 003-97-TR), o al pago acumulado de indemnización tarifada.'
        );
      } else {
        setDemoAsistenteRespuesta(
          'De acuerdo con la jurisprudencia de la Corte Suprema, las medidas cautelares requieren la concurrencia copulativa de verosimilitud en el derecho (fumus boni iuris), peligro en la demora (periculum in mora) y adecuación razonable del petitorio cautelar respecto a la pretensión principal.'
        );
      }
    }, 700);
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 selection:bg-indigo-500/30 selection:text-white">
      {/* Fondo ambiental decorativo */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 size-[500px] rounded-full bg-indigo-600/20 blur-[130px]" />
        <div className="absolute top-1/2 -left-40 size-[500px] rounded-full bg-violet-600/15 blur-[140px]" />
        <div className="absolute -bottom-40 right-1/4 size-[500px] rounded-full bg-indigo-500/15 blur-[130px]" />
      </div>

      {/* Navegación Superior de JuriProApp */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-white/20">
              <Scale className="size-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black tracking-tight text-white">
                  Juri<span className="text-indigo-400">Pro</span>App
                </span>
                <span className="rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300 uppercase tracking-wider border border-indigo-500/30">
                  Legal
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Jurisprudencia y Asistente IA</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <BotonInstalar className="hidden sm:inline-flex" />
            <Link
              href="/criterio"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-md shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95"
            >
              <span>Abrir App</span>
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section & Formulario de Acceso Directo */}
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-14">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
          {/* Columna Izquierda: Presentación y Beneficios */}
          <div className="space-y-6 lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300 backdrop-blur-sm">
              <Sparkles className="size-3.5 text-indigo-400" />
              <span>Inteligencia Artificial para Abogados y Litigantes</span>
            </div>

            <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl lg:leading-tight">
              Toda la jurisprudencia en tu bolsillo.{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-indigo-300 to-violet-400 bg-clip-text text-transparent">
                Respaldada por IA.
              </span>
            </h1>

            <p className="text-base text-slate-300 sm:text-lg leading-relaxed max-w-2xl">
              Busca casaciones, plenos casatorios y precedentes vinculantes de la Corte Suprema. Formula consultas en lenguaje natural y copia citas jurídicas precisas para tus alegatos en segundos.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-3.5 backdrop-blur-sm">
                <Search className="size-5 text-indigo-400 mb-2" />
                <h2 className="text-sm font-bold text-white">Buscador Rápido</h2>
                <p className="text-xs text-slate-400 mt-0.5">Por número de casación, tema o artículo del código.</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-3.5 backdrop-blur-sm">
                <Sparkles className="size-5 text-violet-400 mb-2" />
                <h2 className="text-sm font-bold text-white">Asistente IA</h2>
                <p className="text-xs text-slate-400 mt-0.5">Respuestas con citas reales del catálogo jurisprudencial.</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-800/40 p-3.5 backdrop-blur-sm">
                <Smartphone className="size-5 text-emerald-400 mb-2" />
                <h2 className="text-sm font-bold text-white">Móvil & Web</h2>
                <p className="text-xs text-slate-400 mt-0.5">Instálala en iPhone o Android como PWA nativa.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="#demostracion"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:border-slate-600"
              >
                <span>Ver demostración en vivo</span>
                <ChevronRight className="size-4" />
              </a>
              <Link
                href="/criterio"
                className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
              >
                <span>Probar la app directamente →</span>
              </Link>
            </div>
          </div>

          {/* Columna Derecha: Tarjeta de Registro / Login Propio de JuriProApp */}
          <div className="lg:col-span-5">
            <div className="rounded-3xl border border-slate-700/80 bg-slate-800/70 p-6 shadow-2xl backdrop-blur-xl ring-1 ring-white/10 sm:p-7">
              {/* Header de la tarjeta */}
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-white">
                    {tabAuth === 'registro' ? 'Crear cuenta en JuriProApp' : 'Iniciar sesión'}
                  </h2>
                  <p className="text-xs text-slate-400">Tu espacio legal personalizado</p>
                </div>
                <div className="flex rounded-xl bg-slate-900/80 p-1 border border-slate-700/60">
                  <button
                    type="button"
                    onClick={() => {
                      setTabAuth('registro');
                      setErrorAuth('');
                      setExitoAuth('');
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                      tabAuth === 'registro'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Registro
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTabAuth('login');
                      setErrorAuth('');
                      setExitoAuth('');
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                      tabAuth === 'login'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Entrar
                  </button>
                </div>
              </div>

              {/* Formulario */}
              <form onSubmit={handleAuth} className="space-y-3.5">
                {tabAuth === 'registro' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">
                      Nombre completo
                    </label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-500" />
                      <input
                        type="text"
                        required
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        placeholder="Dra. María Rodríguez"
                        className="w-full rounded-xl border border-slate-700 bg-slate-900/80 pl-9 pr-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      placeholder="abogado@estudiojuridico.com"
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/80 pl-9 pr-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    Contraseña {tabAuth === 'registro' && '(mín. 6 caracteres)'}
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-3.5 size-4 text-slate-500" />
                    <input
                      type={verClave ? 'text' : 'password'}
                      required
                      value={clave}
                      onChange={(e) => setClave(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/80 pl-9 pr-10 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setVerClave(!verClave)}
                      aria-label={verClave ? 'Ocultar contraseña' : 'Ver contraseña'}
                      className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                    >
                      {verClave ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {errorAuth && (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{errorAuth}</span>
                  </div>
                )}

                {exitoAuth && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>{exitoAuth}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={cargandoAuth}
                  className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:from-indigo-500 hover:to-indigo-600 active:scale-98 disabled:opacity-50"
                >
                  {cargandoAuth ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      Procesando…
                    </span>
                  ) : tabAuth === 'registro' ? (
                    'Registrarme en JuriProApp'
                  ) : (
                    'Entrar a JuriProApp'
                  )}
                </button>
              </form>

              <div className="mt-4 border-t border-slate-700/60 pt-4 text-center">
                <Link
                  href="/criterio"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <Sparkles className="size-3.5" />
                  <span>Entrar sin cuenta en modo prueba</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN DEMOSTRACIÓN INTERACTIVA DE CÓMO ES LA APLICACIÓN */}
        <section id="demostracion" className="mt-20 scroll-mt-20">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300 mb-3">
              <Gavel className="size-3.5 text-indigo-400" />
              <span>Demostración en Vivo</span>
            </div>
            <h2 className="text-2xl font-black text-white sm:text-4xl">
              Descubre cómo funciona JuriProApp por dentro
            </h2>
            <p className="mt-2 text-sm text-slate-400 max-w-xl mx-auto">
              Experimenta la interfaz táctil, el motor de búsqueda y el asistente jurídico de inteligencia artificial en esta simulación interactiva.
            </p>

            {/* Pestañas del Simulador Demo */}
            <div className="mt-6 flex justify-center">
              <div className="inline-flex rounded-2xl bg-slate-800/90 p-1.5 border border-slate-700 shadow-xl">
                <button
                  type="button"
                  onClick={() => setDemoPestana('buscador')}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all ${
                    demoPestana === 'buscador'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Search className="size-4" />
                  <span>1. Buscador de Casaciones</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDemoPestana('asistente')}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all ${
                    demoPestana === 'asistente'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="size-4 text-violet-300" />
                  <span>2. Asistente IA Jurídico</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDemoPestana('ficha')}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all ${
                    demoPestana === 'ficha'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="size-4" />
                  <span>3. Ficha y Cita Oficial</span>
                </button>
              </div>
            </div>
          </div>

          {/* Marco del Simulador (Mockup de App) */}
          <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-800/90 shadow-2xl backdrop-blur-xl">
            {/* Barra superior de la app demo */}
            <div className="flex items-center justify-between border-b border-slate-700/70 bg-slate-900/90 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-xs">
                  <Scale className="size-3.5" />
                </div>
                <span className="font-bold text-sm text-white">JuriProApp Demo</span>
                <span className="rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 border border-emerald-500/30">
                  En línea
                </span>
              </div>
              <Link
                href="/criterio"
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <span>Probar en pantalla completa</span>
                <ExternalLink className="size-3" />
              </Link>
            </div>

            {/* Contenido según pestaña demo */}
            <div className="p-5 sm:p-7 min-h-[380px]">
              {demoPestana === 'buscador' && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-slate-400" />
                    <input
                      type="text"
                      value={demoQuery}
                      onChange={(e) => setDemoQuery(e.target.value)}
                      placeholder="Casación, artículo o tema…"
                      className="w-full rounded-2xl border border-slate-600 bg-slate-900/90 pl-10 pr-4 py-3 text-sm text-white shadow-inner focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Filtros rápidos tocables */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="text-slate-400 self-center">Materia:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setDemoFiltro('civil');
                        setDemoQuery('Casación 2187-2022 Lima');
                      }}
                      className={`rounded-full px-3 py-1 font-medium transition-all ${
                        demoFiltro === 'civil'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Civil (Acto Jurídico)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDemoFiltro('laboral');
                        setDemoQuery('Despido incausado indemnización');
                      }}
                      className={`rounded-full px-3 py-1 font-medium transition-all ${
                        demoFiltro === 'laboral'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Laboral (Despido)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDemoFiltro('penal');
                        setDemoQuery('Prueba indiciaria y motivación');
                      }}
                      className={`rounded-full px-3 py-1 font-medium transition-all ${
                        demoFiltro === 'penal'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Penal (Prueba)
                    </button>
                  </div>

                  {/* Resultado simulado con alta estética */}
                  <div className="rounded-2xl border border-indigo-500/30 bg-slate-900/80 p-4 shadow-lg transition-all hover:border-indigo-500/60">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300 uppercase">
                        {demoFiltro === 'civil'
                          ? 'Casación N.° 2187-2022'
                          : demoFiltro === 'laboral'
                          ? 'Cas. Lab. N.° 1459-2021'
                          : 'R.N. N.° 980-2020'}
                      </span>
                      <span className="text-xs text-slate-400">Sala Suprema · Corte Suprema</span>
                    </div>

                    <h3 className="mt-2 text-base font-bold text-white">
                      {demoFiltro === 'civil'
                        ? 'Simulación absoluta: acreditación mediante indicios concordantes'
                        : demoFiltro === 'laboral'
                        ? 'Despido incausado y derecho a reposición en el régimen 728'
                        : 'Valoración de la prueba indiciaria y debida motivación'}
                    </h3>

                    <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                      {demoFiltro === 'civil'
                        ? 'La simulación absoluta requiere verificar la divergencia consciente entre la voluntad real y la manifestada. No es exigible prueba directa, siendo idónea la prueba indiciaria basada en precio vil y continuidad en la posesión.'
                        : demoFiltro === 'laboral'
                        ? 'El despido incausado se configura cuando se despide al trabajador de manera verbal o mediante comunicación escrita sin imputarle causa justa contemplada en la ley.'
                        : 'Para enervar la presunción de inocencia a través de la prueba indiciaria se requiere que los hechos base estén plenamente acreditados y no sean meras sospechas.'}
                    </p>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3 text-xs">
                      <span className="text-slate-400 font-mono">Art. 219 inc. 5 C.C.</span>
                      <button
                        type="button"
                        onClick={() => setDemoPestana('ficha')}
                        className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                      >
                        Ver ficha completa →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {demoPestana === 'asistente' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400">
                    Haz clic en una pregunta jurídica para ver cómo responde el Asistente IA de JuriProApp:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        ejecutarPreguntaDemo('¿Cuándo procede la nulidad por simulación absoluta?')
                      }
                      className="rounded-xl border border-slate-700 bg-slate-900/60 p-2.5 text-left text-xs text-slate-200 hover:border-indigo-500 hover:text-white transition-all"
                    >
                      💡 ¿Cuándo procede la nulidad por simulación absoluta?
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        ejecutarPreguntaDemo('¿Qué exige la indemnización por despido incausado?')
                      }
                      className="rounded-xl border border-slate-700 bg-slate-900/60 p-2.5 text-left text-xs text-slate-200 hover:border-indigo-500 hover:text-white transition-all"
                    >
                      ⚖️ ¿Qué exige la indemnización por despido incausado?
                    </button>
                  </div>

                  {demoPensando && (
                    <div className="flex items-center gap-2 rounded-2xl bg-indigo-950/40 p-3.5 border border-indigo-500/30 text-xs text-indigo-300">
                      <Loader2 className="size-4 animate-spin text-indigo-400" />
                      <span>Revisando jurisprudencia y precedentes de la Corte Suprema…</span>
                    </div>
                  )}

                  {demoAsistenteRespuesta && (
                    <div className="rounded-2xl border border-violet-500/30 bg-slate-900/90 p-4 shadow-xl animate-in fade-in-50 duration-300">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex size-6 items-center justify-center rounded-lg bg-violet-600 text-white">
                          <Sparkles className="size-3.5" />
                        </div>
                        <span className="text-xs font-bold text-violet-300">
                          Respuesta de JuriProApp IA
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                        {demoAsistenteRespuesta}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {demoPestana === 'ficha' && (
                <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-xs text-indigo-400 font-mono">CASACIÓN N.° 2187-2022 LIMA</span>
                      <h4 className="text-sm font-bold text-white">Sala Civil Permanente</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          'Casación N.° 2187-2022 Lima, Sala Civil Permanente de la Corte Suprema de Justicia de la República del Perú.'
                        );
                        setDemoCopied(true);
                        setTimeout(() => setDemoCopied(false), 2000);
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-indigo-600/20 border border-indigo-500/40 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/30 transition-all"
                    >
                      {demoCopied ? (
                        <>
                          <Check className="size-3.5 text-emerald-400" />
                          <span className="text-emerald-300">Cita copiada</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" />
                          <span>Copiar Cita</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div>
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Criterio Jurídico Vinculante
                    </h5>
                    <p className="mt-1 text-xs text-slate-200 leading-relaxed">
                      «La simulación no requiere prueba instrumental directa; los magistrados deben evaluar el haz de indicios contingentes, tales como la ausencia de entrega de dinero y el vínculo afectivo de los contratantes.»
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 text-xs">
                    <span className="rounded-md bg-emerald-500/20 text-emerald-400 font-semibold px-2 py-0.5 border border-emerald-500/30">
                      Fallo: Fundada
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-400">PDF original anexado</span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer de la demostración */}
            <div className="border-t border-slate-700/70 bg-slate-900/90 p-4 text-center">
              <Link
                href="/criterio"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 hover:scale-105 active:scale-95 transition-all"
              >
                <span>Entrar a JuriProApp Completa</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Pie de página de JuriProApp y enlace privado al CRM */}
      <footer className="mt-20 border-t border-slate-800 bg-slate-950/80 py-8 px-4 text-center text-xs text-slate-400">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Scale className="size-4 text-indigo-400" />
            <span className="font-semibold text-slate-300">JuriProApp © 2026</span>
            <span>— Todos los derechos reservados.</span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/criterio" className="text-indigo-400 hover:text-indigo-300">
              App Móvil y Web
            </Link>
            <span>·</span>
            {/* Acceso privado y separado exclusivamente para Bryce y Cristian */}
            <Link
              href="/login"
              className="text-slate-400 hover:text-slate-200 transition-colors"
              title="Panel exclusivo para administradores de cuenta"
            >
              Acceso Privado CRM Wio
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
