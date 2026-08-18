import type { Mode, PomoRecord } from "../types";

export interface RecentSession {
  id: string;
  dateLabel: string;
  timeLabel: string;
  minutes: number;
  phase: "focus" | "break";
  taskTitle: string | null;
}

export interface SessionStats {
  totalSessions: number;
  avgSessionMinutes: number;
  totalBreakMinutes: number;
  avgBreakMinutes: number;
  longestToday: number;
  longestThisWeek: number;
  longestAllTime: number;
  todayMinutes: number;
  bestDayMinutes: number;
  bestDayLabel: string | null;
  minutesToBeatBest: number;
  recentSessions: RecentSession[];
}

function startOfWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}

export function computeSessionStats(history: PomoRecord[], mode: Mode): SessionStats {
  const focus = history.filter((r) => r.mode === mode && r.phase === "focus");
  const breaks = history.filter((r) => r.mode === mode && r.phase === "break");

  const totalSessions = focus.length;
  const avgSessionMinutes = totalSessions ? focus.reduce((s, r) => s + r.minutes, 0) / totalSessions : 0;
  const totalBreakMinutes = breaks.reduce((s, r) => s + r.minutes, 0);
  const avgBreakMinutes = breaks.length ? totalBreakMinutes / breaks.length : 0;

  const now = new Date();
  const todayKey = now.toDateString();
  const weekStart = startOfWeek(now);

  const longestToday = Math.max(
    0,
    ...focus.filter((r) => new Date(r.completedAt).toDateString() === todayKey).map((r) => r.minutes),
  );
  const longestThisWeek = Math.max(0, ...focus.filter((r) => r.completedAt >= weekStart).map((r) => r.minutes));
  const longestAllTime = Math.max(0, ...focus.map((r) => r.minutes));

  // per-day totals, to find the best day ever and how far today is from beating it
  const dayTotals = new Map<string, number>();
  for (const r of focus) {
    const key = new Date(r.completedAt).toDateString();
    dayTotals.set(key, (dayTotals.get(key) ?? 0) + r.minutes);
  }
  const todayMinutes = dayTotals.get(todayKey) ?? 0;

  let bestDayMinutes = 0;
  let bestDayKey: string | null = null;
  for (const [key, minutes] of dayTotals) {
    if (minutes > bestDayMinutes) {
      bestDayMinutes = minutes;
      bestDayKey = key;
    }
  }
  // if today itself is (so far) the best day on record, "the record to beat" is
  // whatever the best day *excluding* today was, not today's own still-growing total
  const bestExcludingToday =
    bestDayKey === todayKey
      ? Math.max(0, ...[...dayTotals.entries()].filter(([key]) => key !== todayKey).map(([, v]) => v))
      : bestDayMinutes;
  const minutesToBeatBest = Math.max(0, bestExcludingToday - todayMinutes);

  const recentSessions: RecentSession[] = [...history]
    .filter((r) => r.mode === mode)
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, 20)
    .map((r) => {
      const d = new Date(r.completedAt);
      return {
        id: r.id,
        dateLabel: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }).toLowerCase(),
        timeLabel: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).toLowerCase(),
        minutes: r.minutes,
        phase: r.phase,
        taskTitle: r.taskTitle,
      };
    });

  return {
    totalSessions,
    avgSessionMinutes,
    totalBreakMinutes,
    avgBreakMinutes,
    longestToday,
    longestThisWeek,
    longestAllTime,
    todayMinutes,
    bestDayMinutes,
    bestDayLabel: bestDayKey
      ? new Date(bestDayKey).toLocaleDateString(undefined, { month: "short", day: "numeric" }).toLowerCase()
      : null,
    minutesToBeatBest,
    recentSessions,
  };
}
