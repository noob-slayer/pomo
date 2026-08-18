-- run this once in your Supabase project's SQL editor, after lobby_schema.sql
-- (dashboard -> SQL Editor -> New query -> paste -> Run)
--
-- Phase 2: "sync" mode lobbies. Live start/pause/resume/stop/reset actions travel over an
-- ephemeral Supabase Realtime broadcast channel (never touch the database -- same
-- approach as the old one-way live-share used, just now any member can send). This one
-- column is the exception: sync_state is a small snapshot of "what's the clock doing
-- right now", written on every action, so a member who joins (or reloads) mid-session
-- can catch up to the current state instead of only finding out on the *next* action.

alter table public.lobbies add column if not exists sync_state jsonb;

create policy "lobbies: anyone can update sync_state" on public.lobbies
  for update using (true) with check (true);
