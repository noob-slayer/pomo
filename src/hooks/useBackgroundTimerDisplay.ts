import { useEffect, useRef } from "react";
import type { TimerApi } from "./useTimer";
import { formatClock } from "../lib/durations";

const BASE_TITLE = typeof document !== "undefined" ? document.title : "";

export const PIP_SUPPORTED =
  typeof document !== "undefined" && "pictureInPictureEnabled" in document && document.pictureInPictureEnabled;

// keeps the timer visible while you're away from the tab, in two ways:
//
// 1. a live "mm:ss · pomo" tab title -- works everywhere, including iPad Safari, since
//    it's just the tab label. The universal fallback.
// 2. a real floating Picture-in-Picture window on Chrome/Edge, entered via the "pop out"
//    button. This is deliberately a manual, one-click action, not automatic-on-tab-switch:
//    Chrome's actual zero-click auto-float is PWA-install-only (the autoPictureInPicture
//    video attribute is scoped to installed apps, confirmed against Chrome's own docs),
//    and its browser-initiated automatic PiP for regular websites requires genuinely
//    audible media, which a silent countdown will never satisfy. A manual
//    requestPictureInPicture() call from a real click has none of those restrictions and
//    works today -- once popped out, the window keeps floating on its own across
//    subsequent tab switches, same end result, one click up front.
//
// Both are driven by their own dedicated setInterval reading getLiveSeconds() (wall-clock
// math, not React state) rather than piggybacking on this component's re-render cycle --
// re-renders themselves depend on useTimer's own interval, which browsers throttle hard
// once a tab is backgrounded, so anything downstream of "wait for a re-render" stalls
// right along with it instead of continuing to tick.
export function useBackgroundTimerDisplay(timer: TimerApi) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef(timer);
  timerRef.current = timer;

  useEffect(() => {
    if (!PIP_SUPPORTED) return;

    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 168;
    canvasRef.current = canvas;

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.style.position = "fixed";
    video.style.bottom = "16px";
    video.style.right = "16px";
    video.style.width = "96px";
    video.style.height = "54px";
    video.style.borderRadius = "10px";
    video.style.boxShadow = "0 2px 10px rgba(0,0,0,0.35)";
    video.style.zIndex = "5";
    video.style.display = "none";
    document.body.appendChild(video);
    const stream = (canvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(2);
    video.srcObject = stream;
    // muted, same-origin autoplay has no gesture requirement anywhere -- keep it playing
    // continuously whenever it's relevant so requestPictureInPicture() always has a
    // playing source ready the instant the pop-out button is clicked.
    videoRef.current = video;

    return () => {
      if (document.pictureInPictureElement === video) document.exitPictureInPicture().catch(() => {});
      video.pause();
      video.srcObject = null;
      video.remove();
      videoRef.current = null;
      canvasRef.current = null;
    };
  }, []);

  useEffect(() => {
    const draw = () => {
      const t = timerRef.current;
      const video = videoRef.current;

      if (t.status !== "running") {
        document.title = BASE_TITLE;
        if (video) {
          video.style.display = "none";
          if (document.pictureInPictureElement === video) document.exitPictureInPicture().catch(() => {});
        }
        return;
      }

      const openEnded = t.targetSeconds === null;
      const seconds = t.getLiveSeconds();
      const clock = formatClock(seconds);
      document.title = document.hidden ? `${clock} · pomo` : BASE_TITLE;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!video || !canvas || !ctx) return;
      video.style.display = "block";
      if (video.paused) video.play().catch(() => {});

      const label = t.phase === "focus" ? (t.activeTaskTitle ?? "focus") : openEnded ? "break — elapsed" : "break";
      ctx.fillStyle = "#211a17";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = "center";
      ctx.fillStyle = "#f4ede6";
      ctx.font = "600 44px system-ui, sans-serif";
      ctx.fillText(clock, canvas.width / 2, 92);
      ctx.font = "400 18px system-ui, sans-serif";
      ctx.fillStyle = "rgba(244, 237, 230, 0.72)";
      ctx.fillText(label, canvas.width / 2, 128);
    };

    draw();
    const id = window.setInterval(draw, 1000);
    document.addEventListener("visibilitychange", draw);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", draw);
    };
  }, []);

  useEffect(() => {
    return () => {
      document.title = BASE_TITLE;
    };
  }, []);

  const popOut = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (video.paused) await video.play();
      if (document.pictureInPictureElement !== video) await video.requestPictureInPicture();
    } catch {
      // PiP unsupported at runtime, or the user dismissed a prior request -- no-op
    }
  };

  return { popOut, pipSupported: PIP_SUPPORTED };
}
