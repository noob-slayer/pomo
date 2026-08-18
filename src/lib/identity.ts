// falls back to this for the lifetime of the tab when localStorage is unavailable
// (Safari private mode, storage disabled) -- generated once per module load, not a fixed
// literal, so two guests in that state don't collide onto the same lobby-member row
let inMemoryGuestId: string | null = null;

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
    if (!inMemoryGuestId) inMemoryGuestId = crypto.randomUUID();
    return inMemoryGuestId;
  }
}

export function resolveIdentityKey(userId: string | null): string {
  return userId ?? getGuestId();
}
