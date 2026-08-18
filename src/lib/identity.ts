// a stable per-browser id for guests, distinct from the small avatar-seed number in
// avatar.ts. Used as a lobby identity_key when there's no signed-in Google account --
// keeps a guest's repeat visits (same browser) recognizable as the same lobby member,
// without relying on their persona name (which anyone could also type in).
export function getGuestId(): string {
  try {
    const stored = window.localStorage.getItem("pomo:guestId");
    if (stored) return stored;
    const id = crypto.randomUUID();
    window.localStorage.setItem("pomo:guestId", id);
    return id;
  } catch {
    return "guest";
  }
}

export function resolveIdentityKey(userId: string | null): string {
  return userId ?? getGuestId();
}
