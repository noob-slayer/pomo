import { useEffect, useRef, useState } from "react";
import type { TimerApi } from "../hooks/useTimer";

interface DvdBounceProps {
  timer: TimerApi;
}

const LOGO_W = 140;
const LOGO_H = 64;
const SPEED_PX_PER_SEC = 90;

interface Trajectory {
  vx: number; // px/sec, always >= 0 -- direction comes from the fold, not the sign
  vy: number;
  startAt: number; // Date.now() ms epoch
}

// reflects an ever-increasing "unfolded" distance back and forth inside [0, bound],
// exactly like a ball bouncing between two walls at a constant speed
function foldTriangle(distance: number, bound: number): number {
  if (bound <= 0) return 0;
  const period = 2 * bound;
  let m = distance % period;
  if (m < 0) m += period;
  return m <= bound ? m : period - m;
}

// The Office's DVD-logo bit: everyone watches, hoping it'll hit a corner exactly, and it
// (almost) never does. Here it always does when a session is running with a known
// duration: the velocity is deliberately chosen so *ordinary* reflection motion (nothing
// scripted for the ending) lands the logo exactly on a corner the instant the timer
// completes -- see the comment below on why that's just arithmetic, not a trick played at
// the last second.
export function DvdBounce({ timer }: DvdBounceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const trajectoryRef = useRef<Trajectory | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // (re)pick a trajectory whenever the timer starts/resumes running, completes, or the
  // stage is resized. Paused deliberately does nothing here -- the animation loop below
  // freezes in place instead, and resuming re-enters the "running" branch, which
  // recomputes a fresh corner-bound trajectory from the accurate remaining time.
  useEffect(() => {
    const wb = size.w - LOGO_W;
    const hb = size.h - LOGO_H;
    if (wb <= 0 || hb <= 0) return;

    if (timer.status === "running" && timer.targetSeconds !== null && timer.remainingSeconds > 0) {
      // Unfolding a reflecting bounce: position(t) = fold(v*t, bound). fold(v*T, bound)
      // lands exactly on 0 or `bound` whenever v*T is an exact multiple of `bound` --
      // landing on 0 (even multiple) or `bound` (odd multiple). So picking
      // v = n * bound / T for a chosen integer n guarantees the logo is exactly at that
      // wall when t = T, for *any* starting speed/parity we like -- it's not luck, it's
      // solving for the velocity that makes it true from t = 0.
      const T = timer.remainingSeconds;
      const wantRight = Math.random() < 0.5;
      const wantBottom = Math.random() < 0.5;
      let nx = Math.max(1, Math.round((SPEED_PX_PER_SEC * T) / wb));
      if ((nx % 2 === 1) !== wantRight) nx += 1;
      let ny = Math.max(1, Math.round((SPEED_PX_PER_SEC * T) / hb));
      if ((ny % 2 === 1) !== wantBottom) ny += 1;
      trajectoryRef.current = { vx: (nx * wb) / T, vy: (ny * hb) / T, startAt: Date.now() };
    } else if (!trajectoryRef.current) {
      // nothing to continue from -- the very first mount, or an open-ended break
      // starting cold. Deliberately does NOT fire just because status became "idle"
      // after a normal completion: the corner-targeted trajectory above is still valid
      // math for t > T too (it just keeps bouncing on through), so leaving it in place
      // lets the logo visibly pass through the corner at the exact completion instant
      // and continue smoothly, instead of jump-cutting to a brand new wander the moment
      // status flips -- which was the bug this comment replaced.
      const angle = (0.2 + Math.random() * 0.6) * (Math.PI / 2);
      trajectoryRef.current = {
        vx: SPEED_PX_PER_SEC * Math.cos(angle),
        vy: SPEED_PX_PER_SEC * Math.sin(angle),
        startAt: Date.now(),
      };
    }
  }, [timer.status, size.w, size.h]);

  // drives the logo's position directly via the DOM (not React state) so a 60fps loop
  // doesn't force a re-render of anything else on the stage
  useEffect(() => {
    const wb = size.w - LOGO_W;
    const hb = size.h - LOGO_H;
    if (wb <= 0 || hb <= 0) return;
    let raf: number;
    const tick = () => {
      const traj = trajectoryRef.current;
      if (traj && timer.status !== "paused" && logoRef.current) {
        const elapsed = (Date.now() - traj.startAt) / 1000;
        const x = foldTriangle(traj.vx * elapsed, wb);
        const y = foldTriangle(traj.vy * elapsed, hb);
        logoRef.current.style.transform = `translate(${x}px, ${y}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [size.w, size.h, timer.status]);

  return (
    <div className="stage-dvd-wrap" ref={containerRef}>
      <div className="stage-dvd-logo" ref={logoRef} style={{ width: LOGO_W, height: LOGO_H }}>
        pomo
      </div>
    </div>
  );
}
