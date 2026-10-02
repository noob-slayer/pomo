import { supabase } from "./supabaseClient";
import type { Phase, Status } from "../types";

// "self sync" -- keeps ONE account's own timer in step across its own open devices (laptop +
// phone), in or out of a lobby. Every device continuously broadcasts a full snapshot of its
// timer; a device that opens late, reloads, or returns from the background sends a "hello" and
// its connected peers immediately re-broadcast, so it catches up from whatever they're showing
// *right now*.
//
// Broadcast, NOT Realtime Presence: presence diffs on this project's Realtime are slow and
// unreliable (measured 3-4s, often dropped), which is exactly why a phone kept sitting on its
// own stale state instead of adopting the tablet's live timer. Broadcast lands in ~30ms (same
// change made for lobby presence in the prior PR). A bonus of broadcast being ephemeral: a
// device that's actually closed sends nothing, so it never appears as a peer -- a long-closed
// laptop's stale snapshot can no longer win over a freshly-opened phone.
//
// Conflict rule: the snapshot with the newest `actionAt` (the last real start/pause/resume/
// stop/reset anywhere) wins. On a tie -- the same action seen by two devices that now disagree,
// typically because one reloaded and restored its pagehide "paused" snapshot -- the device
// that has been up longer (`bootAt`) is trusted, since it never went through that reload.
export interface SelfSnapshot {
  deviceId: string;
  ownerDeviceId: string; // the device whose action started this state -- it logs the history
  actionAt: number;
  bootAt: number;
  phase: Phase;
  status: Status;
  targetSeconds: number | null;
  remainingSeconds: number;
  elapsedSeconds: number;
  taskId: string | null;
  taskTitle: string | null;
  at: number; // ms epoch the snapshot was taken; running values are exact as of this moment
}

// a peer we haven't heard a broadcast from within this window is treated as gone (its tab
// closed / device asleep), dropped from the roster, and no longer considered by reconcile or
// by logIfOwner's "is the owner still around" check. Generous (many heartbeats) so a merely
// backgrounded device mid-session isn't dropped and yanked away from the others.
export const SELF_STALE_MS = 90000;
export const SELF_HEARTBEAT_MS = 8000;
// how often to re-check for peers that have gone silent (they send nothing, so only this
// sweep can drop them)
const SELF_SWEEP_MS = 3000;

// per tab (sessionStorage), so it survives a reload of this tab but two tabs are two devices
export function getDeviceId(): string {
  try {
    const existing = window.sessionStorage.getItem("pomo:deviceId");
    if (existing) return existing;
    const id = Math.random().toString(36).slice(2, 10);
    window.sessionStorage.setItem("pomo:deviceId", id);
    return id;
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

export interface SelfSyncMeta {
  actionAt: number;
  ownerDeviceId: string | null;
}

export function readSelfSyncMeta(): SelfSyncMeta {
  try {
    const raw = window.localStorage.getItem("pomo:selfSync");
    if (raw) return JSON.parse(raw) as SelfSyncMeta;
  } catch {
    // unavailable or corrupt -- start fresh
  }
  return { actionAt: 0, ownerDeviceId: null };
}

export function writeSelfSyncMeta(meta: SelfSyncMeta): void {
  try {
    window.localStorage.setItem("pomo:selfSync", JSON.stringify(meta));
  } catch {
    // storage unavailable -- in-memory refs still carry it for this session
  }
}

export interface SelfSyncConnection {
  // broadcast this device's current snapshot now -- a no-op until subscribed
  announce: () => void;
  // leave the channel and stop the staleness sweep
  dispose: () => void;
}

// `getSelf` supplies this device's current snapshot on demand (with a fresh `at`); `onPeers`
// is called with the live peer list whenever it changes, including when a peer ages out.
//
// async because a previous channel on the same topic must be fully gone first: supabase-js
// only drops a channel from its registry once the server acks the leave, and until then
// channel() hands back that same dying instance -- so a quick leave + rejoin (React StrictMode's
// double effect, or the re-run when sign-in settles right after a reload) bound its listeners
// to a channel that was closing, and this device silently never heard from its peers again.
export async function connectSelfSync(
  identityKey: string,
  deviceId: string,
  getSelf: () => SelfSnapshot,
  onPeers: (peers: SelfSnapshot[]) => void,
  isCancelled: () => boolean,
): Promise<SelfSyncConnection | null> {
  if (!supabase) return null;
  const topic = `pomo-self-${identityKey}`;
  const stale = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`);
  if (stale) await supabase.removeChannel(stale);
  if (isCancelled()) return null;
  // deliberately a PUBLIC channel (unlike the lobby channels, which are private). Making it
  // private gated it behind realtime RLS + a live auth token, which added failure modes a
  // personal cross-device timer sync shouldn't have -- a token race on a slow device, and
  // (most visibly) a device on old cached code joining as public while a freshly-deployed
  // device joins as private, which silently never sync. The only thing this channel carries
  // is your own timer state to your own devices; the residual exposure (a lobby co-member who
  // digs out your uid could watch it) is low, and reliability of the sync wins here.
  const channel = supabase.channel(topic, { config: { broadcast: { self: false } } });

  const peers = new Map<string, SelfSnapshot>();
  let subscribed = false;

  const emit = (force: boolean) => {
    const now = Date.now();
    let changed = force;
    for (const [id, s] of peers) {
      if (now - s.at > SELF_STALE_MS) {
        peers.delete(id);
        changed = true;
      }
    }
    if (changed) onPeers([...peers.values()]);
  };

  const announce = () => {
    if (!subscribed) return; // a send before SUBSCRIBED is silently dropped
    void channel.send({ type: "broadcast", event: "snapshot", payload: getSelf() });
  };

  channel.on("broadcast", { event: "snapshot" }, ({ payload }) => {
    const s = payload as SelfSnapshot;
    if (!s?.deviceId || s.deviceId === deviceId) return;
    peers.set(s.deviceId, s);
    emit(true);
  });
  // a device that just opened / reloaded / woke asks everyone to re-announce, so it catches
  // up immediately instead of waiting for the next heartbeat (broadcast is ephemeral -- it
  // never saw our earlier snapshot).
  channel.on("broadcast", { event: "hello" }, () => announce());

  channel.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    subscribed = true;
    announce(); // publish our state...
    void channel.send({ type: "broadcast", event: "hello", payload: {} }); // ...and pull theirs
  });

  const sweep = setInterval(() => emit(false), SELF_SWEEP_MS);

  return {
    announce,
    dispose: () => {
      clearInterval(sweep);
      void supabase?.removeChannel(channel);
    },
  };
}

// a peer's running countdown/elapsed as of right now, from its snapshot time
export function liveValues(s: SelfSnapshot, now = Date.now()): { remaining: number; elapsed: number } {
  if (s.status !== "running") return { remaining: s.remainingSeconds, elapsed: s.elapsedSeconds };
  const since = Math.max(0, (now - s.at) / 1000);
  if (s.targetSeconds === null) return { remaining: 0, elapsed: s.elapsedSeconds + since };
  return { remaining: Math.max(0, Math.min(s.targetSeconds, s.remainingSeconds - since)), elapsed: 0 };
}
