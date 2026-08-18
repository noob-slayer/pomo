import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSettings } from "../context/SettingsContext";
import { useTasks } from "../context/TasksContext";
import { useTimer } from "../hooks/useTimer";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { WORK_THEMES, PERSONAL_THEME } from "../lib/themes";
import { DEFAULT_FOCUS_MIN } from "../lib/durations";
import { parseShareFromLocation, clearShareFromLocation } from "../lib/share";
import { TopBar } from "./TopBar";
import { TimerStage } from "./TimerStage";
import { TaskPanel } from "./TaskPanel";
import { YoutubeWidget } from "./YoutubeWidget";

export function Shell() {
  const { mode, workTheme, personalTheme, personalBg, setMode, setWorkTheme } = useSettings();
  const { logCompletion } = useTasks();
  const [tasksOpen, setTasksOpen] = useState(true);
  const [selectedFocusMinutes, setSelectedFocusMinutes] = useState(DEFAULT_FOCUS_MIN);

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

  const theme = mode === "work" ? WORK_THEMES[workTheme] : PERSONAL_THEME;

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

  const showPhotoLayer = mode === "personal" && personalTheme !== "nixie" && !!personalBg;

  return (
    <div className="shell">
      <TopBar
        tasksOpen={tasksOpen}
        onToggleTasks={() => setTasksOpen((v) => !v)}
        focusMinutes={selectedFocusMinutes}
      />
      <div className={tasksOpen ? "layout" : "layout layout--full"}>
        <main
          className="stage"
          style={themeVars}
          data-mode={mode}
          data-personal-theme={mode === "personal" ? personalTheme : undefined}
        >
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
            clockVariant={mode === "personal" && personalTheme === "nixie" ? "nixie" : "text"}
          />
        </main>
        <TaskPanel open={tasksOpen} mode={mode} timer={timer} selectedFocusMinutes={selectedFocusMinutes} />
      </div>
      <YoutubeWidget />
    </div>
  );
}
