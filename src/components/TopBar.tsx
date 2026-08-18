import { useSettings } from "../context/SettingsContext";
import { ThemeSwatches, PersonalColorSwatches } from "./ThemeSwatches";
import { BackgroundPicker } from "./BackgroundPicker";
import { PersonalThemeTabs } from "./PersonalThemeTabs";
import { ShareWidget } from "./ShareWidget";
import { AccountWidget } from "./AccountWidget";

interface TopBarProps {
  tasksOpen: boolean;
  onToggleTasks: () => void;
  roomCode: string | null;
  onStartHosting: () => string;
  onStopHosting: () => void;
}

export function TopBar({ tasksOpen, onToggleTasks, roomCode, onStartHosting, onStopHosting }: TopBarProps) {
  const { mode, personalTheme, setMode } = useSettings();

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
            {personalTheme === "colour" ? <PersonalColorSwatches /> : <BackgroundPicker />}
          </>
        )}
        <ShareWidget roomCode={roomCode} onStartHosting={onStartHosting} onStopHosting={onStopHosting} />
        <AccountWidget />
        <button
          type="button"
          className="tasks-toggle"
          onClick={onToggleTasks}
          aria-pressed={tasksOpen}
          data-tasks-toggle
        >
          tasks
        </button>
      </div>
    </header>
  );
}
