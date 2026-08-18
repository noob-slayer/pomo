import { BREAK_PRESETS } from "../lib/durations";
import type { Phase } from "../types";

interface SessionPromptProps {
  stage: "choice" | "break-picker";
  phase: Phase;
  onContinue: () => void;
  onChooseBreak: () => void;
  onStartBreak: (minutes: number | null) => void;
  onDismiss: () => void;
}

export function SessionPrompt({
  stage,
  phase,
  onContinue,
  onChooseBreak,
  onStartBreak,
  onDismiss,
}: SessionPromptProps) {
  return (
    <div className="session-prompt" onClick={onDismiss}>
      <div className="session-prompt__card" onClick={(e) => e.stopPropagation()}>
        {stage === "choice" ? (
          <>
            <p className="session-prompt__title">
              {phase === "focus" ? "focus session done" : "break's over"}
            </p>
            <div className="session-prompt__actions">
              <button type="button" className="btn btn--primary" onClick={onContinue}>
                continue
              </button>
              <button type="button" className="btn" onClick={onChooseBreak}>
                take a break
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="session-prompt__title">how long?</p>
            <div className="preset-row session-prompt__actions">
              {BREAK_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="chip"
                  onClick={() => onStartBreak(preset.minutes)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
