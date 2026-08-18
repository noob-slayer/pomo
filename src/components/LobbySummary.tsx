import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import type { CurrentLobby } from "../context/SettingsContext";
import { resolveIdentityKey } from "../lib/identity";
import { fetchLobbyMembers, fetchTodayLobbyStats, type LobbyMemberStat } from "../lib/lobby";
import { formatDuration } from "../lib/durations";

interface LobbySummaryProps {
  lobby: CurrentLobby;
  // bumped whenever a session completes locally, to refetch sooner than the poll interval
  refreshToken: number;
}

const POLL_MS = 8000;

export function LobbySummary({ lobby, refreshToken }: LobbySummaryProps) {
  const { user } = useAuth();
  const [stats, setStats] = useState<LobbyMemberStat[]>([]);
  const identityKey = resolveIdentityKey(user?.id ?? null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const members = await fetchLobbyMembers(lobby.id);
      const todayStats = await fetchTodayLobbyStats(lobby.id, members);
      if (!cancelled) setStats(todayStats);
    };
    void load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [lobby.id, refreshToken]);

  if (stats.length === 0) return null;

  return (
    <div className="lobby-summary">
      <p className="lobby-summary__title">{lobby.name} lobby</p>
      <ul className="lobby-summary__list">
        {stats.map((s) => (
          <li key={s.identityKey} className="lobby-summary__member">
            <div className={s.identityKey === identityKey ? "lobby-summary__row lobby-summary__row--me" : "lobby-summary__row"}>
              <span className="lobby-summary__name">{s.personaName}</span>
              <span className="lobby-summary__value tabular">
                {formatDuration(s.focusMinutes)}
                {s.breakMinutes > 0 ? ` · ${formatDuration(s.breakMinutes)} break` : ""}
              </span>
            </div>
            {s.currentTask && <p className="lobby-summary__task">{s.currentTask}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
