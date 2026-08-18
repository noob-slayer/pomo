import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useSettings, type CurrentLobby } from "../context/SettingsContext";
import { resolveIdentityKey } from "../lib/identity";
import { fetchLobby, joinLobby } from "../lib/lobby";

interface LobbyRejoinProps {
  lastLobby: CurrentLobby;
}

export function LobbyRejoin({ lastLobby }: LobbyRejoinProps) {
  const { user } = useAuth();
  const { personaName, setCurrentLobby } = useSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const identityKey = resolveIdentityKey(user?.id ?? null);
  const displayName = personaName || "guest";

  const handleRejoin = async () => {
    setBusy(true);
    setError(null);
    // re-fetch by id rather than trusting the cached name/mode -- the lobby may have
    // been renamed, switched modes, or deleted since we last saw it
    const fresh = await fetchLobby(lastLobby.id);
    if (!fresh) {
      setBusy(false);
      setError("this lobby no longer exists");
      return;
    }
    await joinLobby(fresh.id, identityKey, displayName);
    setBusy(false);
    setCurrentLobby({ id: fresh.id, code: fresh.code, name: fresh.name, mode: fresh.mode });
  };

  return (
    <div className="lobby-rejoin">
      <p className="task-empty">you're not in a lobby right now.</p>
      <p className="lobby-rejoin__hint">
        last one: <strong>{lastLobby.name}</strong>
      </p>
      {error && <p className="lobby-panel__error">{error}</p>}
      <button type="button" className="lobby-panel__cta" disabled={busy} onClick={() => void handleRejoin()}>
        {busy ? "rejoining…" : "rejoin"}
      </button>
    </div>
  );
}
