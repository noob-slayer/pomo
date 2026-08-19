// minimal service worker whose only job is to receive Web Push messages and show them --
// no offline caching, no asset interception. Registered from
// src/lib/pushNotifications.ts, scoped to the whole origin (required for push to work at
// all, even though this app has no other use for a service worker).

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
      icon: "/pomo-icon.png",
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
