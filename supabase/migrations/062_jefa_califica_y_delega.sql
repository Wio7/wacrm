-- ============================================================
-- 062_jefa_califica_y_delega.sql — el prospecto nuevo es del jefe de
-- ventas hasta que quiere agendar; entonces pasa a un asesor
--
-- Cómo lo quiere Golden:
--
--   1. Todo prospecto nuevo (el que no paga cuotas) nace asignado al
--      JEFE DE VENTAS —el administrador con área 'ventas'; hoy, Sara—.
--      La IA pregunta qué busca y lo califica en su nombre.
--   2. Cuando agenda una cita, la conversación pasa al ASESOR con el que
--      agendó (hoy, Alex). Antes no: a un asesor se le pasa gente que ya
--      dijo qué quiere y quiere verlo.
--   3. Si a las 24 horas de empezar a hablar todavía no se pasó, se le
--      pasa igual al asesor menos cargado: nadie se queda sin asesor.
--   4. El jefe de ventas ve a quién se le pasó, cuándo y por qué:
--        delegated_at, delegated_from, delegation_reason
--      ('agendo' | '24h' | 'manual'). Ya podía ver esas conversaciones
--      (055: ve lo de ventas y lo de los asesores sin área).
--
-- Sin jefe de ventas en la cuenta, nada cambia: el reparto de 055/060.
--
-- Idempotente — se puede volver a correr. Requiere 055 y 060.
-- ============================================================

-- ============================================================
-- 1. El rastro del pase
-- ============================================================
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS delegated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delegated_from UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delegation_reason TEXT;

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_delegation_reason_check;
ALTER TABLE conversations
  ADD CONSTRAINT conversations_delegation_reason_check
  CHECK (delegation_reason IS NULL OR delegation_reason IN ('agendo', '24h', 'manual'));

-- Las que el jefe todavía tiene sin pasar: lo que mira el cron cada pasada.
CREATE INDEX IF NOT EXISTS idx_conversations_por_delegar
  ON conversations(account_id, created_at)
  WHERE delegated_at IS NULL;

-- ============================================================
-- 2. Quién es quién en ventas
-- ============================================================
CREATE OR REPLACE FUNCTION es_jefe_de_ventas(p_account_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
     WHERE p.account_id = p_account_id
       AND p.user_id = p_user_id
       AND p.account_role = 'admin'
       AND p.area = 'ventas'
  );
$$;

-- El jefe de ventas de la cuenta (si hubiera dos, el más antiguo).
CREATE OR REPLACE FUNCTION pick_sales_head(p_account_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id
    FROM profiles p
   WHERE p.account_id = p_account_id
     AND p.account_role = 'admin'
     AND p.area = 'ventas'
   ORDER BY p.created_at
   LIMIT 1;
$$;

-- El asesor de ventas menos cargado: los asesores, no el jefe.
CREATE OR REPLACE FUNCTION pick_sales_advisor(p_account_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id
    FROM profiles p
   WHERE p.account_id = p_account_id
     AND p.account_role = 'agent'
     AND (p.area IS NULL OR p.area = 'ventas')
   ORDER BY (
     SELECT count(*)
       FROM conversations c
      WHERE c.account_id = p_account_id
        AND c.assigned_agent_id = p.user_id
        AND c.status <> 'closed'
   ), p.created_at
   LIMIT 1;
$$;

ALTER FUNCTION es_jefe_de_ventas(UUID, UUID) OWNER TO postgres;
ALTER FUNCTION pick_sales_head(UUID) OWNER TO postgres;
ALTER FUNCTION pick_sales_advisor(UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION es_jefe_de_ventas(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION pick_sales_head(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION pick_sales_advisor(UUID) TO service_role;

-- ============================================================
-- 3. El prospecto nuevo nace del jefe de ventas
--
-- Igual que 055 salvo una línea: en ventas se elige primero al jefe.
-- ============================================================
CREATE OR REPLACE FUNCTION assign_new_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restrict BOOLEAN;
  v_auto     BOOLEAN;
  v_area     TEXT;
  v_elegido  UUID;
BEGIN
  IF NEW.assigned_agent_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT agents_see_only_assigned, auto_assign_new_conversations
    INTO v_restrict, v_auto
    FROM accounts
    WHERE id = NEW.account_id;

  -- La abrió alguien del equipo desde el CRM: es suya.
  IF auth.uid() IS NOT NULL THEN
    IF COALESCE(v_restrict, false)
       AND NOT is_account_member(NEW.account_id, 'admin') THEN
      NEW.assigned_agent_id := auth.uid();
    END IF;
    RETURN NEW;
  END IF;

  IF NOT COALESCE(v_auto, false) THEN
    RETURN NEW;
  END IF;

  v_area := CASE
    WHEN NEW.contact_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM payment_plans pp
       WHERE pp.contact_id = NEW.contact_id
         AND pp.status IN ('activo', 'pagado')
    ) THEN 'cobranzas'
    ELSE 'ventas'
  END;

  -- 062: el prospecto lo califica primero el jefe de ventas.
  IF v_area = 'ventas' THEN
    v_elegido := pick_sales_head(NEW.account_id);
  END IF;

  IF v_elegido IS NULL THEN
    v_elegido := pick_area_agent(NEW.account_id, v_area);
  END IF;

  -- Nadie en esa área todavía: el reparto de siempre antes que dejarlo
  -- sin dueño, que es como nadie se entera.
  IF v_elegido IS NULL THEN
    v_elegido := pick_account_agent(NEW.account_id);
  END IF;

  NEW.assigned_agent_id := v_elegido;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca impedir que entre un mensaje porque el reparto falló.
  RAISE WARNING 'assign_new_conversation failed for account %: %', NEW.account_id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION assign_new_conversation() OWNER TO postgres;

-- ============================================================
-- 4. Todo pase del jefe a otro queda anotado
--
-- Lo haga la IA al agendar, el cron a las 24 h o el jefe a mano desde el
-- chat: si la conversación deja al jefe de ventas y todavía no se había
-- pasado, se anota quién la tenía y cuándo salió. Así ningún camino se
-- salta el rastro.
-- ============================================================
CREATE OR REPLACE FUNCTION anotar_delegacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_agent_id IS DISTINCT FROM OLD.assigned_agent_id
     AND OLD.assigned_agent_id IS NOT NULL
     AND NEW.assigned_agent_id IS NOT NULL
     AND OLD.delegated_at IS NULL
     AND es_jefe_de_ventas(NEW.account_id, OLD.assigned_agent_id) THEN
    NEW.delegated_at := NOW();
    NEW.delegated_from := OLD.assigned_agent_id;
    NEW.delegation_reason := COALESCE(NEW.delegation_reason, 'manual');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'anotar_delegacion failed for conversation %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION anotar_delegacion() OWNER TO postgres;

DROP TRIGGER IF EXISTS anotar_delegacion ON conversations;
CREATE TRIGGER anotar_delegacion
  BEFORE UPDATE OF assigned_agent_id ON conversations
  FOR EACH ROW EXECUTE FUNCTION anotar_delegacion();

-- ============================================================
-- 5. Pasar una conversación del jefe a un asesor
--
-- Sólo si la tiene el jefe de ventas y no se pasó antes: nunca se le
-- quita un cliente a un asesor que ya lo atiende. Sin p_asesor, al menos
-- cargado. Devuelve a quién se le pasó, o NULL si no correspondía.
-- ============================================================
CREATE OR REPLACE FUNCTION delegar_conversacion(
  p_conversation_id UUID,
  p_motivo TEXT,
  p_asesor UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv    conversations%ROWTYPE;
  v_asesor  UUID;
BEGIN
  SELECT * INTO v_conv FROM conversations WHERE id = p_conversation_id FOR UPDATE;
  IF NOT FOUND
     OR v_conv.delegated_at IS NOT NULL
     OR v_conv.assigned_agent_id IS NULL
     OR NOT es_jefe_de_ventas(v_conv.account_id, v_conv.assigned_agent_id) THEN
    RETURN NULL;
  END IF;

  v_asesor := COALESCE(p_asesor, pick_sales_advisor(v_conv.account_id));
  -- Sin asesores, o la cita quedó con el propio jefe: se queda con él.
  IF v_asesor IS NULL OR v_asesor = v_conv.assigned_agent_id THEN
    RETURN NULL;
  END IF;

  -- El trigger de arriba pone delegated_at y delegated_from.
  UPDATE conversations
     SET assigned_agent_id = v_asesor,
         delegation_reason = p_motivo
   WHERE id = p_conversation_id;
  RETURN v_asesor;
END;
$$;

-- ============================================================
-- 6. Las que llevan 24 horas sin pasarse
--
-- La llama el cron de recordatorios. Devuelve lo que pasó, para avisarle
-- al asesor.
-- ============================================================
CREATE OR REPLACE FUNCTION delegar_vencidas(p_horas INT DEFAULT 24)
RETURNS TABLE (conversation_id UUID, account_id UUID, agent_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_c      RECORD;
  v_asesor UUID;
BEGIN
  FOR v_c IN
    SELECT c.id, c.account_id
      FROM conversations c
     WHERE c.delegated_at IS NULL
       AND c.assigned_agent_id IS NOT NULL
       AND c.status <> 'closed'
       AND c.created_at < NOW() - make_interval(hours => p_horas)
       AND es_jefe_de_ventas(c.account_id, c.assigned_agent_id)
     LIMIT 200
  LOOP
    v_asesor := delegar_conversacion(v_c.id, '24h');
    IF v_asesor IS NOT NULL THEN
      conversation_id := v_c.id;
      account_id := v_c.account_id;
      agent_id := v_asesor;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

ALTER FUNCTION delegar_conversacion(UUID, TEXT, UUID) OWNER TO postgres;
ALTER FUNCTION delegar_vencidas(INT) OWNER TO postgres;
REVOKE ALL ON FUNCTION delegar_conversacion(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION delegar_vencidas(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION delegar_conversacion(UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION delegar_vencidas(INT) TO service_role;

COMMENT ON COLUMN conversations.delegated_at IS
  'Cuándo el jefe de ventas pasó esta conversación a un asesor (062). NULL: no se pasó.';
COMMENT ON COLUMN conversations.delegation_reason IS
  'Por qué se pasó: agendo (el prospecto agendó), 24h (nadie la pasó en un día), manual (el jefe la reasignó).';
