-- run this once in your Supabase project's SQL editor
-- (dashboard -> SQL Editor -> New query -> paste -> Run)
--
-- stores each signed-in user's Web Push subscription (endpoint + keys), so the daily
-- streak-reminder cron job (api/send-streak-reminders.ts) can send a real push
-- notification even when the app/tab is closed. One row per browser/device a user has
-- opted in on -- a user with the reminder enabled on both their phone and laptop gets two
-- rows, and a push to each.
--
-- reads for the cron job go through the Supabase SERVICE ROLE key (bypasses RLS
-- entirely, by design -- the whole point of that key), never the anon key, so there is no
-- public-read RPC here the way other lobby tables have. Writes are owner-scoped, same
-- pattern as every other per-user table in this codebase.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions: manage your own" on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
