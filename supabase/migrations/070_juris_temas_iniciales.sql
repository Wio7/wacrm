-- ============================================================
-- 070_juris_temas_iniciales.sql — El árbol de temas con el que se parte
--
-- Las tres materias civiles del primer cliente: responsabilidad civil,
-- contratos y acto jurídico. Es un punto de partida: el árbol se edita
-- desde el panel, y esta migración no pisa nada de lo que ya exista
-- (ON CONFLICT (slug) DO NOTHING), así que volver a correrla no deshace
-- cambios hechos a mano.
--
-- Un INSERT por nivel: cada uno busca a su padre por slug, y el padre
-- tiene que existir ya.
--
-- Requiere la 068.
-- ============================================================

INSERT INTO juris_temas (slug, nombre, orden)
VALUES ('civil', 'Civil', 1)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO juris_temas (slug, nombre, orden, parent_id)
SELECT v.slug, v.nombre, v.orden, p.id
FROM (VALUES
  ('responsabilidad-civil', 'Responsabilidad civil', 1),
  ('contratos',             'Contratos',             2),
  ('acto-juridico',         'Acto jurídico',         3)
) AS v(slug, nombre, orden)
JOIN juris_temas p ON p.slug = 'civil'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO juris_temas (slug, nombre, descripcion, orden, parent_id)
SELECT v.slug, v.nombre, v.descripcion, v.orden, p.id
FROM (VALUES
  ('responsabilidad-civil', 'responsabilidad-contractual',
     'Indemnización por responsabilidad contractual', 'CC art. 1321 y ss.', 1),
  ('responsabilidad-civil', 'responsabilidad-extracontractual',
     'Responsabilidad extracontractual', 'CC art. 1969 y ss.', 2),
  ('responsabilidad-civil', 'dano-moral',
     'Daño moral', NULL, 3),
  ('responsabilidad-civil', 'lucro-cesante-y-dano-emergente',
     'Lucro cesante y daño emergente', NULL, 4),

  ('contratos', 'formacion-del-contrato',
     'Formación del contrato', NULL, 1),
  ('contratos', 'resolucion-por-incumplimiento',
     'Resolución por incumplimiento', NULL, 2),
  ('contratos', 'compraventa',
     'Compraventa', NULL, 3),
  ('contratos', 'arrendamiento',
     'Arrendamiento', NULL, 4),
  ('contratos', 'excesiva-onerosidad',
     'Excesiva onerosidad', NULL, 5),

  ('acto-juridico', 'nulidad-de-acto-juridico',
     'Nulidad de acto jurídico', 'CC art. 219', 1),
  ('acto-juridico', 'anulabilidad',
     'Anulabilidad', 'CC art. 221', 2),
  ('acto-juridico', 'simulacion-relativa',
     'Simulación relativa', NULL, 3)
) AS v(parent_slug, slug, nombre, descripcion, orden)
JOIN juris_temas p ON p.slug = v.parent_slug
ON CONFLICT (slug) DO NOTHING;

-- Un subtema por causal de nulidad.
INSERT INTO juris_temas (slug, nombre, orden, parent_id)
SELECT v.slug, v.nombre, v.orden, p.id
FROM (VALUES
  ('nulidad-falta-de-manifestacion-de-voluntad', 'Falta de manifestación de voluntad', 1),
  ('nulidad-objeto-juridicamente-imposible',     'Objeto jurídicamente imposible',     2),
  ('nulidad-fin-ilicito',                        'Fin ilícito',                        3),
  ('nulidad-simulacion-absoluta',                'Simulación absoluta',                4),
  ('nulidad-falta-de-formalidad',                'Falta de formalidad',                5),
  ('nulidad-contrario-al-orden-publico',         'Contrario al orden público',         6)
) AS v(slug, nombre, orden)
JOIN juris_temas p ON p.slug = 'nulidad-de-acto-juridico'
ON CONFLICT (slug) DO NOTHING;
