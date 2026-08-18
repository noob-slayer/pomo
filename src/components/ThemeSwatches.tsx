import { WORK_THEMES, WORK_THEME_ORDER } from "../lib/themes";
import { useSettings } from "../context/SettingsContext";

export function ThemeSwatches() {
  const { workTheme, setWorkTheme } = useSettings();

  return (
    <div className="swatches" role="radiogroup" aria-label="work theme">
      {WORK_THEME_ORDER.map((key) => {
        const theme = WORK_THEMES[key];
        const active = key === workTheme;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            title={theme.label}
            className={`swatch${active ? " swatch--active" : ""}`}
            style={{ background: theme.bg }}
            onClick={() => setWorkTheme(key)}
          />
        );
      })}
    </div>
  );
}
