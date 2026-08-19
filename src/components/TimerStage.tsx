import { useState } from "react";
import type { TimerApi } from "../hooks/useTimer";
import { FOCUS_PRESETS_MIN, formatClock } from "../lib/durations";

interface TimerStageProps {
  timer: TimerApi;
  selectedFocusMinutes: number;
  onSelectFocusMinutes: (minutes: number) => void;
  // null when the browser doesn't support Picture-in-Picture at all -- the button is
  // simply omitted rather than shown disabled
  onPopOutPip: (() => void) | null;
}

function sanitizeDigits(value: string, maxLen: number): string {
  return value.replace(/\D/g, "").slice(0, maxLen);
}

export function TimerStage({ timer, selectedFocusMinutes, onSelectFocusMinutes, onPopOutPip }: TimerStageProps) {
  const [customHours, setCustomHours] = useState("");
  const [customMinutes, setCustomMinutes] = useState("");
  const idle = timer.status === "idle";
  const openEnded = timer.targetSeconds === null;
  const displaySeconds = openEnded ? timer.elapsedSeconds : timer.remainingSeconds;

  const label = idle
    ? "ready when you are"
    : timer.phase === "focus"
      ? (timer.activeTaskTitle ?? "focus session")
      : openEnded
        ? "break — elapsed"
        : "break";

  const primaryLabel = timer.status === "running" ? "pause" : timer.status === "paused" ? "resume" : "start";

  const handlePrimary = () => {
    if (timer.status === "running") timer.pause();
    else if (timer.status === "paused") timer.resume();
    else timer.startFocus(selectedFocusMinutes);
  };

  const handleCustomSet = () => {
    const hours = Number(customHours) || 0;
    const minutes = Number(customMinutes) || 0;
    const total = hours * 60 + minutes;
    if (total <= 0) return;
    onSelectFocusMinutes(total);
    timer.setPendingMinutes(total);
    setCustomHours("");
    setCustomMinutes("");
  };

  return (
    <div className="stage-inner">
      <p className="stage-label">{label}</p>
      <p className="clock tabular">{formatClock(displaySeconds)}</p>

      <div className="controls-row">
        <button type="button" className="btn btn--primary" onClick={handlePrimary}>
          {primaryLabel}
        </button>
        <button type="button" className="btn" onClick={() => timer.stop()} disabled={idle}>
          stop
        </button>
        <button type="button" className="btn" onClick={() => timer.reset()} disabled={idle}>
          reset
        </button>
        {onPopOutPip && !idle && (
          <button type="button" className="btn" onClick={onPopOutPip} title="pop out a floating mini timer">
            pop out
          </button>
        )}
      </div>

      {idle && (
        <div className="preset-groups">
          <div className="preset-group">
            <span className="preset-group__label">focus</span>
            <div className="preset-row">
              {FOCUS_PRESETS_MIN.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className={
                    minutes === selectedFocusMinutes ? "chip chip--active" : "chip"
                  }
                  onClick={() => {
                    onSelectFocusMinutes(minutes);
                    timer.setPendingMinutes(minutes);
                  }}
                >
                  {minutes}m
                </button>
              ))}
            </div>
            <div className="custom-duration">
              <input
                className="custom-input custom-input--sm"
                inputMode="numeric"
                placeholder="hh"
                value={customHours}
                onChange={(e) => setCustomHours(sanitizeDigits(e.target.value, 2))}
                onKeyDown={(e) => e.key === "Enter" && handleCustomSet()}
              />
              <span className="custom-duration__sep">:</span>
              <input
                className="custom-input custom-input--sm"
                inputMode="numeric"
                placeholder="mm"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(sanitizeDigits(e.target.value, 2))}
                onKeyDown={(e) => e.key === "Enter" && handleCustomSet()}
              />
              <button
                type="button"
                className="chip"
                disabled={!customHours && !customMinutes}
                onClick={handleCustomSet}
              >
                set custom
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="shortcut-footer">space start/pause · r reset · s stop</p>
    </div>
  );
}
