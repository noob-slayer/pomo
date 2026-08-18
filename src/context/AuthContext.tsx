import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.subscription.unsubscribe();
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
    <AuthContext.Provider value={{ user, loading, configured: isSupabaseConfigured, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
