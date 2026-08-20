import type { PomoRecord, Task } from "../types";

export const AUTO_SPLIT_THRESHOLD_MINUTES = 30;
const AUTO_CHUNK_SIZES = [25, 15, 10, 5];

// greedily allocates a duration over the threshold into chunks from {25,15,10,5},
// largest first -- e.g. 60 -> [25,25,10]. A duration that isn't a clean multiple of 5
// leaves a remainder under 5 minutes after the greedy pass; that remainder becomes its
// own short final chunk rather than silently rounding the input or padding an earlier
// chunk, so the chunks always sum to exactly what was entered.
export function computeAutoSessionMinutes(totalMinutes: number): number[] {
  if (totalMinutes <= AUTO_SPLIT_THRESHOLD_MINUTES) return [totalMinutes];
  const chunks: number[] = [];
  let remaining = totalMinutes;
  for (const size of AUTO_CHUNK_SIZES) {
    while (remaining >= size) {
      chunks.push(size);
      remaining -= size;
    }
  }
  if (remaining > 0) chunks.push(remaining);
  return chunks;
}

export interface TaskSession {
  id: string;
  minutes: number;
}

// resolves the selectable session(s) for a task, regardless of split mode -- callers use
// this instead of reading durationMinutes/splitMode/subSessions directly.
//
// returns null when the task has no duration estimate at all, matching the pre-feature
// fallback (the caller falls back to whatever duration is otherwise selected, e.g. the
// timer's current preset -- there's nothing here to offer a duration for).
//
// returns a single-item array for: a duration at or under the threshold (no splitting
// applies), "custom" mode with no subSessions created yet (unconstrained, same as
// pre-feature behavior), or a task that predates this feature (splitMode undefined).
//
// returns a multi-item array for: "auto" mode on a duration over the threshold (split
// per computeAutoSessionMinutes), or "custom" mode with subSessions the user defined.
export function resolveTaskSessions(task: Task): TaskSession[] | null {
  if (task.durationMinutes === null || task.durationMinutes <= 0) return null;

  if (task.splitMode === "custom") {
    if (task.subSessions && task.subSessions.length > 0) {
      return task.subSessions.map((s) => ({ id: s.id, minutes: s.minutes }));
    }
    return [{ id: task.id, minutes: task.durationMinutes }];
  }

  if (task.splitMode === "auto") {
    return computeAutoSessionMinutes(task.durationMinutes).map((minutes, i) => ({
      id: `${task.id}-auto-${i}`,
      minutes,
    }));
  }

  // splitMode undefined -- predates this feature, same unconstrained behavior as before
  return [{ id: task.id, minutes: task.durationMinutes }];
}

// total minutes ever logged against this exact session id -- partial stops included, so
// starting a session, stopping partway, and starting it again later accumulates toward
// its total rather than resetting.
export function computeSessionLoggedMinutes(session: TaskSession, history: PomoRecord[]): number {
  return history
    .filter((r) => r.phase === "focus" && r.subSessionId === session.id)
    .reduce((sum, r) => sum + r.minutes, 0);
}

// how much of a specific session has actually been logged, 0-100, capped for display
export function computeSessionCompletionPct(session: TaskSession, history: PomoRecord[]): number {
  if (session.minutes <= 0) return 0;
  return Math.min(100, Math.round((computeSessionLoggedMinutes(session, history) / session.minutes) * 100));
}

// how long a session should run if picked again -- a session that was previously
// stopped partway (or completed and later revisited) resumes with whatever's actually
// left, not the original full duration. Falls back to the full duration once nothing's
// left to resume (never started, or already met/overran it) rather than offering a
// zero-or-negative session.
export function computeSessionRemainingMinutes(session: TaskSession, history: PomoRecord[]): number {
  const logged = computeSessionLoggedMinutes(session, history);
  const remaining = session.minutes - logged;
  return remaining > 0 ? remaining : session.minutes;
}
