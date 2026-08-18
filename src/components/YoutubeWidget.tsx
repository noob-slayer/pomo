import { useState, type FormEvent } from "react";
import { useSettings } from "../context/SettingsContext";
import { DEFAULT_STATIONS, parseYoutubeInput } from "../lib/stations";

export function YoutubeWidget() {
  const { activeStationId, setActiveStationId, customStation, setCustomStation } = useSettings();
  const [expanded, setExpanded] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [customError, setCustomError] = useState(false);

  const current =
    customStation ??
    (() => {
      const station = DEFAULT_STATIONS.find((s) => s.id === activeStationId) ?? DEFAULT_STATIONS[0];
      return { type: "video" as const, id: station.videoId, label: station.label };
    })();

  const embedSrc =
    current.type === "playlist"
      ? `https://www.youtube.com/embed/videoseries?list=${current.id}&autoplay=1&rel=0`
      : `https://www.youtube.com/embed/${current.id}?autoplay=1&rel=0`;

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
        <span className="yt-toggle__bars" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
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
