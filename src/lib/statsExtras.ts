import type { Mode, PomoRecord, Task } from "../types";

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

  const today = startOfDay(new Date());
  const windowKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    windowKeys.push(d.toDateString());
  }

  // color scale caps at the 90th percentile of *active* days actually inside this window,
  // not the single busiest day (and not scaled against all-time history the way the old
  // version implicitly was, since `totals` covers every record regardless of window). A
  // raw max meant one outlier -- a single long marathon session, possibly from outside the
  // visible window entirely -- crushed every other genuinely solid day into the faintest
  // bucket, since everything was scaled relative to that one value. This also means a
  // consistent, uniform habit now reads as solidly filled-in rather than always landing in
  // the lightest bucket (every active day sits at or above its own 90th percentile when
  // there's no real spread).
  const activeInWindow = windowKeys
    .map((k) => totals.get(k) ?? 0)
    .filter((m) => m > 0)
    .sort((a, b) => a - b);
  const effectiveMax =
    activeInWindow.length > 0 ? Math.max(1, activeInWindow[Math.floor(0.9 * (activeInWindow.length - 1))]) : 1;

  return windowKeys.map((key) => {
    const minutes = totals.get(key) ?? 0;
    const level: HeatmapDay["level"] =
      minutes === 0
        ? 0
        : minutes < effectiveMax * 0.25
          ? 1
          : minutes < effectiveMax * 0.5
            ? 2
            : minutes < effectiveMax * 0.75
              ? 3
              : 4;
    return { key, date: new Date(key), minutes, level };
  });
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

const DAY_MS = 86400000;

// deliberately trailing 7-day windows, not calendar-week-to-date vs a full previous
// calendar week (computeWeeklyTrend's buckets, used for the trend chart, are the right
// choice there -- but reused for this comparison, they made "this week" always look like a
// steep decline early in the week purely because fewer days had elapsed yet, not because of
// anything the user actually did differently). Trailing windows are always a fair
// apples-to-apples 7-day chunk regardless of what day it is.
export function computeWeekComparison(history: PomoRecord[], mode: Mode): WeekComparison {
  const focus = history.filter((r) => r.mode === mode && r.phase === "focus");
  const now = Date.now();
  const sumBetween = (msAgoStart: number, msAgoEnd: number) =>
    focus
      .filter((r) => r.completedAt > now - msAgoStart && r.completedAt <= now - msAgoEnd)
      .reduce((s, r) => s + r.minutes, 0);

  const thisWeekMinutes = sumBetween(7 * DAY_MS, 0);
  const lastWeekMinutes = sumBetween(14 * DAY_MS, 7 * DAY_MS);
  const deltaPct =
    lastWeekMinutes > 0 ? Math.round(((thisWeekMinutes - lastWeekMinutes) / lastWeekMinutes) * 100) : null;
  return { thisWeekMinutes, lastWeekMinutes, deltaPct };
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
  // omitted for badges with no single clean linear metric (early-bird/night-owl/weekend
  // warrior are one-time conditions, not a count that climbs toward a target)
  progress?: { current: number; target: number };
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
    { id: "first-pomo", label: "first pomo", description: "complete your first focus session", achieved: totalSessions >= 1, progress: { current: totalSessions, target: 1 } },
    { id: "getting-started", label: "getting started", description: "complete 10 focus sessions", achieved: totalSessions >= 10, progress: { current: totalSessions, target: 10 } },
    { id: "half-century", label: "half century", description: "complete 50 focus sessions", achieved: totalSessions >= 50, progress: { current: totalSessions, target: 50 } },
    { id: "century", label: "century", description: "complete 100 focus sessions", achieved: totalSessions >= 100, progress: { current: totalSessions, target: 100 } },
    { id: "deep-work", label: "deep work", description: "finish a single session of 90+ minutes", achieved: longest >= 90, progress: { current: longest, target: 90 } },
    { id: "marathon", label: "marathon", description: "finish a single session of 3+ hours", achieved: longest >= 180, progress: { current: longest, target: 180 } },
    { id: "on-a-roll", label: "on a roll", description: "hit a 3-day focus streak", achieved: streaks.longest >= 3, progress: { current: streaks.longest, target: 3 } },
    { id: "unstoppable", label: "unstoppable", description: "hit a 7-day focus streak", achieved: streaks.longest >= 7, progress: { current: streaks.longest, target: 7 } },
    { id: "iron-will", label: "iron will", description: "hit a 30-day focus streak", achieved: streaks.longest >= 30, progress: { current: streaks.longest, target: 30 } },
    { id: "early-bird", label: "early bird", description: "log a session before 7am", achieved: earlyBird },
    { id: "night-owl", label: "night owl", description: "log a session after 10pm", achieved: nightOwl },
    { id: "weekend-warrior", label: "weekend warrior", description: "focus on a saturday or sunday", achieved: weekendWarrior },
    { id: "10-hours", label: "10 hours total", description: "cross 10 hours focused, all time", achieved: totalMinutes >= 600, progress: { current: totalMinutes, target: 600 } },
    { id: "50-hours", label: "50 hours total", description: "cross 50 hours focused, all time", achieved: totalMinutes >= 3000, progress: { current: totalMinutes, target: 3000 } },
    { id: "100-hours", label: "100 hours total", description: "cross 100 hours focused, all time", achieved: totalMinutes >= 6000, progress: { current: totalMinutes, target: 6000 } },
  ];
}

const SEEN_BADGES_KEY = "pomo:seenBadges";

// null means this identity/mode has never been evaluated before -- distinct from an
// initialized-but-empty set, so an existing user's already-achieved badges (the moment
// this feature ships) aren't mistaken for freshly-earned ones the first time this runs.
export function readSeenBadges(mode: Mode): Set<string> | null {
  try {
    const raw = window.localStorage.getItem(SEEN_BADGES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const modeState = parsed[mode];
    return Array.isArray(modeState) ? new Set(modeState) : null;
  } catch {
    return null;
  }
}

export function writeSeenBadges(mode: Mode, ids: string[]): void {
  try {
    const raw = window.localStorage.getItem(SEEN_BADGES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[mode] = ids;
    window.localStorage.setItem(SEEN_BADGES_KEY, JSON.stringify(parsed));
  } catch {
    // storage unavailable -- unlock toasts just won't dedupe across reloads, not fatal
  }
}

export interface EstimateAccuracy {
  tasksCompared: number;
  avgEstimateMinutes: number;
  avgActualMinutes: number;
  // positive = you tend to run over your own estimate, negative = under, null = not
  // enough data (no task in this mode has both an estimate and a logged session yet)
  avgOverrunPct: number | null;
}

// compares a task's own duration estimate against the actual time logged against it --
// only counts tasks that have BOTH (an estimate with zero sessions logged yet has nothing
// to compare; a session with no estimate has nothing to compare against either)
export function computeEstimateAccuracy(history: PomoRecord[], tasks: Task[], mode: Mode): EstimateAccuracy {
  const focus = history.filter((r) => r.mode === mode && r.phase === "focus");
  const estimated = tasks.filter((t) => t.mode === mode && t.durationMinutes && t.durationMinutes > 0);

  let totalEstimate = 0;
  let totalActual = 0;
  let tasksCompared = 0;
  for (const task of estimated) {
    const actual = focus.filter((r) => r.taskId === task.id).reduce((s, r) => s + r.minutes, 0);
    if (actual === 0) continue;
    totalEstimate += task.durationMinutes as number;
    totalActual += actual;
    tasksCompared += 1;
  }

  if (tasksCompared === 0) {
    return { tasksCompared: 0, avgEstimateMinutes: 0, avgActualMinutes: 0, avgOverrunPct: null };
  }
  return {
    tasksCompared,
    avgEstimateMinutes: totalEstimate / tasksCompared,
    avgActualMinutes: totalActual / tasksCompared,
    avgOverrunPct: Math.round(((totalActual - totalEstimate) / totalEstimate) * 100),
  };
}

export interface CompletionStats {
  totalStarted: number;
  totalCompleted: number;
  completionRate: number; // 0-100
}

// "completed" distinguishes a focus session that finished naturally from one stopped
// early -- both used to write an identical row shape, making this uncomputable. Records
// from before that field existed (in localStorage, or a database row from before the
// matching migration ran) have no value stored -- treated as completed here (`!== false`)
// rather than defaulting to false, since the overwhelming majority of historical sessions
// really were completions, and there's no way to reconstruct the truth for anything logged
// before this shipped. Scoped to focus sessions only -- stopping a break early isn't a
// meaningful "failure" the way abandoning a focus session is.
export function computeCompletionStats(history: PomoRecord[], mode: Mode): CompletionStats {
  const focus = history.filter((r) => r.mode === mode && r.phase === "focus");
  const totalStarted = focus.length;
  const totalCompleted = focus.filter((r) => r.completed !== false).length;
  const completionRate = totalStarted > 0 ? Math.round((totalCompleted / totalStarted) * 100) : 0;
  return { totalStarted, totalCompleted, completionRate };
}

export interface DailyGoalDay {
  key: string;
  date: Date;
  minutes: number;
  pct: number; // uncapped -- a day where you doubled the goal reads as 200, not clamped
  met: boolean;
}

export interface DailyGoalHistory {
  days: DailyGoalDay[];
  avgPct: number; // 0-100, each day capped at 100 before averaging -- see computeDailyGoalHistory
}

// retroactively applies *today's* daily goal to each day in the window -- like the weekly
// goal ring above, there's no stored history of what the goal used to be on past days, only
// what it's set to right now. Same tradeoff computeWeekComparison already accepts.
export function computeDailyGoalHistory(
  history: PomoRecord[],
  mode: Mode,
  dailyGoalMinutes: number,
  days = 14,
): DailyGoalHistory {
  const focus = history.filter((r) => r.mode === mode && r.phase === "focus");
  const totals = new Map<string, number>();
  for (const r of focus) totals.set(dayKey(r.completedAt), (totals.get(dayKey(r.completedAt)) ?? 0) + r.minutes);

  const today = startOfDay(new Date());
  const result: DailyGoalDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toDateString();
    const minutes = totals.get(key) ?? 0;
    const pct = dailyGoalMinutes > 0 ? Math.round((minutes / dailyGoalMinutes) * 100) : 0;
    result.push({ key, date: d, minutes, pct, met: pct >= 100 });
  }
  const avgPct =
    result.length > 0 ? Math.round(result.reduce((s, d) => s + Math.min(100, d.pct), 0) / result.length) : 0;
  return { days: result, avgPct };
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
  return `that's about ${workWeeks.toFixed(1)} standard work weeks of pure focus time`;
}
