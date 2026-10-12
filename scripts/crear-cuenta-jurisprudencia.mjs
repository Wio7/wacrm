#!/usr/bin/env node
// ============================================================
// scripts/crear-cuenta-jurisprudencia.mjs
//
// Da de alta a un cliente del módulo de Jurisprudencia: una cuenta
// propia, separada de las demás, con un único usuario que entra por la
// app y nunca al CRM.
//
//   1. Crea el usuario en Auth (el trigger handle_new_user le arma su
//      cuenta y su perfil).
//   2. Le pone a la cuenta el nombre del cliente.
//   3. Baja su rol a 'usuario_app' (migración 066): deja de contar como
//      miembro para el CRM.
//   4. Enciende el módulo 'jurisprudencia' en su cuenta (067).
//
// Se puede volver a correr con el mismo correo: si el usuario ya
// existe, repite los pasos 2 a 4 y no toca su contraseña.
//
// Requiere las migraciones 066–070 aplicadas y la service-role key (se
// salta RLS: es para correr una vez desde una máquina de confianza).
//
// La contraseña inicial va en JURIS_PASSWORD y no como argumento, para
// que no quede en el historial de la terminal.
//
// Uso:
//   JURIS_PASSWORD='...' node --env-file=.env.local \
//     scripts/crear-cuenta-jurisprudencia.mjs "Christian Linares" correo@ejemplo.com
// ============================================================

import { createClient } from '@supabase/supabase-js';

const MODULO = 'jurisprudencia';

const [nombre, correo] = process.argv.slice(2);
if (!nombre || !correo) {
  console.error(
    'Uso: node scripts/crear-cuenta-jurisprudencia.mjs "<nombre del cliente>" <correo>'
  );
  process.exit(1);
}
const email = correo.trim().toLowerCase();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    'Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno.'
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function salir(paso, error) {
  console.error(`✗ ${paso}: ${error?.message ?? error}`);
  process.exit(1);
}

async function perfilDe(filtro) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, account_id, account_role')
    .match(filtro)
    .maybeSingle();
  if (error) salir('leer el perfil', error);
  return data;
}

let perfil = await perfilDe({ email });

if (perfil) {
  if (
    perfil.account_role !== 'owner' &&
    perfil.account_role !== 'usuario_app'
  ) {
    // Es integrante del equipo de otra cuenta: convertirlo aquí lo
    // sacaría de su trabajo. Eso se decide a mano, no con un script.
    salir(
      'revisar el usuario',
      `${email} ya existe como '${perfil.account_role}' en otra cuenta`
    );
  }
  console.log(`· ${email} ya existe; se actualiza su cuenta.`);
} else {
  const password = process.env.JURIS_PASSWORD;
  if (!password || password.length < 10) {
    salir(
      'crear el usuario',
      'pon la contraseña inicial en JURIS_PASSWORD (10 caracteres o más)'
    );
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: nombre, name: nombre },
  });
  if (error) salir('crear el usuario', error);

  // El perfil lo inserta el trigger; puede tardar un instante.
  for (let i = 0; i < 10 && !perfil?.account_id; i++) {
    await new Promise((r) => setTimeout(r, 300));
    perfil = await perfilDe({ user_id: data.user.id });
  }
  if (!perfil?.account_id) {
    salir(
      'crear el usuario',
      'se creó en Auth pero el trigger no le armó perfil'
    );
  }
  console.log(`✓ Usuario creado: ${email}`);
}

{
  const { error } = await supabase
    .from('accounts')
    .update({ name: nombre })
    .eq('id', perfil.account_id);
  if (error) salir('nombrar la cuenta', error);
}

{
  const { error } = await supabase
    .from('profiles')
    .update({ account_role: 'usuario_app' })
    .eq('user_id', perfil.user_id);
  if (error) salir('asignar el rol usuario_app (¿corriste la 066?)', error);
}

{
  const { error } = await supabase
    .from('account_modules')
    .upsert(
      { account_id: perfil.account_id, module: MODULO, enabled: true },
      { onConflict: 'account_id,module' }
    );
  if (error) salir('encender el módulo (¿corriste la 067?)', error);
}

console.log(`✓ Cuenta "${nombre}" lista`);
console.log(`  account_id: ${perfil.account_id}`);
console.log(`  usuario:    ${email} (usuario_app)`);
console.log(`  módulo:     ${MODULO} encendido`);
