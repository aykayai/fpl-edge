#!/usr/bin/env node
/* FPL Signals - pre-deadline prediction snapshot (F2, 13 Oct 2026).

   Records what the model said before a gameweek's deadline, so it can be
   graded against the points later. It runs the app's OWN app-core.js and
   app-odds.js in a Node vm, not a re-implementation, and points every fetch
   at this server, so the numbers are the ones a freshly opened page shows
   (dataset, feeds, status and odds included). No browser, no packages.

   Run by server/lib/snapshot.mjs at deadline - 60 and deadline - 15 minutes;
   the later run replaces the earlier one for the same gameweek. It refuses
   to write once the deadline has passed, so a snapshot can never contain the
   round's own results.

   env: BASE (default http://127.0.0.1:$PORT), FPL_PRED_OUT, FPL_SEASON,
        SNAPSHOT_GW (the gameweek expected), FPL_SNAPSHOT_FORCE=1 (testing:
        skip the deadline check). */

import fs from "node:fs";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE || `http://127.0.0.1:${process.env.PORT || 8090}`;
const OUT = process.env.FPL_PRED_OUT || join(ROOT, "state", "snapshots", "predictions.json");
const SEASON = process.env.FPL_SEASON || "2027";
const WANT_GW = Number(process.env.SNAPSHOT_GW) || null;
const FORCE = process.env.FPL_SNAPSHOT_FORCE === "1";

const read = f => fs.readFileSync(join(ROOT, f), "utf8");
const setpiece = /const SETPIECE=\{[\s\S]*?\n\};/.exec(read("app-squad.js"));
if (!setpiece) throw new Error("SETPIECE not found in app-squad.js");

const store = {};
const noop = () => {};
const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop }, setAttribute: noop, appendChild: noop, addEventListener: noop, innerHTML: "", textContent: "" });
const sb = {
  console: { log: noop, info: noop, warn: noop, error: (...a) => console.error(...a) },
  fetch: (u, o) => fetch(new URL(String(u), BASE), o),
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  location: { hash: "", href: BASE + "/" }, history: { replaceState: noop },
  document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener: noop, body: el(), title: "" },
  navigator: { userAgent: "fpl-signals-snapshot" },
  setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop,
  URL, Intl, performance,
  render: noop, toast: noop, dedupeSquad: noop, snapshotPredictions: noop, localFtTrack: noop,
  resolveSeed: noop, syncOfficialSquad: noop, savePaint: noop, esc: s => String(s), startingXI: () => []
};
sb.window = sb; sb.addEventListener = noop; sb.self = sb;
const ctx = vm.createContext(sb);
vm.runInContext(setpiece[0], ctx, { filename: "setpiece.js" });
vm.runInContext(read("app-core.js"), ctx, { filename: "app-core.js" });
let oddsLoaded = true;
try { vm.runInContext(read("app-odds.js"), ctx, { filename: "app-odds.js" }); }
catch (e) { oddsLoaded = false; console.error("app-odds.js did not load in the vm: " + e.message); }
/* app-odds.js also holds the page renderer; nothing is drawn here */
vm.runInContext("render=function(){};renderPage=function(){};", ctx);
const get = e => vm.runInContext(e, ctx);

async function main() {
  const st = await (await fetch(new URL("/api/status", BASE))).json();
  const deadline = st && st.fpl && st.fpl.nextDeadline;
  if (!FORCE && deadline && Date.now() >= Date.parse(deadline)) {
    console.log(`deadline ${deadline} has passed: not writing`);
    return;
  }
  await get("loadAll")(true);
  if (get("S.err")) throw new Error("loadAll: " + get("S.err"));
  /* the page loads odds on every open, then rebuilds; do the same */
  if (oddsLoaded && typeof get("typeof loadOdds") === "string" && get("typeof loadOdds") === "function") {
    try { await get("loadOdds")(); } catch (e) { console.error("odds: " + e.message); }
    get("buildModel")();
  }
  const g = get("S.model.next.id");
  if (WANT_GW && g !== WANT_GW) throw new Error(`model's next gameweek is ${g}, expected ${WANT_GW}`);
  const players = get(`(function(){const o={};S.model.players.forEach(p=>{const c=p.gw[${g}];
    if(c&&!c.blank)o[p.id]=Math.round(c.pts*100)/100;});return o;})()`);
  const n = Object.keys(players).length;
  if (n < 300) throw new Error(`only ${n} projections`);

  /* redesign wave 7: FPL's own expected points at the same moment, so the
     Status page can set the model against FPL on identical players */
  let fplEp = null;
  try {
    const fp = await (await fetch(new URL("/api/fpl-players", BASE))).json();
    fplEp = {};
    Object.entries(fp.players || {}).forEach(([id, x]) => { if (x && x.ep != null) fplEp[id] = x.ep; });
    if (!Object.keys(fplEp).length) fplEp = null;
  } catch (e) { console.error("fpl ep: " + e.message); }

  let payload = null;
  try { payload = JSON.parse(await readFile(OUT, "utf8")); } catch { /* first run */ }
  if (!payload || payload.season !== SEASON) payload = { season: SEASON, updated: null, gw: {} };
  payload.gw[g] = {
    source: "live",
    taken: new Date().toISOString(),
    deadline: deadline || null,
    appVersion: get("APP_VERSION"),
    gwPlayed: get("S.model.gwPlayed"),
    oddsUsed: !!get("S.oddsTeams"),
    propPlayers: get(`Object.keys(S.propMarket||{}).filter(id=>S.propMarket[id][${g}]).length`),
    propWeight: get("typeof PROP_W!=='undefined'?PROP_W:0"),
    learning: get("typeof LEARN_APPLY!=='undefined'&&LEARN_APPLY"),
    players,
    fplEp
  };
  payload.updated = new Date().toISOString();
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT + ".tmp", JSON.stringify(payload) + "\n");
  await rename(OUT + ".tmp", OUT);
  /* the exact prices the snapshot used, for the GW12 re-test of player and
     team odds on deadline prices (closing prices know the line-ups) */
  try {
    const odds = await (await fetch(new URL("/api/odds", BASE))).text();
    const dir = join(dirname(OUT), "odds-at-deadline");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `GW${g}.json`), odds);
  } catch (e) { console.error("odds archive: " + e.message); }
  console.log(`snapshot GW${g}: ${n} players, odds ${payload.gw[g].oddsUsed ? "on" : "off"}, v${payload.gw[g].appVersion}`);
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message || e); process.exit(1); });
