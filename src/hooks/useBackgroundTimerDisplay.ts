import { useEffect, useRef } from "react";
import type { TimerApi } from "./useTimer";
import { formatClock } from "../lib/durations";

const BASE_TITLE = typeof document !== "undefined" ? document.title : "";

const PIP_SUPPORTED =
  typeof document !== "undefined" && "pictureInPictureEnabled" in document && document.pictureInPictureEnabled;

// keeps the timer visible while the tab is backgrounded, in two ways:
//
// 1. a live "mm:ss · pomo" tab title -- works everywhere, including iPad Safari, since
//    it's just the tab label. The universal fallback.
// 2. an automatic floating Picture-in-Picture window (Chrome/Edge desktop only): a small
//    on-page mini-timer widget streams its own canvas into a muted <video> with
//    autoPictureInPicture set, and the browser floats/folds that video automatically as
//    the tab is hidden/shown. Chrome only makes a video eligible for auto-PiP if it's
//    actually rendered and visible on the page (not zero-size or opacity:0) -- exactly the
//    same way Google Meet's own real video tile is what gets floated out, not a hidden
//    decoy -- so this widget is a real, small, visible corner element, and it's only
//    created at all in browsers that can do anything with it.
//
// Both are driven by their own dedicated setInterval reading getLiveSeconds() (wall-clock
// math, not React state) rather than piggybacking on this component's re-render cycle --
// re-renders themselves depend on useTimer's own interval, which browsers throttle hard
// once a tab is backgrounded, so anything downstream of "wait for a re-render" stalls
// right along with it instead of continuing to tick.
export function useBackgroundTimerDisplay(timer: TimerApi) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef(timer);
  timerRef.current = timer;

  useEffect(() => {
    if (!PIP_SUPPORTED) return;

    const widget = document.createElement("div");
    widget.style.position = "fixed";
    widget.style.bottom = "16px";
    widget.style.right = "16px";
    widget.style.zIndex = "5";
    widget.style.display = "none";
    widget.style.pointerEvents = "none";
    document.body.appendChild(widget);
    widgetRef.current = widget;

    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 168;
    canvasRef.current = canvas;

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    (video as HTMLVideoElement & { autoPictureInPicture?: boolean }).autoPictureInPicture = true;
    video.style.width = "96px";
    video.style.height = "54px";
    video.style.borderRadius = "10px";
    video.style.boxShadow = "0 2px 10px rgba(0,0,0,0.35)";
    video.style.display = "block";
    const stream = (canvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(2);
    video.srcObject = stream;
    widget.appendChild(video);
    videoRef.current = video;

    return () => {
      video.pause();
      video.srcObject = null;
      widget.remove();
      widgetRef.current = null;
      videoRef.current = null;
      canvasRef.current = null;
    };
  }, []);

  useEffect(() => {
    const draw = () => {
      const t = timerRef.current;
      const widget = widgetRef.current;

      if (t.status !== "running") {
        if (widget) widget.style.display = "none";
        document.title = BASE_TITLE;
        return;
      }

      const openEnded = t.targetSeconds === null;
      const seconds = t.getLiveSeconds();
      const clock = formatClock(seconds);
      document.title = document.hidden ? `${clock} · pomo` : BASE_TITLE;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!widget || !canvas || !ctx) return;
      widget.style.display = "block";

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

  // starts the underlying muted <video> playing, exactly once, from inside a real click --
  // this is what makes the auto-PiP eligible at all: browsers require the video to already
  // be playing (itself gated by the click's user-activation) before "auto" can act on it
  // later without a fresh gesture.
  const armPip = () => {
    const video = videoRef.current;
    if (!video || !video.paused) return;
    video.play().catch(() => {});
  };

  return { armPip };
}
