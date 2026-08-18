import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";

// gates the app on first visit: either continue as a guest (and pick a display name).
// or sign in with google (to sync history across devices) -- either path ends with a
// personaName, which becomes this user's display name everywhere (account menu, any
// future multi-user surfaces), replacing the old bare "guest" placeholder.
export function Onboarding() {
  const { user, loading, configured, signInWithGoogle } = useAuth();
  const { personaName, setPersonaName } = useSettings();
  const [stage, setStage] = useState<"choice" | "name">("choice");
  const [nameInput, setNameInput] = useState("");

  if (personaName) return null;
  // wait for the initial session check so a returning signed-in user doesn't flash the
  // guest-vs-google choice for a moment before we know they're already authenticated
  if (configured && loading) return null;

  const alreadySignedIn = configured && !!user;

  const submitName = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setPersonaName(trimmed);
  };

  const showNameForm = alreadySignedIn || stage === "name";

  return (
    <div className="onboarding">
      <div className="onboarding__card">
        {showNameForm ? (
          <>
            <p className="onboarding__title">{alreadySignedIn ? "one last thing" : "what should we call you"}</p>
            <p className="onboarding__body">
              pick a name for your pomo history{alreadySignedIn ? "" : " on this device"} — this is what shows up
              around the app.
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
