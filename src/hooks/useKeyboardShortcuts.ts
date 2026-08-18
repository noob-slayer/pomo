import { useEffect } from "react";

interface Shortcuts {
  onToggle: () => void;
  onReset: () => void;
  onStop: () => void;
}

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function useKeyboardShortcuts({ onToggle, onReset, onStop }: Shortcuts) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (TYPING_TAGS.has(target.tagName) || target.isContentEditable)) return;

      switch (event.key) {
        case " ":
          event.preventDefault();
          onToggle();
          break;
        case "r":
        case "R":
          onReset();
          break;
        case "s":
        case "S":
        case "Escape":
          onStop();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggle, onReset, onStop]);
}
