import { useState, type FormEvent } from "react";
import { useTasks } from "../context/TasksContext";
import { useSettings } from "../context/SettingsContext";
import { summarizeHistory } from "../lib/historyStats";
import { computeSessionStats } from "../lib/statsCalc";
import {
  computeStreaks,
  computeHeatmap,
  computeWeeklyTrend,
  computeWeekComparison,
  computeFocusScore,
  computeBadges,
  computeCompletionStats,
  computeEstimateAccuracy,
  focusEquivalent,
} from "../lib/statsExtras";
import { formatDuration } from "../lib/durations";
import { historyToCsv, downloadTextFile } from "../lib/exportCsv";
import { IconFlame, IconTrophy, IconDownload } from "./icons";
import type { Mode } from "../types";

interface PersonalStatsPageProps {
  mode: Mode;
  open: boolean;
  onClose: () => void;
}

const HEATMAP_DAYS = 18 * 7;
const TREND_WEEKS = 12;
const PAGE_BG = "#efeae6";
const PAGE_INK = "#211a17";
const PAGE_MUTED = "#6f645f";
const PAGE_BORDER = "#ddd3cd";

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
}

export function PersonalStatsPage({ mode, open, onClose }: PersonalStatsPageProps) {
  const { history, tasks } = useTasks();
  const { weeklyGoalWorkMinutes, weeklyGoalPersonalMinutes, setWeeklyGoalMinutes } = useSettings();
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");

  if (!open) return null;

  const stats = computeSessionStats(history, mode);
  const summary = summarizeHistory(history, tasks, mode, 30);
  const streaks = computeStreaks(history, mode);
  const heatmap = computeHeatmap(history, mode, HEATMAP_DAYS);
  const trend = computeWeeklyTrend(history, mode, TREND_WEEKS);
  const comparison = computeWeekComparison(history, mode);
  const focusScore = computeFocusScore(history, mode);
  const badges = computeBadges(history, mode);
  const completion = computeCompletionStats(history, mode);
  const estimateAccuracy = computeEstimateAccuracy(history, tasks, mode);
  const totalMinutesAllTime = history
    .filter((r) => r.mode === mode && r.phase === "focus")
    .reduce((s, r) => s + r.minutes, 0);
  const equivalent = focusEquivalent(totalMinutesAllTime);

  // the goal resets on a fixed weekly boundary (like Apple/Strava's weekly rings), not a
  // rolling window -- trend's own last bucket IS the current calendar week, since
  // computeWeeklyTrend's loop ends at i=0 (thisWeekStart)
  const thisCalendarWeekMinutes = trend[trend.length - 1]?.minutes ?? 0;
  const weeklyGoalMinutes = mode === "work" ? weeklyGoalWorkMinutes : weeklyGoalPersonalMinutes;

  const handleSaveGoal = (e: FormEvent) => {
    e.preventDefault();
    const hours = Number(goalInput);
    if (!hours || hours <= 0) return;
    setWeeklyGoalMinutes(mode, Math.round(hours * 60));
    setEditingGoal(false);
  };

  const handleClearGoal = () => {
    setWeeklyGoalMinutes(mode, null);
    setEditingGoal(false);
  };

  const handleExportCsv = () => {
    downloadTextFile(`pomo-history-${mode}.csv`, historyToCsv(history, mode), "text/csv");
  };

  const handleDownload = () => {
    const W = 720;
    const H = 860;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = PAGE_BG;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = PAGE_INK;
    ctx.font = "600 28px calibri, 'segoe ui', sans-serif";
    ctx.fillText("pomo — recap", 48, 76);
    ctx.strokeStyle = PAGE_BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(48, 100);
    ctx.lineTo(W - 48, 100);
    ctx.stroke();

    const rows: [string, string][] = [
      ["this week", formatDuration(comparison.thisWeekMinutes)],
      ["current streak", `${streaks.current} day${streaks.current === 1 ? "" : "s"}`],
      ["longest streak", `${streaks.longest} day${streaks.longest === 1 ? "" : "s"}`],
      ["total sessions", `${stats.totalSessions}`],
      ["longest session", formatDuration(stats.longestAllTime)],
      ["total focused, all time", formatDuration(totalMinutesAllTime)],
    ];
    let y = 172;
    for (const [label, value] of rows) {
      ctx.fillStyle = PAGE_MUTED;
      ctx.font = "16px calibri, 'segoe ui', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(label, 48, y);
      ctx.fillStyle = PAGE_INK;
      ctx.font = "600 24px 'consolas', 'sf mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText(value, W - 48, y);
      y += 62;
    }
    ctx.textAlign = "left";

    if (equivalent) {
      ctx.fillStyle = PAGE_MUTED;
      ctx.font = "italic 15px calibri, 'segoe ui', sans-serif";
      wrapText(ctx, equivalent, 48, y + 20, W - 96, 22);
    }

    ctx.fillStyle = PAGE_MUTED;
    ctx.font = "13px calibri, 'segoe ui', sans-serif";
    ctx.fillText("pomo.site", 48, H - 36);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pomo-recap.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  const maxTrendMinutes = Math.max(1, ...trend.map((w) => w.minutes));

  return (
    <div className="stats-overlay" role="dialog" aria-modal="true" aria-label="your stats" onClick={onClose}>
      <div className="stats-page" onClick={(e) => e.stopPropagation()}>
        <header className="stats-page__header">
          <h1 className="stats-page__title">your stats</h1>
          <div className="stats-page__header-actions">
            {stats.totalSessions > 0 && (
              <>
                <button type="button" className="chip" onClick={handleExportCsv}>
                  <IconDownload /> csv
                </button>
                <button type="button" className="chip" onClick={handleDownload}>
                  <IconDownload /> recap
                </button>
              </>
            )}
            <button type="button" className="stats-page__close" onClick={onClose} aria-label="close">
              ×
            </button>
          </div>
        </header>

        <div className="stats-page__body">
          {stats.totalSessions === 0 ? (
            <p className="task-empty">no sessions logged yet — complete a focus session to see stats here</p>
          ) : (
            <>
              <div className="stats-hero">
                <div className="stats-hero__card">
                  <span className="stats-hero__value stats-hero__value--with-icon tabular">
                    <IconFlame />
                    {streaks.current}
                  </span>
                  <span className="stats-hero__label">day streak</span>
                  <span className="stats-hero__sub">longest {streaks.longest}</span>
                </div>
                <div className="stats-hero__card">
                  <span className="stats-hero__value tabular">{focusScore}</span>
                  <span className="stats-hero__label">focus score today</span>
                  <div className="stats-hero__gauge">
                    <div className="stats-hero__gauge-fill" style={{ width: `${focusScore}%` }} />
                  </div>
                </div>
                <div className="stats-hero__card">
                  <span className="stats-hero__value tabular">{formatDuration(totalMinutesAllTime)}</span>
                  <span className="stats-hero__label">focused, all time</span>
                  {equivalent && <span className="stats-hero__sub">{equivalent}</span>}
                </div>
                <div className="stats-hero__card">
                  {editingGoal ? (
                    <form className="stats-goal-form" onSubmit={handleSaveGoal}>
                      <input
                        className="stats-goal-form__input"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        placeholder="hours"
                        autoFocus
                        value={goalInput}
                        onChange={(e) => setGoalInput(e.target.value)}
                      />
                      <div className="stats-goal-form__actions">
                        <button type="submit" className="chip">
                          save
                        </button>
                        <button type="button" className="chip" onClick={() => setEditingGoal(false)}>
                          cancel
                        </button>
                        {weeklyGoalMinutes !== null && (
                          <button type="button" className="link-btn link-btn--quiet" onClick={handleClearGoal}>
                            clear goal
                          </button>
                        )}
                      </div>
                    </form>
                  ) : weeklyGoalMinutes === null ? (
                    <>
                      <span className="stats-hero__label">weekly goal</span>
                      <button
                        type="button"
                        className="stats-teaser__cta"
                        onClick={() => {
                          setGoalInput("");
                          setEditingGoal(true);
                        }}
                      >
                        set a goal
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="stats-hero__value tabular">
                        {formatDuration(thisCalendarWeekMinutes)} / {formatDuration(weeklyGoalMinutes)}
                      </span>
                      <span className="stats-hero__label">weekly goal</span>
                      <div className="stats-hero__gauge">
                        <div
                          className="stats-hero__gauge-fill"
                          style={{ width: `${Math.min(100, (thisCalendarWeekMinutes / weeklyGoalMinutes) * 100)}%` }}
                        />
                      </div>
                      <button
                        type="button"
                        className="stats-hero__edit"
                        onClick={() => {
                          setGoalInput(String(Math.round(weeklyGoalMinutes / 60)));
                          setEditingGoal(true);
                        }}
                      >
                        edit
                      </button>
                    </>
                  )}
                </div>
              </div>

              {comparison.deltaPct !== null && (
                <div className={comparison.deltaPct >= 0 ? "stats-compare" : "stats-compare stats-compare--down"}>
                  {formatDuration(comparison.thisWeekMinutes)} this week vs {formatDuration(comparison.lastWeekMinutes)}{" "}
                  last week — {comparison.deltaPct >= 0 ? "+" : ""}
                  {comparison.deltaPct}%
                </div>
              )}

              {estimateAccuracy.avgOverrunPct !== null && (
                <div className="stats-compare">
                  based on {estimateAccuracy.tasksCompared} estimated task{estimateAccuracy.tasksCompared === 1 ? "" : "s"}
                  , you tend to{" "}
                  {estimateAccuracy.avgOverrunPct >= 0
                    ? `run ${estimateAccuracy.avgOverrunPct}% over your own estimate`
                    : `finish ${Math.abs(estimateAccuracy.avgOverrunPct)}% under your own estimate`}
                </div>
              )}

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

              <p className="history-section__label">records</p>
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
                <div className="stats-tile">
                  <span className="stats-tile__value tabular">{completion.completionRate}%</span>
                  <span className="stats-tile__label">
                    completion rate · {completion.totalCompleted}/{completion.totalStarted}
                  </span>
                </div>
              </div>

              <p className="history-section__label">last {HEATMAP_DAYS} days</p>
              <div className="stats-heatmap">
                {heatmap.map((day) => (
                  <div
                    key={day.key}
                    className="stats-heatmap__cell"
                    data-level={day.level}
                    title={`${day.date.toLocaleDateString(undefined, { month: "short", day: "numeric" }).toLowerCase()}: ${formatDuration(day.minutes)}`}
                  />
                ))}
              </div>
              <div className="stats-heatmap__legend">
                <span>less</span>
                {[0, 1, 2, 3, 4].map((lvl) => (
                  <div key={lvl} className="stats-heatmap__cell" data-level={lvl} />
                ))}
                <span>more</span>
              </div>

              <p className="history-section__label">last {TREND_WEEKS} weeks</p>
              <div className="stats-weektrend">
                {trend.map((week) => (
                  <div
                    key={week.key}
                    className="stats-trend__bar"
                    title={`week of ${week.label}: ${formatDuration(week.minutes)}`}
                  >
                    <div
                      className="stats-trend__fill"
                      style={{ height: `${Math.max(3, (week.minutes / maxTrendMinutes) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="stats-weektrend__labels">
                <span>{trend[0]?.label}</span>
                <span>{trend[trend.length - 1]?.label}</span>
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

              <p className="history-section__label">badges</p>
              <div className="badges-grid">
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className={badge.achieved ? "badge-tile badge-tile--achieved" : "badge-tile"}
                    title={badge.description}
                  >
                    <span className="badge-tile__icon">
                      <IconTrophy />
                    </span>
                    <span className="badge-tile__label">{badge.label}</span>
                    <span className="badge-tile__desc">{badge.description}</span>
                    {!badge.achieved && badge.progress && (
                      <div className="badge-tile__progress">
                        <div className="badge-tile__progress-bar">
                          <div
                            className="badge-tile__progress-fill"
                            style={{ width: `${Math.min(100, (badge.progress.current / badge.progress.target) * 100)}%` }}
                          />
                        </div>
                        <span className="badge-tile__progress-label tabular">
                          {Math.min(badge.progress.current, badge.progress.target)}/{badge.progress.target}
                        </span>
                      </div>
                    )}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
