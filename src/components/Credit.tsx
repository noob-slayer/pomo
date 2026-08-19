import { FeedbackWidget } from "./FeedbackWidget";

interface CreditProps {
  onOpenFeatures: () => void;
}

export function Credit({ onOpenFeatures }: CreditProps) {
  return (
    <div className="credit">
      <span>vibe coded by Sid with &lt;3</span>
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
      <FeedbackWidget />
    </div>
  );
}
