'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Loader2,
  Save,
  TriangleAlert,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/lib/supabase/client';
import {
  BUCKET_PDFS,
  FALLOS,
  NOMBRE_ESTADO,
  NOMBRE_FALLO,
  NOMBRE_TIPO,
  TIPOS_RESOLUCION,
  type Resolucion,
  type Tema,
} from '@/lib/juris/tipos';

/** Los campos de la ficha, como texto de formulario. */
interface Ficha {
  tipo: string;
  numero: string;
  anio: string;
  procedencia: string;
  sala: string;
  fecha: string;
  fallo: string;
  sumilla: string;
  criterio: string;
  hechos: string;
  articulos: string;
  url_fuente: string;
}

const aFicha = (r: Resolucion): Ficha => ({
  tipo: r.tipo ?? '',
  numero: r.numero ?? '',
  anio: r.anio?.toString() ?? '',
  procedencia: r.procedencia ?? '',
  sala: r.sala ?? '',
  fecha: r.fecha ?? '',
  fallo: r.fallo ?? '',
  sumilla: r.sumilla ?? '',
  criterio: r.criterio ?? '',
  hechos: r.hechos ?? '',
  articulos: r.articulos.join('\n'),
  url_fuente: r.url_fuente ?? '',
});

const oNull = (s: string) => (s.trim() ? s.trim() : null);

const deFicha = (f: Ficha) => ({
  tipo: oNull(f.tipo),
  numero: oNull(f.numero),
  anio: f.anio.trim() ? Number(f.anio) : null,
  procedencia: oNull(f.procedencia),
  sala: oNull(f.sala),
  fecha: oNull(f.fecha),
  fallo: oNull(f.fallo),
  sumilla: oNull(f.sumilla),
  criterio: oNull(f.criterio),
  hechos: oNull(f.hechos),
  articulos: f.articulos
    .split('\n')
    .map((a) => a.trim())
    .filter(Boolean),
  url_fuente: oNull(f.url_fuente),
});

const SELECT =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

export function Revision({ id }: { id: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [resolucion, setResolucion] = useState<Resolucion | null>(null);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [temas, setTemas] = useState<Tema[]>([]);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [principal, setPrincipal] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [ocupado, setOcupado] = useState<
    'guardar' | 'publicar' | 'rechazar' | null
  >(null);

  const cargar = useCallback(async () => {
    const [res, arbol, asignados] = await Promise.all([
      supabase
        .from('juris_resoluciones')
        .select('*')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('juris_temas')
        .select('id, parent_id, slug, nombre, descripcion, orden')
        .order('orden'),
      supabase
        .from('juris_resolucion_temas')
        .select('tema_id, principal')
        .eq('resolucion_id', id),
    ]);
    if (res.error || !res.data) {
      setNoExiste(true);
      return;
    }
    const r = res.data as Resolucion;
    setResolucion(r);
    setFicha(aFicha(r));
    setTemas((arbol.data ?? []) as Tema[]);
    const filas = asignados.data ?? [];
    setElegidos(filas.map((f) => f.tema_id as string));
    setPrincipal(
      (filas.find((f) => f.principal)?.tema_id as string | undefined) ?? null
    );

    if (r.pdf_path) {
      const { data } = await supabase.storage
        .from(BUCKET_PDFS)
        .createSignedUrl(r.pdf_path, 60 * 60);
      setPdfUrl(data?.signedUrl ?? null);
    }
  }, [supabase, id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // El árbol aplanado, con su profundidad, para listarlo con sangría.
  const temasEnOrden = useMemo(() => {
    const salida: { tema: Tema; nivel: number }[] = [];
    const bajar = (padre: string | null, nivel: number) => {
      for (const tema of temas.filter((t) => t.parent_id === padre)) {
        salida.push({ tema, nivel });
        bajar(tema.id, nivel + 1);
      }
    };
    bajar(null, 0);
    return salida;
  }, [temas]);

  const alternarTema = (temaId: string) => {
    setElegidos((prev) => {
      const sigue = prev.includes(temaId)
        ? prev.filter((t) => t !== temaId)
        : [...prev, temaId];
      setPrincipal((p) => (p && sigue.includes(p) ? p : (sigue[0] ?? null)));
      return sigue;
    });
  };

  const guardar = async (): Promise<boolean> => {
    if (!ficha) return false;
    const datos = deFicha(ficha);
    if (datos.anio !== null && !Number.isInteger(datos.anio)) {
      toast.error('El año tiene que ser un número');
      return false;
    }
    const { error } = await supabase
      .from('juris_resoluciones')
      .update(datos)
      .eq('id', id);
    if (error) {
      toast.error(
        error.code === '23514'
          ? 'Una resolución publicada no puede quedarse sin tipo, número, sala, fecha o fuente'
          : 'No se pudo guardar la ficha'
      );
      return false;
    }

    const borrar = await supabase
      .from('juris_resolucion_temas')
      .delete()
      .eq('resolucion_id', id);
    const insertar =
      elegidos.length > 0
        ? await supabase.from('juris_resolucion_temas').insert(
            elegidos.map((tema_id) => ({
              resolucion_id: id,
              tema_id,
              principal: tema_id === principal,
            }))
          )
        : { error: null };
    if (borrar.error || insertar.error) {
      toast.error('La ficha se guardó, pero no los temas');
      return false;
    }
    return true;
  };

  const alGuardar = async () => {
    setOcupado('guardar');
    if (await guardar()) toast.success('Ficha guardada');
    setOcupado(null);
  };

  const alPublicar = async () => {
    if (elegidos.length === 0) {
      toast.error(
        'Asígnale al menos un tema: sin tema no aparece al navegar en la app'
      );
      return;
    }
    setOcupado('publicar');
    try {
      if (!(await guardar())) return;
      const res = await fetch(`/api/juris/admin/resoluciones/${id}/publicar`, {
        method: 'POST',
      });
      const cuerpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(cuerpo.error || 'No se pudo publicar');
      toast.success('Resolución publicada');
      router.push('/jurisprudencia');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo publicar');
    } finally {
      setOcupado(null);
    }
  };

  const alRechazar = async () => {
    const motivo = window.prompt('¿Por qué se rechaza? (opcional)');
    if (motivo === null) return;
    setOcupado('rechazar');
    try {
      const res = await fetch(`/api/juris/admin/resoluciones/${id}/rechazar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo }),
      });
      if (!res.ok) throw new Error();
      toast.success('Resolución rechazada');
      router.push('/jurisprudencia');
    } catch {
      toast.error('No se pudo rechazar');
    } finally {
      setOcupado(null);
    }
  };

  if (noExiste) {
    return (
      <div className="text-muted-foreground py-16 text-center text-sm">
        No se encontró la resolución.{' '}
        <Link href="/jurisprudencia" className="text-primary hover:underline">
          Volver
        </Link>
      </div>
    );
  }
  if (!resolucion || !ficha) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  const campo = (clave: keyof Ficha) => ({
    value: ficha[clave],
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => setFicha({ ...ficha, [clave]: e.target.value }),
  });
  const sinProcesar = !resolucion.texto_completo;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/jurisprudencia"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="size-4" />
            Resoluciones
          </Link>
          <Badge variant="outline">{NOMBRE_ESTADO[resolucion.estado]}</Badge>
          {resolucion.archivo_nombre ? (
            <span className="text-muted-foreground text-xs">
              {resolucion.archivo_nombre}
            </span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={alGuardar}
            disabled={ocupado !== null}
          >
            {ocupado === 'guardar' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Guardar
          </Button>
          <Button
            variant="outline"
            onClick={alRechazar}
            disabled={ocupado !== null}
          >
            <X className="size-4" />
            Rechazar
          </Button>
          {resolucion.estado !== 'publicada' ? (
            <Button
              onClick={alPublicar}
              disabled={ocupado !== null || sinProcesar}
            >
              {ocupado === 'publicar' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Publicar
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* El PDF, a la izquierda: la ficha se revisa contra el original. */}
        <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-9rem)]">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              title="PDF de la resolución"
              className="border-border bg-muted h-[70vh] w-full rounded-xl border lg:h-full"
            />
          ) : (
            <div className="border-border text-muted-foreground flex h-64 items-center justify-center rounded-xl border border-dashed text-sm">
              Esta resolución no tiene PDF.
            </div>
          )}
        </div>

        <div className="space-y-4">
          {sinProcesar ? (
            <Aviso>
              Todavía se está procesando el PDF. La ficha aparecerá aquí cuando
              termine.
            </Aviso>
          ) : null}
          {resolucion.texto_origen === 'ia' ? (
            <Aviso>
              El PDF es un escaneo y su texto lo transcribió la IA. Coteja con
              el original los números, las fechas y los artículos antes de
              publicar.
            </Aviso>
          ) : null}
          {resolucion.ficha_avisos.length > 0 ? (
            <Aviso>
              <ul className="list-disc space-y-1 pl-4">
                {resolucion.ficha_avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </Aviso>
          ) : null}
          {resolucion.estado === 'rechazada' && resolucion.motivo_rechazo ? (
            <Aviso>Rechazada: {resolucion.motivo_rechazo}</Aviso>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Tipo">
              <select className={SELECT} {...campo('tipo')}>
                <option value="">—</option>
                {TIPOS_RESOLUCION.map((t) => (
                  <option key={t} value={t}>
                    {NOMBRE_TIPO[t]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Fallo">
              <select className={SELECT} {...campo('fallo')}>
                <option value="">—</option>
                {FALLOS.map((f) => (
                  <option key={f} value={f}>
                    {NOMBRE_FALLO[f]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Número">
              <Input placeholder="1234-2019" {...campo('numero')} />
            </Campo>
            <Campo etiqueta="Año">
              <Input
                inputMode="numeric"
                placeholder="2019"
                {...campo('anio')}
              />
            </Campo>
            <Campo etiqueta="Procedencia">
              <Input placeholder="Lima" {...campo('procedencia')} />
            </Campo>
            <Campo etiqueta="Fecha">
              <Input type="date" {...campo('fecha')} />
            </Campo>
          </div>
          <Campo etiqueta="Sala">
            <Input placeholder="Sala Civil Permanente" {...campo('sala')} />
          </Campo>
          <Campo etiqueta="Sumilla">
            <Textarea rows={3} {...campo('sumilla')} />
          </Campo>
          <Campo etiqueta="Criterio jurisprudencial">
            <Textarea rows={5} {...campo('criterio')} />
          </Campo>
          <Campo etiqueta="Hechos relevantes">
            <Textarea rows={4} {...campo('hechos')} />
          </Campo>
          <Campo etiqueta="Artículos citados (uno por línea)">
            <Textarea
              rows={4}
              placeholder="CC art. 219 inc. 5"
              {...campo('articulos')}
            />
          </Campo>
          <Campo etiqueta="Enlace a la fuente oficial">
            <Input
              type="url"
              placeholder="https://…"
              {...campo('url_fuente')}
            />
          </Campo>

          <div className="space-y-2">
            <Label>Temas</Label>
            <div className="border-border max-h-72 overflow-y-auto rounded-lg border p-3">
              {temasEnOrden.map(({ tema, nivel }) => {
                const marcado = elegidos.includes(tema.id);
                return (
                  <div
                    key={tema.id}
                    className="flex items-center gap-2 py-0.5 text-sm"
                    style={{ paddingLeft: nivel * 16 }}
                  >
                    <label className="flex flex-1 cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => alternarTema(tema.id)}
                      />
                      {tema.nombre}
                    </label>
                    {marcado ? (
                      <label className="text-muted-foreground flex cursor-pointer items-center gap-1 text-xs">
                        <input
                          type="radio"
                          name="tema-principal"
                          checked={principal === tema.id}
                          onChange={() => setPrincipal(tema.id)}
                        />
                        principal
                      </label>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {resolucion.texto_completo ? (
            <details className="border-border rounded-lg border p-3 text-sm">
              <summary className="text-muted-foreground cursor-pointer">
                Texto completo (
                {resolucion.texto_origen === 'ia'
                  ? 'transcrito por IA'
                  : 'del PDF'}
                )
              </summary>
              <pre className="mt-3 max-h-96 overflow-y-auto font-sans text-xs leading-relaxed whitespace-pre-wrap">
                {resolucion.texto_completo}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Campo({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{etiqueta}</Label>
      {children}
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
