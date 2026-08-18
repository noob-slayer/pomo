import type { Mode, WorkTheme } from "../types";

export interface SharedSession {
  m: Mode;
  wt?: WorkTheme;
  fm: number; // focus minutes
}

export function buildShareUrl(payload: SharedSession): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("s", JSON.stringify(payload));
  return url.toString();
}

export function parseShareFromLocation(): SharedSession | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("s");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if ((parsed.m !== "work" && parsed.m !== "personal") || typeof parsed.fm !== "number") return null;
    return parsed as SharedSession;
  } catch {
    return null;
  }
}

export function clearShareFromLocation(): void {
  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState({}, "", url.toString());
}

export function whatsappShareUrl(link: string): string {
  const text = `focus with me — ${link}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
