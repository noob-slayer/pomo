import { useTasks } from "../context/TasksContext";
import { computeSessionStats } from "../lib/statsCalc";
import { computeStreaks, computeFocusScore } from "../lib/statsExtras";
import { formatDuration } from "../lib/durations";
import { IconFlame } from "./icons";
import type { Mode } from "../types";

interface StatsViewProps {
  mode: Mode;
  onOpenFull: () => void;
}

// the task-panel tab is deliberately just a teaser -- streak, today's focus score, and a
// couple of headline numbers -- with everything else (heatmap, badges, trend, category
// breakdown, recap download) living behind the "open full stats" CTA into
// PersonalStatsPage, a proper full-page view rather than squeezed into this sidebar.
export function StatsView({ mode, onOpenFull }: StatsViewProps) {
  const { history } = useTasks();
  const stats = computeSessionStats(history, mode);

  if (stats.totalSessions === 0) {
    return <p className="task-empty">no sessions logged yet — complete a focus session to see stats here</p>;
  }

  const streaks = computeStreaks(history, mode);
  const focusScore = computeFocusScore(history, mode);

  return (
    <div className="stats-teaser">
      <div className="stats-teaser__row">
        <div className="stats-teaser__stat">
          <span className="stats-teaser__icon">
            <IconFlame />
          </span>
          <span className="stats-teaser__value tabular">{streaks.current}</span>
          <span className="stats-teaser__label">day streak</span>
        </div>
        <div className="stats-teaser__stat">
          <span className="stats-teaser__value tabular">{focusScore}</span>
          <span className="stats-teaser__label">focus score</span>
        </div>
        <div className="stats-teaser__stat">
          <span className="stats-teaser__value tabular">{stats.totalSessions}</span>
          <span className="stats-teaser__label">sessions</span>
        </div>
      </div>

      {stats.minutesToBeatBest > 0 ? (
        <p className="stats-teaser__hint">
          {formatDuration(stats.minutesToBeatBest)} more today to beat your best
          {stats.bestDayLabel ? ` (${stats.bestDayLabel})` : ""}
        </p>
      ) : (
        <p className="stats-teaser__hint">today is your best day yet — {formatDuration(stats.todayMinutes)}</p>
      )}

      <button type="button" className="stats-teaser__cta" onClick={onOpenFull}>
        open full stats →
      </button>
    </div>
  );
}
