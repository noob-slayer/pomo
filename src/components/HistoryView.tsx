import { useState } from "react";
import { useTasks } from "../context/TasksContext";
import { summarizeHistory } from "../lib/historyStats";
import { formatDuration } from "../lib/durations";
import type { Mode } from "../types";

interface HistoryViewProps {
  mode: Mode;
}

// how many individual sessions to list -- enough to find and remove a stray entry (the
// reason this list exists) without rendering an unbounded history into the panel.
const RECENT_LIMIT = 50;

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

export function HistoryView({ mode }: HistoryViewProps) {
  const { history, tasks, removeHistory } = useTasks();
  const summary = summarizeHistory(history, tasks, mode);
  const maxMinutes = Math.max(1, ...summary.days.map((d) => d.minutes));

  // which row is awaiting a delete confirm -- a two-tap guard so a single mis-tap on a small
  // phone target can't silently erase a logged session
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const recent = history
    .filter((r) => r.mode === mode)
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, RECENT_LIMIT);

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

      {recent.length > 0 && (
        <>
          <p className="history-section__label">recent sessions</p>
          <ul className="history-sessions">
            {recent.map((r) => {
              const when = new Date(r.completedAt);
              const label =
                r.phase === "break" ? "break" : r.taskTitle ? r.taskTitle : "focus";
              return (
                <li key={r.id} className="history-session">
                  <span className="history-session__main">
                    <span className="history-session__label">
                      {label}
                      {r.completed === false && <span className="history-session__flag"> · stopped</span>}
                    </span>
                    <span className="history-session__meta tabular">
                      {dateFmt.format(when).toLowerCase()} · {timeFmt.format(when).toLowerCase()} ·{" "}
                      {formatDuration(r.minutes)}
                    </span>
                  </span>
                  {confirmId === r.id ? (
                    <span className="history-session__confirm">
                      <button
                        type="button"
                        className="history-session__btn history-session__btn--yes"
                        onClick={() => {
                          removeHistory(r.id);
                          setConfirmId(null);
                        }}
                      >
                        delete
                      </button>
                      <button
                        type="button"
                        className="history-session__btn"
                        onClick={() => setConfirmId(null)}
                      >
                        cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="history-session__btn history-session__del"
                      aria-label={`delete this ${label} session`}
                      onClick={() => setConfirmId(r.id)}
                    >
                      ✕
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
