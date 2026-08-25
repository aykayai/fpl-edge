/* FPL Edge service worker.
   Its job is to make the site installable as a real Android app and to survive a
   dropped connection. Deliberately network-first for the page itself, so a new
   version published to GitHub Pages is picked up on the next load rather than
   being pinned to a stale cache. */
const CACHE = "fpl-edge-v9.4.3";
const SHELL = [
  "./",
  "./index.html",
  "./app-core.js",
  "./app-squad.js",
  "./app-render.js",
  "./app-odds.js",
  "./app-main.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./favicon-32.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
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
  const url = new URL(req.url);

  /* Player and fixture data comes from GitHub and must always be live — never
     served from cache, or the projections would silently go stale. */
  if (url.hostname !== self.location.hostname) return;

  /* The page: try the network first so updates arrive, fall back to cache. */
  if (req.mode === "navigate" || url.pathname.endsWith("index.html") || url.pathname.endsWith("/")) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  /* The script files change with every release, so they follow the page rather
     than the icons: network first, cache only as a fallback. */
  if(url.pathname.endsWith(".js") && !url.pathname.endsWith("sw.js")){
    e.respondWith(
      fetch(req).then(res=>{
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(req,copy));
        return res;
      }).catch(()=>caches.match(req))
    );
    return;
  }

  /* The actuals feed is rewritten by a scheduled job, so it must never be
     pinned: network first, cache only so the last known scores survive
     offline. Without this it falls through to the icon rule below and freezes
     until the next cache bump. */
  if(url.pathname.includes("/data/")){
    e.respondWith(
      fetch(req).then(res=>{
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(req,copy));
        return res;
      }).catch(()=>caches.match(req))
    );
    return;
  }

  /* Icons and the manifest rarely change: cache first, refresh in the background. */
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }))
  );
});
