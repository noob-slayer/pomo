// Hand-curated "what's new" for the changelog modal. Deliberately not generated from git
// commits -- those are too noisy (deploy retries, favicon flip-flops, internal fixes) and
// read like a diff, not a product update. Newest group first; keep entries user-facing.
export interface ChangelogGroup {
  date: string; // human label, e.g. "September 2026"
  title: string; // one-line theme for the batch
  items: string[]; // 1-line, benefit-first bullets
}

export const CHANGELOG: ChangelogGroup[] = [
  {
    date: "September 2026",
    title: "sharing, stickers & a phone glow-up",
    items: [
      "Send GIPHY stickers in lobby chat — search movies, memes and reactions right from the picker.",
      "Share your day, week, streak or a badge straight to WhatsApp as a designed card, from phone or laptop.",
      "Emoji reactions and motivational stickers in chat.",
      "Phone header rebuilt into a single tidy row, and the status bar now matches your chosen colour.",
      "Install pomo as an app that works offline (look for “add to home screen”).",
      "Your timer stays in sync across laptop and phone — even when a tab sits in the background.",
      "The completion chime now rings on time even if pomo is in a background tab.",
      "12 premium colour themes to pick from.",
    ],
  },
  {
    date: "September 2026",
    title: "co-working lobbies go live",
    items: [
      "Live chat in lobbies, with a gentle ping when a message arrives.",
      "See who’s focusing, on a break, or away in real time.",
      "New landing pages and faster first load.",
    ],
  },
  {
    date: "August 2026",
    title: "focus tools & backgrounds",
    items: [
      "Break sessions with a “take a break” button, and a shorter, friendlier completion chime.",
      "Split a task into timed sessions and pick up where you left off.",
      "New backgrounds — lofi cafe, matrix rain, a torii-gate curtain, a split-flap clock, and more.",
      "A YouTube background with its own volume slider.",
    ],
  },
  {
    date: "August 2026",
    title: "stats, goals & teams",
    items: [
      "A full stats page: streaks, an activity heatmap, badges, and a focus score.",
      "Daily and weekly goals with progress on the homepage.",
      "Team challenges, kudos with a live toast, and an optional shareable public profile.",
      "Push reminders when your streak is about to lapse.",
      "Sign in with Google to carry your tasks, history and settings across devices.",
    ],
  },
];
