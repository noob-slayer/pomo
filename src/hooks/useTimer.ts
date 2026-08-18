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

  // wall-clock anchors, not tick counts — setInterval gets throttled or fully suspended
  // while a tab is backgrounded or a device is asleep, so counting down by decrementing
  // once per "tick" silently stops (or drifts) across a standby period. Deriving the
  // displayed value from Date.now() vs a fixed target timestamp self-corrects the moment
  // a tick finally does fire (or the tab becomes visible again), no matter how long the
  // gap was.
  const endAtRef = useRef<number | null>(null); // ms epoch — countdown target (targetSeconds !== null)
  const startedAtRef = useRef<number | null>(null); // ms epoch — open-ended break start

  const recompute = () => {
    if (targetSeconds === null) {
      if (startedAtRef.current === null) return;
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    } else {
      if (endAtRef.current === null) return;
      setRemainingSeconds(Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000)));
    }
  };

  // while running: recompute on an interval, and immediately whenever the tab/device
  // wakes up, instead of waiting for the next tick (which could be up to a second late,
  // or — after a real sleep — arrive only once the interval resumes at all)
  useEffect(() => {
    if (status !== "running") return;
    recompute();
    const id = setInterval(recompute, 1000);
    const onWake = () => {
      if (document.visibilityState === "visible") recompute();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("pageshow", onWake);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("pageshow", onWake);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, targetSeconds]);

  // completion watcher
  useEffect(() => {
    if (status !== "running" || targetSeconds === null || remainingSeconds > 0) return;
    const minutes = lastMinutesRef.current;
    setStatus("idle");
    endAtRef.current = null;
    if (phase === "focus") {
      onFocusComplete(minutes, activeTaskId, activeTaskTitle);
      setActiveTaskId(null);
      setActiveTaskTitle(null);
    } else {
      onBreakComplete(minutes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds, status, targetSeconds, phase]);

  // updates the displayed duration while idle, without starting the countdown
  const setPendingMinutes = (minutes: number) => {
    if (status !== "idle") return;
    lastMinutesRef.current = minutes;
    setPhase("focus");
    setTargetSeconds(minutes * 60);
    setRemainingSeconds(minutes * 60);
    setElapsedSeconds(0);
  };

  const startFocus = (minutes: number, taskId: string | null = null, taskTitle: string | null = null) => {
    lastMinutesRef.current = minutes;
    setPhase("focus");
    setActiveTaskId(taskId);
    setActiveTaskTitle(taskTitle);
    setTargetSeconds(minutes * 60);
    setRemainingSeconds(minutes * 60);
    setElapsedSeconds(0);
    endAtRef.current = Date.now() + minutes * 60 * 1000;
    startedAtRef.current = null;
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
      startedAtRef.current = Date.now();
      endAtRef.current = null;
    } else {
      lastMinutesRef.current = minutes;
      setTargetSeconds(minutes * 60);
      setRemainingSeconds(minutes * 60);
      endAtRef.current = Date.now() + minutes * 60 * 1000;
      startedAtRef.current = null;
    }
    setStatus("running");
  };

  const pause = () => setStatus((s) => (s === "running" ? "paused" : s));

  // resuming re-anchors the wall-clock target/start to right now, using whatever
  // remaining/elapsed value was last displayed (frozen since pause() just stops the
  // recompute loop — the state values themselves don't drift while paused)
  const resume = () =>
    setStatus((s) => {
      if (s !== "paused") return s;
      if (targetSeconds === null) startedAtRef.current = Date.now() - elapsedSeconds * 1000;
      else endAtRef.current = Date.now() + remainingSeconds * 1000;
      return "running";
    });

  const stop = () => {
    setStatus("idle");
    setRemainingSeconds(targetSeconds ?? lastMinutesRef.current * 60);
    setElapsedSeconds(0);
    setActiveTaskId(null);
    setActiveTaskTitle(null);
    endAtRef.current = null;
    startedAtRef.current = null;
  };

  const reset = () => {
    const fullSeconds = targetSeconds ?? 0;
    setRemainingSeconds(fullSeconds);
    setElapsedSeconds(0);
    if (status === "running") {
      if (targetSeconds === null) startedAtRef.current = Date.now();
      else endAtRef.current = Date.now() + fullSeconds * 1000;
    }
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
    setPendingMinutes,
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
