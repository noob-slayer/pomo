// a plain client-side desktop notification for "your session just finished" -- distinct
// from lib/pushNotifications.ts (server-pushed streak reminders, which need a service
// worker + a Supabase subscription + a daily cron job). This one fires directly from the
// tab the instant a session completes, no server round-trip involved.
//
// the chime (lib/sound.ts) already covers the common case, but browsers suspend an
// inactive tab's AudioContext after a while, and a completion firing from a backgrounded
// tab can't force it back on -- that resume attempt isn't a real user gesture, so strict
// autoplay policy can silently drop it. This is the fallback for exactly that case: unlike
// audio, a desktop notification permission, once granted, isn't gated behind a fresh
// gesture to fire.
//
// permission has to be requested *before* completion, while the tab still has the user's
// attention (see requestCompletionPermission, called from a real start-timer click) --
// asking right at completion time, from a backgrounded tab, would itself need a gesture
// that isn't there.

export const NOTIFICATIONS_SUPPORTED = typeof window !== "undefined" && "Notification" in window;

// safe to call on every session start -- once permission has already been decided
// (granted or denied), the browser resolves this immediately without re-prompting
export function requestCompletionPermission(): void {
  if (!NOTIFICATIONS_SUPPORTED || Notification.permission !== "default") return;
  void Notification.requestPermission();
}

export function notifyCompletion(phase: "focus" | "break", taskTitle: string | null): void {
  if (!NOTIFICATIONS_SUPPORTED || Notification.permission !== "granted") return;
  // skip while the tab is right there in front of the user -- the chime already covers
  // this case, and a system popup over an already-visible tab reads as redundant noise
  if (document.visibilityState === "visible" && document.hasFocus()) return;

  try {
    const title = phase === "focus" ? "focus session complete" : "break's over";
    const body =
      phase === "focus"
        ? taskTitle
          ? `nice work on "${taskTitle}" — back to pomo?`
          : "nice work — back to pomo?"
        : "back to it whenever you're ready.";
    const n = new Notification(title, { body, icon: "/pomo-icon.png", tag: "pomo-completion" });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // some platforms report "granted" but still throw on `new Notification()` (e.g. iOS
    // Safari home-screen quirks) -- never let this break the completion flow
  }
}
