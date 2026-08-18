import { useEffect, useMemo, useRef, useState } from "react";
import type { TimerApi } from "../hooks/useTimer";
import { formatClock } from "../lib/durations";

interface F1RaceProps {
  timer: TimerApi;
}

// pixel space of the Austria_Circuit diagram (public/f1-track.avif)
const IMG_W = 1920;
const IMG_H = 1080;
const LAP_MS = 14000;

// hand-traced anchor points following the circuit's marked corners (01-10), plus a few
// extra points on the longer straights so the spline through them doesn't cut corners
const POINTS: [number, number][] = [
  [1051, 928], // 01 start/finish
  [508, 538], // 02
  [232, 392], // 03
  [620, 200], // pit straight midpoint
  [1057, 100], // 04
  [955, 260], // 05
  [645, 435], // 06
  [893, 657], // 07
  [963, 442], // 08
  [1230, 250], // transition to 09
  [1500, 190], // 09
  [1681, 385], // 10
  [1360, 715], // front straight midpoint, near the finish line marker
];

// closed Catmull-Rom spline through POINTS, converted to cubic beziers -- a smooth loop
// through the hand-picked anchors rather than a sharp-cornered polyline
function buildTrackPath(points: [number, number][]): string {
  const n = points.length;
  const at = (i: number) => points[((i % n) + n) % n];
  let d = `M ${points[0][0]} ${points[0][1]} `;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = at(i - 1);
    const [x1, y1] = at(i);
    const [x2, y2] = at(i + 1);
    const [x3, y3] = at(i + 2);
    const c1x = x1 + (x2 - x0) / 6;
    const c1y = y1 + (y2 - y0) / 6;
    const c2x = x2 - (x3 - x1) / 6;
    const c2y = y2 - (y3 - y1) / 6;
    d += `C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2} `;
  }
  return d;
}

export function F1Race({ timer }: F1RaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const pathD = useMemo(() => buildTrackPath(POINTS), []);

  // read inside the animation loop via a ref, not a dependency -- the loop's own startAt
  // must stay fixed across the whole lap, so it can't re-run every time remainingSeconds
  // ticks (that would restart the car from the beginning of the path every second)
  const remainingRef = useRef(timer.remainingSeconds);
  useEffect(() => {
    remainingRef.current = timer.remainingSeconds;
  }, [timer.remainingSeconds]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setBox({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // drives the car (and the time badge riding above it) directly via the DOM each frame,
  // same rAF + Date.now() pattern as DvdBounce -- reads wall-clock time so it "catches up"
  // instantly after a tab is backgrounded rather than drifting
  useEffect(() => {
    const path = pathRef.current;
    if (!path || box.w <= 0 || box.h <= 0) return;
    const total = path.getTotalLength();
    const startAt = Date.now();

    // the background image is rendered with object-fit: contain -- map the path's
    // 1920x1080 space onto the actual letterboxed box the same way
    const containerAspect = box.w / box.h;
    const imageAspect = IMG_W / IMG_H;
    let scale: number;
    let offsetX: number;
    let offsetY: number;
    if (containerAspect > imageAspect) {
      scale = box.h / IMG_H;
      offsetX = (box.w - IMG_W * scale) / 2;
      offsetY = 0;
    } else {
      scale = box.w / IMG_W;
      offsetX = 0;
      offsetY = (box.h - IMG_H * scale) / 2;
    }

    let raf: number;
    const tick = () => {
      const elapsed = (Date.now() - startAt) % LAP_MS;
      const progress = elapsed / LAP_MS;
      const len = progress * total;
      const p = path.getPointAtLength(len);
      const ahead = path.getPointAtLength((len + 4) % total);
      const angle = Math.atan2(ahead.y - p.y, ahead.x - p.x) * (180 / Math.PI);

      const sx = offsetX + p.x * scale;
      const sy = offsetY + p.y * scale;

      if (carRef.current) {
        carRef.current.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%) rotate(${angle}deg)`;
      }
      if (badgeRef.current) {
        badgeRef.current.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -230%)`;
        badgeRef.current.textContent = formatClock(remainingRef.current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [box.w, box.h, pathD]);

  return (
    <div className="stage-f1track-wrap" ref={containerRef}>
      <img className="stage-f1track-bg" src="/f1-track.avif" alt="" />
      <svg className="stage-f1track-svg" viewBox={`0 0 ${IMG_W} ${IMG_H}`} aria-hidden="true">
        <path ref={pathRef} d={pathD} fill="none" stroke="none" />
      </svg>
      <div className="stage-f1track-car" ref={carRef} aria-hidden="true">
        🏎️
      </div>
      <div className="stage-f1track-badge" ref={badgeRef} />
    </div>
  );
}
