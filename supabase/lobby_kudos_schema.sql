-- run this once in your Supabase project's SQL editor, after lobby_identity_hardening.sql
-- (dashboard -> SQL Editor -> New query -> paste -> Run)
--
-- kudos: a lightweight reaction ("nice session") a teammate can leave on someone else's
-- logged lobby_sessions row -- the social hook behind the new team stats page. Follows the
-- same hardened identity_key = auth.uid()::text ownership pattern the rest of the lobby
-- tables were migrated to (see lobby_identity_hardening.sql) from the start, rather than
-- shipping permissive and hardening later.

create table if not exists public.lobby_session_kudos (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lobby_sessions(id) on delete cascade,
  lobby_id uuid not null references public.lobbies(id) on delete cascade,
  identity_key text not null,
  persona_name text not null, -- snapshotted at creation time, same reasoning as lobby_sessions.persona_name
  created_at timestamptz not null default now(),
  unique (session_id, identity_key) -- one kudos per person per session
);

alter table public.lobby_session_kudos enable row level security;

create policy "lobby_session_kudos: give kudos as yourself" on public.lobby_session_kudos
  for insert
  with check (identity_key = auth.uid()::text);

create policy "lobby_session_kudos: remove your own kudos" on public.lobby_session_kudos
  for delete
  using (identity_key = auth.uid()::text);

create index if not exists lobby_session_kudos_lobby_id_idx on public.lobby_session_kudos(lobby_id);
create index if not exists lobby_session_kudos_session_id_idx on public.lobby_session_kudos(session_id);

-- no SELECT policy on the table itself -- reads go through this SECURITY DEFINER RPC
-- instead, same reasoning as get_lobby_sessions/get_lobby_members in lobby_rls_hardening.sql:
-- a `using` policy permissive enough to read your own lobby's kudos is also permissive
-- enough to list every kudos ever given, across every lobby, to anyone holding the anon key.
create or replace function public.get_lobby_kudos(p_lobby_id uuid)
returns setof public.lobby_session_kudos
language sql
security definer
set search_path = public
as $$
  select * from public.lobby_session_kudos where lobby_id = p_lobby_id;
$$;

grant execute on function public.get_lobby_kudos(uuid) to anon, authenticated;
