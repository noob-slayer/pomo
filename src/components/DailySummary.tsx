import { useTasks } from "../context/TasksContext";
import { summarizeHistory } from "../lib/historyStats";
import { computeSessionStats } from "../lib/statsCalc";
import { formatDuration } from "../lib/durations";
import type { Mode } from "../types";

interface DailySummaryProps {
  mode: Mode;
}

export function DailySummary({ mode }: DailySummaryProps) {
  const { history, tasks } = useTasks();
  const summary = summarizeHistory(history, tasks, mode);

  if (summary.todayMinutes === 0 && summary.todayBreakMinutes === 0) return null;

  const stats = computeSessionStats(history, mode);
  const avgToday = summary.todayPomos ? summary.todayMinutes / summary.todayPomos : 0;

  return (
    <div className="daily-summary">
      <p className="daily-summary__line">today · {formatDuration(summary.todayMinutes)} focused</p>
      {summary.todayPomos > 0 && (
        <p className="daily-summary__line">
          {summary.todayPomos} session{summary.todayPomos === 1 ? "" : "s"} · avg {formatDuration(avgToday)}
        </p>
      )}
      {stats.longestToday > 0 && (
        <p className="daily-summary__line">longest {formatDuration(stats.longestToday)}</p>
      )}
      {summary.todayBreakMinutes > 0 && (
        <p className="daily-summary__line">{formatDuration(summary.todayBreakMinutes)} break</p>
      )}
    </div>
  );
}
