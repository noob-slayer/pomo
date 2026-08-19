import { useEffect, useRef, useState } from "react";

const FLIP_HALF_MS = 200;

interface FlapDigitProps {
  value: string;
}

// simulates a real split-flap (Solari) board leaf: the top half showing the OLD
// character falls forward and away first, then a new leaf showing the NEW character's
// bottom half drops down to land -- two separate timed phases, not one continuous spin,
// which is what actually reads as "mechanical" rather than a generic card flip.
//
// the static top/bottom layers are updated exactly at each phase's start (not both at
// once) so what's revealed under each falling leaf always matches what that leaf was
// covering -- no flash of the wrong half showing through mid-flip.
function FlapDigit({ value }: FlapDigitProps) {
  const [topChar, setTopChar] = useState(value);
  const [bottomChar, setBottomChar] = useState(value);
  const [fallingOld, setFallingOld] = useState<string | null>(null);
  const [droppingNew, setDroppingNew] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value === prevValue.current) return;
    prevValue.current = value;
    timers.current.forEach((id) => window.clearTimeout(id));

    setFallingOld(topChar);
    setTopChar(value);

    const t1 = window.setTimeout(() => {
      setFallingOld(null);
      setDroppingNew(value);
      setBottomChar(value);
    }, FLIP_HALF_MS);
    const t2 = window.setTimeout(() => setDroppingNew(null), FLIP_HALF_MS * 2);
    timers.current = [t1, t2];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  return (
    <div className="flap-cell">
      <div className="flap-half flap-half--top">
        <span className="flap-glyph">{topChar}</span>
      </div>
      <div className="flap-half flap-half--bottom">
        <span className="flap-glyph flap-glyph--bottom">{bottomChar}</span>
      </div>
      {fallingOld !== null && (
        <div className="flap-leaf flap-leaf--front">
          <span className="flap-glyph">{fallingOld}</span>
        </div>
      )}
      {droppingNew !== null && (
        <div className="flap-leaf flap-leaf--back">
          <span className="flap-glyph flap-glyph--bottom">{droppingNew}</span>
        </div>
      )}
      <div className="flap-hinge" />
    </div>
  );
}

function pad2(n: number): string {
  return String(Math.max(0, n)).padStart(2, "0");
}

interface SplitFlapClockProps {
  seconds: number;
}

export function SplitFlapClock({ seconds }: SplitFlapClockProps) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const text = hours > 0 ? `${pad2(hours)}:${pad2(minutes)}:${pad2(secs)}` : `${pad2(minutes)}:${pad2(secs)}`;

  return (
    <div className="flap-board" aria-label={text} role="timer">
      {text.split("").map((ch, i) =>
        ch === ":" ? (
          <div key={`sep-${i}`} className="flap-sep" aria-hidden="true">
            :
          </div>
        ) : (
          <FlapDigit key={i} value={ch} />
        ),
      )}
    </div>
  );
}
