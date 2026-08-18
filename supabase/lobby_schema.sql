-- run this once in your Supabase project's SQL editor, in addition to schema.sql
-- (dashboard -> SQL Editor -> New query -> paste -> Run)
--
-- lobbies: persistent group-activity rooms ("group focus sessions"). Unlike the old
-- read-only live-share broadcast (which never touched the database -- it was pure
-- ephemeral Realtime), lobby membership and stats need to persist across days and be
-- visible to every member, including guests. That's a deliberate product decision: guests
-- are allowed to create and join lobbies with a persona name of their choosing, no
-- Google sign-in required. A guest request carries no auth.uid() at all, so unlike
-- tasks/pomo_history/user_settings in schema.sql (which are scoped to auth.uid() =
-- user_id), these three tables use identity_key -- either the signed-in user's
-- auth.uid() as text, or a stable per-browser guest id (see src/lib/identity.ts) --
-- and RLS here is intentionally permissive (anyone holding the anon key can read/write).
-- That's an acceptable tradeoff for a casual, low-stakes social feature; nothing
-- sensitive is stored.

create table if not exists public.lobbies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  mode text not null default 'individual' check (mode in ('individual', 'sync')),
  created_by text, -- identity_key of the creator
  creator_persona text,
  created_at timestamptz not null default now()
);

create table if not exists public.lobby_members (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.lobbies(id) on delete cascade,
  identity_key text not null,
  persona_name text not null,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (lobby_id, identity_key)
);

create table if not exists public.lobby_sessions (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.lobbies(id) on delete cascade,
  identity_key text not null,
  persona_name text not null, -- snapshotted at completion time, so a later rename doesn't rewrite team history
  phase text not null check (phase in ('focus', 'break')),
  minutes integer not null,
  completed_at timestamptz not null default now()
);

alter table public.lobbies enable row level security;
alter table public.lobby_members enable row level security;
alter table public.lobby_sessions enable row level security;

create policy "lobbies: anyone can read" on public.lobbies for select using (true);
create policy "lobbies: anyone can create" on public.lobbies for insert with check (true);

create policy "lobby_members: anyone can read" on public.lobby_members for select using (true);
create policy "lobby_members: anyone can join" on public.lobby_members for insert with check (true);
create policy "lobby_members: anyone can update a membership row" on public.lobby_members
  for update using (true) with check (true);
create policy "lobby_members: anyone can leave" on public.lobby_members for delete using (true);

create policy "lobby_sessions: anyone can read" on public.lobby_sessions for select using (true);
create policy "lobby_sessions: anyone can log a session" on public.lobby_sessions for insert with check (true);

create index if not exists lobby_members_lobby_id_idx on public.lobby_members(lobby_id);
create index if not exists lobby_sessions_lobby_id_idx on public.lobby_sessions(lobby_id);
create index if not exists lobby_sessions_completed_at_idx on public.lobby_sessions(completed_at);
create index if not exists lobbies_code_idx on public.lobbies(code);
