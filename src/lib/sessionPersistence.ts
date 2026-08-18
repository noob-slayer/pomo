import type { Phase } from "../types";

// a snapshot of an in-progress (running or paused) timer session, written to
// localStorage at every state transition (start/pause/resume/reset) and cleared on
// stop/completion. Restoring this on the next mount is what lets a session survive a
// refresh, a tab close, or a crash: for a still-running session, the wall-clock endAt
// lets the existing recompute/completion logic pick up exactly where it would have
// naturally ended up, even if the app wasn't open to see it happen.
export interface PersistedSession {
  phase: Phase;
  status: "running" | "paused";
  targetSeconds: number | null;
  endAt: number | null;
  startedAt: number | null;
  remainingSeconds: number;
  elapsedSeconds: number;
  activeTaskId: string | null;
  activeTaskTitle: string | null;
  lastMinutes: number;
}

const KEY = "pomo:activeSession";

export function readPersistedSession(): PersistedSession | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PersistedSession) : null;
  } catch {
    return null;
  }
}

export function writePersistedSession(session: PersistedSession): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // storage full/unavailable — the session just won't survive a reload this time
  }
}

export function clearPersistedSession(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
