import { useTasks } from "../context/TasksContext";
import { summarizeHistory } from "../lib/historyStats";
import type { Mode } from "../types";

interface HistoryViewProps {
  mode: Mode;
}

export function HistoryView({ mode }: HistoryViewProps) {
  const { history, tasks } = useTasks();
  const summary = summarizeHistory(history, tasks, mode);
  const maxMinutes = Math.max(1, ...summary.days.map((d) => d.minutes));

  return (
    <div className="history-view">
      <div className="history-stats">
        <div className="history-stat">
          <span className="history-stat__value tabular">{summary.todayPomos}</span>
          <span className="history-stat__label">today</span>
        </div>
        <div className="history-stat">
          <span className="history-stat__value tabular">{summary.totalPomos}</span>
          <span className="history-stat__label">all time</span>
        </div>
        <div className="history-stat">
          <span className="history-stat__value tabular">{summary.totalMinutes}</span>
          <span className="history-stat__label">minutes focused</span>
        </div>
      </div>

      <p className="history-section__label">last 7 days</p>
      <div className="history-bars">
        {summary.days.map((day) => (
          <div key={day.key} className="history-bar" title={`${day.label}: ${day.minutes} min`}>
            <div
              className="history-bar__fill"
              style={{ height: `${Math.max(4, (day.minutes / maxMinutes) * 100)}%` }}
            />
            <span className="history-bar__label">{day.label.slice(0, 2)}</span>
          </div>
        ))}
      </div>

      <p className="history-section__label">by category</p>
      {summary.byCategory.length === 0 && <p className="task-empty">no pomos logged yet</p>}
      <ul className="history-categories">
        {summary.byCategory.map((cat) => (
          <li key={cat.category} className="history-category">
            <span className="history-category__name">{cat.category}</span>
            <span className="history-category__value tabular">
              {cat.count} · {cat.minutes}m
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
