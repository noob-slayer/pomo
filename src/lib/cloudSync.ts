import { supabase } from "./supabaseClient";
import type { Mode, Phase, PomoRecord, Task, TaskSplitMode, TaskSubSession } from "../types";

interface TaskRow {
  id: string;
  title: string;
  category: string;
  // DB column kept as estimated_pomos to avoid a migration; it now stores a plain
  // duration in minutes rather than a pomo count -- see Task.durationMinutes
  estimated_pomos: number | null;
  mode: Mode;
  done: boolean;
  created_at: string;
  // absent until supabase/task_sessions_schema.sql has been run -- reads the same as a
  // task that predates the task-sessions feature either way, via the `?? undefined` below
  split_mode?: TaskSplitMode | null;
  sub_sessions?: TaskSubSession[] | null;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    durationMinutes: row.estimated_pomos,
    mode: row.mode,
    done: row.done,
    createdAt: new Date(row.created_at).getTime(),
    splitMode: row.split_mode ?? undefined,
    subSessions: row.sub_sessions ?? undefined,
  };
}

export async function fetchTasks(userId: string): Promise<Task[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("tasks").select("*").eq("user_id", userId).order("created_at");
  if (error || !data) return [];
  return (data as TaskRow[]).map(rowToTask);
}

export async function insertTask(userId: string, task: Task): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("tasks").insert({
    id: task.id,
    user_id: userId,
    title: task.title,
    category: task.category,
    estimated_pomos: task.durationMinutes,
    mode: task.mode,
    done: task.done,
    created_at: new Date(task.createdAt).toISOString(),
    // requires supabase/task_sessions_schema.sql to have been run -- until then this
    // insert fails against the unmigrated schema (unknown column), logged below and
    // falling back to local-only storage for new tasks, same degradation as every other
    // migration-gated field in this codebase (e.g. pomo_history's `completed`)
    split_mode: task.splitMode ?? null,
    sub_sessions: task.subSessions ?? null,
  });
  if (error) console.error("cloud sync: insertTask failed", error);
}

export async function updateTaskDone(userId: string, id: string, done: boolean): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("tasks").update({ done }).eq("id", id).eq("user_id", userId);
  if (error) console.error("cloud sync: updateTaskDone failed", error);
}

export async function deleteTaskRow(userId: string, id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("tasks").delete().eq("id", id).eq("user_id", userId);
  if (error) console.error("cloud sync: deleteTaskRow failed", error);
}

interface HistoryRow {
  id: string;
  task_id: string | null;
  task_title: string | null;
  mode: Mode;
  phase: Phase;
  minutes: number;
  completed_at: string;
  // absent until supabase/pomo_history_completed_schema.sql has been run -- undefined
  // reads the same as a legacy row missing the column entirely, both via the `?? true`
  // fallback below (rowToRecord's own PomoRecord.completed stays consistent with
  // computeCompletionStats' `!== false` handling of undefined either way)
  completed?: boolean;
  // absent until supabase/task_sessions_schema.sql has been run -- same undefined-either-
  // way handling as `completed` above
  sub_session_id?: string | null;
}

function rowToRecord(row: HistoryRow): PomoRecord {
  return {
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    mode: row.mode,
    phase: row.phase,
    minutes: row.minutes,
    completedAt: new Date(row.completed_at).getTime(),
    completed: row.completed ?? true,
    subSessionId: row.sub_session_id ?? undefined,
  };
}

export async function fetchHistory(userId: string): Promise<PomoRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("pomo_history")
    .select("*")
    .eq("user_id", userId)
    .order("completed_at");
  if (error || !data) return [];
  return (data as HistoryRow[]).map(rowToRecord);
}

export async function insertHistory(userId: string, record: PomoRecord): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("pomo_history").insert({
    id: record.id,
    user_id: userId,
    task_id: record.taskId,
    task_title: record.taskTitle,
    mode: record.mode,
    phase: record.phase,
    minutes: record.minutes,
    completed_at: new Date(record.completedAt).toISOString(),
    // requires supabase/pomo_history_completed_schema.sql and
    // supabase/task_sessions_schema.sql to have been run -- until then this insert fails
    // against the unmigrated schema (unknown column), logged below and falling back to
    // local-only storage for new sessions, same degradation as every other migration-
    // gated feature in this codebase
    completed: record.completed ?? true,
    sub_session_id: record.subSessionId ?? null,
  });
  if (error) console.error("cloud sync: insertHistory failed", error);
}

// synced settings exclude personalBg (a large data-uri photo) — that stays per-device
// to avoid bloating the settings row and hitting payload limits.
export async function fetchSettings(userId: string): Promise<Record<string, unknown> | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("user_settings")
    .select("settings")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.settings as Record<string, unknown>;
}

export async function upsertSettings(userId: string, settings: Record<string, unknown>): Promise<void> {
  if (!supabase) return;
  // personalBg stays per-device (large data-uri, not worth syncing). currentLobby stays
  // per-device too, deliberately: it's "which lobby am I actively in right now", and
  // syncing it meant logging back in silently re-entered whatever lobby was active last
  // time, with no fresh start. Which lobbies you've ever been part of is now derived
  // live from the database (see fetchMyLobbies) rather than a synced pointer, so a fresh
  // login still shows full lobby history in tasks > team even though currentLobby itself
  // never auto-restores.
  const { personalBg: _personalBg, currentLobby: _currentLobby, ...syncable } = settings;
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: userId, settings: syncable, updated_at: new Date().toISOString() });
  if (error) console.error("cloud sync: upsertSettings failed", error);
}
