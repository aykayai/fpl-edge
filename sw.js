/* FPL Signals service worker.
   Its job is to make the site installable as a real Android app and to survive
   a dropped connection. Deliberately network-first for the page itself, so a
   new version deployed to the server is picked up on the next load rather than
   being pinned to a stale cache. The API and /data are never cached here: the
   server is the source of truth and the app handles its own waiting states. */
const CACHE = "fpl-signals-v12.21.0";
const IMG_CACHE = "fpl-signals-img";
const SHELL = [
  "./",
  "./index.html",
  "./app-core.js",
  "./app-squad.js",
  "./app-render.js",
  "./app-odds.js",
  "./app-tracker.js",
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
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== IMG_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  /* The dataset, feeds and API are served same-origin now, and they must
     always be live: never cached, or the projections and the status chip
     would silently go stale. The browser's default network handling applies. */
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/data/")
      || url.pathname.includes("/api/") || url.pathname.includes("/data/")) return;

  if (url.hostname !== self.location.hostname) return;

  /* Club badges and player photos (served by our server since bundle 8):
     cache first, in a cache that survives releases. */
  if (url.pathname.startsWith("/img/")) {
    e.respondWith(caches.open(IMG_CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) c.put(req, res.clone());
      return res;
    }))));
    return;
  }

  /* The page: try the network first so updates arrive, fall back to cache. */
  if (req.mode === "navigate" || url.pathname.endsWith("index.html") || url.pathname.endsWith("/")) {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); }
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
        if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}
        return res;
      }).catch(()=>caches.match(req,{ignoreSearch:true}))
    );
    return;
  }

  /* Icons and the manifest rarely change: cache first, refresh in the background. */
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
