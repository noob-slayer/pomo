import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";

// gates the app on first visit for a guest: continue as-is (and pick a display name), or
// sign in with google to sync history across devices. A signed-in user is NEVER gated
// here -- SettingsContext derives a personaName from their Google profile automatically
// the moment they sign in, so there's nothing for this to block on. (An earlier version
// also prompted signed-in users for a name if personaName was momentarily empty -- e.g.
// right after a sign-out cleared it locally, before the profile-derived default landed --
// which made this full-screen gate reappear on every login, blocking the whole app
// including the topbar, until the user noticed and typed something. Renaming now lives in
// the account menu instead, reachable any time, not gated behind a blocking prompt.)
export function Onboarding() {
  const { user, loading, configured, signInWithGoogle } = useAuth();
  const { personaName, setPersonaName } = useSettings();
  const [stage, setStage] = useState<"choice" | "name">("choice");
  const [nameInput, setNameInput] = useState("");

  if (personaName || user) return null;
  // wait for the initial session check so a returning signed-in user doesn't flash the
  // guest-vs-google choice for a moment before we know they're already authenticated
  if (configured && loading) return null;

  const submitName = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setPersonaName(trimmed);
  };

  return (
    <div className="onboarding">
      <div className="onboarding__card">
        {stage === "name" ? (
          <>
            <p className="onboarding__title">what should we call you</p>
            <p className="onboarding__body">
              pick a name for your pomo history on this device — this is what shows up around the app. you can
              change it any time from the account menu.
            </p>
            <form className="onboarding__form" onSubmit={submitName}>
              <input
                className="onboarding__input"
                autoFocus
                placeholder="your name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
              />
              <button type="submit" className="onboarding__submit" disabled={!nameInput.trim()}>
                let's go
              </button>
              <button type="button" className="link-btn onboarding__back" onClick={() => setStage("choice")}>
                back
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="onboarding__title">welcome to pomo</p>
            <p className="onboarding__body">a focus timer for work and personal time, with history to look back on.</p>
            <div className="onboarding__choices">
              <button type="button" className="onboarding__choice" onClick={() => setStage("name")}>
                <span className="onboarding__choice-title">continue as guest</span>
                <span className="onboarding__choice-sub">quick start — saved on this device only</span>
              </button>
              {configured && (
                <button type="button" className="onboarding__choice" onClick={() => void signInWithGoogle()}>
                  <span className="onboarding__choice-title">sign in with google</span>
                  <span className="onboarding__choice-sub">saves your pomo history and syncs it across devices</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
