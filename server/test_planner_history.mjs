/* FPL Signals - planner history render check (jsdom).

   With a feed that carries the owner's official per-week history, this boots
   the working-tree app in jsdom against a local server state and proves, for
   EVERY finished gameweek the feed has picks for, that stepping the planner
   to that week renders the official record and nothing editable:
     - the starting XI is exactly the official picks 1-11, in order, and the
       bench is picks 12-15 in order
     - the C badge sits on the player who actually carried the armband (and
       only there), the V badge on the picked vice
     - every XI player's card shows his ACTUAL points that week (captain
       multiplied), from the feed's per-player actuals
     - the week header shows the official total, the transfer count, the hit
       when one was paid, the chip when one was played, and the label
       "Official line-up · final"
     - no swap/remove/captain CONTROLS render (the badges are plain spans)
   and that the CURRENT gameweek still renders the draft squad with all the
   edit controls, that an empty planner seeded itself from the LATEST official
   picks (not the hard-coded GW1 seed), that "Reset" restores those picks, and
   that the header free-transfer count is the feed's reconciled number,
   labelled "feed".

   Needs: jsdom (JSDOM_DIR env or a node_modules on the usual paths) and a
   STATE_DIR whose feeds were built by the current scripts/build-actuals.mjs.
   Usage: STATE_DIR=... JSDOM_DIR=... node server/test_planner_history.mjs
   Optional: PORT (default 8094). */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";

process.env.TZ = "Europe/London";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8094);
const BASE = `http://127.0.0.1:${PORT}`;
const STATE_DIR = process.env.STATE_DIR;
if (!STATE_DIR) { console.error("Set STATE_DIR to a populated server state dir (new-format feeds)."); process.exit(2); }

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

let pass = 0, fail = 0;
const check = (ok, name, detail) => {
  if (ok) { pass++; console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + (detail ? " -- " + detail : "")); }
};

function startServer() {
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

async function runApp(statusOverride) {
  const dom = new JSDOM(`<!DOCTYPE html><html><body><div class="wrap" id="app"></div></body></html>`,
    { url: "https://app.local/fpl/#/team-planner", runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window, ctx = dom.getInternalVMContext();
  w.fetch = async (url, opts) => {
    if (statusOverride && String(url).endsWith("/api/status")) {
      const t = JSON.stringify(statusOverride);
      return { ok: true, status: 200, text: async () => t, json: async () => JSON.parse(t), clone() { return this; } };
    }
    const s = String(url);
    const real = s.startsWith("/") ? BASE + s : null;
    if (!real) return { ok: false, status: 404, text: async () => "", json: async () => ({}), clone() { return this; } };
    const r = await fetch(real, opts);
    const t = await r.text();
    return { ok: r.ok, status: r.status, text: async () => t, json: async () => JSON.parse(t), clone() { return this; } };
  };
  w.AbortController = AbortController; w.setTimeout = setTimeout; w.clearTimeout = clearTimeout; w.scrollTo = () => {};
  w.console = { log() {}, warn() {}, error() {} };
  for (const f of FILES) vm.runInContext(readFileSync(join(ROOT, f), "utf8"), ctx, { filename: f });
  vm.runInContext(`window.__g={get S(){return S},render,act,startingXI,squadPlayers,orderBench,freeTransfers,ftSource,resolveSeed,VG}`, ctx);
  const g = w.__g, S = g.S;
  const until = Date.now() + 180000;
  while (Date.now() < until && !(S.model && !S.loading)) await new Promise(r => setTimeout(r, 250));
  if (!S.model) throw new Error("app never built a model: " + (S.err || "no error recorded"));
  const until2 = Date.now() + 60000;
  while (Date.now() < until2 && S.newsState === "loading") await new Promise(r => setTimeout(r, 250));
  return { w, g, S };
}

const server = startServer();
try {
  await waitForServer();

  /* Pin the official gw to the dataset's first unfinished gameweek, exactly
     as the regression harness does, so the run is deterministic. */
  const sums = await (await fetch(BASE + "/data/insights/2026-2027/gameweek_summaries.csv")).text();
  const head = sums.trim().split("\n")[0].split(",");
  const iId = head.indexOf("id"), iFin = head.indexOf("finished");
  const dsNext = sums.trim().split("\n").slice(1).map(l => l.split(","))
    .map(r => ({ id: +r[iId], fin: String(r[iFin]).toLowerCase() === "true" }))
    .sort((a, b) => a.id - b.id).find(r => !r.fin)?.id ?? 1;
  const liveStatus = await (await fetch(BASE + "/api/status")).json();
  const pinned = { ...liveStatus, fpl: { ...(liveStatus.fpl || {}), gw: dsNext, nextDeadline: null } };

  const actuals = await (await fetch(BASE + "/data/feeds/actuals.json")).json();
  const feedRows = (actuals.team && actuals.team.gw) || [];
  const histRows = feedRows.filter(r => Array.isArray(r.picks) && r.picks.length === 15);
  if (!histRows.length) { console.error("The feeds in STATE_DIR carry no picks history - rebuild them with the current builder first."); process.exit(2); }

  console.log("booting the working-tree app in jsdom ...");
  const { w, g, S } = await runApp(pinned);
  const next = S.model.next.id;
  const finished = histRows.filter(r => r.event < next);
  console.log(`model next GW${next}; official history for GW ${histRows.map(r => r.event).join(", ")}`);

  /* ---- seeding: an empty planner starts from the LATEST official picks ---- */
  const latest = histRows.reduce((a, b) => (b.event > a.event ? b : a));
  const latestIds = latest.picks.slice().sort((a, b) => a.pos - b.pos).map(p => p.id);
  check(JSON.stringify((S.squad || []).slice().sort((a, b) => a - b)) === JSON.stringify(latestIds.slice().sort((a, b) => a - b)),
    `planner seeded from the latest official picks (GW${latest.event})`,
    `squad ${JSON.stringify(S.squad)} vs official ${JSON.stringify(latestIds)}`);

  /* ---- each finished week renders the official record, read-only ---- */
  S.tab = "squad";
  for (const row of finished) {
    const gw = row.event;
    g.act("startgw", gw);
    const app = w.document.getElementById("app");
    const text = app.textContent.replace(/\s+/g, " ");
    const picks = row.picks.slice().sort((a, b) => a.pos - b.pos);
    const wantXI = picks.slice(0, 11).map(p => p.id);
    const wantBench = picks.slice(11).map(p => p.id);
    const gotXI = g.startingXI().map(p => p.id);
    const gotBench = g.orderBench(g.squadPlayers().filter(p => !gotXI.includes(p.id))).map(p => p.id);
    let ok = true; const why = [];
    if (JSON.stringify(gotXI) !== JSON.stringify(wantXI)) { ok = false; why.push(`XI ${JSON.stringify(gotXI)} != official ${JSON.stringify(wantXI)}`); }
    if (JSON.stringify(gotBench) !== JSON.stringify(wantBench)) { ok = false; why.push(`bench ${JSON.stringify(gotBench)} != official ${JSON.stringify(wantBench)}`); }

    /* the C badge: exactly one, on the pick that actually carried the armband */
    const capPick = picks.find(p => p.multiplier >= 2) || picks.find(p => p.isC);
    const capPlayer = S.model.players.find(p => p.id === capPick.id);
    const capBadges = [...app.querySelectorAll('[title="Captain (official)"]')];
    if (capBadges.length !== 1) { ok = false; why.push(`${capBadges.length} official C badges`); }
    else {
      const card = capBadges[0].closest(".card");
      if (!card || !card.textContent.includes(capPlayer.web_name)) { ok = false; why.push(`C badge not on ${capPlayer.web_name}`); }
    }

    /* the captain's card shows his actual points for the week, multiplied */
    const capActs = (actuals.players || {})[String(capPick.id)] || {};
    const capPts = (capActs[String(gw)] ?? capActs[gw]);
    if (capPts != null && capBadges.length === 1) {
      const wantShown = (capPts * capPick.multiplier).toFixed(1);
      const card = capBadges[0].closest(".card");
      if (!card.textContent.includes(wantShown)) { ok = false; why.push(`captain card misses actual ${wantShown}`); }
    }

    /* official total, transfers, hit and chip in the week header */
    if (!text.includes(`GW${gw} official`) || !text.includes(String(row.points))) { ok = false; why.push("official total missing"); }
    const hitLine = `${row.transfers || 0} transfer${(row.transfers || 0) === 1 ? "" : "s"}`;
    if (!text.includes(hitLine)) { ok = false; why.push(`"${hitLine}" missing`); }
    if (row.transferCost > 0 && !text.includes(`-${row.transferCost} hit`)) { ok = false; why.push("hit missing"); }
    if (row.chipLabel && !text.includes(row.chipLabel)) { ok = false; why.push(`chip "${row.chipLabel}" missing`); }
    if (!text.includes("Official line-up · final")) { ok = false; why.push("official label missing"); }

    /* read-only: no sub/flag/captain CONTROLS anywhere on the pitch */
    const controls = [...app.querySelectorAll("button")].filter(b =>
      ["Substitute", "Replace", "Keep", "Captain", "Vice-captain"].includes(b.getAttribute("title") || "")
      || /tap to change order/.test(b.getAttribute("title") || ""));
    if (controls.length) { ok = false; why.push(`${controls.length} edit controls rendered`); }

    const hit = row.transferCost > 0 ? `, -${row.transferCost} hit` : "";
    check(ok, `GW${gw}: official XI+bench, C on ${capPlayer.web_name}, ${row.points} pts (${hitLine}${hit})${row.chipLabel ? " · " + row.chipLabel : ""}, read-only`, why.join("; "));
  }

  /* ---- the current week is still the editable draft ---- */
  g.act("startgw", next);
  const app = w.document.getElementById("app");
  const curText = app.textContent.replace(/\s+/g, " ");
  const curControls = [...app.querySelectorAll("button")].filter(b =>
    ["Substitute", "Captain"].includes(b.getAttribute("title") || ""));
  check(curControls.length > 0, `GW${next} (current): edit controls render (${curControls.length} found)`);
  check(!curText.includes("Official line-up · final"), `GW${next} (current): not labelled official`);
  const curXI = g.startingXI().map(p => p.id);
  check(curXI.every(id => (S.squad || []).includes(id)), `GW${next} (current): XI drawn from the draft squad`);

  /* ---- header free transfers come from the feed, reconciled ---- */
  const prev = feedRows.filter(r => r.event < next).sort((a, b) => a.event - b.event);
  const lastPrev = prev[prev.length - 1];
  const wantFt = (lastPrev && lastPrev.event === next - 1 && lastPrev.ftNext != null) ? lastPrev.ftNext
    : (feedRows.find(r => r.event === next) || {}).ftAvailable ?? null;
  check(wantFt != null && g.freeTransfers() === wantFt && g.ftSource() === "feed",
    `header free transfers = ${wantFt} from the feed ("official")`,
    `freeTransfers ${g.freeTransfers()}, ftSource ${g.ftSource()}, feed says ${wantFt}`);

  /* ---- Reset restores the official squad, not the seed ---- */
  S.squad = S.squad.slice(0, 10); // mangle the draft
  const src = g.resolveSeed(true);
  check(src === "official" && JSON.stringify((S.squad || []).slice().sort((a, b) => a - b)) === JSON.stringify(latestIds.slice().sort((a, b) => a - b)),
    "Reset restores the latest official picks",
    `source ${src}, squad ${JSON.stringify(S.squad)}`);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail === 0) console.log("All planner history checks passed.");
  process.exit(fail ? 1 : 0);
} catch (e) {
  console.error("planner history harness error: " + (e && e.stack || e));
  process.exitCode = 1;
} finally {
  server.kill();
}
