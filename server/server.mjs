/* FPL Signals server - one process that serves the app, mirrors the
   FPL Core Insights dataset, builds the private feeds, and caches news
   and odds. Node 24, no npm dependencies.

   ENV: PORT (8090), STATE_DIR (./state), ODDS_API_KEY, FPL_LEAGUE_ID,
   FPL_TEAM_ID. GET and HEAD only; anything else is 405.

   Routes:
     /                      the app (repo root static files, no-cache)
     /data/insights/<path>  mirrored dataset files
     /data/feeds/*.json     locally built actuals.json / rivals.json
     /api/status            everything the header chip and footer need
     /api/news              merged sanitised items + per-source status
     /api/player-news       ?names=a,b  Google News per player
     /api/odds              odds-api.io cache, { state:"nokey" } without a key */

import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { readFile, stat, mkdir, writeFile, rename } from "node:fs/promises";
import { join, dirname, resolve, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG } from "./lib/config.mjs";
import { log } from "./lib/util.mjs";
import { initDataset, pollDataset, datasetStatus, datasetGW, currentDir } from "./lib/dataset.mjs";
import { fetchBootstrap, fetchLive, nearDeadline, anyFixtureLive, priceFetchDue, fplStatus } from "./lib/fpl.mjs";
import { refreshNews, newsPayload, newsStatus, playerNews } from "./lib/news.mjs";
import { initOdds, refreshOdds, oddsPayload, oddsStatus } from "./lib/odds.mjs";
import { buildFeeds, feedsStatus, FEEDS_DIR, SNAP_DIR } from "./lib/feeds.mjs";
import { snapshotTick, snapshotStatus } from "./lib/snapshot.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ---------------- content types and static serving ---------------- */

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".csv": "text/csv; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8"
};

function send(res, method, status, headers, body) {
  res.writeHead(status, headers);
  res.end(method === "HEAD" ? undefined : body);
}

function sendJson(res, method, status, obj, extra = {}) {
  const body = JSON.stringify(obj);
  send(res, method, status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-cache",
    "Content-Length": Buffer.byteLength(body),
    ...extra
  }, body);
}

/* Decode and reject anything that could escape a base directory. */
function safeJoin(base, rawPath) {
  let p;
  try { p = decodeURIComponent(rawPath); } catch { return null; }
  if (p.includes("\0") || p.includes("\\")) return null;
  const segs = p.split("/").filter(Boolean);
  if (segs.some(s => s === "." || s === "..")) return null;
  const full = resolve(base, segs.join("/"));
  if (full !== base && !full.startsWith(base + sep)) return null;
  return full;
}

async function serveFile(res, method, fullPath, extraHeaders = {}) {
  let body, s;
  try {
    s = await stat(fullPath);
    if (!s.isFile()) throw new Error("not a file");
    body = await readFile(fullPath);
  } catch {
    sendJson(res, method, 404, { error: "not found" });
    return;
  }
  const ext = extname(fullPath).toLowerCase();
  const type = TYPES[ext] || "application/octet-stream";
  /* the service worker handles caching; HTML and JS stay no-cache so a
     deploy is picked up on the next online load */
  const cache = (ext === ".html" || ext === ".js" || ext === ".mjs")
    ? "no-cache" : "public, max-age=300";
  /* F81 (bundle 9, 13 Oct 2026): "no-cache" now costs a 304 instead of a
     full download (ETag from size and modified time), and text goes out
     gzipped (the app's scripts ~4x smaller, the dataset CSVs more). */
  const req = res.req;
  const etag = `W/"${s.size.toString(16)}-${Math.floor(s.mtimeMs).toString(16)}"`;
  const head = { "Content-Type": type, "Cache-Control": cache, "ETag": etag, ...extraHeaders };
  if (req && req.headers["if-none-match"] === etag) { send(res, method, 304, head); return; }
  let out = body;
  if (s.size > 1024 && /^(text\/|application\/(json|javascript|manifest))/.test(type)
      && /\bgzip\b/.test((req && req.headers["accept-encoding"]) || "")) {
    out = gzipFor(fullPath, s, body);
    head["Content-Encoding"] = "gzip";
    head["Vary"] = "Accept-Encoding";
  }
  head["Content-Length"] = out.length;
  send(res, method, 200, head, out);
}
/* compressed copies, kept until the file changes */
const _gz = new Map();
function gzipFor(path, st, body) {
  const hit = _gz.get(path);
  if (hit && hit.size === st.size && hit.mtime === st.mtimeMs) return hit.buf;
  const buf = gzipSync(body, { level: 6 });
  _gz.set(path, { size: st.size, mtime: st.mtimeMs, buf });
  return buf;
}

/* ---------------- request handling ---------------- */

async function handle(req, res) {
  const method = req.method;
  if (method !== "GET" && method !== "HEAD") {
    sendJson(res, "GET", 405, { error: "method not allowed" }, { Allow: "GET, HEAD" });
    return;
  }
  const u = new URL(req.url, "http://localhost");
  const path = u.pathname;

  try {
    if (path === "/api/status") {
      const ds = datasetStatus();
      ds.gw = await datasetGW();
      const feeds = await feedsStatus();
      sendJson(res, method, 200, {
        now: new Date().toISOString(),
        dataset: ds,
        fpl: fplStatus(),
        feeds,
        news: newsStatus(),
        odds: oddsStatus(),
        snapshots: snapshotStatus()
      });
      return;
    }
    if (path === "/api/news") { sendJson(res, method, 200, newsPayload()); return; }
    if (path === "/api/player-news") {
      sendJson(res, method, 200, await playerNews(u.searchParams.get("names")));
      return;
    }
    if (path === "/api/odds") { sendJson(res, method, 200, oddsPayload()); return; }

    if (path.startsWith("/data/insights/")) {
      const full = safeJoin(currentDir(), path.slice("/data/insights/".length));
      if (!full) { sendJson(res, method, 400, { error: "bad path" }); return; }
      const ds = datasetStatus();
      await serveFile(res, method, full, {
        "X-Source-Time": ds.committedAt || "",
        "X-Fetched-At": ds.fetchedAt || ""
      });
      return;
    }

    /* F107 (bundle 8, 13 Oct 2026): club badges and player photos are fetched
       from the Premier League once, kept in STATE_DIR/img and served from
       here, instead of 20+ hot-linked images per visit. A missing image is a
       404 and the page falls back to its shirt drawing as before. */
    const im = /^\/img\/(badge|player)\/(\d{1,7})\.png$/.exec(path);
    if (im) {
      const dir = join(CONFIG.STATE_DIR, "img", im[1]);
      const full = join(dir, im[2] + ".png");
      let have = false;
      try { have = (await stat(full)).isFile(); } catch { /* not cached yet */ }
      if (!have) {
        const url = im[1] === "badge"
          ? `https://resources.premierleague.com/premierleague/badges/50/t${im[2]}.png`
          : `https://resources.premierleague.com/premierleague/photos/players/110x140/p${im[2]}.png`;
        try {
          const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
          if (!r.ok) { sendJson(res, method, 404, { error: "not found" }); return; }
          await mkdir(dir, { recursive: true });
          await writeFile(full + ".tmp", Buffer.from(await r.arrayBuffer()));
          await rename(full + ".tmp", full);
        } catch { sendJson(res, method, 502, { error: "image source unavailable" }); return; }
      }
      await serveFile(res, method, full, { "Cache-Control": "public, max-age=604800" });
      return;
    }

    if (path.startsWith("/data/feeds/")) {
      const name = path.slice("/data/feeds/".length);
      /* predictions.json (live pre-deadline snapshots) and backtest.json (the
         labelled GW1-6 backtest series) live in the snapshot dir */
      if (!/^(actuals|rivals|predictions|backtest)\.json$/.test(name)) { sendJson(res, method, 404, { error: "not found" }); return; }
      const full = join(/^(predictions|backtest)/.test(name) ? SNAP_DIR() : FEEDS_DIR(), name);
      let mtime = "";
      try { mtime = (await stat(full)).mtime.toISOString(); } catch { /* 404s below */ }
      await serveFile(res, method, full, {
        "X-Source-Time": mtime,
        "X-Fetched-At": mtime,
        "Cache-Control": "no-cache"
      });
      return;
    }

    /* static app shell: only files sitting in the repo root */
    const name = path === "/" ? "index.html" : path.slice(1);
    if (!/^[A-Za-z0-9._-]+$/.test(name) || name.startsWith(".")) {
      sendJson(res, method, 404, { error: "not found" });
      return;
    }
    const ext = extname(name).toLowerCase();
    if (!TYPES[ext]) { sendJson(res, method, 404, { error: "not found" }); return; }
    await serveFile(res, method, join(REPO_ROOT, name));
  } catch (e) {
    sendJson(res, method, 500, { error: "server error" });
    log("http", "error " + e.message);
  }
}

/* ---------------- scheduler ---------------- */
/* One 60-second tick decides what is due. Each job keeps an in-flight
   flag so a slow run is never overlapped by the next one. */

const jobs = {};
function job(name, fn) { jobs[name] = { fn, due: 0, busy: false }; }

job("dataset", pollDataset);
job("fpl", () => fetchBootstrap());
job("news", refreshNews);
job("odds", refreshOdds);
job("feeds", buildFeeds);

async function runJob(name, nextMs) {
  const j = jobs[name];
  if (j.busy) return;
  j.busy = true;
  j.due = Date.now() + nextMs;
  try { await j.fn(); } catch (e) { log(name, "error " + e.message); }
  j.busy = false;
}

async function tick() {
  const now = Date.now();
  if (jobs.dataset.due <= now) runJob("dataset", CONFIG.DATASET_POLL_MS);
  const fplEvery = nearDeadline() ? CONFIG.FPL_POLL_NEAR_MS : CONFIG.FPL_POLL_MS;
  if (jobs.fpl.due <= now || priceFetchDue()) runJob("fpl", fplEvery);
  if (jobs.news.due <= now) runJob("news", CONFIG.NEWS_POLL_MS);
  if (CONFIG.ODDS_API_KEY && jobs.odds.due <= now) runJob("odds", CONFIG.ODDS_POLL_MS);
  if (CONFIG.FEEDS_POLL_MS > 0 && jobs.feeds.due <= now) runJob("feeds", CONFIG.FEEDS_POLL_MS);
  if (await anyFixtureLive().catch(() => false)) {
    if (!jobs.live) job("live", fetchLive);
    if (jobs.live.due <= now) runJob("live", CONFIG.FPL_LIVE_MS);
  }
  snapshotTick();
}

/* ---------------- boot ---------------- */

async function main() {
  await mkdir(CONFIG.STATE_DIR, { recursive: true });
  await initDataset();
  await initOdds();

  const server = createServer(handle);
  server.listen(CONFIG.PORT, () => {
    log("server", `listening on ${CONFIG.PORT}, state ${CONFIG.STATE_DIR}`);
  });

  /* jittered start so a fleet of restarts does not hit upstreams in step */
  const jitter = Math.floor(Math.random() * Math.max(CONFIG.JITTER_MS, 1));
  /* A test run sets SIGNALS_TICK_MS to hold the scheduler still. That must
     include the start-up pass too, or a new upstream commit can be pulled into
     the state dir mid-test (seen 12 Oct 2026). */
  const frozen = CONFIG.TICK_MS >= 3600000;
  setTimeout(() => {
    if (!frozen) tick();
    setInterval(tick, CONFIG.TICK_MS);
  }, jitter);
}

main().catch(e => { console.error(e); process.exit(1); });
