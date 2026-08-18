import { useSettings } from "../context/SettingsContext";
import type { PersonalTheme } from "../types";

const TABS: { value: PersonalTheme; label: string }[] = [
  { value: "photo", label: "photo" },
  { value: "reveal", label: "reveal" },
];

export function PersonalThemeTabs() {
  const { personalTheme, setPersonalTheme } = useSettings();

  return (
    <div className="theme-tabs" role="radiogroup" aria-label="personal theme">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="radio"
          aria-checked={personalTheme === tab.value}
          className={personalTheme === tab.value ? "theme-tabs__item theme-tabs__item--active" : "theme-tabs__item"}
          onClick={() => setPersonalTheme(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
