import { useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useClickAway } from "../hooks/useClickAway";
import { getGuestAvatarSeed, guestAvatarColor, guestAvatarEmoji } from "../lib/avatar";
import { IconStats, IconLogin, IconLogout } from "./icons";

interface AccountWidgetProps {
  onOpenStats: () => void;
}

export function AccountWidget({ onOpenStats }: AccountWidgetProps) {
  const { user, loading, configured, signInWithGoogle, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  useClickAway(widgetRef, () => setOpen(false), open);

  if (!configured || loading) return null;

  const label = user ? ((user.user_metadata?.name as string | undefined) ?? user.email ?? "account") : "guest";
  const avatarUrl = user
    ? ((user.user_metadata?.avatar_url ?? user.user_metadata?.picture) as string | undefined)
    : undefined;
  const seed = getGuestAvatarSeed();

  return (
    <div className="account-widget" ref={widgetRef}>
      <button
        type="button"
        className="account-avatar"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={label}
        style={avatarUrl ? undefined : { background: guestAvatarColor(seed) }}
      >
        {avatarUrl ? <img className="account-avatar__img" src={avatarUrl} alt="" /> : guestAvatarEmoji(seed)}
      </button>
      {open && (
        <div className="account-menu">
          <p className="account-menu__label">{label}</p>
          <button
            type="button"
            className="account-menu__item"
            onClick={() => {
              onOpenStats();
              setOpen(false);
            }}
          >
            <IconStats />
            stats
          </button>
          {user ? (
            <button
              type="button"
              className="account-menu__item"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
            >
              <IconLogout />
              sign out
            </button>
          ) : (
            <button
              type="button"
              className="account-menu__item"
              onClick={() => {
                setOpen(false);
                void signInWithGoogle();
              }}
            >
              <IconLogin />
              sign in
            </button>
          )}
        </div>
      )}
    </div>
  );
}
