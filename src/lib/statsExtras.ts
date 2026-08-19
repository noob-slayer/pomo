import type { Mode, PomoRecord } from "../types";

function dayKey(ts: number): string {
  return new Date(ts).toDateString();
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

export interface StreakInfo {
  current: number;
  longest: number;
  activeToday: boolean;
}

// a streak counts consecutive *calendar days* with at least one completed focus session.
// "current" stays alive through today even if today has nothing logged yet (the day
// isn't over), but breaks the moment yesterday is also empty.
export function computeStreaks(history: PomoRecord[], mode: Mode): StreakInfo {
  const focus = history.filter((r) => r.mode === mode && r.phase === "focus");
  if (focus.length === 0) return { current: 0, longest: 0, activeToday: false };

  const dayTimes = [...new Set(focus.map((r) => dayKey(r.completedAt)))]
    .map((k) => new Date(k).getTime())
    .sort((a, b) => a - b);

  let longest = 1;
  let run = 1;
  for (let i = 1; i < dayTimes.length; i++) {
    const diffDays = Math.round((dayTimes[i] - dayTimes[i - 1]) / 86400000);
    if (diffDays === 1) run += 1;
    else if (diffDays > 1) run = 1;
    longest = Math.max(longest, run);
  }

  const days = new Set(dayTimes);
  const today = startOfDay(new Date());
  const activeToday = days.has(today.getTime());
  const cursor = new Date(today);
  if (!activeToday) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while (days.has(cursor.getTime())) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { current, longest, activeToday };
}

export interface HeatmapDay {
  key: string;
  date: Date;
  minutes: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export function computeHeatmap(history: PomoRecord[], mode: Mode, days = 126): HeatmapDay[] {
  const focus = history.filter((r) => r.mode === mode && r.phase === "focus");
  const totals = new Map<string, number>();
  for (const r of focus) totals.set(dayKey(r.completedAt), (totals.get(dayKey(r.completedAt)) ?? 0) + r.minutes);
  const max = Math.max(1, ...totals.values());

  const today = startOfDay(new Date());
  const result: HeatmapDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toDateString();
    const minutes = totals.get(key) ?? 0;
    const level: HeatmapDay["level"] =
      minutes === 0 ? 0 : minutes < max * 0.25 ? 1 : minutes < max * 0.5 ? 2 : minutes < max * 0.75 ? 3 : 4;
    result.push({ key, date: d, minutes, level });
  }
  return result;
}

export interface WeekStat {
  key: string;
  label: string;
  minutes: number;
  sessions: number;
}

export function computeWeeklyTrend(history: PomoRecord[], mode: Mode, weeks = 12): WeekStat[] {
  const focus = history.filter((r) => r.mode === mode && r.phase === "focus");
  const thisWeekStart = startOfWeek(new Date());

  const buckets: WeekStat[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisWeekStart);
    start.setDate(start.getDate() - i * 7);
    buckets.push({
      key: start.toDateString(),
      label: start.toLocaleDateString(undefined, { month: "short", day: "numeric" }).toLowerCase(),
      minutes: 0,
      sessions: 0,
    });
  }
  const indexByKey = new Map(buckets.map((b, idx) => [b.key, idx]));
  for (const r of focus) {
    const idx = indexByKey.get(startOfWeek(new Date(r.completedAt)).toDateString());
    if (idx === undefined) continue; // outside the window
    buckets[idx].minutes += r.minutes;
    buckets[idx].sessions += 1;
  }
  return buckets;
}

export interface WeekComparison {
  thisWeekMinutes: number;
  lastWeekMinutes: number;
  deltaPct: number | null; // null when last week had nothing to compare against
}

export function computeWeekComparison(history: PomoRecord[], mode: Mode): WeekComparison {
  const [last, thisWeek] = computeWeeklyTrend(history, mode, 2);
  const deltaPct = last.minutes > 0 ? Math.round(((thisWeek.minutes - last.minutes) / last.minutes) * 100) : null;
  return { thisWeekMinutes: thisWeek.minutes, lastWeekMinutes: last.minutes, deltaPct };
}

// a same-day-vs-usual-pace score, not a global ranking -- 100 means "a strong day for
// you specifically", weighted toward volume relative to your own last-4-weeks daily
// average, with a small bonus for spreading it across more than one session.
export function computeFocusScore(history: PomoRecord[], mode: Mode): number {
  const trend = computeWeeklyTrend(history, mode, 4);
  const avgDaily = trend.reduce((s, w) => s + w.minutes, 0) / trend.length / 7;

  const focus = history.filter((r) => r.mode === mode && r.phase === "focus");
  const todayKey = new Date().toDateString();
  const today = focus.filter((r) => new Date(r.completedAt).toDateString() === todayKey);
  const todayMinutes = today.reduce((s, r) => s + r.minutes, 0);
  if (todayMinutes === 0) return 0;

  const volumeScore = avgDaily > 0 ? Math.min(70, (todayMinutes / avgDaily) * 45) : Math.min(70, todayMinutes / 2);
  const sessionScore = Math.min(30, today.length * 8);
  return Math.round(Math.min(100, volumeScore + sessionScore));
}

export interface Badge {
  id: string;
  label: string;
  description: string;
  achieved: boolean;
}

// every badge is recomputed live from history on each render -- deliberately no
// "unlocked_at" persisted anywhere, so there's nothing to migrate if a threshold changes.
export function computeBadges(history: PomoRecord[], mode: Mode): Badge[] {
  const focus = history.filter((r) => r.mode === mode && r.phase === "focus");
  const totalSessions = focus.length;
  const totalMinutes = focus.reduce((s, r) => s + r.minutes, 0);
  const longest = Math.max(0, ...focus.map((r) => r.minutes));
  const streaks = computeStreaks(history, mode);
  const earlyBird = focus.some((r) => new Date(r.completedAt).getHours() < 7);
  const nightOwl = focus.some((r) => new Date(r.completedAt).getHours() >= 22);
  const weekendWarrior = focus.some((r) => [0, 6].includes(new Date(r.completedAt).getDay()));

  return [
    { id: "first-pomo", label: "first pomo", description: "complete your first focus session", achieved: totalSessions >= 1 },
    { id: "getting-started", label: "getting started", description: "complete 10 focus sessions", achieved: totalSessions >= 10 },
    { id: "half-century", label: "half century", description: "complete 50 focus sessions", achieved: totalSessions >= 50 },
    { id: "century", label: "century", description: "complete 100 focus sessions", achieved: totalSessions >= 100 },
    { id: "deep-work", label: "deep work", description: "finish a single session of 90+ minutes", achieved: longest >= 90 },
    { id: "marathon", label: "marathon", description: "finish a single session of 3+ hours", achieved: longest >= 180 },
    { id: "on-a-roll", label: "on a roll", description: "hit a 3-day focus streak", achieved: streaks.longest >= 3 },
    { id: "unstoppable", label: "unstoppable", description: "hit a 7-day focus streak", achieved: streaks.longest >= 7 },
    { id: "iron-will", label: "iron will", description: "hit a 30-day focus streak", achieved: streaks.longest >= 30 },
    { id: "early-bird", label: "early bird", description: "log a session before 7am", achieved: earlyBird },
    { id: "night-owl", label: "night owl", description: "log a session after 10pm", achieved: nightOwl },
    { id: "weekend-warrior", label: "weekend warrior", description: "focus on a saturday or sunday", achieved: weekendWarrior },
    { id: "10-hours", label: "10 hours total", description: "cross 10 hours focused, all time", achieved: totalMinutes >= 600 },
    { id: "50-hours", label: "50 hours total", description: "cross 50 hours focused, all time", achieved: totalMinutes >= 3000 },
    { id: "100-hours", label: "100 hours total", description: "cross 100 hours focused, all time", achieved: totalMinutes >= 6000 },
  ];
}

// a relatable comparison for a raw minute count -- deliberately coarse, not meant to be
// precise, just to make the number feel concrete
export function focusEquivalent(totalMinutes: number): string | null {
  const hours = totalMinutes / 60;
  if (hours < 1.5) return null;
  const movies = hours / 2.2;
  if (movies < 1.2) return `that's about one full feature film's worth of uninterrupted focus`;
  if (movies < 20) return `that's about ${movies.toFixed(1)} feature films' worth of uninterrupted focus`;
  const workWeeks = hours / 40;
  if (workWeeks < 1.2) return `that's about ${movies.toFixed(0)} feature films' worth of uninterrupted focus`;
  return `that's about ${workWeeks.toFixed(1)} standard work weeks of pure focus time`;
}
