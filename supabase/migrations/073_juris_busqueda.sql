-- ============================================================
-- 073_juris_busqueda.sql — Jurisprudencia: buscar en el catálogo
--
-- Dos funciones que usa la app:
--
--   juris_buscar      resoluciones, para el buscador.
--   juris_fragmentos  fragmentos de texto, para lo que se le pasa al
--                     asistente antes de que conteste.
--
-- Las dos hacen búsqueda HÍBRIDA: por palabras (full-text en español) y
-- por significado (embeddings), y juntan los dos órdenes con RRF
-- (Reciprocal Rank Fusion: cada lista aporta 1 / (60 + posición)). Por
-- palabras encuentra el número de casación y el término exacto; por
-- significado encuentra "el vendedor se quedó viviendo en la casa"
-- cuando la resolución dice "permanencia en la posesión". Sin
-- embedding (p_embedding NULL) trabajan sólo por palabras.
--
-- Las palabras se buscan con O, no con Y: una consulta en lenguaje
-- natural casi nunca tiene todas sus palabras en una misma ficha, y el
-- orden (ts_rank_cd premia las que aparecen juntas) deja arriba lo que
-- las reúne.
--
-- SECURITY INVOKER: corren con los permisos de quien llama, así que las
-- políticas de la 068 siguen mandando. Además filtran 'publicada' de
-- forma explícita — ni el admin de Wio saca por aquí un borrador.
--
-- p_embedding llega como texto ('[0.1,0.2,…]') y se convierte adentro,
-- igual que en la 030.
--
-- Requiere la 068 y la 071. Idempotente.
-- ============================================================

-- ============================================================
-- Los artículos como texto, para filtrar por un trozo ("219") desde la
-- API. Lo mantiene el mismo trigger que el índice de texto.
-- ============================================================
ALTER TABLE juris_resoluciones
  ADD COLUMN IF NOT EXISTS articulos_texto text;

CREATE OR REPLACE FUNCTION public.juris_resoluciones_fts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.articulos_texto := array_to_string(NEW.articulos, ' | ');
  NEW.fts :=
    setweight(to_tsvector('spanish',
      concat_ws(' ', NEW.numero, NEW.procedencia, NEW.sala, NEW.sumilla, NEW.criterio)), 'A')
    || setweight(to_tsvector('spanish', array_to_string(NEW.articulos, ' ')), 'B')
    || setweight(to_tsvector('spanish', coalesce(NEW.hechos, '')), 'C');
  RETURN NEW;
END;
$$;

UPDATE juris_resoluciones
   SET articulos_texto = array_to_string(articulos, ' | ')
 WHERE articulos_texto IS NULL;

-- ============================================================
-- La consulta del usuario como tsquery: sus palabras unidas con O.
-- plainto_tsquery no interpreta operadores, así que no hay forma de
-- colar sintaxis; sólo se cambia el Y por O. NULL si la consulta no
-- deja ninguna palabra con contenido ("de la que").
-- ============================================================
CREATE OR REPLACE FUNCTION public.juris_tsquery(p_query text)
RETURNS tsquery
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN numnode(plainto_tsquery('spanish', coalesce(p_query, ''))) = 0 THEN NULL
    ELSE replace(plainto_tsquery('spanish', p_query)::text, ' & ', ' | ')::tsquery
  END;
$$;

-- ============================================================
-- juris_buscar — resoluciones publicadas, de más a menos relevante.
--
-- Tres listas se fusionan: la ficha (número, sumilla, criterio,
-- artículos), el texto completo por palabras y el texto completo por
-- significado. Un número de casación escrito tal cual en la consulta
-- pone a esa resolución primera.
--
-- p_distancia_max corta lo que por significado queda demasiado lejos:
-- el vecino más cercano siempre existe, aunque no tenga nada que ver.
-- ============================================================
CREATE OR REPLACE FUNCTION public.juris_buscar(
  p_query          text,
  p_embedding      text DEFAULT NULL,
  p_limit          integer DEFAULT 20,
  p_distancia_max  double precision DEFAULT 0.75
)
RETURNS TABLE (resolucion_id uuid, puntaje double precision, fragmento text)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  WITH q AS (SELECT public.juris_tsquery(p_query) AS ts),
  numero AS (
    SELECT r.id
    FROM juris_resoluciones r
    WHERE r.estado = 'publicada'
      AND r.numero IS NOT NULL
      AND length(r.numero) >= 3
      AND position(lower(r.numero) IN lower(p_query)) > 0
  ),
  ficha AS (
    SELECT r.id,
           row_number() OVER (ORDER BY ts_rank_cd(r.fts, q.ts) DESC, r.id) AS pos
    FROM juris_resoluciones r, q
    WHERE r.estado = 'publicada' AND q.ts IS NOT NULL AND r.fts @@ q.ts
    ORDER BY pos
    LIMIT 50
  ),
  texto AS (
    SELECT t.id, t.fragmento,
           row_number() OVER (ORDER BY t.rango DESC, t.id) AS pos
    FROM (
      SELECT DISTINCT ON (c.resolucion_id)
             c.resolucion_id AS id,
             c.content AS fragmento,
             ts_rank_cd(c.fts, q.ts) AS rango
      FROM juris_resolucion_chunks c
      JOIN juris_resoluciones r ON r.id = c.resolucion_id, q
      WHERE r.estado = 'publicada' AND q.ts IS NOT NULL AND c.fts @@ q.ts
      ORDER BY c.resolucion_id, ts_rank_cd(c.fts, q.ts) DESC
    ) t
    ORDER BY pos
    LIMIT 50
  ),
  semantica AS (
    SELECT s.id, s.fragmento,
           row_number() OVER (ORDER BY s.distancia, s.id) AS pos
    FROM (
      SELECT DISTINCT ON (cerca.resolucion_id)
             cerca.resolucion_id AS id, cerca.fragmento, cerca.distancia
      FROM (
        SELECT c.resolucion_id,
               c.content AS fragmento,
               c.embedding <=> p_embedding::vector(1024) AS distancia
        FROM juris_resolucion_chunks c
        JOIN juris_resoluciones r ON r.id = c.resolucion_id
        WHERE p_embedding IS NOT NULL
          AND c.embedding IS NOT NULL
          AND r.estado = 'publicada'
        ORDER BY c.embedding <=> p_embedding::vector(1024)
        LIMIT 60
      ) cerca
      WHERE cerca.distancia <= p_distancia_max
      ORDER BY cerca.resolucion_id, cerca.distancia
    ) s
  ),
  fusion AS (
    SELECT x.id, sum(x.aporte) AS puntaje
    FROM (
      SELECT id, 1.0 AS aporte FROM numero
      UNION ALL SELECT id, 1.0 / (60 + pos) FROM ficha
      UNION ALL SELECT id, 1.0 / (60 + pos) FROM texto
      UNION ALL SELECT id, 1.0 / (60 + pos) FROM semantica
    ) x
    GROUP BY x.id
  )
  SELECT f.id,
         f.puntaje::double precision,
         coalesce(
           (SELECT t.fragmento FROM texto t WHERE t.id = f.id),
           (SELECT s.fragmento FROM semantica s WHERE s.id = f.id)
         )
  FROM fusion f
  ORDER BY f.puntaje DESC, f.id
  LIMIT greatest(least(p_limit, 50), 0);
$$;

-- ============================================================
-- juris_fragmentos — los fragmentos que se le pasan al asistente.
--
-- Misma fusión, pero a nivel de fragmento, y con un tope por
-- resolución: sin él, una sola resolución larga puede ocupar todos los
-- lugares y el asistente contesta con una fuente cuando había tres.
-- ============================================================
CREATE OR REPLACE FUNCTION public.juris_fragmentos(
  p_query           text,
  p_embedding       text DEFAULT NULL,
  p_limit           integer DEFAULT 10,
  p_por_resolucion  integer DEFAULT 3,
  p_distancia_max   double precision DEFAULT 0.75
)
RETURNS TABLE (
  chunk_id uuid, resolucion_id uuid, chunk_index integer,
  content text, puntaje double precision
)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  WITH q AS (SELECT public.juris_tsquery(p_query) AS ts),
  texto AS (
    SELECT c.id,
           row_number() OVER (ORDER BY ts_rank_cd(c.fts, q.ts) DESC, c.id) AS pos
    FROM juris_resolucion_chunks c
    JOIN juris_resoluciones r ON r.id = c.resolucion_id, q
    WHERE r.estado = 'publicada' AND q.ts IS NOT NULL AND c.fts @@ q.ts
    ORDER BY pos
    LIMIT 40
  ),
  semantica AS (
    SELECT cerca.id,
           row_number() OVER (ORDER BY cerca.distancia, cerca.id) AS pos
    FROM (
      SELECT c.id, c.embedding <=> p_embedding::vector(1024) AS distancia
      FROM juris_resolucion_chunks c
      JOIN juris_resoluciones r ON r.id = c.resolucion_id
      WHERE p_embedding IS NOT NULL
        AND c.embedding IS NOT NULL
        AND r.estado = 'publicada'
      ORDER BY c.embedding <=> p_embedding::vector(1024)
      LIMIT 40
    ) cerca
    WHERE cerca.distancia <= p_distancia_max
  ),
  fusion AS (
    SELECT x.id, sum(1.0 / (60 + x.pos)) AS puntaje
    FROM (SELECT id, pos FROM texto UNION ALL SELECT id, pos FROM semantica) x
    GROUP BY x.id
  ),
  ordenados AS (
    SELECT c.id, c.resolucion_id, c.chunk_index, c.content, f.puntaje,
           row_number() OVER (
             PARTITION BY c.resolucion_id ORDER BY f.puntaje DESC, c.chunk_index
           ) AS en_su_resolucion
    FROM fusion f
    JOIN juris_resolucion_chunks c ON c.id = f.id
  )
  SELECT o.id, o.resolucion_id, o.chunk_index, o.content, o.puntaje::double precision
  FROM ordenados o
  WHERE o.en_su_resolucion <= greatest(p_por_resolucion, 1)
  ORDER BY o.puntaje DESC, o.id
  LIMIT greatest(least(p_limit, 30), 0);
$$;

REVOKE ALL ON FUNCTION public.juris_buscar(text, text, integer, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.juris_buscar(text, text, integer, double precision)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.juris_fragmentos(text, text, integer, integer, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.juris_fragmentos(text, text, integer, integer, double precision)
  TO authenticated, service_role;

-- ============================================================
-- Para las búsquedas recientes del usuario y para contar cuántas
-- preguntas le ha hecho al asistente (el límite de uso).
-- ============================================================
CREATE INDEX IF NOT EXISTS juris_consultas_recientes_idx
  ON juris_consultas (user_id, created_at DESC);
