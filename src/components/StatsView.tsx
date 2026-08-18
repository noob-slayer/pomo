import { useTasks } from "../context/TasksContext";
import { summarizeHistory } from "../lib/historyStats";
import { computeSessionStats } from "../lib/statsCalc";
import { formatDuration } from "../lib/durations";
import type { Mode } from "../types";

interface StatsViewProps {
  mode: Mode;
}

const TREND_DAYS = 30;

export function StatsView({ mode }: StatsViewProps) {
  const { history, tasks } = useTasks();
  const summary = summarizeHistory(history, tasks, mode, TREND_DAYS);
  const stats = computeSessionStats(history, mode);

  if (stats.totalSessions === 0) {
    return <p className="task-empty">no sessions logged yet — complete a focus session to see stats here</p>;
  }

  const maxTrendMinutes = Math.max(1, ...summary.days.map((d) => d.minutes));

  return (
    <div className="stats-view">
      {stats.minutesToBeatBest > 0 ? (
        <div className="stats-best-banner">
          <p className="stats-best-banner__title">beat your best</p>
          <p className="stats-best-banner__body">
            {formatDuration(stats.minutesToBeatBest)} more today to top your best day
            {stats.bestDayLabel ? ` (${stats.bestDayLabel} · ${formatDuration(stats.bestDayMinutes)})` : ""}
          </p>
        </div>
      ) : (
        <div className="stats-best-banner stats-best-banner--achieved">
          <p className="stats-best-banner__title">personal best</p>
          <p className="stats-best-banner__body">today is your best day yet — {formatDuration(stats.todayMinutes)}</p>
        </div>
      )}

      <div className="stats-grid">
        <div className="stats-tile">
          <span className="stats-tile__value tabular">{stats.totalSessions}</span>
          <span className="stats-tile__label">sessions</span>
        </div>
        <div className="stats-tile">
          <span className="stats-tile__value tabular">{formatDuration(stats.avgSessionMinutes)}</span>
          <span className="stats-tile__label">avg session</span>
        </div>
        <div className="stats-tile">
          <span className="stats-tile__value tabular">{formatDuration(stats.totalBreakMinutes)}</span>
          <span className="stats-tile__label">total break</span>
        </div>
        <div className="stats-tile">
          <span className="stats-tile__value tabular">{formatDuration(stats.avgBreakMinutes)}</span>
          <span className="stats-tile__label">avg break</span>
        </div>
        <div className="stats-tile">
          <span className="stats-tile__value tabular">{formatDuration(stats.longestToday)}</span>
          <span className="stats-tile__label">longest today</span>
        </div>
        <div className="stats-tile">
          <span className="stats-tile__value tabular">{formatDuration(stats.longestThisWeek)}</span>
          <span className="stats-tile__label">longest this week</span>
        </div>
        <div className="stats-tile">
          <span className="stats-tile__value tabular">{formatDuration(stats.longestAllTime)}</span>
          <span className="stats-tile__label">longest all-time</span>
        </div>
      </div>

      <p className="history-section__label">by category</p>
      <ul className="history-categories">
        {summary.byCategory.map((cat) => (
          <li key={cat.category} className="history-category">
            <span className="history-category__name">{cat.category}</span>
            <span className="history-category__value tabular">
              {cat.count} · {formatDuration(cat.minutes)}
            </span>
          </li>
        ))}
      </ul>

      <p className="history-section__label">last {TREND_DAYS} days</p>
      <div className="stats-trend">
        {summary.days.map((day) => (
          <div key={day.key} className="stats-trend__bar" title={`${day.label}: ${formatDuration(day.minutes)}`}>
            <div
              className="stats-trend__fill"
              style={{ height: `${Math.max(3, (day.minutes / maxTrendMinutes) * 100)}%` }}
            />
          </div>
        ))}
      </div>

      <p className="history-section__label">recent sessions</p>
      <ul className="stats-log">
        {stats.recentSessions.map((s) => (
          <li key={s.id} className="stats-log__row">
            <span className="stats-log__when">
              {s.dateLabel} · {s.timeLabel}
            </span>
            <span className="stats-log__what">{s.phase === "break" ? "break" : (s.taskTitle ?? "focus")}</span>
            <span className="stats-log__minutes tabular">{formatDuration(s.minutes)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
