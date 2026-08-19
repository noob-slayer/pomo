import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { newId, useLocalStorage } from "../lib/storage";
import { deleteTaskRow, fetchHistory, fetchTasks, insertHistory, insertTask, updateTaskDone } from "../lib/cloudSync";
import { useAuth } from "./AuthContext";
import type { Mode, PomoRecord, Task } from "../types";

interface NewTaskInput {
  title: string;
  category: string;
  durationMinutes: number | null;
  mode: Mode;
}

interface TasksContextValue {
  tasks: Task[];
  history: PomoRecord[];
  // false while a signed-in user's cloud tasks/history fetch is still in flight (or auth
  // itself hasn't resolved yet) -- true once `history` is confirmed settled for the
  // current identity: immediately for a guest, or once the cloud fetch below resolves.
  // Consumers that derive persisted state FROM history (like Shell's badge-unlock-toast
  // effect, which seeds a "seen" localStorage set the first time it runs) need this: acting
  // on the empty pre-sync `history` and only afterward seeing the real synced history looks
  // identical to "you just earned a bunch of badges", every single fresh login.
  historyReady: boolean;
  addTask: (input: NewTaskInput) => Task;
  toggleDone: (id: string) => void;
  removeTask: (id: string) => void;
  logCompletion: (record: Omit<PomoRecord, "id">) => void;
  pomosForTask: (taskId: string) => number;
}

const TasksContext = createContext<TasksContextValue | null>(null);

export function TasksProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useLocalStorage<Task[]>("pomo:tasks", []);
  const [history, setHistory] = useLocalStorage<PomoRecord[]>("pomo:history", []);
  const migratedForUser = useRef<string | null>(null);
  const [historyReady, setHistoryReady] = useState(false);

  // on sign-in: pull remote tasks/history, or — if this is the very first sign-in on this
  // account and there's nothing remote yet — push whatever's local up as a one-time migration.
  useEffect(() => {
    if (authLoading) return; // session check still in flight -- don't decide readiness yet
    if (!user) {
      setHistoryReady(true);
      return;
    }
    if (migratedForUser.current === user.id) {
      setHistoryReady(true);
      return;
    }
    setHistoryReady(false);
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
      setHistoryReady(true);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  const addTask = (input: NewTaskInput): Task => {
    const task: Task = {
      id: newId(),
      title: input.title,
      category: input.category,
      durationMinutes: input.durationMinutes,
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
      value={{ tasks, history, historyReady, addTask, toggleDone, removeTask, logCompletion, pomosForTask }}
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
