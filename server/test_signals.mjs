/* Signals page check (12 Oct 2026).

   Runs the real app in jsdom against the real server (scheduler frozen, so
   the state dir is served exactly as handed over), opens the Signals page and
   checks it two ways:

   1. Independently. The season scorer table and the goals-conceded table are
      recomputed here straight from the raw CSVs the server mirrors, with no
      app function involved, so a mistake in the app's own data join shows up
      as a disagreement instead of being copied.
   2. Behaviour. Every control (position, horizon, fold) changes what it says
      it changes and is remembered; the Your Squad cards only ever name squad
      players; no card is blank and no figure reads NaN or undefined.

   Usage: STATE_DIR=... JSDOM_DIR=... node server/test_signals.mjs
   Optional: PORT (default 8097). */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";

process.env.TZ = "Europe/London";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8097);
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

let pass = 0, fail = 0;
const check = (ok, name, detail) => {
  if (ok) { pass++; console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + (detail ? " -- " + detail : "")); }
};

/* a small quote-aware CSV reader of our own (not the app's parseCSV) */
function csv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const get = async p => (await fetch(BASE + p)).text();

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
async function runApp() {
  const dom = new JSDOM(`<!DOCTYPE html><html><body><div class="wrap" id="app"></div></body></html>`,
    { url: "https://app.local/fpl/#/signals", runScripts: "outside-only", pretendToBeVisual: true });
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
  return { w, g, S };
}
const cardBy = (doc, title) => [...doc.querySelectorAll(".sgcard")].find(c => c.querySelector("h3")?.textContent.trim() === title);

const server = startServer();
try {
  await waitForServer();
  const { w, g, S } = await runApp();
  const doc = w.document;
  /* 25 Oct 2026: Signals has four tabs (Transfers, My Squad, Teams, Players) */
  const showTab = t => { S.tab = "signals"; g.act("sgtab", t); };
  const WANT = { transfers: 11, squad: 9, teams: 6, players: 8 };
  let allText = "";
  for (const [t, n] of Object.entries(WANT)) {
    showTab(t);
    const reps = [...doc.querySelectorAll(".sgpage .rep")];
    check(reps.length === n, `${t}: all ${n} reports present`, `found ${reps.length}: ${reps.map(r => r.querySelector("h3").textContent).join(", ")}`);
    const blank = reps.filter(r => !r.classList.contains("shut") && !(r.querySelector(".rb") && r.querySelector(".rb").textContent.trim().length > 3));
    check(blank.length === 0, `${t}: every report has content or a waiting message`, blank.map(r => r.querySelector("h3").textContent).join(", "));
    allText += doc.querySelector(".sgpage") ? doc.querySelector(".sgpage").textContent : "";
  }
  check(!/NaN|undefined/.test(allText), "no NaN or undefined on any tab");
  check([...doc.querySelectorAll(".navlink")].some(a => a.textContent.trim() === "Signals"), "Signals is in the menu");
  const cardBy2 = id => doc.getElementById("r-" + id);

  /* ---------- 1. independent: season scorers by position ---------- */
  const season = "2026-2027";
  const players = csv(await get(`/data/insights/${season}/players.csv`));
  const posOf = {}; players.forEach(p => { posOf[p.player_id] = p.position; });
  const stats = csv(await get(`/data/insights/${season}/playerstats.csv`));
  const latest = {};
  stats.forEach(r => { const id = r.id, gw = +r.gw; if (!latest[id] || gw > +latest[id].gw) latest[id] = r; });
  const POSNAME = { GKP: ["Goalkeeper", "GKP", "1"], DEF: ["Defender", "DEF", "2"], MID: ["Midfielder", "MID", "3"], FWD: ["Forward", "FWD", "4"] };
  showTab("players");
  const scorersCard = cardBy2("scorers");
  const cols = scorersCard ? [...scorersCard.querySelectorAll(".sgcol")] : [];
  check(cols.length === 4, "scorer card has four position columns", `found ${cols.length}`);
  for (const col of cols) {
    const pos = col.querySelector(".sgcolh").textContent.trim();
    const pageRows = [...col.querySelectorAll(".hbr")].map(r => ({ name: r.querySelector(".hbl b").textContent.trim(), pts: +r.querySelector(".hbv").textContent }));
    const ours = Object.values(latest).filter(r => POSNAME[pos].includes(String(posOf[r.id])) && +r.minutes > 0)
      .map(r => ({ name: r.web_name, pts: +r.total_points })).sort((a, b) => b.pts - a.pts);
    const want = ours.slice(0, 5).map(x => x.pts), got = pageRows.map(x => x.pts);
    check(JSON.stringify(want) === JSON.stringify(got), `${pos} top-5 season points match the raw data`, `page ${got.join(",")} vs raw ${want.join(",")}`);
    /* names must match wherever the points are not tied with a neighbour */
    const bad = pageRows.filter((r, i) => { const tied = ours.filter(o => o.pts === r.pts).map(o => o.name); return !tied.includes(r.name); });
    check(bad.length === 0, `${pos} top-5 names are the right players`, bad.map(b => b.name + " " + b.pts).join(", "));
  }

  /* ---------- 1b. independent: goals conceded by team ---------- */
  const teams = csv(await get(`/data/insights/${season}/teams.csv`));
  const byCode = {}; teams.forEach(t => { byCode[String(Math.round(Number(t.code)))] = t.name; });
  const ga = {};
  for (let gw = 1; gw <= 38; gw++) {
    let rows; try { rows = csv(await get(`/data/insights/${season}/By%20Gameweek/GW${gw}/fixtures.csv`)); } catch { continue; }
    /* league matches only (the files also carry cup and European ties), and
       the team fields are club codes written as floats ("43.0") */
    rows.filter(r => String(r.finished).toLowerCase() === "true" && r.home_score !== "" && r.away_score !== ""
        && (!r.tournament || r.tournament === "prem")).forEach(r => {
      const code = v => String(Math.round(Number(v)));
      const h = byCode[code(r.home_team)], a = byCode[code(r.away_team)];
      if (!h || !a) return;
      ga[h] = (ga[h] || 0) + +r.away_score; ga[a] = (ga[a] || 0) + +r.home_score;
    });
  }
  /* the leakiest defences now come from Teams > Clubs sorted by Conceded */
  S.tab = "fixtures"; S.fixMode = "clubs"; S.tView = "att"; S.tSort = "ga"; S.tDir = "desc"; g.render();
  const lrows = [...doc.querySelectorAll(".hub tbody tr")].slice(0, 5).map(r => ({ name: r.querySelector(".nm b").textContent.trim(), ga: +r.querySelector('[data-k="ga"]').textContent }));
  S.tab = "signals"; S.tSort = null; g.render();
  const wantGa = Object.values(ga).sort((a, b) => b - a).slice(0, 5);
  check(JSON.stringify(lrows.map(r => r.ga)) === JSON.stringify(wantGa), "leakiest defences: goals conceded match the raw fixtures", `page ${lrows.map(r => r.ga)} vs raw ${wantGa}`);
  const lbad = lrows.filter(r => ga[r.name] !== r.ga);
  check(lrows.length === 5 && lbad.length === 0, "leakiest defences: each team's own total is right", lbad.map(b => `${b.name} page ${b.ga} raw ${ga[b.name]}`).join(", "));

  /* ---------- 1c. independent: the game's weekly average (25 Oct 2026) ---------- */
  const sums = csv(await get(`/data/insights/${season}/gameweek_summaries.csv`))
    .filter(r => String(r.finished).toLowerCase() === "true").sort((a, b) => +a.id - +b.id);
  showTab("squad");
  const latest2 = doc.querySelector("#r-vsgame .rlatest");
  const tracked = (S.tracker && S.tracker.gw || []).map(r => r.event);
  const lastFin = sums.filter(r => tracked.includes(Math.round(+r.id))).pop();
  const m = latest2 ? /GW(\d+): you \d+ · average (\d+)/.exec(latest2.textContent) : null;
  check(!!lastFin && !!m && +m[1] === Math.round(+lastFin.id) && +m[2] === Math.round(+lastFin.average_entry_score),
    "score vs game: latest finished week's average matches gameweek_summaries", `page ${latest2 ? latest2.textContent : "none"} vs raw GW${lastFin && lastFin.id} ${lastFin && lastFin.average_entry_score}`);

  /* ---------- 2. behaviour ---------- */
  const squadNames = new Set(S.model.players.filter(p => (S.squad || []).includes(p.id)).map(p => p.web_name));
  showTab("squad");
  const formNames = [...doc.querySelectorAll("#r-sqform .hbl b")].map(b => b.textContent.trim());
  check(formNames.length > 0 && formNames.every(n => squadNames.has(n)), `My Squad "In Form" names only squad players`, formNames.filter(n => !squadNames.has(n)).join(", "));
  const availNames = [...doc.querySelectorAll("#r-sqflag .sgwho b")].map(b => b.textContent.trim());
  check(availNames.every(n => squadNames.has(n)), `My Squad "Availability" names only squad players`, availNames.join(", "));
  showTab("transfers");
  const sellOut = [...doc.querySelectorAll("#r-sqrep .mvh .dn")].map(b => b.textContent.trim());
  check(sellOut.every(n => squadNames.has(n)), "Sell names only squad players", sellOut.join(", "));
  const sellIn = [...doc.querySelectorAll("#r-sqrep .mvh .up")].filter(b => b.tagName === "SPAN").map(b => b.textContent.trim());
  check(sellIn.every(n => !squadNames.has(n)), "every suggested swap is a player you do not own", sellIn.join(", "));

  showTab("players");
  g.act("sigpos", 3);
  check(!cardBy2("scorers").querySelector(".sgcol") && cardBy2("scorers").querySelectorAll(".hbr").length > 0, "position filter MID leaves one ranking");
  const posTags = [...cardBy2("form").querySelectorAll(".sgpos")].map(s => s.textContent);
  check(posTags.length > 0 && posTags.every(t => t === "MID"), "position filter MID applies to the In Form leaderboard", posTags.join(","));
  g.act("sigpos", 0);
  g.act("sigh", 5);
  const tip = cardBy2("pred").querySelector(".fci").getAttribute("data-tip");
  check(/next 5/.test(tip), "horizon Next 5 relabels Top Predicted", tip);
  g.act("sigh", 3);
  g.act("sigfold", "scorers");
  check(cardBy2("scorers").classList.contains("shut") && !cardBy2("scorers").querySelector(".rb"), "fold hides a report's body");
  const saved = JSON.parse(w.localStorage.getItem("fpl3:sig") || "{}");
  check(Array.isArray(saved.fold) && saved.fold.includes("scorers") && saved.h === 3 && saved.pos === 0 && saved.tab === "players", "tab, position, horizon and folds are remembered", JSON.stringify(saved));
  g.act("sigfold", "scorers");
  check(!cardBy2("scorers").classList.contains("shut"), "unfold brings it back");
  showTab("teams");
  check(/#\/signals\/teams$/.test(w.location.hash), "each tab has its own link", w.location.hash);
} catch (e) {
  fail++; console.log("FAIL  run aborted -- " + (e && e.stack || e));
} finally {
  server.kill();
}
console.log(`\n${pass} passed, ${fail} failed`);
if (!fail) console.log("All Signals checks passed.");
process.exit(fail ? 1 : 0);
