import type { Station } from "../types";

// curated defaults — long-running, well-known focus streams.
// users can override with their own youtube link at any time.
export const DEFAULT_STATIONS: Station[] = [
  { id: "synthwave", label: "synthwave radio", videoId: "b9IctXpyPCE" },
  { id: "lofi-2", label: "lofi beats to relax/study to", videoId: "5qap5aO4i9A" },
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

const WATCH_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/;
const PLAYLIST_RE = /[?&]list=([a-zA-Z0-9_-]+)/;

export type ParsedYoutubeInput =
  | { type: "video"; id: string }
  | { type: "playlist"; id: string }
  | null;

export function parseYoutubeInput(raw: string): ParsedYoutubeInput {
  const value = raw.trim();
  if (!value) return null;

  const playlistMatch = value.match(PLAYLIST_RE);
  if (playlistMatch) return { type: "playlist", id: playlistMatch[1] };

  const watchMatch = value.match(WATCH_RE);
  if (watchMatch) return { type: "video", id: watchMatch[1] };

  // bare 11-char video id
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return { type: "video", id: value };

  return null;
}
