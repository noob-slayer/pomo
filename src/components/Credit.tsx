import { FeedbackWidget } from "./FeedbackWidget";

interface CreditProps {
  onOpenFeatures: () => void;
  onOpenChangelog: () => void;
}

export function Credit({ onOpenFeatures, onOpenChangelog }: CreditProps) {
  return (
    <div className="credit">
      <a
        className="credit__link"
        href="https://ko-fi.com/nooob_slayer"
        target="_blank"
        rel="noopener noreferrer"
      >
        buy me a coffee
      </a>
      <button type="button" className="credit__link" onClick={onOpenFeatures}>
        features
      </button>
      {/* laptop only -- hidden on phones by App.css to keep the credit row uncluttered */}
      <button type="button" className="credit__link credit__link--desktop" onClick={onOpenChangelog}>
        what's new
      </button>
      <FeedbackWidget />
    </div>
  );
}
