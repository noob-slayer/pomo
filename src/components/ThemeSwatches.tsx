import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { EXTRA_THEME_ORDER, WORK_THEMES, WORK_THEME_ORDER } from "../lib/themes";
import { useSettings } from "../context/SettingsContext";
import { useClickAway } from "../hooks/useClickAway";
import type { WorkTheme } from "../types";

interface ThemeSwatchesProps {
  value: WorkTheme;
  onChange: (theme: WorkTheme) => void;
  label: string;
  className?: string;
}

function Swatches({ value, onChange, label, className }: ThemeSwatchesProps) {
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
  const current = WORK_THEMES[value];
  // on phones the five dots are hidden and this one circle stands for the current colour,
  // opening a menu that lists every colour (the base five included, see --base items)
  const toggleVars = { "--swatch-current": current.bg, "--swatch-current-ink": current.ink } as CSSProperties;

  return (
    <div className={className ? `swatches ${className}` : "swatches"} role="radiogroup" aria-label={label}>
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
        {/* same size as the swatches: an empty ring with a ▾, filled with the chosen colour
            once one from this collection is active */}
        <button
          type="button"
          className={`swatch swatch-more__toggle${activeExtra ? " swatch--active" : ""}`}
          style={activeExtra ? { ...toggleVars, background: activeExtra.bg, color: activeExtra.ink } : toggleVars}
          aria-haspopup="true"
          aria-expanded={moreOpen}
          aria-label={activeExtra ? `more colours (current: ${activeExtra.label})` : "more colours"}
          title={activeExtra ? activeExtra.label : "more colours"}
          onClick={() => setMoreOpen((v) => !v)}
        >
          {/* an svg chevron rather than the "▾" glyph, which sits below centre in most fonts */}
          <svg viewBox="0 0 12 8" width="10" height="7" aria-hidden="true">
            <path d="M1.5 1.8 6 6.2l4.5-4.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {moreOpen && (
          <div
            ref={menuRef}
            className="swatch-more__menu"
            role="radiogroup"
            aria-label={`${label} — more colours`}
            style={menuShift ? { transform: `translateX(${menuShift}px)` } : undefined}
          >
            {[...WORK_THEME_ORDER, ...EXTRA_THEME_ORDER].map((key) => {
              const theme = WORK_THEMES[key];
              const active = key === value;
              const base = WORK_THEME_ORDER.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`swatch-more__item${base ? " swatch-more__item--base" : ""}${active ? " swatch-more__item--active" : ""}`}
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

// phoneOnly: a fun theme is active -- desktop hides this (its "colour" tab is the way back),
// phones keep it as the colour picker, so picking a colour here also switches to "colour"
export function PersonalColorSwatches({ phoneOnly = false }: { phoneOnly?: boolean }) {
  const { personalColorTheme, setPersonalColorTheme, setPersonalTheme } = useSettings();
  return (
    <Swatches
      value={personalColorTheme}
      onChange={(theme) => {
        setPersonalColorTheme(theme);
        setPersonalTheme("colour");
      }}
      label="personal color theme"
      className={phoneOnly ? "swatches--phone-only" : undefined}
    />
  );
}
