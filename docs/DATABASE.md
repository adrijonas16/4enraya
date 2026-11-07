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
