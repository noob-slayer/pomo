import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useSettings } from "../context/SettingsContext";
import { useTasks } from "../context/TasksContext";
import { useTimer } from "../hooks/useTimer";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { PERSONAL_THEME, resolveWorkTheme } from "../lib/themes";
import { DEFAULT_FOCUS_MIN } from "../lib/durations";
import { parseShareFromLocation, clearShareFromLocation } from "../lib/share";
import { generateRoomCode, hostRoom, broadcastTick } from "../lib/liveSession";
import { resolveStation } from "../lib/stations";
import { TopBar } from "./TopBar";
import { TimerStage } from "./TimerStage";
import { TaskPanel } from "./TaskPanel";
import { YoutubeWidget } from "./YoutubeWidget";
import { Credit } from "./Credit";

export function Shell() {
  const {
    mode,
    workTheme,
    personalTheme,
    personalColorTheme,
    personalBg,
    activeStationId,
    customStation,
    setMode,
    setWorkTheme,
  } = useSettings();
  const { logCompletion } = useTasks();
  const [tasksOpen, setTasksOpen] = useState(true);
  const [selectedFocusMinutes, setSelectedFocusMinutes] = useState(DEFAULT_FOCUS_MIN);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [hostReady, setHostReady] = useState(false);
  const hostChannelRef = useRef<RealtimeChannel | null>(null);
  const taskAutoHideRef = useRef<number | null>(null);
  const taskPanelRef = useRef<HTMLElement | null>(null);

  const timer = useTimer({
    onFocusComplete: (minutes, taskId, taskTitle) => {
      logCompletion({ taskId, taskTitle, mode, phase: "focus", minutes, completedAt: Date.now() });
    },
    onBreakComplete: (minutes) => {
      logCompletion({ taskId: null, taskTitle: null, mode, phase: "break", minutes, completedAt: Date.now() });
    },
  });

  useKeyboardShortcuts({
    onToggle: () => timer.togglePrimary(selectedFocusMinutes),
    onReset: () => timer.reset(),
    onStop: () => timer.stop(),
  });

  // pick up a shared session link (?s=...), apply it once, then clean the url
  useEffect(() => {
    const shared = parseShareFromLocation();
    if (!shared) return;
    setMode(shared.m);
    if (shared.m === "work" && shared.wt) setWorkTheme(shared.wt);
    setSelectedFocusMinutes(shared.fm);
    clearShareFromLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startHosting = (): string => {
    if (roomCode) return roomCode;
    const code = generateRoomCode();
    hostChannelRef.current = hostRoom(code, setHostReady);
    setRoomCode(code);
    return code;
  };

  const stopHosting = () => {
    hostChannelRef.current?.unsubscribe();
    hostChannelRef.current = null;
    setHostReady(false);
    setRoomCode(null);
  };

  useEffect(() => () => void hostChannelRef.current?.unsubscribe(), []);

  // task panel auto-hides 5s after opening; resets on any interaction inside it
  const resetTaskAutoHide = () => {
    if (taskAutoHideRef.current) window.clearTimeout(taskAutoHideRef.current);
    taskAutoHideRef.current = window.setTimeout(() => setTasksOpen(false), 5000);
  };

  useEffect(() => {
    if (!tasksOpen) {
      if (taskAutoHideRef.current) window.clearTimeout(taskAutoHideRef.current);
      return;
    }
    resetTaskAutoHide();
    return () => {
      if (taskAutoHideRef.current) window.clearTimeout(taskAutoHideRef.current);
    };
  }, [tasksOpen]);

  // clicking anywhere outside the panel (and outside its own toggle button, which has
  // its own open/close handling) closes it immediately, on top of the 5s auto-hide.
  // deliberately listens on "click", not "mousedown": closing the panel changes the
  // grid layout (unlike a floating dropdown), and on mousedown that reflow can happen
  // *before* mouseup, shifting whatever the user was actually trying to click out from
  // under the cursor. "click" fires against a target already resolved at dispatch time,
  // so the element's own onClick always runs first, unaffected by the reflow that follows.
  useEffect(() => {
    if (!tasksOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (taskPanelRef.current?.contains(target)) return;
      if ((target as Element).closest?.("[data-tasks-toggle]")) return;
      setTasksOpen(false);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [tasksOpen]);

  // while hosting, broadcast the current timer state on every change (the timer's own
  // 1s tick drives this effect too, so viewers get roughly one update per second)
  useEffect(() => {
    if (!roomCode || !hostChannelRef.current || !hostReady) return;
    broadcastTick(hostChannelRef.current, {
      phase: timer.phase,
      status: timer.status,
      targetSeconds: timer.targetSeconds,
      remainingSeconds: timer.remainingSeconds,
      elapsedSeconds: timer.elapsedSeconds,
      taskTitle: timer.activeTaskTitle,
      mode,
      workTheme: mode === "work" ? workTheme : undefined,
      station: resolveStation(activeStationId, customStation),
    });
  }, [
    roomCode,
    hostReady,
    timer.phase,
    timer.status,
    timer.targetSeconds,
    timer.remainingSeconds,
    timer.elapsedSeconds,
    timer.activeTaskTitle,
    mode,
    workTheme,
    activeStationId,
    customStation,
  ]);

  const theme =
    mode === "work"
      ? resolveWorkTheme(workTheme)
      : personalTheme === "colour"
        ? resolveWorkTheme(personalColorTheme)
        : PERSONAL_THEME;

  const themeVars = useMemo<CSSProperties>(
    () =>
      ({
        "--stage-bg": theme.bg,
        "--stage-ink": theme.ink,
        "--stage-ink-muted": theme.inkMuted,
        "--stage-line": theme.line,
      }) as CSSProperties,
    [theme],
  );

  // reveal theme: image starts blurred, sharpens as the focus session progresses
  const revealBlurPx = useMemo(() => {
    if (mode !== "personal" || personalTheme !== "reveal") return 0;
    if (timer.phase !== "focus" || timer.targetSeconds === null) return 22;
    const progress = 1 - timer.remainingSeconds / timer.targetSeconds;
    return Math.max(0, 22 * (1 - progress));
  }, [mode, personalTheme, timer.phase, timer.targetSeconds, timer.remainingSeconds]);

  const showPhotoLayer = mode === "personal" && personalTheme !== "colour" && !!personalBg;

  return (
    <div className="shell" style={themeVars}>
      <TopBar
        tasksOpen={tasksOpen}
        onToggleTasks={() => setTasksOpen((v) => !v)}
        roomCode={roomCode}
        onStartHosting={startHosting}
        onStopHosting={stopHosting}
      />
      <div className={tasksOpen ? "layout" : "layout layout--full"}>
        <main className="stage" data-mode={mode}>
          {showPhotoLayer && (
            <div
              className="stage-photo"
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(10,8,7,.42), rgba(10,8,7,.62)), url(${personalBg})`,
                filter: personalTheme === "reveal" ? `blur(${revealBlurPx}px)` : undefined,
              }}
            />
          )}
          <TimerStage
            timer={timer}
            selectedFocusMinutes={selectedFocusMinutes}
            onSelectFocusMinutes={setSelectedFocusMinutes}
          />
        </main>
        <TaskPanel
          open={tasksOpen}
          mode={mode}
          timer={timer}
          selectedFocusMinutes={selectedFocusMinutes}
          onActivity={resetTaskAutoHide}
          panelRef={taskPanelRef}
        />
      </div>
      <YoutubeWidget />
      <Credit />
    </div>
  );
}
