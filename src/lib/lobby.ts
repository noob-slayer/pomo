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
  identity_key: string;
  persona_name: string;
  phase: Phase;
  minutes: number;
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

export async function createLobby(name: string, identityKey: string, personaName: string): Promise<Lobby | null> {
  if (!supabase) return null;
  const code = generateLobbyCode();
  const { data, error } = await supabase
    .from("lobbies")
    .insert({ code, name, mode: "individual", created_by: identityKey, creator_persona: personaName })
    .select()
    .single();
  if (error || !data) {
    console.error("createLobby failed", error);
    return null;
  }
  await joinLobby(data.id as string, identityKey, personaName);
  return rowToLobby(data as LobbyRow);
}

export async function findLobbyByCode(code: string): Promise<Lobby | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("lobbies")
    .select("*")
    .eq("code", code.trim().toLowerCase())
    .maybeSingle();
  if (error || !data) return null;
  return rowToLobby(data as LobbyRow);
}

export async function fetchLobby(id: string): Promise<Lobby | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("lobbies").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return rowToLobby(data as LobbyRow);
}

export async function joinLobby(lobbyId: string, identityKey: string, personaName: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("lobby_members").upsert(
    {
      lobby_id: lobbyId,
      identity_key: identityKey,
      persona_name: personaName,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "lobby_id,identity_key" },
  );
  if (error) console.error("joinLobby failed", error);
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
  const { data, error } = await supabase
    .from("lobby_members")
    .select("*")
    .eq("lobby_id", lobbyId)
    .order("joined_at");
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
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("lobby_sessions")
    .insert({ lobby_id: lobbyId, identity_key: identityKey, persona_name: personaName, phase, minutes });
  if (error) console.error("logLobbySession failed", error);
}

// today's per-member totals, merged with the member roster so someone who hasn't logged
// anything yet today still shows up (at 0m) rather than being invisible
export async function fetchTodayLobbyStats(lobbyId: string, members: LobbyMember[]): Promise<LobbyMemberStat[]> {
  if (!supabase) return [];
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("lobby_sessions")
    .select("identity_key, persona_name, phase, minutes")
    .eq("lobby_id", lobbyId)
    .gte("completed_at", startOfDay.toISOString());
  if (error) console.error("fetchTodayLobbyStats failed", error);

  const map = new Map<string, LobbyMemberStat>();
  for (const m of members) {
    map.set(m.identityKey, { identityKey: m.identityKey, personaName: m.personaName, focusMinutes: 0, breakMinutes: 0, sessions: 0 });
  }
  for (const r of (data ?? []) as LobbySessionRow[]) {
    const entry = map.get(r.identity_key) ?? {
      identityKey: r.identity_key,
      personaName: r.persona_name,
      focusMinutes: 0,
      breakMinutes: 0,
      sessions: 0,
    };
    if (r.phase === "focus") {
      entry.focusMinutes += r.minutes;
      entry.sessions += 1;
    } else {
      entry.breakMinutes += r.minutes;
    }
    entry.personaName = r.persona_name;
    map.set(r.identity_key, entry);
  }
  return [...map.values()].sort((a, b) => b.focusMinutes - a.focusMinutes);
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
