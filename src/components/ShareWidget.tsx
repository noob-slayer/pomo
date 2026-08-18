import { useEffect, useRef, useState } from "react";
import { whatsappShareUrl } from "../lib/share";
import { buildRoomUrl } from "../lib/liveSession";
import { useClickAway } from "../hooks/useClickAway";

interface ShareWidgetProps {
  roomCode: string | null;
  onStartHosting: () => string;
  onStopHosting: () => void;
}

export function ShareWidget({ roomCode, onStartHosting, onStopHosting }: ShareWidgetProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  useClickAway(widgetRef, () => setOpen(false), open);

  // one link, always live: opening the panel starts (or reuses) the session
  useEffect(() => {
    if (open && !roomCode) onStartHosting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const roomLink = roomCode ? buildRoomUrl(roomCode) : null;

  const copyLink = async () => {
    if (!roomLink) return;
    try {
      await navigator.clipboard.writeText(roomLink);
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
          <p className="share-panel__label">
            share this session — anyone with the link watches your timer (and hears your music) live
          </p>
          <input
            className="share-panel__link"
            readOnly
            value={roomLink ?? "starting…"}
            onFocus={(e) => e.target.select()}
          />
          <div className="share-panel__actions">
            <button type="button" className="chip" disabled={!roomLink} onClick={copyLink}>
              {copied ? "copied" : "copy link"}
            </button>
            <a
              className="chip"
              href={roomLink ? whatsappShareUrl(roomLink) : undefined}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!roomLink}
            >
              whatsapp
            </a>
            <button type="button" className="chip" onClick={onStopHosting}>
              end
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
