import type { Station } from "../types";

// curated defaults — long-running, well-known focus streams.
// users can override with their own youtube link at any time.
export const DEFAULT_STATIONS: Station[] = [
  { id: "synthwave", label: "synthwave radio", videoId: "b9IctXpyPCE" },
  { id: "lofi-2", label: "lofi beats to relax/study to", videoId: "5qap5aO4i9A" },
  { id: "cafe", label: "coffee shop ambience", videoId: "lzXucw7xcE8" },
  { id: "deep-focus", label: "chill hiphop, deep focus", videoId: "v8XAikhbTMs" },
];

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
