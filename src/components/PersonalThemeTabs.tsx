import { useRef, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { useClickAway } from "../hooks/useClickAway";
import type { PersonalTheme } from "../types";

// "colour" stays a direct, always-visible option (same treatment as work mode's
// palette). Everything more playful lives behind "make it fun" instead of crowding the
// top-level row -- photo and reveal today, with room to add more without the tab row
// growing unbounded.
const FUN_OPTIONS: { value: PersonalTheme; label: string }[] = [
  { value: "photo", label: "photo" },
  { value: "reveal", label: "reveal" },
];

export function PersonalThemeTabs() {
  const { personalTheme, setPersonalTheme } = useSettings();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickAway(menuRef, () => setOpen(false), open);

  const activeFunOption = FUN_OPTIONS.find((o) => o.value === personalTheme);

  return (
    <div className="theme-tabs" role="group" aria-label="personal theme">
      <button
        type="button"
        className={personalTheme === "colour" ? "theme-tabs__item theme-tabs__item--active" : "theme-tabs__item"}
        onClick={() => setPersonalTheme("colour")}
      >
        colour
      </button>
      <div className="fun-menu" ref={menuRef}>
        <button
          type="button"
          className={activeFunOption ? "theme-tabs__item theme-tabs__item--active" : "theme-tabs__item"}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {activeFunOption ? activeFunOption.label : "make it fun"} ▾
        </button>
        {open && (
          <div className="fun-menu__panel">
            {FUN_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={personalTheme === opt.value ? "fun-menu__item fun-menu__item--active" : "fun-menu__item"}
                onClick={() => {
                  setPersonalTheme(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
