import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import type { Phase, Status } from "../types";

// "self sync" -- keeps ONE account's own timer in step across its own open devices (laptop +
// phone), in or out of a lobby. Built on Realtime Presence rather than broadcast: every device
// continuously publishes a full snapshot of its timer, so a device that opens late, reloads,
// or comes back from the background catches up from whatever its peers are showing *right
// now* -- a broadcast-only design (the previous version) only reached devices that happened
// to be connected at the exact moment of the action.
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

export const SELF_STALE_MS = 90000; // only for "is the owning device still around" -- see logIfOwner
export const SELF_HEARTBEAT_MS = 8000;

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

// async because a previous channel on the same topic must be fully gone first: supabase-js
// only drops a channel from its registry once the server acks the leave, and until then
// channel() hands back that same dying instance -- so a quick leave + rejoin (React StrictMode's
// double effect, or the re-run when sign-in settles right after a reload) bound its listeners
// to a channel that was closing, and this device silently never heard from its peers again.
export async function connectSelfSync(
  identityKey: string,
  deviceId: string,
  onPeers: (peers: SelfSnapshot[]) => void,
  onSubscribed: () => void,
  isCancelled: () => boolean,
): Promise<RealtimeChannel | null> {
  if (!supabase) return null;
  const topic = `pomo-self-${identityKey}`;
  const stale = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`);
  if (stale) await supabase.removeChannel(stale);
  if (isCancelled()) return null;
  const channel = supabase.channel(topic, { config: { private: true, presence: { key: deviceId } } });
  const rebuild = () => {
    const state = channel.presenceState<SelfSnapshot>();
    const peers: SelfSnapshot[] = [];
    for (const key of Object.keys(state)) {
      if (key === deviceId) continue;
      const metas = state[key];
      // newest snapshot by its own timestamp -- a re-track across a reconnect can leave an
      // older meta listed after the current one, and trusting list order let a stale
      // pre-resume snapshot win on a peer that had just reloaded
      if (metas && metas.length) peers.push(metas.reduce((a, b) => (b.at > a.at ? b : a)));
    }
    onPeers(peers);
  };
  channel.on("presence", { event: "sync" }, rebuild);
  channel.on("presence", { event: "join" }, rebuild);
  channel.on("presence", { event: "leave" }, rebuild);
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") onSubscribed();
  });
  return channel;
}

// a peer's running countdown/elapsed as of right now, from its snapshot time
export function liveValues(s: SelfSnapshot, now = Date.now()): { remaining: number; elapsed: number } {
  if (s.status !== "running") return { remaining: s.remainingSeconds, elapsed: s.elapsedSeconds };
  const since = Math.max(0, (now - s.at) / 1000);
  if (s.targetSeconds === null) return { remaining: 0, elapsed: s.elapsedSeconds + since };
  return { remaining: Math.max(0, Math.min(s.targetSeconds, s.remainingSeconds - since)), elapsed: 0 };
}
