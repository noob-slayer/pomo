import { useEffect, useRef, useState } from "react";
import { parseYoutubeInput, youtubeBackgroundEmbedSrc } from "../lib/stations";

interface YtBackgroundProps {
  url: string | null;
}

export function YtBackground({ url }: YtBackgroundProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    setStarted(false);
  }, [url]);

  const parsed = url ? parseYoutubeInput(url) : null;

  // iOS Safari only grants an embedded iframe autoplay-with-sound when it's created
  // *synchronously* inside the tap that requested it -- going through React's setState
  // (a task later, after the event handler returns) loses that "user activation" window
  // even though it worked fine on desktop. Building and inserting the iframe by hand
  // directly in the click handler, before any React re-render happens, is the pattern
  // that actually survives iOS's stricter check.
  const handlePlay = () => {
    if (!parsed || !mountRef.current) return;
    const iframe = document.createElement("iframe");
    iframe.className = "stage-yt";
    iframe.src = youtubeBackgroundEmbedSrc(parsed);
    iframe.title = "background video";
    iframe.allow = "autoplay; encrypted-media";
    mountRef.current.replaceChildren(iframe);
    setStarted(true);
  };

  return (
    <div className="stage-yt-wrap">
      <div className="stage-yt-mount" ref={mountRef} />
      {!parsed && <p className="stage-yt-prompt">paste a youtube link above to set this as your background</p>}
      {parsed && !started && (
        <button type="button" className="stage-yt-play" onClick={handlePlay} aria-label="play background video">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 7.5v9l7.5-4.5-7.5-4.5Z" fill="currentColor" />
          </svg>
        </button>
      )}
      <div className="stage-yt-overlay" />
    </div>
  );
}
