# Barbería Xdel en WIOCRM

Xdel usa el mismo proyecto de Supabase que WIOCRM. Cada registro del módulo lleva `account_id`; la app móvil debe enviar siempre el UUID de la cuenta de Xdel y nunca consultar las tablas directamente con la clave anónima.

## Tablas

- `barber_barbers`: barberos, perfil CRM opcional, foto, estado y modelo de pago (`commission` o `rent`). Un perfil vinculado debe pertenecer a la misma cuenta.
- `barber_services`: catálogo, duración, precio y estado del servicio.
- `barber_availability`: horario recurrente del barbero. `weekday` usa `0 = domingo` hasta `6 = sábado`; las horas se interpretan en `America/Lima`.
- `barber_blocks`: bloqueos puntuales de agenda.
- `barber_appointments`: contacto CRM opcional, barbero, servicio, horario, estado, origen y cobro. `contact_id = NULL` se admite para walk-ins sin teléfono; `barber_id = NULL` representa “cualquiera” antes de asignar y las RPC públicas siempre eligen un barbero concreto. La base impide superposiciones por cuenta y barbero salvo citas `cancelled` o `no_show`.
- `barber_waitlist`: lista de espera por contacto, servicio, fecha y barbero opcional.
- `barber_weekly_report`: vista semanal por cuenta y barbero. La semana empieza el lunes en Lima; cuenta solo citas `attended` y muestra propinas por separado.

No existe una tabla de clientes de barbería. Se usa `public.contacts`, deduplicado por `(account_id, phone_normalized)`. Una reserva pública crea el contacto con el `owner_user_id` de la cuenta si no existe y nunca cambia el nombre de un contacto existente.

## RPC públicas

Todas son `SECURITY DEFINER`, fijan `search_path = public`, exigen una cuenta activa y validan que servicio y barbero pertenezcan a esa cuenta:

- `barber_public_catalog(p_account_id)`: devuelve JSON con `services` y `barbers` activos. De los barberos expone solo `id`, `name` y `photo_url`.
- `barber_available_slots(p_account_id, p_service_id, p_date, p_barber_id default null)`: devuelve intervalos disponibles de 15 minutos, respetando horario, bloqueos y citas.
- `barber_create_booking(p_account_id, p_service_id, p_barber_id, p_starts_at, p_name, p_phone)`: valida E.164, vuelve a validar el slot, reutiliza o crea el contacto y crea una cita `reserved` con origen `app`. Con `p_barber_id = null` elige al barbero activo con menos citas ese día. Limita a dos reservas futuras activas por teléfono y cuenta.
- `barber_join_waitlist(p_account_id, p_service_id, p_date, p_name, p_phone, p_barber_id default null)`: reutiliza o crea el contacto y lo agrega a la lista de espera.

`anon` y `authenticated` pueden ejecutar estas RPC. `anon` no tiene acceso directo a las tablas ni a la vista.

## RPC del panel de personal

Estas RPC también son `SECURITY DEFINER` y fijan `search_path = public`, pero solo `authenticated` puede ejecutarlas. Un administrador es un miembro que cumple `is_account_member(p_account_id, 'admin')`; esto incluye a `owner`. Un barbero vinculado es un registro activo de `barber_barbers` cuyo `profile_id` corresponde al usuario autenticado dentro de la misma cuenta.

- `barber_staff_context(p_account_id)`: devuelve `{is_admin, barber_id, barber_name}`. Rechaza al usuario que no sea administrador ni barbero vinculado.
- `barber_staff_agenda(p_account_id, p_date, p_barber_id default null)`: devuelve las citas del día calendario en `America/Lima`, ordenadas por inicio, con servicio, barbero, cliente y cobro. Un administrador ve todos los barberos y las citas todavía marcadas como “cualquiera”, o filtra por `p_barber_id`. Un barbero siempre recibe únicamente sus propias citas.
- `barber_close_appointment(p_account_id, p_appointment_id, p_status, p_price default null, p_tip default 0, p_payment_method default null)`: cierra una cita como `attended`, `no_show` o `cancelled`. Para `attended`, usa el precio del servicio cuando no se envía `p_price` y exige un método entre `efectivo`, `yape`, `plin`, `tarjeta` y `transferencia`. Los otros dos estados limpian precio, propina y método de pago. El barbero solo puede cerrar citas propias; el administrador puede cerrar cualquiera de la cuenta.
- `barber_register_walk_in(p_account_id, p_service_id, p_barber_id default null, p_name default null, p_phone default null, p_price default null, p_tip default 0, p_payment_method default 'efectivo')`: registra inmediatamente una cita `attended` con origen `walk_in`. El barbero autenticado queda asignado automáticamente; el administrador debe elegir uno. El teléfono es opcional, pero si se envía debe estar en E.164: se reutiliza o crea el contacto sin sobrescribir nombres. Sin teléfono, la cita queda sin contacto CRM. La exclusión de agenda evita registrar el walk-in si el barbero ya tiene una cita en curso.

Los precios y propinas no pueden ser negativos. Los walk-ins atendidos se incorporan automáticamente a `barber_weekly_report` según la semana de Lima.

## Roles y RLS

- Miembros de la cuenta pueden leer catálogo, disponibilidad, bloqueos y lista de espera.
- `owner` y `admin` pueden escribir la configuración y administrar todas las citas.
- Un `agent` vinculado mediante `barber_barbers.profile_id` solo puede leer y actualizar sus propias citas. En ellas únicamente puede cambiar `status`, `price_charged`, `tip` y `payment_method`; un trigger bloquea horario, contacto, servicio, origen o reasignación.
- Los `viewer` que el CRM considere miembros conservan lectura. Las cuentas con `viewers_are_clients` siguen la exclusión de `is_account_member`.

## Conexión desde la app móvil Xdel

Configurar estas variables públicas en Expo:

```env
EXPO_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=TU_ANON_KEY
EXPO_PUBLIC_WIOCRM_ACCOUNT_ID=UUID_DE_LA_CUENTA_XDEL
```

La app crea el cliente de Supabase con la URL y la anon key. En cada llamada RPC pasa `EXPO_PUBLIC_WIOCRM_ACCOUNT_ID` como `p_account_id`. La anon key puede estar en la aplicación; no se debe incluir nunca la service-role key.

Flujo recomendado: cargar `barber_public_catalog`, consultar `barber_available_slots` y confirmar con `barber_create_booking`. Si no hay horario, ofrecer `barber_join_waitlist`. Los timestamps se envían como ISO 8601 con zona horaria; las fechas de disponibilidad son `YYYY-MM-DD` en Lima.

Para el panel autenticado, cargar primero `barber_staff_context`, consultar la jornada con `barber_staff_agenda` y completar cada atención con `barber_close_appointment`. Usar `barber_register_walk_in` para clientes que llegan sin reserva.
