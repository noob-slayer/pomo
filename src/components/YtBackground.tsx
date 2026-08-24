import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { parseYoutubeInput } from "../lib/stations";

interface YtBackgroundProps {
  url: string | null;
}

declare global {
  interface Window {
    YT?: {
      Player: new (target: Element, opts: Record<string, unknown>) => YtPlayer;
      PlayerState: { PLAYING: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YtPlayer {
  mute(): void;
  unMute(): void;
  playVideo(): void;
  setVolume(volume: number): void;
  getPlayerState(): number;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
}

// loading https://www.youtube.com/iframe_api directly (rather than trusting URL params
// like autoplay=1&mute=1 on a plain <iframe src>) is what actually lets us tell whether
// playback started. Real iPad Safari silently ignored the URL-param approach even fully
// muted -- with the real Player API we get onReady/onStateChange callbacks, so if
// playback genuinely didn't start we can show an explicit tap-to-play fallback instead of
// quietly showing a frozen black rectangle forever.
let apiPromise: Promise<void> | null = null;
function loadYoutubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiPromise;
}

export function YtBackground({ url }: YtBackgroundProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YtPlayer | null>(null);
  const [muted, setMuted] = useState(true);
  const [needsTap, setNeedsTap] = useState(false);
  const [volume, setVolume] = useState(50);
  // read inside onReady below, which is only ever set up once per player (the effect that
  // creates it depends on [url] alone) -- a plain state closure there would keep applying
  // whatever volume was selected at the moment THIS player instance was created, ignoring
  // any slider move made against a previous instance for the same background
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const parsed = url ? parseYoutubeInput(url) : null;

  useEffect(() => {
    let cancelled = false;
    setNeedsTap(false);
    setMuted(true);
    playerRef.current?.destroy?.();
    playerRef.current = null;
    if (!parsed || !mountRef.current) return;

    const target = document.createElement("div");
    mountRef.current.replaceChildren(target);

    loadYoutubeApi().then(() => {
      if (cancelled || !mountRef.current || !window.YT) return;
      const playerVars: Record<string, number | string> = {
        autoplay: 1,
        mute: 1,
        controls: 0,
        rel: 0,
        modestbranding: 1,
        disablekb: 1,
        fs: 0,
        playsinline: 1,
      };
      if (parsed.type === "playlist") {
        playerVars.listType = "playlist";
        playerVars.list = parsed.id;
      }
      const player = new window.YT.Player(target, {
        videoId: parsed.type === "video" ? parsed.id : undefined,
        playerVars,
        events: {
          onReady: (e: { target: YtPlayer }) => {
            if (cancelled) return;
            const iframe = e.target.getIframe();
            iframe.classList.add("stage-yt");
            iframe.title = "background video";
            e.target.mute();
            e.target.setVolume(volumeRef.current);
            e.target.playVideo();
            // give it a beat, then check whether playback actually took. Confirmed via
            // WebKit + iPad emulation: Safari's muted-autoplay exemption applies to
            // same-origin <video> elements, not to a cross-origin iframe's internal
            // player -- programmatic mute()+playVideo() alone never starts it, so this
            // fallback is the real, load-bearing path on iOS, not just a rare edge case.
            window.setTimeout(() => {
              if (cancelled) return;
              const state = e.target.getPlayerState();
              if (state !== 1 && state !== 3) setNeedsTap(true);
            }, 1500);
          },
          onStateChange: (e: { data: number }) => {
            if (cancelled || !window.YT) return;
            if (e.data === window.YT.PlayerState.PLAYING) setNeedsTap(false);
          },
          onError: () => {
            if (!cancelled) setNeedsTap(true);
          },
        },
      });
      playerRef.current = player;
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const startPlayback = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    player.mute();
    player.playVideo();
    setNeedsTap(false);
  }, []);

  const toggleMute = () => {
    const player = playerRef.current;
    if (!player) return;
    const next = !muted;
    setMuted(next);
    if (next) player.mute();
    else player.unMute();
    player.playVideo();
    setNeedsTap(false);
  };

  const handleVolumeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = Number(e.target.value);
    setVolume(next);
    const player = playerRef.current;
    if (!player) return;
    player.setVolume(next);
    // dragging the slider is a clear "I want to hear this" signal -- if it's still muted
    // from the autoplay-safe default, unmute so the new level is actually audible instead
    // of silently no-op'ing behind the mute
    if (muted) {
      setMuted(false);
      player.unMute();
      player.playVideo();
      setNeedsTap(false);
    }
  };

  return (
    <div className="stage-yt-wrap">
      <div className="stage-yt-mount" ref={mountRef} />
      {!parsed && <p className="stage-yt-prompt">paste a youtube link above to set this as your background</p>}
      {parsed && needsTap && (
        <button type="button" className="stage-yt-tap" onClick={startPlayback}>
          tap to play background
        </button>
      )}
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
      {parsed && (
        <input
          type="range"
          className="stage-yt-volume"
          min={0}
          max={100}
          value={volume}
          onChange={handleVolumeChange}
          aria-label="background video volume"
        />
      )}
      <div className="stage-yt-overlay" />
    </div>
  );
}
