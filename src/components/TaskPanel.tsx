import { useState, type FormEvent, type RefObject } from "react";
import { useTasks } from "../context/TasksContext";
import type { TimerApi } from "../hooks/useTimer";
import type { Mode } from "../types";
import type { CurrentLobby } from "../context/SettingsContext";
import { HistoryView } from "./HistoryView";
import { StatsView } from "./StatsView";
import { LobbyStatsView } from "./LobbyStatsView";
import { LobbyRejoin } from "./LobbyRejoin";
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
  currentLobby: CurrentLobby | null;
  lastLobby: CurrentLobby | null;
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
  currentLobby,
  lastLobby,
}: TaskPanelProps) {
  const { tasks, addTask, toggleDone, removeTask, pomosForTask } = useTasks();
  const [title, setTitle] = useState("");
  const [categoryChoice, setCategoryChoice] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [estimate, setEstimate] = useState("");

  const visibleTasks = tasks.filter((t) => t.mode === mode);

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const category =
      categoryChoice === "custom" ? customCategory.trim() || "general" : categoryChoice || "general";
    addTask({
      title: title.trim(),
      category,
      durationMinutes: estimate ? Number(estimate) : null,
      mode,
    });
    setTitle("");
    setCategoryChoice("");
    setCustomCategory("");
    setEstimate("");
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
        {(currentLobby || lastLobby) && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "team"}
            className={tab === "team" ? "panel-tabs__item panel-tabs__item--active" : "panel-tabs__item"}
            onClick={() => onTabChange("team")}
          >
            team
          </button>
        )}
      </div>

      {tab === "history" ? (
        <HistoryView mode={mode} />
      ) : tab === "stats" ? (
        <StatsView mode={mode} />
      ) : tab === "team" ? (
        currentLobby ? (
          <LobbyStatsView lobby={currentLobby} />
        ) : lastLobby ? (
          <LobbyRejoin lastLobby={lastLobby} />
        ) : null
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
        <button type="submit" className="btn btn--full">
          add
        </button>
      </form>

      <ul className="task-list">
        {visibleTasks.length === 0 && <li className="task-empty">nothing on the list yet</li>}
        {visibleTasks.map((task) => {
          const isActive = timer.activeTaskId === task.id && timer.status !== "idle";
          return (
            <li key={task.id} className={task.done ? "task task--done" : "task"}>
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
                    {" · "}
                    {pomosForTask(task.id)} logged
                  </p>
                </div>
              </div>
              <div className="task__actions">
                <button
                  type="button"
                  className="link-btn"
                  disabled={isActive}
                  onClick={() =>
                    timer.startFocus(task.durationMinutes ?? selectedFocusMinutes, task.id, task.title)
                  }
                >
                  {isActive ? "running" : "start pomo"}
                </button>
                <button type="button" className="link-btn link-btn--quiet" onClick={() => removeTask(task.id)}>
                  remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>
        </>
      )}
    </aside>
  );
}
