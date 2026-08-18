import { useSettings } from "../context/SettingsContext";
import { ThemeSwatches } from "./ThemeSwatches";
import { BackgroundPicker } from "./BackgroundPicker";
import { PersonalThemeTabs } from "./PersonalThemeTabs";
import { ShareWidget } from "./ShareWidget";

interface TopBarProps {
  tasksOpen: boolean;
  onToggleTasks: () => void;
  focusMinutes: number;
}

export function TopBar({ tasksOpen, onToggleTasks, focusMinutes }: TopBarProps) {
  const { mode, setMode, personalTheme } = useSettings();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="wordmark">pomo</span>
        <nav className="mode-switch" aria-label="mode">
          <button
            type="button"
            className={mode === "work" ? "mode-switch__item mode-switch__item--active" : "mode-switch__item"}
            onClick={() => setMode("work")}
          >
            work
          </button>
          <span className="mode-switch__sep">/</span>
          <button
            type="button"
            className={mode === "personal" ? "mode-switch__item mode-switch__item--active" : "mode-switch__item"}
            onClick={() => setMode("personal")}
          >
            personal
          </button>
        </nav>
      </div>

      <div className="topbar-right">
        {mode === "work" ? (
          <ThemeSwatches />
        ) : (
          <>
            <PersonalThemeTabs />
            {personalTheme !== "nixie" && <BackgroundPicker />}
          </>
        )}
        <ShareWidget focusMinutes={focusMinutes} />
        <button
          type="button"
          className="tasks-toggle"
          onClick={onToggleTasks}
          aria-pressed={tasksOpen}
        >
          tasks
        </button>
      </div>
    </header>
  );
}
