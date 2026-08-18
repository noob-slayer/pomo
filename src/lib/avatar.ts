// guest (not signed in) users still get a persona in the top-right ribbon -- a small
// deterministic emoji + color pair, persisted per-browser so it doesn't reshuffle on
// every reload, without needing an external avatar service.
const GUEST_EMOJIS = ["🦊", "🐼", "🐧", "🐨", "🦉", "🐢", "🐙", "🦄", "🐝", "🦋", "🐬", "🐿️"];
const GUEST_COLORS = ["#8A234E", "#2F6F4E", "#2A4B7C", "#6E5A45", "#B08900", "#5A4B8A"];

export function getGuestAvatarSeed(): number {
  try {
    const stored = window.localStorage.getItem("pomo:guestAvatarSeed");
    if (stored) return Number(stored);
    const seed = Math.floor(Math.random() * 1000);
    window.localStorage.setItem("pomo:guestAvatarSeed", String(seed));
    return seed;
  } catch {
    return 0;
  }
}

export function guestAvatarEmoji(seed: number): string {
  return GUEST_EMOJIS[seed % GUEST_EMOJIS.length];
}

export function guestAvatarColor(seed: number): string {
  return GUEST_COLORS[seed % GUEST_COLORS.length];
}
