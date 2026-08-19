-- run this once in your Supabase project's SQL editor, after lobby_identity_hardening.sql
-- (dashboard -> SQL Editor -> New query -> paste -> Run)
--
-- recurring team challenges: a named, dated window inside a lobby ("deep work week",
-- mon-fri) with its own leaderboard, distinct from the always-on weekly/all-time
-- leaderboard the team stats page already has. Closer to Strava's segment/challenge model
-- than a perpetual ranking that never resets.

create table if not exists public.lobby_challenges (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.lobbies(id) on delete cascade,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by text not null, -- identity_key of whoever created it
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.lobby_challenges enable row level security;

-- same hardened pattern as lobby_sessions: only a current member of the lobby can create
-- one, and only as themselves. Challenges are immutable once created (no update/delete
-- policy), same as lobby_sessions -- a challenge that already has activity logged against
-- its window shouldn't be editable out from under that history.
create policy "lobby_challenges: create as a member" on public.lobby_challenges
  for insert
  with check (
    created_by = auth.uid()::text
    and exists (
      select 1 from public.lobby_members m
      where m.lobby_id = lobby_challenges.lobby_id and m.identity_key = auth.uid()::text
    )
  );

create index if not exists lobby_challenges_lobby_id_idx on public.lobby_challenges(lobby_id);

-- reads via SECURITY DEFINER RPC, same reasoning as every other lobby table in this
-- codebase -- a `using` policy permissive enough to list one lobby's challenges is also
-- permissive enough to list every lobby's challenges.
create or replace function public.get_lobby_challenges(p_lobby_id uuid)
returns setof public.lobby_challenges
language sql
security definer
set search_path = public
as $$
  select * from public.lobby_challenges where lobby_id = p_lobby_id order by starts_at desc;
$$;

grant execute on function public.get_lobby_challenges(uuid) to anon, authenticated;

-- get_lobby_sessions previously only had a lower bound (p_since) -- a challenge needs
-- both ends of its window, so this adds an upper bound (p_until) alongside it. Drops the
-- old 2-arg version first: create or replace only replaces a function with the exact same
-- parameter signature, otherwise Postgres treats this as a new overload and leaves the old
-- one in place too, which makes existing calls with just (p_lobby_id, p_since) ambiguous
-- against the new 3-arg version -- same reasoning as lobby_sessions_rpc_params.sql's own
-- drop-then-recreate when p_since was first added.
drop function if exists public.get_lobby_sessions(uuid, timestamptz);

create or replace function public.get_lobby_sessions(p_lobby_id uuid, p_since timestamptz default null, p_until timestamptz default null)
returns setof public.lobby_sessions
language sql
security definer
set search_path = public
as $$
  select * from public.lobby_sessions
  where lobby_id = p_lobby_id
    and (p_since is null or completed_at >= p_since)
    and (p_until is null or completed_at <= p_until)
  order by completed_at;
$$;

grant execute on function public.get_lobby_sessions(uuid, timestamptz, timestamptz) to anon, authenticated;
