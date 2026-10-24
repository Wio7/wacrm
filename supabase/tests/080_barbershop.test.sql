BEGIN;

-- Usuarios y cuentas aisladas para la prueba. Se desactiva solo el trigger
-- de bootstrap durante estos INSERT para poder usar UUID fijos.
SET LOCAL session_replication_role = replica;
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('80000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'barber-owner-a@test.local', '', '{}'::jsonb, '{"full_name":"Owner A"}'::jsonb, now(), now()),
  ('80000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'barber-owner-b@test.local', '', '{}'::jsonb, '{"full_name":"Owner B"}'::jsonb, now(), now()),
  ('80000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'barber-agent-a@test.local', '', '{}'::jsonb, '{"full_name":"Barbero A"}'::jsonb, now(), now());
SET LOCAL session_replication_role = origin;

INSERT INTO public.accounts (id, name, owner_user_id, status) VALUES
  ('81000000-0000-0000-0000-000000000001', 'Barber Test A', '80000000-0000-0000-0000-000000000001', 'active'),
  ('81000000-0000-0000-0000-000000000002', 'Barber Test B', '80000000-0000-0000-0000-000000000002', 'active');

INSERT INTO public.profiles (
  id, user_id, full_name, email, account_id, account_role
) VALUES
  ('82000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'Owner A', 'barber-owner-a@test.local', '81000000-0000-0000-0000-000000000001', 'owner'),
  ('82000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002', 'Owner B', 'barber-owner-b@test.local', '81000000-0000-0000-0000-000000000002', 'owner'),
  ('82000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000003', 'Barbero A', 'barber-agent-a@test.local', '81000000-0000-0000-0000-000000000001', 'agent');

INSERT INTO public.barber_barbers (
  id, account_id, profile_id, name, pay_model, commission_pct, weekly_rent
) VALUES
  ('83000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000003', 'Comision Uno', 'commission', 50, NULL),
  ('83000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000001', NULL, 'Renta Dos', 'rent', NULL, 300),
  ('83000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000002', NULL, 'Cuenta B', 'commission', 40, NULL);

INSERT INTO public.barber_services (
  id, account_id, name, duration_min, price
) VALUES
  ('84000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'Corte Test A', 30, 30),
  ('84000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000002', 'Corte Test B', 30, 35);

INSERT INTO public.barber_availability (
  account_id, barber_id, weekday, starts_at, ends_at
) VALUES
  ('81000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', 1, '10:00', '14:00'),
  ('81000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000002', 1, '10:00', '14:00'),
  ('81000000-0000-0000-0000-000000000002', '83000000-0000-0000-0000-000000000003', 1, '10:00', '14:00');

INSERT INTO public.contacts (
  id, account_id, user_id, name, phone
) VALUES
  ('85000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'Cliente Uno', '+51910000001'),
  ('85000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'Cliente Dos', '+51910000002');

-- Matematica semanal: propinas separadas y solo citas attended.
INSERT INTO public.barber_appointments (
  id, account_id, contact_id, barber_id, service_id,
  starts_at, ends_at, status, source, price_charged, tip, payment_method
) VALUES
  ('86000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001', '2027-01-04 15:00:00-05', '2027-01-04 15:30:00-05', 'attended', 'app', 40, 5, 'cash'),
  ('86000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000002', '83000000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001', '2027-01-04 15:30:00-05', '2027-01-04 16:00:00-05', 'attended', 'whatsapp', 60, 10, 'yape'),
  ('86000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000002', '84000000-0000-0000-0000-000000000001', '2027-01-04 15:00:00-05', '2027-01-04 15:30:00-05', 'attended', 'walk_in', 200, 10, 'card'),
  ('86000000-0000-0000-0000-000000000004', '81000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000002', '83000000-0000-0000-0000-000000000002', '84000000-0000-0000-0000-000000000001', '2027-01-04 15:30:00-05', '2027-01-04 16:00:00-05', 'attended', 'app', 300, 20, 'cash'),
  ('86000000-0000-0000-0000-000000000005', '81000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000002', '83000000-0000-0000-0000-000000000002', '84000000-0000-0000-0000-000000000001', '2027-01-04 15:30:00-05', '2027-01-04 16:00:00-05', 'cancelled', 'app', 999, 999, 'cash');

DO $$
DECLARE v_row record;
BEGIN
  SELECT * INTO v_row
  FROM public.barber_weekly_report
  WHERE account_id = '81000000-0000-0000-0000-000000000001'
    AND week = date '2027-01-04'
    AND barber_id = '83000000-0000-0000-0000-000000000001';
  IF NOT FOUND OR v_row.cuts <> 2 OR v_row.total_charged <> 100
     OR v_row.tips <> 15 OR v_row.barber_share <> 50
     OR v_row.shop_net <> 50 THEN
    RAISE EXCEPTION 'Calculo semanal por comision incorrecto: %', row_to_json(v_row);
  END IF;
END;
$$;

DO $$
DECLARE v_row record;
BEGIN
  SELECT * INTO v_row
  FROM public.barber_weekly_report
  WHERE account_id = '81000000-0000-0000-0000-000000000001'
    AND week = date '2027-01-04'
    AND barber_id = '83000000-0000-0000-0000-000000000002';
  IF NOT FOUND OR v_row.cuts <> 2 OR v_row.total_charged <> 500
     OR v_row.tips <> 30 OR v_row.barber_share <> 200
     OR v_row.shop_net <> 300 THEN
    RAISE EXCEPTION 'Calculo semanal por renta incorrecto: %', row_to_json(v_row);
  END IF;
END;
$$;

-- Reserva inicial que debe desaparecer de slots y bloquear solapamientos.
INSERT INTO public.barber_appointments (
  account_id, contact_id, barber_id, service_id,
  starts_at, ends_at, status, source
) VALUES (
  '81000000-0000-0000-0000-000000000001',
  '85000000-0000-0000-0000-000000000001',
  '83000000-0000-0000-0000-000000000001',
  '84000000-0000-0000-0000-000000000001',
  '2027-01-04 10:00:00-05', '2027-01-04 10:30:00-05', 'reserved', 'app'
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.barber_available_slots(
      '81000000-0000-0000-0000-000000000001',
      '84000000-0000-0000-0000-000000000001',
      date '2027-01-04',
      '83000000-0000-0000-0000-000000000001'
    ) WHERE starts_at = timestamptz '2027-01-04 10:00:00-05'
  ) THEN
    RAISE EXCEPTION 'Slots incluyo un horario reservado';
  END IF;
END;
$$;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.barber_appointments (
      account_id, contact_id, barber_id, service_id,
      starts_at, ends_at, status, source
    ) VALUES (
      '81000000-0000-0000-0000-000000000001',
      '85000000-0000-0000-0000-000000000002',
      '83000000-0000-0000-0000-000000000001',
      '84000000-0000-0000-0000-000000000001',
      '2027-01-04 10:15:00-05', '2027-01-04 10:45:00-05', 'confirmed', 'whatsapp'
    );
    RAISE EXCEPTION 'Se permitio una cita solapada';
  EXCEPTION
    WHEN exclusion_violation THEN NULL;
    WHEN OTHERS THEN
      IF SQLERRM = 'Se permitio una cita solapada' THEN RAISE; END IF;
      RAISE EXCEPTION 'Error inesperado al probar solapamiento: %', SQLERRM;
  END;
END;
$$;

DO $$
DECLARE v_id uuid;
BEGIN
  v_id := public.barber_create_booking(
    '81000000-0000-0000-0000-000000000001',
    '84000000-0000-0000-0000-000000000001',
    '83000000-0000-0000-0000-000000000001',
    '2027-01-04 11:00:00-05', 'Cliente Nuevo', '+51910000003'
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.barber_appointments
    WHERE id = v_id AND account_id = '81000000-0000-0000-0000-000000000001'
      AND status = 'reserved' AND source = 'app'
      AND ends_at = timestamptz '2027-01-04 11:30:00-05'
  ) THEN
    RAISE EXCEPTION 'barber_create_booking no creo la cita esperada';
  END IF;
END;
$$;

DO $$
BEGIN
  BEGIN
    PERFORM public.barber_create_booking(
      '81000000-0000-0000-0000-000000000001',
      '84000000-0000-0000-0000-000000000001',
      '83000000-0000-0000-0000-000000000001',
      '2027-01-04 11:00:00-05', 'Cliente Doble', '+51910000004'
    );
    RAISE EXCEPTION 'Se permitio reservar dos veces el mismo horario';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Se permitio reservar dos veces el mismo horario' THEN RAISE; END IF;
    IF SQLERRM <> 'El horario seleccionado ya no esta disponible' THEN
      RAISE EXCEPTION 'Error inesperado en doble reserva: %', SQLERRM;
    END IF;
  END;
END;
$$;

DO $$
BEGIN
  BEGIN
    PERFORM public.barber_create_booking(
      '81000000-0000-0000-0000-000000000001',
      '84000000-0000-0000-0000-000000000001',
      '83000000-0000-0000-0000-000000000001',
      '2027-01-04 11:30:00-05', 'Telefono Invalido', '910000005'
    );
    RAISE EXCEPTION 'Se acepto un telefono sin E.164';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Se acepto un telefono sin E.164' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE 'El WhatsApp debe tener formato E.164%' THEN
      RAISE EXCEPTION 'Error inesperado para telefono invalido: %', SQLERRM;
    END IF;
  END;
END;
$$;

-- "Cualquiera" debe elegir al de menor carga. El primero ya tiene dos
-- reservas activas (10:00 y 11:00); el segundo no tiene ninguna activa.
DO $$
DECLARE v_id uuid; v_barber uuid;
BEGIN
  v_id := public.barber_create_booking(
    '81000000-0000-0000-0000-000000000001',
    '84000000-0000-0000-0000-000000000001', NULL,
    '2027-01-04 12:00:00-05', 'Cliente Cualquiera', '+51910000006'
  );
  SELECT barber_id INTO v_barber FROM public.barber_appointments WHERE id = v_id;
  IF v_barber <> '83000000-0000-0000-0000-000000000002' THEN
    RAISE EXCEPTION 'Cualquiera no eligio al barbero con menor carga: %', v_barber;
  END IF;
END;
$$;

-- Dos reservas futuras activas por telefono; la tercera se rechaza.
DO $$
BEGIN
  PERFORM public.barber_create_booking(
    '81000000-0000-0000-0000-000000000001',
    '84000000-0000-0000-0000-000000000001',
    '83000000-0000-0000-0000-000000000001',
    '2027-01-04 12:30:00-05', 'Nombre Original', '+51910000007'
  );
  PERFORM public.barber_create_booking(
    '81000000-0000-0000-0000-000000000001',
    '84000000-0000-0000-0000-000000000001',
    '83000000-0000-0000-0000-000000000001',
    '2027-01-04 13:00:00-05', 'Nombre Alterado', '+51910000007'
  );

  IF (SELECT name FROM public.contacts
      WHERE account_id = '81000000-0000-0000-0000-000000000001'
        AND phone_normalized = '51910000007') <> 'Nombre Original' THEN
    RAISE EXCEPTION 'Una reserva posterior sobrescribio el nombre del contacto';
  END IF;

  BEGIN
    PERFORM public.barber_create_booking(
      '81000000-0000-0000-0000-000000000001',
      '84000000-0000-0000-0000-000000000001',
      '83000000-0000-0000-0000-000000000001',
      '2027-01-04 13:30:00-05', 'Spam Tres', '+51910000007'
    );
    RAISE EXCEPTION 'Se permitieron mas de dos reservas activas';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Se permitieron mas de dos reservas activas' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE 'Ya tienes 2 reservas activas%' THEN
      RAISE EXCEPTION 'Error inesperado para limite anti-spam: %', SQLERRM;
    END IF;
  END;
END;
$$;

-- Una cuenta no puede usar el UUID de servicio de otra cuenta.
DO $$
BEGIN
  BEGIN
    PERFORM public.barber_create_booking(
      '81000000-0000-0000-0000-000000000002',
      '84000000-0000-0000-0000-000000000001', NULL,
      '2027-01-04 11:00:00-05', 'Cruce Cuenta', '+51910000008'
    );
    RAISE EXCEPTION 'Se permitio reservar un servicio de otra cuenta';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Se permitio reservar un servicio de otra cuenta' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE 'El servicio no existe, no pertenece a la cuenta%' THEN
      RAISE EXCEPTION 'Error inesperado en aislamiento cruzado: %', SQLERRM;
    END IF;
  END;
END;
$$;

ROLLBACK;
