import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

// null until VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set (see .env.example) —
// login, cross-device sync, and live shared sessions all stay local-only until then.
export const supabase: SupabaseClient | null = isSupabaseConfigured ? createClient(url!, anonKey!) : null;

// exported for the rare caller that needs a raw REST fetch instead of going through the
// query builder (see lib/lobbySync.ts's writeSyncState/clearSyncState, which need
// `keepalive: true` -- not something the supabase-js client exposes per-call)
export const supabaseUrl = url;
export const supabaseAnonKey = anonKey;
