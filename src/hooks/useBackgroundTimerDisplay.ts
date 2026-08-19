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
// 2. an automatic floating Picture-in-Picture window (Chrome/Edge desktop only), by
//    drawing the countdown onto an offscreen canvas, streaming that into a muted <video>,
//    and setting autoPictureInPicture on it. The browser then floats/folds that video in
//    automatically as the tab is hidden/shown, no visibilitychange plumbing of our own --
//    that auto behaviour is exactly what the attribute exists for. It does still require
//    the video to have actually started playing at least once from a real user gesture
//    (browsers gate video.play() the same way as PiP itself), which is what armPip() is
//    for -- call it synchronously from inside the click/keydown handler that starts or
//    resumes the timer.
export function useBackgroundTimerDisplay(timer: TimerApi) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const openEnded = timer.targetSeconds === null;
  const displaySeconds = openEnded ? timer.elapsedSeconds : timer.remainingSeconds;
  const label = timer.phase === "focus" ? (timer.activeTaskTitle ?? "focus") : "break";

  useEffect(() => {
    const apply = () => {
      const shouldShow = timer.status === "running" && document.hidden;
      document.title = shouldShow ? `${formatClock(displaySeconds)} · pomo` : BASE_TITLE;
    };
    apply();
    document.addEventListener("visibilitychange", apply);
    return () => document.removeEventListener("visibilitychange", apply);
  }, [timer.status, displaySeconds]);

  useEffect(() => {
    return () => {
      document.title = BASE_TITLE;
    };
  }, []);

  useEffect(() => {
    if (!PIP_SUPPORTED) return;
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    canvasRef.current = canvas;

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    (video as HTMLVideoElement & { autoPictureInPicture?: boolean }).autoPictureInPicture = true;
    video.style.position = "fixed";
    video.style.bottom = "0";
    video.style.right = "0";
    video.style.width = "1px";
    video.style.height = "1px";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";
    document.body.appendChild(video);
    videoRef.current = video;

    const stream = (canvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(2);
    video.srcObject = stream;

    return () => {
      video.pause();
      video.srcObject = null;
      video.remove();
      videoRef.current = null;
      canvasRef.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.fillStyle = "#211a17";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f4ede6";
    ctx.font = "600 44px system-ui, sans-serif";
    ctx.fillText(formatClock(displaySeconds), canvas.width / 2, 96);
    ctx.font = "400 18px system-ui, sans-serif";
    ctx.fillStyle = "rgba(244, 237, 230, 0.72)";
    ctx.fillText(label, canvas.width / 2, 132);
  });

  const armPip = () => {
    const video = videoRef.current;
    if (!video || !video.paused) return;
    video.play().catch(() => {});
  };

  return { armPip };
}
