// a bare interval ticker. Lives in a dedicated worker because Chrome throttles a hidden
// tab's own setInterval to about once a minute after ~5 minutes in the background -- which
// made a laptop running pomo in a background tab look offline to its other devices and to
// the lobby. Worker timers aren't subject to that throttling. The page sends the interval
// in ms (0 stops it) and gets an empty message back on every tick.
let id = null;
self.onmessage = (event) => {
  if (id !== null) clearInterval(id);
  id = null;
  const ms = Number(event.data);
  if (ms > 0) id = setInterval(() => self.postMessage(0), ms);
};
