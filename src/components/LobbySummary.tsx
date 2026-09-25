import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import type { CurrentLobby } from "../context/SettingsContext";
import { resolveIdentityKey } from "../lib/identity";
import { fetchLobbyMembers, fetchTodayLobbyStats, type LobbyMemberStat } from "../lib/lobby";
import { PRESENCE_STALE_MS, type LobbyPresence } from "../lib/lobbySync";
import { formatDuration } from "../lib/durations";

interface LobbySummaryProps {
  lobby: CurrentLobby;
  // bumped whenever a session completes locally, to refetch sooner than the poll interval
  refreshToken: number;
  // live presence roster (individual-mode lobbies only); empty otherwise
  presence: LobbyPresence[];
  // this device's own live status, computed straight from the local timer -- used for the
  // "me" row instead of the roster, so we never show ourselves offline just because the
  // presence channel round-trip is momentarily stale (we always know our own timer state)
  selfPresence: Omit<LobbyPresence, "at">;
}

const POLL_MS = 8000;

export function LobbySummary({ lobby, refreshToken, presence, selfPresence }: LobbySummaryProps) {
  const { identityUserId } = useAuth();
  const [stats, setStats] = useState<LobbyMemberStat[]>([]);
  // ticks so a member whose heartbeat has gone stale flips to "offline" on its own, without
  // waiting for the next stats poll or a fresh presence event to force a re-render
  const [, setNowTick] = useState(0);
  const identityKey = resolveIdentityKey(identityUserId);
  const showPresence = lobby.mode === "individual";
  const presenceByKey = new Map(presence.map((p) => [p.identityKey, p]));

  // resolve a member's live status. My own row reads the local timer (selfPresence) so a
  // stale round-trip can't mislabel me; others come from the roster, with a stale heartbeat
  // or a missing entry (disconnected) both counting as offline.
  const liveStatus = (
    memberKey: string,
  ): { state: "focus" | "break" | "offline"; taskTitle: string | null; durationMinutes: number | null } => {
    if (memberKey === identityKey) {
      return {
        state: selfPresence.state === "idle" ? "offline" : selfPresence.state,
        taskTitle: selfPresence.taskTitle,
        durationMinutes: selfPresence.durationMinutes,
      };
    }
    const p = presenceByKey.get(memberKey);
    if (!p || p.state === "idle" || Date.now() - p.at >= PRESENCE_STALE_MS) {
      return { state: "offline", taskTitle: null, durationMinutes: null };
    }
    return { state: p.state, taskTitle: p.taskTitle, durationMinutes: p.durationMinutes };
  };

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

  useEffect(() => {
    if (!showPresence) return;
    const id = setInterval(() => setNowTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, [showPresence]);

  if (stats.length === 0) return null;

  return (
    <div className="lobby-summary">
      <p className="lobby-summary__title">{lobby.name} lobby</p>
      <ul className="lobby-summary__list">
        {stats.map((s) => {
          const isMe = s.identityKey === identityKey;
          const live = liveStatus(s.identityKey);
          return (
            <li key={s.identityKey} className="lobby-summary__member">
              <div className={isMe ? "lobby-summary__row lobby-summary__row--me" : "lobby-summary__row"}>
                <span className="lobby-summary__name">{s.personaName}</span>
                <span className="lobby-summary__value tabular">
                  {formatDuration(s.focusMinutes)}
                  {s.breakMinutes > 0 ? ` · ${formatDuration(s.breakMinutes)} break` : ""}
                </span>
              </div>
              {showPresence ? (
                <p className={`lobby-summary__status lobby-summary__status--${live.state}`}>
                  <span className={`lobby-summary__dot lobby-summary__dot--${live.state}`} aria-hidden="true" />
                  {live.state === "focus"
                    ? `${live.taskTitle ? `${live.taskTitle} · ` : "focusing · "}${live.durationMinutes ? formatDuration(live.durationMinutes) : "in session"}`
                    : live.state === "break"
                      ? "on break"
                      : "offline"}
                </p>
              ) : (
                s.currentTask && <p className="lobby-summary__task">{s.currentTask}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
