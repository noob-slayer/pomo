-- run this once in your Supabase project's SQL editor
-- (dashboard -> SQL Editor -> New query -> paste -> Run)
--
-- opt-in public profile pages: a signed-in user can generate a shareable link
-- (pomo.site/?u=<slug>) that shows a READ-ONLY, aggregate-only view of their work-mode
-- stats to anyone, no account required -- Strava's biggest growth loop, applied here.
--
-- deliberately narrow about what becomes public:
--   - only work-mode sessions (personal mode never leaves the account, even when enabled)
--   - only mode/phase/minutes/completed_at/completed -- never task_id or task_title, so
--     no task content or category ever becomes public, only aggregate time/streak/badge
--     numbers computed from it
--   - only rows for a user who has explicitly enabled this (enabled = true)
--
-- follows the same hardened pattern as the rest of this codebase: owner-only writes via
-- plain RLS, reads routed through SECURITY DEFINER RPCs rather than a permissive SELECT
-- policy, since "anyone can read an enabled profile by slug" and "anyone can list every
-- profile" are impossible to tell apart with a plain RLS policy alone.

create table if not exists public.public_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  slug text not null unique,
  enabled boolean not null default true,
  persona_name text not null,
  created_at timestamptz not null default now()
);

alter table public.public_profiles enable row level security;

create policy "public_profiles: manage your own" on public.public_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists public_profiles_slug_idx on public.public_profiles(slug);

-- profile metadata for a given slug -- returns nothing if the slug doesn't exist or the
-- owner has since disabled it (a disabled profile's slug should read as "not found", not
-- "found but hidden", so a stale/shared link doesn't leak that a profile ever existed)
create or replace function public.get_public_profile(p_slug text)
returns table(user_id uuid, persona_name text)
language sql
security definer
set search_path = public
as $$
  select user_id, persona_name from public.public_profiles
  where slug = p_slug and enabled = true;
$$;

-- sanitized session history for a given slug's owner -- work mode only, never task_id or
-- task_title. Joins through public_profiles itself (rather than trusting a caller-supplied
-- user_id) so a disabled or nonexistent slug can never be used to pull someone's history.
create or replace function public.get_public_profile_sessions(p_slug text)
returns table(mode text, phase text, minutes integer, completed_at timestamptz, completed boolean)
language sql
security definer
set search_path = public
as $$
  select h.mode, h.phase, h.minutes, h.completed_at, h.completed
  from public.pomo_history h
  join public.public_profiles p on p.user_id = h.user_id
  where p.slug = p_slug and p.enabled = true and h.mode = 'work';
$$;

grant execute on function public.get_public_profile(text) to anon, authenticated;
grant execute on function public.get_public_profile_sessions(text) to anon, authenticated;
