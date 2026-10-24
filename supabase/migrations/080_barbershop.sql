-- ============================================================
-- 080_barbershop.sql - Barberia multi-tenant (Xdel)
--
-- Todos los datos viven dentro de una cuenta de WIOCRM. Los clientes
-- reutilizan public.contacts; anon solo entra por las RPC publicas.
-- Idempotente para facilitar su revision y ejecucion local repetida.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- 1. Catalogo, agenda y lista de espera
-- ============================================================
CREATE TABLE IF NOT EXISTS public.barber_barbers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  profile_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name           text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 100),
  photo_url      text,
  active         boolean NOT NULL DEFAULT true,
  pay_model      text NOT NULL CHECK (pay_model IN ('commission', 'rent')),
  commission_pct numeric(5,2),
  weekly_rent    numeric(12,2),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT barber_barbers_payment_check CHECK (
    (pay_model = 'commission'
      AND commission_pct IS NOT NULL
      AND commission_pct BETWEEN 0 AND 100
      AND weekly_rent IS NULL)
    OR
    (pay_model = 'rent'
      AND commission_pct IS NULL
      AND weekly_rent IS NOT NULL
      AND weekly_rent >= 0)
  ),
  UNIQUE (profile_id)
);

CREATE INDEX IF NOT EXISTS barber_barbers_account_id_idx
  ON public.barber_barbers(account_id);

CREATE TABLE IF NOT EXISTS public.barber_services (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name         text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 100),
  duration_min integer NOT NULL CHECK (duration_min BETWEEN 5 AND 480),
  price        numeric(12,2) NOT NULL CHECK (price >= 0),
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS barber_services_account_id_idx
  ON public.barber_services(account_id);

CREATE TABLE IF NOT EXISTS public.barber_availability (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  barber_id  uuid NOT NULL REFERENCES public.barber_barbers(id) ON DELETE CASCADE,
  weekday    smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  starts_at  time NOT NULL,
  ends_at    time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  UNIQUE (barber_id, weekday)
);

CREATE INDEX IF NOT EXISTS barber_availability_account_id_idx
  ON public.barber_availability(account_id);

CREATE TABLE IF NOT EXISTS public.barber_blocks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  barber_id  uuid NOT NULL REFERENCES public.barber_barbers(id) ON DELETE CASCADE,
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS barber_blocks_account_id_idx
  ON public.barber_blocks(account_id);
CREATE INDEX IF NOT EXISTS barber_blocks_barber_starts_idx
  ON public.barber_blocks(barber_id, starts_at);

CREATE TABLE IF NOT EXISTS public.barber_appointments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  contact_id     uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  -- NULL representa "cualquiera" antes de asignar un barbero.
  barber_id      uuid REFERENCES public.barber_barbers(id) ON DELETE RESTRICT,
  service_id     uuid NOT NULL REFERENCES public.barber_services(id) ON DELETE RESTRICT,
  starts_at      timestamptz NOT NULL,
  ends_at        timestamptz NOT NULL,
  status         text NOT NULL DEFAULT 'reserved'
                   CHECK (status IN ('reserved', 'confirmed', 'attended', 'no_show', 'cancelled')),
  source         text NOT NULL CHECK (source IN ('app', 'whatsapp', 'walk_in')),
  price_charged  numeric(12,2) CHECK (price_charged IS NULL OR price_charged >= 0),
  tip            numeric(12,2) NOT NULL DEFAULT 0 CHECK (tip >= 0),
  payment_method text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CONSTRAINT barber_appointments_no_overlap EXCLUDE USING gist (
    account_id WITH =,
    barber_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (barber_id IS NOT NULL AND status NOT IN ('cancelled', 'no_show'))
);

CREATE INDEX IF NOT EXISTS barber_appointments_account_id_idx
  ON public.barber_appointments(account_id);
CREATE INDEX IF NOT EXISTS barber_appointments_contact_idx
  ON public.barber_appointments(contact_id, starts_at);
CREATE INDEX IF NOT EXISTS barber_appointments_service_idx
  ON public.barber_appointments(service_id, starts_at);
CREATE INDEX IF NOT EXISTS barber_appointments_barber_idx
  ON public.barber_appointments(barber_id, starts_at);

CREATE TABLE IF NOT EXISTS public.barber_waitlist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.barber_services(id) ON DELETE RESTRICT,
  barber_id  uuid REFERENCES public.barber_barbers(id) ON DELETE SET NULL,
  date       date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS barber_waitlist_account_id_idx
  ON public.barber_waitlist(account_id);
CREATE INDEX IF NOT EXISTS barber_waitlist_date_idx
  ON public.barber_waitlist(account_id, date);

-- Rechaza relaciones cruzadas aunque un administrador escriba directo.
CREATE OR REPLACE FUNCTION public.barber_validate_account_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'barber_barbers' THEN
    IF NEW.profile_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = NEW.profile_id AND p.account_id = NEW.account_id
    ) THEN
      RAISE EXCEPTION 'El perfil no pertenece a la cuenta de la barberia'
        USING ERRCODE = '23503';
    END IF;
  ELSE
    IF NEW.barber_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.barber_barbers b
      WHERE b.id = NEW.barber_id AND b.account_id = NEW.account_id
    ) THEN
      RAISE EXCEPTION 'El barbero no pertenece a la cuenta'
        USING ERRCODE = '23503';
    END IF;
  END IF;

  IF TG_TABLE_NAME IN ('barber_appointments', 'barber_waitlist') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.barber_services s
      WHERE s.id = NEW.service_id AND s.account_id = NEW.account_id
    ) THEN
      RAISE EXCEPTION 'El servicio no pertenece a la cuenta'
        USING ERRCODE = '23503';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = NEW.contact_id AND c.account_id = NEW.account_id
    ) THEN
      RAISE EXCEPTION 'El contacto no pertenece a la cuenta'
        USING ERRCODE = '23503';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.barber_validate_account_scope() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.barber_validate_account_scope() FROM PUBLIC;

DROP TRIGGER IF EXISTS barber_barbers_validate_account ON public.barber_barbers;
CREATE TRIGGER barber_barbers_validate_account
  BEFORE INSERT OR UPDATE ON public.barber_barbers
  FOR EACH ROW EXECUTE FUNCTION public.barber_validate_account_scope();

DROP TRIGGER IF EXISTS barber_availability_validate_account ON public.barber_availability;
CREATE TRIGGER barber_availability_validate_account
  BEFORE INSERT OR UPDATE ON public.barber_availability
  FOR EACH ROW EXECUTE FUNCTION public.barber_validate_account_scope();

DROP TRIGGER IF EXISTS barber_blocks_validate_account ON public.barber_blocks;
CREATE TRIGGER barber_blocks_validate_account
  BEFORE INSERT OR UPDATE ON public.barber_blocks
  FOR EACH ROW EXECUTE FUNCTION public.barber_validate_account_scope();

DROP TRIGGER IF EXISTS barber_appointments_validate_account ON public.barber_appointments;
CREATE TRIGGER barber_appointments_validate_account
  BEFORE INSERT OR UPDATE ON public.barber_appointments
  FOR EACH ROW EXECUTE FUNCTION public.barber_validate_account_scope();

DROP TRIGGER IF EXISTS barber_waitlist_validate_account ON public.barber_waitlist;
CREATE TRIGGER barber_waitlist_validate_account
  BEFORE INSERT OR UPDATE ON public.barber_waitlist
  FOR EACH ROW EXECUTE FUNCTION public.barber_validate_account_scope();

DROP TRIGGER IF EXISTS barber_barbers_updated_at ON public.barber_barbers;
CREATE TRIGGER barber_barbers_updated_at
  BEFORE UPDATE ON public.barber_barbers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS barber_services_updated_at ON public.barber_services;
CREATE TRIGGER barber_services_updated_at
  BEFORE UPDATE ON public.barber_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS barber_appointments_updated_at ON public.barber_appointments;
CREATE TRIGGER barber_appointments_updated_at
  BEFORE UPDATE ON public.barber_appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. RLS y edicion limitada del barbero
-- ============================================================
CREATE OR REPLACE FUNCTION public.barber_is_own_appointment(
  p_account_id uuid,
  p_barber_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_account_member(p_account_id, 'agent')
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.barber_barbers b
        ON b.profile_id = p.id
       AND b.account_id = p.account_id
      WHERE p.user_id = auth.uid()
        AND p.account_id = p_account_id
        AND p.account_role = 'agent'
        AND b.id = p_barber_id
    );
$$;

ALTER FUNCTION public.barber_is_own_appointment(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.barber_is_own_appointment(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.barber_is_own_appointment(uuid, uuid)
  TO authenticated, service_role;

ALTER TABLE public.barber_barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS barber_barbers_select ON public.barber_barbers;
CREATE POLICY barber_barbers_select ON public.barber_barbers FOR SELECT
  USING (public.is_account_member(account_id));
DROP POLICY IF EXISTS barber_barbers_write ON public.barber_barbers;
CREATE POLICY barber_barbers_write ON public.barber_barbers FOR ALL
  USING (public.is_account_member(account_id, 'admin'))
  WITH CHECK (public.is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS barber_services_select ON public.barber_services;
CREATE POLICY barber_services_select ON public.barber_services FOR SELECT
  USING (public.is_account_member(account_id));
DROP POLICY IF EXISTS barber_services_write ON public.barber_services;
CREATE POLICY barber_services_write ON public.barber_services FOR ALL
  USING (public.is_account_member(account_id, 'admin'))
  WITH CHECK (public.is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS barber_availability_select ON public.barber_availability;
CREATE POLICY barber_availability_select ON public.barber_availability FOR SELECT
  USING (public.is_account_member(account_id));
DROP POLICY IF EXISTS barber_availability_write ON public.barber_availability;
CREATE POLICY barber_availability_write ON public.barber_availability FOR ALL
  USING (public.is_account_member(account_id, 'admin'))
  WITH CHECK (public.is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS barber_blocks_select ON public.barber_blocks;
CREATE POLICY barber_blocks_select ON public.barber_blocks FOR SELECT
  USING (public.is_account_member(account_id));
DROP POLICY IF EXISTS barber_blocks_write ON public.barber_blocks;
CREATE POLICY barber_blocks_write ON public.barber_blocks FOR ALL
  USING (public.is_account_member(account_id, 'admin'))
  WITH CHECK (public.is_account_member(account_id, 'admin'));

-- Owners/admins see everything; an agent linked as barber sees only
-- their appointments. Viewers keep the module-wide read permission.
DROP POLICY IF EXISTS barber_appointments_select ON public.barber_appointments;
CREATE POLICY barber_appointments_select ON public.barber_appointments FOR SELECT
  USING (
    public.is_account_member(account_id, 'admin')
    OR public.barber_is_own_appointment(account_id, barber_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.account_id = barber_appointments.account_id
        AND p.account_role = 'viewer'
        AND public.is_account_member(p.account_id)
    )
  );

DROP POLICY IF EXISTS barber_appointments_insert ON public.barber_appointments;
CREATE POLICY barber_appointments_insert ON public.barber_appointments FOR INSERT
  WITH CHECK (public.is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS barber_appointments_update_admin ON public.barber_appointments;
CREATE POLICY barber_appointments_update_admin ON public.barber_appointments FOR UPDATE
  USING (public.is_account_member(account_id, 'admin'))
  WITH CHECK (public.is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS barber_appointments_update_own ON public.barber_appointments;
CREATE POLICY barber_appointments_update_own ON public.barber_appointments FOR UPDATE
  USING (public.barber_is_own_appointment(account_id, barber_id))
  WITH CHECK (public.barber_is_own_appointment(account_id, barber_id));

DROP POLICY IF EXISTS barber_appointments_delete ON public.barber_appointments;
CREATE POLICY barber_appointments_delete ON public.barber_appointments FOR DELETE
  USING (public.is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS barber_waitlist_select ON public.barber_waitlist;
CREATE POLICY barber_waitlist_select ON public.barber_waitlist FOR SELECT
  USING (public.is_account_member(account_id));
DROP POLICY IF EXISTS barber_waitlist_write ON public.barber_waitlist;
CREATE POLICY barber_waitlist_write ON public.barber_waitlist FOR ALL
  USING (public.is_account_member(account_id, 'admin'))
  WITH CHECK (public.is_account_member(account_id, 'admin'));

CREATE OR REPLACE FUNCTION public.barber_limit_agent_appointment_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.barber_is_own_appointment(OLD.account_id, OLD.barber_id)
     AND NOT public.is_account_member(OLD.account_id, 'admin')
     AND (
       NEW.account_id IS DISTINCT FROM OLD.account_id
       OR NEW.contact_id IS DISTINCT FROM OLD.contact_id
       OR NEW.barber_id IS DISTINCT FROM OLD.barber_id
       OR NEW.service_id IS DISTINCT FROM OLD.service_id
       OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
       OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
       OR NEW.source IS DISTINCT FROM OLD.source
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.updated_at IS DISTINCT FROM OLD.updated_at
     ) THEN
    RAISE EXCEPTION 'Un barbero solo puede cambiar estado, precio cobrado, propina y metodo de pago'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS barber_appointments_limit_agent_update ON public.barber_appointments;
CREATE TRIGGER barber_appointments_limit_agent_update
  BEFORE UPDATE ON public.barber_appointments
  FOR EACH ROW EXECUTE FUNCTION public.barber_limit_agent_appointment_update();

REVOKE ALL ON public.barber_barbers, public.barber_services,
  public.barber_availability, public.barber_blocks,
  public.barber_appointments, public.barber_waitlist FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barber_barbers,
  public.barber_services, public.barber_availability, public.barber_blocks,
  public.barber_appointments, public.barber_waitlist TO authenticated;

-- ============================================================
-- 3. Reporte semanal (lunes, zona America/Lima)
-- ============================================================
CREATE OR REPLACE VIEW public.barber_weekly_report
WITH (security_invoker = true)
AS
SELECT
  a.account_id,
  date_trunc('week', a.starts_at AT TIME ZONE 'America/Lima')::date AS week,
  b.id AS barber_id,
  b.name AS barber_name,
  b.pay_model,
  count(*)::bigint AS cuts,
  sum(coalesce(a.price_charged, 0))::numeric(14,2) AS total_charged,
  sum(coalesce(a.tip, 0))::numeric(14,2) AS tips,
  CASE b.pay_model
    WHEN 'commission' THEN
      (sum(coalesce(a.price_charged, 0)) * b.commission_pct / 100)::numeric(14,2)
    WHEN 'rent' THEN
      (sum(coalesce(a.price_charged, 0)) - b.weekly_rent)::numeric(14,2)
  END AS barber_share,
  CASE b.pay_model
    WHEN 'commission' THEN
      (sum(coalesce(a.price_charged, 0))
        - sum(coalesce(a.price_charged, 0)) * b.commission_pct / 100)::numeric(14,2)
    WHEN 'rent' THEN b.weekly_rent::numeric(14,2)
  END AS shop_net
FROM public.barber_appointments a
JOIN public.barber_barbers b
  ON b.id = a.barber_id AND b.account_id = a.account_id
WHERE a.status = 'attended'
GROUP BY
  a.account_id,
  date_trunc('week', a.starts_at AT TIME ZONE 'America/Lima')::date,
  b.id,
  b.name,
  b.pay_model,
  b.commission_pct,
  b.weekly_rent;

REVOKE ALL ON public.barber_weekly_report FROM PUBLIC, anon;
GRANT SELECT ON public.barber_weekly_report TO authenticated;

-- ============================================================
-- 4. RPC publicas para la app Xdel
-- ============================================================
CREATE OR REPLACE FUNCTION public.barber_available_slots(
  p_account_id uuid,
  p_service_id uuid,
  p_date date,
  p_barber_id uuid DEFAULT NULL
)
RETURNS TABLE (
  barber_id uuid,
  barber_name text,
  starts_at timestamptz,
  ends_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duration integer;
BEGIN
  IF p_account_id IS NULL OR p_service_id IS NULL OR p_date IS NULL THEN
    RAISE EXCEPTION 'La cuenta, el servicio y la fecha son obligatorios'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = p_account_id AND a.status = 'active'
  ) THEN
    RAISE EXCEPTION 'La cuenta no existe o no esta activa'
      USING ERRCODE = '22023';
  END IF;

  SELECT s.duration_min INTO v_duration
  FROM public.barber_services s
  WHERE s.id = p_service_id
    AND s.account_id = p_account_id
    AND s.active;

  IF v_duration IS NULL THEN
    RAISE EXCEPTION 'El servicio no existe, no pertenece a la cuenta o no esta activo'
      USING ERRCODE = '22023';
  END IF;

  IF p_barber_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.barber_barbers b
    WHERE b.id = p_barber_id
      AND b.account_id = p_account_id
      AND b.active
  ) THEN
    RAISE EXCEPTION 'El barbero no existe, no pertenece a la cuenta o no esta activo'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.name,
    slot.value,
    slot.value + make_interval(mins => v_duration)
  FROM public.barber_availability av
  JOIN public.barber_barbers b
    ON b.id = av.barber_id
   AND b.account_id = av.account_id
   AND b.active
  CROSS JOIN LATERAL generate_series(
    (p_date + av.starts_at) AT TIME ZONE 'America/Lima',
    (p_date + av.ends_at) AT TIME ZONE 'America/Lima'
      - make_interval(mins => v_duration),
    interval '15 minutes'
  ) AS slot(value)
  WHERE av.account_id = p_account_id
    AND av.weekday = extract(dow FROM p_date)::smallint
    AND (p_barber_id IS NULL OR b.id = p_barber_id)
    AND slot.value >= now()
    AND NOT EXISTS (
      SELECT 1 FROM public.barber_blocks bl
      WHERE bl.account_id = p_account_id
        AND bl.barber_id = b.id
        AND tstzrange(bl.starts_at, bl.ends_at, '[)')
          && tstzrange(slot.value, slot.value + make_interval(mins => v_duration), '[)')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.barber_appointments ap
      WHERE ap.account_id = p_account_id
        AND ap.barber_id = b.id
        AND ap.status NOT IN ('cancelled', 'no_show')
        AND tstzrange(ap.starts_at, ap.ends_at, '[)')
          && tstzrange(slot.value, slot.value + make_interval(mins => v_duration), '[)')
    )
  ORDER BY slot.value, b.name, b.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.barber_create_booking(
  p_account_id uuid,
  p_service_id uuid,
  p_barber_id uuid,
  p_starts_at timestamptz,
  p_name text,
  p_phone text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_barber_id uuid;
  v_contact_id uuid;
  v_appointment_id uuid;
  v_duration integer;
  v_phone_normalized text;
  v_owner_user_id uuid;
BEGIN
  IF p_account_id IS NULL OR p_service_id IS NULL OR p_starts_at IS NULL THEN
    RAISE EXCEPTION 'La cuenta, el servicio y el horario son obligatorios'
      USING ERRCODE = '22023';
  END IF;
  IF char_length(btrim(coalesce(p_name, ''))) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'El nombre debe tener entre 2 y 80 caracteres'
      USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_phone, '') !~ '^\+[0-9]{8,15}$' THEN
    RAISE EXCEPTION 'El WhatsApp debe tener formato E.164, por ejemplo +51999999999'
      USING ERRCODE = '22023';
  END IF;

  SELECT a.owner_user_id INTO v_owner_user_id
  FROM public.accounts a
  WHERE a.id = p_account_id AND a.status = 'active';
  IF v_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'La cuenta no existe o no esta activa'
      USING ERRCODE = '22023';
  END IF;

  SELECT s.duration_min INTO v_duration
  FROM public.barber_services s
  WHERE s.id = p_service_id
    AND s.account_id = p_account_id
    AND s.active;
  IF v_duration IS NULL THEN
    RAISE EXCEPTION 'El servicio no existe, no pertenece a la cuenta o no esta activo'
      USING ERRCODE = '22023';
  END IF;

  IF p_barber_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.barber_barbers b
    WHERE b.id = p_barber_id
      AND b.account_id = p_account_id
      AND b.active
  ) THEN
    RAISE EXCEPTION 'El barbero no existe, no pertenece a la cuenta o no esta activo'
      USING ERRCODE = '22023';
  END IF;

  SELECT available.barber_id INTO v_barber_id
  FROM public.barber_available_slots(
    p_account_id,
    p_service_id,
    (p_starts_at AT TIME ZONE 'America/Lima')::date,
    p_barber_id
  ) available
  WHERE available.starts_at = p_starts_at
  ORDER BY (
    SELECT count(*)
    FROM public.barber_appointments ap
    WHERE ap.account_id = p_account_id
      AND ap.barber_id = available.barber_id
      AND ap.status NOT IN ('cancelled', 'no_show')
      AND (ap.starts_at AT TIME ZONE 'America/Lima')::date
        = (p_starts_at AT TIME ZONE 'America/Lima')::date
  ), available.barber_id
  LIMIT 1;

  IF v_barber_id IS NULL THEN
    RAISE EXCEPTION 'El horario seleccionado ya no esta disponible'
      USING ERRCODE = 'P0001';
  END IF;

  v_phone_normalized := regexp_replace(p_phone, '\D', '', 'g');
  -- Serializa las reservas del mismo telefono/cuenta para que dos
  -- solicitudes simultaneas no salten el limite de dos.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_account_id::text || ':' || v_phone_normalized, 0)
  );

  IF (
    SELECT count(*)
    FROM public.barber_appointments ap
    JOIN public.contacts c ON c.id = ap.contact_id
    WHERE ap.account_id = p_account_id
      AND c.account_id = p_account_id
      AND c.phone_normalized = v_phone_normalized
      AND ap.status IN ('reserved', 'confirmed')
      AND ap.starts_at >= now()
  ) >= 2 THEN
    RAISE EXCEPTION 'Ya tienes 2 reservas activas. Escribenos por WhatsApp para cambiarlas.'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT c.id INTO v_contact_id
  FROM public.contacts c
  WHERE c.account_id = p_account_id
    AND c.phone_normalized = v_phone_normalized
  ORDER BY c.created_at, c.id
  LIMIT 1;

  IF v_contact_id IS NULL THEN
    BEGIN
      INSERT INTO public.contacts (account_id, user_id, phone, name)
      VALUES (p_account_id, v_owner_user_id, p_phone, btrim(p_name))
      RETURNING id INTO v_contact_id;
    EXCEPTION WHEN unique_violation THEN
      SELECT c.id INTO v_contact_id
      FROM public.contacts c
      WHERE c.account_id = p_account_id
        AND c.phone_normalized = v_phone_normalized
      ORDER BY c.created_at, c.id
      LIMIT 1;
    END;
  END IF;

  BEGIN
    INSERT INTO public.barber_appointments (
      account_id, contact_id, barber_id, service_id,
      starts_at, ends_at, status, source
    ) VALUES (
      p_account_id, v_contact_id, v_barber_id, p_service_id,
      p_starts_at, p_starts_at + make_interval(mins => v_duration),
      'reserved', 'app'
    )
    RETURNING id INTO v_appointment_id;
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'El horario acaba de ser reservado. Elige otro horario.'
      USING ERRCODE = 'P0001';
  END;

  RETURN v_appointment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.barber_join_waitlist(
  p_account_id uuid,
  p_service_id uuid,
  p_date date,
  p_name text,
  p_phone text,
  p_barber_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
  v_waitlist_id uuid;
  v_phone_normalized text;
  v_owner_user_id uuid;
BEGIN
  IF p_account_id IS NULL OR p_service_id IS NULL OR p_date IS NULL THEN
    RAISE EXCEPTION 'La cuenta, el servicio y la fecha son obligatorios'
      USING ERRCODE = '22023';
  END IF;
  IF char_length(btrim(coalesce(p_name, ''))) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'El nombre debe tener entre 2 y 80 caracteres'
      USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_phone, '') !~ '^\+[0-9]{8,15}$' THEN
    RAISE EXCEPTION 'El WhatsApp debe tener formato E.164, por ejemplo +51999999999'
      USING ERRCODE = '22023';
  END IF;

  SELECT a.owner_user_id INTO v_owner_user_id
  FROM public.accounts a
  WHERE a.id = p_account_id AND a.status = 'active';
  IF v_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'La cuenta no existe o no esta activa'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.barber_services s
    WHERE s.id = p_service_id
      AND s.account_id = p_account_id
      AND s.active
  ) THEN
    RAISE EXCEPTION 'El servicio no existe, no pertenece a la cuenta o no esta activo'
      USING ERRCODE = '22023';
  END IF;
  IF p_barber_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.barber_barbers b
    WHERE b.id = p_barber_id
      AND b.account_id = p_account_id
      AND b.active
  ) THEN
    RAISE EXCEPTION 'El barbero no existe, no pertenece a la cuenta o no esta activo'
      USING ERRCODE = '22023';
  END IF;

  v_phone_normalized := regexp_replace(p_phone, '\D', '', 'g');
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_account_id::text || ':' || v_phone_normalized, 0)
  );

  SELECT c.id INTO v_contact_id
  FROM public.contacts c
  WHERE c.account_id = p_account_id
    AND c.phone_normalized = v_phone_normalized
  ORDER BY c.created_at, c.id
  LIMIT 1;

  IF v_contact_id IS NULL THEN
    BEGIN
      INSERT INTO public.contacts (account_id, user_id, phone, name)
      VALUES (p_account_id, v_owner_user_id, p_phone, btrim(p_name))
      RETURNING id INTO v_contact_id;
    EXCEPTION WHEN unique_violation THEN
      SELECT c.id INTO v_contact_id
      FROM public.contacts c
      WHERE c.account_id = p_account_id
        AND c.phone_normalized = v_phone_normalized
      ORDER BY c.created_at, c.id
      LIMIT 1;
    END;
  END IF;

  INSERT INTO public.barber_waitlist (
    account_id, contact_id, service_id, barber_id, date
  ) VALUES (
    p_account_id, v_contact_id, p_service_id, p_barber_id, p_date
  )
  RETURNING id INTO v_waitlist_id;

  RETURN v_waitlist_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.barber_public_catalog(p_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_services jsonb;
  v_barbers jsonb;
BEGIN
  IF p_account_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = p_account_id AND a.status = 'active'
  ) THEN
    RAISE EXCEPTION 'La cuenta no existe o no esta activa'
      USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'duration_min', s.duration_min,
      'price', s.price
    ) ORDER BY s.name, s.id
  ), '[]'::jsonb)
  INTO v_services
  FROM public.barber_services s
  WHERE s.account_id = p_account_id AND s.active;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'photo_url', b.photo_url
    ) ORDER BY b.name, b.id
  ), '[]'::jsonb)
  INTO v_barbers
  FROM public.barber_barbers b
  WHERE b.account_id = p_account_id AND b.active;

  RETURN jsonb_build_object('services', v_services, 'barbers', v_barbers);
END;
$$;

ALTER FUNCTION public.barber_available_slots(uuid, uuid, date, uuid) OWNER TO postgres;
ALTER FUNCTION public.barber_create_booking(uuid, uuid, uuid, timestamptz, text, text) OWNER TO postgres;
ALTER FUNCTION public.barber_join_waitlist(uuid, uuid, date, text, text, uuid) OWNER TO postgres;
ALTER FUNCTION public.barber_public_catalog(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.barber_available_slots(uuid, uuid, date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.barber_create_booking(uuid, uuid, uuid, timestamptz, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.barber_join_waitlist(uuid, uuid, date, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.barber_public_catalog(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.barber_available_slots(uuid, uuid, date, uuid)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.barber_create_booking(uuid, uuid, uuid, timestamptz, text, text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.barber_join_waitlist(uuid, uuid, date, text, text, uuid)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.barber_public_catalog(uuid)
  TO anon, authenticated;

COMMENT ON VIEW public.barber_weekly_report IS
  'Reporte por cuenta, semana de Lima y barbero; las propinas se muestran aparte.';
COMMENT ON FUNCTION public.barber_create_booking(uuid, uuid, uuid, timestamptz, text, text) IS
  'Reserva publica Xdel: reutiliza contacts por telefono normalizado y asigna "cualquiera" por menor carga diaria.';
