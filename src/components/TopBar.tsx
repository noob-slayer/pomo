import { useSettings } from "../context/SettingsContext";
import { ThemeSwatches, PersonalColorSwatches } from "./ThemeSwatches";
import { BackgroundPicker } from "./BackgroundPicker";
import { YtLinkForm } from "./YtLinkForm";
import { PersonalThemeTabs } from "./PersonalThemeTabs";
import { LobbyWidget } from "./LobbyWidget";
import { AccountWidget } from "./AccountWidget";
import { IconTasks } from "./icons";

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
            {/* always rendered, but outside "colour" it's shown only on phones -- there the
                "colour" tab is dropped and this circle doubles as it (see PersonalColorSwatches) */}
            <PersonalColorSwatches phoneOnly={personalTheme !== "colour"} />
            {personalTheme === "photo" ? (
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
          aria-label="tasks"
        >
          <span className="topbar-btn__icon">
            <IconTasks />
          </span>
          <span className="topbar-btn__label">tasks</span>
        </button>
      </div>
    </header>
  );
}
