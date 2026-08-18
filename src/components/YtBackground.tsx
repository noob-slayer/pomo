import { useEffect, useState } from "react";
import { parseYoutubeInput, youtubeBackgroundEmbedSrc } from "../lib/stations";

interface YtBackgroundProps {
  url: string | null;
}

export function YtBackground({ url }: YtBackgroundProps) {
  // an iframe's autoplay-with-sound only reliably survives when the iframe itself is
  // created as part of a real user gesture (e.g. the click that submits the link form).
  // On a cold page load with a link already saved, that gesture is long gone, and there's
  // no cross-origin .play() to retry the way DvdBounce/Succession's <video> elements do
  // -- so instead, remount the iframe (bump the key) on the next real interaction
  // anywhere on the page, giving it a fresh, gesture-tied load.
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const retry = () => setReloadKey((k) => k + 1);
    document.addEventListener("pointerdown", retry, { once: true });
    document.addEventListener("keydown", retry, { once: true });
    return () => {
      document.removeEventListener("pointerdown", retry);
      document.removeEventListener("keydown", retry);
    };
  }, [url]);

  const parsed = url ? parseYoutubeInput(url) : null;

  return (
    <div className="stage-yt-wrap">
      {parsed ? (
        <iframe
          key={reloadKey}
          className="stage-yt"
          src={youtubeBackgroundEmbedSrc(parsed)}
          title="background video"
          allow="autoplay; encrypted-media"
        />
      ) : (
        <p className="stage-yt-prompt">paste a youtube link above to set this as your background</p>
      )}
      <div className="stage-yt-overlay" />
    </div>
  );
}
