// synthesized chime — no audio asset needed, works offline. Browsers require some prior
// user interaction on the page before audio will play; by the time a session completes,
// the user has already clicked start/pause/etc, so this reliably plays.
//
// two passes of an ascending three-note chime, well above the old single quiet pair —
// loud enough to notice from another room, not just at the desk.
export function playChime(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
    const ctx = new Ctx();
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
    setTimeout(() => void ctx.close(), 1600);
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
