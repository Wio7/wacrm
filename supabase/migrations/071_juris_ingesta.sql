-- ============================================================
-- 071_juris_ingesta.sql — Jurisprudencia: la cola que convierte un PDF
--                         en una ficha lista para revisar
--
-- El admin de Wio sube PDFs; cada uno pasa por tres pasos:
--
--   texto       sacar el texto del PDF. Si es un escaneo (fotos de
--               papel, casi sin texto), lo transcribe el modelo de IA
--               por tandas de páginas.
--   ficha       el modelo llena la ficha con lo que encuentra en el
--               texto y sugiere temas.
--   fragmentos  partir el texto y calcular sus embeddings.
--
-- Cada paso puede tardar minutos y el servidor corta a los pocos
-- minutos, así que el trabajo se guarda en una fila y se retoma donde
-- quedó: `paso` dice en cuál va y `cursor` cuántas páginas lleva
-- transcritas. Un trabajo que se queda colgado se vuelve a tomar cuando
-- vence `bloqueado_hasta`.
--
-- Al terminar, la resolución queda en 'pendiente_revision'. Publicar
-- sigue siendo cosa de una persona (068).
--
-- Requiere la 068. Idempotente.
-- ============================================================

-- ============================================================
-- Lo que la ingesta deja anotado en la resolución
--
--   texto_origen   'pdf' el texto venía en el PDF; 'ia' lo transcribió
--                  el modelo desde un escaneo y hay que cotejarlo con
--                  más cuidado contra el original.
--   ficha_ia       lo que devolvió el modelo, tal cual, para poder ver
--                  después qué puso la IA y qué corrigió la persona.
--   ficha_avisos   lo que el servidor descartó o no pudo comprobar
--                  contra el texto (un número de casación que no
--                  aparece, un artículo que no está).
-- ============================================================
ALTER TABLE juris_resoluciones
  ADD COLUMN IF NOT EXISTS archivo_nombre     text,
  ADD COLUMN IF NOT EXISTS paginas            integer,
  ADD COLUMN IF NOT EXISTS texto_origen       text CHECK (texto_origen IN ('pdf', 'ia')),
  ADD COLUMN IF NOT EXISTS ficha_ia           jsonb,
  ADD COLUMN IF NOT EXISTS ficha_avisos       text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS modelo_ficha       text,
  ADD COLUMN IF NOT EXISTS embeddings_modelo  text,
  ADD COLUMN IF NOT EXISTS motivo_rechazo     text;

-- ============================================================
-- La cola
-- ============================================================
CREATE TABLE IF NOT EXISTS juris_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resolucion_id    uuid NOT NULL UNIQUE REFERENCES juris_resoluciones(id) ON DELETE CASCADE,
  estado           text NOT NULL DEFAULT 'pendiente' CHECK (estado IN (
                     'pendiente', 'procesando', 'listo', 'error')),
  paso             text NOT NULL DEFAULT 'texto' CHECK (paso IN (
                     'texto', 'ficha', 'fragmentos')),
  cursor           integer NOT NULL DEFAULT 0,
  parcial          text,
  intentos         integer NOT NULL DEFAULT 0,
  error            text,
  bloqueado_hasta  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz
);

CREATE INDEX IF NOT EXISTS juris_jobs_cola_idx
  ON juris_jobs (estado, created_at);

DROP TRIGGER IF EXISTS set_updated_at ON juris_jobs;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON juris_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE juris_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS juris_jobs_admin ON juris_jobs;
CREATE POLICY juris_jobs_admin ON juris_jobs FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================
-- Tomar el siguiente trabajo.
--
-- FOR UPDATE SKIP LOCKED: dos procesos que llegan a la vez se llevan
-- trabajos distintos, nunca el mismo (y nunca se paga dos veces la
-- misma ficha). También recoge los que quedaron 'procesando' con el
-- candado vencido — un servidor que se cortó a la mitad.
--
-- Sólo el servidor (service_role) la puede llamar.
-- ============================================================
CREATE OR REPLACE FUNCTION public.juris_tomar_job(p_minutos integer DEFAULT 6)
RETURNS SETOF juris_jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE juris_jobs j
     SET estado = 'procesando',
         intentos = j.intentos + 1,
         bloqueado_hasta = now() + make_interval(mins => p_minutos)
   WHERE j.id = (
     SELECT c.id
       FROM juris_jobs c
      WHERE c.estado = 'pendiente'
         OR (c.estado = 'procesando' AND c.bloqueado_hasta < now())
      ORDER BY c.created_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
  RETURNING j.*;
$$;

REVOKE ALL ON FUNCTION public.juris_tomar_job(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.juris_tomar_job(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.juris_tomar_job(integer) TO service_role;
