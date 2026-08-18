import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSettings } from "../context/SettingsContext";
import { DEFAULT_STATIONS, parseYoutubeInput, resolveStation, stationEmbedSrc } from "../lib/stations";
import { useClickAway } from "../hooks/useClickAway";

const AUTO_HIDE_MS = 5000;

export function YoutubeWidget() {
  const { activeStationId, setActiveStationId, customStation, setCustomStation } = useSettings();
  const [expanded, setExpanded] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [customError, setCustomError] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  useClickAway(widgetRef, () => setExpanded(false), expanded);

  const embedSrc = stationEmbedSrc(resolveStation(activeStationId, customStation));

  // auto-hide the panel after a few seconds — resets while the user is actively picking
  // a station or typing a link, so it doesn't vanish mid-interaction
  useEffect(() => {
    if (!expanded) return;
    const id = setTimeout(() => setExpanded(false), AUTO_HIDE_MS);
    return () => clearTimeout(id);
  }, [expanded, activeStationId, customStation, customUrl]);

  const handleSelectStation = (id: string) => {
    setActiveStationId(id);
    setHasPlayed(true);
  };

  const handleCustomSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseYoutubeInput(customUrl);
    if (!parsed) {
      setCustomError(true);
      return;
    }
    setCustomError(false);
    setCustomStation({ type: parsed.type, id: parsed.id, label: "custom" });
    setHasPlayed(true);
    setCustomUrl("");
  };

  return (
    <div className={expanded ? "yt-widget yt-widget--open" : "yt-widget"} ref={widgetRef}>
      {expanded && (
        <div className="yt-panel">
          <p className="yt-panel__label">focus audio</p>
          <div className="yt-stations">
            {DEFAULT_STATIONS.map((station) => (
              <button
                key={station.id}
                type="button"
                className={
                  !customStation && activeStationId === station.id
                    ? "chip chip--active"
                    : "chip"
                }
                onClick={() => handleSelectStation(station.id)}
              >
                {station.label}
              </button>
            ))}
          </div>
          <form className="yt-custom" onSubmit={handleCustomSubmit}>
            <input
              placeholder="paste a youtube link"
              value={customUrl}
              onChange={(e) => {
                setCustomUrl(e.target.value);
                setCustomError(false);
              }}
            />
            <button type="submit" className="chip">
              use
            </button>
          </form>
          {customError && <p className="yt-error">couldn't read that link</p>}
        </div>
      )}

      <button
        type="button"
        className="yt-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label="focus audio"
      >
        <svg className="yt-toggle__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 7.5v9l7.5-4.5-7.5-4.5Z" fill="currentColor" />
        </svg>
      </button>

      {hasPlayed && (
        <iframe
          className={expanded ? "yt-frame yt-frame--visible" : "yt-frame"}
          src={embedSrc}
          title="focus audio"
          allow="autoplay; encrypted-media"
        />
      )}
    </div>
  );
}
