import { useRef, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { buildShareUrl, whatsappShareUrl } from "../lib/share";
import { useClickAway } from "../hooks/useClickAway";

interface ShareWidgetProps {
  focusMinutes: number;
}

export function ShareWidget({ focusMinutes }: ShareWidgetProps) {
  const { mode, workTheme } = useSettings();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  useClickAway(widgetRef, () => setOpen(false), open);

  const link = buildShareUrl({ m: mode, wt: mode === "work" ? workTheme : undefined, fm: focusMinutes });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked — the link is still visible in the panel to copy manually
    }
  };

  return (
    <div className="share-widget" ref={widgetRef}>
      <button
        type="button"
        className={open ? "tasks-toggle tasks-toggle--active" : "tasks-toggle"}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        share
      </button>
      {open && (
        <div className="share-panel">
          <p className="share-panel__label">share this session</p>
          <input className="share-panel__link" readOnly value={link} onFocus={(e) => e.target.select()} />
          <div className="share-panel__actions">
            <button type="button" className="chip" onClick={handleCopy}>
              {copied ? "copied" : "copy link"}
            </button>
            <a className="chip" href={whatsappShareUrl(link)} target="_blank" rel="noreferrer">
              whatsapp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
