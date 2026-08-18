import { WORK_THEMES, WORK_THEME_ORDER } from "../lib/themes";
import { useSettings } from "../context/SettingsContext";
import type { WorkTheme } from "../types";

interface ThemeSwatchesProps {
  value: WorkTheme;
  onChange: (theme: WorkTheme) => void;
  label: string;
}

function Swatches({ value, onChange, label }: ThemeSwatchesProps) {
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {WORK_THEME_ORDER.map((key) => {
        const theme = WORK_THEMES[key];
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            title={theme.label}
            className={`swatch${active ? " swatch--active" : ""}`}
            style={{ background: theme.bg }}
            onClick={() => onChange(key)}
          />
        );
      })}
    </div>
  );
}

export function ThemeSwatches() {
  const { workTheme, setWorkTheme } = useSettings();
  return <Swatches value={workTheme} onChange={setWorkTheme} label="work theme" />;
}

export function PersonalColorSwatches() {
  const { personalColorTheme, setPersonalColorTheme } = useSettings();
  return <Swatches value={personalColorTheme} onChange={setPersonalColorTheme} label="personal color theme" />;
}
