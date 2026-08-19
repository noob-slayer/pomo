interface FeaturesPageProps {
  open: boolean;
  onClose: () => void;
}

interface FeatureGroup {
  title: string;
  items: { name: string; description: string }[];
}

const GROUPS: FeatureGroup[] = [
  {
    title: "timer & tasks",
    items: [
      { name: "work / personal modes", description: "work and personal get separate timers, themes, and stats — no crossed wires." },
      { name: "presets & custom durations", description: "5/10/15/25/40-minute presets, or set any duration you like." },
      { name: "task list", description: "attach tasks to sessions so future-you remembers what you were doing." },
      { name: "history", description: "every session, logged and searchable. receipts, basically." },
    ],
  },
  {
    title: "make it fun",
    items: [
      { name: "colour themes", description: "a handful of solid palettes — none of them look like a hospital." },
      { name: "photo & painting backgrounds", description: "upload your own photo, or let paintings slowly sharpen into focus as you work." },
      { name: "video & animated themes", description: "lofi cafe, a bouncing dvd logo, the matrix, a torii gate, a split-flap clock, and more." },
      { name: "youtube background", description: "any youtube link, looping quietly behind your timer." },
    ],
  },
  {
    title: "stats & streaks",
    items: [
      { name: "streaks & heatmap", description: "current and longest streak, plus an 18-week heatmap of your consistency." },
      { name: "focus score & weekly trend", description: "a same-day score weighted to your own pace, and a 12-week trend chart." },
      { name: "weekly goals", description: "set a weekly focus-hours target and watch the bar fill." },
      { name: "badges", description: "15 achievements with live progress bars — and a toast the second you unlock one." },
      { name: "completion rate & estimate accuracy", description: "how often you finish what you start, and how off your estimates usually are." },
      { name: "recap & CSV export", description: "a shareable recap image, or your full history as a csv." },
      { name: "public profile", description: "an optional, read-only link to your stats — no account needed to view it." },
    ],
  },
  {
    title: "groups & lobbies",
    items: [
      { name: "lobbies", description: "create or join one with a link — individual clocks, or one synced timer for everyone." },
      { name: "team leaderboard", description: "weekly and all-time rankings for your lobby." },
      { name: "kudos", description: "react to a teammate's session — they get notified live, even if pomo's closed." },
      { name: "challenges", description: "start a named, dated challenge (\"deep work week\") with its own leaderboard." },
    ],
  },
  {
    title: "stay in the loop",
    items: [
      { name: "background-friendly timer", description: "keeps counting in the tab title, and pops out into a floating window." },
      { name: "streak reminders", description: "a push notification if your streak's about to end and you haven't focused yet." },
      { name: "cross-device sync", description: "sign in with google and your tasks, history, and settings follow you anywhere." },
    ],
  },
];

export function FeaturesPage({ open, onClose }: FeaturesPageProps) {
  if (!open) return null;

  return (
    <div className="stats-overlay" role="dialog" aria-modal="true" aria-label="features" onClick={onClose}>
      <div className="stats-page" onClick={(e) => e.stopPropagation()}>
        <header className="stats-page__header">
          <h1 className="stats-page__title">why pomo</h1>
          <button type="button" className="stats-page__close" onClick={onClose} aria-label="close">
            ×
          </button>
        </header>
        <div className="stats-page__body">
          <p className="features-intro">
            somewhere, a friend of yours already has a longer streak than you today. that's kind of the whole pitch.
          </p>
          <p className="features-mission">a pomo a day keeps the doomscroll away.</p>

          <p className="features-question">why this, not the 40 other pomodoro apps in the store?</p>
          <p className="features-intro">
            every other one is the same grey rectangle, with a banner ad and a "go pro" popup forty seconds in. we
            spent zero dollars on ad space and all of it on the parts that make you open it again tomorrow — real
            stats, real competition, and an actual design sense.
          </p>

          <p className="features-question">does the timer thing even work?</p>
          <p className="features-intro">
            cirillo didn't have a psychology degree — he had a bet with himself and a tomato-shaped kitchen timer
            sitting in his kitchen. he challenged himself to 10 focused minutes, not 25 — the 25 came later, once 10
            got easy. the whole technique works because it shrinks the size of the ask: a smaller commitment lowers
            the odds you talk yourself out of starting.
          </p>
          {GROUPS.map((group) => (
            <div key={group.title} className="features-group">
              <p className="history-section__label">{group.title}</p>
              <ul className="features-list">
                {group.items.map((item) => (
                  <li key={item.name} className="features-list__item">
                    <span className="features-list__name">{item.name}</span>
                    <span className="features-list__desc">{item.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
