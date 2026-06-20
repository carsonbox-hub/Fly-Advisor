/* NZ Fly Finder — service worker (offline app shell) */
const CACHE = "nzflyfinder-v11";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const isPage = req.mode === "navigate" || req.destination === "document";

  if (isPage) {
    /* Network-first for the app page, bypassing the HTTP cache so a stale
       index.html can never be served while online. Fall back to cache offline. */
    e.respondWith(
      fetch(req.url, { cache: "reload" }).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put("./index.html", copy)).catch(() => {});
        return resp;
      }).catch(() => caches.match(req).then(c => c || caches.match("./index.html")))
    );
    return;
  }

  /* Cache-first for static assets (icons, manifest), refreshed in the background. */
  e.respondWith(
    caches.match(req).then(cached => {
      const live = fetch(req).then(resp => {
        if (resp && resp.status === 200 && resp.type === "basic") {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => cached);
      return cached || live;
    })
  );
});
