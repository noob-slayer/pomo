import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { resolveIdentityKey } from "../lib/identity";
import { fetchMyLobbies, joinLobby, type Lobby } from "../lib/lobby";
import { LobbyStatsView } from "./LobbyStatsView";

// every lobby the current identity has ever joined or logged a session in, not just
// whichever one happens to be active -- a picker (when there's more than one) plus that
// lobby's full stats, with a "rejoin" action for anything that isn't the active lobby.
export function LobbyHistoryView() {
  const { user } = useAuth();
  const { personaName, currentLobby, setCurrentLobby } = useSettings();
  const identityKey = resolveIdentityKey(user?.id ?? null);
  const displayName = personaName || "guest";

  const [lobbies, setLobbies] = useState<Lobby[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejoining, setRejoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mine = await fetchMyLobbies(identityKey);
      if (cancelled) return;
      setLobbies(mine);
      setSelectedId((prev) => prev ?? currentLobby?.id ?? mine[0]?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityKey]);

  if (lobbies === null) return null;
  if (lobbies.length === 0) return <p className="task-empty">you haven't joined any lobbies yet</p>;

  const selected = lobbies.find((l) => l.id === selectedId) ?? lobbies[0];
  const isActive = currentLobby?.id === selected.id;

  const handleRejoin = async () => {
    setRejoining(true);
    setError(null);
    await joinLobby(selected.id, identityKey, displayName);
    setRejoining(false);
    setCurrentLobby({ id: selected.id, code: selected.code, name: selected.name, mode: selected.mode });
  };

  return (
    <div className="lobby-history">
      {lobbies.length > 1 && (
        <div className="lobby-history__picker">
          {lobbies.map((l) => (
            <button
              key={l.id}
              type="button"
              className={l.id === selected.id ? "lobby-history__chip lobby-history__chip--active" : "lobby-history__chip"}
              onClick={() => setSelectedId(l.id)}
            >
              {l.name}
              {currentLobby?.id === l.id ? " · live" : ""}
            </button>
          ))}
        </div>
      )}
      {!isActive && (
        <div className="lobby-history__rejoin">
          <p className="lobby-history__rejoin-hint">you're not currently in this lobby</p>
          {error && <p className="lobby-panel__error">{error}</p>}
          <button type="button" className="lobby-panel__cta" disabled={rejoining} onClick={() => void handleRejoin()}>
            {rejoining ? "rejoining…" : "rejoin"}
          </button>
        </div>
      )}
      <LobbyStatsView lobby={selected} />
    </div>
  );
}
