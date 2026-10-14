'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUp,
  Bot,
  ExternalLink,
  Info,
  Loader2,
  Scale,
  Sparkles,
} from 'lucide-react';

import { api, titulo, type Resumen } from '@/components/criterio/api';
import { Marco } from '@/components/criterio/marco';

type Cita = Resumen & { cita: string };
interface Respuesta {
  respuesta: string;
  citas: Cita[];
  aviso: string;
}

interface MensajeChat {
  p: string;
  r: Respuesta;
  hora: string;
}

const PREGUNTAS_SUGERIDAS = [
  '¿Cuándo procede la nulidad de un acto jurídico por simulación?',
  '¿Cuáles son los requisitos de la prescripción adquisitiva?',
  '¿Cómo se acredita el daño moral en el ámbito laboral?',
  '¿Qué causales sustentan un despido fraudulento o incausado?',
];

/** El texto trae marcas [RES:<id>]; cada una se vuelve un enlace estilizado. */
function Texto({ texto, citas }: { texto: string; citas: Cita[] }) {
  const porId = new Map(citas.map((c) => [c.id, c]));
  return (
    <div className="text-[15px] leading-relaxed whitespace-pre-wrap text-slate-800">
      {texto.split(/(\[RES:[^\]]+\])/).map((parte, i) => {
        const id = parte.match(/^\[RES:([^\]]+)\]$/)?.[1];
        if (!id) return parte;
        const c = porId.get(id);
        return c ? (
          <Link
            key={i}
            href={`/criterio/r/${c.id}`}
            className="inline-flex items-center gap-1 mx-1 my-0.5 rounded-lg border border-indigo-200 bg-indigo-50/90 px-2 py-0.5 text-xs font-semibold text-indigo-700 shadow-2xs hover:bg-indigo-100 hover:border-indigo-300 transition-colors"
          >
            <Scale className="size-3 text-indigo-600" />
            <span>{titulo(c)}</span>
            <ExternalLink className="size-2.5 opacity-60" />
          </Link>
        ) : null;
      })}
    </div>
  );
}

export default function Asistente() {
  const [pregunta, setPregunta] = useState('');
  const [hilo, setHilo] = useState<MensajeChat[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const finMensajesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    finMensajesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [hilo, cargando]);

  function formatearHoraActual() {
    return new Date().toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async function enviarPregunta(textoPregunta: string) {
    const p = textoPregunta.trim();
    if (p.length < 5 || cargando) return;
    setCargando(true);
    setError('');
    try {
      const r = await api<Respuesta>('asistente', {
        method: 'POST',
        body: JSON.stringify({ pregunta: p }),
      });
      setHilo((h) => [...h, { p, r, hora: formatearHoraActual() }]);
      setPregunta('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    enviarPregunta(pregunta);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarPregunta(pregunta);
    }
  }

  function seleccionarSugerencia(s: string) {
    setPregunta(s);
    enviarPregunta(s);
  }

  return (
    <Marco titulo="Asistente Legal">
      <div className="flex flex-col space-y-5 pb-6">
        {/* Estado inicial cuando el hilo está vacío */}
        {hilo.length === 0 && (
          <div className="space-y-6 pt-2">
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-indigo-50/40 p-5 shadow-xs">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-sm shadow-indigo-600/25">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Asistente de Jurisprudencia
                  </h2>
                  <p className="text-xs text-slate-500">
                    Respuestas con citas jurisprudenciales exactas
                  </p>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-slate-600">
                Formula consultas jurídicas en lenguaje natural. El asistente busca directamente en la base de sentencias, precedentes y plenos casatorios para fundamentar cada respuesta.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 px-1 text-xs font-semibold text-slate-600">
                <Bot className="size-3.5 text-indigo-600" />
                <span>Preguntas sugeridas</span>
              </div>
              <div className="grid gap-2">
                {PREGUNTAS_SUGERIDAS.map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => seleccionarSugerencia(sug)}
                    className="flex items-start text-left gap-2.5 rounded-xl border border-slate-200/80 bg-white/90 p-3.5 text-xs text-slate-700 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-900 hover:shadow-xs active:scale-[0.99] active:bg-indigo-100/50"
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-700 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-snug">{sug}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Hilo de conversación */}
        {hilo.map(({ p, r, hora }, i) => (
          <div key={i} className="space-y-3">
            {/* Mensaje del usuario */}
            <div className="flex flex-col items-end">
              <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-3 text-[15px] font-normal leading-relaxed text-white shadow-sm shadow-indigo-600/15">
                {p}
              </div>
              <span className="mt-1 px-1 text-[11px] text-slate-400">
                {hora}
              </span>
            </div>

            {/* Respuesta de la IA */}
            <div className="flex items-start gap-2.5 max-w-[96%]">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-700 ring-1 ring-indigo-200/50 shadow-2xs mt-0.5">
                <Bot className="size-4" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="rounded-2xl rounded-tl-xs border border-slate-200/80 bg-white/95 p-4 shadow-xs backdrop-blur-xs">
                  <Texto texto={r.respuesta} citas={r.citas} />

                  {r.aviso && (
                    <div className="mt-3.5 flex items-start gap-2 rounded-xl bg-amber-50/70 p-2.5 text-xs text-amber-800 border border-amber-200/60">
                      <Info className="size-3.5 shrink-0 text-amber-600 mt-0.5" />
                      <span>{r.aviso}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 px-1 text-[11px] text-slate-400 font-medium">
                  <span>Asistente Criterio</span>
                  <span>·</span>
                  <span>{r.citas?.length ?? 0} {r.citas?.length === 1 ? 'cita legal' : 'citas legales'}</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Indicador de escritura animado */}
        {cargando && (
          <div className="flex items-start gap-2.5 animate-in fade-in-50 duration-200">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-700 ring-1 ring-indigo-200/50 shadow-2xs">
              <Bot className="size-4" />
            </div>
            <div className="rounded-2xl rounded-tl-xs border border-slate-200/80 bg-white/95 px-4 py-3 shadow-xs">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:-0.3s]" />
                <span className="size-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:-0.15s]" />
                <span className="size-2 rounded-full bg-indigo-600 animate-bounce" />
                <span className="ml-2 text-xs font-medium text-slate-500">
                  Revisando jurisprudencia relevante…
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Error en el chat */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50/70 p-3.5 text-xs text-red-800">
            <AlertCircle className="size-4 shrink-0 text-red-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div ref={finMensajesRef} />

        {/* Formulario de entrada con botón de envío moderno */}
        <form onSubmit={handleSubmit} className="relative pt-2">
          <div className="relative rounded-2xl border border-slate-200/90 bg-white/95 shadow-xs transition-all duration-200 focus-within:border-indigo-600 focus-within:ring-4 focus-within:ring-indigo-500/10">
            <textarea
              ref={textareaRef}
              rows={3}
              placeholder="Pregunta sobre algún criterio o caso legal…"
              value={pregunta}
              onChange={(e) => setPregunta(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={cargando}
              className="w-full resize-none bg-transparent p-3.5 pr-14 text-sm text-slate-900 placeholder:text-slate-400 outline-none disabled:opacity-50"
            />
            <div className="flex items-center justify-between border-t border-slate-100/80 px-3 py-2 bg-slate-50/50 rounded-b-2xl">
              <span className="text-[11px] text-slate-400">
                Presiona <kbd className="rounded bg-slate-200/70 px-1 py-0.5 font-sans">Enter ↵</kbd> para enviar
              </span>
              <button
                type="submit"
                disabled={cargando || pregunta.trim().length < 5}
                aria-label="Enviar pregunta al asistente"
                className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-xs shadow-indigo-600/20 transition-all duration-150 hover:from-indigo-500 hover:to-indigo-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                {cargando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4 stroke-[2.5]" />
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Marco>
  );
}
