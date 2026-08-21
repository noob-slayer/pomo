import { useEffect, useRef, useState } from "react";
import type { Phase, Status } from "../types";
import {
  clearPersistedSession,
  readPersistedSession,
  writePersistedSession,
  type PersistedSession,
} from "../lib/sessionPersistence";

interface UseTimerOptions {
  onFocusComplete: (minutes: number, taskId: string | null, taskTitle: string | null, subSessionId: string | null) => void;
  onBreakComplete: (minutes: number) => void;
  // fires when a session ends *without* completing naturally -- a manual stop, mid-way.
  // logging this (instead of silently discarding the elapsed time) is what makes an
  // abandoned session still show up in history.
  onPartialStop: (
    phase: Phase,
    minutes: number,
    taskId: string | null,
    taskTitle: string | null,
    subSessionId: string | null,
  ) => void;
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
  const [activeSubSessionId, setActiveSubSessionId] = useState<string | null>(restored?.activeSubSessionId ?? null);
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

  // same wall-clock math as recompute(), but returns the value straight from Date.now()
  // instead of going through React state -- for callers (like the background-tab display)
  // that need the truly current number even when this component's own render/interval
  // loop is being throttled by the browser, not whatever was last committed to state.
  const getLiveSeconds = (): number => {
    // endAtRef/startedAtRef aren't cleared on pause (only stop/reset/completion do that),
    // so while paused they still point at the anchor from before the pause -- deriving
    // from them here would count time that isn't actually elapsing. remainingSeconds and
    // elapsedSeconds are already correctly frozen at pause (recompute()'s own interval is
    // torn down the moment status leaves "running"), so use those directly instead.
    if (status !== "running") {
      return targetSeconds === null ? elapsedSeconds : remainingSeconds;
    }
    if (targetSeconds === null) {
      return startedAtRef.current === null ? elapsedSeconds : Math.floor((Date.now() - startedAtRef.current) / 1000);
    }
    return endAtRef.current === null
      ? remainingSeconds
      : Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000));
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

  // a refresh or close is a *known* interruption, unlike a background tab merely getting
  // throttled -- for those we still want the wall-clock catch-up above (a brief standby
  // shouldn't derail a legitimately still-running session). But if the page is actually
  // going away, snapshotting the CURRENT elapsed/remaining as "paused" (rather than
  // leaving endAt/startedAt pointing at a running countdown) means recovery on the next
  // load shows exactly the time that had really elapsed up to this moment -- not wall-
  // clock time extrapolated through however long the tab happened to stay closed, and not
  // an assumed "it must have completed" the way a still-"running" restore would read once
  // its endAt is in the past. beforeunload also drives the "are you sure?" confirmation;
  // pagehide is a pure best-effort backup snapshot for cases where beforeunload doesn't
  // fire reliably (backgrounding on mobile Safari, some bfcache navigations).
  useEffect(() => {
    if (status === "idle") return;
    const snapshotAsPaused = () => {
      const freshRemaining =
        status === "running" && targetSeconds !== null && endAtRef.current !== null
          ? Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000))
          : remainingSeconds;
      const freshElapsed =
        status === "running" && targetSeconds === null && startedAtRef.current !== null
          ? Math.floor((Date.now() - startedAtRef.current) / 1000)
          : elapsedSeconds;
      writePersistedSession({
        phase,
        status: "paused",
        targetSeconds,
        endAt: null,
        startedAt: null,
        remainingSeconds: freshRemaining,
        elapsedSeconds: freshElapsed,
        activeTaskId,
        activeTaskTitle,
        activeSubSessionId,
        lastMinutes: lastMinutesRef.current,
      });
    };
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      snapshotAsPaused();
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", snapshotAsPaused);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", snapshotAsPaused);
    };
  }, [status, phase, targetSeconds, remainingSeconds, elapsedSeconds, activeTaskId, activeTaskTitle, activeSubSessionId]);

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
      onFocusComplete(minutes, activeTaskId, activeTaskTitle, activeSubSessionId);
      setActiveTaskId(null);
      setActiveTaskTitle(null);
      setActiveSubSessionId(null);
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

  // same idea as setPendingMinutes, but also associates a task/session -- for picking a
  // session from a multi-session task without auto-starting it: the duration and task
  // show as "queued up", and the user still has to press start themselves via
  // togglePrimary/startFocus (which, called with no task args, picks up exactly what was
  // set here -- see startFocus's own comment on the undefined-vs-null distinction)
  const setPendingSelection = (
    minutes: number,
    taskId: string | null,
    taskTitle: string | null,
    subSessionId: string | null,
  ) => {
    if (status !== "idle") return;
    lastMinutesRef.current = minutes;
    setPhase("focus");
    setTargetSeconds(minutes * 60);
    setRemainingSeconds(minutes * 60);
    setElapsedSeconds(0);
    setActiveTaskId(taskId);
    setActiveTaskTitle(taskTitle);
    setActiveSubSessionId(subSessionId);
  };

  // taskId/taskTitle/subSessionId are deliberately `| undefined` with no default, distinct
  // from an explicit `null` -- omitting them (e.g. togglePrimary's idle branch, which
  // starts "whatever's currently pending" rather than a specific task) preserves whatever
  // setPendingSelection already set, instead of stomping it back to no-task. Passing
  // `null` explicitly still clears it, same as always.
  const startFocus = (
    minutes: number,
    taskId?: string | null,
    taskTitle?: string | null,
    subSessionId?: string | null,
  ) => {
    const resolvedTaskId = taskId !== undefined ? taskId : activeTaskId;
    const resolvedTaskTitle = taskTitle !== undefined ? taskTitle : activeTaskTitle;
    const resolvedSubSessionId = subSessionId !== undefined ? subSessionId : activeSubSessionId;
    lastMinutesRef.current = minutes;
    setPhase("focus");
    setActiveTaskId(resolvedTaskId);
    setActiveTaskTitle(resolvedTaskTitle);
    setActiveSubSessionId(resolvedSubSessionId);
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
      activeTaskId: resolvedTaskId,
      activeTaskTitle: resolvedTaskTitle,
      activeSubSessionId: resolvedSubSessionId,
      lastMinutes: minutes,
    });
  };

  const startBreak = (minutes: number | null) => {
    setPhase("break");
    setActiveTaskId(null);
    setActiveTaskTitle(null);
    setActiveSubSessionId(null);
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
        activeSubSessionId: null,
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
        activeSubSessionId: null,
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
      activeSubSessionId,
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
      activeSubSessionId,
      lastMinutes: lastMinutesRef.current,
    });
    setStatus("running");
  };

  const stop = () => {
    if (status !== "idle") {
      const elapsedAtStop = targetSeconds === null ? elapsedSeconds : Math.max(0, targetSeconds - remainingSeconds);
      const minutes = Math.round(elapsedAtStop / 60);
      if (minutes > 0) onPartialStop(phase, minutes, activeTaskId, activeTaskTitle, activeSubSessionId);
    }
    clearPersistedSession();
    setStatus("idle");
    setRemainingSeconds(targetSeconds ?? lastMinutesRef.current * 60);
    setElapsedSeconds(0);
    setActiveTaskId(null);
    setActiveTaskTitle(null);
    setActiveSubSessionId(null);
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
        activeSubSessionId,
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
        activeSubSessionId,
        lastMinutes: lastMinutesRef.current,
      });
    }
  };

  // starting from idle prefers whatever targetSeconds is already showing over the passed
  // fallbackMinutes -- setPendingMinutes (duration presets) and setPendingSelection (task
  // sessions, including a resumed session's remaining time) both already set targetSeconds
  // to exactly what should start, and both also set phase to "focus" when they do. Gating
  // on phase === "focus" here matters because a just-finished break leaves phase as "break"
  // with its own (usually shorter) targetSeconds still sitting in state -- without the gate,
  // starting the next focus session would silently reuse the break's duration instead of
  // fallbackMinutes (the currently-selected focus preset).
  const togglePrimary = (fallbackMinutes: number) => {
    if (status === "running") pause();
    else if (status === "paused") resume();
    else startFocus(phase === "focus" && targetSeconds !== null ? targetSeconds / 60 : fallbackMinutes);
  };

  // adopts an externally-computed state wholesale, instead of acting relative to "right
  // now" the way startFocus/pause/resume do -- for lobby sync catching this client up to
  // the lobby's actual current state (on join, or on reload), where the caller has already
  // done its own elapsed-time math against a server snapshot and just needs every field set
  // directly, without this hook's own action methods re-deriving (and conflicting with) it
  const restoreSnapshot = (snapshot: {
    phase: Phase;
    status: Status;
    targetSeconds: number | null;
    remainingSeconds: number;
    elapsedSeconds: number;
    activeTaskId: string | null;
    activeTaskTitle: string | null;
  }) => {
    const { phase: p, status: s, targetSeconds: ts, remainingSeconds: rs, elapsedSeconds: es, activeTaskId: tid, activeTaskTitle: ttl } = snapshot;
    setPhase(p);
    setStatus(s);
    setTargetSeconds(ts);
    setRemainingSeconds(rs);
    setElapsedSeconds(es);
    setActiveTaskId(tid);
    setActiveTaskTitle(ttl);
    // lobby sync never carries sub-session info -- see SyncAction's own comment: only the
    // clock stays in lockstep, each member picks their own task (and, now, sub-session)
    setActiveSubSessionId(null);
    if (ts !== null && ts > 0) lastMinutesRef.current = Math.round(ts / 60);

    let endAt: number | null = null;
    let startedAt: number | null = null;
    if (s === "running") {
      if (ts === null) startedAt = Date.now() - es * 1000;
      else endAt = Date.now() + rs * 1000;
    }
    endAtRef.current = endAt;
    startedAtRef.current = startedAt;

    if (s === "idle") {
      clearPersistedSession();
    } else {
      writePersistedSession({
        phase: p,
        status: s,
        targetSeconds: ts,
        endAt,
        startedAt,
        remainingSeconds: rs,
        elapsedSeconds: es,
        activeTaskId: tid,
        activeTaskTitle: ttl,
        activeSubSessionId: null,
        lastMinutes: lastMinutesRef.current,
      });
    }
  };

  return {
    phase,
    status,
    targetSeconds,
    remainingSeconds,
    elapsedSeconds,
    activeTaskId,
    activeTaskTitle,
    activeSubSessionId,
    setPendingMinutes,
    setPendingSelection,
    startFocus,
    startBreak,
    pause,
    resume,
    stop,
    reset,
    togglePrimary,
    getLiveSeconds,
    restoreSnapshot,
  };
}

export type TimerApi = ReturnType<typeof useTimer>;
