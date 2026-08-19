import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useTasks } from "../context/TasksContext";
import { useTimer, type TimerApi } from "../hooks/useTimer";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useBackgroundTimerDisplay } from "../hooks/useBackgroundTimerDisplay";
import { PERSONAL_THEME, SPLITFLAP_THEME, resolveWorkTheme } from "../lib/themes";
import { DEFAULT_FOCUS_MIN } from "../lib/durations";
import { GALLERY } from "../lib/gallery";
import { parseShareFromLocation, clearShareFromLocation } from "../lib/share";
import { resolveIdentityKey } from "../lib/identity";
import { findLobbyByCode, joinLobby, logLobbySession, parseLobbyCodeFromLocation, clearLobbyFromLocation } from "../lib/lobby";
import {
  connectLobbySync,
  broadcastSyncAction,
  writeSyncState,
  readSyncState,
  connectKudosNotifications,
  sendKudosOnChannel,
  broadcastKudos,
  type SyncAction,
  type KudosNotification,
} from "../lib/lobbySync";
import { playChime, stopChime, unlockAudio } from "../lib/sound";
import { computeBadges, readSeenBadges, writeSeenBadges, type Badge } from "../lib/statsExtras";
import { TopBar } from "./TopBar";
import { TimerStage } from "./TimerStage";
import { TaskPanel, type PanelTab } from "./TaskPanel";
import { DailySummary } from "./DailySummary";
import { LobbySummary } from "./LobbySummary";
import { PersonalStatsPage } from "./PersonalStatsPage";
import { TeamStatsPage } from "./TeamStatsPage";
import { FeaturesPage } from "./FeaturesPage";
import { DvdBounce } from "./DvdBounce";
import { F1Race } from "./F1Race";
import { YtBackground } from "./YtBackground";
import { JapanCurtain } from "./JapanCurtain";
import { YoutubeWidget } from "./YoutubeWidget";
import { Credit } from "./Credit";
import { SessionPrompt } from "./SessionPrompt";
import { Onboarding } from "./Onboarding";
import { IconFlame, IconTrophy } from "./icons";

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
  const { identityUserId, loading: authLoading } = useAuth();
  const { history, logCompletion } = useTasks();
  // starts closed on phone-sized viewports -- the task panel takes over the whole
  // screen there (the layout grid collapses to one column below 860px, matching
  // App.css's own breakpoint), pushing the timer out of view on first load otherwise
  const [tasksOpen, setTasksOpen] = useState(() => typeof window === "undefined" || window.innerWidth > 860);
  const [panelTab, setPanelTab] = useState<PanelTab>("tasks");
  const [personalStatsOpen, setPersonalStatsOpen] = useState(false);
  const [teamStatsOpen, setTeamStatsOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [selectedFocusMinutes, setSelectedFocusMinutes] = useState(DEFAULT_FOCUS_MIN);
  const [sessionPrompt, setSessionPrompt] = useState<"choice" | "break-picker" | null>(null);
  const [lobbyRefreshToken, setLobbyRefreshToken] = useState(0);
  const [kudosToast, setKudosToast] = useState<KudosNotification | null>(null);
  const [badgeToast, setBadgeToast] = useState<Badge | null>(null);
  const badgeToastTimeoutRef = useRef<number | null>(null);
  const kudosToastTimeoutRef = useRef<number | null>(null);
  const [topbarRevealed, setTopbarRevealed] = useState(false);
  const taskAutoHideRef = useRef<number | null>(null);
  const topbarAutoHideRef = useRef<number | null>(null);
  const taskPanelRef = useRef<HTMLElement | null>(null);
  const syncChannelRef = useRef<RealtimeChannel | null>(null);
  const kudosChannelRef = useRef<{ lobbyId: string; channel: RealtimeChannel } | null>(null);

  const identityKey = resolveIdentityKey(identityUserId);
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
      logCompletion({ taskId, taskTitle, mode, phase: "focus", minutes, completedAt: Date.now(), completed: true });
      logToLobbyIfActive("focus", minutes, taskTitle);
      playChime();
      setSessionPrompt("choice");
    },
    onBreakComplete: (minutes) => {
      logCompletion({
        taskId: null,
        taskTitle: null,
        mode,
        phase: "break",
        minutes,
        completedAt: Date.now(),
        completed: true,
      });
      logToLobbyIfActive("break", minutes, null);
      playChime();
      setSessionPrompt("choice");
    },
    // a manual stop mid-session, or a session recovered on reload that hadn't actually
    // finished yet -- log the partial time actually spent, but no chime/prompt, since the
    // user (or the interruption) already ended this one, they didn't just complete it.
    // completed: false is what makes this distinguishable from a natural finish -- see
    // computeCompletionStats in lib/statsExtras.ts.
    onPartialStop: (phase, minutes, taskId, taskTitle) => {
      logCompletion({ taskId, taskTitle, mode, phase, minutes, completedAt: Date.now(), completed: false });
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

  // live "you got kudos" toast -- connected whenever a lobby is active, regardless of
  // individual/sync mode (unlike the sync channel above, which only matters in sync mode).
  // Purely a same-session nudge on top of the real database write (see
  // lib/lobbySync.ts's connectKudosNotifications) -- missing this because the tab wasn't
  // open just means no toast, the kudos itself is never lost.
  useEffect(() => {
    if (!currentLobby) return;
    const channel = connectKudosNotifications(currentLobby.id, (notification) => {
      if (notification.toIdentityKey !== identityKey) return;
      if (kudosToastTimeoutRef.current) window.clearTimeout(kudosToastTimeoutRef.current);
      setKudosToast(notification);
      kudosToastTimeoutRef.current = window.setTimeout(() => setKudosToast(null), 5000);
    });
    if (channel) kudosChannelRef.current = { lobbyId: currentLobby.id, channel };
    return () => {
      channel?.unsubscribe();
      kudosChannelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLobby?.id, identityKey]);

  // live "badge unlocked" toast -- fires the moment a session pushes you past a threshold,
  // not just when you happen to open the full stats page. Kudos already got a live toast
  // for reacting to *someone else's* session; crossing your own personal-best/badge
  // threshold is arguably the higher-leverage moment and was previously silent.
  useEffect(() => {
    const badges = computeBadges(history, mode);
    const achievedIds = badges.filter((b) => b.achieved).map((b) => b.id);
    const seen = readSeenBadges(mode);
    // seen === null: this identity/mode has never been evaluated before -- e.g. an
    // existing user the moment this feature ships, with years of badges already true.
    // Seed the seen-set without toasting any of it; only genuinely new unlocks notify.
    const newlyAchieved = seen ? badges.find((b) => b.achieved && !seen.has(b.id)) : undefined;
    writeSeenBadges(mode, achievedIds);
    if (newlyAchieved) {
      if (badgeToastTimeoutRef.current) window.clearTimeout(badgeToastTimeoutRef.current);
      setBadgeToast(newlyAchieved);
      badgeToastTimeoutRef.current = window.setTimeout(() => setBadgeToast(null), 5000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, mode]);

  // reuses the channel above when kudos are given on the currently-active lobby (the
  // common case), falling back to a one-off channel otherwise -- see sendKudosOnChannel's
  // comment in lib/lobbySync.ts for why reuse isn't just an optimization here
  const sendKudos = (lobbyId: string, notification: KudosNotification) => {
    if (kudosChannelRef.current?.lobbyId === lobbyId) {
      sendKudosOnChannel(kudosChannelRef.current.channel, notification);
    } else {
      broadcastKudos(lobbyId, notification);
    }
  };

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

  const { popOut: popOutPip, pipSupported } = useBackgroundTimerDisplay(timer);

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
  // current identity, make it the active lobby, then clean the url. Waits for auth to
  // actually resolve first -- a fresh visitor from a shared link hasn't necessarily
  // finished anonymous sign-in yet, and identityKey falls back to a client-only guest id
  // until it does. joinLobby's insert is checked under RLS against the caller's real
  // auth.uid(), so attempting the join before that settles could silently fail RLS while
  // this still optimistically marked the lobby as joined (setCurrentLobby ran regardless
  // of whether joinLobby actually succeeded) -- that mismatch is exactly what made a
  // shared link "not work" while manually entering the same code did, since by the time
  // someone finishes typing a code and clicking join, auth has long since settled.
  const lobbyJoinAttempted = useRef(false);
  useEffect(() => {
    if (authLoading || lobbyJoinAttempted.current) return;
    const code = parseLobbyCodeFromLocation();
    if (!code) return;
    lobbyJoinAttempted.current = true;
    (async () => {
      const lobby = await findLobbyByCode(code);
      if (!lobby) {
        clearLobbyFromLocation();
        return;
      }
      const joined = await joinLobby(lobby.id, identityKey, displayName);
      if (!joined) return; // leave ?lobby= in place so a reload can retry
      setCurrentLobby({ id: lobby.id, code: lobby.code, name: lobby.name, mode: lobby.mode });
      clearLobbyFromLocation();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  // shows the features overview once, automatically, the moment onboarding resolves
  // (personaName becomes set, whether by picking a guest name or signing in) -- guarded
  // by a localStorage flag so a returning visitor on this same browser never sees it pop
  // up again. The permanent topbar link (below) is how anyone revisits it after that.
  useEffect(() => {
    if (!personaName) return;
    try {
      if (window.localStorage.getItem("pomo:seenFeaturesIntro")) return;
      window.localStorage.setItem("pomo:seenFeaturesIntro", "1");
      setFeaturesOpen(true);
    } catch {
      // storage unavailable -- just skip the auto-show, the topbar link still works
    }
  }, [personaName]);

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
              el.matches(".onboarding") ||
              el.matches(".stats-overlay")),
        )
      )
        return;
      setTasksOpen(false);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [tasksOpen]);

  // the auto-hidden top bar reveals on hover for mouse/trackpad (pure CSS, see
  // .topbar-zone--auto-hide:hover in App.css), but touch devices have no hover concept --
  // a tap on iOS can trigger a *visual* :hover state without registering as a real click,
  // leaving the bar unresponsive to a second tap. This mirrors the task panel's own
  // reveal/auto-hide/click-away pattern above so touch taps work the same reliable way.
  const revealTopbar = () => {
    setTopbarRevealed(true);
    if (topbarAutoHideRef.current) window.clearTimeout(topbarAutoHideRef.current);
    topbarAutoHideRef.current = window.setTimeout(() => setTopbarRevealed(false), 6000);
  };

  useEffect(() => {
    if (timer.status !== "running") {
      setTopbarRevealed(false);
      if (topbarAutoHideRef.current) window.clearTimeout(topbarAutoHideRef.current);
    }
  }, [timer.status]);

  useEffect(() => {
    if (!topbarRevealed) return;
    const handleClick = (event: MouseEvent) => {
      const path = event.composedPath();
      if (path.some((el) => el instanceof Element && el.matches(".topbar-zone"))) return;
      setTopbarRevealed(false);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [topbarRevealed]);

  const theme =
    mode === "work"
      ? resolveWorkTheme(workTheme)
      : personalTheme === "colour"
        ? resolveWorkTheme(personalColorTheme)
        : personalTheme === "splitflap"
          ? SPLITFLAP_THEME
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
  const showForest1Layer = mode === "personal" && personalTheme === "forest1";
  const showSplitFlap = mode === "personal" && personalTheme === "splitflap";
  const showJapanLayer = mode === "personal" && personalTheme === "japan";
  const showMatrixLayer = mode === "personal" && personalTheme === "matrix";
  const showPLayer = mode === "personal" && personalTheme === "p";

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

  // .topbar is position:fixed while auto-hiding (running), which takes it out of layout
  // flow entirely -- a revealed topbar then overlays whatever's underneath instead of
  // pushing it down, covering the task panel's own top row unless that row reserves the
  // topbar's height as padding. The topbar wraps to extra rows (and grows taller) on
  // narrow viewports, so that reserved padding is measured live via ResizeObserver rather
  // than hardcoded to whatever height happens to be right on desktop.
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const shellEl = shellRef.current;
    const topbarEl = shellEl?.querySelector(".topbar");
    if (!shellEl || !topbarEl) return;
    // re-measure via getBoundingClientRect rather than trusting the observer entry's own
    // contentRect -- that excludes padding/border (18px top+bottom padding + 1px border
    // here), undershooting the topbar's actual rendered height by ~37px
    const ro = new ResizeObserver(() => {
      shellEl.style.setProperty("--topbar-height", `${topbarEl.getBoundingClientRect().height}px`);
    });
    ro.observe(topbarEl);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="shell" style={themeVars} ref={shellRef}>
      <div
        className={
          timer.status === "running"
            ? topbarRevealed
              ? "topbar-zone topbar-zone--auto-hide topbar-zone--revealed"
              : "topbar-zone topbar-zone--auto-hide"
            : "topbar-zone"
        }
        onPointerDown={timer.status === "running" ? revealTopbar : undefined}
      >
        <div className="topbar-hover-trigger" />
        <TopBar
          tasksOpen={tasksOpen}
          onToggleTasks={() => setTasksOpen((v) => !v)}
          onOpenStats={() => setPersonalStatsOpen(true)}
          onOpenTeamStats={() => setTeamStatsOpen(true)}
        />
      </div>
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
          {showForest1Layer && (
            <div className="stage-forest1-wrap">
              {/* a GIF loops natively via a plain <img> -- no autoplay/mute attributes needed */}
              <img className="stage-forest1" src="/forest1-bg.gif" alt="" />
              <div className="stage-forest1-overlay" />
            </div>
          )}
          {showJapanLayer && <JapanCurtain />}
          {showMatrixLayer && (
            <div className="stage-matrix-wrap">
              <img className="stage-matrix" src="/matrix-bg.jpg" alt="" />
              <div className="stage-matrix-overlay" />
            </div>
          )}
          {showPLayer && (
            <div className="stage-p-wrap">
              <img className="stage-p" src="/p-bg.jpg" alt="" />
              <div className="stage-p-overlay" />
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
            onPopOutPip={pipSupported ? popOutPip : null}
            splitFlap={showSplitFlap}
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
          onOpenFullStats={() => setPersonalStatsOpen(true)}
          onOpenFullTeamStats={() => setTeamStatsOpen(true)}
        />
      </div>
      <PersonalStatsPage mode={mode} open={personalStatsOpen} onClose={() => setPersonalStatsOpen(false)} />
      <TeamStatsPage open={teamStatsOpen} onClose={() => setTeamStatsOpen(false)} onGiveKudos={sendKudos} />
      <FeaturesPage open={featuresOpen} onClose={() => setFeaturesOpen(false)} />
      {kudosToast && (
        <div className="kudos-toast" role="status">
          <span className="kudos-toast__icon">
            <IconFlame />
          </span>
          <p className="kudos-toast__body">
            <span className="kudos-toast__who">{kudosToast.fromPersonaName}</span> gave you kudos
            {kudosToast.taskTitle ? ` for "${kudosToast.taskTitle}"` : ""}
          </p>
        </div>
      )}
      {badgeToast && (
        <div
          className="kudos-toast"
          role="status"
          // stack below the kudos toast in the rare case both fire at once, rather than overlapping
          style={kudosToast ? { top: "calc(var(--topbar-height, 76px) + 12px + 70px)" } : undefined}
        >
          <span className="kudos-toast__icon">
            <IconTrophy />
          </span>
          <p className="kudos-toast__body">
            <span className="kudos-toast__who">{badgeToast.label}</span> unlocked — {badgeToast.description}
          </p>
        </div>
      )}
      <YoutubeWidget />
      <Credit onOpenFeatures={() => setFeaturesOpen(true)} />
      <Onboarding />
    </div>
  );
}
