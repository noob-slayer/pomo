import { useTasks } from "../context/TasksContext";
import { summarizeHistory } from "../lib/historyStats";
import { formatDuration } from "../lib/durations";
import type { Mode } from "../types";

interface DailySummaryProps {
  mode: Mode;
}

export function DailySummary({ mode }: DailySummaryProps) {
  const { history, tasks } = useTasks();
  const summary = summarizeHistory(history, tasks, mode);

  if (summary.todayMinutes === 0 && summary.todayBreakMinutes === 0) return null;

  return (
    <div className="daily-summary">
      <p className="daily-summary__line">today · {formatDuration(summary.todayMinutes)} focused</p>
      <p className="daily-summary__line">{formatDuration(summary.todayBreakMinutes)} break</p>
    </div>
  );
}
