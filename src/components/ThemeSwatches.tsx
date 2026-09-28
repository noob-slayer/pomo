import { useLayoutEffect, useRef, useState } from "react";
import { EXTRA_THEME_ORDER, WORK_THEMES, WORK_THEME_ORDER } from "../lib/themes";
import { useSettings } from "../context/SettingsContext";
import { useClickAway } from "../hooks/useClickAway";
import type { WorkTheme } from "../types";

interface ThemeSwatchesProps {
  value: WorkTheme;
  onChange: (theme: WorkTheme) => void;
  label: string;
}

function Swatches({ value, onChange, label }: ThemeSwatchesProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuShift, setMenuShift] = useState(0);
  useClickAway(moreRef, () => setMoreOpen(false), moreOpen);

  // the menu hangs off the pill's right edge, which on a phone can push it past the left side
  // of the screen -- nudge it back inside the viewport (8px gutter) once it's measured
  useLayoutEffect(() => {
    if (!moreOpen) {
      setMenuShift(0);
      return;
    }
    const r = menuRef.current?.getBoundingClientRect();
    if (!r) return;
    const gutter = 8;
    if (r.left < gutter) setMenuShift(gutter - r.left);
    else if (r.right > window.innerWidth - gutter) setMenuShift(window.innerWidth - gutter - r.right);
  }, [moreOpen]);
  const activeExtra = EXTRA_THEME_ORDER.includes(value) ? WORK_THEMES[value] : null;

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

      {/* the premium collection lives behind a dropdown so the topbar stays five dots wide.
          When one of these is active the pill shows it, so the current colour is always
          visible even with the dropdown closed. */}
      <div className="swatch-more" ref={moreRef}>
        <button
          type="button"
          className={`swatch-more__toggle${activeExtra ? " swatch-more__toggle--active" : ""}`}
          aria-haspopup="true"
          aria-expanded={moreOpen}
          title={activeExtra ? activeExtra.label : "more colours"}
          onClick={() => setMoreOpen((v) => !v)}
        >
          {activeExtra && <span className="swatch-more__current" style={{ background: activeExtra.bg }} />}
          more ▾
        </button>
        {moreOpen && (
          <div
            ref={menuRef}
            className="swatch-more__menu"
            role="radiogroup"
            aria-label={`${label} — more colours`}
            style={menuShift ? { transform: `translateX(${menuShift}px)` } : undefined}
          >
            {EXTRA_THEME_ORDER.map((key) => {
              const theme = WORK_THEMES[key];
              const active = key === value;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`swatch-more__item${active ? " swatch-more__item--active" : ""}`}
                  onClick={() => {
                    onChange(key);
                    setMoreOpen(false);
                  }}
                >
                  <span
                    className="swatch-more__dot"
                    style={{ background: theme.sheen ? `${theme.sheen}, ${theme.bg}` : theme.bg }}
                  />
                  {theme.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
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
