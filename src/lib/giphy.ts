// GIPHY sticker search for lobby chat -- licensed, transparent cut-out stickers (celebs,
// movies, memes), the same source WhatsApp/Instagram use. Search needs VITE_GIPHY_API_KEY
// (a free "API" key from developers.giphy.com); without it the memes tab simply doesn't
// show. *Displaying* a received GIPHY sticker needs no key, so a device without one still
// renders stickers others send. GIPHY's terms require the "Powered by GIPHY" attribution
// wherever search results are shown (see LobbyChat).
const API_KEY = import.meta.env.VITE_GIPHY_API_KEY as string | undefined;

export const GIPHY_ENABLED = !!API_KEY;

export interface GiphySticker {
  id: string;
  title: string;
  previewUrl: string; // small, for the picker grid
  url: string; // what's sent and shown in the chat
  width: number;
  height: number;
}

interface GiphyImage {
  url?: string;
  webp?: string;
  width?: string;
  height?: string;
}

interface GiphyItem {
  id: string;
  title?: string;
  images: Record<string, GiphyImage | undefined>;
}

// only GIPHY's own media hosts are ever rendered -- a chat message is plain broadcast data
// that any client can craft, so an arbitrary image URL must never make it into an <img>
const GIPHY_MEDIA = /^https:\/\/(media\d*|i)\.giphy\.com\//;

export function isGiphyMediaUrl(url: unknown): url is string {
  return typeof url === "string" && GIPHY_MEDIA.test(url);
}

function toSticker(item: GiphyItem): GiphySticker | null {
  const main = item.images.fixed_width;
  const small = item.images.fixed_width_small ?? main;
  const url = main?.webp || main?.url;
  const previewUrl = small?.webp || small?.url;
  if (!isGiphyMediaUrl(url) || !isGiphyMediaUrl(previewUrl)) return null;
  // GIPHY titles read like "Happy Dance Sticker by Netflix" -- keep the useful part
  const title = (item.title || "sticker").replace(/\s+sticker\b.*$/i, "").trim() || "sticker";
  return {
    id: item.id,
    title,
    previewUrl,
    url,
    width: Number(main?.width) || 200,
    height: Number(main?.height) || 200,
  };
}

// empty query -> trending stickers
export async function fetchStickers(query: string, signal?: AbortSignal): Promise<GiphySticker[]> {
  if (!API_KEY) return [];
  const q = query.trim();
  const params = new URLSearchParams({ api_key: API_KEY, limit: "24", rating: "pg-13" });
  if (q) params.set("q", q);
  const endpoint = q ? "search" : "trending";
  const res = await fetch(`https://api.giphy.com/v1/stickers/${endpoint}?${params}`, { signal });
  if (!res.ok) throw new Error(`giphy ${res.status}`);
  const body = (await res.json()) as { data?: GiphyItem[] };
  return (body.data ?? []).map(toSticker).filter((s): s is GiphySticker => s !== null);
}
