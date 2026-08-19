import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { resolveIdentityKey } from "../lib/identity";
import { submitFeedback } from "../lib/feedback";

// open to anyone, no sign-in required -- deliberately sits next to the credit line rather
// than in the account menu, since it shouldn't be gated behind an identity the way
// "share profile"/"streak reminders" reasonably are
export function FeedbackWidget() {
  const { identityUserId } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const identityKey = resolveIdentityKey(identityUserId);

  const close = () => {
    setOpen(false);
    // reset for next time, but only once the panel is actually closed -- no point wiping
    // a half-written message just because the confirmation is still on screen
    setTimeout(() => {
      setStatus("idle");
      setMessage("");
      setContact("");
    }, 200);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim() || status === "sending") return;
    setStatus("sending");
    const ok = await submitFeedback(message.trim(), contact.trim() || null, identityKey);
    setStatus(ok ? "sent" : "error");
  };

  return (
    <>
      <button type="button" className="credit__link" onClick={() => setOpen(true)}>
        feedback
      </button>
      {open && (
        <div className="feedback-overlay" role="dialog" aria-modal="true" aria-label="send feedback" onClick={close}>
          <div className="feedback-card" onClick={(e) => e.stopPropagation()}>
            <header className="feedback-card__header">
              <h2 className="feedback-card__title">feedback</h2>
              <button type="button" className="stats-page__close" onClick={close} aria-label="close">
                ×
              </button>
            </header>
            {status === "sent" ? (
              <p className="feedback-card__sent">thanks — got it.</p>
            ) : (
              <form className="feedback-card__form" onSubmit={(e) => void handleSubmit(e)}>
                <textarea
                  className="feedback-card__textarea"
                  placeholder="bugs, ideas, complaints — anything"
                  autoFocus
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <input
                  className="feedback-card__input"
                  placeholder="email (optional, if you'd like a reply)"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                />
                {status === "error" && <p className="lobby-panel__error">couldn't send — try again</p>}
                <button
                  type="submit"
                  className="account-menu__rename-save"
                  disabled={!message.trim() || status === "sending"}
                >
                  {status === "sending" ? "sending…" : "send"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
