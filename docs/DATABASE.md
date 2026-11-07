# Base de datos (Supabase)

Proyecto: `cyzjihoibpdabhiotjpf` (región `us-east-2`). El cliente usa la clave pública `anon`, que está en `js/utils/api.js`.

## Tablas

| Tabla | Para qué | Notas |
| --- | --- | --- |
| `users` | Jugadores | `username` y `email` únicos. `auth_id` enlaza con Supabase Auth (Google). `password` en texto plano solo en cuentas antiguas (ver Seguridad) |
| `game_history` | Una fila por partida terminada de un jugador con cuenta | Solo cuentan partidas contra la IA y online |
| `rankings` | Clasificación calculada | `user_id` único |
| `rooms` | Salas online | `room_code` de 6 caracteres; `status`: `waiting`, `playing`, `cancelled` |
| `games` | Partida de una sala | `board_state` guarda el estado completo del motor (`v: 2`) |
| `moves` | Sin uso actual | Se conserva porque existe en producción |
| `friendships` | Amistades | Una fila por pareja; `status`: `pending`, `accepted` |
| `game_invites` | Retos a una sala | `status`: `pending`, `accepted`, `declined`, `expired`. Caducan a los 10 minutos en el cliente |

Realtime publica: `users`, `rooms`, `games`, `friendships`, `game_invites`.

## Funciones

| Función | Qué hace |
| --- | --- |
| `increment_wins(username)` | +1 victoria |
| `increment_points(username)` | +10 puntos |
| `update_ranking(user_id, username)` | Recalcula la fila de `rankings` |
| `login_with_auth()` | Tras entrar con Google: devuelve el jugador enlazado o lo crea (o enlaza por email). Solo rol `authenticated` |
| `generate_room_code()` | Sin uso en el cliente actual |
| `enforce_rate_limit()` | Trigger: máximo de filas por autor y ventana de tiempo. Lanza `rate_limited`, que `api.js` traduce a «Vas muy rápido…» |

## Validación y límites (migración `20261107170000_validation_and_rate_limits`)

| Regla | Dónde |
| --- | --- |
| Usuario de 3 a 20 letras, números o `_` (la web pide 3 a 15) | `users_username_format` |
| Email con formato válido y como mucho 120 caracteres | `users_email_format` |
| Código de sala de 6 mayúsculas o números | `rooms_room_code_format`, `game_invites_room_code_format` |
| Como mucho 20 salas por anfitrión cada 10 minutos | trigger `rooms_rate_limit` |
| Como mucho 30 solicitudes de amistad por persona cada hora | trigger `friendships_rate_limit` |
| Como mucho 15 retos por persona cada 10 minutos | trigger `game_invites_rate_limit` |

Las mismas reglas de formato están en `js/utils/validate.js`; si cambias una, cambia las dos.

Límites conocidos: no hay límite de altas de cuentas (uno global dejaría bloquear el registro de todos); irá en una función de registro cuando las contraseñas pasen a Supabase Auth. Y mientras no haya RLS, el autor de cada fila lo indica el cliente, así que estos límites frenan abusos desde la web pero no a quien llame a la API directamente.

`20261107171000_login_with_auth_min_length`: los nombres generados al entrar con Google tienen al menos 3 caracteres.

## Migraciones

- Viven en `supabase/migrations/`, con nombre `AAAAMMDDhhmmss_descripcion.sql` en UTC.
- `20260403000000_initial_schema.sql` reconstruye el esquema que existía antes de versionar.
- Una migración aplicada no se edita: se escribe otra.
- Escríbelas idempotentes cuando se pueda (`if not exists`, `create or replace`).
- Cómo aplicar: con la CLI (`supabase db push`) o con la herramienta `apply_migration` del conector de Supabase, usando el mismo nombre del archivo. Después revisa los avisos de seguridad del proyecto.
- Si una migración añade consultas nuevas en `api.js`, el doble de pruebas `tests/fakes/fake-supabase.js` debe soportarlas.

## Seguridad: estado actual y plan

**Hoy RLS está desactivado en todas las tablas.** Cualquiera con la clave pública puede leer y modificar cualquier fila, incluidas las contraseñas antiguas en texto plano. Es el riesgo principal del proyecto.

Plan recomendado, en este orden:

1. Mover el registro y el inicio de sesión con contraseña a Supabase Auth (`signUp` / `signInWithPassword`), igual que Google, y enlazar con `users.auth_id`.
2. Borrar la columna `password` cuando no quede ninguna cuenta que dependa de ella.
3. Activar RLS en todas las tablas con políticas por `auth.uid()`:
   - `users`: lectura pública de `id`, `username`, `total_wins`, `total_points` (mediante una vista); escritura solo de la propia fila.
   - `friendships`, `game_invites`: solo filas donde el usuario es una de las partes.
   - `rooms`, `games`: solo los dos jugadores de la sala.
   - Contadores (`increment_*`) solo desde funciones `security definer` que comprueben el resultado.
4. Revisar con los avisos de seguridad de Supabase.

No actives RLS sin políticas: el juego dejaría de funcionar.
