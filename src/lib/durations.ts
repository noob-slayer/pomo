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

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

// minutes -> "1h 35m" / "45m" / "0m", for compact stat readouts
export function formatDuration(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}
