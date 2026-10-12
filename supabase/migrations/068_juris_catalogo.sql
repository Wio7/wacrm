-- ============================================================
-- 068_juris_catalogo.sql — Jurisprudencia: el catálogo de resoluciones
--
-- Casaciones, plenos casatorios, precedentes vinculantes y acuerdos
-- plenarios, ordenados por temas.
--
-- El catálogo es GLOBAL, no por cuenta: una casación es un documento
-- público y es la misma para todo el que la consulte. Lo carga y lo
-- revisa el admin de Wio; lo leen las cuentas que tienen el módulo
-- 'jurisprudencia' encendido (067). Lo que sí es de cada quien —
-- favoritos, carpetas, consultas, alertas — va en la 069.
--
-- Dos reglas que la base hace cumplir sola, sin fiarse del código:
--
--   · Nadie fuera del admin de Wio ve una resolución que no esté
--     'publicada'. Las fichas que arma la IA nacen en 'borrador' o
--     'pendiente_revision' y ahí se quedan hasta que una persona las
--     lee y las publica.
--   · Una resolución no puede quedar 'publicada' sin quien la revisó ni
--     sin lo mínimo para citarla (tipo, número, sala, fecha y de dónde
--     sale). Ver juris_resoluciones_publicable.
--
-- pgvector: igual que en la 030. Si tu proyecto de Supabase tiene las
-- extensiones en el esquema `extensions`, corre una vez
-- `create extension if not exists vector with schema extensions;`.
--
-- Requiere la 066 y la 067. Idempotente.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- Temas — el árbol por el que se navega (Civil → Acto jurídico →
-- Nulidad → Simulación absoluta). `slug` es estable: la app y los
-- enlaces lo usan, así que renombrar un tema no rompe nada.
-- ============================================================
CREATE TABLE IF NOT EXISTS juris_temas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id    uuid REFERENCES juris_temas(id) ON DELETE RESTRICT,
  slug         text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre       text NOT NULL,
  descripcion  text,
  orden        integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX IF NOT EXISTS juris_temas_parent_idx
  ON juris_temas (parent_id, orden);

DROP TRIGGER IF EXISTS set_updated_at ON juris_temas;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON juris_temas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Resoluciones — una fila por resolución, con su ficha.
--
-- Casi todo es nullable a propósito: a la IA se le pide dejar en NULL
-- lo que no encuentre en el texto en vez de inventarlo, y un borrador
-- tiene que poder guardarse a medias. Lo obligatorio se exige recién al
-- publicar.
--
-- `fallo` admite 'fundada_en_parte' y 'otro' además de los tres de
-- siempre: meter a la fuerza un "fundado en parte" en 'fundada' sería
-- afirmar algo que la resolución no dice.
-- ============================================================
CREATE TABLE IF NOT EXISTS juris_resoluciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            text CHECK (tipo IN (
                    'casacion', 'pleno_casatorio',
                    'precedente_vinculante', 'acuerdo_plenario')),
  numero          text,
  anio            integer CHECK (anio BETWEEN 1900 AND 2200),
  procedencia     text,
  sala            text,
  fecha           date,
  sumilla         text,
  criterio        text,
  hechos          text,
  articulos       text[] NOT NULL DEFAULT '{}',
  fallo           text CHECK (fallo IN (
                    'fundada', 'fundada_en_parte', 'infundada',
                    'improcedente', 'otro')),
  url_fuente      text,
  pdf_path        text,
  texto_completo  text,
  estado          text NOT NULL DEFAULT 'borrador' CHECK (estado IN (
                    'borrador', 'pendiente_revision', 'publicada', 'rechazada')),
  creado_por      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Sin ON DELETE SET NULL: borrar a quien revisó dejaría resoluciones
  -- publicadas sin revisor, que es justo lo que no puede pasar.
  revisado_por    uuid REFERENCES auth.users(id),
  revisado_at     timestamptz,
  publicada_at    timestamptz,
  fts             tsvector,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT juris_resoluciones_publicable CHECK (
    estado <> 'publicada' OR (
      tipo IS NOT NULL
      AND numero IS NOT NULL
      AND sala IS NOT NULL
      AND fecha IS NOT NULL
      AND (pdf_path IS NOT NULL OR url_fuente IS NOT NULL)
      AND revisado_por IS NOT NULL
      AND revisado_at IS NOT NULL
      AND publicada_at IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS juris_resoluciones_estado_idx
  ON juris_resoluciones (estado, publicada_at DESC);
CREATE INDEX IF NOT EXISTS juris_resoluciones_numero_idx
  ON juris_resoluciones (tipo, numero, anio);
CREATE INDEX IF NOT EXISTS juris_resoluciones_anio_idx
  ON juris_resoluciones (anio);
CREATE INDEX IF NOT EXISTS juris_resoluciones_articulos_idx
  ON juris_resoluciones USING gin (articulos);
CREATE INDEX IF NOT EXISTS juris_resoluciones_fts_idx
  ON juris_resoluciones USING gin (fts);

DROP TRIGGER IF EXISTS set_updated_at ON juris_resoluciones;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON juris_resoluciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índice de texto de la ficha, en español (raíces y palabras vacías:
-- "simulaciones" encuentra "simulación"). El stemmer no es perfecto —
-- "nulidades" y "nulidad" le dan raíces distintas —; lo que se le
-- escapa lo cubre la búsqueda semántica. Va por trigger y no como
-- columna generada porque array_to_string no es IMMUTABLE. Pesos: lo que
-- identifica y resume la resolución (A) por delante de los artículos (B)
-- y de los hechos (C). El texto completo se busca por sus fragmentos.
CREATE OR REPLACE FUNCTION public.juris_resoluciones_fts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.fts :=
    setweight(to_tsvector('spanish',
      concat_ws(' ', NEW.numero, NEW.procedencia, NEW.sala, NEW.sumilla, NEW.criterio)), 'A')
    || setweight(to_tsvector('spanish', array_to_string(NEW.articulos, ' ')), 'B')
    || setweight(to_tsvector('spanish', coalesce(NEW.hechos, '')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS juris_resoluciones_fts ON juris_resoluciones;
CREATE TRIGGER juris_resoluciones_fts
  BEFORE INSERT OR UPDATE OF numero, procedencia, sala, sumilla, criterio, articulos, hechos
  ON juris_resoluciones
  FOR EACH ROW EXECUTE FUNCTION public.juris_resoluciones_fts();

-- ============================================================
-- Resolución ↔ tema. Muchos a muchos: una casación sobre nulidad por
-- simulación absoluta suele tocar también fin ilícito. `principal`
-- marca el tema bajo el que se lista primero.
-- ============================================================
CREATE TABLE IF NOT EXISTS juris_resolucion_temas (
  resolucion_id  uuid NOT NULL REFERENCES juris_resoluciones(id) ON DELETE CASCADE,
  tema_id        uuid NOT NULL REFERENCES juris_temas(id) ON DELETE RESTRICT,
  principal      boolean NOT NULL DEFAULT false,
  PRIMARY KEY (resolucion_id, tema_id)
);

CREATE INDEX IF NOT EXISTS juris_resolucion_temas_tema_idx
  ON juris_resolucion_temas (tema_id);
CREATE UNIQUE INDEX IF NOT EXISTS juris_resolucion_temas_un_principal
  ON juris_resolucion_temas (resolucion_id) WHERE principal;

-- ============================================================
-- Fragmentos del texto completo, para la búsqueda semántica y para lo
-- que se le pasa al asistente. vector(1024): la dimensión de los
-- modelos de Voyage, y text-embedding-3-small de OpenAI se puede pedir
-- a 1024. Todo el catálogo tiene que estar embebido con UN mismo modelo
-- (los vectores de dos modelos no se pueden comparar entre sí).
-- ============================================================
CREATE TABLE IF NOT EXISTS juris_resolucion_chunks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resolucion_id  uuid NOT NULL REFERENCES juris_resoluciones(id) ON DELETE CASCADE,
  chunk_index    integer NOT NULL,
  content        text NOT NULL,
  fts            tsvector GENERATED ALWAYS AS (to_tsvector('spanish', content)) STORED,
  embedding      vector(1024),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resolucion_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS juris_resolucion_chunks_fts_idx
  ON juris_resolucion_chunks USING gin (fts);
-- HNSW y no IVFFlat por lo mismo que en la 030: el catálogo empieza
-- vacío y crece de a pocos.
CREATE INDEX IF NOT EXISTS juris_resolucion_chunks_embedding_idx
  ON juris_resolucion_chunks USING hnsw (embedding vector_cosine_ops);

-- ============================================================
-- RLS
--
-- Leer: el admin de Wio todo; una cuenta con el módulo, sólo lo
-- publicado. Escribir: sólo el admin de Wio. El rol dentro de la cuenta
-- no cuenta para nada aquí, así que un 'usuario_app' lee y nadie más
-- que Wio edita.
-- ============================================================
ALTER TABLE juris_temas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE juris_resoluciones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE juris_resolucion_temas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE juris_resolucion_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS juris_temas_select ON juris_temas;
CREATE POLICY juris_temas_select ON juris_temas FOR SELECT
  USING (public.is_super_admin() OR public.account_has_module('jurisprudencia'));

DROP POLICY IF EXISTS juris_resoluciones_select ON juris_resoluciones;
CREATE POLICY juris_resoluciones_select ON juris_resoluciones FOR SELECT
  USING (
    public.is_super_admin()
    OR (estado = 'publicada' AND public.account_has_module('jurisprudencia'))
  );

-- Los dos de abajo miran la resolución a través de su propia política:
-- si no puedes leer la resolución, tampoco sus temas ni sus fragmentos.
DROP POLICY IF EXISTS juris_resolucion_temas_select ON juris_resolucion_temas;
CREATE POLICY juris_resolucion_temas_select ON juris_resolucion_temas FOR SELECT
  USING (
    public.is_super_admin()
    OR EXISTS (SELECT 1 FROM juris_resoluciones r WHERE r.id = resolucion_id)
  );

DROP POLICY IF EXISTS juris_resolucion_chunks_select ON juris_resolucion_chunks;
CREATE POLICY juris_resolucion_chunks_select ON juris_resolucion_chunks FOR SELECT
  USING (
    public.is_super_admin()
    OR EXISTS (SELECT 1 FROM juris_resoluciones r WHERE r.id = resolucion_id)
  );

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'juris_temas', 'juris_resoluciones',
    'juris_resolucion_temas', 'juris_resolucion_chunks'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (public.is_super_admin())',
      t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())',
      t || '_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_delete', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE USING (public.is_super_admin())',
      t || '_delete', t);
  END LOOP;
END $$;
