import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import type { CurrentLobby } from "../context/SettingsContext";
import { resolveIdentityKey } from "../lib/identity";
import { fetchLobbyMembers, fetchTodayLobbyStats, type LobbyMemberStat } from "../lib/lobby";
import { formatDuration } from "../lib/durations";

interface LobbyStatsViewProps {
  lobby: CurrentLobby;
  onOpenFull: () => void;
}

const POLL_MS = 8000;

// compact teaser for the task-panel "team" tab -- today's combined total and the current
// top member, with everything else (weekly/all-time leaderboard, kudos, full activity
// feed) living behind "open team stats" into TeamStatsPage
export function LobbyStatsView({ lobby, onOpenFull }: LobbyStatsViewProps) {
  const { identityUserId } = useAuth();
  const [stats, setStats] = useState<LobbyMemberStat[]>([]);
  const [loaded, setLoaded] = useState(false);
  const identityKey = resolveIdentityKey(identityUserId);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const members = await fetchLobbyMembers(lobby.id);
      const today = await fetchTodayLobbyStats(lobby.id, members);
      if (cancelled) return;
      setStats(today);
      setLoaded(true);
    };
    void load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [lobby.id]);

  if (!loaded) return null;

  const combinedMinutes = stats.reduce((sum, m) => sum + m.focusMinutes, 0);
  const top = [...stats].sort((a, b) => b.focusMinutes - a.focusMinutes)[0];
  const me = stats.find((m) => m.identityKey === identityKey);

  return (
    <div className="lobby-stats-teaser">
      <p className="stats-teaser__hint">
        {combinedMinutes > 0 ? (
          <>{formatDuration(combinedMinutes)} focused by the team today</>
        ) : (
          <>no sessions logged in {lobby.name} yet today</>
        )}
      </p>
      {top && top.focusMinutes > 0 && (
        <p className="stats-teaser__hint">
          leading today: {top.personaName} · {formatDuration(top.focusMinutes)}
          {me && me.identityKey !== top.identityKey && me.focusMinutes > 0
            ? ` (you: ${formatDuration(me.focusMinutes)})`
            : ""}
        </p>
      )}
      <button type="button" className="stats-teaser__cta" onClick={onOpenFull}>
        open team stats →
      </button>
    </div>
  );
}
