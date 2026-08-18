import { useState, type FormEvent } from "react";
import { useSettings } from "../context/SettingsContext";
import { parseYoutubeInput } from "../lib/stations";

export function YtLinkForm() {
  const { ytBgUrl, setYtBgUrl } = useSettings();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseYoutubeInput(value);
    if (!parsed) {
      setError(true);
      return;
    }
    setError(false);
    setYtBgUrl(value.trim());
    setValue("");
  };

  return (
    <form className="yt-link-form" onSubmit={handleSubmit}>
      <input
        className="yt-link-form__input"
        placeholder={ytBgUrl ? "paste a different link" : "paste a youtube link"}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(false);
        }}
      />
      <button type="submit" className="chip">
        use
      </button>
      {error && <p className="yt-error">couldn't read that link</p>}
    </form>
  );
}
