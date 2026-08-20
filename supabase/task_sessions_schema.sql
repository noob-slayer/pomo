-- run this once in your Supabase project's SQL editor
-- (dashboard -> SQL Editor -> New query -> paste -> Run)
--
-- adds cross-device sync for the task-sessions feature (auto/custom splitting a task over
-- 30 minutes into individually-startable sessions): a task's split mode and its custom
-- session list, plus which session a logged history record belongs to. Until this runs,
-- everything about the feature still works, just local-only per device -- see
-- src/lib/cloudSync.ts's insertTask/insertHistory for the fallback behavior.
--
-- nullable columns on existing tables -- no RLS changes needed, the existing per-user_id
-- policies on tasks/pomo_history already cover these.

alter table public.tasks add column if not exists split_mode text;
alter table public.tasks add column if not exists sub_sessions jsonb;

alter table public.pomo_history add column if not exists sub_session_id text;
