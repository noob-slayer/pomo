// synthesized chime — no audio asset needed, works offline.
//
// strict browser autoplay policies (notably iOS/desktop Safari) only let audio actually
// play on an AudioContext instance that was created or resumed as a direct result of a
// user gesture -- resume()ing a context from inside a later, non-gesture callback (like
// our timer-completion effect, which fires from setInterval) silently produces no sound
// even though every node schedules without error. A completion chime can never itself be
// the triggering gesture, so we keep ONE shared context alive across the whole session,
// unlocked once during the user's first real tap/click/keypress (see unlockAudio, wired
// up from a document-level listener in Shell), and reuse that same instance every time a
// session completes.
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
// loop bound is intentionally past 10s: with REPEAT_EVERY=1.25 an 8-repeat run (0..8.75s)
// only spans ~9.3s once the last note's decay is counted, short of the "at least 10s"
// ask -- bumping the bound to 10.5 lets a 9th repeat start at t=10s, pushing the actual
// audible span to ~10.6s
const TOTAL_DURATION = 10.5; // seconds — "continuous" alert, not a single short beep

// a continuous ~10s alert (the ascending three-note run repeated ~8x), loud enough to
// notice from another room. Call stopChime() to cut it short once the user has already
// acted on the completion (e.g. dismissed the continue/break prompt).
export function playChime(): void {
  try {
    const ctx = resolveCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
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
