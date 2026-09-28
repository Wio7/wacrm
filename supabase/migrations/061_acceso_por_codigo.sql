-- ============================================================
-- 061_acceso_por_codigo.sql — entrar a la app con un código por WhatsApp
--
-- El caso: alguien llega de un anuncio, escribe por WhatsApp y queda en
-- el CRM sin DNI. Cuando abre la Golden App y quiere crear su acceso, el
-- registro no puede darle la ficha que ya existe —quien conozca su número
-- vería su chat— y hasta ahora le mandaba de vuelta a WhatsApp a pedir
-- acceso a un asesor.
--
-- Ahora la app pide un código de 6 dígitos y el CRM se lo manda a ESE
-- WhatsApp. Quien lo escribe demuestra que el número es suyo; entonces su
-- DNI queda en la ficha que ya tenía y entra con la misma conversación.
--
-- Sólo se guarda el hash del código. Vence a los 10 minutos, sirve una
-- vez y se anula a los 5 intentos fallidos. Sin políticas RLS: sólo el
-- servidor (service role) la lee o la escribe, igual que client_sessions.
--
-- Idempotente — se puede volver a correr. Requiere 045.
-- ============================================================

CREATE TABLE IF NOT EXISTS client_access_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  -- Dígitos del celular tal como los escribió, igual que client_login_attempts.
  phone_digits TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_client_access_codes_phone
  ON client_access_codes(phone_digits, created_at DESC);

ALTER TABLE client_access_codes ENABLE ROW LEVEL SECURITY;
