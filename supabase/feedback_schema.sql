-- run this once in your Supabase project's SQL editor
-- (dashboard -> SQL Editor -> New query -> paste -> Run)
--
-- a lightweight feedback/complaints/suggestions box, open to anyone (guests included --
-- no account required, matching the rest of this app's low-friction guest support).
--
-- insert-only from the API: anyone holding the anon key can submit, nobody can read
-- submissions back through the API (no SELECT policy at all) -- feedback is only ever
-- read via the Supabase dashboard's Table Editor, which authenticates as the project
-- owner and bypasses RLS entirely, not through the app. This is deliberately the
-- narrowest possible policy: it stops one guest from reading another's complaint, at the
-- cost of the app itself never being able to show "your past feedback" (not a goal here).
--
-- same accepted tradeoff as this codebase's other fully-open guest-write tables (e.g.
-- "lobbies: anyone can create"): a fully open insert has no protection against spam from
-- someone hitting the endpoint directly with the public anon key. Acceptable for a casual,
-- low-stakes feedback box; revisit if it's ever actually abused.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  contact text, -- optional, only if the sender wants a reply
  identity_key text, -- best-effort context (guest id or auth.uid()), not an ownership key
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "feedback: anyone can submit" on public.feedback
  for insert
  with check (true);
