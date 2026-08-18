import { useEffect, useRef, useState } from "react";
import type { Phase, Status } from "../types";

interface UseTimerOptions {
  onFocusComplete: (minutes: number, taskId: string | null, taskTitle: string | null) => void;
  onBreakComplete: (minutes: number) => void;
}

export function useTimer({ onFocusComplete, onBreakComplete }: UseTimerOptions) {
  const [phase, setPhase] = useState<Phase>("focus");
  const [status, setStatus] = useState<Status>("idle");
  const [targetSeconds, setTargetSeconds] = useState<number | null>(25 * 60);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeTaskTitle, setActiveTaskTitle] = useState<string | null>(null);
  const lastMinutesRef = useRef(25);

  // ticking
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => {
      if (targetSeconds === null) {
        setElapsedSeconds((s) => s + 1);
      } else {
        setRemainingSeconds((s) => Math.max(0, s - 1));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [status, targetSeconds]);

  // completion watcher
  useEffect(() => {
    if (status !== "running" || targetSeconds === null || remainingSeconds > 0) return;
    const minutes = lastMinutesRef.current;
    setStatus("idle");
    if (phase === "focus") {
      onFocusComplete(minutes, activeTaskId, activeTaskTitle);
      setActiveTaskId(null);
      setActiveTaskTitle(null);
    } else {
      onBreakComplete(minutes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds, status, targetSeconds, phase]);

  const startFocus = (minutes: number, taskId: string | null = null, taskTitle: string | null = null) => {
    lastMinutesRef.current = minutes;
    setPhase("focus");
    setActiveTaskId(taskId);
    setActiveTaskTitle(taskTitle);
    setTargetSeconds(minutes * 60);
    setRemainingSeconds(minutes * 60);
    setElapsedSeconds(0);
    setStatus("running");
  };

  const startBreak = (minutes: number | null) => {
    setPhase("break");
    setActiveTaskId(null);
    setActiveTaskTitle(null);
    if (minutes === null) {
      lastMinutesRef.current = 0;
      setTargetSeconds(null);
      setElapsedSeconds(0);
    } else {
      lastMinutesRef.current = minutes;
      setTargetSeconds(minutes * 60);
      setRemainingSeconds(minutes * 60);
    }
    setStatus("running");
  };

  const pause = () => setStatus((s) => (s === "running" ? "paused" : s));
  const resume = () => setStatus((s) => (s === "paused" ? "running" : s));

  const stop = () => {
    setStatus("idle");
    setRemainingSeconds(targetSeconds ?? lastMinutesRef.current * 60);
    setElapsedSeconds(0);
    setActiveTaskId(null);
    setActiveTaskTitle(null);
  };

  const reset = () => {
    setRemainingSeconds(targetSeconds ?? lastMinutesRef.current * 60);
    setElapsedSeconds(0);
  };

  const togglePrimary = (fallbackMinutes: number) => {
    if (status === "running") pause();
    else if (status === "paused") resume();
    else startFocus(fallbackMinutes);
  };

  return {
    phase,
    status,
    targetSeconds,
    remainingSeconds,
    elapsedSeconds,
    activeTaskId,
    activeTaskTitle,
    startFocus,
    startBreak,
    pause,
    resume,
    stop,
    reset,
    togglePrimary,
  };
}

export type TimerApi = ReturnType<typeof useTimer>;
