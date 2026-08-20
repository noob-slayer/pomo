import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, supabaseUrl, supabaseAnonKey } from "./supabaseClient";
import type { Phase } from "../types";

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

// a full "what's happening right now" snapshot, persisted on the lobby row so a member
// who joins or reloads mid-session can catch up instead of waiting for the next action.
//
// deliberately a full state snapshot, not just the last SyncAction + timestamp (an earlier
// version was exactly that, and only start/stop ever wrote it) -- a joiner/reloader has no
// way to reconstruct "currently paused, with 12:34 left" from "someone started a 25:00
// focus session 6 minutes ago" alone, and treating the gap since that stale timestamp as
// still-running time silently ignored however long the timer had actually been paused for,
// overwriting an already-correct local session with a wrong one on every reload. Every
// sync-relevant action (start/pause/resume/reset) now writes a fresh, complete snapshot;
// stop clears it via clearSyncState instead of writing an "idle" one.
export interface LobbySyncState {
  phase: Phase;
  status: "running" | "paused"; // idle is represented by no sync_state at all
  targetSeconds: number | null;
  remainingSeconds: number; // meaningful when targetSeconds !== null
  elapsedSeconds: number; // meaningful when targetSeconds === null (open-ended break)
  at: number; // ms epoch this snapshot was taken -- a "running" snapshot's remaining/elapsed
  // is exactly as of this moment; a catching-up client adds (or subtracts) whatever's
  // elapsed since. A "paused" snapshot doesn't advance, so `at` isn't used to adjust it.
}

// every caller of writeSyncState/clearSyncState immediately follows a start/pause/resume/
// stop/reset -- exactly the moment someone is most likely to also close the tab or hit
// reload (confirmed while testing this: reloading ~80ms after pressing start reliably
// aborts a normal fetch() before it reaches Supabase, since the browser cancels in-flight
// requests belonging to a document that's navigating away). A lost write here isn't just
// "this device shows stale data" -- the write is *the* persisted snapshot every other
// member's reload/join catch-up reads, so losing it desyncs the whole lobby: confirmed a
// third person joining right after such a lost write saw the lobby as fully idle while a
// session was actually running for everyone already connected.
//
// `keepalive: true` is the standard fix for exactly this (the same mechanism
// navigator.sendBeacon uses under the hood, but keepalive fetch also supports the
// Authorization header RLS needs here, which sendBeacon can't send) -- the browser keeps
// the request alive past document unload instead of cancelling it. supabase-js's query
// builder doesn't expose a per-call keepalive option, so this bypasses it for just these
// two calls and hits the REST endpoint directly with the same shape postgrest-js would
// have sent.
async function patchSyncState(lobbyId: string, syncState: LobbySyncState | null): Promise<void> {
  if (!supabase || !supabaseUrl || !supabaseAnonKey) return;
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token ?? supabaseAnonKey;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/lobbies?id=eq.${encodeURIComponent(lobbyId)}`, {
      method: "PATCH",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ sync_state: syncState }),
    });
    if (!res.ok) console.error("patchSyncState failed", res.status, await res.text().catch(() => ""));
  } catch (err) {
    console.error("patchSyncState failed", err);
  }
}

export async function writeSyncState(lobbyId: string, state: LobbySyncState): Promise<void> {
  await patchSyncState(lobbyId, state);
}

export async function clearSyncState(lobbyId: string): Promise<void> {
  await patchSyncState(lobbyId, null);
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

// live "someone kudos'd your session" notifications -- deliberately a separate ephemeral
// broadcast channel from the sync one above, and connected whenever a lobby is active
// regardless of individual/sync mode (sync's channel only connects for mode === "sync").
// The kudos write itself already goes to the database (lobby_session_kudos, read back via
// polling on the team stats page) -- this broadcast is purely a same-session "notify me
// right now if I'm around" nudge on top of that, not the source of truth, so a missed
// broadcast (tab closed, channel not yet connected) just means no toast, never stale data.
export interface KudosNotification {
  toIdentityKey: string;
  fromPersonaName: string;
  taskTitle: string | null;
}

function kudosChannelName(lobbyId: string): string {
  return `pomo-lobby-kudos-${lobbyId}`;
}

export function connectKudosNotifications(
  lobbyId: string,
  onKudos: (notification: KudosNotification) => void,
): RealtimeChannel | null {
  if (!supabase) return null;
  const channel = supabase.channel(kudosChannelName(lobbyId), { config: { broadcast: { self: false } } });
  channel.on("broadcast", { event: "kudos" }, ({ payload }) => onKudos(payload as KudosNotification));
  channel.subscribe();
  return channel;
}

// sends on a channel the caller already has open (e.g. Shell's own kudos-notification
// listener for the active lobby) -- reusing it instead of opening a second one matters:
// a client can only have one subscription per topic on its single websocket, and joining
// the same topic twice in the same tab leaves the second .subscribe() call hanging
// forever (confirmed while building this -- the giver very often has the lobby they're
// kudos-ing in as their own active lobby too, so this isn't a rare edge case).
export function sendKudosOnChannel(channel: RealtimeChannel, notification: KudosNotification): void {
  void channel.send({ type: "broadcast", event: "kudos", payload: notification });
}

// fallback for lobbies with no channel already open in this tab (e.g. kudos given from
// the team stats page's lobby-history picker, on a lobby other than the active one) --
// opens a short-lived one just for this send, waits for it to actually subscribe (a send
// before that can be silently dropped), then lets it go
export function broadcastKudos(lobbyId: string, notification: KudosNotification): void {
  if (!supabase) return;
  const channel = supabase.channel(kudosChannelName(lobbyId), { config: { broadcast: { self: false } } });
  channel.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    sendKudosOnChannel(channel, notification);
    setTimeout(() => void channel.unsubscribe(), 1000);
  });
}
