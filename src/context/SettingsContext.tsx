import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useLocalStorage } from "../lib/storage";
import { fetchSettings, upsertSettings } from "../lib/cloudSync";
import { useAuth } from "./AuthContext";
import type { ResolvedStation } from "../lib/stations";
import type { Mode, PersonalTheme, WorkTheme } from "../types";

export interface CurrentLobby {
  id: string;
  code: string;
  name: string;
  mode: "individual" | "sync";
}

interface Settings {
  mode: Mode;
  workTheme: WorkTheme;
  personalTheme: PersonalTheme;
  personalColorTheme: WorkTheme;
  personalBg: string | null;
  activeStationId: string; // default station id, or "custom"
  customStation: ResolvedStation | null;
  personaName: string; // set once during onboarding, used as the display name everywhere
  currentLobby: CurrentLobby | null;
}

const DEFAULT_SETTINGS: Settings = {
  mode: "work",
  workTheme: "burgundy",
  personalTheme: "photo",
  personalColorTheme: "vistara",
  personalBg: null,
  activeStationId: "lofi-2",
  customStation: null,
  personaName: "",
  currentLobby: null,
};

interface SettingsContextValue extends Settings {
  setMode: (mode: Mode) => void;
  setWorkTheme: (theme: WorkTheme) => void;
  setPersonalTheme: (theme: PersonalTheme) => void;
  setPersonalColorTheme: (theme: WorkTheme) => void;
  setPersonalBg: (dataUrl: string | null) => void;
  setActiveStationId: (id: string) => void;
  setCustomStation: (station: ResolvedStation | null) => void;
  setPersonaName: (name: string) => void;
  setCurrentLobby: (lobby: CurrentLobby | null) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [storedSettings, setSettings] = useLocalStorage<Settings>("pomo:settings", DEFAULT_SETTINGS);
  // stored settings may predate fields added later (e.g. personalColorTheme) — merge over
  // defaults so a field missing from an old localStorage blob never resolves to undefined
  const settings: Settings = { ...DEFAULT_SETTINGS, ...storedSettings };
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
        setSettings({ ...settings, ...remote } as Settings);
      } else {
        void upsertSettings(user.id, settings as unknown as Record<string, unknown>);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // uses the functional setState form (merging onto `prev`, not the `settings` closed
  // over at render time) deliberately: two patch() calls can land far apart in time from
  // *different* async sources (e.g. onboarding's setPersonaName, and the ?lobby= auto-
  // join effect's setCurrentLobby resolving a moment later over the network). With a
  // plain `{...settings, ...partial}` merge, whichever call's setSettings lands second
  // would silently overwrite the first's change, since both read the same stale
  // pre-update `settings` snapshot -- exactly what caused a lobby auto-join to wipe out a
  // persona name entered just before it. The functional form always merges onto whatever
  // is actually latest at the moment each call executes, regardless of ordering.
  const patch = (partial: Partial<Settings>) => {
    setSettings((prev) => {
      const merged = { ...DEFAULT_SETTINGS, ...prev, ...partial };
      if (user) void upsertSettings(user.id, merged as unknown as Record<string, unknown>);
      return merged;
    });
  };

  const value: SettingsContextValue = {
    ...settings,
    setMode: (mode) => patch({ mode }),
    setWorkTheme: (workTheme) => patch({ workTheme }),
    setPersonalTheme: (personalTheme) => patch({ personalTheme }),
    setPersonalColorTheme: (personalColorTheme) => patch({ personalColorTheme }),
    setPersonalBg: (personalBg) => patch({ personalBg }),
    setActiveStationId: (activeStationId) => patch({ activeStationId, customStation: null }),
    setCustomStation: (customStation) =>
      patch({ customStation, activeStationId: customStation ? "custom" : settings.activeStationId }),
    setPersonaName: (personaName) => patch({ personaName }),
    setCurrentLobby: (currentLobby) => patch({ currentLobby }),
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
