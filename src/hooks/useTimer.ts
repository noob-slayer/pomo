import { useEffect, useRef, useState } from "react";
import type { Phase, Status } from "../types";
import {
  clearPersistedSession,
  readPersistedSession,
  writePersistedSession,
  type PersistedSession,
} from "../lib/sessionPersistence";

interface UseTimerOptions {
  onFocusComplete: (minutes: number, taskId: string | null, taskTitle: string | null) => void;
  onBreakComplete: (minutes: number) => void;
  // fires when a session ends *without* completing naturally -- a manual stop, mid-way.
  // logging this (instead of silently discarding the elapsed time) is what makes an
  // abandoned session still show up in history.
  onPartialStop: (phase: Phase, minutes: number, taskId: string | null, taskTitle: string | null) => void;
}

// read once per mount, not per useState initializer -- several of the lazy initial
// states below need the same snapshot
function useRestoredSession(): PersistedSession | null {
  const ref = useRef<PersistedSession | null | undefined>(undefined);
  if (ref.current === undefined) ref.current = readPersistedSession();
  return ref.current;
}

export function useTimer({ onFocusComplete, onBreakComplete, onPartialStop }: UseTimerOptions) {
  const restored = useRestoredSession();

  const [phase, setPhase] = useState<Phase>(restored?.phase ?? "focus");
  const [status, setStatus] = useState<Status>(restored?.status ?? "idle");
  const [targetSeconds, setTargetSeconds] = useState<number | null>(restored ? restored.targetSeconds : 25 * 60);
  const [remainingSeconds, setRemainingSeconds] = useState(restored ? restored.remainingSeconds : 25 * 60);
  const [elapsedSeconds, setElapsedSeconds] = useState(restored ? restored.elapsedSeconds : 0);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(restored?.activeTaskId ?? null);
  const [activeTaskTitle, setActiveTaskTitle] = useState<string | null>(restored?.activeTaskTitle ?? null);
  const lastMinutesRef = useRef(restored?.lastMinutes ?? 25);

  // wall-clock anchors, not tick counts — setInterval gets throttled or fully suspended
  // while a tab is backgrounded or a device is asleep, so counting down by decrementing
  // once per "tick" silently stops (or drifts) across a standby period. Deriving the
  // displayed value from Date.now() vs a fixed target timestamp self-corrects the moment
  // a tick finally does fire (or the tab becomes visible again), no matter how long the
  // gap was. The same anchors are what let a *closed* tab's session recover correctly:
  // restoring endAt/startedAt from the last persisted snapshot and letting recompute()
  // run once on mount naturally detects whether the session already finished while the
  // app was away, or is still legitimately mid-flight.
  const endAtRef = useRef<number | null>(
    restored?.status === "running" && restored.targetSeconds !== null ? restored.endAt : null,
  );
  const startedAtRef = useRef<number | null>(
    restored?.status === "running" && restored.targetSeconds === null ? restored.startedAt : null,
  );

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

  // completion watcher — also the path a restored "running" session takes if its endAt
  // has already passed by the time the app is reopened (recompute() above will have just
  // set remainingSeconds to 0), logging it exactly as if it had completed while open
  useEffect(() => {
    if (status !== "running" || targetSeconds === null || remainingSeconds > 0) return;
    const minutes = lastMinutesRef.current;
    setStatus("idle");
    endAtRef.current = null;
    clearPersistedSession();
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
    const endAt = Date.now() + minutes * 60 * 1000;
    endAtRef.current = endAt;
    startedAtRef.current = null;
    setStatus("running");
    writePersistedSession({
      phase: "focus",
      status: "running",
      targetSeconds: minutes * 60,
      endAt,
      startedAt: null,
      remainingSeconds: minutes * 60,
      elapsedSeconds: 0,
      activeTaskId: taskId,
      activeTaskTitle: taskTitle,
      lastMinutes: minutes,
    });
  };

  const startBreak = (minutes: number | null) => {
    setPhase("break");
    setActiveTaskId(null);
    setActiveTaskTitle(null);
    if (minutes === null) {
      lastMinutesRef.current = 0;
      setTargetSeconds(null);
      setElapsedSeconds(0);
      const startedAt = Date.now();
      startedAtRef.current = startedAt;
      endAtRef.current = null;
      setStatus("running");
      writePersistedSession({
        phase: "break",
        status: "running",
        targetSeconds: null,
        endAt: null,
        startedAt,
        remainingSeconds: 0,
        elapsedSeconds: 0,
        activeTaskId: null,
        activeTaskTitle: null,
        lastMinutes: 0,
      });
    } else {
      lastMinutesRef.current = minutes;
      setTargetSeconds(minutes * 60);
      setRemainingSeconds(minutes * 60);
      const endAt = Date.now() + minutes * 60 * 1000;
      endAtRef.current = endAt;
      startedAtRef.current = null;
      setStatus("running");
      writePersistedSession({
        phase: "break",
        status: "running",
        targetSeconds: minutes * 60,
        endAt,
        startedAt: null,
        remainingSeconds: minutes * 60,
        elapsedSeconds: 0,
        activeTaskId: null,
        activeTaskTitle: null,
        lastMinutes: minutes,
      });
    }
  };

  const pause = () => {
    if (status !== "running") return;
    writePersistedSession({
      phase,
      status: "paused",
      targetSeconds,
      endAt: null,
      startedAt: null,
      remainingSeconds,
      elapsedSeconds,
      activeTaskId,
      activeTaskTitle,
      lastMinutes: lastMinutesRef.current,
    });
    setStatus("paused");
  };

  // resuming re-anchors the wall-clock target/start to right now, using whatever
  // remaining/elapsed value was last displayed (frozen since pause() just stops the
  // recompute loop — the state values themselves don't drift while paused)
  const resume = () => {
    if (status !== "paused") return;
    let endAt: number | null = null;
    let startedAt: number | null = null;
    if (targetSeconds === null) {
      startedAt = Date.now() - elapsedSeconds * 1000;
      startedAtRef.current = startedAt;
    } else {
      endAt = Date.now() + remainingSeconds * 1000;
      endAtRef.current = endAt;
    }
    writePersistedSession({
      phase,
      status: "running",
      targetSeconds,
      endAt,
      startedAt,
      remainingSeconds,
      elapsedSeconds,
      activeTaskId,
      activeTaskTitle,
      lastMinutes: lastMinutesRef.current,
    });
    setStatus("running");
  };

  const stop = () => {
    if (status !== "idle") {
      const elapsedAtStop = targetSeconds === null ? elapsedSeconds : Math.max(0, targetSeconds - remainingSeconds);
      const minutes = Math.round(elapsedAtStop / 60);
      if (minutes > 0) onPartialStop(phase, minutes, activeTaskId, activeTaskTitle);
    }
    clearPersistedSession();
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
      let endAt: number | null = null;
      let startedAt: number | null = null;
      if (targetSeconds === null) {
        startedAt = Date.now();
        startedAtRef.current = startedAt;
      } else {
        endAt = Date.now() + fullSeconds * 1000;
        endAtRef.current = endAt;
      }
      writePersistedSession({
        phase,
        status: "running",
        targetSeconds,
        endAt,
        startedAt,
        remainingSeconds: fullSeconds,
        elapsedSeconds: 0,
        activeTaskId,
        activeTaskTitle,
        lastMinutes: lastMinutesRef.current,
      });
    } else if (status === "paused") {
      writePersistedSession({
        phase,
        status: "paused",
        targetSeconds,
        endAt: null,
        startedAt: null,
        remainingSeconds: fullSeconds,
        elapsedSeconds: 0,
        activeTaskId,
        activeTaskTitle,
        lastMinutes: lastMinutesRef.current,
      });
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
