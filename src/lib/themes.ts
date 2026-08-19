import type { WorkTheme } from "../types";

export interface ThemeColors {
  label: string;
  bg: string;
  ink: string;
  inkMuted: string;
  line: string;
}

export const WORK_THEMES: Record<WorkTheme, ThemeColors> = {
  burgundy: { label: "burgundy", bg: "#8a234e", ink: "#f6efee", inkMuted: "rgba(246,239,238,.66)", line: "rgba(246,239,238,.3)" },
  forest: { label: "forest green", bg: "#2e4a3c", ink: "#f1f5f2", inkMuted: "rgba(241,245,242,.66)", line: "rgba(241,245,242,.3)" },
  vistara: { label: "vistara blue", bg: "#1f3a5c", ink: "#edf2f7", inkMuted: "rgba(237,242,247,.66)", line: "rgba(237,242,247,.3)" },
  slate: { label: "slate grey", bg: "#53555b", ink: "#f2f1ef", inkMuted: "rgba(242,241,239,.66)", line: "rgba(242,241,239,.3)" },
  goldenpink: { label: "golden pink", bg: "#c77e93", ink: "#2b1420", inkMuted: "rgba(43,20,32,.62)", line: "rgba(43,20,32,.28)" },
};

export const WORK_THEME_ORDER: WorkTheme[] = ["burgundy", "forest", "vistara", "slate", "goldenpink"];

// tolerant lookup: falls back to burgundy for any key that isn't a real WorkTheme
// (e.g. undefined from a localStorage/remote-settings blob predating a newer field)
export function resolveWorkTheme(key: string | undefined | null): ThemeColors {
  return (key && WORK_THEMES[key as WorkTheme]) || WORK_THEMES.burgundy;
}

export const PERSONAL_THEME: ThemeColors = {
  label: "personal",
  bg: "#181211",
  ink: "#efe6e0",
  inkMuted: "rgba(239,230,224,.6)",
  line: "rgba(239,230,224,.26)",
};

// split-flap tiles are pitch matte black -- the generic dark PERSONAL_THEME background
// leaves them with almost no contrast against the page, so this theme gets its own
// lighter, warm terminal-wall grey instead
export const SPLITFLAP_THEME: ThemeColors = {
  label: "split-flap",
  bg: "#d8d3c8",
  ink: "#1a1714",
  inkMuted: "rgba(26,23,20,.62)",
  line: "rgba(26,23,20,.22)",
};
