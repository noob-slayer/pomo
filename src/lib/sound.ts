// synthesized chime — no audio asset needed, works offline.
//
// strict browser autoplay policies (notably iOS/desktop Safari) only let audio actually
// play on an AudioContext instance that was created or resumed as a direct result of a
// user gesture -- resume()ing a context from inside a later, non-gesture callback (like
// our timer-completion effect, which fires from setInterval) silently produces no sound
// even though every node schedules without error. A completion chime can never itself be
// the triggering gesture, so we keep ONE shared context alive across the whole session
// and re-nudge it on every gesture (see unlockAudio, wired up from Shell) rather than
// just once: some browsers auto-suspend an AudioContext again after a period with no
// actual output, and a single early unlock doesn't survive that.
let sharedCtx: AudioContext | null = null;
let activeOscillators: OscillatorNode[] = [];
let stopTimer: ReturnType<typeof setTimeout> | null = null;

function resolveCtx(): AudioContext | null {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
    if (!sharedCtx || sharedCtx.state === "closed") sharedCtx = new Ctx();
    return sharedCtx;
  } catch {
    return null;
  }
}

export function unlockAudio(): void {
  const ctx = resolveCtx();
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

const NOTES = [880, 1108, 1318]; // A5, C#6, E6
const REPEAT_EVERY = 1.25; // seconds between the start of each ascending run
const TOTAL_DURATION = 3; // seconds — a brief alert, not a single short beep

// a ~3s alert (the ascending three-note run repeated a few times), loud enough to
// notice from another room. Call stopChime() to cut it short once the user has already
// acted on the completion (e.g. dismissed the continue/break prompt).
export function playChime(): void {
  const ctx = resolveCtx();
  if (!ctx) return;
  // scheduling tones against ctx.currentTime while the context is still "suspended"
  // schedules them against a clock that isn't actually advancing -- by the time resume()
  // completes, those start times can already be in the past and get silently dropped.
  // waiting for resume() to actually finish before reading currentTime and scheduling
  // fixes that; on an already-running context this branch is skipped entirely.
  if (ctx.state === "suspended") {
    ctx
      .resume()
      .then(() => schedule(ctx))
      .catch(() => schedule(ctx));
  } else {
    schedule(ctx);
  }
}

function schedule(ctx: AudioContext): void {
  try {
    stopChime();
    // notes overlap (ascending run, pass repeated) and each is driven fairly loud, so
    // route everything through a compressor to avoid clipping/distortion when several
    // overlapping tones' peaks sum above 0dB, instead of just turning gain down overall
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.ratio.value = 12;
    compressor.connect(ctx.destination);
    const now = ctx.currentTime;
    for (let t = 0; t < TOTAL_DURATION; t += REPEAT_EVERY) {
      NOTES.forEach((freq, i) => {
        const osc = playTone(ctx, compressor, freq, now + t + i * 0.11, 0.3);
        activeOscillators.push(osc);
      });
    }
    stopTimer = setTimeout(() => {
      activeOscillators = [];
      stopTimer = null;
    }, TOTAL_DURATION * 1000 + 200);
  } catch {
    // audio unavailable (blocked, unsupported, etc.) — never let this break completion flow
  }
}

// a short, soft two-note "blip" for an incoming lobby chat message -- deliberately nothing
// like playChime's ~3s room-filling alert: a chat ping should be a quick, quiet nudge, not
// something that talks over a focus session. Same shared-context/autoplay handling as the
// chime (see playChime), so it stays silent rather than erroring if audio isn't unlocked.
export function playMessagePing(): void {
  const ctx = resolveCtx();
  if (!ctx) return;
  const run = () => {
    try {
      const now = ctx.currentTime;
      // gentle rising pair, ~0.2s total -- still well under the chime's 0.75 gain, but
      // bumped from 0.28 so it's actually noticeable as a nudge rather than easy to miss
      playTone(ctx, ctx.destination, 660, now, 0.12, 0.42); // E5
      playTone(ctx, ctx.destination, 880, now + 0.08, 0.16, 0.42); // A5
    } catch {
      // audio unavailable -- a missed ping should never surface as an error
    }
  };
  // running is the common case now that Shell keeps the context warm while in a lobby, so
  // this takes the immediate path; the resume() fallback only pays its latency if the
  // context slipped to suspended between warm-up nudges
  if (ctx.state === "suspended") ctx.resume().then(run).catch(run);
  else run();
}

// cuts a still-playing chime short, e.g. once the user dismisses the completion prompt
export function stopChime(): void {
  for (const osc of activeOscillators) {
    try {
      osc.stop();
    } catch {
      // already stopped/ended — fine to ignore
    }
  }
  activeOscillators = [];
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
}

function playTone(
  ctx: AudioContext,
  destination: AudioNode,
  freq: number,
  start: number,
  duration: number,
  peak = 0.75,
): OscillatorNode {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
  return osc;
}
