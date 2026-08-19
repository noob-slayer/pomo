import { useEffect, useState } from "react";
import { fetchPublicProfileBySlug, fetchPublicProfileSessions } from "../lib/publicProfile";
import { computeSessionStats } from "../lib/statsCalc";
import { computeStreaks, computeHeatmap, computeBadges, computeCompletionStats } from "../lib/statsExtras";
import { formatDuration } from "../lib/durations";
import { IconFlame, IconTrophy } from "./icons";
import type { PomoRecord } from "../types";

interface PublicProfilePageProps {
  slug: string;
}

const HEATMAP_DAYS = 18 * 7;

// a read-only, no-auth-required view of someone's opt-in public stats -- see
// supabase/public_profile_schema.sql for exactly what's exposed (work-mode aggregate
// numbers only, never task titles/categories). Reuses the same stats functions the
// private stats page uses, just fed sanitized public data instead of the signed-in user's
// own full history.
export function PublicProfilePage({ slug }: PublicProfilePageProps) {
  const [state, setState] = useState<"loading" | "not-found" | "ready">("loading");
  const [personaName, setPersonaName] = useState("");
  const [history, setHistory] = useState<PomoRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profile = await fetchPublicProfileBySlug(slug);
      if (cancelled) return;
      if (!profile) {
        setState("not-found");
        return;
      }
      const sessions = await fetchPublicProfileSessions(slug);
      if (cancelled) return;
      setPersonaName(profile.personaName);
      setHistory(sessions);
      setState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state === "loading") {
    return (
      <div className="public-profile-page public-profile-page--center">
        <span className="wordmark">pomo</span>
      </div>
    );
  }

  if (state === "not-found") {
    return (
      <div className="public-profile-page public-profile-page--center">
        <span className="wordmark">pomo</span>
        <p className="public-profile-page__notfound">this profile doesn't exist, or is no longer public.</p>
        <a className="link-btn" href="/">
          go to pomo →
        </a>
      </div>
    );
  }

  const stats = computeSessionStats(history, "work");
  const streaks = computeStreaks(history, "work");
  const heatmap = computeHeatmap(history, "work", HEATMAP_DAYS);
  const completion = computeCompletionStats(history, "work");
  const badges = computeBadges(history, "work").filter((b) => b.achieved);
  const totalMinutesAllTime = history
    .filter((r) => r.mode === "work" && r.phase === "focus")
    .reduce((s, r) => s + r.minutes, 0);

  return (
    <div className="public-profile-page">
      <div className="public-profile-page__card">
        <header className="public-profile-page__header">
          <span className="wordmark">pomo</span>
          <h1 className="public-profile-page__name">{personaName}</h1>
        </header>

        {stats.totalSessions === 0 ? (
          <p className="task-empty">no public sessions logged yet</p>
        ) : (
          <>
            <div className="stats-hero">
              <div className="stats-hero__card">
                <span className="stats-hero__value stats-hero__value--with-icon tabular">
                  <IconFlame />
                  {streaks.current}
                </span>
                <span className="stats-hero__label">day streak</span>
                <span className="stats-hero__sub">longest {streaks.longest}</span>
              </div>
              <div className="stats-hero__card">
                <span className="stats-hero__value tabular">{formatDuration(totalMinutesAllTime)}</span>
                <span className="stats-hero__label">focused, all time</span>
              </div>
              <div className="stats-hero__card">
                <span className="stats-hero__value tabular">{completion.completionRate}%</span>
                <span className="stats-hero__label">completion rate</span>
              </div>
            </div>

            <p className="history-section__label">last {HEATMAP_DAYS} days</p>
            <div className="stats-heatmap">
              {heatmap.map((day) => (
                <div
                  key={day.key}
                  className="stats-heatmap__cell"
                  data-level={day.level}
                  title={`${day.date.toLocaleDateString(undefined, { month: "short", day: "numeric" }).toLowerCase()}: ${formatDuration(day.minutes)}`}
                />
              ))}
            </div>
            <div className="stats-heatmap__legend">
              <span>less</span>
              {[0, 1, 2, 3, 4].map((lvl) => (
                <div key={lvl} className="stats-heatmap__cell" data-level={lvl} />
              ))}
              <span>more</span>
            </div>

            {badges.length > 0 && (
              <>
                <p className="history-section__label">badges</p>
                <div className="badges-grid">
                  {badges.map((badge) => (
                    <div key={badge.id} className="badge-tile badge-tile--achieved" title={badge.description}>
                      <span className="badge-tile__icon">
                        <IconTrophy />
                      </span>
                      <span className="badge-tile__label">{badge.label}</span>
                      <span className="badge-tile__desc">{badge.description}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <footer className="public-profile-page__footer">
          <a href="/">start your own focus streak on pomo →</a>
        </footer>
      </div>
    </div>
  );
}
