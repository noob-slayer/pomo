export type Mode = "work" | "personal";
export type WorkTheme = "burgundy" | "forest" | "vistara" | "slate" | "goldenpink";
export type PersonalTheme =
  | "photo"
  | "reveal"
  | "colour"
  | "lofi"
  | "dvd"
  | "suits"
  | "succession"
  | "f1"
  | "f1track"
  | "yt"
  | "forest1"
  | "splitflap"
  | "japan"
  | "matrix"
  | "p";
export type Phase = "focus" | "break";
export type Status = "idle" | "running" | "paused";

export type TaskSplitMode = "auto" | "custom";

export interface TaskSubSession {
  id: string;
  minutes: number;
}

export interface Task {
  id: string;
  title: string;
  category: string;
  durationMinutes: number | null;
  mode: Mode;
  done: boolean;
  createdAt: number;
  // undefined = predates this feature (or was never set) -- treated identically to
  // "custom" with no subSessions: the task's duration is the timer duration, no
  // splitting, no constraint. See lib/taskSessions.ts.
  splitMode?: TaskSplitMode;
  // only meaningful when splitMode === "custom". Empty/undefined means no subtasks were
  // created, which falls back to the same unconstrained behavior as the legacy case above.
  subSessions?: TaskSubSession[];
}

export interface PomoRecord {
  id: string;
  taskId: string | null;
  taskTitle: string | null;
  mode: Mode;
  phase: Phase;
  minutes: number;
  completedAt: number;
  // whether the session finished naturally vs. was stopped early -- optional because
  // records logged before this field existed (localStorage cache, or a database row from
  // before the matching migration ran) simply don't have it. Treat a missing value as
  // completed, not as false -- see computeCompletionStats in lib/statsExtras.ts.
  completed?: boolean;
  // which of the task's sessions (see TaskSubSession / lib/taskSessions.ts) this record
  // was logged against, if any -- undefined for a task with no sub-sessions, a task-less
  // session, or any record from before this field existed. Local-only for now (not yet
  // sent to Supabase -- see insertHistory in lib/cloudSync.ts), same safe-degradation
  // pattern as every other migration-gated field in this codebase.
  subSessionId?: string;
}

export interface Station {
  id: string;
  label: string;
  videoId: string;
}
