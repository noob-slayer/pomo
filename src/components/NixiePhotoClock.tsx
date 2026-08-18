import nixiePhoto from "../assets/nixie-tubes.jpg";

interface NixiePhotoClockProps {
  value: string; // "MM:SS"
}

// tube centers, estimated as % of the photo's width/height (src/assets/nixie-tubes.jpg, 1600x1200).
// left pair of tubes ("22" in the source photo) is dimmed to look unlit; the middle and right
// pairs get our live minutes/seconds painted over their original digits.
const DIGIT_Y = 35.5;
const DIM_TUBES_X = [22.8, 32.8];
const LIVE_SLOTS_X = [46.6, 56.4, 68.9, 79.5]; // minutes tens/ones, seconds tens/ones

export function NixiePhotoClock({ value }: NixiePhotoClockProps) {
  const digits = value.replace(":", "").split("");

  // this layout only has 4 live tube slots (mm:ss) — a long custom session (100+ minutes)
  // would otherwise silently misrepresent the time, so fall back to plain glowing text.
  if (digits.length !== 4) {
    return <p className="clock tabular nixie-photo__fallback">{value}</p>;
  }

  return (
    <div className="nixie-photo">
      <img className="nixie-photo__img" src={nixiePhoto} alt="" aria-hidden="true" />

      {DIM_TUBES_X.map((x) => (
        <span key={x} className="nixie-photo__mask" style={{ left: `${x}%`, top: `${DIGIT_Y}%` }} />
      ))}

      {LIVE_SLOTS_X.map((x) => (
        <span key={`mask-${x}`} className="nixie-photo__mask" style={{ left: `${x}%`, top: `${DIGIT_Y}%` }} />
      ))}
      {LIVE_SLOTS_X.map((x, i) => (
        <span key={x} className="nixie-photo__digit" style={{ left: `${x}%`, top: `${DIGIT_Y}%` }}>
          {digits[i]}
        </span>
      ))}
    </div>
  );
}
