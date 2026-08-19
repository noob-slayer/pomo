import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { resolveIdentityKey } from "../lib/identity";
import {
  fetchMyLobbies,
  fetchLobbyMembers,
  fetchWeekLobbyStats,
  fetchAllTimeLobbyStats,
  fetchRecentLobbyActivity,
  fetchLobbyChallenges,
  fetchChallengeLobbyStats,
  createLobbyChallenge,
  joinLobby,
  type Lobby,
  type LobbyMember,
  type LobbyMemberStat,
  type LobbyAllTimeStat,
  type LobbyActivityEntry,
  type LobbyChallenge,
} from "../lib/lobby";
import { fetchLobbyKudos, giveKudos, removeKudos, type KudosEntry } from "../lib/kudos";
import type { KudosNotification } from "../lib/lobbySync";
import { formatDuration } from "../lib/durations";
import { IconFlame } from "./icons";

interface TeamStatsPageProps {
  open: boolean;
  onClose: () => void;
  onGiveKudos: (lobbyId: string, notification: KudosNotification) => void;
}

type LeaderboardRange = "week" | "all";

const POLL_MS = 8000;

export function TeamStatsPage({ open, onClose, onGiveKudos }: TeamStatsPageProps) {
  const { identityUserId } = useAuth();
  const { personaName, currentLobby, setCurrentLobby } = useSettings();
  const identityKey = resolveIdentityKey(identityUserId);
  const displayName = personaName || "guest";

  const [lobbies, setLobbies] = useState<Lobby[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [range, setRange] = useState<LeaderboardRange>("week");
  const [weekStats, setWeekStats] = useState<LobbyMemberStat[]>([]);
  const [allTimeStats, setAllTimeStats] = useState<LobbyAllTimeStat[]>([]);
  const [activity, setActivity] = useState<LobbyActivityEntry[]>([]);
  const [kudos, setKudos] = useState<KudosEntry[]>([]);
  const [members, setMembers] = useState<LobbyMember[]>([]);
  const [challenges, setChallenges] = useState<LobbyChallenge[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [rejoining, setRejoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingKudos, setPendingKudos] = useState<Set<string>>(new Set());
  const [challengeFormOpen, setChallengeFormOpen] = useState(false);
  const [challengeName, setChallengeName] = useState("");
  const [challengeStart, setChallengeStart] = useState("");
  const [challengeEnd, setChallengeEnd] = useState("");
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [expandedChallengeId, setExpandedChallengeId] = useState<string | null>(null);
  const [challengeStats, setChallengeStats] = useState<LobbyMemberStat[]>([]);
  const [challengeStatsLoading, setChallengeStatsLoading] = useState(false);

  // load the identity's full lobby history once the page opens -- mirrors
  // LobbyHistoryView's own picker, kept independent since this is a separate overlay
  useEffect(() => {
    if (!open) return;
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
  }, [open, identityKey]);

  // poll the selected lobby's stats/activity/kudos while the page is open, same cadence
  // as LobbyStatsView -- another member's session or kudos shouldn't need a reopen to show up
  useEffect(() => {
    if (!open || !selectedId) return;
    let cancelled = false;
    const load = async () => {
      const lobbyMembers = await fetchLobbyMembers(selectedId);
      const [week, allTime, recent, kudosRows, challengeRows] = await Promise.all([
        fetchWeekLobbyStats(selectedId, lobbyMembers),
        fetchAllTimeLobbyStats(selectedId, lobbyMembers),
        fetchRecentLobbyActivity(selectedId, 40),
        fetchLobbyKudos(selectedId),
        fetchLobbyChallenges(selectedId),
      ]);
      if (cancelled) return;
      setMembers(lobbyMembers);
      setWeekStats(week);
      setAllTimeStats(allTime);
      setActivity(recent);
      setKudos(kudosRows);
      setChallenges(challengeRows);
      setLoaded(true);
    };
    void load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [open, selectedId]);

  if (!open) return null;

  const selected = lobbies?.find((l) => l.id === selectedId) ?? lobbies?.[0] ?? null;
  const isActive = currentLobby?.id === selected?.id;
  const leaderboard = range === "week" ? weekStats : allTimeStats;
  const combinedWeekMinutes = weekStats.reduce((sum, m) => sum + m.focusMinutes, 0);
  const activeThisWeek = weekStats.filter((m) => m.sessions > 0).length;

  const kudosBySession = new Map<string, { count: number; mine: boolean }>();
  for (const k of kudos) {
    const entry = kudosBySession.get(k.sessionId) ?? { count: 0, mine: false };
    entry.count += 1;
    if (k.identityKey === identityKey) entry.mine = true;
    kudosBySession.set(k.sessionId, entry);
  }

  const toggleKudos = async (entry: LobbyActivityEntry) => {
    const sessionId = entry.id;
    if (!selected || pendingKudos.has(sessionId)) return;
    const mine = kudosBySession.get(sessionId)?.mine ?? false;
    setPendingKudos((prev) => new Set(prev).add(sessionId));
    // optimistic: flip local state immediately, poll (or the revert below) reconciles
    setKudos((prev) =>
      mine
        ? prev.filter((k) => !(k.sessionId === sessionId && k.identityKey === identityKey))
        : [
            ...prev,
            {
              id: `optimistic-${sessionId}`,
              sessionId,
              lobbyId: selected.id,
              identityKey,
              personaName: displayName,
              createdAt: Date.now(),
            },
          ],
    );
    const ok = mine
      ? await removeKudos(sessionId, identityKey)
      : await giveKudos(selected.id, sessionId, identityKey, displayName);
    setPendingKudos((prev) => {
      const next = new Set(prev);
      next.delete(sessionId);
      return next;
    });
    if (!ok) {
      // the write failed -- re-fetch from the source of truth rather than hand-rolling
      // the inverse of whatever optimistic edit was just applied
      const rows = await fetchLobbyKudos(selected.id);
      setKudos(rows);
      return;
    }
    // notify the recipient in real time, if they're currently in this lobby too -- the
    // database write above is the source of truth regardless, this is just the live nudge
    if (!mine) {
      onGiveKudos(selected.id, {
        toIdentityKey: entry.identityKey,
        fromPersonaName: displayName,
        taskTitle: entry.taskTitle,
      });
    }
  };

  const handleCreateChallenge = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected || !challengeName.trim() || !challengeStart || !challengeEnd) return;
    // whole-day range: start of the chosen start date through end of the chosen end date
    const startsAt = new Date(`${challengeStart}T00:00:00`);
    const endsAt = new Date(`${challengeEnd}T23:59:59.999`);
    if (endsAt <= startsAt) {
      setChallengeError("end date must be after the start date");
      return;
    }
    setChallengeError(null);
    const ok = await createLobbyChallenge(selected.id, identityKey, challengeName.trim(), startsAt, endsAt);
    if (!ok) {
      setChallengeError("couldn't create the challenge — try again");
      return;
    }
    setChallengeName("");
    setChallengeStart("");
    setChallengeEnd("");
    setChallengeFormOpen(false);
    setChallenges(await fetchLobbyChallenges(selected.id));
  };

  const toggleChallengeExpanded = async (challenge: LobbyChallenge) => {
    if (expandedChallengeId === challenge.id) {
      setExpandedChallengeId(null);
      return;
    }
    setExpandedChallengeId(challenge.id);
    setChallengeStatsLoading(true);
    const stats = await fetchChallengeLobbyStats(
      challenge.lobbyId,
      members,
      new Date(challenge.startsAt),
      new Date(challenge.endsAt),
    );
    setChallengeStats(stats);
    setChallengeStatsLoading(false);
  };

  const challengeStatus = (challenge: LobbyChallenge): "upcoming" | "active" | "ended" => {
    const now = Date.now();
    if (now < challenge.startsAt) return "upcoming";
    if (now > challenge.endsAt) return "ended";
    return "active";
  };

  const handleRejoin = async () => {
    if (!selected) return;
    setRejoining(true);
    setError(null);
    const joined = await joinLobby(selected.id, identityKey, displayName);
    setRejoining(false);
    if (!joined) {
      setError("couldn't rejoin the lobby — try again");
      return;
    }
    setCurrentLobby({ id: selected.id, code: selected.code, name: selected.name, mode: selected.mode });
  };

  return (
    <div className="stats-overlay" role="dialog" aria-modal="true" aria-label="team stats" onClick={onClose}>
      <div className="stats-page team-stats-page" onClick={(e) => e.stopPropagation()}>
        <header className="stats-page__header">
          <h1 className="stats-page__title">team stats</h1>
          <button type="button" className="stats-page__close" onClick={onClose} aria-label="close">
            ×
          </button>
        </header>

        <div className="stats-page__body">
          {lobbies === null ? null : lobbies.length === 0 ? (
            <p className="task-empty">you haven't joined any lobbies yet</p>
          ) : !selected ? null : (
            <>
              {lobbies.length > 1 && (
                <div className="lobby-history__picker">
                  {lobbies.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className={
                        l.id === selected.id ? "lobby-history__chip lobby-history__chip--active" : "lobby-history__chip"
                      }
                      onClick={() => {
                        setSelectedId(l.id);
                        setLoaded(false);
                        setExpandedChallengeId(null);
                        setChallengeFormOpen(false);
                      }}
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

              {!loaded ? null : (
                <>
                  <div className="stats-hero">
                    <div className="stats-hero__card">
                      <span className="stats-hero__value tabular">{formatDuration(combinedWeekMinutes)}</span>
                      <span className="stats-hero__label">team focus this week</span>
                    </div>
                    <div className="stats-hero__card">
                      <span className="stats-hero__value tabular">
                        {activeThisWeek}/{weekStats.length}
                      </span>
                      <span className="stats-hero__label">active this week</span>
                    </div>
                  </div>

                  <div className="leaderboard-tabs" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={range === "week"}
                      className={range === "week" ? "leaderboard-tabs__item leaderboard-tabs__item--active" : "leaderboard-tabs__item"}
                      onClick={() => setRange("week")}
                    >
                      this week
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={range === "all"}
                      className={range === "all" ? "leaderboard-tabs__item leaderboard-tabs__item--active" : "leaderboard-tabs__item"}
                      onClick={() => setRange("all")}
                    >
                      all-time
                    </button>
                  </div>

                  {leaderboard.length === 0 ? (
                    <p className="task-empty">no sessions logged {range === "week" ? "this week" : "yet"}</p>
                  ) : (
                    <ul className="lobby-stats-board">
                      {leaderboard.map((s, i) => (
                        <li
                          key={s.identityKey}
                          className={s.identityKey === identityKey ? "lobby-stats-row lobby-stats-row--me" : "lobby-stats-row"}
                        >
                          <span className="lobby-stats-row__rank tabular">{i + 1}</span>
                          <span className="lobby-stats-row__name">{s.personaName}</span>
                          <span className="lobby-stats-row__meta">
                            {s.sessions} session{s.sessions === 1 ? "" : "s"}
                            {"daysActive" in s ? ` · ${(s as LobbyAllTimeStat).daysActive} days active` : ""}
                            {s.currentTask ? ` · latest: ${s.currentTask}` : ""}
                          </span>
                          <span className="lobby-stats-row__value tabular">{formatDuration(s.focusMinutes)}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="history-section__label">recent activity</p>
                  <ul className="stats-log stats-log--kudos">
                    {activity.map((a) => {
                      const d = new Date(a.completedAt);
                      const k = kudosBySession.get(a.id);
                      const canKudos = a.phase === "focus" && a.identityKey !== identityKey;
                      return (
                        <li key={a.id} className="stats-log__row stats-log__row--kudos">
                          <span className="stats-log__when">
                            {d.toLocaleDateString(undefined, { month: "short", day: "numeric" }).toLowerCase()} ·{" "}
                            {d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).toLowerCase()}
                          </span>
                          <span className="stats-log__what">
                            {a.personaName} · {a.phase === "break" ? "break" : (a.taskTitle ?? "focus")}
                          </span>
                          <span className="stats-log__minutes tabular">{formatDuration(a.minutes)}</span>
                          {canKudos ? (
                            <button
                              type="button"
                              className={k?.mine ? "kudos-btn kudos-btn--active" : "kudos-btn"}
                              onClick={() => void toggleKudos(a)}
                              aria-pressed={!!k?.mine}
                              aria-label={k?.mine ? "remove kudos" : "give kudos"}
                            >
                              <IconFlame />
                              <span className="kudos-btn__count tabular">{k?.count ?? 0}</span>
                            </button>
                          ) : (
                            <span className="kudos-btn kudos-btn--disabled">
                              <IconFlame />
                              <span className="kudos-btn__count tabular">{k?.count ?? 0}</span>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  <div className="challenges-header">
                    <p className="history-section__label">challenges</p>
                    {!challengeFormOpen && (
                      <button type="button" className="stats-teaser__cta" onClick={() => setChallengeFormOpen(true)}>
                        + new challenge
                      </button>
                    )}
                  </div>

                  {challengeFormOpen && (
                    <form className="challenge-form" onSubmit={(e) => void handleCreateChallenge(e)}>
                      <input
                        className="challenge-form__name"
                        placeholder="e.g. deep work week"
                        autoFocus
                        value={challengeName}
                        onChange={(e) => setChallengeName(e.target.value)}
                      />
                      <div className="challenge-form__dates">
                        <input
                          type="date"
                          value={challengeStart}
                          onChange={(e) => setChallengeStart(e.target.value)}
                        />
                        <span className="custom-duration__sep">→</span>
                        <input type="date" value={challengeEnd} onChange={(e) => setChallengeEnd(e.target.value)} />
                      </div>
                      {challengeError && <p className="lobby-panel__error">{challengeError}</p>}
                      <div className="challenge-form__actions">
                        <button
                          type="button"
                          className="chip"
                          onClick={() => {
                            setChallengeFormOpen(false);
                            setChallengeError(null);
                          }}
                        >
                          cancel
                        </button>
                        <button
                          type="submit"
                          className="lobby-panel__cta"
                          disabled={!challengeName.trim() || !challengeStart || !challengeEnd}
                        >
                          create
                        </button>
                      </div>
                    </form>
                  )}

                  {challenges.length === 0 ? (
                    <p className="task-empty">no challenges yet — start one to compete over a set window</p>
                  ) : (
                    <ul className="challenge-list">
                      {challenges.map((challenge) => {
                        const status = challengeStatus(challenge);
                        const expanded = expandedChallengeId === challenge.id;
                        return (
                          <li key={challenge.id} className="challenge-item">
                            <button
                              type="button"
                              className="challenge-item__row"
                              onClick={() => void toggleChallengeExpanded(challenge)}
                            >
                              <span className="challenge-item__name">{challenge.name}</span>
                              <span className={`challenge-item__status challenge-item__status--${status}`}>
                                {status}
                              </span>
                              <span className="challenge-item__dates">
                                {new Date(challenge.startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }).toLowerCase()}
                                {" – "}
                                {new Date(challenge.endsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }).toLowerCase()}
                              </span>
                            </button>
                            {expanded && (
                              <div className="challenge-item__board">
                                {challengeStatsLoading ? null : challengeStats.length === 0 ? (
                                  <p className="task-empty">no sessions logged in this window</p>
                                ) : (
                                  <ul className="lobby-stats-board">
                                    {challengeStats
                                      .filter((s) => s.focusMinutes > 0)
                                      .map((s, i) => (
                                        <li
                                          key={s.identityKey}
                                          className={
                                            s.identityKey === identityKey ? "lobby-stats-row lobby-stats-row--me" : "lobby-stats-row"
                                          }
                                        >
                                          <span className="lobby-stats-row__rank tabular">{i + 1}</span>
                                          <span className="lobby-stats-row__name">{s.personaName}</span>
                                          <span className="lobby-stats-row__meta">
                                            {s.sessions} session{s.sessions === 1 ? "" : "s"}
                                          </span>
                                          <span className="lobby-stats-row__value tabular">{formatDuration(s.focusMinutes)}</span>
                                        </li>
                                      ))}
                                  </ul>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
