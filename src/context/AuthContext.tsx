import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

interface AuthContextValue {
  user: User | null;
  // present for BOTH a real signed-in user and an anonymous guest session -- unlike
  // `user` (which stays null for anonymous sessions, see below), this is what lobby code
  // should use as identity_key. Only null before the initial session/bootstrap resolves,
  // or if Supabase isn't configured at all.
  identityUserId: string | null;
  loading: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // `rawUser` is whatever Supabase's session actually holds, anonymous or real. `user`
  // (derived below) deliberately stays null for an anonymous session -- every existing
  // consumer (onboarding's name-picker gate, cloud sync of tasks/settings, the account
  // widget's profile display) already treats "user is non-null" as "this is a real,
  // signed-in account", and an anonymous guest is neither.
  const [rawUser, setRawUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const user = rawUser && !rawUser.is_anonymous ? rawUser : null;
  const identityUserId = rawUser?.id ?? null;

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let cancelled = false;

    client.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setRawUser(data.session.user);
        setLoading(false);
        return;
      }
      // no session at all yet -- bootstrap an anonymous one so every visitor, guest or
      // not, has a real server-verifiable identity behind their lobby activity from the
      // start (see supabase/lobby_identity_hardening.sql: RLS now checks
      // identity_key = auth.uid() for row ownership, which needs a real auth.uid() to
      // exist even for guests)
      const { data: anon, error } = await client.auth.signInAnonymously();
      if (cancelled) return;
      if (error) console.error("anonymous sign-in failed", error);
      setRawUser(anon?.session?.user ?? null);
      setLoading(false);
    });
    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setRawUser(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    // tasks/history/settings (including personaName, currentLobby, themes) are cached in
    // localStorage regardless of sign-in state -- that's what lets a signed-in user's
    // data render instantly without waiting on a fetch. But it means simply clearing the
    // Supabase session leaves all of *this* account's data sitting there, fully visible,
    // for whoever uses the browser next -- exactly what was reported ("still seeing sign
    // in + task history with my persona name, but I am logged out"). Clear the local
    // mirrors too, then reload: the various useLocalStorage-backed contexts only read
    // localStorage once on mount, so clearing the keys alone wouldn't update the
    // already-rendered UI without a fresh load.
    try {
      window.localStorage.removeItem("pomo:tasks");
      window.localStorage.removeItem("pomo:history");
      window.localStorage.removeItem("pomo:settings");
      window.localStorage.removeItem("pomo:activeSession");
    } catch {
      // storage unavailable -- the reload below still forces a clean re-fetch of nothing,
      // since there's no session left to sync from anyway
    }
    window.location.reload();
  };

  return (
    <AuthContext.Provider
      value={{ user, identityUserId, loading, configured: isSupabaseConfigured, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
