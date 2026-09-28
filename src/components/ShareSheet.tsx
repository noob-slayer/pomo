import { useEffect, useMemo, useRef, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { useTasks } from "../context/TasksContext";
import { computeBadges, computeStreaks } from "../lib/statsExtras";
import { resolveWorkTheme } from "../lib/themes";
import { buildLobbyUrl } from "../lib/lobby";
import {
  BADGE_EMOJI,
  cardMessage,
  renderCard,
  type CardData,
  type CardKind,
} from "../lib/shareCards";
import type { WorkTheme } from "../types";
import { IconWhatsApp } from "./icons";

interface ShareSheetProps {
  initialKind: CardKind;
  badgeId?: string;
  // names currently focusing in the active lobby (for the lobby invite card)
  focusingNames: string[];
  onClose: () => void;
}

const KIND_LABEL: Record<CardKind, string> = {
  today: "today",
  week: "this week",
  receipt: "receipt",
  badge: "badge",
  lobby: "lobby invite",
};

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function ShareSheet({ initialKind, badgeId: initialBadgeId, focusingNames, onClose }: ShareSheetProps) {
  const { mode, workTheme, personalColorTheme, personaName, currentLobby } = useSettings();
  const { history } = useTasks();
  const [kind, setKind] = useState<CardKind>(initialKind);
  // the card always uses the colour theme currently applied in the app
  const themeKey: WorkTheme = mode === "work" ? workTheme : personalColorTheme;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [needsOpen, setNeedsOpen] = useState(false);
  // only affects wording: Status can be posted from a phone, not from WhatsApp on a laptop
  const isPhone = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const pasteKey = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘V" : "Ctrl+V";
  // desktop macOS (iPadOS also reports "Macintosh", but has touch points). WhatsApp for Mac
  // doesn't register a share extension, so the macOS share sheet never lists it -- Macs go
  // straight to the WhatsApp app instead (copy the card, open the app, paste).
  const isMacDesktop =
    typeof navigator !== "undefined" && /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints === 0;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const now = useMemo(() => new Date(), []);
  const name = personaName || "a pomo friend";
  // every card links to the plain site -- the lobby code only rides along on the lobby
  // invite card, the one card whose whole point is "join this lobby". The full link goes in
  // the WhatsApp text; the card prints a shorter, protocol-less form.
  const fullLink = kind === "lobby" && currentLobby ? buildLobbyUrl(currentLobby.code) : "https://pomo.site";
  const printedLink = fullLink.replace(/^https?:\/\//, "").replace(/^www\./, "");

  const badges = useMemo(() => computeBadges(history, mode).filter((b) => b.achieved), [history, mode]);
  const [badgeId, setBadgeId] = useState<string | undefined>(initialBadgeId ?? badges[badges.length - 1]?.id);

  const kinds: CardKind[] = [
    "today",
    "week",
    "receipt",
    ...(badges.length > 0 ? (["badge"] as CardKind[]) : []),
    ...(currentLobby ? (["lobby"] as CardKind[]) : []),
  ];

  const data: CardData = useMemo(() => {
    const focus = history.filter((r) => r.mode === mode && r.phase === "focus");
    const today = focus.filter((r) => isSameDay(new Date(r.completedAt), now));
    const todayMinutes = today.reduce((s, r) => s + r.minutes, 0);

    if (kind === "week") {
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now);
        d.setDate(now.getDate() - (6 - i));
        const minutes = focus.filter((r) => isSameDay(new Date(r.completedAt), d)).reduce((s, r) => s + r.minutes, 0);
        return {
          label: d.toLocaleDateString(undefined, { weekday: "short" }).toLowerCase(),
          minutes,
          isToday: i === 6,
        };
      });
      const best = days.reduce<{ label: string; minutes: number } | null>(
        (acc, d) => (d.minutes > (acc?.minutes ?? 0) ? { label: d.label, minutes: d.minutes } : acc),
        null,
      );
      return { kind: "week", days, totalMinutes: days.reduce((s, d) => s + d.minutes, 0), best };
    }
    if (kind === "receipt") {
      const grouped = new Map<string, { title: string; count: number; minutes: number }>();
      for (const r of today) {
        const title = r.taskTitle || "focus session";
        const g = grouped.get(title) ?? { title, count: 0, minutes: 0 };
        g.count += 1;
        g.minutes += r.minutes;
        grouped.set(title, g);
      }
      return {
        kind: "receipt",
        items: [...grouped.values()].sort((a, b) => b.minutes - a.minutes),
        totalMinutes: todayMinutes,
        sessions: today.length,
      };
    }
    if (kind === "badge") {
      const b = badges.find((x) => x.id === badgeId) ?? badges[badges.length - 1];
      return {
        kind: "badge",
        label: b?.label ?? "focus badge",
        description: b?.description ?? "",
        emoji: (b && BADGE_EMOJI[b.id]) || "🏆",
      };
    }
    if (kind === "lobby") {
      return { kind: "lobby", lobbyName: currentLobby?.name ?? "my lobby", focusing: focusingNames };
    }
    return {
      kind: "today",
      minutes: todayMinutes,
      sessions: today.length,
      streak: computeStreaks(history, mode).current,
    };
  }, [kind, history, mode, now, badges, badgeId, currentLobby, focusingNames]);

  const message = cardMessage(data, fullLink);

  // re-draw on every change: a data URL for the on-screen preview (blob: URLs are blocked by
  // the site's CSP img-src), and a File for the share sheet
  useEffect(() => {
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvasRef.current = canvas;
    renderCard(canvas, data, { theme: resolveWorkTheme(themeKey), name, link: printedLink, date: now });
    setPreviewUrl(canvas.toDataURL("image/png"));
    setFile(null);
    canvas.toBlob((blob) => {
      if (blob) setFile(new File([blob], `pomo-${data.kind}.png`, { type: "image/png" }));
    }, "image/png");
    setNote(null);
  }, [data, themeKey, name, printedLink, now]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const download = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `pomo-${data.kind}.png`;
    a.click();
  };

  // WhatsApp Status only takes an image, and the web can only hand one over through the
  // system share sheet (pick WhatsApp -> "My status"). Where that isn't available (most
  // desktops), save the image instead so it can be posted from the phone.
  // api.whatsapp.com/send rather than wa.me: wa.me's redirect mangles a leading emoji into
  // a U+FFFD replacement character (confirmed), and every card message starts with one
  const canShareFiles =
    !!file && !!(navigator as Navigator & { canShare?: (d: ShareData) => boolean }).canShare?.({ files: [file] });
  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  // opens the installed WhatsApp desktop app directly, message pre-filled, chat picker shown
  const waAppUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
  const useShareSheet = canShareFiles && !isMacDesktop;

  // Phones, and laptops whose share sheet can list WhatsApp (e.g. Windows): the system share
  // sheet hands the card itself to WhatsApp -- no download, no paste.
  // Mac: the share sheet can't list WhatsApp, so copy the card and open the WhatsApp app via
  // its whatsapp:// link; the user picks a chat and pastes.
  // Anything else (e.g. Firefox, no file sharing): copy the card and open WhatsApp on the web.
  // The copy always comes first: clipboard writes only succeed while this tab has focus.
  const shareImage = async () => {
    if (!file) return;
    setNeedsOpen(false);
    if (useShareSheet) {
      try {
        await navigator.share({ files: [file], text: message });
        setNote("Shared.");
      } catch (err) {
        if ((err as DOMException).name !== "AbortError") {
          download();
          setNote("Couldn't open the share options, so the card was saved to your downloads instead.");
        }
      }
      return;
    }
    let copied = false;
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": file })]);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied) download();
    if (isMacDesktop) {
      // hand off to the app; the page stays put. We can't tell whether the app actually
      // opened, so always offer WhatsApp Web as a backup underneath.
      window.location.href = waAppUrl;
      setNeedsOpen(true);
      setNote(
        copied
          ? `Card copied. In WhatsApp, pick a chat and press ${pasteKey} to paste it.`
          : "Card saved to your downloads. Attach it in the WhatsApp chat.",
      );
      return;
    }
    // no "noopener" feature string: with it, window.open returns null even on success, so a
    // blocked popup would be indistinguishable. Sever the opener by hand instead.
    const opened = window.open(waUrl, "_blank");
    if (opened) opened.opener = null;
    setNote(
      copied
        ? `Card copied. In WhatsApp, pick a chat and press ${pasteKey} to paste it.`
        : "Card saved to your downloads. Attach it in the WhatsApp chat.",
    );
    if (!opened) setNeedsOpen(true);
  };

  // text-only fallback: a text link can't attach an image, so WhatsApp shows the site's generic
  // link preview here -- which is why the image share above is the primary action
  const sendTextOnly = () => {
    window.open(waUrl, "_blank", "noopener");
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setNote("Text copied.");
    } catch {
      setNote("Couldn't copy. Select the text above instead.");
    }
  };

  return (
    <div className="share-sheet" role="dialog" aria-modal="true" aria-label="share" onClick={onClose}>
      <div className="share-sheet__card" onClick={(e) => e.stopPropagation()}>
        <div className="share-sheet__head">
          <span className="share-sheet__title">share</span>
          <button type="button" className="share-sheet__close" onClick={onClose} aria-label="close">
            ×
          </button>
        </div>

        <div className="share-sheet__tabs" role="tablist">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              className={kind === k ? "share-sheet__tab share-sheet__tab--active" : "share-sheet__tab"}
              onClick={() => setKind(k)}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>

        {kind === "badge" && badges.length > 1 && (
          <div className="share-sheet__badges">
            {badges.map((b) => (
              <button
                key={b.id}
                type="button"
                className={b.id === badgeId ? "share-sheet__badge share-sheet__badge--active" : "share-sheet__badge"}
                onClick={() => setBadgeId(b.id)}
              >
                {BADGE_EMOJI[b.id] ?? "🏆"} {b.label}
              </button>
            ))}
          </div>
        )}

        <div className="share-sheet__preview">
          {previewUrl && <img src={previewUrl} alt={`${KIND_LABEL[kind]} share card`} />}
        </div>

        <p className="share-sheet__message">{message}</p>

        <div className="share-sheet__actions">
          <button type="button" className="share-sheet__primary" onClick={() => void shareImage()} disabled={!file}>
            <IconWhatsApp /> Share on WhatsApp
          </button>
          <button type="button" className="share-sheet__secondary" onClick={sendTextOnly}>
            <IconWhatsApp /> Send text only
          </button>
        </div>
        <p className="share-sheet__hint">
          {useShareSheet
            ? isPhone
              ? "Choose WhatsApp from your share options, then pick a chat or My Status."
              : "Choose WhatsApp from your share options, then pick a chat."
            : isMacDesktop
              ? `We'll copy the card and open the WhatsApp app. Pick a chat, then press ${pasteKey} to paste it.`
              : `Your browser can't send images to WhatsApp directly, so we'll copy the card for you to paste (${pasteKey}).`}
        </p>
        {needsOpen && (
          <a className="share-sheet__open-wa" href={waUrl} target="_blank" rel="noopener noreferrer">
            {isMacDesktop ? "App didn't open? Use WhatsApp Web →" : "Open WhatsApp →"}
          </a>
        )}
        <div className="share-sheet__minor">
          <button type="button" className="link-btn link-btn--quiet" onClick={() => void copyText()}>
            Copy text
          </button>
          <button type="button" className="link-btn link-btn--quiet" onClick={download}>
            Download image
          </button>
        </div>
        {note && <p className="share-sheet__note">{note}</p>}
      </div>
    </div>
  );
}
