export type Mode = "work" | "personal";
export type WorkTheme = "burgundy" | "forest" | "vistara" | "slate" | "goldenpink";
export type PersonalTheme = "photo" | "reveal" | "colour" | "lofi" | "dvd";
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
}

export interface Station {
  id: string;
  label: string;
  videoId: string;
}
