import { useId } from "react";

interface NixieClockProps {
  value: string; // e.g. "25:00"
}

const TUBE_WIDTH = 108;
const COLON_WIDTH = 48;
const MONO_STACK = "Consolas, 'SF Mono', ui-monospace, Menlo, monospace";

export function NixieClock({ value }: NixieClockProps) {
  const uid = useId().replace(/[:]/g, "");

  let cursor = 0;
  const slots = value.split("").map((ch, i) => {
    const isColon = ch === ":";
    const width = isColon ? COLON_WIDTH : TUBE_WIDTH;
    const slot = { ch, isColon, x: cursor, width, key: `${i}-${ch}` };
    cursor += width;
    return slot;
  });
  const totalWidth = cursor;

  return (
    <svg className="nixie-clock" viewBox={`0 0 ${totalWidth} 330`} role="img" aria-label={value}>
      <defs>
        <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="14%" stopColor="rgba(255,255,255,0.32)" />
          <stop offset="24%" stopColor="rgba(255,255,255,0.06)" />
          <stop offset="72%" stopColor="rgba(255,255,255,0.02)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.16)" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`} cx="50%" cy="46%" r="55%">
          <stop offset="0%" stopColor="#ffdca6" />
          <stop offset="42%" stopColor="#ff9a3c" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ff5a1a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-baseglow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#6fb4ff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#6fb4ff" stopOpacity="0" />
        </radialGradient>
        <pattern id={`${uid}-mesh`} width="9" height="16" patternUnits="userSpaceOnUse">
          <path d="M4.5 0 L9 4 L9 12 L4.5 16 L0 12 L0 4 Z" fill="none" stroke="rgba(210,215,220,0.28)" strokeWidth="0.5" />
        </pattern>
        <filter id={`${uid}-blur`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <pattern id={`${uid}-pcb`} width="14" height="14" patternUnits="userSpaceOnUse">
          <rect width="14" height="14" fill="#141013" />
          <circle cx="2" cy="2" r="0.9" fill="rgba(210,180,140,0.35)" />
          <circle cx="9" cy="8" r="0.6" fill="rgba(150,170,190,0.25)" />
        </pattern>
      </defs>

      <rect x="0" y="262" width={totalWidth} height="30" fill={`url(#${uid}-pcb)`} />
      <rect x="0" y="262" width={totalWidth} height="30" fill="none" stroke="#000" strokeOpacity="0.4" />
      <rect x="14" y="292" width="10" height="26" rx="3" fill="#17131a" />
      <rect x={totalWidth - 24} y="292" width="10" height="26" rx="3" fill="#17131a" />

      {slots.map((slot) =>
        slot.isColon ? (
          <g key={slot.key} transform={`translate(${slot.x},0)`}>
            <line x1={slot.width / 2} y1="130" x2={slot.width / 2} y2="262" stroke="#3a3a3a" strokeWidth="1.4" />
            <circle cx={slot.width / 2} cy="150" r="7" fill="#ff7a3c" opacity="0.95" />
            <circle cx={slot.width / 2} cy="150" r="13" fill={`url(#${uid}-glow)`} />
            <circle cx={slot.width / 2} cy="185" r="7" fill="#ff7a3c" opacity="0.75" />
            <circle cx={slot.width / 2} cy="185" r="13" fill={`url(#${uid}-glow)`} opacity="0.75" />
          </g>
        ) : (
          <g key={slot.key} transform={`translate(${slot.x},0)`}>
            <ellipse cx={slot.width / 2} cy="250" rx="30" ry="20" fill={`url(#${uid}-baseglow)`} />

            {[-24, -12, 0, 12, 24].map((dx) => (
              <line
                key={dx}
                x1={slot.width / 2}
                y1="222"
                x2={slot.width / 2 + dx}
                y2="262"
                stroke="#4a4a4a"
                strokeWidth="1.2"
                opacity="0.8"
              />
            ))}

            <path
              d={`M${slot.width * 0.2},198 L${slot.width * 0.2},214 Q${slot.width * 0.2},224 ${slot.width * 0.36},226 L${slot.width * 0.64},226 Q${slot.width * 0.8},224 ${slot.width * 0.8},214 L${slot.width * 0.8},198 Z`}
              fill="#111"
              opacity="0.85"
            />

            <rect x={slot.width * 0.14} y="34" width={slot.width * 0.72} height="168" rx="6" fill="#0b0c0e" />
            <ellipse cx={slot.width / 2} cy="34" rx={slot.width * 0.36} ry="26" fill="#0b0c0e" />
            <ellipse
              cx={slot.width / 2}
              cy="9"
              rx="5"
              ry="9"
              fill="#0b0c0e"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="1"
            />

            <rect x={slot.width * 0.2} y="46" width={slot.width * 0.6} height="130" fill={`url(#${uid}-mesh)`} />
            <ellipse cx={slot.width / 2} cy="118" rx={slot.width * 0.34} ry="62" fill={`url(#${uid}-glow)`} />
            <circle cx={slot.width / 2} cy="60" r="6" fill="#3a3a3a" opacity="0.8" />

            <text
              x={slot.width / 2}
              y="150"
              textAnchor="middle"
              fontFamily={MONO_STACK}
              fontWeight="700"
              fontSize="92"
              fill="none"
              stroke="#ffb15c"
              strokeWidth="7"
              filter={`url(#${uid}-blur)`}
              opacity="0.9"
            >
              {slot.ch}
            </text>
            <text
              x={slot.width / 2}
              y="150"
              textAnchor="middle"
              fontFamily={MONO_STACK}
              fontWeight="700"
              fontSize="92"
              fill="none"
              stroke="#ffe3bb"
              strokeWidth="2.4"
            >
              {slot.ch}
            </text>

            <rect x={slot.width * 0.14} y="34" width={slot.width * 0.72} height="168" rx="6" fill={`url(#${uid}-glass)`} />
            <ellipse cx={slot.width / 2} cy="34" rx={slot.width * 0.36} ry="26" fill={`url(#${uid}-glass)`} />
            <rect
              x={slot.width * 0.14}
              y="34"
              width={slot.width * 0.72}
              height="168"
              rx="6"
              fill="none"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1.2"
            />
          </g>
        ),
      )}
    </svg>
  );
}
