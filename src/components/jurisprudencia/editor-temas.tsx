'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import type { Tema } from '@/lib/juris/tipos';

/** "Daño moral" → "dano-moral". Tiene que pasar el CHECK del slug (068). */
export function slugDe(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type Edicion =
  | { modo: 'nuevo'; padre: string | null; valor: string }
  | { modo: 'renombrar'; id: string; valor: string };

export function EditorTemas() {
  const supabase = useMemo(() => createClient(), []);
  const [temas, setTemas] = useState<Tema[]>([]);
  const [cargando, setCargando] = useState(true);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from('juris_temas')
      .select('id, parent_id, slug, nombre, descripcion, orden')
      .order('orden');
    if (error) toast.error('No se pudieron cargar los temas');
    else setTemas((data ?? []) as Tema[]);
    setCargando(false);
  }, [supabase]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const hijosDe = useCallback(
    (padre: string | null) => temas.filter((t) => t.parent_id === padre),
    [temas]
  );

  const confirmar = async () => {
    if (!edicion) return;
    const nombre = edicion.valor.trim();
    if (!nombre) return;
    setGuardando(true);
    try {
      if (edicion.modo === 'renombrar') {
        // El slug no cambia al renombrar: la app y los enlaces lo usan.
        const { error } = await supabase
          .from('juris_temas')
          .update({ nombre })
          .eq('id', edicion.id);
        if (error) throw error;
      } else {
        const base = slugDe(nombre);
        if (!base)
          throw new Error('El nombre necesita al menos una letra o un número');
        const usados = new Set(temas.map((t) => t.slug));
        let slug = base;
        for (let n = 2; usados.has(slug); n++) slug = `${base}-${n}`;
        const hermanos = hijosDe(edicion.padre);
        const orden =
          hermanos.reduce((max, t) => Math.max(max, t.orden), 0) + 1;
        const { error } = await supabase
          .from('juris_temas')
          .insert({ nombre, slug, parent_id: edicion.padre, orden });
        if (error) throw error;
      }
      setEdicion(null);
      await cargar();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo guardar el tema'
      );
    } finally {
      setGuardando(false);
    }
  };

  const mover = async (tema: Tema, direccion: -1 | 1) => {
    const hermanos = hijosDe(tema.parent_id);
    const vecino =
      hermanos[hermanos.findIndex((t) => t.id === tema.id) + direccion];
    if (!vecino) return;
    // Si dos hermanos comparten `orden`, intercambiarlos no movería nada.
    const [a, b] =
      tema.orden === vecino.orden
        ? [tema.orden + direccion, tema.orden]
        : [vecino.orden, tema.orden];
    const cambios = await Promise.all([
      supabase.from('juris_temas').update({ orden: a }).eq('id', tema.id),
      supabase.from('juris_temas').update({ orden: b }).eq('id', vecino.id),
    ]);
    if (cambios.some((c) => c.error)) toast.error('No se pudo reordenar');
    cargar();
  };

  const eliminar = async (tema: Tema) => {
    if (!window.confirm(`¿Eliminar el tema "${tema.nombre}"?`)) return;
    const { error } = await supabase
      .from('juris_temas')
      .delete()
      .eq('id', tema.id);
    if (error) {
      toast.error(
        error.code === '23503'
          ? 'No se puede eliminar: tiene subtemas o resoluciones asignadas'
          : 'No se pudo eliminar el tema'
      );
      return;
    }
    cargar();
  };

  const campo = (
    <div className="flex items-center gap-1.5 py-1">
      <Input
        autoFocus
        value={edicion?.valor ?? ''}
        onChange={(e) =>
          setEdicion((prev) =>
            prev ? { ...prev, valor: e.target.value } : prev
          )
        }
        onKeyDown={(e) => {
          if (e.key === 'Enter') confirmar();
          if (e.key === 'Escape') setEdicion(null);
        }}
        placeholder="Nombre del tema"
        className="h-8 max-w-sm"
      />
      <Button
        size="icon"
        onClick={confirmar}
        disabled={guardando}
        aria-label="Guardar"
      >
        {guardando ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" />
        )}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setEdicion(null)}
        aria-label="Cancelar"
      >
        <X className="size-4" />
      </Button>
    </div>
  );

  const rama = (padre: string | null, nivel: number) => {
    const grupo = hijosDe(padre);
    return (
      <ul className={nivel === 0 ? '' : 'border-border ml-5 border-l pl-3'}>
        {grupo.map((tema, i) => (
          <li key={tema.id}>
            {edicion?.modo === 'renombrar' && edicion.id === tema.id ? (
              campo
            ) : (
              <div className="group flex items-center gap-2 py-1">
                <span className={nivel === 0 ? 'font-semibold' : 'text-sm'}>
                  {tema.nombre}
                </span>
                {tema.descripcion ? (
                  <span className="text-muted-foreground text-xs">
                    {tema.descripcion}
                  </span>
                ) : null}
                <span className="flex items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Agregar subtema"
                    onClick={() =>
                      setEdicion({ modo: 'nuevo', padre: tema.id, valor: '' })
                    }
                  >
                    <Plus />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Renombrar"
                    onClick={() =>
                      setEdicion({
                        modo: 'renombrar',
                        id: tema.id,
                        valor: tema.nombre,
                      })
                    }
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Subir"
                    disabled={i === 0}
                    onClick={() => mover(tema, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Bajar"
                    disabled={i === grupo.length - 1}
                    onClick={() => mover(tema, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Eliminar"
                    onClick={() => eliminar(tema)}
                  >
                    <Trash2 />
                  </Button>
                </span>
              </div>
            )}
            {rama(tema.id, nivel + 1)}
            {edicion?.modo === 'nuevo' && edicion.padre === tema.id ? (
              <div className="ml-5 pl-3">{campo}</div>
            ) : null}
          </li>
        ))}
      </ul>
    );
  };

  if (cargando) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="border-border space-y-3 rounded-xl border p-5">
      <p className="text-muted-foreground text-sm">
        El árbol por el que se navega en la app. Pasa el cursor sobre un tema
        para agregarle subtemas, renombrarlo, moverlo o eliminarlo.
      </p>
      {rama(null, 0)}
      {edicion?.modo === 'nuevo' && edicion.padre === null ? (
        campo
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEdicion({ modo: 'nuevo', padre: null, valor: '' })}
        >
          <Plus className="size-3.5" />
          Nueva materia
        </Button>
      )}
    </div>
  );
}
