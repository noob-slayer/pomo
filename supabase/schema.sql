-- run this once in your Supabase project's SQL editor
-- (dashboard -> SQL Editor -> New query -> paste -> Run)
--
-- mirrors src/types.ts (Task, PomoRecord) plus a settings blob per user,
-- scoped with row-level security so each signed-in user only ever sees their own rows.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'general',
  estimated_pomos integer,
  start_time text, -- "HH:MM", 24-hour
  end_time text,
  mode text not null check (mode in ('work', 'personal')),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.pomo_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  task_title text,
  mode text not null check (mode in ('work', 'personal')),
  phase text not null check (phase in ('focus', 'break')),
  minutes integer not null,
  completed_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;
alter table public.pomo_history enable row level security;
alter table public.user_settings enable row level security;

create policy "tasks: owner full access" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "pomo_history: owner full access" on public.pomo_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_settings: owner full access" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists tasks_user_id_idx on public.tasks(user_id);
create index if not exists pomo_history_user_id_idx on public.pomo_history(user_id);
