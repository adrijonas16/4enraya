-- Los nombres generados al entrar con Google cumplen users_username_format (mínimo 3 caracteres)

-- Devuelve (o crea) el jugador de la sesión actual
create or replace function public.login_with_auth()
returns table (id uuid, username text, email text, total_wins int, total_points int)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  mail text := lower(auth.jwt() ->> 'email');
  meta jsonb := coalesce(auth.jwt() -> 'user_metadata', '{}'::jsonb);
  base text;
  candidate text;
  n int := 0;
  urow public.users%rowtype;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into urow from public.users u where u.auth_id = uid;

  -- si ya existía una cuenta con ese email, se enlaza
  if urow.id is null and mail is not null then
    update public.users u set auth_id = uid
      where lower(u.email) = mail and u.auth_id is null
      returning * into urow;
  end if;

  if urow.id is null then
    base := coalesce(meta ->> 'full_name', meta ->> 'name', split_part(mail, '@', 1), 'jugador');
    base := split_part(trim(base), ' ', 1);
    base := regexp_replace(base, '[^A-Za-z0-9_ÁÉÍÓÚáéíóúÑñÜü]', '', 'g');
    base := left(base, 12);
    if base is null or base = '' then base := 'jugador'; end if;
    -- la restricción users_username_format exige al menos 3 caracteres
    if char_length(base) < 3 then base := base || 'jugador'; base := left(base, 12); end if;
    candidate := base;
    while exists (select 1 from public.users u where lower(u.username) = lower(candidate)) loop
      n := n + 1;
      candidate := base || n::text;
    end loop;
    insert into public.users (username, email, auth_id)
      values (candidate, mail, uid)
      returning * into urow;
  end if;

  update public.users u set last_login = now() where u.id = urow.id;

  return query select urow.id, urow.username, urow.email, urow.total_wins, urow.total_points;
end;
$$;

revoke all on function public.login_with_auth() from public, anon;
grant execute on function public.login_with_auth() to authenticated;
