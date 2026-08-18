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

// traced from the actual circuit diagram: the image marks each sector (01-10) in its own
// colour, so the real racing line was extracted directly by thresholding those sector
// colours, skeletonizing each coloured stretch to its 1px centerline, and walking the
// pixels into an ordered chain -- stitched across the small gaps where turn-number labels
// and sector text interrupt the colour. Far more accurate than eyeballing corner
// coordinates by hand.
const TRACK_POINTS: [number, number][] = [
  [1119, 836],
  [1099, 855],
  [1076, 873],
  [1053, 887],
  [1030, 873],
  [1007, 855],
  [984, 841],
  [961, 827],
  [938, 814],
  [915, 800],
  [892, 786],
  [869, 772],
  [737, 681],
  [714, 662],
  [691, 642],
  [668, 621],
  [645, 599],
  [622, 577],
  [599, 556],
  [576, 537],
  [553, 519],
  [530, 503],
  [507, 490],
  [484, 478],
  [461, 467],
  [438, 457],
  [412, 446],
  [389, 437],
  [366, 428],
  [343, 419],
  [293, 399],
  [270, 385],
  [284, 364],
  [307, 350],
  [330, 337],
  [353, 325],
  [376, 314],
  [399, 304],
  [422, 294],
  [445, 286],
  [468, 278],
  [491, 271],
  [514, 265],
  [537, 260],
  [560, 255],
  [583, 250],
  [606, 245],
  [629, 241],
  [652, 235],
  [675, 230],
  [698, 225],
  [721, 220],
  [744, 215],
  [767, 210],
  [790, 204],
  [813, 197],
  [836, 189],
  [859, 180],
  [882, 172],
  [905, 163],
  [955, 145],
  [978, 136],
  [1001, 128],
  [1024, 125],
  [1042, 144],
  [1043, 167],
  [1038, 190],
  [1031, 213],
  [1021, 236],
  [1007, 259],
  [989, 282],
  [966, 303],
  [943, 319],
  [920, 329],
  [897, 337],
  [745, 374],
  [722, 384],
  [700, 404],
  [687, 427],
  [683, 450],
  [685, 473],
  [695, 496],
  [717, 517],
  [740, 535],
  [763, 553],
  [786, 570],
  [809, 587],
  [833, 608],
  [856, 616],
  [879, 619],
  [902, 614],
  [925, 601],
  [944, 578],
  [952, 555],
  [958, 532],
  [966, 509],
  [979, 486],
  [997, 463],
  [1019, 442],
  [1042, 426],
  [1065, 415],
  [1088, 405],
  [1111, 394],
  [1134, 384],
  [1157, 374],
  [1180, 363],
  [1203, 353],
  [1347, 288],
  [1370, 277],
  [1393, 267],
  [1416, 256],
  [1439, 246],
  [1462, 236],
  [1485, 233],
  [1508, 237],
  [1554, 278],
  [1574, 301],
  [1593, 324],
  [1612, 347],
  [1630, 370],
  [1637, 393],
  [1625, 416],
  [1609, 439],
  [1589, 462],
  [1567, 485],
  [1544, 504],
  [1521, 522],
  [1498, 540],
  [1475, 558],
  [1452, 576],
  [1429, 595],
  [1406, 613],
  [1383, 631],
  [1360, 649],
  [1337, 667],
  [1312, 687],
  [1289, 705],
  [1266, 723],
  [1243, 741],
  [1220, 759],
  [1197, 778],
  [1174, 796],
  [1151, 814],
  [1146, 817],
];

function buildTrackPath(points: [number, number][]): string {
  const [first, ...rest] = points;
  const d = [`M ${first[0]} ${first[1]}`, ...rest.map(([x, y]) => `L ${x} ${y}`), "Z"];
  return d.join(" ");
}

export function F1Race({ timer }: F1RaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const pathD = useMemo(() => buildTrackPath(TRACK_POINTS), []);

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
    if (total <= 0) return;
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
      {/* no JSX children here -- textContent is set imperatively in the rAF loop below.
          Rendering a reactive child on the same node React also owns causes React's
          reconciler and the imperative mutation to fight over the same text node,
          corrupting it (garbled/truncated text) the next time React re-renders it. */}
      <div className="stage-f1track-badge" ref={badgeRef} />
    </div>
  );
}
