// registers public/sw.js on page load so pomo is installable and opens offline. production
// only -- in `vite dev` a caching worker would serve stale modules and fight HMR.
// pushNotifications.ts calls register() for the same URL, which the browser dedupes.
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("service worker registration failed", err);
    });
  });
}
