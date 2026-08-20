import { useEffect, useState } from "react";
import { useTasks } from "../context/TasksContext";
import { useSettings } from "../context/SettingsContext";
import { summarizeHistory } from "../lib/historyStats";
import { computeSessionStats } from "../lib/statsCalc";
import { computeWeeklyTrend } from "../lib/statsExtras";
import { computeSessionLoggedMinutes, resolveTaskSessions } from "../lib/taskSessions";
import { formatDuration } from "../lib/durations";
import type { TimerApi } from "../hooks/useTimer";
import type { Mode } from "../types";

interface DailySummaryProps {
  mode: Mode;
  onOpenStats: () => void;
  timer: TimerApi;
}

export function DailySummary({ mode, onOpenStats, timer }: DailySummaryProps) {
  const { history, tasks } = useTasks();
  const {
    dailyGoalWorkMinutes,
    dailyGoalPersonalMinutes,
    weeklyGoalWorkMinutes,
    weeklyGoalPersonalMinutes,
  } = useSettings();

  // a plain re-render tick, independent of anything else changing -- while a session is
  // running, useTimer's own second-by-second countdown already re-renders this (and so
  // recomputes everything below) far more often than this needs, but while paused or idle
  // nothing else guarantees a periodic refresh (e.g. "today"'s boundary rolling over past
  // midnight while genuinely idle for a while). This is the explicit guarantee.
  const [, setRefreshTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setRefreshTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const summary = summarizeHistory(history, tasks, mode);

  const activeTaskId = timer.activeTaskId;
  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) : undefined;
  const activeTaskSessions = activeTask ? resolveTaskSessions(activeTask) : null;

  // stays visible for an active task's session breakdown even on a day with nothing
  // completed yet -- otherwise the very first session of the day (todayMinutes still 0,
  // since that only counts *completed* sessions) would hide this exactly when it's most
  // relevant to see
  if (summary.todayMinutes === 0 && summary.todayBreakMinutes === 0 && !activeTaskSessions) return null;

  const stats = computeSessionStats(history, mode);
  const avgToday = summary.todayPomos ? summary.todayMinutes / summary.todayPomos : 0;
  const dailyGoalMinutes = mode === "work" ? dailyGoalWorkMinutes : dailyGoalPersonalMinutes;
  const weeklyGoalMinutes = mode === "work" ? weeklyGoalWorkMinutes : weeklyGoalPersonalMinutes;
  // weeks=1 still returns the current calendar week's bucket -- computeWeeklyTrend's loop
  // always ends at i=0 (thisWeekStart), so there's nothing to trim off with a window of 1
  const thisWeekMinutes = computeWeeklyTrend(history, mode, 1)[0]?.minutes ?? 0;

  // the currently running/paused session's progress isn't in history yet (only a
  // complete or a stop logs anything) -- without this, its % would sit frozen at
  // whatever it was when the session started, even as real time visibly elapses on the
  // countdown right above it. Paused freezes this too (getLiveSeconds returns the frozen
  // remainingSeconds while paused), which is correct -- no progress accrues on a pause.
  const liveElapsedMinutes =
    timer.status !== "idle" && timer.targetSeconds !== null
      ? Math.max(0, timer.targetSeconds - timer.getLiveSeconds()) / 60
      : 0;

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

      {activeTask && activeTaskSessions && (
        <div className="daily-summary__active-task">
          <p className="daily-summary__goal-label">{activeTask.title}</p>
          <div className="daily-summary__active-task-sessions">
            {activeTaskSessions.map((s, i) => {
              const logged = computeSessionLoggedMinutes(s, history);
              const liveExtra = s.id === timer.activeSubSessionId ? liveElapsedMinutes : 0;
              const pct = s.minutes > 0 ? Math.min(100, Math.round(((logged + liveExtra) / s.minutes) * 100)) : 0;
              const isThisRunning = timer.status === "running" && timer.activeSubSessionId === s.id;
              const tier = isThisRunning
                ? "daily-summary__session-tag--running"
                : pct >= 100
                  ? "daily-summary__session-tag--done"
                  : pct >= 50
                    ? "daily-summary__session-tag--mid"
                    : pct > 0
                      ? "daily-summary__session-tag--started"
                      : "";
              return (
                <span key={s.id} className={`daily-summary__goal-label daily-summary__session-tag ${tier}`}>
                  session {i + 1} · {s.minutes}m{isThisRunning ? " · running" : pct > 0 ? ` · ${pct}%` : ""}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
