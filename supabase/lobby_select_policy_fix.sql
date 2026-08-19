-- run this once in your Supabase project's SQL editor, after lobby_identity_hardening.sql
-- (dashboard -> SQL Editor -> New query -> paste -> Run)
--
-- Bug found while verifying Tier 2: lobby_identity_hardening.sql's UPDATE/DELETE policies
-- on lobby_members (and the sync_state UPDATE policy on lobbies) silently affected ZERO
-- rows even for the row's own legitimate owner -- confirmed via Content-Range: */0 on a
-- direct PATCH request, and via a temporary SECURITY INVOKER diagnostic function that
-- confirmed auth.uid() itself resolves correctly. Root cause: Tier 1
-- (lobby_rls_hardening.sql) removed the "anyone can read" SELECT policies on lobbies and
-- lobby_members entirely (routing normal reads through SECURITY DEFINER RPCs instead),
-- and PostgREST's UPDATE/DELETE handling needs *some* SELECT-level visibility on the
-- table to report which rows were affected -- without one, it reports zero regardless of
-- whether the underlying mutation actually happened.
--
-- Adds back a SELECT policy, but scoped narrowly to "your own row" (or, for lobbies,
-- "a lobby you created or belong to") -- not the "anyone can read everything" policy
-- Tier 1 removed. The full member roster / lobby lookup by code still only comes through
-- get_lobby_members() / find_lobby_by_code(), so this doesn't reopen the directory-
-- enumeration hole.

create policy "lobby_members: see your own row" on public.lobby_members
  for select
  using (identity_key = auth.uid()::text);

create policy "lobbies: see lobbies you created or belong to" on public.lobbies
  for select
  using (
    created_by = auth.uid()::text
    or exists (select 1 from public.lobby_members m where m.lobby_id = lobbies.id and m.identity_key = auth.uid()::text)
  );

-- clean up the temporary diagnostic function from the debugging session
drop function if exists public.debug_whoami();
