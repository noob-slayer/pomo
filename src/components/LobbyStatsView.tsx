import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import type { CurrentLobby } from "../context/SettingsContext";
import { resolveIdentityKey } from "../lib/identity";
import {
  fetchLobbyMembers,
  fetchAllTimeLobbyStats,
  fetchRecentLobbyActivity,
  type LobbyAllTimeStat,
  type LobbyActivityEntry,
} from "../lib/lobby";
import { formatDuration } from "../lib/durations";

interface LobbyStatsViewProps {
  lobby: CurrentLobby;
}

const POLL_MS = 8000;

export function LobbyStatsView({ lobby }: LobbyStatsViewProps) {
  const { identityUserId } = useAuth();
  const [stats, setStats] = useState<LobbyAllTimeStat[]>([]);
  const [activity, setActivity] = useState<LobbyActivityEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const identityKey = resolveIdentityKey(identityUserId);

  // this view had no refresh at all before -- once loaded on mount, another member's
  // sessions never showed up unless you switched tabs away and back, which could easily
  // read as being "stuck" for minutes. Polling here matches LobbySummary's approach.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const members = await fetchLobbyMembers(lobby.id);
      const [allTime, recent] = await Promise.all([
        fetchAllTimeLobbyStats(lobby.id, members),
        fetchRecentLobbyActivity(lobby.id),
      ]);
      if (cancelled) return;
      setStats(allTime);
      setActivity(recent);
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
  if (stats.length === 0) return <p className="task-empty">no sessions logged in this lobby yet</p>;

  return (
    <div className="lobby-stats-view">
      <p className="history-section__label">{lobby.name} — all-time</p>
      <ul className="lobby-stats-board">
        {stats.map((s, i) => (
          <li
            key={s.identityKey}
            className={s.identityKey === identityKey ? "lobby-stats-row lobby-stats-row--me" : "lobby-stats-row"}
          >
            <span className="lobby-stats-row__rank tabular">{i + 1}</span>
            <span className="lobby-stats-row__name">{s.personaName}</span>
            <span className="lobby-stats-row__meta">
              {s.sessions} sessions · {s.daysActive} day{s.daysActive === 1 ? "" : "s"} active
              {s.currentTask ? ` · latest: ${s.currentTask}` : ""}
            </span>
            <span className="lobby-stats-row__value tabular">{formatDuration(s.focusMinutes)}</span>
          </li>
        ))}
      </ul>

      <p className="history-section__label">recent activity</p>
      <ul className="stats-log">
        {activity.map((a) => {
          const d = new Date(a.completedAt);
          return (
            <li key={a.id} className="stats-log__row">
              <span className="stats-log__when">
                {d.toLocaleDateString(undefined, { month: "short", day: "numeric" }).toLowerCase()} ·{" "}
                {d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).toLowerCase()}
              </span>
              <span className="stats-log__what">
                {a.personaName} · {a.phase === "break" ? "break" : (a.taskTitle ?? "focus")}
              </span>
              <span className="stats-log__minutes tabular">{formatDuration(a.minutes)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
