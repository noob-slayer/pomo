import { supabase } from "./supabaseClient";
import type { Phase } from "../types";

export type LobbyMode = "individual" | "sync";

export interface Lobby {
  id: string;
  code: string;
  name: string;
  mode: LobbyMode;
  createdAt: number;
}

export interface LobbyMember {
  identityKey: string;
  personaName: string;
  joinedAt: number;
  lastSeenAt: number;
}

export interface LobbyMemberStat {
  identityKey: string;
  personaName: string;
  focusMinutes: number;
  breakMinutes: number;
  sessions: number;
  currentTask: string | null; // most recent focus session's task name, if any
}

export interface LobbyAllTimeStat extends LobbyMemberStat {
  daysActive: number;
}

export interface LobbyActivityEntry {
  id: string;
  identityKey: string;
  personaName: string;
  phase: Phase;
  minutes: number;
  taskTitle: string | null;
  completedAt: number;
}

interface LobbyRow {
  id: string;
  code: string;
  name: string;
  mode: LobbyMode;
  created_at: string;
}

interface LobbyMemberRow {
  identity_key: string;
  persona_name: string;
  joined_at: string;
  last_seen_at: string;
}

interface LobbySessionRow {
  id: string;
  identity_key: string;
  persona_name: string;
  phase: Phase;
  minutes: number;
  task_title: string | null;
  completed_at: string;
}

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no ambiguous chars (0/o, 1/l/i)

function generateLobbyCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}

function rowToLobby(row: LobbyRow): Lobby {
  return { id: row.id, code: row.code, name: row.name, mode: row.mode, createdAt: new Date(row.created_at).getTime() };
}

export async function createLobby(
  name: string,
  mode: LobbyMode,
  identityKey: string,
  personaName: string,
): Promise<Lobby | null> {
  if (!supabase) return null;
  const code = generateLobbyCode();
  // deliberately no .select() chained onto the insert -- PostgREST needs a SELECT-level
  // policy to return a representation of the row it just inserted, and lobbies has none
  // anymore (see lobby_rls_hardening.sql). Fetch it back through find_lobby_by_code's
  // SECURITY DEFINER RPC instead, which doesn't need one.
  const { error: insertError } = await supabase
    .from("lobbies")
    .insert({ code, name, mode, created_by: identityKey, creator_persona: personaName });
  if (insertError) {
    console.error("createLobby failed", insertError);
    return null;
  }
  const lobby = await findLobbyByCode(code);
  if (!lobby) {
    console.error("createLobby: insert succeeded but the lobby couldn't be read back");
    return null;
  }
  await joinLobby(lobby.id, identityKey, personaName);
  return lobby;
}

// these all go through SECURITY DEFINER RPCs (see supabase/lobby_rls_hardening.sql)
// rather than direct `.from(table).select()` -- a plain "anyone can read" RLS policy
// can't tell "the client already knows the code" apart from "the client asked for
// everything", so the only way to stop the whole table being listable by anyone holding
// the public anon key is to route reads through a function whose own SQL decides exactly
// what comes back.

export async function findLobbyByCode(code: string): Promise<Lobby | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("find_lobby_by_code", { p_code: code.trim().toLowerCase() });
  if (error || !data || data.length === 0) return null;
  return rowToLobby(data[0] as LobbyRow);
}

export async function fetchLobby(id: string): Promise<Lobby | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_lobby", { p_id: id });
  if (error || !data || data.length === 0) return null;
  return rowToLobby(data[0] as LobbyRow);
}

// every lobby this identity has ever been part of -- current membership (lobby_members)
// plus anywhere it's logged a session (lobby_sessions), since leaving a lobby deletes the
// membership row but the session history stays. This is what makes "team" a real history
// across every lobby ever joined, not just whichever one happens to be active right now.
export async function fetchMyLobbies(identityKey: string): Promise<Lobby[]> {
  if (!supabase) return [];
  const { data: idRows, error: idError } = await supabase.rpc("get_lobby_ids_for_identity", {
    p_identity_key: identityKey,
  });
  if (idError || !idRows || idRows.length === 0) return [];
  const ids = [...new Set((idRows as { lobby_id: string }[]).map((r) => r.lobby_id))];
  const { data, error } = await supabase.rpc("get_lobbies_by_ids", { p_ids: ids });
  if (error || !data) return [];
  return (data as LobbyRow[]).map(rowToLobby).sort((a, b) => b.createdAt - a.createdAt);
}

// returns whether the join actually took -- callers must not treat this as "joined" (and
// must not call setCurrentLobby) on false. This mattered in practice: identity_key has to
// match the caller's own auth.uid() under RLS (see lobby_identity_hardening.sql), and a
// fresh anonymous session isn't guaranteed to have resolved yet the instant a page loads
// from a shared invite link -- a stale/mismatched identityKey makes the insert fail RLS,
// which previously surfaced only as a console.error while the UI still optimistically
// showed the lobby as joined.
export async function joinLobby(lobbyId: string, identityKey: string, personaName: string): Promise<boolean> {
  if (!supabase) return false;
  // deliberately a plain insert-then-update instead of .upsert(): Postgres's ON CONFLICT
  // DO UPDATE needs to see the existing conflicting row to detect the conflict at all,
  // which runs into the same "no SELECT policy left" wall as createLobby's .select() did
  // (see lobby_rls_hardening.sql) even though nothing here chains .select() itself. A
  // plain insert/update never needs to read a row back, so neither hits that wall.
  const { error: insertError } = await supabase.from("lobby_members").insert({
    lobby_id: lobbyId,
    identity_key: identityKey,
    persona_name: personaName,
    last_seen_at: new Date().toISOString(),
  });
  if (!insertError) return true;
  // 23505 = unique_violation on (lobby_id, identity_key) -- already a member, update instead
  if (insertError.code !== "23505") {
    console.error("joinLobby failed", insertError);
    return false;
  }
  const { error: updateError } = await supabase
    .from("lobby_members")
    .update({ persona_name: personaName, last_seen_at: new Date().toISOString() })
    .eq("lobby_id", lobbyId)
    .eq("identity_key", identityKey);
  if (updateError) {
    console.error("joinLobby (update) failed", updateError);
    return false;
  }
  return true;
}

export async function leaveLobby(lobbyId: string, identityKey: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("lobby_members")
    .delete()
    .eq("lobby_id", lobbyId)
    .eq("identity_key", identityKey);
  if (error) console.error("leaveLobby failed", error);
}

export async function fetchLobbyMembers(lobbyId: string): Promise<LobbyMember[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_lobby_members", { p_lobby_id: lobbyId });
  if (error || !data) return [];
  return (data as LobbyMemberRow[]).map((r) => ({
    identityKey: r.identity_key,
    personaName: r.persona_name,
    joinedAt: new Date(r.joined_at).getTime(),
    lastSeenAt: new Date(r.last_seen_at).getTime(),
  }));
}

export async function logLobbySession(
  lobbyId: string,
  identityKey: string,
  personaName: string,
  phase: Phase,
  minutes: number,
  taskTitle: string | null = null,
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("lobby_sessions")
    .insert({ lobby_id: lobbyId, identity_key: identityKey, persona_name: personaName, phase, minutes, task_title: taskTitle });
  if (error) console.error("logLobbySession failed", error);
}

// shared by the today/week leaderboards below -- both are "totals since some date bound,
// merged with the member roster so someone who hasn't logged anything in the window still
// shows up (at 0m) rather than being invisible". p_since pushes the date bound back into
// SQL (lobby_sessions_completed_at_idx) instead of fetching the lobby's entire history and
// filtering it in JS on every ~8s poll.
async function aggregateLobbySessionsSince(
  lobbyId: string,
  members: LobbyMember[],
  since: Date,
): Promise<LobbyMemberStat[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_lobby_sessions", {
    p_lobby_id: lobbyId,
    p_since: since.toISOString(),
  });
  if (error) console.error("aggregateLobbySessionsSince failed", error);

  const map = new Map<string, LobbyMemberStat>();
  for (const m of members) {
    map.set(m.identityKey, {
      identityKey: m.identityKey,
      personaName: m.personaName,
      focusMinutes: 0,
      breakMinutes: 0,
      sessions: 0,
      currentTask: null,
    });
  }
  for (const r of (data ?? []) as LobbySessionRow[]) {
    const entry = map.get(r.identity_key) ?? {
      identityKey: r.identity_key,
      personaName: r.persona_name,
      focusMinutes: 0,
      breakMinutes: 0,
      sessions: 0,
      currentTask: null,
    };
    if (r.phase === "focus") {
      entry.focusMinutes += r.minutes;
      entry.sessions += 1;
      entry.currentTask = r.task_title;
    } else {
      entry.breakMinutes += r.minutes;
    }
    entry.personaName = r.persona_name;
    map.set(r.identity_key, entry);
  }
  return [...map.values()].sort((a, b) => b.focusMinutes - a.focusMinutes);
}

export async function fetchTodayLobbyStats(lobbyId: string, members: LobbyMember[]): Promise<LobbyMemberStat[]> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return aggregateLobbySessionsSince(lobbyId, members, startOfDay);
}

// same shape as fetchTodayLobbyStats, but bounded to the current calendar week (Sun-Sat)
// -- powers the team stats page's weekly leaderboard tab, the shorter, more competitive
// timescale that resets regularly rather than all-time's slow-moving totals.
export async function fetchWeekLobbyStats(lobbyId: string, members: LobbyMember[]): Promise<LobbyMemberStat[]> {
  const startOfWeek = new Date();
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  return aggregateLobbySessionsSince(lobbyId, members, startOfWeek);
}

// all-time per-member totals -- the "team stat" view, so members can look back on a
// lobby's history no matter how many days it's been since the last session
export async function fetchAllTimeLobbyStats(lobbyId: string, members: LobbyMember[]): Promise<LobbyAllTimeStat[]> {
  if (!supabase) return [];
  // genuinely needs the full history for true all-time totals -- the RPC already returns
  // it ascending by completed_at, so the last row seen per member below is their latest
  const { data, error } = await supabase.rpc("get_lobby_sessions", { p_lobby_id: lobbyId });
  if (error) console.error("fetchAllTimeLobbyStats failed", error);

  const map = new Map<string, LobbyAllTimeStat & { days: Set<string> }>();
  for (const m of members) {
    map.set(m.identityKey, {
      identityKey: m.identityKey,
      personaName: m.personaName,
      focusMinutes: 0,
      breakMinutes: 0,
      sessions: 0,
      currentTask: null,
      daysActive: 0,
      days: new Set(),
    });
  }
  for (const r of (data ?? []) as LobbySessionRow[]) {
    const entry = map.get(r.identity_key) ?? {
      identityKey: r.identity_key,
      personaName: r.persona_name,
      focusMinutes: 0,
      breakMinutes: 0,
      sessions: 0,
      currentTask: null,
      daysActive: 0,
      days: new Set<string>(),
    };
    if (r.phase === "focus") {
      entry.focusMinutes += r.minutes;
      entry.sessions += 1;
      entry.currentTask = r.task_title;
    } else {
      entry.breakMinutes += r.minutes;
    }
    entry.personaName = r.persona_name;
    entry.days.add(new Date(r.completed_at).toDateString());
    map.set(r.identity_key, entry);
  }
  return [...map.values()]
    .map(({ days, ...rest }) => ({ ...rest, daysActive: days.size }))
    .sort((a, b) => b.focusMinutes - a.focusMinutes);
}

// a recent-activity log across every member, most recent first -- who did what, when
export async function fetchRecentLobbyActivity(lobbyId: string, limit = 30): Promise<LobbyActivityEntry[]> {
  if (!supabase) return [];
  // get_recent_lobby_sessions does the ORDER BY completed_at DESC LIMIT in SQL, same as
  // the direct-table query this replaced -- see supabase/lobby_sessions_rpc_params.sql
  const { data, error } = await supabase.rpc("get_recent_lobby_sessions", {
    p_lobby_id: lobbyId,
    p_limit: limit,
  });
  if (error || !data) return [];
  return (data as LobbySessionRow[]).map((r) => ({
    id: r.id,
    identityKey: r.identity_key,
    personaName: r.persona_name,
    phase: r.phase,
    minutes: r.minutes,
    taskTitle: r.task_title,
    completedAt: new Date(r.completed_at).getTime(),
  }));
}

export function buildLobbyUrl(code: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("lobby", code);
  return url.toString();
}

export function parseLobbyCodeFromLocation(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("lobby");
}

export function clearLobbyFromLocation(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("lobby");
  window.history.replaceState({}, "", url.toString());
}
