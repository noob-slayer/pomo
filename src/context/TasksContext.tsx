import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { newId, useLocalStorage } from "../lib/storage";
import { deleteTaskRow, fetchHistory, fetchTasks, insertHistory, insertTask, updateTaskDone } from "../lib/cloudSync";
import { useAuth } from "./AuthContext";
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
  const { user } = useAuth();
  const [tasks, setTasks] = useLocalStorage<Task[]>("pomo:tasks", []);
  const [history, setHistory] = useLocalStorage<PomoRecord[]>("pomo:history", []);
  const migratedForUser = useRef<string | null>(null);

  // on sign-in: pull remote tasks/history, or — if this is the very first sign-in on this
  // account and there's nothing remote yet — push whatever's local up as a one-time migration.
  useEffect(() => {
    if (!user) return;
    if (migratedForUser.current === user.id) return;
    let cancelled = false;

    (async () => {
      const [remoteTasks, remoteHistory] = await Promise.all([fetchTasks(user.id), fetchHistory(user.id)]);
      if (cancelled) return;
      migratedForUser.current = user.id;

      if (remoteTasks.length === 0 && remoteHistory.length === 0 && (tasks.length > 0 || history.length > 0)) {
        await Promise.all([
          ...tasks.map((t) => insertTask(user.id, t)),
          ...history.map((r) => insertHistory(user.id, r)),
        ]);
      } else {
        setTasks(remoteTasks);
        setHistory(remoteHistory);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
    if (user) void insertTask(user.id, task);
    return task;
  };

  const toggleDone = (id: string) => {
    const current = tasks.find((t) => t.id === id);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
    if (user && current) void updateTaskDone(user.id, id, !current.done);
  };

  const removeTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (user) void deleteTaskRow(user.id, id);
  };

  const logCompletion = (record: Omit<PomoRecord, "id">) => {
    const full: PomoRecord = { ...record, id: newId() };
    setHistory((prev) => [...prev, full]);
    if (user) void insertHistory(user.id, full);
  };

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
