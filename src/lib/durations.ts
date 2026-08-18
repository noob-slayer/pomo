export const FOCUS_PRESETS_MIN = [5, 10, 15, 25, 40];
export const DEFAULT_FOCUS_MIN = 25;

export interface BreakPreset {
  label: string;
  minutes: number | null; // null = open-ended, "till i resume"
}

export const BREAK_PRESETS: BreakPreset[] = [
  { label: "5 min", minutes: 5 },
  { label: "10 min", minutes: 10 },
  { label: "15 min", minutes: 15 },
  { label: "till i resume", minutes: null },
];

export type Period = "am" | "pm";

export const HOUR_OPTIONS_12: number[] = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
export const MINUTE_OPTIONS: string[] = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

export interface TimeParts {
  hour12: string; // "1".."12", or "" if unset
  minute: string; // "00" etc, or "" if unset
  period: Period;
}

// composes 12-hour parts into a stored "HH:MM" 24-hour value
export function partsToValue(parts: TimeParts): string | null {
  if (!parts.hour12 || !parts.minute) return null;
  let h24 = Number(parts.hour12) % 12;
  if (parts.period === "pm") h24 += 12;
  return `${String(h24).padStart(2, "0")}:${parts.minute}`;
}

// nearest 5-minute mark, expressed directly as 12-hour parts, for auto-suggesting "now"
export function nearestTimeParts(stepMinutes = 5, date: Date = new Date()): TimeParts {
  const totalMinutes = date.getHours() * 60 + date.getMinutes();
  const rounded = Math.round(totalMinutes / stepMinutes) * stepMinutes;
  const wrapped = ((rounded % (24 * 60)) + 24 * 60) % (24 * 60);
  const h24 = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const period: Period = h24 < 12 ? "am" : "pm";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { hour12: String(h12), minute: String(m).padStart(2, "0"), period };
}

// stored "HH:MM" 24-hour value -> display label, e.g. "1:30pm"
export function timeLabel(value: string | null): string | null {
  if (!value) return null;
  const [hStr, mStr] = value.split(":");
  const h24 = Number(hStr);
  const period: Period = h24 < 12 ? "am" : "pm";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mStr}${period}`;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
