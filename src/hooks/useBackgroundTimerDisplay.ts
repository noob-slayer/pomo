import { useEffect, useRef } from "react";
import type { TimerApi } from "./useTimer";
import { formatClock } from "../lib/durations";

const BASE_TITLE = typeof document !== "undefined" ? document.title : "";

// checks both the document-level flag and that the element actually implements the
// method -- a browser could in principle expose one without the other, and either gap
// means a real requestPictureInPicture() call would just throw
export const PIP_SUPPORTED =
  typeof document !== "undefined" &&
  "pictureInPictureEnabled" in document &&
  document.pictureInPictureEnabled &&
  typeof HTMLVideoElement !== "undefined" &&
  "requestPictureInPicture" in HTMLVideoElement.prototype;

// same-origin "make it fun" backgrounds that render as an actual <video>/<img> element --
// drawImage() can capture their current frame directly. yt (cross-origin iframe) and
// f1track (dev-only canvas widget) are deliberately absent: an iframe can't be drawn to a
// canvas at all, and cross-origin content would taint it even if it could.
const MEDIA_BG_SELECTORS = [".stage-lofi", ".stage-suits", ".stage-f1", ".stage-succession", ".stage-forest1"];
// backgrounds applied as a CSS background-image on a div rather than a real <img> element
// -- drawImage() needs an actual image element, so these get mirrored into an offscreen
// <img> pointed at the same URL instead.
const CSS_BG_SELECTORS = [".stage-photo", ".stage-dvd-bg"];

function findMediaBgElement(): HTMLVideoElement | HTMLImageElement | null {
  for (const sel of MEDIA_BG_SELECTORS) {
    const el = document.querySelector(sel);
    if (el instanceof HTMLVideoElement || el instanceof HTMLImageElement) return el;
  }
  return null;
}

function findCssBgUrl(): string | null {
  for (const sel of CSS_BG_SELECTORS) {
    const el = document.querySelector(sel);
    if (!(el instanceof HTMLElement)) continue;
    const match = getComputedStyle(el).backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
    if (match) return match[1];
  }
  return null;
}

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
// The floated preview mirrors the actual current theme rather than a fixed colour: solid
// colour/work themes read --stage-bg/--stage-ink straight off .shell (the same CSS custom
// properties the real stage renders from), and video/gif "make it fun" backgrounds get
// their live current frame drawn onto the canvas each tick, under the same dark wash every
// stage-*-overlay already applies for text legibility.
//
// Both the title and the canvas are driven by their own dedicated setInterval reading
// getLiveSeconds() (wall-clock math, not React state) rather than piggybacking on this
// component's re-render cycle -- re-renders themselves depend on useTimer's own interval,
// which browsers throttle hard once a tab is backgrounded, so anything downstream of "wait
// for a re-render" stalls right along with it instead of continuing to tick.
export function useBackgroundTimerDisplay(timer: TimerApi) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cssBgImgRef = useRef<{ url: string; img: HTMLImageElement } | null>(null);
  const timerRef = useRef(timer);
  timerRef.current = timer;

  useEffect(() => {
    if (!PIP_SUPPORTED) return;

    // higher resolution than the old 300x168 -- the floated PiP window's native size
    // comes from this canvas's actual pixel buffer, not any on-page CSS size, and text
    // drawn at low resolution looked visibly blurry once a browser rendered/resized the
    // floating window larger than that.
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    canvasRef.current = canvas;

    // Chrome's manual requestPictureInPicture() doesn't care whether the source video is
    // visible on the page, but Safari's does: it needs the element to have been laid out
    // with real dimensions at some point, and silently refuses a video that's been
    // display:none since creation. Real size + positioned off-screen (not display:none)
    // satisfies both -- properly laid out for Safari, invisible to you either way.
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.style.position = "fixed";
    video.style.width = "160px";
    video.style.height = "90px";
    video.style.left = "-9999px";
    video.style.top = "-9999px";
    document.body.appendChild(video);
    const stream = (canvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(8);
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
    const getCssBgImage = (url: string): HTMLImageElement | null => {
      if (cssBgImgRef.current?.url !== url) {
        const img = new Image();
        img.src = url;
        cssBgImgRef.current = { url, img };
      }
      return cssBgImgRef.current.img.complete ? cssBgImgRef.current.img : null;
    };

    const draw = () => {
      const t = timerRef.current;
      const video = videoRef.current;

      if (t.status === "idle") {
        document.title = BASE_TITLE;
        if (video && document.pictureInPictureElement === video) document.exitPictureInPicture().catch(() => {});
        return;
      }

      // keep drawing while paused too, not just running -- the pop-out button is visible
      // whenever the timer isn't idle, and a paused-but-never-drawn popup would otherwise
      // show a blank canvas until the timer next runs
      const openEnded = t.targetSeconds === null;
      const seconds = t.getLiveSeconds();
      const clock = formatClock(seconds);
      document.title = t.status === "running" && document.hidden ? `${clock} · pomo` : BASE_TITLE;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!video || !canvas || !ctx) return;
      if (video.paused) video.play().catch(() => {});

      const shellEl = document.querySelector(".shell");
      const shellStyle = shellEl instanceof HTMLElement ? getComputedStyle(shellEl) : null;
      const stageBg = shellStyle?.getPropertyValue("--stage-bg").trim() || "#181211";
      const stageInk = shellStyle?.getPropertyValue("--stage-ink").trim() || "#f4ede6";
      const stageInkMuted = shellStyle?.getPropertyValue("--stage-ink-muted").trim() || "rgba(244,237,230,0.72)";

      ctx.fillStyle = stageBg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      let drewMedia = false;
      const mediaEl = findMediaBgElement();
      try {
        if (mediaEl) {
          ctx.drawImage(mediaEl, 0, 0, canvas.width, canvas.height);
          drewMedia = true;
        } else {
          const cssUrl = findCssBgUrl();
          const img = cssUrl ? getCssBgImage(cssUrl) : null;
          if (img) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            drewMedia = true;
          }
        }
      } catch {
        // source not decodable yet this tick (e.g. video/image still loading) -- the
        // stageBg fill drawn above already covers the canvas, just skip the overlay draw
        drewMedia = false;
      }

      // same dark wash every "make it fun" background layer already applies, so text
      // stays legible regardless of what's under it -- skipped for a plain colour theme,
      // which has no such wash on the real stage either
      let textColor = stageInk;
      let mutedColor = stageInkMuted;
      if (drewMedia) {
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, "rgba(10, 8, 7, 0.42)");
        gradient.addColorStop(1, "rgba(10, 8, 7, 0.62)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        textColor = "#f4ede6";
        mutedColor = "rgba(244, 237, 230, 0.72)";
      }

      const label = t.phase === "focus" ? (t.activeTaskTitle ?? "focus") : openEnded ? "break — elapsed" : "break";
      ctx.textAlign = "center";
      ctx.fillStyle = textColor;
      ctx.font = "600 92px system-ui, sans-serif";
      ctx.fillText(clock, canvas.width / 2, 200);
      ctx.font = "400 34px system-ui, sans-serif";
      ctx.fillStyle = mutedColor;
      ctx.fillText(label, canvas.width / 2, 258);
    };

    draw();
    // redraws faster than once a second (matched to the captureStream fps above) so a
    // video/gif "make it fun" background keeps moving in the popout instead of visibly
    // freezing between second-ticks -- the clock text itself only changes once a real
    // second, but recomputing it every tick is cheap, so this is one loop, not two.
    const id = window.setInterval(draw, 125);
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
