// pomo's service worker: makes the app installable/offline-capable (PWA) and receives Web
// Push messages. Registered on load from src/lib/serviceWorker.ts (and re-used by
// src/lib/pushNotifications.ts), scoped to the whole origin.
//
// caching strategy:
//   - page navigations: network-first, falling back to the cached app shell when offline
//   - /assets/* (Vite's content-hashed bundles) and icons: cache-first, they never change
//   - everything else (Supabase, YouTube, large bg videos, /api): untouched, straight to network
// bump CACHE_VERSION to force old caches to be dropped on the next activate.

const CACHE_VERSION = "v1";
const SHELL_CACHE = `pomo-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `pomo-assets-${CACHE_VERSION}`;
const SHELL_URLS = ["/", "/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith("pomo-") && k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // SPA navigations: always try the network so deploys show up immediately; keep the
  // latest shell around so the app still opens offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // only the app itself is the offline shell -- the SEO landing pages are
          // navigations too, and caching them under "/" would open a landing page offline
          if (response.ok && url.pathname === "/") {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(() => caches.match("/").then((cached) => cached || Response.error())),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(ASSET_CACHE).then((cache) =>
        cache.match(request).then(
          (cached) =>
            cached ||
            fetch(request).then((response) => {
              if (response.ok) cache.put(request, response.clone());
              return response;
            }),
        ),
      ),
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = { title: "pomo", body: "keep your streak alive today" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // non-JSON payload -- fall back to the default copy above rather than failing silently
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/pomo-icon.png",
      tag: "pomo-streak-reminder", // replaces any earlier unclicked reminder instead of stacking
    }),
  );
});

// focuses an already-open pomo tab if one exists, otherwise opens a new one -- clicking
// the notification should always land you back in the app, not just dismiss it
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    }),
  );
});
