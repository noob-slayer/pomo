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
      { name: "work / personal modes", description: "two separate timers, each with their own theme, tasks, and stats — switch any time from the topbar." },
      { name: "presets & custom durations", description: "quick 5/10/15/25/40-minute presets, or set any hours:minutes duration you want." },
      { name: "task list", description: "add tasks with a category and an optional duration estimate, check them off, and see how many focus sessions you've logged against each one." },
      { name: "history", description: "every session you've completed, searchable by day, with a running total." },
    ],
  },
  {
    title: "make it fun",
    items: [
      { name: "colour themes", description: "a handful of solid work-mode palettes to pick from." },
      { name: "photo & painting backgrounds", description: "upload your own photo, or let a rotating gallery of paintings slowly come into focus as your session progresses." },
      { name: "video & animated themes", description: "lofi cafe, a bouncing dvd logo, the matrix, a physics-driven kanji curtain in front of a torii gate, a mechanical split-flap clock, and a few show-themed video loops." },
      { name: "youtube background", description: "drop in any youtube link and use it as a looping video backdrop." },
    ],
  },
  {
    title: "stats & streaks",
    items: [
      { name: "streaks & heatmap", description: "current and longest streak, plus an 18-week activity heatmap so you can see your consistency at a glance." },
      { name: "focus score & weekly trend", description: "a same-day score weighted against your own usual pace, and a 12-week bar chart of your totals." },
      { name: "weekly goals", description: "set a weekly focus-hours target and track progress toward it, right in your stats." },
      { name: "badges", description: "15 achievements with live progress bars, and a notification the moment you unlock one." },
      { name: "completion rate & estimate accuracy", description: "how often you finish what you start, and how your task duration estimates compare to how long things actually take." },
      { name: "recap & CSV export", description: "download a shareable recap image, or export your full session history as a CSV any time." },
      { name: "public profile", description: "an optional, read-only link to your work-mode stats that anyone can view — no account, no task details, just the aggregate numbers." },
    ],
  },
  {
    title: "groups & lobbies",
    items: [
      { name: "lobbies", description: "create or join a group with a shareable link — individual mode keeps everyone's timer independent, sync mode locks every member's clock together." },
      { name: "team leaderboard", description: "weekly and all-time rankings for anyone in your lobby." },
      { name: "kudos", description: "react to a teammate's logged session — they get a live notification, even if pomo isn't open." },
      { name: "challenges", description: "start a named, dated challenge inside a lobby (\"deep work week\") with its own leaderboard, separate from the always-on one." },
    ],
  },
  {
    title: "stay in the loop",
    items: [
      { name: "background-friendly timer", description: "the countdown keeps showing in the tab title while you're on another tab, and you can pop it out into a real floating picture-in-picture window." },
      { name: "streak reminders", description: "an optional push notification if your streak is about to end and you haven't focused yet today — works even with pomo closed." },
      { name: "cross-device sync", description: "sign in with google and your tasks, history, and settings follow you to any device." },
    ],
  },
];

export function FeaturesPage({ open, onClose }: FeaturesPageProps) {
  if (!open) return null;

  return (
    <div className="stats-overlay" role="dialog" aria-modal="true" aria-label="features">
      <div className="stats-page">
        <header className="stats-page__header">
          <h1 className="stats-page__title">what's here</h1>
          <button type="button" className="stats-page__close" onClick={onClose} aria-label="close">
            ×
          </button>
        </header>
        <div className="stats-page__body">
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
