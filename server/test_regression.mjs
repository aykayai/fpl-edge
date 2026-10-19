/* FPL Signals front-end regression check (step 2 of the server move).

   Runs the OLD app (a git ref, default the last pre-switch commit) and the
   NEW app (the working tree) in jsdom against THE SAME local server state,
   loads each fully, renders all ten pages, and diffs:
     - per-player next-GW predicted points, to 3 decimals
     - the header figures (free transfers, bank, plan bank, ft source)
     - every page's rendered text, after stripping the planned differences
       (brand strings, the status chip and provenance footer, GMT/BST labels,
       the data stamp, and the chips expiry date which was hard-coded before)
   The news and odds pages changed by design (server-fed panels, key box
   replaced by the server-held key), so they only have to render clean; their
   diff is printed, not failed.

   Needs: jsdom (JSDOM_DIR env, or a node_modules holding it on NODE_PATH),
   a state dir with a mirrored dataset (STATE_DIR env), and git for the old
   code. Usage:
     STATE_DIR=...  JSDOM_DIR=...  node server/test_regression.mjs
   Optional: OLD_REF (default 626c3f4), PORT (default 8093). */

import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";

process.env.TZ = "Europe/London";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OLD_REF = process.env.OLD_REF || "626c3f4";
const PORT = Number(process.env.PORT || 8093);
const BASE = `http://127.0.0.1:${PORT}`;
const STATE_DIR = process.env.STATE_DIR;
if (!STATE_DIR) { console.error("Set STATE_DIR to a populated server state dir."); process.exit(2); }

/* jsdom comes from wherever it is installed; the repo itself has no deps. */
function loadJSDOM() {
  const candidates = [process.env.JSDOM_DIR, ROOT, process.cwd()].filter(Boolean);
  for (const dir of candidates) {
    try { return createRequire(join(dir, "x.js"))("jsdom"); } catch { /* next */ }
  }
  try { return createRequire(import.meta.url)("jsdom"); } catch { /* fall through */ }
  console.error("jsdom not found. Set JSDOM_DIR to a folder whose node_modules has jsdom.");
  process.exit(2);
}
const { JSDOM } = loadJSDOM();

const FILES = ["app-core.js", "app-squad.js", "app-render.js", "app-odds.js", "app-tracker.js", "app-main.js"];
/* wave 8: Transfers and Odds are retired (their links redirect) */
const TABS = ["squad", "chips", "rivals", "tracker", "table", "fixtures", "news", "xfpl"];
/* pages that must match once the planned differences are stripped */
/* the Players page (table) was rebuilt in redesign wave 3 */
/* Teams (fixtures) gained the Clubs tab in wave 5 */
const STRICT = TABS.filter(t => t !== "news" && t !== "odds" && t !== "table" && t !== "fixtures");

/* ---------- old code out of git ---------- */
function materialiseOld() {
  const dir = mkdtempSync(join(tmpdir(), "fpl-old-"));
  for (const f of FILES) {
    const src = execFileSync("git", ["show", `${OLD_REF}:${f}`], { cwd: ROOT, maxBuffer: 1 << 26 });
    writeFileSync(join(dir, f), src);
  }
  return dir;
}

/* ---------- the server, against the shared state ---------- */
function startServer() {
  /* SIGNALS_TICK_MS is pushed out to a day so the scheduler never runs: the
     server serves the state dir exactly as handed to it, and writes nothing
     into it. Without this, the dataset poller can swap in a new upstream
     commit BETWEEN the old and new captures, so the two sides silently
     compare different data and every projection moves. That exact failure
     happened in the field: a state dir showed dataset/prev fetched 19:24 and
     dataset/current fetched 20:04, mid-test. The commit-identity check below
     guards the same hole from the other side. */
  const child = spawn(process.execPath, [join(ROOT, "server", "server.mjs")], {
    env: { ...process.env, PORT: String(PORT), STATE_DIR, ODDS_API_KEY: "", SIGNALS_TICK_MS: "86400000" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", d => process.stderr.write("[server] " + d));
  return child;
}
async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE + "/data/insights/2026-2027/players.csv", { method: "HEAD" });
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error("server did not come up with a dataset at " + BASE);
}

/* ---------- one app run in jsdom ---------- */
/* statusOverride: served for /api/status instead of the live answer. The
   comparison pins the official gw to the dataset's own first-unfinished
   gameweek, because the whole point of the status preference is to move the
   app when the two disagree, and a fair old-vs-new maths diff needs both
   models built for the same week. The real-status behaviour is reported
   separately below. */
async function runApp(dir, statusOverride) {
  const dom = new JSDOM(`<!DOCTYPE html><html><body><div class="wrap" id="app"></div></body></html>`,
    { url: "https://app.local/fpl/#/team-planner", runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window, ctx = dom.getInternalVMContext();
  /* Route every fetch onto the local server: the old code's public URLs map
     onto the mirror and feeds, the new code's same-origin paths pass through. */
  const route = u => {
    const s = String(u);
    if (s.startsWith("https://raw.githubusercontent.com/olbauday/FPL-Core-Insights/main/data/"))
      return BASE + "/data/insights/" + s.slice("https://raw.githubusercontent.com/olbauday/FPL-Core-Insights/main/data/".length);
    if (s === "https://raw.githubusercontent.com/aykayai/fpl-edge/main/data/actuals.json")
      return BASE + "/data/feeds/actuals.json";
    if (s === "https://raw.githubusercontent.com/aykayai/fpl-edge/main/data/rivals.json")
      return BASE + "/data/feeds/rivals.json";
    if (s.startsWith("/")) return BASE + s;
    return null;                       /* anything else is refused, not fetched */
  };
  w.fetch = async (url, opts) => {
    if (statusOverride && String(url).endsWith("/api/status")) {
      const t = JSON.stringify(statusOverride);
      return { ok: true, status: 200, text: async () => t, json: async () => JSON.parse(t), clone() { return this; } };
    }
    const real = route(url);
    if (!real) return { ok: false, status: 404, text: async () => "", json: async () => ({}), clone() { return this; } };
    const r = await fetch(real, opts);
    const t = await r.text();
    return { ok: r.ok, status: r.status, text: async () => t, json: async () => JSON.parse(t), clone() { return this; } };
  };
  w.AbortController = AbortController; w.setTimeout = setTimeout; w.clearTimeout = clearTimeout; w.scrollTo = () => {};
  w.console = { log() {}, warn() {}, error() {} };
  for (const f of FILES) vm.runInContext(readFileSync(join(dir, f), "utf8"), ctx, { filename: f });
  /* Count every buildModel call and read CAL at capture time, so a learning
     or rebuild difference between the two flows is reported, not guessed at.
     Injected before any load runs (the new app's boot is async and has not
     reached buildModel yet). */
  vm.runInContext(`window.__bmCalls=0;
    (function(){const orig=buildModel;buildModel=function(){window.__bmCalls++;return orig.apply(this,arguments);};})();`, ctx);
  vm.runInContext(`window.__g={get S(){return S},loadAll,render,ftSource,freeTransfers,bankFromFeed,planBank,REPO}`, ctx);
  const g = w.__g, S = g.S;

  if (String(g.REPO).startsWith("/")) {
    /* the new app boots itself; wait for the boot load (and news) to settle */
    const until = Date.now() + 180000;
    while (Date.now() < until && !(S.model && !S.loading)) await new Promise(r => setTimeout(r, 250));
    if (!S.model) throw new Error("new app never built a model: " + (S.err || "no error recorded"));
    const until2 = Date.now() + 60000;
    while (Date.now() < until2 && S.newsState === "loading") await new Promise(r => setTimeout(r, 250));
  } else {
    await g.loadAll(true);
    if (!S.model) throw new Error("old app never built a model: " + (S.err || "no error recorded"));
  }

  const out = { next: S.model.next.id, players: {}, pages: {},
    bmCalls: w.__bmCalls,
    calAtBase: vm.runInContext(`JSON.stringify(CAL)===JSON.stringify(CAL_BASE)`, ctx),
    header: { ftSource: g.ftSource(), freeTransfers: g.freeTransfers(), bankFromFeed: g.bankFromFeed(), planBank: g.planBank() } };
  for (const p of S.model.players) out.players[p.id] = +((p.gw[S.model.next.id] || {}).pts || 0).toFixed(3);
  for (const tab of TABS) {
    S.tab = tab; let err = null;
    try { g.render(); } catch (e) { err = String(e && e.stack || e).slice(0, 300); }
    /* the page body only: the header, menu and footer were redesigned (wave 1) */
    const app = w.document.getElementById("main") || w.document.getElementById("app");
    out.pages[tab] = { error: err, text: app.textContent.replace(/\s+/g, " ").trim() };
  }
  return out;
}

/* ---------- strip the planned differences ---------- */
function normalise(text, isNew) {
  let t = text;
  /* PLANNED (redesign wave 1): the Status page wraps the xFPL page with the
     data freshness list (which starts with the version) and the signal key */
  t = t.replace(/^Status.*?Signal Key.*?Set Piece ?/, "");
  /* the FPL Signals era is recognised by its brand, so a baseline from after
     the rebrand is normalised the same way as the new side */
  if (isNew || /FPL Signals/.test(text)) {
    t = t.replace(/Signals(?=\s*Player Data)/g, "");                     /* the new Signals menu entry */
    t = t.replace(/FPL Signals v[\d.]+.*$/, "");                       /* provenance footer */
    t = t.replace(/(Server unreachable|Up to date|Live|Waiting on)[^]*?Check now/g, ""); /* status chip */
    t = t.replace(/FPL Signals/g, "FPL Edge");                         /* brand */
    t = t.replace(/\s(GMT|BST)\b/g, "");                               /* zone labels are new */
  } else {
    t = t.replace(/FPL Edge v[\d.]+ · data refreshed.*$/, "");         /* old footer */
    t = t.replace(/↻ Refresh/g, "");                                   /* old header button */
    /* the old logo svg carried a literal FPL text node, once in the header
       and once in the sticky mini-bar; the new logo has no text */
    t = t.replace(/FPL FPL Edge · Gameweek/, "FPL Edge · Gameweek");
    t = t.replace(/ FPL (?=Predicted )/, " ");
  }
  t = t.replace(/expire [^▲▼]+/g, "expire ");                          /* chips expiry was hard-coded */
  /* PLANNED (redesign wave 1): new signal key and labels, League tabs,
     Status page around the xFPL model, Player Data renamed Players */
  t = t.replace(/^League ?Tracker ?Rivals ?/, "");
  t = t.replace(/^Players (?=\d+ players)/, "Player Data ").replace(/ Odds →/, "");
  t = t.replace(/All Players →/g, "Full Player Data →");
  /* PLANNED (wave 2): captaincy moved from the Planner into the This Week pop-up */
  t = t.replace(/Captaincy ?GW\d+ · your XI.*?Tap C to make him captain for this week\. ?/, "");
  t = t.replace(/ Transfers →/, "");
  {
    t = t.replace(/Differential Hot streak Attack Defence (STOP)?DefCon Nailed 85\+ Stats caution P?Penalties F?Free kicks C?Corners ?/, "");
    t = t.replace(/(£\d+\.\d[▲▼]?)\s*(?:(?:STOP|[PFC])\s*)+(?=(ARS|AVL|BOU|BRE|BHA|CHE|COV|CRY|EVE|FUL|HUL|IPS|LEE|LIV|MCI|MUN|NEW|NFO|SUN|TOT))/g, "$1");
    t = t.replace(/(Show only) ?[PFC ]*★/, "$1 ★");
  }
  /* the old shield badges carried letters (P, F, C, STOP); the new tiles carry
     none. Lone letters are dropped on both sides (the C/V armband markers too). */
  t = t.replace(/(^| )(STOP|[PFC])(?= |$)/g, "$1").replace(/(^| )(STOP|[PFC])(?= |$)/g, "$1");
  /* which players carry a signal changed by design: the empty-cell dot goes */
  t = t.replace(/(£\d+\.\d[▲▼]?)[\s·]+(?=[A-Z]{3})/g, "$1");
  /* PLANNED: the header free-transfer figure and its source label changed on
     purpose (see the header INFO above), so both are blanked on both sides. */
  t = t.replace(/Free transfers\s+(Unlimited|\d+)\s+(official|tracked locally|untracked) · max 5/g, "Free transfers X");
  t = t.replace(/Transfers\s*[∞\d]+\s*(?=Rank)/g, "Transfers X ");
  t = t.replace(/data \d{1,2} \w{3}, \d{2}:\d{2}/g, "data X");         /* xFPL load stamp */
  /* PLANNED (broken-items batch): overall rank now read from the feed, and
     Player Data states its count with a show-all control */
  t = t.replace(/Overall rank\s+(—|[\d,]+)\s+(from GW1|after GW\d+|waiting)/g, "Overall rank X");
  /* PLANNED (F59): the squad value now says it is buy prices beside FPL's own value */
  t = t.replace(/Squad value\s*£[\d.]+\s*(of £100\.0|buy prices · FPL £[\d.]+)/g, "Squad value X");
  t = t.replace(/Rank\s*(—|[\d,]+)\s*(?=Value)/g, "Rank X ");
  t = t.replace(/Showing (all )?\d+ (of \d+ )?players\s*(Show all \d+|Show fewer)/g, "");
  return t.replace(/\s+/g, " ").trim();
}

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0; while (i < n && a[i] === b[i]) i++;
  if (i === n && a.length === b.length) return null;
  return { at: i, old: a.slice(Math.max(0, i - 60), i + 120), new_: b.slice(Math.max(0, i - 60), i + 120) };
}

/* ---------- main ---------- */
let pass = 0, fail = 0;
const check = (ok, name, detail) => {
  if (ok) { pass++; console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + (detail ? " -- " + detail : "")); }
};

const server = startServer();
try {
  await waitForServer();
  const oldDir = materialiseOld();
  console.log(`old code: ${OLD_REF} -> ${oldDir}`);

  /* Pin the official gw to the dataset's first unfinished gameweek so both
     models are built for the same week; report the live disagreement too. */
  const sums = await (await fetch(BASE + "/data/insights/2026-2027/gameweek_summaries.csv")).text();
  const rows = sums.trim().split("\n").slice(1).map(l => l.split(","));
  const head = sums.trim().split("\n")[0].split(",");
  const iId = head.indexOf("id"), iFin = head.indexOf("finished");
  const dsNext = rows.map(r => ({ id: +r[iId], fin: String(r[iFin]).toLowerCase() === "true" }))
    .sort((a, b) => a.id - b.id).find(r => !r.fin)?.id ?? 1;
  const liveStatus = await (await fetch(BASE + "/api/status")).json();
  const pinned = { ...liveStatus, fpl: { ...(liveStatus.fpl || {}), gw: dsNext, nextDeadline: null } };
  if (liveStatus.fpl && liveStatus.fpl.gw && liveStatus.fpl.gw !== dsNext)
    console.log(`INFO  official FPL says the next gameweek is ${liveStatus.fpl.gw}, the dataset's finished flags say ${dsNext}.`
      + ` In production the new app follows the official API (the gameweek-correctness fix); pinned to GW${dsNext} here for a like-for-like maths diff.`);

  const commitBefore = (liveStatus.dataset || {}).commit || null;
  console.log("running OLD app against " + BASE + " ...");
  const OLD = await runApp(oldDir);
  console.log("running NEW app (working tree) ...");
  const NEW = await runApp(ROOT, pinned);
  const statusAfter = await (await fetch(BASE + "/api/status")).json();
  const commitAfter = (statusAfter.dataset || {}).commit || null;
  check(commitBefore != null && commitBefore === commitAfter,
    "dataset commit identical across both captures",
    `before ${commitBefore} vs after ${commitAfter}; the server must not refresh mid-test`);

  console.log(`INFO  buildModel calls: old ${OLD.bmCalls}, new ${NEW.bmCalls}`);
  check(OLD.calAtBase, "old app projected from base CAL (no learning applied)");
  check(NEW.calAtBase, "new app projected from base CAL (learning recorded, not applied; owner decision D4)");

  check(OLD.next === NEW.next, "same next gameweek", `old GW${OLD.next} vs new GW${NEW.next}`);

  const ids = Object.keys(OLD.players);
  const newIds = Object.keys(NEW.players);
  check(ids.length === newIds.length, `same player count (${ids.length})`, `old ${ids.length} vs new ${newIds.length}`);
  let ptsDiffs = 0; const examples = [];
  for (const id of ids) {
    if (OLD.players[id] !== NEW.players[id]) {
      ptsDiffs++;
      if (examples.length < 5) examples.push(`id ${id}: ${OLD.players[id]} -> ${NEW.players[id]}`);
    }
  }
  /* the size of any movement, so an intended model change is measured, not assumed */
  const moves = ids.map(id => ({ id, d: (NEW.players[id] ?? 0) - (OLD.players[id] ?? 0) })).filter(x => Math.abs(x.d) > 0.0005)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  if (moves.length) console.log(`INFO  projection moves: ${moves.length} players, largest ${moves.slice(0, 5).map(x => `id ${x.id} ${x.d > 0 ? "+" : ""}${x.d.toFixed(3)}`).join(", ")}; over 0.05: ${moves.filter(x => Math.abs(x.d) > 0.05).length}`);
  check(ptsDiffs === 0, `per-player GW${OLD.next} pts identical to 3dp (${ids.length} players)`, `${ptsDiffs} differ; ${examples.join("; ")}`);

  for (const k of ["bankFromFeed", "planBank"]) {
    check(JSON.stringify(OLD.header[k]) === JSON.stringify(NEW.header[k]), `header ${k} identical`,
      `${JSON.stringify(OLD.header[k])} vs ${JSON.stringify(NEW.header[k])}`);
  }
  /* PLANNED difference: the header free-transfer count changed on purpose.
     The old code rebuilt the count client-side (wrongly: it added the weekly
     +1 in GW1 and read the feed's chips map - which stores points - as
     gameweeks) and still labelled it "official". The new code only reports
     the builder's reconciled ftAvailable/ftNext as official; without those
     fields it falls back to the local tracker, labelled as such. */
  for (const k of ["ftSource", "freeTransfers"]) {
    console.log(`INFO  header ${k} (changed by design): old ${JSON.stringify(OLD.header[k])}, new ${JSON.stringify(NEW.header[k])}`);
  }

  for (const tab of TABS) {
    check(!NEW.pages[tab].error, `page renders: ${tab}`, NEW.pages[tab].error);
  }
  for (const tab of STRICT) {
    const a = normalise(OLD.pages[tab].text, false);
    const b = normalise(NEW.pages[tab].text, true);
    const d = firstDiff(a, b);
    check(!d, `page text unchanged outside planned places: ${tab}`,
      d ? `at ${d.at}\n   old: ...${d.old}...\n   new: ...${d.new_}...` : "");
  }
  for (const tab of ["news", "table", "fixtures"]) {
    const a = OLD.pages[tab].text, b = NEW.pages[tab].text;
    console.log(`INFO  ${tab} page (changed by design): old ${a.length} chars, new ${b.length} chars`);
    const d = firstDiff(a, b);
    if (d) console.log(`      first diff at ${d.at}: old ...${d.old}... | new ...${d.new_}...`);
  }

  console.log(`\n${pass} passed, ${fail} failed (players compared: ${ids.length})`);
  if (fail === 0) console.log("All regression checks passed.");
  process.exitCode = fail ? 1 : 0;
  /* the app now runs a minute status timer, which keeps jsdom's loop alive;
     the run is over, so leave explicitly with the verdict */
  process.exit(process.exitCode);
} catch (e) {
  console.error("regression harness error: " + (e && e.stack || e));
  process.exitCode = 1;
} finally {
  server.kill();
}
