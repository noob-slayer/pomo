-- run this once in your Supabase project's SQL editor, after lobby_schema.sql
-- (dashboard -> SQL Editor -> New query -> paste -> Run)
--
-- lets a logged lobby session carry the member's own task name (e.g. "writing report"),
-- so the team summary can show what each person is actually working on, not just
-- anonymous "focus" time -- most relevant in sync-mode lobbies, where everyone's clock
-- is running together but each member still picks their own task.

alter table public.lobby_sessions add column if not exists task_title text;
