import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useTasks } from "../context/TasksContext";
import { useTimer, type TimerApi } from "../hooks/useTimer";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { PERSONAL_THEME, resolveWorkTheme } from "../lib/themes";
import { DEFAULT_FOCUS_MIN } from "../lib/durations";
import { GALLERY } from "../lib/gallery";
import { parseShareFromLocation, clearShareFromLocation } from "../lib/share";
import { resolveIdentityKey } from "../lib/identity";
import { findLobbyByCode, joinLobby, logLobbySession, parseLobbyCodeFromLocation, clearLobbyFromLocation } from "../lib/lobby";
import { connectLobbySync, broadcastSyncAction, writeSyncState, readSyncState, type SyncAction } from "../lib/lobbySync";
import { playChime, stopChime, unlockAudio } from "../lib/sound";
import { TopBar } from "./TopBar";
import { TimerStage } from "./TimerStage";
import { TaskPanel, type PanelTab } from "./TaskPanel";
import { DailySummary } from "./DailySummary";
import { LobbySummary } from "./LobbySummary";
import { DvdBounce } from "./DvdBounce";
import { F1Race } from "./F1Race";
import { YtBackground } from "./YtBackground";
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
    ytBgUrl,
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
  const syncChannelRef = useRef<RealtimeChannel | null>(null);

  const identityKey = resolveIdentityKey(user?.id ?? null);
  const displayName = personaName || "guest";
  const inSyncLobby = currentLobby?.mode === "sync";

  // best-effort: mirror a completion into the active lobby's stats too, if any. Never
  // blocks or affects the personal history write above -- a lobby-log failure shouldn't
  // break the core timer/history flow. taskTitle travels along so the team view can show
  // what each member is actually working on, not just anonymous "focus" time -- most
  // visible in sync-mode lobbies, where everyone's clock runs together but each member
  // still picks their own task.
  const logToLobbyIfActive = (phase: "focus" | "break", minutes: number, taskTitle: string | null) => {
    if (!currentLobby) return;
    void logLobbySession(currentLobby.id, identityKey, displayName, phase, minutes, taskTitle);
    setLobbyRefreshToken((v) => v + 1);
  };

  const rawTimer = useTimer({
    onFocusComplete: (minutes, taskId, taskTitle) => {
      logCompletion({ taskId, taskTitle, mode, phase: "focus", minutes, completedAt: Date.now() });
      logToLobbyIfActive("focus", minutes, taskTitle);
      playChime();
      setSessionPrompt("choice");
    },
    onBreakComplete: (minutes) => {
      logCompletion({ taskId: null, taskTitle: null, mode, phase: "break", minutes, completedAt: Date.now() });
      logToLobbyIfActive("break", minutes, null);
      playChime();
      setSessionPrompt("choice");
    },
    // a manual stop mid-session, or a session recovered on reload that hadn't actually
    // finished yet -- log the partial time actually spent, but no chime/prompt, since the
    // user (or the interruption) already ended this one, they didn't just complete it
    onPartialStop: (phase, minutes, taskId, taskTitle) => {
      logCompletion({ taskId, taskTitle, mode, phase, minutes, completedAt: Date.now() });
      logToLobbyIfActive(phase, minutes, taskTitle);
    },
  });

  // always-fresh handle on rawTimer for the sync-broadcast effect below, whose own
  // closure (keyed only on the lobby id/mode) would otherwise go stale: rawTimer's own
  // pause/resume/stop/reset read status/remainingSeconds/etc. from *their* closure over
  // useTimer's internal state, so calling a version captured at connect-time, long after
  // that render, would silently act on outdated values.
  const rawTimerRef = useRef(rawTimer);
  useEffect(() => {
    rawTimerRef.current = rawTimer;
  });

  const broadcastIfSync = (action: SyncAction) => {
    if (inSyncLobby && syncChannelRef.current) broadcastSyncAction(syncChannelRef.current, action);
  };

  // only startFocus/startBreak/stop have statically-known resulting values (no stale
  // read needed), so those are the only actions that also update the persisted
  // sync_state a late joiner catches up from -- see connectLobbySync's effect below
  const syncedStartFocus: TimerApi["startFocus"] = (minutes, taskId = null, taskTitle = null) => {
    rawTimer.startFocus(minutes, taskId, taskTitle);
    if (inSyncLobby && currentLobby) {
      const action: SyncAction = { type: "startFocus", minutes };
      broadcastIfSync(action);
      void writeSyncState(currentLobby.id, { action, at: Date.now() });
    }
  };
  const syncedStartBreak: TimerApi["startBreak"] = (minutes) => {
    rawTimer.startBreak(minutes);
    if (inSyncLobby && currentLobby) {
      const action: SyncAction = { type: "startBreak", minutes };
      broadcastIfSync(action);
      void writeSyncState(currentLobby.id, { action, at: Date.now() });
    }
  };
  const syncedPause: TimerApi["pause"] = () => {
    rawTimer.pause();
    broadcastIfSync({ type: "pause" });
  };
  const syncedResume: TimerApi["resume"] = () => {
    rawTimer.resume();
    broadcastIfSync({ type: "resume" });
  };
  const syncedStop: TimerApi["stop"] = () => {
    rawTimer.stop();
    if (inSyncLobby && currentLobby) {
      const action: SyncAction = { type: "stop" };
      broadcastIfSync(action);
      void writeSyncState(currentLobby.id, { action, at: Date.now() });
    }
  };
  const syncedReset: TimerApi["reset"] = () => {
    rawTimer.reset();
    broadcastIfSync({ type: "reset" });
  };
  const syncedTogglePrimary: TimerApi["togglePrimary"] = (fallbackMinutes) => {
    if (rawTimer.status === "running") syncedPause();
    else if (rawTimer.status === "paused") syncedResume();
    else syncedStartFocus(fallbackMinutes);
  };

  const timer: TimerApi = {
    ...rawTimer,
    startFocus: syncedStartFocus,
    startBreak: syncedStartBreak,
    pause: syncedPause,
    resume: syncedResume,
    stop: syncedStop,
    reset: syncedReset,
    togglePrimary: syncedTogglePrimary,
  };

  // connect/reconnect the sync broadcast channel whenever the active lobby (or its mode)
  // changes. Any member's start/pause/resume/stop/reset is applied here to the local
  // timer -- last action received wins, no locking, task selection stays local (the
  // broadcast never carries taskId/taskTitle). A fresh join also catches up to whatever
  // was most recently written to sync_state, so joining mid-session doesn't leave you
  // stuck idle until the next action happens to fire.
  useEffect(() => {
    syncChannelRef.current?.unsubscribe();
    syncChannelRef.current = null;
    if (!currentLobby || currentLobby.mode !== "sync") return;

    const applyAction = (action: SyncAction) => {
      const t = rawTimerRef.current;
      if (action.type === "startFocus") t.startFocus(action.minutes);
      else if (action.type === "startBreak") t.startBreak(action.minutes);
      else if (action.type === "pause") t.pause();
      else if (action.type === "resume") t.resume();
      else if (action.type === "stop") t.stop();
      else if (action.type === "reset") t.reset();
    };

    syncChannelRef.current = connectLobbySync(currentLobby.id, applyAction);

    (async () => {
      const state = await readSyncState(currentLobby.id);
      if (!state) return;
      const elapsedMinutes = (Date.now() - state.at) / 60000;
      if (state.action.type === "startFocus") {
        const remaining = state.action.minutes - elapsedMinutes;
        if (remaining > 0.05) rawTimerRef.current.startFocus(remaining);
      } else if (state.action.type === "startBreak") {
        if (state.action.minutes === null) {
          rawTimerRef.current.startBreak(null);
        } else {
          const remaining = state.action.minutes - elapsedMinutes;
          if (remaining > 0.05) rawTimerRef.current.startBreak(remaining);
        }
      }
      // "stop" (or nothing written yet) -> nothing in progress, stay idle
    })();

    return () => {
      syncChannelRef.current?.unsubscribe();
      syncChannelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLobby?.id, currentLobby?.mode]);

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
      setCurrentLobby({ id: lobby.id, code: lobby.code, name: lobby.name, mode: lobby.mode });
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
              el.matches(".fun-menu") ||
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

  const showPhotoLayer = mode === "personal" && personalTheme === "photo" && !!personalBg;
  const showRevealLayer = mode === "personal" && personalTheme === "reveal";

  // reveal's backdrop is a curated gallery, not an upload -- rotates to a new random
  // painting every 30s (never repeating the one just shown, so a 2-painting gallery still
  // visibly alternates rather than coin-flipping back onto itself)
  const [galleryIndex, setGalleryIndex] = useState(() => Math.floor(Math.random() * GALLERY.length));
  useEffect(() => {
    if (!showRevealLayer || GALLERY.length <= 1) return;
    const id = setInterval(() => {
      setGalleryIndex((prev) => {
        let next = Math.floor(Math.random() * (GALLERY.length - 1));
        if (next >= prev) next += 1;
        return next;
      });
    }, 30000);
    return () => clearInterval(id);
  }, [showRevealLayer]);
  const currentPainting = GALLERY[galleryIndex] ?? GALLERY[0];

  const showLofiLayer = mode === "personal" && personalTheme === "lofi";
  const showDvdLayer = mode === "personal" && personalTheme === "dvd";
  const showSuitsLayer = mode === "personal" && personalTheme === "suits";
  const showF1Layer = mode === "personal" && personalTheme === "f1";
  // dev-only feature, still being tuned -- see the matching gate in PersonalThemeTabs
  const showF1TrackLayer = import.meta.env.DEV && mode === "personal" && personalTheme === "f1track";
  const showSuccessionLayer = mode === "personal" && personalTheme === "succession";
  const showYtLayer = mode === "personal" && personalTheme === "yt";

  // unlike the other video backdrops, this one keeps its audio -- browsers only allow
  // autoplay-with-sound right after a real user gesture (picking this option from the
  // menu counts), so if the initial play() attempt gets blocked (e.g. the theme was
  // already selected on page load, well past that gesture), fall back to starting it on
  // the next real interaction anywhere on the page instead of leaving it silently stuck
  const successionVideoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!showSuccessionLayer) return;
    const el = successionVideoRef.current;
    if (!el) return;

    const retry = () => {
      el.play().catch(() => {});
    };
    el.play().catch(() => {
      document.addEventListener("pointerdown", retry, { once: true });
      document.addEventListener("keydown", retry, { once: true });
    });

    return () => {
      document.removeEventListener("pointerdown", retry);
      document.removeEventListener("keydown", retry);
    };
  }, [showSuccessionLayer]);

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
        onOpenTeamStats={() => {
          setPanelTab("team");
          setTasksOpen(true);
          resetTaskAutoHide();
        }}
      />
      <div className={tasksOpen ? "layout" : "layout layout--full"}>
        <main className="stage" data-mode={mode} data-personal-theme={mode === "personal" ? personalTheme : undefined}>
          {showPhotoLayer && (
            <div
              className="stage-photo"
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(10,8,7,.42), rgba(10,8,7,.62)), url(${personalBg})`,
              }}
            />
          )}
          {showRevealLayer && (
            <div
              className="stage-photo"
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(10,8,7,.42), rgba(10,8,7,.62)), url(${currentPainting.src})`,
                filter: `blur(${revealBlurPx}px)`,
              }}
            />
          )}
          {showLofiLayer && (
            <div className="stage-lofi-wrap">
              <video className="stage-lofi" src="/lofi-bg.mp4" autoPlay muted loop playsInline />
              <div className="stage-lofi-overlay" />
            </div>
          )}
          {showSuitsLayer && (
            <div className="stage-suits-wrap">
              <video className="stage-suits" src="/suits-bg.mp4" autoPlay muted loop playsInline />
              <div className="stage-suits-overlay" />
            </div>
          )}
          {showF1Layer && (
            <div className="stage-f1-wrap">
              <video className="stage-f1" src="/f1-bg.mp4" autoPlay muted loop playsInline />
              <div className="stage-f1-overlay" />
            </div>
          )}
          {showF1TrackLayer && <F1Race timer={timer} />}
          {showYtLayer && <YtBackground url={ytBgUrl} />}
          {showSuccessionLayer && (
            <div className="stage-succession-wrap">
              <video
                ref={successionVideoRef}
                className="stage-succession"
                src="/succession-bg.mp4"
                autoPlay
                loop
                playsInline
                preload="auto"
              />
              <div className="stage-succession-overlay" />
            </div>
          )}
          {showDvdLayer && <DvdBounce timer={timer} />}
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
