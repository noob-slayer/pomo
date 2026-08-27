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

function playTone(ctx: AudioContext, destination: AudioNode, freq: number, start: number, duration: number): OscillatorNode {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.75, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
  return osc;
}
