BEGIN;

-- Fixtures aislados. Se desactiva solo el trigger de bootstrap para conservar
-- UUID fijos, igual que en 080_barbershop.test.sql.
SET LOCAL session_replication_role = replica;
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('91000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'staff-owner-a@test.local', '', '{}'::jsonb, '{"full_name":"Admin A"}'::jsonb, now(), now()),
  ('91000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'staff-barber-a1@test.local', '', '{}'::jsonb, '{"full_name":"Barbero A1"}'::jsonb, now(), now()),
  ('91000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'staff-barber-a2@test.local', '', '{}'::jsonb, '{"full_name":"Barbero A2"}'::jsonb, now(), now()),
  ('91000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'staff-owner-b@test.local', '', '{}'::jsonb, '{"full_name":"Admin B"}'::jsonb, now(), now());
SET LOCAL session_replication_role = origin;

INSERT INTO public.accounts (id, name, owner_user_id, status) VALUES
  ('91100000-0000-0000-0000-000000000001', 'Staff Test A', '91000000-0000-0000-0000-000000000001', 'active'),
  ('91100000-0000-0000-0000-000000000002', 'Staff Test B', '91000000-0000-0000-0000-000000000004', 'active');

INSERT INTO public.profiles (
  id, user_id, full_name, email, account_id, account_role
) VALUES
  ('91200000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'Admin A', 'staff-owner-a@test.local', '91100000-0000-0000-0000-000000000001', 'owner'),
  ('91200000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000002', 'Barbero A1', 'staff-barber-a1@test.local', '91100000-0000-0000-0000-000000000001', 'agent'),
  ('91200000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000003', 'Barbero A2', 'staff-barber-a2@test.local', '91100000-0000-0000-0000-000000000001', 'agent'),
  ('91200000-0000-0000-0000-000000000004', '91000000-0000-0000-0000-000000000004', 'Admin B', 'staff-owner-b@test.local', '91100000-0000-0000-0000-000000000002', 'owner');

INSERT INTO public.barber_barbers (
  id, account_id, profile_id, name, pay_model, commission_pct, weekly_rent
) VALUES
  ('91300000-0000-0000-0000-000000000001', '91100000-0000-0000-0000-000000000001', '91200000-0000-0000-0000-000000000002', 'Barbero Uno', 'commission', 50, NULL),
  ('91300000-0000-0000-0000-000000000002', '91100000-0000-0000-0000-000000000001', '91200000-0000-0000-0000-000000000003', 'Barbero Dos', 'rent', NULL, 200),
  ('91300000-0000-0000-0000-000000000003', '91100000-0000-0000-0000-000000000002', NULL, 'Barbero Cuenta B', 'commission', 40, NULL);

INSERT INTO public.barber_services (
  id, account_id, name, duration_min, price
) VALUES
  ('91400000-0000-0000-0000-000000000001', '91100000-0000-0000-0000-000000000001', 'Corte Staff', 30, 25),
  ('91400000-0000-0000-0000-000000000002', '91100000-0000-0000-0000-000000000002', 'Corte Cuenta B', 45, 35);

INSERT INTO public.contacts (
  id, account_id, user_id, name, phone
) VALUES
  ('91500000-0000-0000-0000-000000000001', '91100000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'Cliente Uno', '+51920000001'),
  ('91500000-0000-0000-0000-000000000002', '91100000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'Cliente Dos', '+51920000002');

INSERT INTO public.barber_appointments (
  id, account_id, contact_id, barber_id, service_id,
  starts_at, ends_at, status, source
) VALUES
  ('91600000-0000-0000-0000-000000000001', '91100000-0000-0000-0000-000000000001', '91500000-0000-0000-0000-000000000001', '91300000-0000-0000-0000-000000000001', '91400000-0000-0000-0000-000000000001', '2099-01-05 10:00:00-05', '2099-01-05 10:30:00-05', 'confirmed', 'app'),
  ('91600000-0000-0000-0000-000000000002', '91100000-0000-0000-0000-000000000001', '91500000-0000-0000-0000-000000000002', '91300000-0000-0000-0000-000000000002', '91400000-0000-0000-0000-000000000001', '2099-01-05 11:00:00-05', '2099-01-05 11:30:00-05', 'reserved', 'whatsapp'),
  ('91600000-0000-0000-0000-000000000003', '91100000-0000-0000-0000-000000000001', '91500000-0000-0000-0000-000000000001', NULL, '91400000-0000-0000-0000-000000000001', '2099-01-05 12:00:00-05', '2099-01-05 12:30:00-05', 'reserved', 'app');

-- Contexto de administrador.
SELECT set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_context jsonb;
BEGIN
  v_context := public.barber_staff_context('91100000-0000-0000-0000-000000000001');
  IF (v_context->>'is_admin')::boolean IS DISTINCT FROM true
     OR v_context->>'barber_id' IS NOT NULL
     OR v_context->>'barber_name' IS NOT NULL THEN
    RAISE EXCEPTION 'Contexto de administrador incorrecto: %', v_context;
  END IF;
END;
$$;

-- El administrador ve las dos citas asignadas y la cita "cualquiera".
DO $$
DECLARE v_count integer; v_any integer;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE barber_id IS NULL)
  INTO v_count, v_any
  FROM public.barber_staff_agenda(
    '91100000-0000-0000-0000-000000000001', date '2099-01-05'
  );
  IF v_count <> 3 OR v_any <> 1 THEN
    RAISE EXCEPTION 'Agenda de administrador incorrecta: total %, cualquiera %', v_count, v_any;
  END IF;
END;
$$;
RESET ROLE;

-- Contexto y agenda del primer barbero.
SELECT set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000002', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_context jsonb;
BEGIN
  v_context := public.barber_staff_context('91100000-0000-0000-0000-000000000001');
  IF (v_context->>'is_admin')::boolean IS DISTINCT FROM false
     OR (v_context->>'barber_id')::uuid IS DISTINCT FROM '91300000-0000-0000-0000-000000000001'::uuid
     OR v_context->>'barber_name' IS DISTINCT FROM 'Barbero Uno' THEN
    RAISE EXCEPTION 'Contexto de barbero incorrecto: %', v_context;
  END IF;
END;
$$;

-- Aunque solicite otro UUID, un barbero siempre recibe solo su agenda.
DO $$
DECLARE v_count integer; v_expected integer;
BEGIN
  SELECT count(*), count(*) FILTER (
    WHERE id = '91600000-0000-0000-0000-000000000001'::uuid
  )
  INTO v_count, v_expected
  FROM public.barber_staff_agenda(
    '91100000-0000-0000-0000-000000000001',
    date '2099-01-05',
    '91300000-0000-0000-0000-000000000002'
  );
  IF v_count <> 1 OR v_expected <> 1 THEN
    RAISE EXCEPTION 'La agenda del barbero expuso citas ajenas: total %, propias %', v_count, v_expected;
  END IF;
END;
$$;

-- Cierre de cita propia: toma el precio del servicio si p_price es NULL.
DO $$
BEGIN
  PERFORM public.barber_close_appointment(
    '91100000-0000-0000-0000-000000000001',
    '91600000-0000-0000-0000-000000000001',
    'attended', NULL, 0, 'efectivo'
  );
  IF NOT EXISTS (
    SELECT 1
    FROM public.barber_appointments
    WHERE id = '91600000-0000-0000-0000-000000000001'
      AND status = 'attended'
      AND price_charged = 25
      AND tip = 0
      AND payment_method = 'efectivo'
  ) THEN
    RAISE EXCEPTION 'El cierre propio no guardo el precio por defecto';
  END IF;
END;
$$;

-- Un barbero no puede cerrar la cita de otro.
DO $$
BEGIN
  BEGIN
    PERFORM public.barber_close_appointment(
      '91100000-0000-0000-0000-000000000001',
      '91600000-0000-0000-0000-000000000002',
      'cancelled'
    );
    RAISE EXCEPTION 'Se permitio cerrar una cita de otro barbero';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Se permitio cerrar una cita de otro barbero' THEN RAISE; END IF;
    IF SQLERRM <> 'Solo puedes cerrar tus propias citas' THEN
      RAISE EXCEPTION 'Error inesperado al cerrar una cita ajena: %', SQLERRM;
    END IF;
  END;
END;
$$;

-- Metodo de pago fuera del contrato.
DO $$
BEGIN
  BEGIN
    PERFORM public.barber_close_appointment(
      '91100000-0000-0000-0000-000000000001',
      '91600000-0000-0000-0000-000000000001',
      'attended', 25, 0, 'cash'
    );
    RAISE EXCEPTION 'Se acepto un metodo de pago invalido';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Se acepto un metodo de pago invalido' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE 'El método de pago debe ser%' THEN
      RAISE EXCEPTION 'Error inesperado para metodo de pago invalido: %', SQLERRM;
    END IF;
  END;
END;
$$;

-- Walk-in propio sin telefono: no crea contacto y aparece en el reporte semanal.
DO $$
DECLARE
  v_id uuid;
  v_week date := date_trunc('week', now() AT TIME ZONE 'America/Lima')::date;
  v_row record;
BEGIN
  v_id := public.barber_register_walk_in(
    p_account_id => '91100000-0000-0000-0000-000000000001',
    p_service_id => '91400000-0000-0000-0000-000000000001',
    p_name => 'Cliente sin teléfono'
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.barber_appointments
    WHERE id = v_id
      AND contact_id IS NULL
      AND barber_id = '91300000-0000-0000-0000-000000000001'
      AND status = 'attended'
      AND source = 'walk_in'
      AND price_charged = 25
      AND payment_method = 'efectivo'
  ) THEN
    RAISE EXCEPTION 'El walk-in sin telefono no se registro correctamente';
  END IF;

  SELECT * INTO v_row
  FROM public.barber_weekly_report
  WHERE account_id = '91100000-0000-0000-0000-000000000001'
    AND week = v_week
    AND barber_id = '91300000-0000-0000-0000-000000000001';

  IF NOT FOUND OR v_row.cuts <> 1 OR v_row.total_charged <> 25 THEN
    RAISE EXCEPTION 'El reporte semanal no refleja el walk-in: %', row_to_json(v_row);
  END IF;
END;
$$;
RESET ROLE;

-- Un administrador debe indicar barbero al registrar un walk-in.
SELECT set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.barber_register_walk_in(
      '91100000-0000-0000-0000-000000000001',
      '91400000-0000-0000-0000-000000000001'
    );
    RAISE EXCEPTION 'Se permitio un walk-in administrativo sin barbero';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Se permitio un walk-in administrativo sin barbero' THEN RAISE; END IF;
    IF SQLERRM <> 'Debes elegir un barbero' THEN
      RAISE EXCEPTION 'Error inesperado para walk-in sin barbero: %', SQLERRM;
    END IF;
  END;
END;
$$;
RESET ROLE;

-- Un barbero de A no obtiene contexto ni datos de la cuenta B.
SELECT set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000002', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.barber_staff_context('91100000-0000-0000-0000-000000000002');
    RAISE EXCEPTION 'Se permitio acceso cruzado a otra cuenta';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Se permitio acceso cruzado a otra cuenta' THEN RAISE; END IF;
    IF SQLERRM <> 'No tienes acceso a esta barbería' THEN
      RAISE EXCEPTION 'Error inesperado para acceso cruzado: %', SQLERRM;
    END IF;
  END;
END;
$$;
RESET ROLE;

ROLLBACK;
