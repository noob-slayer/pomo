import { useRef, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { buildShareUrl, whatsappShareUrl } from "../lib/share";
import { buildRoomUrl } from "../lib/liveSession";
import { useClickAway } from "../hooks/useClickAway";

interface ShareWidgetProps {
  focusMinutes: number;
  roomCode: string | null;
  onStartHosting: () => string;
  onStopHosting: () => void;
}

export function ShareWidget({ focusMinutes, roomCode, onStartHosting, onStopHosting }: ShareWidgetProps) {
  const { mode, workTheme } = useSettings();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"settings" | "room" | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  useClickAway(widgetRef, () => setOpen(false), open);

  const link = buildShareUrl({ m: mode, wt: mode === "work" ? workTheme : undefined, fm: focusMinutes });
  const roomLink = roomCode ? buildRoomUrl(roomCode) : null;

  const copyLink = async (value: string, which: "settings" | "room") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
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
            <button type="button" className="chip" onClick={() => copyLink(link, "settings")}>
              {copied === "settings" ? "copied" : "copy link"}
            </button>
            <a className="chip" href={whatsappShareUrl(link)} target="_blank" rel="noreferrer">
              whatsapp
            </a>
          </div>

          <p className="share-panel__label share-panel__label--live">live session</p>
          {roomLink ? (
            <>
              <input className="share-panel__link" readOnly value={roomLink} onFocus={(e) => e.target.select()} />
              <div className="share-panel__actions">
                <button type="button" className="chip" onClick={() => copyLink(roomLink, "room")}>
                  {copied === "room" ? "copied" : "copy link"}
                </button>
                <a className="chip" href={whatsappShareUrl(roomLink)} target="_blank" rel="noreferrer">
                  whatsapp
                </a>
                <button type="button" className="chip" onClick={onStopHosting}>
                  end
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="share-panel__cta" onClick={onStartHosting}>
              go live
            </button>
          )}
        </div>
      )}
    </div>
  );
}
