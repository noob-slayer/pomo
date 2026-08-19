import { supabase } from "./supabaseClient";
import type { Mode, Phase, PomoRecord } from "../types";

export interface PublicProfileSettings {
  slug: string;
  enabled: boolean;
  personaName: string;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20) || "user";
}

const SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
function randomSuffix(len = 5): string {
  let s = "";
  for (let i = 0; i < len; i++) s += SUFFIX_ALPHABET[Math.floor(Math.random() * SUFFIX_ALPHABET.length)];
  return s;
}

export async function fetchMyPublicProfile(userId: string): Promise<PublicProfileSettings | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("public_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error || !data) return null;
  return { slug: data.slug, enabled: data.enabled, personaName: data.persona_name };
}

// enabling always leaves the link stable across a disable/re-enable cycle -- reuses the
// existing slug if this user has one already, only minting a fresh one the first time
export async function enablePublicProfile(userId: string, personaName: string): Promise<PublicProfileSettings | null> {
  if (!supabase) return null;
  const existing = await fetchMyPublicProfile(userId);
  if (existing) {
    const { error } = await supabase
      .from("public_profiles")
      .update({ enabled: true, persona_name: personaName })
      .eq("user_id", userId);
    if (error) {
      console.error("enablePublicProfile (update) failed", error);
      return null;
    }
    return { ...existing, enabled: true, personaName };
  }
  // extremely unlikely to collide, but retry with a fresh random suffix rather than fail
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = `${slugify(personaName)}-${randomSuffix()}`;
    const { error } = await supabase
      .from("public_profiles")
      .insert({ user_id: userId, slug, enabled: true, persona_name: personaName });
    if (!error) return { slug, enabled: true, personaName };
    if (error.code !== "23505") {
      console.error("enablePublicProfile failed", error);
      return null;
    }
  }
  return null;
}

export async function disablePublicProfile(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("public_profiles").update({ enabled: false }).eq("user_id", userId);
  if (error) {
    console.error("disablePublicProfile failed", error);
    return false;
  }
  return true;
}

export function buildPublicProfileUrl(slug: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("u", slug);
  return url.toString();
}

export function parsePublicProfileSlugFromLocation(): string | null {
  return new URLSearchParams(window.location.search).get("u");
}

interface PublicProfileRow {
  user_id: string;
  persona_name: string;
}

export async function fetchPublicProfileBySlug(slug: string): Promise<{ personaName: string } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_public_profile", { p_slug: slug });
  if (error || !data || data.length === 0) return null;
  const row = data[0] as PublicProfileRow;
  return { personaName: row.persona_name };
}

interface PublicSessionRow {
  mode: Mode;
  phase: Phase;
  minutes: number;
  completed_at: string;
  completed: boolean;
}

// mapped straight into PomoRecord shape (taskId/taskTitle always null -- the RPC never
// returns them) so every existing stats function in lib/statsExtras.ts and lib/statsCalc.ts
// works unchanged against a public profile's sessions, no parallel aggregate logic needed
export async function fetchPublicProfileSessions(slug: string): Promise<PomoRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_public_profile_sessions", { p_slug: slug });
  if (error || !data) return [];
  return (data as PublicSessionRow[]).map((r, i) => ({
    id: `public-${i}`,
    taskId: null,
    taskTitle: null,
    mode: r.mode,
    phase: r.phase,
    minutes: r.minutes,
    completedAt: new Date(r.completed_at).getTime(),
    completed: r.completed,
  }));
}
