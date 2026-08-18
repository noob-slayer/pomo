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

// two passes of an ascending three-note chime, loud enough to notice from another room.
export function playChime(): void {
  try {
    const ctx = resolveCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    // notes overlap (ascending run, pass repeated) and each is driven fairly loud, so
    // route everything through a compressor to avoid clipping/distortion when several
    // overlapping tones' peaks sum above 0dB, instead of just turning gain down overall
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.ratio.value = 12;
    compressor.connect(ctx.destination);
    const now = ctx.currentTime;
    const notes = [880, 1108, 1318]; // A5, C#6, E6
    for (const pass of [0, 0.55]) {
      notes.forEach((freq, i) => playTone(ctx, compressor, freq, now + pass + i * 0.11, 0.3));
    }
  } catch {
    // audio unavailable (blocked, unsupported, etc.) — never let this break completion flow
  }
}

function playTone(ctx: AudioContext, destination: AudioNode, freq: number, start: number, duration: number): void {
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
}
