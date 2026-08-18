import { useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useClickAway } from "../hooks/useClickAway";
import { resolveIdentityKey } from "../lib/identity";
import { createLobby, findLobbyByCode, joinLobby, leaveLobby, buildLobbyUrl } from "../lib/lobby";
import { whatsappShareUrl } from "../lib/share";

type PanelView = "menu" | "create" | "join";

export function LobbyWidget() {
  const { user } = useAuth();
  const { personaName, currentLobby, setCurrentLobby } = useSettings();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PanelView>("menu");
  const [nameInput, setNameInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  useClickAway(widgetRef, () => setOpen(false), open);

  const identityKey = resolveIdentityKey(user?.id ?? null);
  const displayName = personaName || "guest";

  const handleCreate = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    const lobby = await createLobby(trimmed, identityKey, displayName);
    setBusy(false);
    if (!lobby) {
      setError("couldn't create the lobby — try again");
      return;
    }
    setCurrentLobby({ id: lobby.id, code: lobby.code, name: lobby.name });
    setNameInput("");
    setView("menu");
  };

  const handleJoin = async () => {
    const trimmed = codeInput.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    const lobby = await findLobbyByCode(trimmed);
    if (!lobby) {
      setBusy(false);
      setError("no lobby found for that code");
      return;
    }
    await joinLobby(lobby.id, identityKey, displayName);
    setBusy(false);
    setCurrentLobby({ id: lobby.id, code: lobby.code, name: lobby.name });
    setCodeInput("");
    setView("menu");
  };

  const handleLeave = async () => {
    if (!currentLobby) return;
    await leaveLobby(currentLobby.id, identityKey);
    setCurrentLobby(null);
    setView("menu");
  };

  const lobbyLink = currentLobby ? buildLobbyUrl(currentLobby.code) : null;

  const copyLink = async () => {
    if (!lobbyLink) return;
    try {
      await navigator.clipboard.writeText(lobbyLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked — the link is still visible in the panel to copy manually
    }
  };

  return (
    <div className="lobby-widget" ref={widgetRef}>
      <button
        type="button"
        className={open ? "tasks-toggle tasks-toggle--active" : "tasks-toggle"}
        onClick={() => {
          setOpen((v) => !v);
          setError(null);
        }}
        aria-expanded={open}
      >
        {currentLobby ? currentLobby.name : "lobby"}
      </button>
      {open && (
        <div className="lobby-panel">
          {currentLobby ? (
            <>
              <p className="lobby-panel__label">
                {currentLobby.name} — share the link so others can join as themselves, running their own timers
              </p>
              <input
                className="lobby-panel__link"
                readOnly
                value={lobbyLink ?? ""}
                onFocus={(e) => e.target.select()}
              />
              <div className="lobby-panel__actions">
                <button type="button" className="chip" onClick={copyLink}>
                  {copied ? "copied" : "copy link"}
                </button>
                <a className="chip" href={whatsappShareUrl(lobbyLink ?? "")} target="_blank" rel="noreferrer">
                  whatsapp
                </a>
                <button type="button" className="chip" onClick={() => void handleLeave()}>
                  leave
                </button>
              </div>
            </>
          ) : view === "menu" ? (
            <>
              <p className="lobby-panel__label">group up — everyone keeps their own timer, stats show up together</p>
              <div className="lobby-panel__choices">
                <button type="button" className="lobby-panel__choice" onClick={() => setView("create")}>
                  create a lobby
                </button>
                <button type="button" className="lobby-panel__choice" onClick={() => setView("join")}>
                  join a lobby
                </button>
              </div>
              {!user && (
                <p className="lobby-panel__nudge">
                  using the guest name "{displayName}" — sign in with google for a verified identity teammates can trust
                </p>
              )}
            </>
          ) : view === "create" ? (
            <>
              <p className="lobby-panel__label">lobby name</p>
              <input
                className="lobby-panel__input"
                autoFocus
                placeholder="e.g. morning focus crew"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
              />
              {error && <p className="lobby-panel__error">{error}</p>}
              <div className="lobby-panel__row">
                <button type="button" className="chip" onClick={() => setView("menu")}>
                  back
                </button>
                <button
                  type="button"
                  className="lobby-panel__cta"
                  disabled={!nameInput.trim() || busy}
                  onClick={() => void handleCreate()}
                >
                  {busy ? "creating…" : "create"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="lobby-panel__label">lobby code</p>
              <input
                className="lobby-panel__input"
                autoFocus
                placeholder="e.g. 3fq9kx"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleJoin()}
              />
              {error && <p className="lobby-panel__error">{error}</p>}
              <div className="lobby-panel__row">
                <button type="button" className="chip" onClick={() => setView("menu")}>
                  back
                </button>
                <button
                  type="button"
                  className="lobby-panel__cta"
                  disabled={!codeInput.trim() || busy}
                  onClick={() => void handleJoin()}
                >
                  {busy ? "joining…" : "join"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
