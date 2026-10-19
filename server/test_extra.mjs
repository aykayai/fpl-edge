/* Extra checks (13 Oct 2026, audit X33 and F14), run on the real app in
   jsdom against the real server with the scheduler frozen.

   F14  A first visit to the bare address with nothing stored draws the app
        and sets a route (it used to render nothing).
   X33  Cache round trip: a second visit with the network cut builds the
        same model from the saved snapshot as the first visit built live.
   X33  Every page renders, the Planner in both Pitch and List view.
   X33  News with hostile data: no element, link or number gets through.
   X33  learningFrom on synthetic samples gives the arithmetic it should.

   Usage: STATE_DIR=... JSDOM_DIR=... node server/test_extra.mjs
   Optional: PORT (default 8091). */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";

process.env.TZ = "Europe/London";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8091);
const BASE = `http://127.0.0.1:${PORT}`;
const STATE_DIR = process.env.STATE_DIR;
if (!STATE_DIR) { console.error("Set STATE_DIR to a populated server state dir."); process.exit(2); }

function loadJSDOM() {
  for (const dir of [process.env.JSDOM_DIR, ROOT, process.cwd()].filter(Boolean)) {
    try { return createRequire(join(dir, "x.js"))("jsdom"); } catch { /* next */ }
  }
  console.error("jsdom not found. Set JSDOM_DIR to a folder whose node_modules has jsdom.");
  process.exit(2);
}
const { JSDOM } = loadJSDOM();
const FILES = ["app-core.js", "app-squad.js", "app-render.js", "app-odds.js", "app-tracker.js", "app-main.js"];
const TABS = ["squad", "transfers", "chips", "rivals", "tracker", "table", "odds", "fixtures", "news", "xfpl", "signals"];

let pass = 0, fail = 0;
const check = (ok, name, detail) => {
  if (ok) { pass++; console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + (detail ? " -- " + detail : "")); }
};

function startServer() {
  const child = spawn(process.execPath, [join(ROOT, "server", "server.mjs")], {
    env: { ...process.env, PORT: String(PORT), STATE_DIR, ODDS_API_KEY: "", SIGNALS_TICK_MS: "86400000" },
    stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", () => {}); child.stderr.on("data", d => process.stderr.write("[server] " + d));
  return child;
}
async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE + "/data/insights/2026-2027/players.csv", { method: "HEAD" })).ok) return; } catch { /* not up */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error("server did not come up at " + BASE);
}

/* One app run. idb: a Map standing in for IndexedDB, shared between runs to
   test the round trip. offline: every fetch fails. */
async function runApp(url, idb, offline) {
  const dom = new JSDOM(`<!DOCTYPE html><html><head><title>x</title></head><body><svg id="sprite"><defs></defs></svg><div class="wrap" id="app"></div></body></html>`,
    { url, runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window, ctx = dom.getInternalVMContext();
  w.fetch = async (u, opts) => {
    const s = String(u);
    if (offline || !s.startsWith("/")) throw new TypeError("fetch failed");
    const r = await fetch(BASE + s, opts); const t = await r.text();
    return { ok: r.ok, status: r.status, text: async () => t, json: async () => JSON.parse(t), clone() { return this; } };
  };
  w.AbortController = AbortController; w.setTimeout = setTimeout; w.clearTimeout = clearTimeout; w.scrollTo = () => {};
  w.setInterval = () => 0;
  w.console = { log() {}, warn() {}, error() {} };
  w.__idb = idb;
  vm.runInContext(readFileSync(join(ROOT, FILES[0]), "utf8"), ctx, { filename: FILES[0] });
  /* IndexedDB stand-in, installed before the boot code runs */
  vm.runInContext(`IDB.get=async k=>{const v=window.__idb.get(k);return v===undefined?null:JSON.parse(v);};
    IDB.set=async (k,v)=>{window.__idb.set(k,JSON.stringify(v));};`, ctx);
  for (const f of FILES.slice(1)) vm.runInContext(readFileSync(join(ROOT, f), "utf8"), ctx, { filename: f });
  vm.runInContext(`window.__g={get S(){return S},render,act,learningFrom,itemHTML}`, ctx);
  const g = w.__g, S = g.S;
  const until = Date.now() + 180000;
  while (Date.now() < until && !(S.model && !S.loading)) await new Promise(r => setTimeout(r, 250));
  return { w, g, S, doc: w.document };
}
const pts = S => { const g = S.model.next.id; return Object.fromEntries(S.model.players.map(p => [p.id, +((p.gw[g] || {}).pts || 0).toFixed(4)])); };

const server = startServer();
try {
  await waitForServer();
  const idb = new Map();

  /* F14 */
  const a = await runApp("https://app.local/", idb, false);
  check(!!a.S.model && !a.S.err, "F14 a first visit to the bare address builds the model", a.S.err || "");
  const html = a.doc.getElementById("app").innerHTML;
  check(html.length > 1000 && /fcgrid|navlink/.test(html), "F14 and draws the app", `${html.length} chars`);
  check(/^#\//.test(a.w.location.hash), "F14 and sets a route", a.w.location.hash || "(no hash)");

  /* every page, Planner both views */
  const bad = [];
  for (const t of TABS) {
    for (const view of t === "squad" ? ["pitch", "list"] : [null]) {
      a.S.tab = t; a.S.cardId = null; if (view) a.S.sqView = view;
      let err = null; try { a.g.render(); } catch (e) { err = String(e.message || e); }
      const txt = a.doc.getElementById("app").textContent;
      if (err || /hit a problem and could not be drawn/.test(txt)) bad.push(t + (view ? "/" + view : "") + ": " + (err || "error panel"));
    }
  }
  check(!bad.length, "X33 every page renders, the Planner in both Pitch and List view", bad.join("; "));

  /* news with hostile data */
  const H = '<img id="xss" src=x>';
  const item = { src: "src" + H, title: "t" + H, url: "javascript:alert(1)", time: Date.now(), score: '<b id="xs">9</b>', comments: '"><img id="xc">', extra: H };
  const out = a.g.itemHTML(item, true);
  const box = a.doc.createElement("div"); box.innerHTML = out;
  check(!box.querySelector("img,b"), "X33 news: hostile text stays text", box.innerHTML.slice(0, 120));
  check(box.querySelector("a").getAttribute("href") === "#", "X33 news: only http(s) links", box.querySelector("a").getAttribute("href"));
  const okItem = a.g.itemHTML({ ...item, url: "https://example.com/x", score: "12", comments: 3 }, true);
  check(/href="https:\/\/example\.com\/x"/.test(okItem) && /▲ 12/.test(okItem) && /3 comments/.test(okItem), "X33 news: real links and numbers still show");

  /* learningFrom on synthetic samples */
  const mk = (n, p, a2) => Array.from({ length: n }, (_, i) => ({ p: p + (i % 2 ? 0.5 : -0.5), a: a2 + (i % 2 ? 1 : -1) }));
  const L = a.g.learningFrom({ 2: mk(10, 3, 3), 3: mk(30, 2, 3), 4: mk(30, 4, 2) }, { 1: 15, 2: 25, 3: 25, 4: 20 }, 5);
  check(!L[2], "X33 learning: a position under its minimum sample is left alone");
  check(L[3] && L[3].scale === 1.4 && L[3].n === 30 && L[3].gw === 5, "X33 learning: scale is actual/predicted, capped at 1.4", JSON.stringify(L[3]));
  check(L[4] && L[4].scale === 0.7, "X33 learning: and floored at 0.7", JSON.stringify(L[4]));
  check(L[3] && Math.abs(L[3].spread - 1.5) < 1e-9, "X33 learning: spread is the ratio of spreads, capped at 1.5", JSON.stringify(L[3]));

  /* cache round trip: wait for the snapshot to be saved, then go offline */
  for (let i = 0; i < 40 && !idb.has("snap"); i++) await new Promise(r => setTimeout(r, 250));
  check(idb.has("snap"), "X33 a successful load saves a snapshot", [...idb.keys()].join(","));
  const live = pts(a.S);
  const b = await runApp("https://app.local/#/squad", idb, true);
  check(!!b.S.model, "X33 offline, the second visit builds from the snapshot", b.S.err || "");
  if (b.S.model) {
    const off = pts(b.S);
    const diff = Object.keys(live).filter(k => live[k] !== off[k]);
    check(diff.length === 0 && Object.keys(off).length === Object.keys(live).length,
      "X33 and gets the same projection for every player", `${diff.length} differ of ${Object.keys(live).length}`);
  }
} catch (e) {
  fail++; console.log("FAIL  run aborted -- " + (e && e.message || e));
} finally {
  server.kill();
}
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "Some extra checks FAILED." : "All extra checks passed.");
process.exit(fail ? 1 : 0);
