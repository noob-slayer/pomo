import { FeedbackWidget } from "./FeedbackWidget";

interface CreditProps {
  onOpenFeatures: () => void;
}

export function Credit({ onOpenFeatures }: CreditProps) {
  return (
    <div className="credit">
      <span>vibe coded by Sid with &lt;3</span>
      <span>buy me a coffee</span>
      <button type="button" className="credit__feedback" onClick={onOpenFeatures}>
        features
      </button>
      <FeedbackWidget />
    </div>
  );
}
