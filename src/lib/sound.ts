// synthesized chime — no audio asset needed, works offline. Browsers require some prior
// user interaction on the page before audio will play; by the time a session completes,
// the user has already clicked start/pause/etc, so this reliably plays.
export function playChime(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    playTone(ctx, 880, now, 0.16);
    playTone(ctx, 1175, now + 0.15, 0.24);
    setTimeout(() => void ctx.close(), 700);
  } catch {
    // audio unavailable (blocked, unsupported, etc.) — never let this break completion flow
  }
}

function playTone(ctx: AudioContext, freq: number, start: number, duration: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.3, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}
