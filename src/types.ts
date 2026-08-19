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

export interface Task {
  id: string;
  title: string;
  category: string;
  durationMinutes: number | null;
  mode: Mode;
  done: boolean;
  createdAt: number;
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
}

export interface Station {
  id: string;
  label: string;
  videoId: string;
}
