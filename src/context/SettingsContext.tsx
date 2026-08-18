import { createContext, useContext, type ReactNode } from "react";
import { useLocalStorage } from "../lib/storage";
import type { Mode, PersonalTheme, WorkTheme } from "../types";

interface CustomStation {
  type: "video" | "playlist";
  id: string;
  label: string;
}

interface Settings {
  mode: Mode;
  workTheme: WorkTheme;
  personalTheme: PersonalTheme;
  personalBg: string | null;
  activeStationId: string; // default station id, or "custom"
  customStation: CustomStation | null;
}

const DEFAULT_SETTINGS: Settings = {
  mode: "work",
  workTheme: "burgundy",
  personalTheme: "photo",
  personalBg: null,
  activeStationId: "lofi-2",
  customStation: null,
};

interface SettingsContextValue extends Settings {
  setMode: (mode: Mode) => void;
  setWorkTheme: (theme: WorkTheme) => void;
  setPersonalTheme: (theme: PersonalTheme) => void;
  setPersonalBg: (dataUrl: string | null) => void;
  setActiveStationId: (id: string) => void;
  setCustomStation: (station: CustomStation | null) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useLocalStorage<Settings>("pomo:settings", DEFAULT_SETTINGS);

  const patch = (partial: Partial<Settings>) => setSettings((prev) => ({ ...prev, ...partial }));

  const value: SettingsContextValue = {
    ...settings,
    setMode: (mode) => patch({ mode }),
    setWorkTheme: (workTheme) => patch({ workTheme }),
    setPersonalTheme: (personalTheme) => patch({ personalTheme }),
    setPersonalBg: (personalBg) => patch({ personalBg }),
    setActiveStationId: (activeStationId) => patch({ activeStationId, customStation: null }),
    setCustomStation: (customStation) =>
      patch({ customStation, activeStationId: customStation ? "custom" : settings.activeStationId }),
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
