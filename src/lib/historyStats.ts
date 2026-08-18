import type { Mode, PomoRecord, Task } from "../types";

export interface CategoryStat {
  category: string;
  count: number;
  minutes: number;
}

export interface DayStat {
  key: string;
  label: string;
  count: number;
  minutes: number;
}

export interface HistorySummary {
  totalPomos: number;
  totalMinutes: number;
  todayPomos: number;
  todayMinutes: number;
  todayBreakMinutes: number;
  byCategory: CategoryStat[];
  days: DayStat[];
}

export function summarizeHistory(history: PomoRecord[], tasks: Task[], mode: Mode, days = 7): HistorySummary {
  const focus = history.filter((r) => r.mode === mode && r.phase === "focus");
  const breaks = history.filter((r) => r.mode === mode && r.phase === "break");
  const totalMinutes = focus.reduce((sum, r) => sum + r.minutes, 0);

  const todayKey = new Date().toDateString();
  const today = focus.filter((r) => new Date(r.completedAt).toDateString() === todayKey);
  const todayBreaks = breaks.filter((r) => new Date(r.completedAt).toDateString() === todayKey);

  const catMap = new Map<string, { count: number; minutes: number }>();
  for (const r of focus) {
    const task = r.taskId ? tasks.find((t) => t.id === r.taskId) : undefined;
    const category = task?.category ?? "uncategorized";
    const entry = catMap.get(category) ?? { count: 0, minutes: 0 };
    entry.count += 1;
    entry.minutes += r.minutes;
    catMap.set(category, entry);
  }
  // breaks aren't tied to a task/category, but time spent on them should still show up
  // in the same summary — "if break is for 5 mins, it should also reflect"
  if (breaks.length > 0) {
    catMap.set("break", {
      count: breaks.length,
      minutes: breaks.reduce((sum, r) => sum + r.minutes, 0),
    });
  }
  const byCategory = [...catMap.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.minutes - a.minutes);

  const dayStats: DayStat[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toDateString();
    const dayRecords = focus.filter((r) => new Date(r.completedAt).toDateString() === key);
    dayStats.push({
      key,
      label: d.toLocaleDateString(undefined, { weekday: "short" }).toLowerCase(),
      count: dayRecords.length,
      minutes: dayRecords.reduce((sum, r) => sum + r.minutes, 0),
    });
  }

  return {
    totalPomos: focus.length,
    totalMinutes,
    todayPomos: today.length,
    todayMinutes: today.reduce((sum, r) => sum + r.minutes, 0),
    todayBreakMinutes: todayBreaks.reduce((sum, r) => sum + r.minutes, 0),
    byCategory,
    days: dayStats,
  };
}
