import { useEffect, useRef, useState } from "react";
import { parseYoutubeInput, youtubeBackgroundEmbedSrc } from "../lib/stations";

interface YtBackgroundProps {
  url: string | null;
}

export function YtBackground({ url }: YtBackgroundProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);
  const parsed = url ? parseYoutubeInput(url) : null;

  // muted autoplay is allowed everywhere, including iOS, with no gesture at all -- so the
  // video itself always starts playing the moment a link is set, full stop. Unmuted
  // autoplay is far less reliable (real iPad hardware failed to honor it even when the
  // iframe was created synchronously inside a tap), so sound is opt-in via the toggle
  // below instead of something we try to force on load.
  const mountIframe = (wantMuted: boolean) => {
    if (!parsed || !mountRef.current) return;
    const iframe = document.createElement("iframe");
    iframe.className = "stage-yt";
    iframe.src = youtubeBackgroundEmbedSrc(parsed, wantMuted);
    iframe.title = "background video";
    iframe.allow = "autoplay; encrypted-media";
    mountRef.current.replaceChildren(iframe);
  };

  useEffect(() => {
    setMuted(true);
    mountIframe(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    mountIframe(next);
  };

  return (
    <div className="stage-yt-wrap">
      <div className="stage-yt-mount" ref={mountRef} />
      {!parsed && <p className="stage-yt-prompt">paste a youtube link above to set this as your background</p>}
      {parsed && (
        <button type="button" className="stage-yt-mute" onClick={toggleMute} aria-label={muted ? "unmute background video" : "mute background video"}>
          {muted ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9v6h4l5 5V4L8 9H4Z" fill="currentColor" />
              <path d="M16.5 9.5 20 13m0-3.5L16.5 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9v6h4l5 5V4L8 9H4Z" fill="currentColor" />
              <path
                d="M15.5 8.5a5 5 0 0 1 0 7M17.8 6a8.5 8.5 0 0 1 0 12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          )}
        </button>
      )}
      <div className="stage-yt-overlay" />
    </div>
  );
}
