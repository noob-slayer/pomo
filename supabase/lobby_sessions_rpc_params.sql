-- run this once in your Supabase project's SQL editor, after lobby_rls_hardening.sql
-- (dashboard -> SQL Editor -> New query -> paste -> Run)
--
-- Follow-up from the ultrareview pass on the RLS hardening migration: get_lobby_sessions
-- took no filter/limit, so fetchTodayLobbyStats and fetchRecentLobbyActivity (which used
-- to push `.gte(completed_at, ...)` / `.order(...).limit(...)` down to Postgres, hitting
-- lobby_sessions_completed_at_idx) started fetching the *entire* lobby history and
-- filtering/sorting/slicing in JS instead. Harmless for a small lobby, but LobbyStatsView
-- polls every ~8s, so payload size was scaling with total lifetime sessions instead of
-- "today" or "last 30" -- this restores both bounds to SQL.

-- drop the old single-argument version first -- create or replace only replaces a
-- function with the *exact* same parameter signature, otherwise Postgres treats this as
-- a new overload and leaves the old one in place, which makes calls with just p_lobby_id
-- ambiguous between the two
drop function if exists public.get_lobby_sessions(uuid);

create or replace function public.get_lobby_sessions(p_lobby_id uuid, p_since timestamptz default null)
returns setof public.lobby_sessions
language sql
security definer
set search_path = public
as $$
  select * from public.lobby_sessions
  where lobby_id = p_lobby_id
    and (p_since is null or completed_at >= p_since)
  order by completed_at;
$$;

create or replace function public.get_recent_lobby_sessions(p_lobby_id uuid, p_limit int default 30)
returns setof public.lobby_sessions
language sql
security definer
set search_path = public
as $$
  select * from public.lobby_sessions
  where lobby_id = p_lobby_id
  order by completed_at desc
  limit p_limit;
$$;

grant execute on function public.get_lobby_sessions(uuid, timestamptz) to anon, authenticated;
grant execute on function public.get_recent_lobby_sessions(uuid, int) to anon, authenticated;
