/* Projection check (Bundle F, 22 Nov 2026): an independent recompute of
   every player's expected points, then the chips, the captain and the
   horizons built on them.

   The rebuild below is written from the formulas the app states (its code
   comments and the D/M/C decisions), ported from the November audit's own
   rebuild (scratchpad maths/model.mjs, which matched the app to 1e-14), and
   brought up to date with two changes Andy approved since:
     M3  the appearance method starts at 3 appearances, floors "minutes when
         he starts" at 55 for every position (it was 80 for defenders and
         midfielders), and blends 3-9 appearances against the no-history
         estimate with weight clamp((n-2)/8,0,1) before this season's minutes
         ramp (D15) is applied;
     C13 while a week is in play, a club whose match that week has finished
         counts the week in its games played for the minutes ramp.
   It reads the same raw files the app reads (the dataset CSVs and FPL's live
   player feed, through the real server on the frozen state) and never calls
   an app function to produce a figure of its own. The only app value it
   takes as an input is S.oddsTeams (bookmaker goal expectations), because
   converting odds is not what is under test; the frozen state has none.

   Two runs:
     A  the frozen state as it is;
     B  the same state with three edits made in the fetch layer, seen by the
        app and the rebuild alike: the server's gameweek is set one past the
        week in play, one match of that week is marked finished (C13), and two
        fixtures two weeks ahead are moved, one a week later and one a week
        earlier, so four clubs blank and each pair doubles (the real data has
        no double or blank in the window).

   Usage: STATE_DIR=... JSDOM_DIR=... node server/test_model.mjs
   Optional: PORT (default 8112). */

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
const SEASON = `${SEASON_Y}-${SEASON_Y + 1}`, LAST = `${SEASON_Y - 1}-${SEASON_Y}`;

function loadJSDOM() {
  for (const dir of [process.env.JSDOM_DIR, ROOT, process.cwd()].filter(Boolean)) {
    try { return createRequire(join(dir, "x.js"))("jsdom"); } catch { /* next */ }
  }
  console.error("jsdom not found. Set JSDOM_DIR to a folder whose node_modules has jsdom.");
  process.exit(2);
}
const { JSDOM } = loadJSDOM();
/* the LP solver first, as the page loads it (self-hosted since 22 Nov 2026),
   so the Free Hit checks cover the full optimiser, not the fallback */
const FILES = ["lp-solver-1.0.3.js", "app-core.js", "app-squad.js", "app-render.js", "app-odds.js", "app-tracker.js", "app-main.js"];

let pass = 0, fail = 0;
const check = (ok, name, detail) => {
  if (ok) { pass++; console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + (detail ? " -- " + detail : "")); }
};
const f2 = x => x == null ? "null" : (+x).toFixed(2);

/* ---------- our own CSV reader and writer (not the app's parseCSV) ---------- */
function csvArrays(t) {
  const rows = []; let cur = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true; else if (c === ",") { cur.push(f); f = ""; }
    else if (c === "\n") { cur.push(f); rows.push(cur); cur = []; f = ""; } else if (c !== "\r") f += c;
  }
  if (f || cur.length) { cur.push(f); rows.push(cur); }
  return rows;
}
function csv(t) {
  const rows = csvArrays(t); if (!rows.length) return [];
  const h = rows.shift().map(s => s.trim());
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}
const cell = v => /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
/* rewrite rows of a CSV: edit(rowObject) returns {column: newValue} or null */
function csvEdit(text, edit) {
  const rows = csvArrays(text), head = rows[0].map(s => s.trim());
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].length <= 1) continue;
    const o = Object.fromEntries(head.map((k, j) => [k, rows[i][j]]));
    const ch = edit(o); if (!ch) continue;
    for (const [k, v] of Object.entries(ch)) { const j = head.indexOf(k); if (j >= 0) rows[i][j] = String(v); }
  }
  return rows.map(r => r.map(cell).join(",")).join("\n") + "\n";
}

/* ---------- server and fetch layer ---------- */
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
/* one cached GET per path, optionally edited (run B); the app and the
   rebuild read through the same function, so they see the same bytes */
/* a few hundred requests at once, while the other suites run, can drop a
   connection: try again rather than abort; and at most 24 in flight */
let inFlight = 0; const waiting = [];
async function fetchRetry(url) {
  while (inFlight >= 24) await new Promise(r => waiting.push(r));
  inFlight++;
  try {
    for (let i = 0; ; i++) {
      try { const r = await fetch(url); return { ok: r.ok, status: r.status, text: await r.text() }; }
      catch (e) { if (i >= 4) throw e; await new Promise(r => setTimeout(r, 250 * (i + 1))); }
    }
  } finally { inFlight--; const next = waiting.shift(); if (next) next(); }
}
function makeGet(tx) {
  const cache = new Map();
  return path => {
    if (!cache.has(path)) cache.set(path, (async () => {
      const r = await fetchRetry(BASE + path), text = r.text;
      return { ok: r.ok, status: r.status, text: r.ok && tx ? tx(path, text) : text };
    })());
    return cache.get(path);
  };
}
async function runApp(get) {
  const dom = new JSDOM(`<!DOCTYPE html><html><body><div class="wrap" id="app"></div></body></html>`,
    { url: "https://app.local/fpl/#/team-planner", runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window, ctx = dom.getInternalVMContext();
  w.fetch = async (url, opts) => {
    const s = String(url);
    if (!s.startsWith("/")) return { ok: false, status: 404, text: async () => "", json: async () => ({}), clone() { return this; } };
    let r;
    if (opts && opts.method && opts.method !== "GET" && opts.method !== "HEAD") { const x = await fetch(BASE + s, opts); r = { ok: x.ok, status: x.status, text: await x.text() }; }
    else r = await get(s);
    return { ok: r.ok, status: r.status, text: async () => r.text, json: async () => JSON.parse(r.text), clone() { return this; } };
  };
  w.AbortController = AbortController; w.setTimeout = setTimeout; w.clearTimeout = clearTimeout; w.scrollTo = () => {};
  w.setInterval = () => 0;
  w.console = { log() {}, warn() {}, error() {} };
  for (const f of FILES) vm.runInContext(readFileSync(join(ROOT, f), "utf8"), ctx, { filename: f });
  vm.runInContext(`window.__g={get S(){return S},render,act,hPts,teamScore,chipTeam,chipCurve,chipWeighted,effectiveSquadIds,
    optimalSquad,get optPending(){return _optPending},get solverOn(){return typeof solver!=="undefined"&&!!solver.Solve},
    squadBudget,startingXI,weekPtsFor,chipForWeek,VG,hitsOver,get CRELLIN(){return CRELLIN}}`, ctx);
  const g = w.__g, S = g.S;
  const until = Date.now() + 180000;
  while (Date.now() < until && !(S.model && !S.loading)) await new Promise(r => setTimeout(r, 250));
  if (!S.model) throw new Error("app never built a model: " + (S.err || "none"));
  /* let the odds request (400 ms after the build) settle */
  await new Promise(r => setTimeout(r, 1200));
  return { w, g, S, doc: w.document };
}

/* ---------- the independent rebuild ---------- */
const N = v => { const x = parseFloat(v); return Number.isNaN(x) ? 0 : x; };
const cl = (v, a, b) => Math.min(b, Math.max(a, v));
const POSN = { Goalkeeper: 1, Defender: 2, Midfielder: 3, Forward: 4, GKP: 1, DEF: 2, MID: 3, FWD: 4 };
const posOf = v => POSN[String(v || "").trim()] || 0;
const FOLDC = { "ß": "ss", "ø": "o", "æ": "ae", "œ": "oe", "ł": "l", "đ": "d", "ð": "d", "ı": "i", "þ": "th" };
const nm = s => String(s || "").toLowerCase().replace(/[ßøæœłđðıþ]/g, c => FOLDC[c]).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
const isPrem = id => /-prem-/.test(String(id || ""));
const LG = 1.42;                                     // league goals per side
const PROMO = { COV: { gf: 97 / 46, ga: 48 / 46 }, IPS: { gf: 80 / 46, ga: 47 / 46 }, HUL: { gf: 62 / 46, ga: 58 / 46 } };
const PEN_OV = { COV: "Torp", NEW: "Wissa", SUN: "Le Fée" };
const DCT = { 1: 99, 2: 10, 3: 12, 4: 12 };
const KEEPERS = ["Raya", "Donnarumma", "A.Becker", "Lammens", "Pope", "Sánchez", "Kelleher", "Leno", "Sels", "Martinez", "Verbruggen", "Pickford", "Kinsky", "Henderson", "Perri", "Roefs", "Petrović", "Butland", "Rushworth", "Scherpen"].map(nm);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CAL = { 1: [0.51, 0.77], 2: [1.92, 0.33], 3: [2.45, 0.39], 4: [1.18, 0.55] };
/* xFPL curve (23 Nov 2026), replacing the flat D5 levels: c[pos] x raw^k per match, last */
const CURVE_K = 0.625, CURVE_C = { 1: 1.85, 2: 1.78, 3: 1.67, 4: 1.98 };
const curve = (x, pos, n) => { if (!(x > 0)) return 0; const m = Math.max(1, n || 1); return m * CURVE_C[pos] * Math.pow(x / m, CURVE_K); };
const GOAL = { 1: 10, 2: 6, 3: 5, 4: 4 }, CSP = { 1: 4, 2: 4, 3: 1, 4: 0 };
const SHARE = [[45, .494], [60, .682], [75, .786], [90, .882]];
const appearP = m => m > 30 ? (SHARE.find(([h]) => m <= h) || SHARE[3])[1] : cl(m / 17, 0, .985);

async function loadRaw(get) {
  const C = async p => { const r = await get(p); return r.ok ? csv(r.text) : []; };
  const J = async p => { const r = await get(p); return r.ok ? JSON.parse(r.text) : null; };
  const D = s => `/data/insights/${s}`, gwf = (s, gw, f) => `${D(s)}/By%20Gameweek/GW${gw}/${f}`;
  const GWS = Array.from({ length: 38 }, (_, i) => i + 1);
  const all = (s, f) => Promise.all(GWS.map(gw => C(gwf(s, gw, f))));
  const [teams, events, plist, pstat, lteams, lp, lstat, preRows, live, status] = await Promise.all([
    C(`${D(SEASON)}/teams.csv`), C(`${D(SEASON)}/gameweek_summaries.csv`), C(`${D(SEASON)}/players.csv`), C(`${D(SEASON)}/playerstats.csv`),
    C(`${D(LAST)}/teams.csv`), C(`${D(LAST)}/players.csv`), C(`${D(LAST)}/playerstats.csv`),
    C(`${D(SEASON)}/By%20Tournament/Friendlies/GW0/playermatchstats.csv`), J("/api/fpl-players"), J("/api/status")]);
  const [fixNow, fixLast, mNow, mLast, pmNow, pmLast] = await Promise.all([
    all(SEASON, "fixtures.csv"), all(LAST, "fixtures.csv"), all(SEASON, "matches.csv"), all(LAST, "matches.csv"),
    all(SEASON, "playermatchstats.csv"), all(LAST, "playermatchstats.csv")]);
  return { teams, events, plist, pstat, lteams, lp, lstat, preRows, live: (live && live.players) || {},
    statusGw: Number(status && status.fpl && status.fpl.gw) || 0, fixNow, fixLast, mNow, mLast, pmNow, pmLast };
}

/* o.m3 / o.c13 false give the rule before that change (to show the check
   can tell them apart); o.odds is S.oddsTeams when the app has it */
function computeModel(R, o = {}) {
  const M3 = o.m3 !== false, C13 = o.c13 !== false, ODDS = o.odds || {};
  const teams = R.teams.map(t => ({ id: Math.round(N(t.id)), code: Math.round(N(t.code)), short: t.short_name, name: t.name }));
  const tByCode = new Map(teams.map(t => [t.code, t]));
  const events = R.events.map(e => ({ id: Math.round(N(e.id)), finished: String(e.finished).toLowerCase() === "true", deadline: e.deadline_time })).sort((a, b) => a.id - b.id);
  const gwPlayed = events.filter(e => e.finished).length;
  const NEXT = (R.statusGw && events.find(e => e.id === R.statusGw && !e.finished)) ? R.statusGw : (events.find(e => !e.finished) || { id: 1 }).id;
  const liveWeeks = new Set(events.filter(e => !e.finished && e.id < NEXT).map(e => e.id));

  /* clubs and fixtures; club output this season from every finished league match */
  const fx = [], seen = new Set(), curStat = {}, clubLive = new Set();
  for (let gw = 1; gw <= 38; gw++) for (const f of R.fixNow[gw - 1]) {
    if (f.match_id && !isPrem(f.match_id)) continue;
    if (!f.home_team || !f.away_team) continue;
    const e = Math.round(N(f.gameweek)), h = Math.round(N(f.home_team)), a = Math.round(N(f.away_team));
    const fin = String(f.finished).toLowerCase() === "true";
    if (fin && liveWeeks.has(e)) { clubLive.add(h); clubLive.add(a); }
    if (fin && f.home_score !== "" && f.away_score !== "") {
      for (const [c, home] of [[h, true], [a, false]]) {
        const s = curStat[c] = curStat[c] || { n: 0, gf: 0, ga: 0, xg: 0, xga: 0, npxg: 0 };
        s.n++; s.gf += N(home ? f.home_score : f.away_score); s.ga += N(home ? f.away_score : f.home_score);
        s.xg += N(home ? f.home_expected_goals_xg : f.away_expected_goals_xg);
        s.xga += N(home ? f.away_expected_goals_xg : f.home_expected_goals_xg);
        s.npxg += N(home ? f.home_non_penalty_xg : f.away_non_penalty_xg);
      }
    }
    const k = e + "|" + Math.min(h, a) + "|" + Math.max(h, a);
    if (seen.has(k)) continue; seen.add(k);
    fx.push({ e, h: tByCode.get(h), a: tByCode.get(a) });
  }

  /* last season by club short name */
  const lShort = Object.fromEntries(R.lteams.map(t => [Math.round(N(t.code)), t.short_name]));
  const lastRes = {}, lastXg = {};
  for (let gw = 1; gw <= 38; gw++) for (const f of R.fixLast[gw - 1]) {
    if (!isPrem(f.match_id) || f.home_score === "" || f.away_score === "" || f.home_score == null) continue;
    const H = lShort[Math.round(N(f.home_team))], A = lShort[Math.round(N(f.away_team))];
    if (H && A) for (const [t, gf, ga] of [[H, N(f.home_score), N(f.away_score)], [A, N(f.away_score), N(f.home_score)]]) {
      const r = lastRes[t] = lastRes[t] || { gf: 0, ga: 0, n: 0 }; r.gf += gf; r.ga += ga; r.n++;
    }
    for (const [me, home] of [[H, true], [A, false]]) {
      if (!me) continue;
      const s = lastXg[me] = lastXg[me] || { n: 0, xg: 0, xga: 0, npxg: 0, seq: [] };
      const xg = N(home ? f.home_expected_goals_xg : f.away_expected_goals_xg), xga = N(home ? f.away_expected_goals_xg : f.home_expected_goals_xg);
      s.n++; s.xg += xg; s.xga += xga; s.npxg += N(home ? f.home_non_penalty_xg : f.away_non_penalty_xg);
      s.seq.push({ gw: Math.round(N(f.gameweek)), xg, xga });
    }
  }

  /* club ratings: last season's xG and goals, recent form, promoted clubs'
     Championship output, then this season blended in */
  const wAtt = Math.min(0.65, gwPlayed / 12), wDef = Math.min(0.70, gwPlayed / 24);
  for (const t of teams) {
    const X = lastXg[t.short], Rr = lastRes[t.short];
    let gf, ga;
    if (X && X.n >= 10) {
      const xgf = 0.75 * X.npxg / X.n + 0.25 * X.xg / X.n, xga = X.xga / X.n;
      const rgf = Rr && Rr.n >= 10 ? Rr.gf / Rr.n : xgf, rga = Rr && Rr.n >= 10 ? Rr.ga / Rr.n : xga;
      let sf = 0.62 * xgf + 0.38 * rgf, sa = 0.62 * xga + 0.38 * rga;
      const last8 = X.seq.slice().sort((a, b) => a.gw - b.gw).slice(-8);
      if (last8.length >= 6) {
        sf = 0.6 * sf + 0.4 * last8.reduce((s, x) => s + x.xg, 0) / last8.length;
        sa = 0.6 * sa + 0.4 * last8.reduce((s, x) => s + x.xga, 0) / last8.length;
      }
      gf = sf; ga = sa;
    } else if (Rr && Rr.n >= 10) { gf = Rr.gf / Rr.n; ga = Rr.ga / Rr.n; }
    else if (PROMO[t.short]) {
      const pm = PROMO[t.short];
      gf = 0.8 * (pm.gf * 0.62) + 0.2 * LG;
      ga = 0.8 * (LG * 1.18 + (pm.ga - 1.15) * 0.55) + 0.2 * LG;
    } else { gf = LG; ga = LG; t.flag = "no prior"; }
    const Cs = curStat[t.code];
    if (Cs && Cs.n >= 2) {
      const cgf = 0.62 * (0.75 * Cs.npxg / Cs.n + 0.25 * Cs.xg / Cs.n) + 0.38 * Cs.gf / Cs.n;
      const cga = 0.62 * (Cs.xga / Cs.n) + 0.38 * Cs.ga / Cs.n;
      const sc = cl(Cs.n / Math.max(1, gwPlayed), 0, 1);
      gf = gf * (1 - wAtt * sc) + cgf * wAtt * sc;
      ga = ga * (1 - wDef * sc) + cga * wDef * sc;
    }
    t.attRaw = cl(gf, 0.55, 2.55); t.defRaw = cl(ga, 0.55, 2.55);
  }
  {
    const mA = teams.reduce((s, t) => s + t.attRaw, 0) / teams.length, mD = teams.reduce((s, t) => s + t.defRaw, 0) / teams.length;
    for (const t of teams) {
      t.att = t.attRaw * LG / mA; t.def = t.defRaw * LG / mD;
      const rel = cl((t.att - t.def) / 1.2, -1, 1);
      t.ha = (0.11 + 0.05 * (1 - Math.abs(rel))) / 2;
      t.attH = t.att * (1 + t.ha); t.attA = t.att * (1 - t.ha); t.defH = t.def * (1 - t.ha); t.defA = t.def * (1 + t.ha);
    }
  }
  const xgFor = (t, op, home) => (home ? t.attH : t.attA) * (home ? op.defA : op.defH) / LG;
  const xgAg = (t, op, home) => (home ? op.attA : op.attH) * (home ? t.defH : t.defA) / LG;

  /* players, with FPL's live feed over the dataset's row */
  const pstat = R.pstat.slice().sort((a, b) => N(a.gw) - N(b.gw));
  const latest = {}; for (const s of pstat) latest[s.id] = s;
  const liveOn = Object.keys(R.live).length > 0;
  const lastCode = Object.fromEntries(R.lp.map(r => [String(Math.round(N(r.player_id))), String(r.player_code)]));
  const lastStats = {};
  for (const s of R.lstat.slice().sort((a, b) => N(a.gw) - N(b.gw))) { const c = lastCode[String(Math.round(N(s.id)))]; if (c) lastStats[c] = s; }
  const codeOf = {}; R.lp.forEach(r => codeOf["last|" + Math.round(N(r.player_id))] = String(r.player_code));
  R.plist.forEach(r => codeOf["now|" + Math.round(N(r.player_id))] = String(r.player_code));
  /* injury history (INJ, 23 Nov 2026): share of his rows flagged i/d above 12%, both seasons, 'u' rows out */
  const injN = {}; const injAdd = (c, st) => { if (!c || !st || st === "u") return; const h = injN[c] = injN[c] || [0, 0]; h[0]++; if (st === "i" || st === "d") h[1]++; };
  R.lstat.forEach(s => injAdd(lastCode[String(Math.round(N(s.id)))], s.status));
  R.pstat.forEach(s => injAdd(codeOf["now|" + Math.round(N(s.id))], s.status));
  const injX = c => { const h = injN[c]; return h && h[0] >= 5 ? Math.max(0, h[1] / h[0] - 0.12) : 0; };
  const hist = {};
  for (const [tag, M, P] of [["last", R.mLast, R.pmLast], ["now", R.mNow, R.pmNow]]) for (let gw = 1; gw <= 38; gw++) {
    const prem = new Set(M[gw - 1].filter(m => isPrem(m.match_id)).map(m => String(m.match_id)));
    for (const r of P[gw - 1]) {
      if (!prem.has(String(r.match_id))) continue;
      const c = codeOf[tag + "|" + Math.round(N(r.player_id))]; if (!c) continue;
      (hist[c] = hist[c] || []).push({ tag, gw, mins: N(r.minutes_played), start: r.start_min === "" ? null : N(r.start_min), gp: N(r.goals_prevented) });
    }
  }
  for (const k in hist) hist[k].sort((x, y) => x.tag === y.tag ? x.gw - y.gw : (x.tag === "last" ? -1 : 1));
  const pre = {};
  for (const r of R.preRows) {
    const id = Math.round(N(r.player_id)); if (!id) continue;
    const q = pre[id] = pre[id] || { mins: 0, apps: 0 }; q.mins += N(r.minutes_played); q.apps++;
  }
  const preMax = Math.max(1, ...Object.values(pre).map(v => v.apps));

  const players = [];
  for (const r of R.plist) {
    const id = Math.round(N(r.player_id)), s0 = latest[r.player_id]; if (!s0) continue;
    const s = { ...s0 }, L = R.live[id];
    if (L && L.st != null) {
      s.status = L.st; s.chance_of_playing_next_round = L.cn == null ? "" : L.cn;
      s.now_cost = L.cost != null ? L.cost / 10 : ""; s.news = L.news == null ? "" : L.news;
    }
    const t = tByCode.get(Math.round(N(r.team_code))) || null;
    players.push({ id, code: String(r.player_code), name: r.web_name, pos: posOf(r.position) || 3, team: t, s, L,
      price: N(s.now_cost), mins: N(s.minutes) });
  }
  const clubMaxPrice = {}; players.forEach(p => { if (p.price && p.team) clubMaxPrice[p.team.code] = Math.max(clubMaxPrice[p.team.code] || 0, p.price); });
  function pDefcon(mean, pos) {
    const k = DCT[pos]; if (!(mean > 0) || k > 50) return 0;
    let below = 0;
    if (pos === 2) { const r = 8, q = r / (r + mean); let t = Math.pow(q, r); for (let i = 0; i < k; i++) { below += t; t *= (i + r) / (i + 1) * (1 - q); } }
    else { let t = Math.exp(-mean); for (let i = 0; i < k; i++) { below += t; t *= mean / (i + 1); } }
    return cl(1 - below, 0, 0.95);
  }
  for (const p of players) {
    const s = p.s, Ls = lastStats[p.code];
    const lastMins = Ls ? N(Ls.minutes) : 0;
    const st = s.status || "a"; let av = 1;
    if (["u", "n", "s"].includes(st)) av = 0;
    else if (st === "i" || st === "d") { const c = s.chance_of_playing_next_round; av = (c === "" || c == null) ? 0.5 : N(c) / 100; }
    p.status = st; p.avail = av;
    const m = /(?:expected back|suspended until)\s+(\d{1,2})\s+([A-Za-z]{3})/i.exec(s.news || "");
    p.back = m ? m[1].padStart(2, "0") + "-" + m[2][0].toUpperCase() + m[2].slice(1, 3).toLowerCase() : (/unknown return/i.test(s.news || "") ? "unknown" : "");

    /* expected minutes */
    const H = hist[p.code] || [], liveR = H.filter(x => x.tag === "now"), lastR = H.filter(x => x.tag === "last");
    const rows = liveR.length >= 3 ? liveR : lastR;
    const clubMax = clubMaxPrice[p.team && p.team.code] || p.price || 10;
    const rel = cl(p.price / Math.max(4, clubMax), 0.25, 1);
    const played = rows.filter(x => x.mins > 0), nApps = played.length;
    /* the appearance method: start rate, minutes when he starts (floored),
       minutes off the bench; per-position exponent and scale */
    const appearances = floorDM => {
      const rec = played.slice(-12);
      const sr = rec.filter(x => x.start === 0).length / rec.length;
      const sm = rec.filter(x => x.start === 0).map(x => x.mins);
      const whenS = sm.length ? cl(sm.reduce((a, b) => a + b, 0) / sm.length, 55, 90) : 78;
      const bm = rec.filter(x => x.start !== 0).map(x => x.mins);
      const off = bm.length ? bm.reduce((a, b) => a + b, 0) / bm.length : 16;
      const P = { 1: [0.6, 55, 1.15], 2: [0.6, floorDM, 1.05], 3: [0.6, floorDM, 1.05], 4: [1.25, 55, 1.05] }[p.pos];
      const srp = Math.pow(cl(sr, 0, 1), P[0]);
      p.whenS = whenS;
      return cl((srp * Math.max(P[1], whenS) + (1 - srp) * off) * P[2], 0, 90);
    };
    const minApps = M3 ? 3 : 10;
    const appMins = nApps >= minApps ? appearances(M3 ? 55 : 80) : null;
    let xm;
    p.nApps = nApps;
    if (nApps >= 10) { xm = appMins; p.path = "appearances"; }
    else {
      const pr = pre[p.id], pm = pr ? pr.mins : 0, pa = pr ? pr.apps : 0;
      if (!PROMO[p.team && p.team.short] && pm >= 180 && pa >= 3) {
        const tr = cl((pm - 180) / 240, 0, 1) * 0.45 + 0.45;
        xm = cl(cl(pm / pa, 0, 90) * tr + rel * 66 * (1 - tr), 8, 88);
      } else xm = cl(rel * 66 + (pa >= 2 ? cl(pm / pa, 0, 90) : 0) * 0.22, 6, 86);
      p.path = "no history";
      if (appMins != null) { const w = cl((nApps - 2) / 8, 0, 1); xm = xm * (1 - w) + appMins * w; p.path = "blend"; }
      const gwP = gwPlayed + (C13 && p.team && clubLive.has(p.team.code) ? 1 : 0);
      p.gwP = gwP;
      if (gwP >= 1) { const w = cl(gwP / 4, 0, 1); xm = xm * (1 - w) + cl(p.mins / gwP, 0, 90) * w; }
    }
    p.role = xm;

    /* per-90 rates: this season shrunk by minutes/(minutes+450) toward a
       prior that is last season shrunk by lastMins/(lastMins+420) */
    const rate = (cur, prev, fb, lim) => {
      const c = N(cur), relL = cl(lastMins / (lastMins + 420), 0, 0.95), y = Ls ? N(prev) : 0;
      const prior = y > 0 ? y * relL + fb * (1 - relL) : fb;
      const v = c > 0 ? c * (p.mins / (p.mins + 450)) + prior * (1 - p.mins / (p.mins + 450)) : prior;
      return lim ? cl(v, 0, lim) : v;
    };
    /* keepers' prior is 0 as written; the app reads it as 0.15 (audit F10),
       which only moves keepers' xG, and keepers' points do not use it */
    const pp = { 1: 0, 2: .06, 3: .16, 4: .34 }[p.pos];
    p.xg90 = rate(s.expected_goals_per_90, Ls && Ls.expected_goals_per_90, pp * p.price / 8, { 1: .05, 2: .35, 3: .9, 4: 1.3 }[p.pos]);
    p.xa90 = rate(s.expected_assists_per_90, Ls && Ls.expected_assists_per_90, pp * .55 * p.price / 8, { 1: .05, 2: .35, 3: .7, 4: .6 }[p.pos]);
    p.dc90 = rate(s.defensive_contribution_per_90, Ls && Ls.defensive_contribution_per_90, { 1: 0, 2: 7.5, 3: 5.5, 4: 2.5 }[p.pos], 22);
    p.gc90 = cl(rate(s.expected_goals_conceded_per_90, Ls && Ls.expected_goals_conceded_per_90, 1.35), .3, 3.5);
    p.sv90 = p.pos === 1 ? cl(rate(s.saves_per_90, Ls && Ls.saves_per_90, 2.6), 0, 7) : 0;
    const allPlayed = H.filter(x => x.mins > 0).length;
    p.dcChance = p.pos > 1 && H.length && allPlayed >= 8 ? pDefcon(p.dc90, p.pos) : null;
    p.gpRate = 0;
    if (p.pos === 1 && H.length) {
      const nowR = H.filter(x => x.tag === "now"), nA = nowR.filter(x => x.mins > 0).length;
      const lw = 1 - 0.65 * cl(nA / 12, 0, 1);
      const w = x => x.tag === "now" ? 2 * Math.pow(0.5, (nowR.length - 1 - nowR.indexOf(x)) / 6) : lw;
      const totMins = H.reduce((a, x) => a + x.mins, 0), wm = H.reduce((a, x) => a + w(x) * x.mins, 0);
      if (totMins > 600 && wm > 0) p.gpRate = cl(H.reduce((a, x) => a + w(x) * x.gp, 0) * 90 / wm * 0.35, -0.3, 0.3);
    }
    p.bonus90 = p.mins > 180 ? N(s.bonus) * 90 / p.mins : (Ls && N(Ls.minutes) > 500 ? N(Ls.bonus) * 90 / N(Ls.minutes) : .15);
    /* set pieces from FPL's live orders */
    const club = p.team ? p.team.short : "", L = p.L, me = nm(p.name);
    const named = k => {
      if (k === "P" && PEN_OV[club]) { const t = nm(PEN_OV[club]); return me === t || me.includes(t) || t.includes(me); }
      if (!L) return false;
      if (k === "P") return L.pen === 1;
      const ord = k === "F" ? L.dfk : L.cor; return ord === 1 || ord === 2;
    };
    p.pen = named("P") ? 0.45 : (!PEN_OV[club] && L && L.pen === 2 ? 0.08 : 0);
    p.setp = named("F") || named("C") ? 0.30 : 0;
    p.lastMins = lastMins; p.pre = pre[p.id];
  }
  /* return week */
  const evDl = events.filter(e => e.deadline);
  for (const p of players) {
    if (p.avail > 0) p.outUntil = 0;
    else if (p.status === "u" || p.status === "n") p.outUntil = 39;
    else if (p.back && p.back !== "unknown") {
      const m = /^(\d{2})-([A-Za-z]{3})$/.exec(p.back); let v = NEXT + 8;
      if (m) { const mi = MON.indexOf(m[2]); if (mi >= 0) { const now = new Date(); let yr = now.getFullYear(); if (mi < now.getMonth() - 3) yr++;
        const d = new Date(yr, mi, +m[1]); const f = evDl.find(x => new Date(x.deadline) >= d); v = f ? f.id : NEXT + 4; } }
      p.outUntil = v;
    } else p.outUntil = NEXT + 4;
    p.cover = 0; p.coverUntil = 0;
  }
  /* one keeper per club plays; an absent first choice hands the shirt on */
  const byClub = {};
  players.forEach(p => { if (p.team) (byClub[p.team.code + "|" + p.pos] = byClub[p.team.code + "|" + p.pos] || []).push(p); });
  for (const [k, list] of Object.entries(byClub)) {
    if (!k.endsWith("|1")) continue;
    const score = p => p.lastMins * 3 + p.price * 400 + (p.pre && p.pre.apps && p.pre.mins >= 100 ? (p.pre.mins / p.pre.apps) * (0.35 + 0.45 * cl(p.pre.apps / preMax, 0, 1)) : 0) * 4;
    list.sort((a, b) => ((a.outUntil > 38) - (b.outUntil > 38)) || (gwPlayed >= 2 ? b.mins - a.mins : 0) || (KEEPERS.includes(nm(b.name)) - KEEPERS.includes(nm(a.name))) || score(b) - score(a));
    list.forEach((p, i) => { p.role = i === 0 ? 89 : 0; });
    const f = list[0];
    if (f.outUntil) { const d = list.slice(1).find(p => p.avail > 0); if (d) { d.cover = 89; d.coverUntil = f.outUntil; } }
  }
  /* cover for absent outfield team-mates, capped by the minutes freed and the shirts */
  const SLOTS = { 2: 4.3, 3: 4.3, 4: 2.0 };
  for (const [k, list] of Object.entries(byClub)) {
    const pos = +k.split("|")[1]; if (pos === 1) continue;
    const out = list.filter(p => p.avail <= 0), fit = list.filter(p => p.avail > 0);
    if (!out.length || !fit.length) continue;
    const lift = cl(1 + out.reduce((a, p) => a + cl(p.price / 8, .25, 1.2), 0) * 0.12, 1, 1.3);
    const want = fit.map(p => p.role >= 84 ? 0 : Math.max(0, Math.min(p.role * lift, 89) - p.role));
    const E = want.reduce((a, b) => a + b, 0); if (!(E > 0)) continue;
    const freed = out.reduce((a, p) => a + p.role, 0), room = Math.max(0, SLOTS[pos] * 90 - fit.reduce((a, p) => a + p.role, 0));
    const kk = Math.min(E, freed, room) / E, until = Math.max(...out.map(p => p.outUntil));
    fit.forEach((p, i) => { const mm = want[i] * kk; if (mm >= 0.5) { p.cover = mm; p.coverUntil = until; } });
  }

  /* points per gameweek */
  const fxOf = (t, e) => fx.filter(f => f.e === e && (f.h === t || f.a === t)).map(f => ({ home: f.h === t, opp: f.h === t ? f.a : f.h }));
  for (const p of players) {
    const t = p.team; p.gw = {};
    const minsAt = e => cl(p.role + (e < p.coverUntil ? p.cover : 0), 0, 90);
    const availAt = e => p.outUntil ? (e < p.outUntil ? 0 : e < p.outUntil + 2 ? 0.55 + 0.25 * (e - p.outUntil) : 1) : (e === NEXT ? cl(p.avail, 0, 1) : 1);
    for (let e = NEXT; e <= 38; e++) {
      const F = t ? fxOf(t, e) : [];
      if (!F.length) { p.gw[e] = { pts: 0, blank: true, n: 0 }; continue; }
      const m = minsAt(e), av = availAt(e);
      const pPlay = cl(m / 17, 0, .985), p60 = cl((m - 22) / 62, 0, .985), share = cl(m / 90, 0, 1);
      let raw = 0;
      for (const f of F) {
        const op = f.opp;
        let xf = xgFor(t, op, f.home), xc = xgAg(t, op, f.home);
        const od = ODDS[t.short + "|" + op.short + (f.home ? "|H" : "|A")];
        if (od) { xf = od.xg; xc = od.xgc; }
        const atk = cl(Math.pow(xf / LG, 1.9), .30, 2.40), def = cl(Math.pow(LG / Math.max(.35, xc), 1.9), .35, 2.30);
        const teamGA = (t.defH + t.defA) / 2;
        const myGC = cl(xc * cl(p.gc90 / teamGA, 0.75, 1.33), .25, 3.2);
        const appear = 2 * p60 + (pPlay - p60);
        const attack = p.pos === 1 ? p.sv90 * (myGC / 1.35) / 3 * share * 0.55 : p.xg90 * share * atk * GOAL[p.pos] + p.xa90 * share * atk * 3;
        let cs = Math.exp(-myGC); if (p.pos === 1 && p.gpRate) cs = cl(cs * (1 + cl(p.gpRate, -.25, .25)), .02, .75);
        const csPts = CSP[p.pos] * cs * p60;
        const conc = p.pos <= 2 ? -(myGC / 2 - (1 - Math.exp(-2 * myGC)) / 4) * p60 : 0;
        const dc = p.dcChance != null ? 2 * p.dcChance * p60 * cl(1 / Math.max(.6, def), .75, 1) : Math.min(2, 2 * Math.pow(cl(p.dc90 / DCT[p.pos], 0, 1.15), 2.6)) * p60 * 0.55;
        const bon = p.bonus90 * share * cl(atk, .8, 1.2);
        const ext = (p.pen * cl(t.att / LG, .55, 1.45) * atk + p.setp) * share;
        raw += (appear + attack + csPts + conc + dc + bon + ext) * av;
      }
      const [cA, cB] = CAL[p.pos];
      const tot = cA * cl(m / 88, 0, 1.02) * av * F.length + cB * raw;
      const af = m > 30 ? appearP(m) / .985 : 1;
      p.gw[e] = { pts: Math.max(0, tot * af), n: F.length, pPlay: cl(av, 0, 1) * appearP(m) * Math.min(1, F.length) };
    }
    /* stretch single weeks around his own mean: 1.45, attackers 2.2; doubles keep their sum */
    const singles = Object.keys(p.gw).filter(e => p.gw[e].n === 1);
    Object.values(p.gw).forEach(q => { if (q.n > 1) q.pre = q.pts; });
    if (singles.length > 1) {
      const mean = singles.reduce((a, e) => a + p.gw[e].pts, 0) / singles.length;
      if (mean > 0.3) singles.forEach(e => { const q = p.gw[e]; q.pre = q.pts; q.pts = Math.max(0, mean + (q.pts - mean) * (p.pos >= 3 ? 2.2 : 1.45)); });
    }
    p.xMins = Math.round(minsAt(NEXT) * availAt(NEXT));
  }
  /* each week's league total back to its level before the stretch */
  for (let e = NEXT; e <= 38; e++) {
    let a = 0, b = 0, n = 0;
    players.forEach(p => { const q = p.gw[e]; if (q && !q.blank && q.pre != null) { a += q.pre; b += q.pts; n++; } });
    if (n > 20 && b > 0) players.forEach(p => { const q = p.gw[e]; if (q && !q.blank) q.pts = Math.max(0, q.pts * a / b); });
  }
  players.forEach(p => { for (let e = NEXT; e <= 38; e++) { const q = p.gw[e]; if (q && !q.blank) q.pts = curve(q.pts, p.pos, q.n) * Math.exp(-(0.6 + (e > NEXT ? 2.5 : 0)) * Math.min(0.12, injX(p.code))); } });
  return { next: NEXT, gwPlayed, liveOn, clubLive, teams, players, byId: new Map(players.map(p => [p.id, p])) };
}

/* ---------- our own team score (D17, M4), from our own points ---------- */
const ptsOf = (p, e) => (p && p.gw[e] && p.gw[e].pts) || 0;
/* the best legal XI: one keeper, three defenders and one forward, then the
   six best outfielders left (best possible from a 2/5/5/3 squad) */
function greedyXI(sp, v) {
  const by = { 1: [], 2: [], 3: [], 4: [] }; sp.forEach(p => by[p.pos].push(p));
  Object.values(by).forEach(a => a.sort((x, y) => v(y) - v(x)));
  const xi = []; if (by[1][0]) xi.push(by[1][0]);
  by[2].slice(0, 3).forEach(p => xi.push(p)); by[4].slice(0, 1).forEach(p => xi.push(p));
  [...by[2].slice(3), ...by[3], ...by[4].slice(1)].sort((a, b) => v(b) - v(a)).slice(0, 11 - xi.length).forEach(p => xi.push(p));
  return xi;
}
/* every formation tried, for the claim that the greedy XI is the best */
function bestXIsum(sp, v) {
  const by = { 1: [], 2: [], 3: [], 4: [] }; sp.forEach(p => by[p.pos].push(p));
  Object.values(by).forEach(a => a.sort((x, y) => v(y) - v(x)));
  let best = -1;
  for (let d = 3; d <= 5; d++) for (let m = 2; m <= 5; m++) for (let f = 1; f <= 3; f++) {
    if (d + m + f !== 10 || !by[1].length || by[2].length < d || by[3].length < m || by[4].length < f) continue;
    const s = [by[1][0], ...by[2].slice(0, d), ...by[3].slice(0, m), ...by[4].slice(0, f)].reduce((a, p) => a + v(p), 0);
    if (s > best) best = s;
  }
  return best;
}
const ppOf = (p, e) => { const q = p && p.gw[e]; return q && !q.blank && q.pPlay != null ? q.pPlay : 1; };
/* v: the same points the XI is scored on (a forecast factor applies to the
   cover too, audit follow-up 22 Nov 2026) */
function cover(xi, bench, cap, vice, e, mult, v) {
  const pt = v || (p => ptsOf(p, e));
  let s = 0;
  if (cap && vice && vice !== cap && xi.includes(vice)) s += (1 - ppOf(cap, e)) * pt(vice) * (mult - 1);
  const gs = xi.find(p => p.pos === 1), gb = bench.find(p => p.pos === 1);
  if (gs && gb) s += (1 - ppOf(gs, e)) * pt(gb);
  let dist = [1];
  xi.filter(p => p.pos !== 1).forEach(p => { const q = 1 - ppOf(p, e), nd = new Array(dist.length + 1).fill(0); dist.forEach((x, k) => { nd[k] += x * (1 - q); nd[k + 1] += x * q; }); dist = nd; });
  bench.filter(p => p.pos !== 1).forEach((p, i) => { s += dist.slice(i + 1).reduce((a, x) => a + x, 0) * pt(p); });
  return s;
}
/* bench order: keeper first, then the saved order (unknown last), else by
   points in the week on view */
function orderB(bench, order, gView) {
  const gk = bench.filter(p => p.pos === 1), out = bench.filter(p => p.pos !== 1);
  if (order && order.length) { const ix = new Map(order.map((id, i) => [id, i])); return [...gk, ...out.slice().sort((a, b) => (ix.has(a.id) ? ix.get(a.id) : 99) - (ix.has(b.id) ? ix.get(b.id) : 99))]; }
  return [...gk, ...out.slice().sort((a, b) => ptsOf(b, gView) - ptsOf(a, gView))];
}
function myTeam(MM, ids, e, o) {
  const sp = ids.map(i => MM.byId.get(i)).filter(Boolean), v = p => ptsOf(p, e) * (o.adj ? (o.adj.get(p.id) ?? 1) : 1);
  const xi = greedyXI(sp, v);
  const cap = xi.reduce((m, p) => (!m || v(p) > v(m)) ? p : m, null);
  const vice = xi.filter(p => p !== cap).reduce((m, p) => (!m || v(p) > v(m)) ? p : m, null);
  const bench = orderB(sp.filter(p => !xi.includes(p)), o.order, o.gView);
  return { sp, xi, cap, vice, bench, xiPts: xi.reduce((a, p) => a + v(p), 0) };
}
function myScore(MM, ids, e, chip, o) {
  const T = myTeam(MM, ids, e, o), v = p => ptsOf(p, e) * (o.adj ? (o.adj.get(p.id) ?? 1) : 1);
  let s = T.xiPts + (T.cap ? v(T.cap) : 0);
  if (chip === "bboost") s += T.bench.reduce((a, p) => a + v(p), 0) + cover(T.xi, [], T.cap, T.vice, e, 2, v);
  else if (chip === "3xc") s += (T.cap ? v(T.cap) : 0) + cover(T.xi, T.bench, T.cap, T.vice, e, 3, v);
  else s += cover(T.xi, T.bench, T.cap, T.vice, e, 2, v);
  return s;
}

/* ---------- comparisons ---------- */
function compareModel(tag, S, MM, opts) {
  const A = new Map(S.model.players.map(p => [p.id, p])), G = MM.next;
  check(S.model.next.id === G, `${tag}: the projected week is GW${G} (${MM.gwPlayed} played), worked out from the calendar and the server's gameweek`, `app GW${S.model.next.id}`);
  check(MM.liveOn, `${tag}: FPL's live player feed loaded (prices, flags and set-piece orders come from it)`);
  const ids = [...MM.byId.keys()].filter(id => A.has(id));
  check(ids.length === A.size && ids.length === MM.players.length && ids.length > 500, `${tag}: same players on both sides (${ids.length})`, `app ${A.size}, rebuild ${MM.players.length}`);

  /* expected minutes, before and after the flag */
  const badRole = ids.filter(id => Math.abs(A.get(id).roleMins - MM.byId.get(id).role) > 1e-6);
  check(!badRole.length, `${tag}: expected minutes match for all ${ids.length} players (M3, D15${opts.c13 ? ", C13" : ""})`,
    badRole.slice(0, 5).map(id => `${MM.byId.get(id).name} app ${f2(A.get(id).roleMins)} mine ${f2(MM.byId.get(id).role)} (${MM.byId.get(id).path}, ${MM.byId.get(id).nApps} apps)`).join("; "));
  const badX = ids.filter(id => A.get(id).xMins !== MM.byId.get(id).xMins);
  check(!badX.length, `${tag}: the xMins every page shows matches for all players`, badX.slice(0, 5).map(id => `${MM.byId.get(id).name} ${A.get(id).xMins}/${MM.byId.get(id).xMins}`).join(", "));

  /* points per player per week, next five weeks */
  const W = [0, 1, 2, 3, 4].map(k => G + k).filter(e => e <= 38);
  let n = 0, max = 0; const off = [];
  for (const id of ids) for (const e of W) {
    const a = (A.get(id).gw[e] || {}).pts || 0, m = ptsOf(MM.byId.get(id), e), d = Math.abs(a - m); n++;
    if (d > max) max = d;
    if (d > 0.01) off.push(`${MM.byId.get(id).name} GW${e} app ${f2(a)} mine ${f2(m)}`);
  }
  const byPos = [1, 2, 3, 4].map(k => ids.filter(id => MM.byId.get(id).pos === k).length);
  check(!off.length && n >= 40 * W.length, `${tag}: xP per player per GW within 0.01 for ${ids.length} players (GKP/DEF/MID/FWD ${byPos.join("/")}) over GW${W[0]}-${W[W.length - 1]}, ${n} player-weeks, largest gap ${max.toExponential(1)}`,
    `${off.length} off: ` + off.slice(0, 6).join("; "));
  /* the chance he plays at all, which the bench and vice cover use */
  const offP = []; for (const id of ids) for (const e of W) { const q = A.get(id).gw[e], m = MM.byId.get(id).gw[e];
    if (q && !q.blank && Math.abs((q.pPlay ?? -1) - m.pPlay) > 1e-9) offP.push(`${MM.byId.get(id).name} GW${e}`); }
  check(!offP.length, `${tag}: chance of playing per GW matches (flag, minutes band, blank)`, offP.slice(0, 5).join(", "));

  /* horizons: 1, 3, 5 and the rest of the season are sums of the weeks */
  for (const [lab, h] of [["1", 1], ["3", 3], ["5", 5], ["ROS", 39 - G]]) {
    const bad = ids.filter(id => { let s = 0; for (let e = G; e < G + h && e <= 38; e++) s += ptsOf(MM.byId.get(id), e);
      return Math.abs(opts.hPts(A.get(id), G, h) - s) > (h > 5 ? 0.03 : 0.01); });
    check(!bad.length, `${tag}: the ${lab} GW horizon is the sum of our per-GW xP for every player`, bad.slice(0, 4).map(id => MM.byId.get(id).name).join(", "));
  }
  return { ids, A, W };
}

const server = startServer();
try {
  await waitForServer();

  /* ================= run A: the frozen state as it is ================= */
  const getA = makeGet(null);
  const A = await runApp(getA);
  const { g, S, doc } = A;
  const rawA = await loadRaw(getA);
  const MA = computeModel(rawA, { odds: S.oddsTeams || null });
  const NEXT = MA.next;
  const { ids: idsA } = compareModel("A", S, MA, { hPts: g.hPts, c13: false });

  /* M3 must be what the app does, and the check must be able to tell */
  {
    const old = computeModel(rawA, { odds: S.oddsTeams || null, m3: false });
    const blend = MA.players.filter(p => p.path === "blend" && p.pos > 1);
    const floor = MA.players.filter(p => p.path === "appearances" && (p.pos === 2 || p.pos === 3) && p.whenS < 80);
    const moved = MA.players.filter(p => Math.abs(p.role - old.byId.get(p.id).role) > 0.5);
    check(blend.length > 0 && floor.length > 0 && moved.length > 0,
      `M3 is exercised: ${blend.length} outfielders blend 3-9 appearances, ${floor.length} defenders and midfielders start for under 80 minutes, ${moved.length} players move over 0.5 minutes against the old rule`);
    const appOld = moved.filter(p => Math.abs(S.model.players.find(x => x.id === p.id).roleMins - old.byId.get(p.id).role) < 1e-6);
    check(!appOld.length, "M3: no player is still on the old rule (80-minute floor, switch at 10)", appOld.slice(0, 5).map(p => p.name).join(", "));
  }

  /* ---------- chips and captain, on his squad, from our own points ---------- */
  S.startGW = NEXT; S.forceXI = null;
  const order = (S.benchOrder || []).slice();
  const half = e => e >= 20 ? "2" : "1";
  {
    const off = { none: [], bb: [], tc: [], bbDef: [], tcDef: [], greedy: [] };
    for (let e = NEXT; e < NEXT + 5 && e <= 38; e++) {
      const ids = g.effectiveSquadIds(e).ids, o = { order, gView: NEXT };
      const mine = { none: myScore(MA, ids, e, null, o), bb: myScore(MA, ids, e, "bboost", o), tc: myScore(MA, ids, e, "3xc", o) };
      for (const k of ["none", "bb", "tc"]) { const a = g.teamScore(ids, e, k === "none" ? null : k === "bb" ? "bboost" : "3xc");
        if (Math.abs(a - mine[k]) > 0.01) off[k].push(`GW${e} app ${f2(a)} mine ${f2(mine[k])}`); }
      const T = myTeam(MA, ids, e, o), v = p => ptsOf(p, e);
      if (Math.abs(T.xiPts - bestXIsum(T.sp, v)) > 1e-9) off.greedy.push("GW" + e);
      /* M4: a Bench Boost week = XI + captain + the bench's xP + the vice-captain's cover */
      const benchXP = T.bench.reduce((a, p) => a + v(p), 0), viceCover = cover(T.xi, [], T.cap, T.vice, e, 2);
      const bbApp = g.teamScore(ids, e, "bboost") - T.xiPts - v(T.cap);
      if (Math.abs(bbApp - (benchXP + viceCover)) > 0.01) off.bbDef.push(`GW${e} app ${f2(bbApp)} = bench ${f2(benchXP)} + vice cover ${f2(viceCover)}?`);
      /* Triple Captain: the gain is the captain's xP once more, plus the vice's
         extra cover at x3 when the captain might not play */
      const tcGain = g.teamScore(ids, e, "3xc") - g.teamScore(ids, e, null), extra = (1 - ppOf(T.cap, e)) * (T.vice && T.xi.includes(T.vice) ? v(T.vice) : 0);
      if (Math.abs(tcGain - extra - v(T.cap)) > 0.01) off.tcDef.push(`GW${e} gain ${f2(tcGain)} - vice ${f2(extra)} vs captain ${f2(v(T.cap))}`);
    }
    check(!off.greedy.length, "XI: the one-keeper, three-defender, one-forward rule gives the best formation every week", off.greedy.join(", "));
    check(!off.none.length, `Team score without a chip matches ours, GW${NEXT}-${NEXT + 4} (best XI, top scorer captain, vice and bench cover)`, off.none.join("; "));
    check(!off.bb.length && !off.bbDef.length, "Bench Boost: the team score is XI + captain + bench xP + the vice-captain's cover (M4)", [...off.bb, ...off.bbDef].join("; "));
    check(!off.tc.length && !off.tcDef.length, "Triple Captain: the gain is the captain's xP (plus the vice's extra cover at x3)", [...off.tc, ...off.tcDef].join("; "));
    /* a forecast blank for a bench player's club: his cover counts nothing
       (audit follow-up, 22 Nov 2026 - the cover used his full points) */
    {
      const e = NEXT, ids = g.effectiveSquadIds(e).ids, o = { order, gView: NEXT }, T = myTeam(MA, ids, e, o);
      const b = T.bench.find(p => p.pos !== 1 && ptsOf(p, e) > 0), club = b && b.team && b.team.code;
      const adj = new Map(T.sp.filter(p => p.team && p.team.code === club).map(p => [p.id, 0]));
      const app = b ? g.teamScore(ids, e, null, adj) : NaN, mine = b ? myScore(MA, ids, e, null, { ...o, adj }) : NaN;
      const Ta = b ? myTeam(MA, ids, e, { ...o, adj }) : null, va = p => ptsOf(p, e) * (adj.get(p.id) ?? 1);
      const old = b ? mine - cover(Ta.xi, Ta.bench, Ta.cap, Ta.vice, e, 2, va) + cover(Ta.xi, Ta.bench, Ta.cap, Ta.vice, e, 2) : NaN;
      check(!!b && Math.abs(app - mine) < 0.01 && Math.abs(old - mine) > 0.01,
        `A forecast blank scores the cover too: ${b ? b.name : "no bench player"}'s club blanks, team score ${f2(app)} (the old way gave ${f2(old)})`,
        `app ${f2(app)} mine ${f2(mine)}`);
    }
    /* the Chips page's curves, rounded to 0.1 */
    const bad = [];
    for (const kind of ["bboost", "3xc"]) {
      const cv = g.chipCurve(kind + half(NEXT));
      for (let e = NEXT; e < NEXT + 5 && e <= (half(NEXT) === "1" ? 19 : 38); e++) {
        if (!cv[e]) { bad.push(`${kind} GW${e} missing`); continue; }
        const ids = g.effectiveSquadIds(e).ids, o = { order, gView: NEXT };
        const want = myScore(MA, ids, e, kind, o) - myScore(MA, ids, e, null, o);
        if (Math.abs(cv[e].raw - want) > 0.051) bad.push(`${kind} GW${e} page ${cv[e].raw} mine ${want.toFixed(2)}`);
      }
    }
    check(!bad.length, "Chips page: Bench Boost and Triple Captain gains by week match ours", bad.join("; "));
  }

  /* M1: no single bench swap improves the Free Hit team by more than the
     optimiser's own 0.05 threshold */
  {
    const res = [], full = [];
    for (const e of [NEXT, NEXT + 1]) {
      /* the first call answers with the quick solve and starts the full one;
         wait for it, then ask again for the full optimum */
      g.chipTeam("freehit", e, true);
      const until = Date.now() + 120000;
      while (Date.now() < until && Object.keys(g.optPending).length) await new Promise(r => setTimeout(r, 200));
      const os = g.optimalSquad("freehit", e, g.squadBudget());
      full.push({ e, ok: !!os && !os.checking });
      const T = g.chipTeam("freehit", e, true); if (!T) { res.push({ e, err: "no team" }); continue; }
      const budget = g.squadBudget(), ids = T.ids, sp = ids.map(i => MA.byId.get(i)).filter(Boolean), o = { order, gView: NEXT };
      const cnt = { 1: 0, 2: 0, 3: 0, 4: 0 }, club = {}; sp.forEach(p => { cnt[p.pos]++; club[p.team.code] = (club[p.team.code] || 0) + 1; });
      const cost = sp.reduce((a, p) => a + p.price, 0);
      const legal = sp.length === 15 && cnt[1] === 2 && cnt[2] === 5 && cnt[3] === 5 && cnt[4] === 3 && Math.max(...Object.values(club)) <= 3 && cost <= budget + 1e-9;
      const base = myScore(MA, ids, e, null, o), mt = myTeam(MA, ids, e, o);
      let best = { g: 0 };
      for (const out of mt.bench) for (const c of MA.players) {
        if (c.pos !== out.pos || ids.includes(c.id) || !c.team) continue;
        if (cost - out.price + c.price > budget + 1e-9) continue;
        if (c.team.code !== out.team.code && (club[c.team.code] || 0) >= 3) continue;
        const gain = myScore(MA, ids.map(i => i === out.id ? c.id : i), e, null, o) - base;
        if (gain > best.g) best = { g: gain, sw: `${out.name} -> ${c.name}` };
      }
      const own = g.effectiveSquadIds(e).ids, appGain = Math.max(0, g.teamScore(ids, e, null) - g.teamScore(own, e, null));
      const myGain = Math.max(0, base - myScore(MA, own, e, null, o));
      res.push({ e, legal, cost: cost.toFixed(1), budget, best, appGain, myGain });
    }
    check(g.solverOn && full.every(f => f.ok), "Free Hit: the LP solver loaded and the full optimiser finished for both weeks (not the fallback)", JSON.stringify({ solver: g.solverOn, full }));
    check(res.every(r => r.legal), "Free Hit: the team is 15 legal players (2/5/5/3, three a club, within budget)", JSON.stringify(res.map(r => [r.e, r.legal, r.cost, r.budget])));
    check(res.every(r => r.best && r.best.g <= 0.06), "Free Hit (M1): no single bench swap would add more than the optimiser's 0.05 threshold",
      res.map(r => `GW${r.e} best swap +${r.best ? r.best.g.toFixed(2) : "?"} ${r.best && r.best.sw || ""}`).join("; "));
    check(res.every(r => Math.abs(r.appGain - r.myGain) < 0.01), "Free Hit: the gain over his own squad matches ours", res.map(r => `GW${r.e} app ${f2(r.appGain)} mine ${f2(r.myGain)}`).join("; "));
  }

  /* M2: an unnamed forecast blank does not lift the Free Hit */
  {
    const wk = Object.entries(g.CRELLIN.weeks).map(([e, f]) => [+e, f]).filter(([e, f]) => e >= NEXT && f.t === "blank" && !(f.teams && f.teams.length));
    let e0, keep = null;
    if (wk.length) e0 = wk[0][0];
    else { e0 = Math.min(38, NEXT + 3); keep = g.CRELLIN.weeks[e0]; g.CRELLIN.weeks[e0] = { t: "blank", p: 0.9, why: "test" }; }
    const ids = g.effectiveSquadIds(e0).ids, w = g.chipWeighted("freehit", e0, 2.7, ids);
    const cv = g.chipCurve("freehit" + half(e0))[e0];
    check(w.v === 2.7 && (!cv || cv.v === cv.raw), `Free Hit (M2): the unnamed forecast blank in GW${e0} adds nothing (${cv ? `curve ${cv.v} = raw ${cv.raw}` : "no curve week"})`, JSON.stringify(w.v));
    if (keep !== null || !wk.length) { if (keep) g.CRELLIN.weeks[e0] = keep; else delete g.CRELLIN.weeks[e0]; }
  }

  /* the suggested captain is the top xP in the XI (the Captain pop-up's best option) */
  {
    const ids = g.effectiveSquadIds(NEXT).ids, T = myTeam(MA, ids, NEXT, { order, gView: NEXT });
    const appXI = new Set(g.startingXI().map(p => p.id)), myXI = new Set(T.xi.map(p => p.id));
    check(appXI.size === 11 && [...myXI].every(i => appXI.has(i)), "Planner XI: the same eleven as our best legal XI", [...myXI].filter(i => !appXI.has(i)).map(i => MA.byId.get(i).name).join(", "));
    S.capSel = null; g.act("pop", "cap");
    const name = (doc.querySelector(".modal .ca-who b") || {}).textContent || "", fig = +((doc.querySelector(".modal .ca-big b") || {}).textContent || NaN);
    const mult = g.chipForWeek(NEXT) === "3xc" ? 3 : 2;
    check(name === T.cap.name && Math.abs(fig - ptsOf(T.cap, NEXT) * mult) < 0.051 && !!doc.querySelector(".modal .ca-best"),
      `Captain: the suggested captain is the XI's top xP (${T.cap.name}, ${(ptsOf(T.cap, NEXT) * mult).toFixed(1)})`, `page ${name} ${fig}`);
    g.act("pop", null);
  }

  /* C6: the header's Predicted over 3 GW uses each week's own planned chip */
  {
    const keep = { chips: S.chips, horizon: S.horizon };
    const bbW = NEXT + 1, tcW = NEXT + 2;
    if (half(bbW) === half(tcW) && tcW <= 38) {
      S.chips = Object.fromEntries(Object.entries(S.chips || {}).filter(([, w]) => ![NEXT, bbW, tcW].includes(w)));
      S.chips["bboost" + half(bbW)] = bbW; S.chips["3xc" + half(tcW)] = tcW; S.horizon = 3; S.tab = "squad"; g.render();
      const ids = g.effectiveSquadIds(NEXT).ids, T = myTeam(MA, ids, NEXT, { order, gView: NEXT });
      const capIn = T.xi.find(p => p.id === S.captain) || null, vice = MA.byId.get(S.vice) || null;
      let mine = 0, plain = 0;
      for (let e = NEXT; e < NEXT + 3; e++) {
        const chip = e === bbW ? "bboost" : e === tcW ? "3xc" : null, v = p => ptsOf(p, e);
        const xi = T.xi.reduce((a, p) => a + v(p), 0), c = capIn ? v(capIn) : 0;
        mine += xi + c * (chip === "3xc" ? 2 : 1) + (chip === "bboost" ? T.bench.reduce((a, p) => a + v(p), 0) + cover(T.xi, [], capIn, vice, e, 2) : cover(T.xi, T.bench, capIn, vice, e, chip === "3xc" ? 3 : 2));
        plain += xi + c + cover(T.xi, T.bench, capIn, vice, e, 2);
      }
      const hits = g.hitsOver(NEXT, 3); mine -= hits; plain -= hits;
      const app = g.weekPtsFor(NEXT, 3);
      const m = /predicted\s*([\d.]+)/.exec((doc.querySelector(".pz-wl") || {}).textContent || "");
      check(Math.abs(app - mine) < 0.01 && m && Math.abs(+m[1] - mine) < 0.051 && mine - plain > 1,
        `Header Predicted (C6): 3 GW with a Bench Boost in GW${bbW} and a Triple Captain in GW${tcW} is ${mine.toFixed(1)} (${(mine - plain).toFixed(1)} from the chips)`,
        `app ${f2(app)} page ${m && m[1]} mine ${f2(mine)} plain ${f2(plain)}`);
    } else check(true, "Header Predicted (C6): skipped, the weeks after the next one cross the half or the season end");
    S.chips = keep.chips; S.horizon = keep.horizon; g.render();
  }

  /* cross-page: Player Data's 3 GW figure = Signals' Leaders at 3 GW = the sum of our weeks */
  {
    S.tab = "signals"; g.act("sgtab", "players"); g.act("sglead", "pred"); g.act("sigh", "3");
    const lead = [...doc.querySelectorAll("#r-pred .hbr")].map(r => ({ id: +((/act\('card',(\d+)\)/.exec(r.getAttribute("onclick") || "") || [])[1]), v: r.querySelector(".hbv").textContent.trim() })).filter(x => x.id);
    const pick = lead.filter((x, i) => i % 2 === 0).concat(lead.filter((x, i) => i % 2 === 1)).slice(0, 10);
    S.tab = "table"; g.act("pwin", "3");
    const bad = [];
    for (const x of pick) {
      const p = MA.byId.get(x.id); S.lSearch = p.name; S.lPos = 0; S.lTeam = 0; g.render();
      const tr = [...doc.querySelectorAll(".pdt tbody tr")].find(t => (t.querySelector("input.tick") || { getAttribute: () => "" }).getAttribute("onchange").includes(`act('tick',${x.id})`));
      const pd = tr ? tr.querySelector(".pdproj b").textContent.trim() : null;
      let s = 0; for (let e = NEXT; e < NEXT + 3; e++) s += ptsOf(p, e);
      if (pd !== x.v || Math.abs(+x.v - s) > 0.051) bad.push(`${p.name}: Player Data ${pd}, Leaders ${x.v}, ours ${s.toFixed(2)}`);
    }
    S.lSearch = ""; g.act("pwin", "5");
    check(pick.length === 10 && !bad.length, `3 GW horizon agrees across pages for ${pick.length} players (Player Data = Signals Leaders = sum of our GW xP)`, bad.join("; "));
  }

  /* ================= run B: a week in play, a double and a blank ================= */
  {
    const ev = csv((await getA(`/data/insights/${SEASON}/gameweek_summaries.csv`)).text).map(e => ({ id: Math.round(N(e.id)), fin: String(e.finished).toLowerCase() === "true" })).sort((a, b) => a.id - b.id);
    const LIVE = (ev.find(e => !e.fin) || {}).id, NB = LIVE + 1, MOVE = NB + 2;
    const fxPath = gw => `/data/insights/${SEASON}/By%20Gameweek/GW${gw}/fixtures.csv`;
    const liveRows = csv((await getA(fxPath(LIVE))).text).filter(f => isPrem(f.match_id) && Math.round(N(f.gameweek)) === LIVE && String(f.finished).toLowerCase() !== "true");
    const moveRows = csv((await getA(fxPath(MOVE))).text).filter(f => isPrem(f.match_id) && Math.round(N(f.gameweek)) === MOVE);
    const played = liveRows[0], later = moveRows[0];
    const earlier = moveRows.find(f => ![later.home_team, later.away_team].includes(f.home_team) && ![later.home_team, later.away_team].includes(f.away_team));
    if (!played || !later || !earlier || MOVE + 1 > 38) throw new Error("run B: could not find the fixtures to edit");
    const tx = (path, text) => {
      if (path === "/api/status") { const j = JSON.parse(text); j.fpl = { ...(j.fpl || {}), gw: NB }; return JSON.stringify(j); }
      if (path === fxPath(LIVE)) return csvEdit(text, f => f.match_id === played.match_id ? { finished: "True", home_score: "2", away_score: "1",
        home_expected_goals_xg: "1.64", away_expected_goals_xg: "0.87", home_non_penalty_xg: "1.64", away_non_penalty_xg: "0.87" } : null);
      if (path === fxPath(MOVE)) return csvEdit(text, f => f.match_id === later.match_id ? { gameweek: String(MOVE + 1) } : f.match_id === earlier.match_id ? { gameweek: String(MOVE - 1) } : null);
      return text;
    };
    const getB = makeGet(tx);
    const B = await runApp(getB);
    const rawB = await loadRaw(getB);
    const MB = computeModel(rawB, { odds: B.S.oddsTeams || null });
    compareModel("B", B.S, MB, { hPts: B.g.hPts, c13: true });

    /* C13: the two clubs whose match has finished count the week in play */
    const liveClubs = [Math.round(N(played.home_team)), Math.round(N(played.away_team))];
    const old = computeModel(rawB, { odds: B.S.oddsTeams || null, c13: false });
    const ramp = MB.players.filter(p => p.team && liveClubs.includes(p.team.code) && p.path !== "appearances");
    const moved = ramp.filter(p => Math.abs(p.role - old.byId.get(p.id).role) > 1e-6);
    const appOld = moved.filter(p => Math.abs(B.S.model.players.find(x => x.id === p.id).roleMins - old.byId.get(p.id).role) < 1e-6);
    check(moved.length > 0 && ramp.every(p => p.gwP === MB.gwPlayed + 1) && MB.players.filter(p => p.team && !liveClubs.includes(p.team.code) && p.path !== "appearances").every(p => p.gwP === MB.gwPlayed),
      `C13: ${ramp.length} players at the two clubs whose GW${LIVE} match finished ramp over ${MB.gwPlayed + 1} weeks, everyone else over ${MB.gwPlayed} (${moved.length} change)`);
    check(!appOld.length, "C13: no player at those clubs is still on the old count", appOld.slice(0, 5).map(p => p.name).join(", "));

    /* a double counts twice, a blank counts zero */
    const short = c => (MB.teams.find(t => t.code === Math.round(N(c))) || {}).short;
    const dblLater = [short(later.home_team), short(later.away_team)], dblEarlier = [short(earlier.home_team), short(earlier.away_team)];
    const AB = new Map(B.S.model.players.map(p => [p.id, p]));
    const club = list => MB.players.filter(p => p.team && list.includes(p.team.short));
    const blanks = club([...dblLater, ...dblEarlier]).filter(p => { const q = AB.get(p.id).gw[MOVE]; return !(q && q.blank && q.pts === 0 && (q.fixtures || []).length === 0); });
    check(!blanks.length && club([...dblLater, ...dblEarlier]).length > 40, `Blank: every player at ${[...dblLater, ...dblEarlier].join(", ")} scores exactly 0 in GW${MOVE}`, blanks.slice(0, 5).map(p => p.name).join(", "));
    const two = [[dblLater, MOVE + 1], [dblEarlier, MOVE - 1]].flatMap(([cl2, e]) => club(cl2).map(p => [p, e])).filter(([p, e]) => (AB.get(p.id).gw[e].fixtures || []).length !== 2);
    check(!two.length, `Double: those players have two fixtures in GW${MOVE - 1} or GW${MOVE + 1}`, two.slice(0, 5).map(([p]) => p.name).join(", "));
    const ratios = [[dblLater, MOVE + 1], [dblEarlier, MOVE - 1]].flatMap(([cl2, e]) => club(cl2).filter(p => p.role >= 60 && p.avail === 1 && !p.outUntil).map(p => {
      const singles = [0, 1, 2, 3, 4].map(k => NB + k).filter(w => w !== e && w !== MOVE && w <= 38).map(w => AB.get(p.id).gw[w].pts);
      return { p, r: AB.get(p.id).gw[e].pts / (singles.reduce((a, b) => a + b, 0) / singles.length) }; }));
    const mean = ratios.reduce((a, x) => a + x.r, 0) / Math.max(1, ratios.length), wild = ratios.filter(x => !(x.r >= 1.5 && x.r <= 2.5));
    check(ratios.length >= 20 && !wild.length && mean >= 1.8 && mean <= 2.2, `Double: a regular starter's double week is about two single weeks (mean ${mean.toFixed(2)}x over ${ratios.length} players)`,
      wild.slice(0, 5).map(x => `${x.p.name} ${x.r.toFixed(2)}x`).join(", "));
    const hz = club([...dblLater, ...dblEarlier]).filter(p => { let s = 0; for (let e = NB; e < NB + 5; e++) s += ptsOf(p, e); return Math.abs(B.g.hPts(AB.get(p.id), NB, 5) - s) > 0.01; });
    check(!hz.length, "Horizon: the 5 GW total over a double and a blank is the sum of our weeks (double once, blank zero)", hz.slice(0, 5).map(p => p.name).join(", "));
  }
} catch (e) {
  fail++; console.log("FAIL  run aborted -- " + (e && e.stack || e));
} finally {
  server.kill();
}
console.log(`\n${pass} passed, ${fail} failed`);
if (!fail) console.log("All model checks passed.");
process.exit(fail ? 1 : 0);
