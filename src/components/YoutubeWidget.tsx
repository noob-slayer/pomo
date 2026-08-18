import { useState, type FormEvent } from "react";
import { useSettings } from "../context/SettingsContext";
import { DEFAULT_STATIONS, parseYoutubeInput, resolveStation, stationEmbedSrc } from "../lib/stations";

export function YoutubeWidget() {
  const { activeStationId, setActiveStationId, customStation, setCustomStation } = useSettings();
  const [expanded, setExpanded] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [customError, setCustomError] = useState(false);

  const embedSrc = stationEmbedSrc(resolveStation(activeStationId, customStation));

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
    <div className={expanded ? "yt-widget yt-widget--open" : "yt-widget"}>
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
