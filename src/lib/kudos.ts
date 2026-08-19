import { supabase } from "./supabaseClient";

export interface KudosEntry {
  id: string;
  sessionId: string;
  lobbyId: string;
  identityKey: string;
  personaName: string;
  createdAt: number;
}

interface KudosRow {
  id: string;
  session_id: string;
  lobby_id: string;
  identity_key: string;
  persona_name: string;
  created_at: string;
}

function rowToKudos(row: KudosRow): KudosEntry {
  return {
    id: row.id,
    sessionId: row.session_id,
    lobbyId: row.lobby_id,
    identityKey: row.identity_key,
    personaName: row.persona_name,
    createdAt: new Date(row.created_at).getTime(),
  };
}

// every kudos ever given in a lobby -- small enough (casual reactions, not a chat log)
// that the caller aggregating counts/"did I react" client-side is simpler than a second
// RPC just for aggregates. Fails soft (empty array) if the table/RPC don't exist yet --
// see supabase/lobby_kudos_schema.sql, which has to be run manually before this works.
export async function fetchLobbyKudos(lobbyId: string): Promise<KudosEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_lobby_kudos", { p_lobby_id: lobbyId });
  if (error || !data) {
    if (error) console.error("fetchLobbyKudos failed", error);
    return [];
  }
  return (data as KudosRow[]).map(rowToKudos);
}

export async function giveKudos(
  lobbyId: string,
  sessionId: string,
  identityKey: string,
  personaName: string,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("lobby_session_kudos")
    .insert({ lobby_id: lobbyId, session_id: sessionId, identity_key: identityKey, persona_name: personaName });
  if (error) {
    // 23505 = unique_violation on (session_id, identity_key) -- already kudos'd, treat as
    // a harmless no-op rather than an error the caller needs to react to
    if (error.code === "23505") return true;
    console.error("giveKudos failed", error);
    return false;
  }
  return true;
}

export async function removeKudos(sessionId: string, identityKey: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("lobby_session_kudos")
    .delete()
    .eq("session_id", sessionId)
    .eq("identity_key", identityKey);
  if (error) {
    console.error("removeKudos failed", error);
    return false;
  }
  return true;
}
