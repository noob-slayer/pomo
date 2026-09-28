import { CHANGELOG } from "../lib/changelog";

interface ChangelogPageProps {
  open: boolean;
  onClose: () => void;
}

// reuses the shared stats/features modal shell (.stats-overlay/.stats-page) so it matches
// the rest of the app's popups exactly
export function ChangelogPage({ open, onClose }: ChangelogPageProps) {
  if (!open) return null;

  return (
    <div className="stats-overlay" role="dialog" aria-modal="true" aria-label="what's new" onClick={onClose}>
      <div className="stats-page" onClick={(e) => e.stopPropagation()}>
        <header className="stats-page__header">
          <h1 className="stats-page__title">what's new</h1>
          <button type="button" className="stats-page__close" onClick={onClose} aria-label="close">
            ×
          </button>
        </header>
        <div className="stats-page__body">
          <p className="features-intro">everything that's shipped, newest first.</p>
          {CHANGELOG.map((group, i) => (
            <div key={`${group.date}-${i}`} className="changelog-group">
              <div className="changelog-group__head">
                <span className="changelog-group__date">{group.date}</span>
                <span className="changelog-group__title">{group.title}</span>
              </div>
              <ul className="changelog-list">
                {group.items.map((item) => (
                  <li key={item} className="changelog-list__item">
                    {item}
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
