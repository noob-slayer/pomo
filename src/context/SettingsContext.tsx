import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useLocalStorage } from "../lib/storage";
import { fetchSettings, upsertSettings } from "../lib/cloudSync";
import { useAuth } from "./AuthContext";
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
  const { user } = useAuth();
  const [settings, setSettings] = useLocalStorage<Settings>("pomo:settings", DEFAULT_SETTINGS);
  const syncedForUser = useRef<string | null>(null);

  // on sign-in: pull synced settings (everything but personalBg, which stays per-device),
  // or push local settings up as the starting point if this account has none saved yet.
  useEffect(() => {
    if (!user) return;
    if (syncedForUser.current === user.id) return;
    let cancelled = false;

    (async () => {
      const remote = await fetchSettings(user.id);
      if (cancelled) return;
      syncedForUser.current = user.id;

      if (remote) {
        setSettings((prev) => ({ ...prev, ...remote }) as Settings);
      } else {
        void upsertSettings(user.id, settings as unknown as Record<string, unknown>);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const patch = (partial: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      if (user) void upsertSettings(user.id, next as unknown as Record<string, unknown>);
      return next;
    });
  };

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
