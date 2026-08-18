import { createContext, useContext, type ReactNode } from "react";
import { newId, useLocalStorage } from "../lib/storage";
import type { Mode, PomoRecord, Task } from "../types";

interface NewTaskInput {
  title: string;
  category: string;
  estimatedPomos: number | null;
  startTime: string | null;
  endTime: string | null;
  mode: Mode;
}

interface TasksContextValue {
  tasks: Task[];
  history: PomoRecord[];
  addTask: (input: NewTaskInput) => Task;
  toggleDone: (id: string) => void;
  removeTask: (id: string) => void;
  logCompletion: (record: Omit<PomoRecord, "id">) => void;
  pomosForTask: (taskId: string) => number;
}

const TasksContext = createContext<TasksContextValue | null>(null);

export function TasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useLocalStorage<Task[]>("pomo:tasks", []);
  const [history, setHistory] = useLocalStorage<PomoRecord[]>("pomo:history", []);

  const addTask = (input: NewTaskInput): Task => {
    const task: Task = {
      id: newId(),
      title: input.title,
      category: input.category,
      estimatedPomos: input.estimatedPomos,
      startTime: input.startTime,
      endTime: input.endTime,
      mode: input.mode,
      done: false,
      createdAt: Date.now(),
    };
    setTasks((prev) => [...prev, task]);
    return task;
  };

  const toggleDone = (id: string) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const removeTask = (id: string) => setTasks((prev) => prev.filter((t) => t.id !== id));

  const logCompletion = (record: Omit<PomoRecord, "id">) =>
    setHistory((prev) => [...prev, { ...record, id: newId() }]);

  const pomosForTask = (taskId: string) =>
    history.filter((r) => r.taskId === taskId && r.phase === "focus").length;

  return (
    <TasksContext.Provider
      value={{ tasks, history, addTask, toggleDone, removeTask, logCompletion, pomosForTask }}
    >
      {children}
    </TasksContext.Provider>
  );
}

export function useTasks(): TasksContextValue {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks must be used within TasksProvider");
  return ctx;
}
