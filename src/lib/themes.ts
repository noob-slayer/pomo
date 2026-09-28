import type { WorkTheme } from "../types";

export interface ThemeColors {
  label: string;
  bg: string;
  ink: string;
  inkMuted: string;
  line: string;
  // optional layered gradient drawn over `bg` on the stage -- gives the "more" collection a
  // soft metallic glint and vignette instead of a flat fill
  sheen?: string;
}

// dark jewel tones get a warm gold glint top-right and a soft vignette bottom-left; the
// light metallics get a brighter highlight instead, so the glint reads on a pale ground
const JEWEL_SHEEN =
  "radial-gradient(120% 85% at 88% 0%, rgba(212,175,55,0.16), transparent 55%), radial-gradient(90% 70% at 0% 100%, rgba(0,0,0,0.28), transparent 60%)";
const METAL_SHEEN =
  "radial-gradient(120% 85% at 88% 0%, rgba(255,255,255,0.32), transparent 55%), radial-gradient(90% 70% at 0% 100%, rgba(0,0,0,0.12), transparent 60%)";

function light(ink: string): Pick<ThemeColors, "ink" | "inkMuted" | "line"> {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16));
  return { ink, inkMuted: `rgba(${r},${g},${b},.66)`, line: `rgba(${r},${g},${b},.3)` };
}
function dark(ink: string): Pick<ThemeColors, "ink" | "inkMuted" | "line"> {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16));
  return { ink, inkMuted: `rgba(${r},${g},${b},.62)`, line: `rgba(${r},${g},${b},.28)` };
}

export const WORK_THEMES: Record<WorkTheme, ThemeColors> = {
  burgundy: { label: "burgundy", bg: "#8a234e", ink: "#f6efee", inkMuted: "rgba(246,239,238,.66)", line: "rgba(246,239,238,.3)" },
  forest: { label: "forest green", bg: "#2e4a3c", ink: "#f1f5f2", inkMuted: "rgba(241,245,242,.66)", line: "rgba(241,245,242,.3)" },
  vistara: { label: "vistara blue", bg: "#1f3a5c", ink: "#edf2f7", inkMuted: "rgba(237,242,247,.66)", line: "rgba(237,242,247,.3)" },
  slate: { label: "slate grey", bg: "#53555b", ink: "#f2f1ef", inkMuted: "rgba(242,241,239,.66)", line: "rgba(242,241,239,.3)" },
  goldenpink: { label: "golden pink", bg: "#c77e93", ink: "#2b1420", inkMuted: "rgba(43,20,32,.62)", line: "rgba(43,20,32,.28)" },

  sapphire: { label: "royal sapphire", bg: "#1b3a7a", ...light("#eef2fb"), sheen: JEWEL_SHEEN },
  imperial: { label: "imperial purple", bg: "#4a2670", ...light("#f3eef9"), sheen: JEWEL_SHEEN },
  emerald: { label: "emerald", bg: "#0d5943", ...light("#eaf6f0"), sheen: JEWEL_SHEEN },
  oxblood: { label: "oxblood", bg: "#5a171d", ...light("#f8ecec"), sheen: JEWEL_SHEEN },
  midnight: { label: "midnight navy", bg: "#111a32", ...light("#e9edf7"), sheen: JEWEL_SHEEN },
  aubergine: { label: "aubergine", bg: "#3c1c34", ...light("#f6eaf1"), sheen: JEWEL_SHEEN },
  peacock: { label: "peacock teal", bg: "#0c4d5a", ...light("#e7f4f6"), sheen: JEWEL_SHEEN },
  mahogany: { label: "mahogany", bg: "#692c1c", ...light("#f8eee8"), sheen: JEWEL_SHEEN },
  onyx: { label: "onyx", bg: "#19191c", ...light("#efe9df"), sheen: JEWEL_SHEEN },
  antiquegold: { label: "antique gold", bg: "#a57d2e", ...dark("#1d1505"), sheen: METAL_SHEEN },
  champagne: { label: "champagne", bg: "#dac6a3", ...dark("#2a2013"), sheen: METAL_SHEEN },
  rosegold: { label: "rose gold", bg: "#b8707a", ...dark("#2a1317"), sheen: METAL_SHEEN },
};

export const WORK_THEME_ORDER: WorkTheme[] = ["burgundy", "forest", "vistara", "slate", "goldenpink"];

// the "more" dropdown, after the five main swatches
export const EXTRA_THEME_ORDER: WorkTheme[] = [
  "sapphire",
  "imperial",
  "emerald",
  "oxblood",
  "midnight",
  "aubergine",
  "peacock",
  "mahogany",
  "onyx",
  "antiquegold",
  "champagne",
  "rosegold",
];

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
