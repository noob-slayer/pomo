import { useSettings } from "../context/SettingsContext";
import { ThemeSwatches, PersonalColorSwatches } from "./ThemeSwatches";
import { BackgroundPicker } from "./BackgroundPicker";
import { YtLinkForm } from "./YtLinkForm";
import { PersonalThemeTabs } from "./PersonalThemeTabs";
import { LobbyWidget } from "./LobbyWidget";
import { AccountWidget } from "./AccountWidget";

interface TopBarProps {
  tasksOpen: boolean;
  onToggleTasks: () => void;
  onOpenStats: () => void;
  onOpenTeamStats: () => void;
}

export function TopBar({ tasksOpen, onToggleTasks, onOpenStats, onOpenTeamStats }: TopBarProps) {
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
            {personalTheme === "colour" ? (
              <PersonalColorSwatches />
            ) : personalTheme === "photo" ? (
              <BackgroundPicker />
            ) : personalTheme === "yt" ? (
              <YtLinkForm />
            ) : null}
          </>
        )}
        <LobbyWidget onOpenTeamStats={onOpenTeamStats} />
        <AccountWidget onOpenStats={onOpenStats} />
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
