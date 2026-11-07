-- Validación de formatos en el servidor (mismas reglas que js/utils/validate.js)
-- y límites de frecuencia contra spam y abuso.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_username_format') then
    alter table public.users add constraint users_username_format
      check (char_length(username) between 3 and 20 and username ~ '^[A-Za-z0-9_ÁÉÍÓÚáéíóúÑñÜü]+$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'users_email_format') then
    alter table public.users add constraint users_email_format
      check (email is null or (char_length(email) <= 120 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rooms_room_code_format') then
    alter table public.rooms add constraint rooms_room_code_format check (room_code ~ '^[A-Z0-9]{6}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'game_invites_room_code_format') then
    alter table public.game_invites add constraint game_invites_room_code_format
      check (room_code ~ '^[A-Z0-9]{6}$' and char_length(from_name) between 1 and 20);
  end if;
end $$;

-- Límite genérico: como mucho N filas por autor (o en total con '*') dentro de una ventana.
-- Argumentos del trigger: columna del autor, máximo, ventana (intervalo).
create or replace function public.enforce_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  col text := tg_argv[0];
  max_rows int := tg_argv[1]::int;
  win interval := tg_argv[2]::interval;
  n int;
begin
  if col = '*' then
    execute format('select count(*) from %I.%I where created_at > now() - $1', tg_table_schema, tg_table_name)
      into n using win;
  else
    execute format('select count(*) from %I.%I where %I = $1 and created_at > now() - $2', tg_table_schema, tg_table_name, col)
      into n using (to_jsonb(new) ->> col)::uuid, win;
  end if;
  if n >= max_rows then
    raise exception 'rate_limited' using hint = 'rate_limited';
  end if;
  return new;
end;
$$;

-- Sin límite global de altas en users: dejaría que cualquiera bloquease el registro
-- de todo el mundo. El límite de altas debe ir en una RPC de registro (pendiente,
-- junto con mover las contraseñas a Supabase Auth).
drop trigger if exists users_rate_limit on public.users;

-- Mientras no haya RLS, el autor (host_id, requester_id, from_id) lo indica el cliente:
-- estos límites frenan abusos de la web, no a quien llame a la API a mano.
create index if not exists rooms_host_created_idx on public.rooms (host_id, created_at);
create index if not exists friendships_requester_created_idx on public.friendships (requester_id, created_at);
create index if not exists game_invites_from_created_idx on public.game_invites (from_id, created_at);

drop trigger if exists rooms_rate_limit on public.rooms;
create trigger rooms_rate_limit before insert on public.rooms
  for each row execute function public.enforce_rate_limit('host_id', '20', '10 minutes');

drop trigger if exists friendships_rate_limit on public.friendships;
create trigger friendships_rate_limit before insert on public.friendships
  for each row execute function public.enforce_rate_limit('requester_id', '30', '1 hour');

drop trigger if exists game_invites_rate_limit on public.game_invites;
create trigger game_invites_rate_limit before insert on public.game_invites
  for each row execute function public.enforce_rate_limit('from_id', '15', '10 minutes');
