import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

// "sync" mode lobbies: any member's start/pause/resume/stop/reset is broadcast to every
// other member, who applies the same action to their own local timer -- last action
// received wins, no locking. Deliberately carries no task info: each member keeps
// choosing their own task name, only the clock itself stays in lockstep.
export type SyncAction =
  | { type: "startFocus"; minutes: number }
  | { type: "startBreak"; minutes: number | null }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "stop" }
  | { type: "reset" };

function channelName(lobbyId: string): string {
  return `pomo-lobby-sync-${lobbyId}`;
}

export function connectLobbySync(lobbyId: string, onAction: (action: SyncAction) => void): RealtimeChannel | null {
  if (!supabase) return null;
  const channel = supabase.channel(channelName(lobbyId), { config: { broadcast: { self: false } } });
  channel.on("broadcast", { event: "action" }, ({ payload }) => onAction(payload as SyncAction));
  channel.subscribe();
  return channel;
}

export function broadcastSyncAction(channel: RealtimeChannel, action: SyncAction): void {
  void channel.send({ type: "broadcast", event: "action", payload: action });
}

// a small "what's happening right now" snapshot, persisted on the lobby row so a member
// who joins or reloads mid-session can catch up instead of waiting for the next action
export interface LobbySyncState {
  action: SyncAction;
  at: number; // ms epoch, when this action happened -- lets a joiner compute elapsed/remaining
}

export async function writeSyncState(lobbyId: string, state: LobbySyncState): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("lobbies").update({ sync_state: state }).eq("id", lobbyId);
  if (error) console.error("writeSyncState failed", error);
}

export async function readSyncState(lobbyId: string): Promise<LobbySyncState | null> {
  if (!supabase) return null;
  // goes through the same get_lobby RPC as lobby.ts's fetchLobby -- see
  // supabase/lobby_rls_hardening.sql for why direct table reads are locked down
  const { data, error } = await supabase.rpc("get_lobby", { p_id: lobbyId });
  const row = data?.[0] as { sync_state?: LobbySyncState } | undefined;
  if (error || !row?.sync_state) return null;
  return row.sync_state;
}
