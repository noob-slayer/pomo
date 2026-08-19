import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useClickAway } from "../hooks/useClickAway";
import { getGuestAvatarSeed, guestAvatarColor, guestAvatarEmoji } from "../lib/avatar";
import {
  fetchMyPublicProfile,
  enablePublicProfile,
  disablePublicProfile,
  buildPublicProfileUrl,
  type PublicProfileSettings,
} from "../lib/publicProfile";
import { PUSH_SUPPORTED, getPushSubscriptionStatus, subscribeToPush, unsubscribeFromPush } from "../lib/pushNotifications";
import { IconStats, IconLogin, IconLogout, IconEdit, IconShare, IconBell } from "./icons";

interface AccountWidgetProps {
  onOpenStats: () => void;
}

export function AccountWidget({ onOpenStats }: AccountWidgetProps) {
  const { user, loading, configured, signInWithGoogle, signOut } = useAuth();
  const { personaName, setPersonaName } = useSettings();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameInput, setRenameInput] = useState("");
  const [sharing, setSharing] = useState(false);
  const [profile, setProfile] = useState<PublicProfileSettings | null | "loading">("loading");
  const [copied, setCopied] = useState(false);
  const [reminders, setReminders] = useState(false);
  const [remindersOn, setRemindersOn] = useState<boolean | "loading">("loading");
  const [remindersError, setRemindersError] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  useClickAway(widgetRef, () => setOpen(false), open);

  // the avatar/stats shortcut is useful even without Supabase configured (guest-only
  // mode) -- only the sign in/out option itself depends on `configured`
  if (loading) return null;

  const label = personaName || (user ? ((user.user_metadata?.name as string | undefined) ?? user.email ?? "account") : "guest");
  const avatarUrl = user
    ? ((user.user_metadata?.avatar_url ?? user.user_metadata?.picture) as string | undefined)
    : undefined;
  const seed = getGuestAvatarSeed();

  const startRename = () => {
    setRenameInput(personaName);
    setRenaming(true);
  };

  const submitRename = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = renameInput.trim();
    if (!trimmed) return;
    setPersonaName(trimmed);
    setRenaming(false);
  };

  const startSharing = async () => {
    setSharing(true);
    setProfile("loading");
    if (!user) return;
    setProfile(await fetchMyPublicProfile(user.id));
  };

  const handleEnableSharing = async () => {
    if (!user) return;
    setProfile("loading");
    setProfile(await enablePublicProfile(user.id, personaName || "member"));
  };

  const handleDisableSharing = async () => {
    if (!user || !profile || profile === "loading") return;
    const ok = await disablePublicProfile(user.id);
    if (ok) setProfile({ ...profile, enabled: false });
  };

  const copyProfileLink = async () => {
    if (!profile || profile === "loading") return;
    try {
      await navigator.clipboard.writeText(buildPublicProfileUrl(profile.slug));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked -- the link is still visible in the input to copy manually
    }
  };

  const startReminders = async () => {
    setReminders(true);
    setRemindersError(null);
    setRemindersOn("loading");
    setRemindersOn(await getPushSubscriptionStatus());
  };

  const handleEnableReminders = async () => {
    if (!user) return;
    setRemindersError(null);
    setRemindersOn("loading");
    const ok = await subscribeToPush(user.id);
    if (!ok) {
      setRemindersError("couldn't enable reminders — check that notifications are allowed for this site");
      setRemindersOn(false);
      return;
    }
    setRemindersOn(true);
  };

  const handleDisableReminders = async () => {
    if (!user) return;
    setRemindersOn("loading");
    await unsubscribeFromPush(user.id);
    setRemindersOn(false);
  };

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
      {open &&
        (renaming ? (
          <form className="account-menu" onSubmit={submitRename}>
            <input
              className="account-menu__rename-input"
              autoFocus
              placeholder="your name"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
            />
            <div className="account-menu__rename-actions">
              <button type="button" className="chip" onClick={() => setRenaming(false)}>
                cancel
              </button>
              <button type="submit" className="account-menu__rename-save" disabled={!renameInput.trim()}>
                save
              </button>
            </div>
          </form>
        ) : sharing ? (
          <div className="account-menu">
            <p className="account-menu__label">share profile</p>
            {profile === "loading" ? (
              <p className="account-menu__hint">loading…</p>
            ) : profile && profile.enabled ? (
              <>
                <p className="account-menu__hint">
                  anyone with this link can see your work-mode streak, hours, and badges — no task names, no
                  personal-mode data.
                </p>
                <input
                  className="account-menu__rename-input"
                  readOnly
                  value={buildPublicProfileUrl(profile.slug)}
                  onFocus={(e) => e.target.select()}
                />
                <div className="account-menu__rename-actions">
                  <button type="button" className="chip" onClick={() => void copyProfileLink()}>
                    {copied ? "copied" : "copy link"}
                  </button>
                  <button type="button" className="chip" onClick={() => void handleDisableSharing()}>
                    make private
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="account-menu__hint">
                  a public, read-only link showing your work-mode streak, hours, and badges — no task names, no
                  personal-mode data.
                </p>
                <button type="button" className="account-menu__rename-save" onClick={() => void handleEnableSharing()}>
                  make it public
                </button>
              </>
            )}
            <button type="button" className="chip" onClick={() => setSharing(false)}>
              back
            </button>
          </div>
        ) : reminders ? (
          <div className="account-menu">
            <p className="account-menu__label">streak reminders</p>
            {remindersOn === "loading" ? (
              <p className="account-menu__hint">loading…</p>
            ) : remindersOn ? (
              <>
                <p className="account-menu__hint">
                  you'll get a notification if your streak is about to end and you haven't focused yet today.
                </p>
                <button type="button" className="account-menu__rename-save" onClick={() => void handleDisableReminders()}>
                  turn off
                </button>
              </>
            ) : (
              <>
                <p className="account-menu__hint">
                  get a push notification (even with pomo closed) if your streak is about to end and you haven't
                  focused yet today.
                </p>
                {remindersError && <p className="lobby-panel__error">{remindersError}</p>}
                <button type="button" className="account-menu__rename-save" onClick={() => void handleEnableReminders()}>
                  turn on
                </button>
              </>
            )}
            <button type="button" className="chip" onClick={() => setReminders(false)}>
              back
            </button>
          </div>
        ) : (
          <div className="account-menu">
            <p className="account-menu__label">{label}</p>
            <button type="button" className="account-menu__item" onClick={startRename}>
              <IconEdit />
              rename
            </button>
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
            {configured && user && (
              <button type="button" className="account-menu__item" onClick={() => void startSharing()}>
                <IconShare />
                share profile
              </button>
            )}
            {configured && user && PUSH_SUPPORTED && (
              <button type="button" className="account-menu__item" onClick={() => void startReminders()}>
                <IconBell />
                streak reminders
              </button>
            )}
            {configured &&
              (user ? (
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
              ))}
          </div>
        ))}
    </div>
  );
}
