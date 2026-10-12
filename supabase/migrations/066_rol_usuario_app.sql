-- ============================================================
-- 066_rol_usuario_app.sql — Un rol para quien sólo usa una app
--
-- Hasta ahora toda cuenta era una empresa con su equipo dentro del CRM
-- (owner / admin / agent / viewer). Hay clientes que no son eso: una
-- persona con su cuenta y una app a medida, que nunca entra al CRM.
--
-- 'usuario_app' es ese rol. No aparece en el CASE de is_account_member
-- (041), así que ahí vale NULL y ninguna política del CRM le devuelve
-- filas: ni contactos, ni conversaciones, ni la configuración. Lo que sí
-- puede ver lo decide cada módulo con sus propias políticas (067).
--
-- VA SOLA A PROPÓSITO. Postgres no deja usar un valor de enum en la
-- misma transacción que lo crea, y el editor SQL de Supabase corre el
-- archivo entero en una. Córrela antes que la 067 y siguientes.
--
-- Idempotente.
-- ============================================================

ALTER TYPE account_role_enum ADD VALUE IF NOT EXISTS 'usuario_app';
