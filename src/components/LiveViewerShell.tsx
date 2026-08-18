import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { joinRoom, type LiveTick } from "../lib/liveSession";
import { WORK_THEMES, PERSONAL_THEME } from "../lib/themes";
import { formatClock } from "../lib/durations";
import { stationEmbedSrc } from "../lib/stations";

interface LiveViewerShellProps {
  roomCode: string;
}

export function LiveViewerShell({ roomCode }: LiveViewerShellProps) {
  const [tick, setTick] = useState<LiveTick | null>(null);
  const [connStatus, setConnStatus] = useState<string>("connecting");
  const [audioStarted, setAudioStarted] = useState(false);

  useEffect(() => {
    const channel = joinRoom(roomCode, setTick, setConnStatus);
    return () => {
      channel?.unsubscribe();
    };
  }, [roomCode]);

  const theme = tick && tick.mode === "work" ? WORK_THEMES[tick.workTheme ?? "burgundy"] : PERSONAL_THEME;

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

  const label = !tick
    ? connStatus === "SUBSCRIBED"
      ? "waiting for the host to start…"
      : "connecting…"
    : `watching ${tick.taskTitle ?? (tick.phase === "focus" ? "a focus session" : "a break")}`;

  const displaySeconds = tick ? (tick.targetSeconds === null ? tick.elapsedSeconds : tick.remainingSeconds) : 0;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-left">
          <span className="wordmark">pomo</span>
          <span className="mode-switch__item">live session</span>
        </div>
      </header>
      <main className="stage" style={themeVars}>
        <div className="stage-inner">
          <p className="stage-label">{label}</p>
          <p className="clock tabular">{formatClock(displaySeconds)}</p>
          <p className="shortcut-footer">room {roomCode} · read-only</p>
        </div>
      </main>

      {tick && (
        <div className="yt-widget">
          <button
            type="button"
            className="yt-toggle"
            onClick={() => setAudioStarted((v) => !v)}
            aria-pressed={audioStarted}
            aria-label={`music: ${tick.station.label}`}
            title={tick.station.label}
          >
            <svg className="yt-toggle__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 7.5v9l7.5-4.5-7.5-4.5Z" fill="currentColor" />
            </svg>
          </button>
          {audioStarted && (
            <iframe
              className="yt-frame yt-frame--visible"
              src={stationEmbedSrc(tick.station)}
              title="focus audio"
              allow="autoplay; encrypted-media"
            />
          )}
        </div>
      )}
    </div>
  );
}
