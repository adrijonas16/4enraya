---
name: cambio-base-datos
description: Cambiar la base de datos de Supabase (tablas, columnas, funciones, Realtime, permisos o RLS) y el código que la usa. Úsala para cualquier cambio de esquema o consulta nueva.
---

# Cambiar la base de datos

Proyecto Supabase: `cyzjihoibpdabhiotjpf`. Lee `docs/DATABASE.md` antes de empezar.

## Pasos

1. **Inspecciona** el estado real antes de cambiar nada (tablas y columnas, por ejemplo con `list_tables` del conector de Supabase o la CLI). No supongas el esquema.
2. **Escribe la migración** en `supabase/migrations/AAAAMMDDhhmmss_descripcion.sql` (hora UTC, descripción en `snake_case`):
   - Idempotente cuando se pueda: `if not exists`, `create or replace`.
   - Si añades una tabla que deba avisar en vivo: `alter publication supabase_realtime add table …`.
   - Funciones con privilegios: `security definer`, `set search_path = public`, y `revoke`/`grant` explícitos.
   - Nunca edites una migración ya aplicada; escribe otra.
3. **Prueba lo delicado sin dejar rastro:** ejecuta la lógica nueva dentro de un bloque `do $$ … raise exception 'OK …'; $$` para que se deshaga solo.
4. **Aplica** la migración con el mismo nombre (`apply_migration` del conector o `supabase db push`). Cambios destructivos (borrar columnas o datos): pide confirmación al usuario antes.
5. **Revisa los avisos de seguridad** del proyecto (advisors) y cuéntale al usuario cualquier aviso nuevo. No actives RLS sin políticas.
6. **Código:** solo en `js/utils/api.js`. Métodos con nombre de acción (`sendInvite`, `getFriends`), con `.eq/.in/...` en vez de concatenar texto del usuario, y errores traducidos a un mensaje para el jugador.
7. **Doble de pruebas:** si usas un método del cliente que `tests/fakes/fake-supabase.js` no implementa, añádelo allí.
8. **Documentación:** actualiza tablas y funciones en `docs/DATABASE.md`.

## Comprobar

- `npm run check`
- Prueba en local con una cuenta real contra Supabase si el cambio afecta a cuentas, ranking o amigos.
