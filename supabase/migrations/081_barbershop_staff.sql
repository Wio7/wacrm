-- ============================================================
-- 081_barbershop_staff.sql - RPC del panel de personal Xdel
-- ============================================================

-- Los walk-ins pueden no tener telefono ni contacto CRM.
ALTER TABLE public.barber_appointments
  ALTER COLUMN contact_id DROP NOT NULL;

-- Mantiene el aislamiento por cuenta de 080 y admite un contacto ausente.
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
    IF NEW.contact_id IS NOT NULL AND NOT EXISTS (
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

-- Contexto minimo para decidir que panel mostrar en la app movil.
CREATE OR REPLACE FUNCTION public.barber_staff_context(p_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_barber_id uuid;
  v_barber_name text;
BEGIN
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'La cuenta es obligatoria'
      USING ERRCODE = '22023';
  END IF;

  v_is_admin := public.is_account_member(p_account_id, 'admin');

  SELECT b.id, b.name
  INTO v_barber_id, v_barber_name
  FROM public.profiles p
  JOIN public.barber_barbers b
    ON b.profile_id = p.id
   AND b.account_id = p.account_id
  WHERE p.user_id = auth.uid()
    AND p.account_id = p_account_id
    AND b.active
  ORDER BY b.id
  LIMIT 1;

  IF NOT v_is_admin AND v_barber_id IS NULL THEN
    RAISE EXCEPTION 'No tienes acceso a esta barbería'
      USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'is_admin', v_is_admin,
    'barber_id', v_barber_id,
    'barber_name', v_barber_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.barber_staff_agenda(
  p_account_id uuid,
  p_date date,
  p_barber_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  source text,
  service_id uuid,
  service_name text,
  service_price numeric,
  barber_id uuid,
  barber_name text,
  client_name text,
  client_phone text,
  price_charged numeric,
  tip numeric,
  payment_method text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_caller_barber_id uuid;
BEGIN
  IF p_account_id IS NULL OR p_date IS NULL THEN
    RAISE EXCEPTION 'La cuenta y la fecha son obligatorias'
      USING ERRCODE = '22023';
  END IF;

  v_is_admin := public.is_account_member(p_account_id, 'admin');

  SELECT b.id
  INTO v_caller_barber_id
  FROM public.profiles p
  JOIN public.barber_barbers b
    ON b.profile_id = p.id
   AND b.account_id = p.account_id
  WHERE p.user_id = auth.uid()
    AND p.account_id = p_account_id
    AND b.active
  ORDER BY b.id
  LIMIT 1;

  IF NOT v_is_admin AND v_caller_barber_id IS NULL THEN
    RAISE EXCEPTION 'No tienes acceso a esta barbería'
      USING ERRCODE = '42501';
  END IF;

  IF v_is_admin AND p_barber_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.barber_barbers b
    WHERE b.id = p_barber_id
      AND b.account_id = p_account_id
  ) THEN
    RAISE EXCEPTION 'El barbero no pertenece a esta barbería'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.starts_at,
    a.ends_at,
    a.status,
    a.source,
    s.id,
    s.name,
    s.price,
    b.id,
    b.name,
    c.name,
    c.phone,
    a.price_charged,
    a.tip,
    a.payment_method
  FROM public.barber_appointments a
  JOIN public.barber_services s
    ON s.id = a.service_id
   AND s.account_id = a.account_id
  LEFT JOIN public.barber_barbers b
    ON b.id = a.barber_id
   AND b.account_id = a.account_id
  LEFT JOIN public.contacts c
    ON c.id = a.contact_id
   AND c.account_id = a.account_id
  WHERE a.account_id = p_account_id
    AND a.starts_at >= (p_date::timestamp AT TIME ZONE 'America/Lima')
    AND a.starts_at < ((p_date + 1)::timestamp AT TIME ZONE 'America/Lima')
    AND (
      (v_is_admin AND (p_barber_id IS NULL OR a.barber_id = p_barber_id))
      OR
      (NOT v_is_admin AND a.barber_id = v_caller_barber_id)
    )
  ORDER BY a.starts_at, a.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.barber_close_appointment(
  p_account_id uuid,
  p_appointment_id uuid,
  p_status text,
  p_price numeric DEFAULT NULL,
  p_tip numeric DEFAULT 0,
  p_payment_method text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_caller_barber_id uuid;
  v_appointment_barber_id uuid;
  v_service_price numeric;
  v_price numeric;
BEGIN
  IF p_account_id IS NULL OR p_appointment_id IS NULL THEN
    RAISE EXCEPTION 'La cuenta y la cita son obligatorias'
      USING ERRCODE = '22023';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('attended', 'no_show', 'cancelled') THEN
    RAISE EXCEPTION 'El estado debe ser attended, no_show o cancelled'
      USING ERRCODE = '22023';
  END IF;

  v_is_admin := public.is_account_member(p_account_id, 'admin');

  SELECT b.id
  INTO v_caller_barber_id
  FROM public.profiles p
  JOIN public.barber_barbers b
    ON b.profile_id = p.id
   AND b.account_id = p.account_id
  WHERE p.user_id = auth.uid()
    AND p.account_id = p_account_id
    AND b.active
  ORDER BY b.id
  LIMIT 1;

  IF NOT v_is_admin AND v_caller_barber_id IS NULL THEN
    RAISE EXCEPTION 'No tienes acceso a esta barbería'
      USING ERRCODE = '42501';
  END IF;

  SELECT a.barber_id, s.price
  INTO v_appointment_barber_id, v_service_price
  FROM public.barber_appointments a
  JOIN public.barber_services s
    ON s.id = a.service_id
   AND s.account_id = a.account_id
  WHERE a.id = p_appointment_id
    AND a.account_id = p_account_id
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La cita no existe o no pertenece a esta barbería'
      USING ERRCODE = '22023';
  END IF;
  IF NOT v_is_admin AND v_appointment_barber_id IS DISTINCT FROM v_caller_barber_id THEN
    RAISE EXCEPTION 'Solo puedes cerrar tus propias citas'
      USING ERRCODE = '42501';
  END IF;

  IF p_status = 'attended' THEN
    v_price := coalesce(p_price, v_service_price);
    IF v_price IS NULL OR v_price < 0 THEN
      RAISE EXCEPTION 'El precio cobrado es obligatorio y no puede ser negativo'
        USING ERRCODE = '22023';
    END IF;
    IF p_tip IS NULL OR p_tip < 0 THEN
      RAISE EXCEPTION 'La propina no puede ser negativa'
        USING ERRCODE = '22023';
    END IF;
    IF p_payment_method IS NULL
       OR p_payment_method NOT IN ('efectivo', 'yape', 'plin', 'tarjeta', 'transferencia') THEN
      RAISE EXCEPTION 'El método de pago debe ser efectivo, yape, plin, tarjeta o transferencia'
        USING ERRCODE = '22023';
    END IF;

    UPDATE public.barber_appointments
    SET status = 'attended',
        price_charged = v_price,
        tip = p_tip,
        payment_method = p_payment_method
    WHERE id = p_appointment_id
      AND account_id = p_account_id;
  ELSE
    UPDATE public.barber_appointments
    SET status = p_status,
        price_charged = NULL,
        tip = 0,
        payment_method = NULL
    WHERE id = p_appointment_id
      AND account_id = p_account_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.barber_register_walk_in(
  p_account_id uuid,
  p_service_id uuid,
  p_barber_id uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_price numeric DEFAULT NULL,
  p_tip numeric DEFAULT 0,
  p_payment_method text DEFAULT 'efectivo'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_caller_barber_id uuid;
  v_barber_id uuid;
  v_contact_id uuid;
  v_appointment_id uuid;
  v_duration integer;
  v_service_price numeric;
  v_price numeric;
  v_phone_normalized text;
  v_owner_user_id uuid;
  v_now timestamptz := now();
BEGIN
  IF p_account_id IS NULL OR p_service_id IS NULL THEN
    RAISE EXCEPTION 'La cuenta y el servicio son obligatorios'
      USING ERRCODE = '22023';
  END IF;

  v_is_admin := public.is_account_member(p_account_id, 'admin');

  SELECT b.id
  INTO v_caller_barber_id
  FROM public.profiles p
  JOIN public.barber_barbers b
    ON b.profile_id = p.id
   AND b.account_id = p.account_id
  WHERE p.user_id = auth.uid()
    AND p.account_id = p_account_id
    AND b.active
  ORDER BY b.id
  LIMIT 1;

  IF NOT v_is_admin AND v_caller_barber_id IS NULL THEN
    RAISE EXCEPTION 'No tienes acceso a esta barbería'
      USING ERRCODE = '42501';
  END IF;

  IF v_is_admin THEN
    IF p_barber_id IS NULL THEN
      RAISE EXCEPTION 'Debes elegir un barbero'
        USING ERRCODE = '22023';
    END IF;
    v_barber_id := p_barber_id;
  ELSE
    IF p_barber_id IS NOT NULL AND p_barber_id IS DISTINCT FROM v_caller_barber_id THEN
      RAISE EXCEPTION 'Solo puedes registrar atenciones para ti mismo'
        USING ERRCODE = '42501';
    END IF;
    v_barber_id := v_caller_barber_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.barber_barbers b
    WHERE b.id = v_barber_id
      AND b.account_id = p_account_id
      AND b.active
  ) THEN
    RAISE EXCEPTION 'El barbero no existe, no pertenece a la cuenta o no está activo'
      USING ERRCODE = '22023';
  END IF;

  SELECT s.duration_min, s.price
  INTO v_duration, v_service_price
  FROM public.barber_services s
  WHERE s.id = p_service_id
    AND s.account_id = p_account_id
    AND s.active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El servicio no existe, no pertenece a la cuenta o no está activo'
      USING ERRCODE = '22023';
  END IF;

  v_price := coalesce(p_price, v_service_price);
  IF v_price IS NULL OR v_price < 0 THEN
    RAISE EXCEPTION 'El precio cobrado es obligatorio y no puede ser negativo'
      USING ERRCODE = '22023';
  END IF;
  IF p_tip IS NULL OR p_tip < 0 THEN
    RAISE EXCEPTION 'La propina no puede ser negativa'
      USING ERRCODE = '22023';
  END IF;
  IF p_payment_method IS NULL
     OR p_payment_method NOT IN ('efectivo', 'yape', 'plin', 'tarjeta', 'transferencia') THEN
    RAISE EXCEPTION 'El método de pago debe ser efectivo, yape, plin, tarjeta o transferencia'
      USING ERRCODE = '22023';
  END IF;
  IF p_name IS NOT NULL AND char_length(btrim(p_name)) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'El nombre debe tener entre 2 y 80 caracteres'
      USING ERRCODE = '22023';
  END IF;

  IF p_phone IS NOT NULL THEN
    IF p_phone !~ '^\+[0-9]{8,15}$' THEN
      RAISE EXCEPTION 'El WhatsApp debe tener formato E.164, por ejemplo +51999999999'
        USING ERRCODE = '22023';
    END IF;

    SELECT a.owner_user_id
    INTO v_owner_user_id
    FROM public.accounts a
    WHERE a.id = p_account_id
      AND a.status = 'active';

    IF v_owner_user_id IS NULL THEN
      RAISE EXCEPTION 'La cuenta no existe o no está activa'
        USING ERRCODE = '22023';
    END IF;

    v_phone_normalized := regexp_replace(p_phone, '\D', '', 'g');
    PERFORM pg_advisory_xact_lock(
      hashtextextended(p_account_id::text || ':' || v_phone_normalized, 0)
    );

    SELECT c.id
    INTO v_contact_id
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
        SELECT c.id
        INTO v_contact_id
        FROM public.contacts c
        WHERE c.account_id = p_account_id
          AND c.phone_normalized = v_phone_normalized
        ORDER BY c.created_at, c.id
        LIMIT 1;
      END;
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.barber_appointments (
      account_id, contact_id, barber_id, service_id,
      starts_at, ends_at, status, source,
      price_charged, tip, payment_method
    ) VALUES (
      p_account_id, v_contact_id, v_barber_id, p_service_id,
      v_now, v_now + make_interval(mins => v_duration), 'attended', 'walk_in',
      v_price, p_tip, p_payment_method
    )
    RETURNING id INTO v_appointment_id;
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'Ese barbero tiene una cita en este momento. Ciérrala o elige otro barbero.'
      USING ERRCODE = 'P0001';
  END;

  RETURN v_appointment_id;
END;
$$;

ALTER FUNCTION public.barber_staff_context(uuid) OWNER TO postgres;
ALTER FUNCTION public.barber_staff_agenda(uuid, date, uuid) OWNER TO postgres;
ALTER FUNCTION public.barber_close_appointment(uuid, uuid, text, numeric, numeric, text) OWNER TO postgres;
ALTER FUNCTION public.barber_register_walk_in(uuid, uuid, uuid, text, text, numeric, numeric, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.barber_staff_context(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.barber_staff_agenda(uuid, date, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.barber_close_appointment(uuid, uuid, text, numeric, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.barber_register_walk_in(uuid, uuid, uuid, text, text, numeric, numeric, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.barber_staff_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.barber_staff_agenda(uuid, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.barber_close_appointment(uuid, uuid, text, numeric, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.barber_register_walk_in(uuid, uuid, uuid, text, text, numeric, numeric, text) TO authenticated;

COMMENT ON FUNCTION public.barber_staff_context(uuid) IS
  'Devuelve el rol administrativo y el barbero activo vinculado al usuario autenticado.';
COMMENT ON FUNCTION public.barber_staff_agenda(uuid, date, uuid) IS
  'Agenda interna por día de Lima; administradores ven la cuenta y barberos solo sus citas.';
COMMENT ON FUNCTION public.barber_close_appointment(uuid, uuid, text, numeric, numeric, text) IS
  'Cierra una cita propia o administrada y registra su resultado y cobro.';
COMMENT ON FUNCTION public.barber_register_walk_in(uuid, uuid, uuid, text, text, numeric, numeric, text) IS
  'Registra una atención walk-in ya cobrada, con contacto CRM opcional.';
