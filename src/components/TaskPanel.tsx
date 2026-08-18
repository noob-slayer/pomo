import { useState, type FormEvent } from "react";
import { useTasks } from "../context/TasksContext";
import type { TimerApi } from "../hooks/useTimer";
import type { Mode } from "../types";
import { HistoryView } from "./HistoryView";
import { CATEGORY_OPTIONS } from "../lib/categories";
import {
  HOUR_OPTIONS_12,
  MINUTE_OPTIONS,
  timeLabel,
  nearestTimeParts,
  partsToValue,
  type TimeParts,
  type Period,
} from "../lib/durations";

interface TaskPanelProps {
  open: boolean;
  mode: Mode;
  timer: TimerApi;
  selectedFocusMinutes: number;
  onActivity: () => void;
}

const EMPTY_PARTS: TimeParts = { hour12: "", minute: "", period: "am" };

function TimeField({
  label,
  parts,
  onChange,
}: {
  label: string;
  parts: TimeParts;
  onChange: (parts: TimeParts) => void;
}) {
  return (
    <div className="time-field">
      <span className="time-field__label">{label}</span>
      <div className="time-field__selects">
        <select value={parts.hour12} onChange={(e) => onChange({ ...parts, hour12: e.target.value })}>
          <option value="">hh</option>
          {HOUR_OPTIONS_12.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <select value={parts.minute} onChange={(e) => onChange({ ...parts, minute: e.target.value })}>
          <option value="">mm</option>
          {MINUTE_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select value={parts.period} onChange={(e) => onChange({ ...parts, period: e.target.value as Period })}>
          <option value="am">am</option>
          <option value="pm">pm</option>
        </select>
      </div>
    </div>
  );
}

export function TaskPanel({ open, mode, timer, selectedFocusMinutes, onActivity }: TaskPanelProps) {
  const { tasks, addTask, toggleDone, removeTask, pomosForTask } = useTasks();
  const [tab, setTab] = useState<"tasks" | "history">("tasks");
  const [title, setTitle] = useState("");
  const [categoryChoice, setCategoryChoice] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [estimate, setEstimate] = useState("");
  const [startParts, setStartParts] = useState<TimeParts>(() => nearestTimeParts());
  const [endParts, setEndParts] = useState<TimeParts>(EMPTY_PARTS);

  const visibleTasks = tasks.filter((t) => t.mode === mode);

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const category =
      categoryChoice === "custom" ? customCategory.trim() || "general" : categoryChoice || "general";
    addTask({
      title: title.trim(),
      category,
      estimatedPomos: estimate ? Number(estimate) : null,
      startTime: partsToValue(startParts),
      endTime: partsToValue(endParts),
      mode,
    });
    setTitle("");
    setCategoryChoice("");
    setCustomCategory("");
    setEstimate("");
    setStartParts(nearestTimeParts());
    setEndParts(EMPTY_PARTS);
  };

  return (
    <aside
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
          onClick={() => setTab("tasks")}
        >
          tasks
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "history"}
          className={tab === "history" ? "panel-tabs__item panel-tabs__item--active" : "panel-tabs__item"}
          onClick={() => setTab("history")}
        >
          history
        </button>
      </div>

      {tab === "history" ? (
        <HistoryView mode={mode} />
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
            placeholder="est. pomos"
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
        <TimeField label="start" parts={startParts} onChange={setStartParts} />
        <TimeField label="end" parts={endParts} onChange={setEndParts} />
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
                    {task.estimatedPomos ? ` · ${task.estimatedPomos} est.` : ""}
                    {task.startTime ? ` · ${timeLabel(task.startTime)}–${timeLabel(task.endTime) || "?"}` : ""}
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
                  onClick={() => timer.startFocus(selectedFocusMinutes, task.id, task.title)}
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
