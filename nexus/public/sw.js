/**
 * NEXUS Service Worker v2
 *
 * Performance caching strategies (Lighthouse-optimised):
 * ┌─────────────────────────────────┬────────────────────────────────┐
 * │ Resource                        │ Strategy                       │
 * ├─────────────────────────────────┼────────────────────────────────┤
 * │ /_next/static/* (JS/CSS chunks) │ Cache-first (immutable hash)   │
 * │ Font files (.woff2 / gstatic)   │ Cache-first (stable URLs)      │
 * │ Images (local + Unsplash + CDN) │ Stale-while-revalidate         │
 * │ HTML navigation pages           │ Network-first + offline shell  │
 * │ /api/* + Clerk + Supabase       │ Network-only (never cache)     │
 * └─────────────────────────────────┴────────────────────────────────┘
 *
 * Push / notification click are also handled (Task-029).
 */

const STATIC_CACHE = "nexus-static-v3";   // Content-hashed JS/CSS — immutable (v3: no-store guard)
const FONT_CACHE   = "nexus-fonts-v3";    // Web fonts — stable, cache forever
const IMAGE_CACHE  = "nexus-images-v3";   // User images — stale-while-revalidate
const PAGE_CACHE   = "nexus-pages-v3";    // HTML pages  — network-first

const ALL_CACHES = [STATIC_CACHE, FONT_CACHE, IMAGE_CACHE, PAGE_CACHE];

// Max entries kept in each cache to prevent unbounded growth
const IMAGE_CACHE_MAX = 60;
const PAGE_CACHE_MAX  = 20;

// Patterns that bypass the SW completely — always go to network
const BYPASS_PATTERNS = [
  /\/api\//,                                        // Nexus API
  /\/sign-in/,  /\/sign-up/,  /\/sso-callback/,    // Auth pages
  /clerk\.com/, /clerk\.dev/,                       // Clerk auth API
  /supabase\.co/,                                   // Supabase realtime
  /ingest\.sentry\.io/,                             // Sentry telemetry
  /stripe\.com/,                                    // Stripe
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isBypassed(url) {
  return BYPASS_PATTERNS.some((re) => re.test(url));
}
function isStaticAsset(url) {
  return url.includes("/_next/static/");
}
function isFont(url) {
  return url.includes("fonts.gstatic.com") || /\.(woff2?|ttf|otf|eot)(\?.*)?$/.test(url);
}
function isImage(url) {
  return (
    /\.(png|jpe?g|gif|webp|avif|svg|ico)(\?.*)?$/.test(url) ||
    url.includes("images.unsplash.com") ||
    url.includes("img.clerk.com") ||
    url.includes("avatars.githubusercontent.com") ||
    url.includes("lh3.googleusercontent.com")
  );
}

/**
 * Returns true only if the response should be stored in the cache.
 * Respects Cache-Control directives sent by the origin — in particular:
 *   - Next.js sets `Cache-Control: no-store` on /_next/static/* in dev so
 *     Turbopack chunk filenames can be re-used after source edits without
 *     poisoning the cache with stale JS (which causes hydration mismatches).
 *   - Any route that explicitly opts out of caching is honoured here too.
 */
function isCacheable(response) {
  const cc = (response.headers.get("cache-control") ?? "").toLowerCase();
  return response.ok && !cc.includes("no-store") && !cc.includes("no-cache");
}

/** Evict oldest entries once a cache exceeds maxEntries */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys  = await cache.keys();
  if (keys.length > maxEntries) {
    await cache.delete(keys[0]);
    await trimCache(cacheName, maxEntries); // recurse until within limit
  }
}

// ─── Install — pre-cache offline shell ────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await self.skipWaiting();
      // Pre-cache a minimal offline page if one exists
      const pageCache = await caches.open(PAGE_CACHE);
      await pageCache.add(new Request("/offline", { cache: "reload" })).catch(() => {
        // /offline page is optional — ignore 404
      });
    })()
  );
});

// ─── Activate — delete stale caches ──────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !ALL_CACHES.includes(k)).map((k) => caches.delete(k)));
    })()
  );
});

// ─── Fetch — route to the right strategy ─────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = request.url;

  // Only intercept same-scheme GET requests
  if (request.method !== "GET") return;
  if (!url.startsWith("http"))  return;
  if (isBypassed(url))           return;

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
  if (isFont(url)) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }
  if (isImage(url)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE, IMAGE_CACHE_MAX));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGE_CACHE, PAGE_CACHE_MAX));
    return;
  }
  // Everything else — straight network, no SW overhead
});

// ─── Strategy: Cache-first ────────────────────────────────────────────────────
/** Serve from cache; populate on first miss. Ideal for immutable assets. */
async function cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  // Only store if the origin permits caching (e.g. no-store in dev Turbopack)
  if (isCacheable(response)) cache.put(request, response.clone());
  return response;
}

// ─── Strategy: Stale-while-revalidate ────────────────────────────────────────
/** Return cache immediately; refresh in background. Ideal for images. */
async function staleWhileRevalidate(request, cacheName, maxEntries) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (isCacheable(response)) {
      cache.put(request, response.clone());
      trimCache(cacheName, maxEntries);
    }
    return response;
  }).catch(() => cached); // network failed — keep showing stale

  return cached ?? fetchPromise;
}

// ─── Strategy: Network-first ──────────────────────────────────────────────────
/** Try network first; fall back to cache or offline page. Ideal for HTML. */
async function networkFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      cache.put(request, response.clone());
      trimCache(cacheName, maxEntries);
    }
    return response;
  } catch {
    const cached  = await cache.match(request);
    if (cached) return cached;
    // Last resort: generic offline shell
    const offline = await cache.match("/offline");
    return offline ?? new Response("You are offline", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

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
