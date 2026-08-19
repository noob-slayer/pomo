-- run this once in your Supabase project's SQL editor
-- (dashboard -> SQL Editor -> New query -> paste -> Run)
--
-- distinguishes a focus/break session that finished naturally from one stopped early --
-- both previously wrote an identical row shape, which meant a completion-rate stat
-- ("you finish 87% of the focus sessions you start") wasn't computable at all. Existing
-- rows default to true (completed): there's no way to reconstruct the truth for anything
-- logged before this shipped, and the overwhelming majority of historical sessions really
-- were completions, not abandoned ones.
--
-- IMPORTANT: the app starts writing this column as soon as this code deploys. Run this
-- before (or immediately after) that deploy -- until it's run, every new session log will
-- fail to sync to the cloud (falls back to local-only storage, logged as a console error,
-- same degradation as every other migration-gated feature in this codebase) rather than
-- breaking the app outright.

alter table public.pomo_history add column if not exists completed boolean not null default true;
