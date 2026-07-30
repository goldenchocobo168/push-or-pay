// Push or Pay service worker — push receive + notification click only.
// No caching/offline logic; the app is server-rendered per request.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || "Push or Pay";
  const body = data.body || "Your streak is still waiting on you. 🔥";
  const url = data.url || "/";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/assets/icon-192.png",
    badge: "/assets/icon-192.png",
    data: { url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if (c.url.includes(url) && "focus" in c) return c.focus();
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
