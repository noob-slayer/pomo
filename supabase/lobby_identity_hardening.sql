-- run this once in your Supabase project's SQL editor, after enabling Anonymous
-- Sign-ins (Authentication -> Sign In / Providers -> Anonymous Sign-ins)
-- (dashboard -> SQL Editor -> New query -> paste -> Run)
--
-- Tier 2 fix from the security review: Tier 1 (lobby_rls_hardening.sql) closed off the
-- lobby tables being *listable* by anyone, but every write policy was still `using(true)`
-- / `with check(true)` -- any anonymous visitor could edit or delete *another* guest's
-- membership row, or rewrite another lobby's sync_state, because a plain identity_key
-- column has no server-side owner to check against.
--
-- Now that every visitor (guest or signed-in) has a real Supabase auth session --
-- src/context/AuthContext.tsx bootstraps an anonymous one for guests -- auth.uid() exists
-- for everyone, and RLS can finally check that the identity_key a row claims actually
-- matches the session making the request.

-- lobbies: creating one still needs no prior membership (that's the whole point), but the
-- row it creates must honestly claim its own creator
drop policy if exists "lobbies: anyone can create" on public.lobbies;
create policy "lobbies: create as yourself" on public.lobbies
  for insert
  with check (created_by = auth.uid()::text);

-- sync_state updates now require *current membership* in that specific lobby, not just
-- "any request to any lobby id"
drop policy if exists "lobbies: anyone can update sync_state" on public.lobbies;
create policy "lobbies: members can update sync_state" on public.lobbies
  for update
  using (exists (
    select 1 from public.lobby_members m
    where m.lobby_id = lobbies.id and m.identity_key = auth.uid()::text
  ))
  with check (exists (
    select 1 from public.lobby_members m
    where m.lobby_id = lobbies.id and m.identity_key = auth.uid()::text
  ));

-- lobby_members: you can only ever create/edit/delete a row that claims to *be* you
drop policy if exists "lobby_members: anyone can join" on public.lobby_members;
create policy "lobby_members: join as yourself" on public.lobby_members
  for insert
  with check (identity_key = auth.uid()::text);

drop policy if exists "lobby_members: anyone can update a membership row" on public.lobby_members;
create policy "lobby_members: update your own membership" on public.lobby_members
  for update
  using (identity_key = auth.uid()::text)
  with check (identity_key = auth.uid()::text);

drop policy if exists "lobby_members: anyone can leave" on public.lobby_members;
create policy "lobby_members: leave as yourself" on public.lobby_members
  for delete
  using (identity_key = auth.uid()::text);

-- lobby_sessions: you can only ever log a session under your own identity (sessions are
-- immutable history -- no update/delete policy existed before or now)
drop policy if exists "lobby_sessions: anyone can log a session" on public.lobby_sessions;
create policy "lobby_sessions: log as yourself" on public.lobby_sessions
  for insert
  with check (identity_key = auth.uid()::text);
