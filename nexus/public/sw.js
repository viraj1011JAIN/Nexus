/**
 * TASK-029 — Nexus Service Worker
 * Handles:
 *   1. Background push notification events (Web Push API)
 *   2. Notification click — focus existing tab or open a new one
 */

const CACHE_NAME = "nexus-sw-v1";

// ─── Install / Activate ───────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  // Skip waiting so the new SW activates immediately
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  // Claim all clients without waiting for a reload
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      // Clean up old caches
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    })()
  );
});

// ─── Push Notifications ───────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let payload = { title: "Nexus", body: "You have a new update.", url: "/" };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body:    payload.body,
      icon:    "/icon-192.png",
      badge:   "/icon-72.png",
      tag:     payload.tag ?? "nexus-default",
      renotify: true,
      data:    { url: payload.url ?? "/" },
      actions: [
        { action: "view",    title: "View" },
        { action: "dismiss", title: "Dismiss" },
      ],
    })
  );
});

// ─── Notification Click ────────────────────────────────────────────────────────

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url ?? "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

      for (const client of allClients) {
        if (new URL(client.url).pathname === new URL(targetUrl, self.location.origin).pathname) {
          client.focus();
          return;
        }
      }

      // No matching tab found — open a new one
      await self.clients.openWindow(targetUrl);
    })()
  );
});
