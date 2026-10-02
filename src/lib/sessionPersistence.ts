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
  activeSubSessionId: string | null;
  lastMinutes: number;
  // ms epoch this snapshot was written. Stamped automatically by writePersistedSession, so
  // every call site gets it for free. Used only to drop an abandoned session on restore
  // (see STALE_RESTORE_MS) -- optional so a snapshot written before this field existed still
  // parses, and simply reads as "age unknown, keep it".
  savedAt?: number;
}

const KEY = "pomo:activeSession";

// a session left untouched for longer than this is treated as abandoned, not resumed: if you
// close pomo mid-pomo and reopen it the next day, resurrecting that paused clock is wrong --
// it showed a stale timer on the reopened device, and stopping it logged its old elapsed time
// stamped with *today's* date (the exact bug this guards). Comfortably longer than any real
// pause (which is minutes), so a lunch break still restores; overnight does not.
const STALE_RESTORE_MS = 6 * 60 * 60 * 1000; // 6 hours

export function readPersistedSession(): PersistedSession | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as PersistedSession;
    if (typeof session.savedAt === "number" && Date.now() - session.savedAt > STALE_RESTORE_MS) {
      clearPersistedSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function writePersistedSession(session: PersistedSession): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...session, savedAt: Date.now() }));
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
