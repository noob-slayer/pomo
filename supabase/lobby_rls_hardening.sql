-- run this once in your Supabase project's SQL editor, after the other lobby_*.sql files
-- (dashboard -> SQL Editor -> New query -> paste -> Run)
--
-- Tier 1 fix from the security review: the "anyone can read" policies on lobbies,
-- lobby_members, and lobby_sessions meant the ENTIRE table was listable by anyone
-- holding the public anon key -- every lobby code, every member's persona name, every
-- session ever logged, with no need to know a code at all. Verified live: a plain
-- `select * from lobbies` returned every lobby ever created.
--
-- RLS itself can't fix this directly -- a `using` policy can't tell "the client filtered
-- by code" apart from "the client asked for everything", so any policy permissive enough
-- to let a real code-holder find their lobby is *also* permissive enough to list all of
-- them. The fix is to stop allowing direct table reads at all, and go through a
-- SECURITY DEFINER function instead: its own SQL decides exactly what's returned (one
-- lobby matching an exact code, or the members/sessions of one specific id), which sidesteps
-- the row-level-policy limitation entirely.
--
-- This does NOT fix write-tampering (someone editing another guest's membership row, or
-- another lobby's sync_state) -- that requires real per-guest identity via Supabase
-- anonymous auth, which is a bigger, separate migration. Guest identity_key is still a
-- self-reported string nobody can verify server-side; this migration only closes the
-- "list/read everything with zero information" hole.

drop policy if exists "lobbies: anyone can read" on public.lobbies;
drop policy if exists "lobby_members: anyone can read" on public.lobby_members;
drop policy if exists "lobby_sessions: anyone can read" on public.lobby_sessions;

-- set search_path explicitly on every SECURITY DEFINER function -- otherwise a
-- search_path set by the caller could redirect unqualified references elsewhere
-- (a well-known Postgres privilege-escalation pattern for definer functions)

create or replace function public.find_lobby_by_code(p_code text)
returns setof public.lobbies
language sql
security definer
set search_path = public
as $$
  select * from public.lobbies where code = lower(trim(p_code));
$$;

create or replace function public.get_lobby(p_id uuid)
returns setof public.lobbies
language sql
security definer
set search_path = public
as $$
  select * from public.lobbies where id = p_id;
$$;

create or replace function public.get_lobbies_by_ids(p_ids uuid[])
returns setof public.lobbies
language sql
security definer
set search_path = public
as $$
  select * from public.lobbies where id = any(p_ids);
$$;

create or replace function public.get_lobby_members(p_lobby_id uuid)
returns setof public.lobby_members
language sql
security definer
set search_path = public
as $$
  select * from public.lobby_members where lobby_id = p_lobby_id order by joined_at;
$$;

create or replace function public.get_lobby_sessions(p_lobby_id uuid)
returns setof public.lobby_sessions
language sql
security definer
set search_path = public
as $$
  select * from public.lobby_sessions where lobby_id = p_lobby_id order by completed_at;
$$;

-- every lobby_id this identity has current membership in, or has ever logged a session
-- to (leaving a lobby deletes the membership row but not the session history) -- powers
-- the "team" tab's full lobby history
create or replace function public.get_lobby_ids_for_identity(p_identity_key text)
returns table(lobby_id uuid)
language sql
security definer
set search_path = public
as $$
  select lobby_id from public.lobby_members where identity_key = p_identity_key
  union
  select lobby_id from public.lobby_sessions where identity_key = p_identity_key;
$$;

grant execute on function public.find_lobby_by_code(text) to anon, authenticated;
grant execute on function public.get_lobby(uuid) to anon, authenticated;
grant execute on function public.get_lobbies_by_ids(uuid[]) to anon, authenticated;
grant execute on function public.get_lobby_members(uuid) to anon, authenticated;
grant execute on function public.get_lobby_sessions(uuid) to anon, authenticated;
grant execute on function public.get_lobby_ids_for_identity(text) to anon, authenticated;
