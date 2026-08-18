import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useTasks } from "../context/TasksContext";
import { useTimer } from "../hooks/useTimer";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { PERSONAL_THEME, resolveWorkTheme } from "../lib/themes";
import { DEFAULT_FOCUS_MIN } from "../lib/durations";
import { parseShareFromLocation, clearShareFromLocation } from "../lib/share";
import { resolveIdentityKey } from "../lib/identity";
import { findLobbyByCode, joinLobby, logLobbySession, parseLobbyCodeFromLocation, clearLobbyFromLocation } from "../lib/lobby";
import { playChime, stopChime, unlockAudio } from "../lib/sound";
import { TopBar } from "./TopBar";
import { TimerStage } from "./TimerStage";
import { TaskPanel, type PanelTab } from "./TaskPanel";
import { DailySummary } from "./DailySummary";
import { LobbySummary } from "./LobbySummary";
import { YoutubeWidget } from "./YoutubeWidget";
import { Credit } from "./Credit";
import { SessionPrompt } from "./SessionPrompt";
import { Onboarding } from "./Onboarding";

export function Shell() {
  const {
    mode,
    workTheme,
    personalTheme,
    personalColorTheme,
    personalBg,
    personaName,
    currentLobby,
    setCurrentLobby,
    setMode,
    setWorkTheme,
  } = useSettings();
  const { user } = useAuth();
  const { logCompletion } = useTasks();
  const [tasksOpen, setTasksOpen] = useState(true);
  const [panelTab, setPanelTab] = useState<PanelTab>("tasks");
  const [selectedFocusMinutes, setSelectedFocusMinutes] = useState(DEFAULT_FOCUS_MIN);
  const [sessionPrompt, setSessionPrompt] = useState<"choice" | "break-picker" | null>(null);
  const [lobbyRefreshToken, setLobbyRefreshToken] = useState(0);
  const taskAutoHideRef = useRef<number | null>(null);
  const taskPanelRef = useRef<HTMLElement | null>(null);

  const identityKey = resolveIdentityKey(user?.id ?? null);
  const displayName = personaName || "guest";

  // best-effort: mirror a completion into the active lobby's stats too, if any. Never
  // blocks or affects the personal history write above -- a lobby-log failure shouldn't
  // break the core timer/history flow.
  const logToLobbyIfActive = (phase: "focus" | "break", minutes: number) => {
    if (!currentLobby) return;
    void logLobbySession(currentLobby.id, identityKey, displayName, phase, minutes);
    setLobbyRefreshToken((v) => v + 1);
  };

  const timer = useTimer({
    onFocusComplete: (minutes, taskId, taskTitle) => {
      logCompletion({ taskId, taskTitle, mode, phase: "focus", minutes, completedAt: Date.now() });
      logToLobbyIfActive("focus", minutes);
      playChime();
      setSessionPrompt("choice");
    },
    onBreakComplete: (minutes) => {
      logCompletion({ taskId: null, taskTitle: null, mode, phase: "break", minutes, completedAt: Date.now() });
      logToLobbyIfActive("break", minutes);
      playChime();
      setSessionPrompt("choice");
    },
    // a manual stop mid-session, or a session recovered on reload that hadn't actually
    // finished yet -- log the partial time actually spent, but no chime/prompt, since the
    // user (or the interruption) already ended this one, they didn't just complete it
    onPartialStop: (phase, minutes, taskId, taskTitle) => {
      logCompletion({ taskId, taskTitle, mode, phase, minutes, completedAt: Date.now() });
      logToLobbyIfActive(phase, minutes);
    },
  });

  // if a new session starts by any other means (keyboard shortcut, task-panel "start
  // pomo", etc.) while the prompt is still up, dismiss it rather than leaving it stacked
  // on top of an already-running timer
  useEffect(() => {
    if (timer.status !== "idle" && sessionPrompt) {
      stopChime();
      setSessionPrompt(null);
    }
  }, [timer.status, sessionPrompt]);

  // nudge the completion-chime AudioContext awake on every real interaction with the
  // page, not just the first -- see the comment in lib/sound.ts: some browsers
  // re-suspend an idle AudioContext later in the session, and unlockAudio() is a no-op
  // once the context is already running, so leaving this attached for the whole session
  // costs nothing while covering that case
  useEffect(() => {
    document.addEventListener("pointerdown", unlockAudio);
    document.addEventListener("keydown", unlockAudio);
    return () => {
      document.removeEventListener("pointerdown", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
    };
  }, []);

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

  // pick up a lobby invite link (?lobby=CODE): look the lobby up, join it under the
  // current identity, make it the active lobby, then clean the url
  useEffect(() => {
    const code = parseLobbyCodeFromLocation();
    if (!code) return;
    (async () => {
      const lobby = await findLobbyByCode(code);
      if (!lobby) return;
      await joinLobby(lobby.id, identityKey, displayName);
      setCurrentLobby({ id: lobby.id, code: lobby.code, name: lobby.name });
    })();
    clearLobbyFromLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // task panel auto-hides 12s after opening; resets on any interaction inside it
  const resetTaskAutoHide = () => {
    if (taskAutoHideRef.current) window.clearTimeout(taskAutoHideRef.current);
    taskAutoHideRef.current = window.setTimeout(() => setTasksOpen(false), 12000);
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
  // its own open/close handling) closes it immediately, on top of the 12s auto-hide.
  // deliberately listens on "click", not "mousedown": closing the panel changes the
  // grid layout (unlike a floating dropdown), and on mousedown that reflow can happen
  // *before* mouseup, shifting whatever the user was actually trying to click out from
  // under the cursor. "click" fires against a target already resolved at dispatch time,
  // so the element's own onClick always runs first, unaffected by the reflow that follows.
  useEffect(() => {
    if (!tasksOpen) return;
    const handleClick = (event: MouseEvent) => {
      // composedPath() is captured at dispatch time, before any handler-triggered DOM
      // mutation -- using it (rather than event.target + closest(), which walks the
      // *live* DOM) matters here specifically because clicking a dropdown item (account
      // menu's "stats", lobby panel's create/join/leave) also closes that dropdown in the
      // same click. React 18 flushes that removal before this document-level listener
      // runs, so by then event.target is already detached and closest() can't find its
      // former ancestor -- silently breaking the exemption below and closing the task
      // panel right back up the instant an action had just opened it.
      const path = event.composedPath();
      if (taskPanelRef.current && path.includes(taskPanelRef.current)) return;
      if (
        path.some(
          (el) =>
            el instanceof Element &&
            (el.matches("[data-tasks-toggle]") ||
              el.matches(".account-widget") ||
              el.matches(".lobby-widget") ||
              el.matches(".onboarding")),
        )
      )
        return;
      setTasksOpen(false);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [tasksOpen]);

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
        onOpenStats={() => {
          setPanelTab("stats");
          setTasksOpen(true);
          resetTaskAutoHide();
        }}
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
          <div className="corner-summary">
            <DailySummary mode={mode} />
            {currentLobby && <LobbySummary lobby={currentLobby} refreshToken={lobbyRefreshToken} />}
          </div>
          {sessionPrompt && (
            <SessionPrompt
              stage={sessionPrompt}
              phase={timer.phase}
              onContinue={() => {
                stopChime();
                setSessionPrompt(null);
              }}
              onChooseBreak={() => {
                stopChime();
                setSessionPrompt("break-picker");
              }}
              onStartBreak={(minutes) => {
                stopChime();
                timer.startBreak(minutes);
                setSessionPrompt(null);
              }}
              onDismiss={() => {
                stopChime();
                setSessionPrompt(null);
              }}
            />
          )}
        </main>
        <TaskPanel
          open={tasksOpen}
          mode={mode}
          timer={timer}
          selectedFocusMinutes={selectedFocusMinutes}
          onActivity={resetTaskAutoHide}
          panelRef={taskPanelRef}
          tab={panelTab}
          onTabChange={setPanelTab}
        />
      </div>
      <YoutubeWidget />
      <Credit />
      <Onboarding />
    </div>
  );
}
