import { useEffect, useState } from "react";
import { parseYoutubeInput, youtubeBackgroundEmbedSrc } from "../lib/stations";

interface YtBackgroundProps {
  url: string | null;
}

export function YtBackground({ url }: YtBackgroundProps) {
  // iOS Safari (and, less predictably, other browsers) only allows an embedded iframe to
  // autoplay with sound when it's created as the direct result of a tap on that same
  // element -- a click anywhere else on the page, or a gesture that already happened
  // several renders ago, doesn't reliably carry over. So rather than guessing, always
  // require one explicit tap on the video area itself before mounting the iframe; that
  // tap's synchronous state update is what gives the iframe its gesture credit.
  const [started, setStarted] = useState(false);
  useEffect(() => {
    setStarted(false);
  }, [url]);

  const parsed = url ? parseYoutubeInput(url) : null;

  return (
    <div className="stage-yt-wrap">
      {parsed && started ? (
        <iframe
          className="stage-yt"
          src={youtubeBackgroundEmbedSrc(parsed)}
          title="background video"
          allow="autoplay; encrypted-media"
        />
      ) : parsed ? (
        <button type="button" className="stage-yt-play" onClick={() => setStarted(true)} aria-label="play background video">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 7.5v9l7.5-4.5-7.5-4.5Z" fill="currentColor" />
          </svg>
        </button>
      ) : (
        <p className="stage-yt-prompt">paste a youtube link above to set this as your background</p>
      )}
      <div className="stage-yt-overlay" />
    </div>
  );
}
