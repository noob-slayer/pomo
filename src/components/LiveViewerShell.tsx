import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { joinRoom, type LiveTick } from "../lib/liveSession";
import { PERSONAL_THEME, resolveWorkTheme } from "../lib/themes";
import { formatClock } from "../lib/durations";
import { stationEmbedSrc } from "../lib/stations";
import { Credit } from "./Credit";

interface LiveViewerShellProps {
  roomCode: string;
}

export function LiveViewerShell({ roomCode }: LiveViewerShellProps) {
  const [tick, setTick] = useState<LiveTick | null>(null);
  const [connStatus, setConnStatus] = useState<string>("connecting");
  const [audioStarted, setAudioStarted] = useState(false);
  const [displaySeconds, setDisplaySeconds] = useState(0);

  useEffect(() => {
    const channel = joinRoom(roomCode, setTick, setConnStatus);
    return () => {
      channel?.unsubscribe();
    };
  }, [roomCode]);

  // a broadcast tick only arrives roughly once a second (and Realtime delivery can jitter
  // or lag), so mirroring tick.remainingSeconds directly left the displayed clock frozen
  // between broadcasts -- visibly "slow to refresh". Anchoring to a local wall-clock
  // target on every fresh tick and re-deriving the display every second locally (the same
  // approach the host's own useTimer uses) gives a smooth per-second countdown regardless
  // of broadcast cadence, and self-corrects the instant a new tick arrives.
  useEffect(() => {
    if (!tick) return;
    if (tick.status !== "running") {
      setDisplaySeconds(tick.targetSeconds === null ? tick.elapsedSeconds : tick.remainingSeconds);
      return;
    }
    const endAt = tick.targetSeconds === null ? null : Date.now() + tick.remainingSeconds * 1000;
    const startedAt = tick.targetSeconds === null ? Date.now() - tick.elapsedSeconds * 1000 : null;
    const recompute = () => {
      if (tick.targetSeconds === null) {
        if (startedAt !== null) setDisplaySeconds(Math.floor((Date.now() - startedAt) / 1000));
      } else if (endAt !== null) {
        setDisplaySeconds(Math.max(0, Math.round((endAt - Date.now()) / 1000)));
      }
    };
    recompute();
    const id = setInterval(recompute, 1000);
    const onWake = () => {
      if (document.visibilityState === "visible") recompute();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [tick]);

  const theme = tick && tick.mode === "work" ? resolveWorkTheme(tick.workTheme) : PERSONAL_THEME;

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

  return (
    <div className="shell" style={themeVars}>
      <header className="topbar">
        <div className="topbar-left">
          <span className="wordmark">pomo</span>
          <span className="mode-switch__item">live session</span>
        </div>
      </header>
      <main className="stage">
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
      <Credit />
    </div>
  );
}
