import type { Station } from "../types";

// curated defaults — long-running, well-known focus streams.
// users can override with their own youtube link at any time.
export const DEFAULT_STATIONS: Station[] = [
  { id: "synthwave", label: "synthwave radio", videoId: "b9IctXpyPCE" },
  // the old id (5qap5aO4i9A) went dead -- Lofi Girl rotates the actual video id behind
  // their perpetual livestream periodically, so this one (pulled from
  // youtube.com/@LofiGirl/live) can go stale again the same way eventually
  { id: "lofi-2", label: "lofi beats to relax/study to", videoId: "0muHFBSiybw" },
  { id: "cafe", label: "coffee shop ambience", videoId: "lzXucw7xcE8" },
  { id: "deep-focus", label: "chill hiphop, deep focus", videoId: "v8XAikhbTMs" },
];

export interface ResolvedStation {
  type: "video" | "playlist";
  id: string;
  label: string;
}

export function resolveStation(activeStationId: string, customStation: ResolvedStation | null): ResolvedStation {
  if (customStation) return customStation;
  const station = DEFAULT_STATIONS.find((s) => s.id === activeStationId) ?? DEFAULT_STATIONS[0];
  return { type: "video", id: station.videoId, label: station.label };
}

export function stationEmbedSrc(station: ResolvedStation, autoplay = true): string {
  const params = new URLSearchParams({ rel: "0" });
  if (autoplay) params.set("autoplay", "1");
  if (station.type === "playlist") {
    params.set("list", station.id);
    return `https://www.youtube.com/embed/videoseries?${params.toString()}`;
  }
  return `https://www.youtube.com/embed/${station.id}?${params.toString()}`;
}

// chromeless, unmuted background embed for a user-supplied link -- deliberately skips
// loop/playlist=self (see the lofi-2 fix above: that combo makes YouTube reject a
// livestream link with "video unavailable", and a pasted link here could well be one)
export function youtubeBackgroundEmbedSrc(parsed: { type: "video" | "playlist"; id: string }): string {
  const params = new URLSearchParams({
    rel: "0",
    autoplay: "1",
    controls: "0",
    modestbranding: "1",
    disablekb: "1",
    fs: "0",
    playsinline: "1",
  });
  if (parsed.type === "playlist") {
    params.set("list", parsed.id);
    return `https://www.youtube.com/embed/videoseries?${params.toString()}`;
  }
  return `https://www.youtube.com/embed/${parsed.id}?${params.toString()}`;
}

const WATCH_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/;
const PLAYLIST_RE = /[?&]list=([a-zA-Z0-9_-]+)/;

export type ParsedYoutubeInput =
  | { type: "video"; id: string }
  | { type: "playlist"; id: string }
  | null;

export function parseYoutubeInput(raw: string): ParsedYoutubeInput {
  const value = raw.trim();
  if (!value) return null;

  // check video first: most pasted links (especially from the YouTube app) carry an
  // auto-appended "&list=RD..." radio-mix param alongside "v=" — if playlist won that
  // race, pasting a specific video would silently play YouTube's related mix instead.
  const watchMatch = value.match(WATCH_RE);
  if (watchMatch) return { type: "video", id: watchMatch[1] };

  const playlistMatch = value.match(PLAYLIST_RE);
  if (playlistMatch) return { type: "playlist", id: playlistMatch[1] };

  // bare 11-char video id
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return { type: "video", id: value };

  return null;
}
