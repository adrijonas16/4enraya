-- Esquema inicial del juego, reconstruido desde la base de datos de producción.
-- Se creó antes de versionar migraciones; este archivo deja constancia de él
-- y sirve para levantar una base de datos nueva desde cero.

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password text not null,
  email text unique,
  total_wins integer default 0,
  total_points integer default 0,
  created_at timestamptz default now(),
  last_login timestamptz default now()
);

create table if not exists public.game_history (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  map_type text default 'classic',
  won boolean default false,
  opponent text,
  played_at timestamptz default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  host_id uuid references public.users(id),
  guest_id uuid references public.users(id),
  host_name text,
  guest_name text,
  status text default 'waiting',
  rows integer default 8,
  cols integer default 9,
  created_at timestamptz default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id),
  board_state jsonb default '[]'::jsonb,
  current_turn text default 'red',
  winner text,
  status text default 'playing',
  created_at timestamptz default now()
);

-- Sin uso en el cliente actual; se conserva porque existe en producción.
create table if not exists public.moves (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games(id),
  player text not null,
  col integer not null,
  "row" integer not null,
  move_number integer not null,
  created_at timestamptz default now()
);

create table if not exists public.rankings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.users(id) on delete cascade,
  username text not null,
  total_wins integer default 0,
  total_points integer default 0,
  games_played integer default 0,
  win_rate numeric default 0,
  updated_at timestamptz default now()
);

create or replace function public.increment_wins(username text)
returns void language plpgsql security definer as $$
begin
  update users set total_wins = coalesce(total_wins, 0) + 1 where username = increment_wins.username;
end;
$$;

-- Cada victoria suma 10 puntos.
create or replace function public.increment_points(username text)
returns void language plpgsql security definer as $$
begin
  update users set total_points = coalesce(total_points, 0) + 10 where username = increment_points.username;
end;
$$;

create or replace function public.update_ranking(user_id uuid, username text)
returns void language plpgsql security definer as $$
begin
  insert into rankings (user_id, username, total_wins, total_points, games_played, win_rate, updated_at)
  select u.id, u.username, coalesce(u.total_wins, 0), coalesce(u.total_points, 0),
         coalesce((select count(*) from game_history where player_name = u.username), 0),
         case when (select count(*) from game_history where player_name = u.username) > 0
              then round((u.total_wins::numeric / (select count(*) from game_history where player_name = u.username)) * 100, 2)
              else 0 end,
         now()
  from users u where u.id = update_ranking.user_id
  on conflict (user_id) do update set
    username = excluded.username, total_wins = excluded.total_wins, total_points = excluded.total_points,
    games_played = excluded.games_played, win_rate = excluded.win_rate, updated_at = now();
end;
$$;

create or replace function public.generate_room_code()
returns text language plpgsql as $$
declare code text;
begin
  code := upper(substring(md5(random()::text) from 1 for 6));
  while exists (select 1 from rooms where room_code = code) loop
    code := upper(substring(md5(random()::text) from 1 for 6));
  end loop;
  return code;
end;
$$;

-- Tiempo real para las salas online
alter publication supabase_realtime add table public.users;
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.games;
