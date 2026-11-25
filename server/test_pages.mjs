/* League, Status and Chip Report pages (Bundle F, 22 Nov 2026).

   The real app in jsdom against the real server on the frozen state. Each
   page is rendered and read back; the figures it shows are checked against
   the raw feed the server serves (actuals.json), read here with no app
   function involved, or against a status made up here so the right answer
   is known in advance.

   League › Tracker  the four figure cards and the six report cards under
                     Weekly Breakdown; the Table | Charts toggle; one table
                     row per week in the feed, with that week's points.
   Status            its figure cards and report cards; the Sources figure
                     counts the sources the Data Sources card lists.
   Chip Report       opens, has no Rivals' Chips section, and lists each
                     chip the feed says was played this season.

   Usage: STATE_DIR=... JSDOM_DIR=... node server/test_pages.mjs
   Optional: PORT (default 8113). */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";

import { freePort, watchServer } from "./test_server.mjs";
process.env.TZ = "Europe/London";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT) || await freePort();   /* never a fixed port: see test_server.mjs */
const BASE = `http://127.0.0.1:${PORT}`;
const STATE_DIR = process.env.STATE_DIR;
if (!STATE_DIR) { console.error("Set STATE_DIR to a populated server state dir."); process.exit(2); }
/* the season from the date, the app's rule: a season starts in August */
const SEASON_Y = (d => d.getUTCMonth() >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1)(new Date());
const SEASON = `${SEASON_Y}-${SEASON_Y + 1}`;

function loadJSDOM() {
  for (const dir of [process.env.JSDOM_DIR, ROOT, process.cwd()].filter(Boolean)) {
    try { return createRequire(join(dir, "x.js"))("jsdom"); } catch { /* next */ }
  }
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
    stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", () => {}); child.stderr.on("data", d => process.stderr.write("[server] " + d));
  watchServer(child, PORT);
  return child;
}
async function waitForServer() {
  await server.ready;   /* our own server, not another run's on the same port */
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE + `/data/insights/${SEASON}/players.csv`, { method: "HEAD" })).ok) return; } catch { /* not up */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error("server did not come up at " + BASE);
}
async function runApp() {
  const dom = new JSDOM(`<!DOCTYPE html><html><body><div class="wrap" id="app"></div></body></html>`,
    { url: "https://app.local/fpl/#/league/tracker", runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window, ctx = dom.getInternalVMContext();
  w.fetch = async (url, opts) => {
    const s = String(url);
    if (!s.startsWith("/")) return { ok: false, status: 404, text: async () => "", json: async () => ({}), clone() { return this; } };
    const r = await fetch(BASE + s, opts); const t = await r.text();
    return { ok: r.ok, status: r.status, text: async () => t, json: async () => JSON.parse(t), clone() { return this; } };
  };
  w.AbortController = AbortController; w.setTimeout = setTimeout; w.clearTimeout = clearTimeout; w.scrollTo = () => {};
  w.setInterval = () => 0;
  w.console = { log() {}, warn() {}, error() {} };
  for (const f of FILES) vm.runInContext(readFileSync(join(ROOT, f), "utf8"), ctx, { filename: f });
  vm.runInContext(`window.__g={get S(){return S},render,act}`, ctx);
  const g = w.__g, S = g.S;
  const until = Date.now() + 180000;
  while (Date.now() < until && !(S.model && !S.loading)) await new Promise(r => setTimeout(r, 250));
  if (!S.model) throw new Error("app never built a model: " + (S.err || "none"));
  return { w, g, S, doc: w.document };
}
const txt = el => (el && el.textContent || "").replace(/\s+/g, " ").trim();
/* a figure card by its title (the title text, without its (i) button) */
const figs = doc => Object.fromEntries([...doc.querySelectorAll(".sx-figs .fc")].map(c => [(c.querySelector(".fct").firstChild.textContent || "").trim(), c]));

const server = startServer();
try {
  await waitForServer();
  const feed = JSON.parse(await (await fetch(BASE + "/data/feeds/actuals.json")).text());
  const weeks = (feed.team && feed.team.gw) || [];
  const { g, S, doc } = await runApp();
  const app = () => doc.getElementById("app");

  /* ---------- League › Tracker ---------- */
  {
    S.tab = "tracker"; S.trkView = null; g.render();
    const F = figs(doc);
    check(["Overall Rank", "Top %", "Season Points", "Team Value"].every(k => F[k]), "Tracker: the four figure cards", Object.keys(F).join(", "));
    const last = weeks[weeks.length - 1];
    check(!!F["Season Points"] && txt(F["Season Points"].querySelector(".fcv")) === String(last.totalPoints), `Tracker: Season Points is the feed's total after GW${last.event} (${last.totalPoints})`, F["Season Points"] && txt(F["Season Points"].querySelector(".fcv")));
    const SIX = { trkcmp: "Gameweek Comparison", trkhist: "Season Against History", trkcareer: "Career Finishes", trkchips: "Chip Performance", trksubs: "Sub Tracker", trktrans: "Transfers" };
    const reps = [...doc.querySelectorAll(".trkpage .repgrid .rep")];
    const named = Object.entries(SIX).filter(([id, h]) => { const r = doc.getElementById("r-" + id); return r && txt(r.querySelector("h3")) === h && txt(r.querySelector(".rb")).length > 3; });
    /* 22 Nov 2026: the mini-league table and Head to Head (Rivals, folded in) lead the page */
    check(reps.length === 9 && reps[0].id === "r-lgtable" && reps[1].id === "r-lgh2h" && !!doc.getElementById("r-trkweek") && named.length === 6, "League: the mini-league table and Head to Head, then Weekly Breakdown and the six report cards, each with content",
      `${reps.length} reports: ${reps.map(r => txt(r.querySelector("h3"))).join(", ")}`);
    check(!/NaN|undefined/.test(txt(app())), "Tracker: no NaN or undefined");

    /* Weekly Breakdown: one row per week in the feed, with its points */
    const rows = [...doc.querySelectorAll("#r-trkweek table.ax-wb tbody tr")].map(tr => [...tr.children].map(td => txt(td)));
    const bad = weeks.filter((r, i) => !rows[i] || rows[i][0] !== String(r.event) || !rows[i][1].startsWith(String(r.points)));
    check(rows.length === weeks.length && !bad.length, `Weekly Breakdown: ${weeks.length} rows, one per week in the tracker feed, each with that week's points`,
      `${rows.length} rows; ` + bad.slice(0, 4).map(r => `GW${r.event} ${r.points}`).join(", "));
    const tog = () => [...doc.querySelectorAll("#r-trkweek .sx-tog button")];
    check(tog().map(b => txt(b)).join("|") === "Table|Charts" && tog()[0].classList.contains("on"), "Weekly Breakdown: the Table | Charts toggle, Table on");
    g.act("trkview", "charts");
    check(!doc.querySelector("#r-trkweek table") && doc.querySelectorAll("#r-trkweek .ax-sm").length === 6 && tog()[1].classList.contains("on"),
      "Weekly Breakdown: Charts swaps the table for six charts", `${doc.querySelectorAll("#r-trkweek .ax-sm").length} charts`);
    g.act("trkview", "table");
    check(doc.querySelectorAll("#r-trkweek table.ax-wb tbody tr").length === weeks.length && tog()[0].classList.contains("on"), "Weekly Breakdown: Table brings the table back");
  }

  /* ---------- Status ---------- */
  {
    S.tab = "xfpl"; g.render();
    const F = figs(doc);
    check(["Model Error", "Model vs FPL", "Goals Error", "Sources"].every(k => F[k]), "Status: the four figure cards", Object.keys(F).join(", "));
    const REPS = { stmvf: "Model vs FPL", stpva: "Predicted vs Actual", stsrc: "Data Sources", sthit: "Signal Hit Rates", stnews: "News Sources", stfix: "Fixture Ratings", stodds: "Odds", stmodel: "xFPL Model", stkey: "Signal Key", stopt: "Options" };
    /* Signal Hit Rates grades saved predictions, which the frozen state does
       not have; its body is then empty (no waiting line: reported, not
       changed here), so it is only required to be there */
    const miss = Object.entries(REPS).filter(([id, h]) => { const r = doc.getElementById("r-" + id); return !r || txt(r.querySelector("h3")) !== h || (id !== "sthit" && txt(r.querySelector(".rb")).length < 3); });
    check(!miss.length, "Status: the ten report cards, each with content (Signal Hit Rates: present)", miss.map(x => x[1]).join(", "));
    check(!/NaN|undefined/.test(txt(app())), "Status: no NaN or undefined");
    /* the Sources figure counts the Data Sources card: live of listed */
    const srcCheck = (label, wantOk, wantAll) => {
      const F2 = figs(doc), fig = txt(F2.Sources && F2.Sources.querySelector(".fcv")), sub = txt(F2.Sources && F2.Sources.querySelector(".fcc"));
      const list = [...doc.querySelectorAll("#r-stsrc .ax-s")], ok = list.filter(r => r.querySelector(".sdot.ok")).length;
      const m = /^(\d+) of (\d+)$/.exec(fig);
      const all = wantAll ?? list.length, live = wantOk ?? ok;
      check(!!m && +m[1] === live && +m[2] === all && list.length === all && ok === live && (all - live ? sub === `${all - live} need a look` : sub === "All live"),
        `Status: Sources reads "${live} of ${all}" ${label}`, `figure "${fig}" / "${sub}", card ${ok} of ${list.length}`);
    };
    srcCheck("as the frozen state reports them");
    /* a made-up status: everything fresh, but the dataset has an error and
       the odds failed, so two of the ten sources need a look */
    const keep = S.status, now = new Date().toISOString();
    S.status = { ...(keep || {}), dataset: { committedAt: now, lastError: "test" }, fpl: { fetchedAt: now, liveFetchedAt: now }, feeds: { lastOk: now },
      news: { fetchedAt: now, perSource: { A: { ok: true, fetchedAt: now }, B: { ok: true, fetchedAt: now } } }, odds: { state: "fail", fetchedAt: now },
      tv: { fetchedAt: now }, snapshots: { result: { at: now, ok: true } }, field: { builtAt: now } };
    g.render();
    srcCheck("with the dataset in error and the odds failed", 8, 10);
    S.status = keep; g.render();
  }

  /* ---------- Chip Report ---------- */
  {
    S.tab = "chips"; g.render(); g.act("chippop", "report");
    const modal = doc.querySelector(".modal");
    check(!!modal && txt(modal.querySelector("h2")) === "Chip Report" && !!doc.getElementById("r-chseas") && !!doc.getElementById("r-chpicked"),
      "Chip Report: opens with Your Chips Season by Season and How Well You Picked", modal ? txt(modal.querySelector("h2")) : "no modal");
    check(!!modal && !/Rivals'? Chips|Rivals’ Chips/.test(txt(modal)) && !doc.getElementById("r-chrivals"), "Chip Report: no Rivals' Chips section (it lives on Signals › My Season)");
    const played = weeks.filter(r => r.chip).map(r => r.event).sort((a, b) => a - b);
    const rows = [...doc.querySelectorAll("#r-chpicked .cx-hr2:not(.hd)")].map(r => +((/Played GW(\d+)/.exec(txt(r)) || [])[1]));
    check(rows.length === played.length && rows.every((e, i) => e === played[i]), `Chip Report: How Well You Picked lists the ${played.length} chips the feed records (GW${played.join(", GW")})`, rows.join(","));
    check(!/NaN|undefined/.test(txt(modal)), "Chip Report: no NaN or undefined");
    g.act("chippopclose");
    check(!doc.querySelector(".modal"), "Chip Report: closes");
  }
} catch (e) {
  fail++; console.log("FAIL  run aborted -- " + (e && e.stack || e));
} finally {
  server.kill();
}
console.log(`\n${pass} passed, ${fail} failed`);
if (!fail) console.log("All page checks passed.");
process.exit(fail ? 1 : 0);
