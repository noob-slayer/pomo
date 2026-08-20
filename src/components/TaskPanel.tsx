import { useState, type FormEvent, type RefObject } from "react";
import { useTasks } from "../context/TasksContext";
import type { TimerApi } from "../hooks/useTimer";
import type { Mode, TaskSplitMode, TaskSubSession } from "../types";
import { newId } from "../lib/storage";
import {
  AUTO_SPLIT_THRESHOLD_MINUTES,
  computeAutoSessionMinutes,
  computeSessionCompletionPct,
  computeSessionRemainingMinutes,
  resolveTaskSessions,
} from "../lib/taskSessions";
import { HistoryView } from "./HistoryView";
import { StatsView } from "./StatsView";
import { LobbyHistoryView } from "./LobbyHistoryView";
import { CATEGORY_OPTIONS } from "../lib/categories";

export type PanelTab = "tasks" | "history" | "stats" | "team";

interface TaskPanelProps {
  open: boolean;
  mode: Mode;
  timer: TimerApi;
  selectedFocusMinutes: number;
  onActivity: () => void;
  panelRef: RefObject<HTMLElement | null>;
  tab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  onOpenFullStats: () => void;
  onOpenFullTeamStats: () => void;
}

export function TaskPanel({
  open,
  mode,
  timer,
  selectedFocusMinutes,
  onActivity,
  panelRef,
  tab,
  onTabChange,
  onOpenFullStats,
  onOpenFullTeamStats,
}: TaskPanelProps) {
  const { tasks, history, addTask, toggleDone, removeTask, pomosForTask } = useTasks();
  const [title, setTitle] = useState("");
  const [categoryChoice, setCategoryChoice] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [estimate, setEstimate] = useState("");
  const [splitMode, setSplitMode] = useState<TaskSplitMode>("auto");
  const [customSessions, setCustomSessions] = useState<TaskSubSession[]>([]);
  const [customSessionInput, setCustomSessionInput] = useState("");
  const [customSessionError, setCustomSessionError] = useState<string | null>(null);

  const visibleTasks = tasks.filter((t) => t.mode === mode);

  const estimateMinutes = estimate ? Number(estimate) : null;
  // the auto/custom choice only ever matters above the split threshold -- at or under it,
  // every mode behaves identically (a single session at the full duration), so the form
  // stays out of the way until it's actually relevant
  const showSplitOptions = estimateMinutes !== null && estimateMinutes > AUTO_SPLIT_THRESHOLD_MINUTES;
  const customSessionsTotal = customSessions.reduce((sum, s) => sum + s.minutes, 0);

  const addCustomSession = () => {
    const mins = Number(customSessionInput);
    if (!mins || mins <= 0) return;
    // block over-allocation against the task's own stated duration -- under-allocating is
    // still fine (falls short of the full task time, nothing wrong with that), but sessions
    // summing to more than the task itself said it would take was previously unchecked
    if (estimateMinutes !== null && customSessionsTotal + mins > estimateMinutes) {
      setCustomSessionError(
        `that would total ${customSessionsTotal + mins}m, over the task's ${estimateMinutes}m`,
      );
      return;
    }
    setCustomSessionError(null);
    setCustomSessions((prev) => [...prev, { id: newId(), minutes: mins }]);
    setCustomSessionInput("");
  };
  const removeCustomSession = (id: string) => {
    setCustomSessionError(null);
    setCustomSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const category =
      categoryChoice === "custom" ? customCategory.trim() || "general" : categoryChoice || "general";
    const durationMinutes = estimateMinutes;
    const useSplit = durationMinutes !== null && durationMinutes > AUTO_SPLIT_THRESHOLD_MINUTES;
    addTask({
      title: title.trim(),
      category,
      durationMinutes,
      mode,
      splitMode: useSplit ? splitMode : undefined,
      subSessions: useSplit && splitMode === "custom" ? customSessions : undefined,
    });
    setTitle("");
    setCategoryChoice("");
    setCustomCategory("");
    setEstimate("");
    setSplitMode("auto");
    setCustomSessions([]);
    setCustomSessionInput("");
    setCustomSessionError(null);
  };

  return (
    <aside
      ref={panelRef}
      className={open ? "task-panel task-panel--open" : "task-panel"}
      onClick={onActivity}
      onInput={onActivity}
    >
      <div className="panel-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "tasks"}
          className={tab === "tasks" ? "panel-tabs__item panel-tabs__item--active" : "panel-tabs__item"}
          onClick={() => onTabChange("tasks")}
        >
          tasks
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "history"}
          className={tab === "history" ? "panel-tabs__item panel-tabs__item--active" : "panel-tabs__item"}
          onClick={() => onTabChange("history")}
        >
          history
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "stats"}
          className={tab === "stats" ? "panel-tabs__item panel-tabs__item--active" : "panel-tabs__item"}
          onClick={() => onTabChange("stats")}
        >
          stats
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "team"}
          className={tab === "team" ? "panel-tabs__item panel-tabs__item--active" : "panel-tabs__item"}
          onClick={() => onTabChange("team")}
        >
          team
        </button>
      </div>

      {tab === "history" ? (
        <HistoryView mode={mode} />
      ) : tab === "stats" ? (
        <StatsView mode={mode} onOpenFull={onOpenFullStats} />
      ) : tab === "team" ? (
        <LobbyHistoryView onOpenFull={onOpenFullTeamStats} />
      ) : (
        <>
      <form className="task-form" onSubmit={handleAdd}>
        <input
          className="task-form__title"
          placeholder="add a task"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="task-form__row">
          <select value={categoryChoice} onChange={(e) => setCategoryChoice(e.target.value)}>
            <option value="">category</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="custom">custom</option>
          </select>
          <input
            type="number"
            min={1}
            placeholder="duration (mins)"
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
          />
        </div>
        {categoryChoice === "custom" && (
          <input
            placeholder="custom category"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
          />
        )}

        {showSplitOptions && (
          <div className="task-form__split">
            <div className="task-form__mode-toggle">
              <button
                type="button"
                className={splitMode === "auto" ? "task-form__mode-btn task-form__mode-btn--active" : "task-form__mode-btn"}
                onClick={() => setSplitMode("auto")}
              >
                auto
              </button>
              <button
                type="button"
                className={splitMode === "custom" ? "task-form__mode-btn task-form__mode-btn--active" : "task-form__mode-btn"}
                onClick={() => setSplitMode("custom")}
              >
                custom
              </button>
            </div>

            {splitMode === "auto" ? (
              <p className="task-form__split-preview">
                over {AUTO_SPLIT_THRESHOLD_MINUTES}m splits into{" "}
                {computeAutoSessionMinutes(estimateMinutes as number)
                  .map((m) => `${m}m`)
                  .join(" + ")}
              </p>
            ) : (
              <div className="task-form__subsessions">
                {customSessions.length > 0 && (
                  <>
                    <ul className="task-form__subsession-list">
                      {customSessions.map((s, i) => (
                        <li key={s.id} className="task-form__subsession-row">
                          <span>
                            session {i + 1} · {s.minutes}m
                          </span>
                          <button type="button" className="link-btn link-btn--quiet" onClick={() => removeCustomSession(s.id)}>
                            remove
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="task-form__split-preview">
                      {customSessionsTotal}m / {estimateMinutes}m allocated
                    </p>
                  </>
                )}
                <div className="task-form__row">
                  <input
                    type="number"
                    min={1}
                    placeholder="session minutes"
                    value={customSessionInput}
                    onChange={(e) => {
                      setCustomSessionInput(e.target.value);
                      setCustomSessionError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomSession();
                      }
                    }}
                  />
                  <button type="button" className="task-form__mode-btn" onClick={addCustomSession}>
                    add session
                  </button>
                </div>
                {customSessionError && <p className="task-form__split-error">{customSessionError}</p>}
                {customSessions.length === 0 && !customSessionError && (
                  <p className="task-form__split-preview">no sessions added yet — task time will be timer time</p>
                )}
              </div>
            )}
          </div>
        )}

        <button type="submit" className="btn btn--full">
          add
        </button>
      </form>

      <ul className="task-list">
        {visibleTasks.length === 0 && <li className="task-empty">nothing on the list yet</li>}
        {/* a session running or paused on ANY task locks every start/session button across
            EVERY task, not just the active one's -- there's only one timer, and startFocus
            has no idle-guard of its own, so leaving another task's button clickable would
            silently hijack whatever's already running mid-session with no stop logged */}
        {visibleTasks.map((task) => {
          const isActive = timer.activeTaskId === task.id && timer.status !== "idle";
          const timerBusy = timer.status !== "idle";
          const sessions = resolveTaskSessions(task);
          const hasMultipleSessions = sessions !== null && sessions.length > 1;

          const handleSingleStart = () => {
            if (sessions === null) {
              timer.startFocus(selectedFocusMinutes, task.id, task.title);
            } else {
              timer.startFocus(sessions[0].minutes, task.id, task.title, sessions[0].id);
            }
          };

          return (
            <li key={task.id} className={task.done ? "task task--done" : "task"}>
              <div className="task__row">
                <div className="task__main">
                  <button
                    type="button"
                    className="task__check"
                    aria-label={task.done ? "mark not done" : "mark done"}
                    onClick={() => toggleDone(task.id)}
                  >
                    {task.done ? "×" : "○"}
                  </button>
                  <div className="task__body">
                    <p className="task__title">{task.title}</p>
                    <p className="task__meta">
                      {task.category}
                      {task.durationMinutes ? ` · ${task.durationMinutes}m` : ""}
                      {hasMultipleSessions ? ` · ${sessions.length} sessions` : ""}
                      {" · "}
                      {pomosForTask(task.id)} logged
                    </p>
                  </div>
                </div>
                <div className="task__actions">
                  {!hasMultipleSessions && (
                    <button type="button" className="link-btn" disabled={timerBusy} onClick={handleSingleStart}>
                      {isActive ? "running" : "start pomo"}
                    </button>
                  )}
                  <button type="button" className="link-btn link-btn--quiet" onClick={() => removeTask(task.id)}>
                    remove
                  </button>
                </div>
              </div>
              {hasMultipleSessions && sessions && (
                <div className="task__sessions">
                  {sessions.map((s, i) => {
                    const isThisRunning = isActive && timer.activeSubSessionId === s.id;
                    // selected via a click below, but the user hasn't pressed start yet --
                    // picking a session only queues it up, it never auto-starts
                    const isThisPending =
                      !isActive && timer.status === "idle" && timer.activeTaskId === task.id && timer.activeSubSessionId === s.id;
                    const pct = computeSessionCompletionPct(s, history);
                    const tierClass = isThisRunning
                      ? "task__session-btn task__session-btn--running"
                      : isThisPending
                        ? "task__session-btn task__session-btn--pending"
                        : pct >= 100
                          ? "task__session-btn task__session-btn--done"
                          : pct >= 50
                            ? "task__session-btn task__session-btn--mid"
                            : pct > 0
                              ? "task__session-btn task__session-btn--started"
                              : "task__session-btn";
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={tierClass}
                        disabled={timerBusy}
                        onClick={() =>
                          timer.setPendingSelection(computeSessionRemainingMinutes(s, history), task.id, task.title, s.id)
                        }
                      >
                        session {i + 1} · {s.minutes}m
                        {isThisRunning ? " · running" : isThisPending ? " · press start" : pct > 0 ? ` · ${pct}%` : ""}
                      </button>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
        </>
      )}
    </aside>
  );
}
