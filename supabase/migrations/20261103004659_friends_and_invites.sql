-- Amistades: una fila por pareja; status 'pending' hasta que el otro acepta
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(id) on delete cascade,
  addressee_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
-- evita duplicados en cualquier dirección
create unique index if not exists friendships_pair_uidx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

-- Retos: invitación a una sala concreta
create table if not exists public.game_invites (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.users(id) on delete cascade,
  to_id uuid not null references public.users(id) on delete cascade,
  from_name text not null,
  room_code text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz not null default now()
);
create index if not exists game_invites_to_idx on public.game_invites (to_id, status);

-- tiempo real para avisos de solicitudes y retos
alter publication supabase_realtime add table public.friendships;
alter publication supabase_realtime add table public.game_invites;

-- mismo modelo de acceso que el resto de tablas del juego (sin RLS por ahora)
grant select, insert, update, delete on public.friendships to anon, authenticated;
grant select, insert, update, delete on public.game_invites to anon, authenticated;
