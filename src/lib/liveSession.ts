import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import type { ResolvedStation } from "./stations";
import type { Mode, Phase, Status, WorkTheme } from "../types";

export interface LiveTick {
  phase: Phase;
  status: Status;
  targetSeconds: number | null;
  remainingSeconds: number;
  elapsedSeconds: number;
  taskTitle: string | null;
  mode: Mode;
  workTheme?: WorkTheme;
  station: ResolvedStation;
}

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no ambiguous chars (0/o, 1/l/i)

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}

function channelName(code: string): string {
  return `pomo-room-${code}`;
}

export function hostRoom(code: string, onReady?: (ready: boolean) => void): RealtimeChannel | null {
  if (!supabase) return null;
  const channel = supabase.channel(channelName(code), { config: { broadcast: { self: false } } });
  channel.subscribe((status) => onReady?.(status === "SUBSCRIBED"));
  return channel;
}

export function broadcastTick(channel: RealtimeChannel, tick: LiveTick): void {
  void channel.send({ type: "broadcast", event: "tick", payload: tick });
}

export function joinRoom(
  code: string,
  onTick: (tick: LiveTick) => void,
  onStatus?: (status: string) => void,
): RealtimeChannel | null {
  if (!supabase) return null;
  const channel = supabase.channel(channelName(code), { config: { broadcast: { self: false } } });
  channel.on("broadcast", { event: "tick" }, ({ payload }) => onTick(payload as LiveTick));
  channel.subscribe((status) => onStatus?.(status));
  return channel;
}

export function buildRoomUrl(code: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("room", code);
  return url.toString();
}

export function parseRoomFromLocation(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("room");
}
