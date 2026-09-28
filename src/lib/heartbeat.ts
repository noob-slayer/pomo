// setInterval that keeps ticking in a background tab (see public/heartbeat-worker.js).
// Falls back to a plain page interval where workers aren't available. Returns a stop fn.
export function startHeartbeat(ms: number, tick: () => void): () => void {
  try {
    const worker = new Worker("/heartbeat-worker.js");
    worker.onmessage = () => tick();
    worker.postMessage(ms);
    return () => worker.terminate();
  } catch {
    const id = window.setInterval(tick, ms);
    return () => window.clearInterval(id);
  }
}
