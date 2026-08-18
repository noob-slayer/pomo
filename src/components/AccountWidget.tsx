import { useAuth } from "../context/AuthContext";

export function AccountWidget() {
  const { user, loading, configured, signInWithGoogle, signOut } = useAuth();

  if (!configured || loading) return null;

  if (!user) {
    return (
      <button type="button" className="tasks-toggle" onClick={() => void signInWithGoogle()}>
        sign in
      </button>
    );
  }

  const label = (user.user_metadata?.name as string | undefined) ?? user.email ?? "account";

  return (
    <div className="account-widget">
      <span className="account-widget__name">{label}</span>
      <button type="button" className="link-btn" onClick={() => void signOut()}>
        sign out
      </button>
    </div>
  );
}
