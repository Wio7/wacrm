-- ============================================================
-- 067_account_modules.sql — Qué módulos tiene encendidos cada cuenta
--
-- Wio CRM atiende a clientes distintos y a cada uno se le arma lo suyo.
-- Esta tabla dice qué módulo a medida tiene cada cuenta: sin fila (o con
-- enabled = false) el módulo no existe para esa cuenta, ni en el menú ni
-- en la base.
--
-- Sólo el admin de Wio enciende o apaga módulos. La cuenta puede leer
-- los suyos (para saber qué mostrar), nunca cambiarlos.
--
-- `config` queda libre para lo que cada módulo necesite por cuenta
-- (plan, fecha de vencimiento de una suscripción, límites de uso).
--
-- Enciende uno con:
--   INSERT INTO account_modules (account_id, module)
--   VALUES ('<account id>', 'jurisprudencia')
--   ON CONFLICT (account_id, module) DO UPDATE SET enabled = true;
--
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS account_modules (
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  module      text NOT NULL CHECK (module ~ '^[a-z][a-z0-9_]*$'),
  enabled     boolean NOT NULL DEFAULT true,
  config      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, module)
);

DROP TRIGGER IF EXISTS set_updated_at ON account_modules;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON account_modules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- La cuenta de quien llama, si tiene el módulo encendido; NULL si no.
--
-- No pasa por is_account_member: un 'usuario_app' no es miembro para el
-- CRM y aun así tiene que poder usar su módulo. Lo que se exige es que
-- la cuenta esté activa y el módulo encendido — el rol da igual.
--
-- SECURITY DEFINER para leer profiles / accounts sin depender de sus
-- políticas (un usuario_app no puede leer su fila de accounts).
-- ============================================================
CREATE OR REPLACE FUNCTION public.account_with_module(p_module text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.account_id
  FROM public.profiles p
  JOIN public.accounts a ON a.id = p.account_id
  JOIN public.account_modules m ON m.account_id = p.account_id
  WHERE p.user_id = auth.uid()
    AND a.status = 'active'
    AND m.module = p_module
    AND m.enabled
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.account_with_module(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_with_module(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.account_has_module(p_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.account_with_module(p_module) IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.account_has_module(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_has_module(text) TO authenticated, service_role;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE account_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_modules_select ON account_modules;
CREATE POLICY account_modules_select ON account_modules FOR SELECT
  USING (
    public.is_super_admin()
    OR account_id = (
      SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS account_modules_insert ON account_modules;
CREATE POLICY account_modules_insert ON account_modules FOR INSERT
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS account_modules_update ON account_modules;
CREATE POLICY account_modules_update ON account_modules FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS account_modules_delete ON account_modules;
CREATE POLICY account_modules_delete ON account_modules FOR DELETE
  USING (public.is_super_admin());
