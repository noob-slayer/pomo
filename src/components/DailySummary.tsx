import { useTasks } from "../context/TasksContext";
import { useSettings } from "../context/SettingsContext";
import { summarizeHistory } from "../lib/historyStats";
import { computeSessionStats } from "../lib/statsCalc";
import { computeWeeklyTrend } from "../lib/statsExtras";
import { formatDuration } from "../lib/durations";
import type { Mode } from "../types";

interface DailySummaryProps {
  mode: Mode;
  onOpenStats: () => void;
}

export function DailySummary({ mode, onOpenStats }: DailySummaryProps) {
  const { history, tasks } = useTasks();
  const {
    dailyGoalWorkMinutes,
    dailyGoalPersonalMinutes,
    weeklyGoalWorkMinutes,
    weeklyGoalPersonalMinutes,
  } = useSettings();
  const summary = summarizeHistory(history, tasks, mode);

  if (summary.todayMinutes === 0 && summary.todayBreakMinutes === 0) return null;

  const stats = computeSessionStats(history, mode);
  const avgToday = summary.todayPomos ? summary.todayMinutes / summary.todayPomos : 0;
  const dailyGoalMinutes = mode === "work" ? dailyGoalWorkMinutes : dailyGoalPersonalMinutes;
  const weeklyGoalMinutes = mode === "work" ? weeklyGoalWorkMinutes : weeklyGoalPersonalMinutes;
  // weeks=1 still returns the current calendar week's bucket -- computeWeeklyTrend's loop
  // always ends at i=0 (thisWeekStart), so there's nothing to trim off with a window of 1
  const thisWeekMinutes = computeWeeklyTrend(history, mode, 1)[0]?.minutes ?? 0;

  return (
    <div className="daily-summary">
      <p className="daily-summary__title">you</p>
      <p className="daily-summary__line">today · {formatDuration(summary.todayMinutes)} focused</p>
      {summary.todayPomos > 0 && (
        <p className="daily-summary__line">
          {summary.todayPomos} session{summary.todayPomos === 1 ? "" : "s"} · avg {formatDuration(avgToday)}
        </p>
      )}
      {stats.longestToday > 0 && (
        <p className="daily-summary__line">longest {formatDuration(stats.longestToday)}</p>
      )}
      <p className="daily-summary__line">{formatDuration(summary.todayBreakMinutes)} break</p>

      {weeklyGoalMinutes !== null ? (
        <div className="daily-summary__goal">
          <span className="daily-summary__goal-label">
            weekly goal · {Math.min(100, Math.round((thisWeekMinutes / weeklyGoalMinutes) * 100))}%
          </span>
          <div className="daily-summary__goal-bar">
            <div
              className="daily-summary__goal-fill"
              style={{ width: `${Math.min(100, (thisWeekMinutes / weeklyGoalMinutes) * 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <button type="button" className="daily-summary__set-goal" onClick={onOpenStats}>
          set weekly goal
        </button>
      )}

      {dailyGoalMinutes !== null ? (
        <div className="daily-summary__goal">
          <span className="daily-summary__goal-label">
            daily goal · {Math.min(100, Math.round((summary.todayMinutes / dailyGoalMinutes) * 100))}%
          </span>
          <div className="daily-summary__goal-bar">
            <div
              className="daily-summary__goal-fill"
              style={{ width: `${Math.min(100, (summary.todayMinutes / dailyGoalMinutes) * 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <button type="button" className="daily-summary__set-goal" onClick={onOpenStats}>
          set daily goal
        </button>
      )}
    </div>
  );
}
