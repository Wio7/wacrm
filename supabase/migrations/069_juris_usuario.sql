-- ============================================================
-- 069_juris_usuario.sql — Jurisprudencia: lo que es de cada usuario
--
-- El catálogo (068) es de todos. Esto no: los favoritos, las carpetas
-- con sus notas, lo que cada uno pregunta y los temas que sigue son de
-- una persona dentro de una cuenta, y nadie más los ve — ni otra
-- cuenta, ni otro usuario de la misma cuenta.
--
-- Todas las tablas llevan account_id + user_id y la misma política:
-- la fila es tuya (user_id = auth.uid()) Y es de tu cuenta, que además
-- tiene el módulo encendido (account_with_module, 067). Apagar el
-- módulo o desactivar la cuenta corta el acceso en el acto.
--
-- El admin de Wio NO lee favoritos, carpetas ni notas. Sí lee
-- juris_consultas, que es el registro de uso: sirve para saber qué se
-- busca y qué temas falta cargar.
--
-- Requiere la 068. Idempotente.
-- ============================================================

-- ============================================================
-- Favoritos
-- ============================================================
CREATE TABLE IF NOT EXISTS juris_favoritos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resolucion_id  uuid NOT NULL REFERENCES juris_resoluciones(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, resolucion_id)
);

-- ============================================================
-- Carpetas — agrupan resoluciones por caso, con notas.
--
-- Las notas son texto libre del usuario. La app avisa que no se
-- escriban ahí datos de expedientes ni de las partes; aquí no hay nada
-- que subir ni adjuntar, a propósito.
-- ============================================================
CREATE TABLE IF NOT EXISTS juris_carpetas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      text NOT NULL CHECK (length(btrim(nombre)) > 0),
  notas       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS juris_carpetas_user_idx
  ON juris_carpetas (user_id, updated_at DESC);

DROP TRIGGER IF EXISTS set_updated_at ON juris_carpetas;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON juris_carpetas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS juris_carpeta_resoluciones (
  carpeta_id     uuid NOT NULL REFERENCES juris_carpetas(id) ON DELETE CASCADE,
  resolucion_id  uuid NOT NULL REFERENCES juris_resoluciones(id) ON DELETE CASCADE,
  nota           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (carpeta_id, resolucion_id)
);

-- ============================================================
-- Consultas — cada búsqueda y cada pregunta al asistente.
--
-- Es un registro: el usuario lo escribe y lo lee (sus búsquedas
-- recientes), no lo edita ni lo borra. De aquí sale también el límite
-- de preguntas por usuario al asistente.
-- ============================================================
CREATE TABLE IF NOT EXISTS juris_consultas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo                  text NOT NULL CHECK (tipo IN ('busqueda', 'asistente')),
  pregunta              text NOT NULL,
  respuesta             text,
  resoluciones_citadas  uuid[] NOT NULL DEFAULT '{}',
  sin_resultados        boolean NOT NULL DEFAULT false,
  duracion_ms           integer,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS juris_consultas_user_idx
  ON juris_consultas (user_id, tipo, created_at DESC);

-- ============================================================
-- Alertas — los temas que el usuario sigue.
-- ============================================================
CREATE TABLE IF NOT EXISTS juris_alertas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tema_id     uuid NOT NULL REFERENCES juris_temas(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tema_id)
);

CREATE INDEX IF NOT EXISTS juris_alertas_tema_idx
  ON juris_alertas (tema_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE juris_favoritos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE juris_carpetas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE juris_carpeta_resoluciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE juris_consultas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE juris_alertas              ENABLE ROW LEVEL SECURITY;

-- Favoritos, carpetas y alertas: todo para su dueño, nada para nadie más.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['juris_favoritos', 'juris_carpetas', 'juris_alertas'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_propio', t);
    EXECUTE format($f$
      CREATE POLICY %I ON %I FOR ALL
        USING (user_id = auth.uid()
               AND account_id = public.account_with_module('jurisprudencia'))
        WITH CHECK (user_id = auth.uid()
               AND account_id = public.account_with_module('jurisprudencia'))
    $f$, t || '_propio', t);
  END LOOP;
END $$;

-- Lo que hay dentro de una carpeta se ve a través de la carpeta: si la
-- carpeta no es tuya, la subconsulta no devuelve nada.
DROP POLICY IF EXISTS juris_carpeta_resoluciones_propio ON juris_carpeta_resoluciones;
CREATE POLICY juris_carpeta_resoluciones_propio ON juris_carpeta_resoluciones FOR ALL
  USING (EXISTS (SELECT 1 FROM juris_carpetas c WHERE c.id = carpeta_id))
  WITH CHECK (EXISTS (SELECT 1 FROM juris_carpetas c WHERE c.id = carpeta_id));

-- Consultas: sin UPDATE ni DELETE (no hay política, así que se niegan).
DROP POLICY IF EXISTS juris_consultas_select ON juris_consultas;
CREATE POLICY juris_consultas_select ON juris_consultas FOR SELECT
  USING (
    public.is_super_admin()
    OR (user_id = auth.uid()
        AND account_id = public.account_with_module('jurisprudencia'))
  );

DROP POLICY IF EXISTS juris_consultas_insert ON juris_consultas;
CREATE POLICY juris_consultas_insert ON juris_consultas FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND account_id = public.account_with_module('jurisprudencia')
  );
