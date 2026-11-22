/* FPL Signals server - the field (22 Nov 2026, This Week batch 1).

   "The field" is the managers you are racing. Two samples, taken once a
   gameweek after its deadline and refreshed once when the week is final:
     near   - the 50 managers ranked either side of you (as neighbours.mjs did)
     top10k - four overall-league standings pages spread across ranks 1-10,000
              (pages 1, 67, 134, 200: 200 managers)
   For each manager: that week's picks (with multipliers, chip and the
   entry_history line) and that week's transfers. From them:
     own   - share owning each player
     eo    - effective ownership: sum of multipliers / n (captain counts 2,
             bench 0 unless Bench Boost), as a percentage
     cap   - share captaining each player
     chips - share playing each chip this week
     pairs - the most common out -> in transfers
     avg   - average points, season total, bench points, hits, value, bank
   Rank bands: the season total at fixed overall ranks (10k ... 3M), so the
   Rank pop-up can show the points needed for each milestone.

   About 260 + 410 calls a gameweek in two passes, 300 ms apart. Writes
   feeds/field.json (last 8 gameweeks), feeds/rankbands.json and, for the
   Players hub's old "ownership around you", feeds/neighbours.json in its
   original shape. */

import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG, UA } from "./config.mjs";
import { log, fetchT, sleep } from "./util.mjs";
import { FEEDS_DIR } from "./feeds.mjs";

const OVERALL = 314, EACH_SIDE = 25, GAP_MS = 300, KEEP_GWS = 8;
const TOP_PAGES = [1, 67, 134, 200];
const BANDS = [10000, 50000, 100000, 200000, 300000, 400000, 500000, 1000000, 2000000, 3000000];
const F = name => join(FEEDS_DIR(), name);
const state = { field: { gw: null, final: false, lastOk: null, error: null }, bands: { gw: null, lastOk: null, error: null } };

async function getJson(path) {
  const r = await fetchT(CONFIG.FPL_API_BASE + path, { headers: { "User-Agent": UA, Accept: "application/json" } }, 25000);
  if (!r.ok) throw new Error(path + " HTTP " + r.status);
  return r.json();
}
async function readJson(name) { try { return JSON.parse(await readFile(F(name), "utf8")); } catch { return null; } }
async function writeJson(name, body) {
  await mkdir(FEEDS_DIR(), { recursive: true });
  await writeFile(F(name) + ".tmp", JSON.stringify(body));
  await rename(F(name) + ".tmp", F(name));
}
async function eventOf(gw) {
  try {
    const b = JSON.parse(await readFile(join(CONFIG.STATE_DIR, "fpl", "bootstrap.json"), "utf8"));
    return (b.events || []).find(e => e.id === gw) || null;
  } catch { return null; }
}
const pct = (x, n) => Math.round(x / n * 1000) / 10;

/* one manager's week: picks plus that week's transfers */
async function manager(entry, gw) {
  const pk = await getJson(`/entry/${entry}/event/${gw}/picks/`);
  await sleep(GAP_MS);
  let tr = [];
  try { tr = (await getJson(`/entry/${entry}/transfers/`)).filter(t => t.event === gw).map(t => [t.element_out, t.element_in]); }
  catch { /* transfers are optional */ }
  await sleep(GAP_MS);
  return { picks: pk.picks || [], chip: pk.active_chip || null, h: pk.entry_history || {}, tr };
}

/* the summary of one sample */
export function summarise(teams) {
  const n = teams.length, own = {}, eo = {}, cap = {}, chips = {}, pairs = {};
  const sum = { pts: 0, total: 0, bench: 0, hits: 0, value: 0, bank: 0, transfers: 0 };
  for (const t of teams) {
    for (const p of t.picks) {
      own[p.element] = (own[p.element] || 0) + 1;
      eo[p.element] = (eo[p.element] || 0) + (p.multiplier || 0);
      if (p.is_captain) cap[p.element] = (cap[p.element] || 0) + 1;
    }
    if (t.chip) chips[t.chip] = (chips[t.chip] || 0) + 1;
    for (const [o, i] of t.tr) { const k = o + ">" + i; pairs[k] = (pairs[k] || 0) + 1; }
    const h = t.h;
    sum.pts += h.points || 0; sum.total += h.total_points || 0; sum.bench += h.points_on_bench || 0;
    sum.hits += (h.event_transfers_cost || 0) / 4; sum.value += (h.value || 0) / 10; sum.bank += (h.bank || 0) / 10;
    sum.transfers += h.event_transfers || 0;
  }
  const per = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, pct(v, n)]));
  const avg = Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, Math.round(v / n * 100) / 100]));
  const top = Object.entries(pairs).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, c]) => { const [o, i] = k.split(">").map(Number); return [o, i, pct(c, n)]; });
  return { n, own: per(own), eo: per(eo), cap: per(cap), chips: per(chips), pairs: top, avg };
}

async function sample(entries, gw, skip) {
  const teams = [];
  for (const e of entries) {
    if (e === +skip) continue;
    /* one retry after a pause: FPL rate-limits bursts (a first live run read
       32 of 50 near-you teams) */
    try { teams.push(await manager(e, gw)); }
    catch { await sleep(3000); try { teams.push(await manager(e, gw)); } catch { /* a missing team is skipped */ } }
  }
  return teams;
}

/* After the deadline: build once; when the week is final (data_checked),
   rebuild once so the averages are the week's final points. */
export async function buildField(gw) {
  if (!gw) return;
  const ev = await eventOf(gw);
  const final = !!(ev && ev.finished && ev.data_checked);
  const old = await readJson("field.json");
  const have = old && old.gws && old.gws[gw];
  if (have && (have.final || !final)) { state.field = { ...state.field, gw, final: !!have.final, lastOk: have.builtAt }; return; }
  const t0 = Date.now();
  try {
    const me = await getJson(`/entry/${CONFIG.FPL_TEAM_ID}/`);
    const rank = me.summary_overall_rank;
    if (!rank) throw new Error("no overall rank yet");
    const pages = [...new Set([Math.ceil(Math.max(1, rank - 50) / 50), Math.ceil(rank / 50), Math.ceil((rank + 50) / 50)])];
    let rows = [];
    for (const p of pages) { const s = await getJson(`/leagues-classic/${OVERALL}/standings/?page_standings=${p}`); rows = rows.concat((s.standings && s.standings.results) || []); await sleep(GAP_MS); }
    const near = rows.slice().sort((a, b) => Math.abs(a.rank - rank) - Math.abs(b.rank - rank)).slice(0, EACH_SIDE * 2 + 1).map(r => r.entry);
    let top = [];
    for (const p of TOP_PAGES) { const s = await getJson(`/leagues-classic/${OVERALL}/standings/?page_standings=${p}`); top = top.concat(((s.standings && s.standings.results) || []).map(r => r.entry)); await sleep(GAP_MS); }
    const nearT = await sample(near, gw, CONFIG.FPL_TEAM_ID), topT = await sample(top, gw, CONFIG.FPL_TEAM_ID);
    if (!nearT.length) throw new Error("no near-you picks");
    const body = old && old.gws ? old : { gws: {} };
    body.gws[gw] = { gw, final, rank, builtAt: new Date().toISOString(), near: summarise(nearT), top10k: topT.length ? summarise(topT) : null };
    Object.keys(body.gws).map(Number).sort((a, b) => b - a).slice(KEEP_GWS).forEach(k => delete body.gws[k]);
    body.latest = gw; body.updated = new Date().toISOString();
    await writeJson("field.json", body);
    /* the Players hub's "ownership around you", in its original shape */
    const own = {}; nearT.forEach(t => t.picks.forEach(p => { own[p.element] = (own[p.element] || 0) + 1; }));
    await writeJson("neighbours.json", { gw, rank, n: nearT.length, from: rank - EACH_SIDE, to: rank + EACH_SIDE, own, builtAt: body.updated });
    state.field = { gw, final, lastOk: body.updated, error: null };
    log("field", `ok gw=${gw}${final ? " final" : ""} near=${nearT.length} top10k=${topT.length}`, Date.now() - t0);
  } catch (e) {
    state.field.error = e.message;
    log("field", "fail " + e.message, Date.now() - t0);
  }
}

/* Rank bands: the season total at each band's rank, plus yours. Hourly
   until the week is final, then once. */
export async function buildRankBands(gw) {
  if (!gw) return;
  const ev = await eventOf(gw);
  const final = !!(ev && ev.finished && ev.data_checked);
  const old = await readJson("rankbands.json");
  if (old && old.gw === gw && old.final) { state.bands = { gw, lastOk: old.builtAt, error: null }; return; }
  const t0 = Date.now();
  try {
    const me = await getJson(`/entry/${CONFIG.FPL_TEAM_ID}/`);
    const bands = [];
    for (const r of BANDS) {
      const s = await getJson(`/leagues-classic/${OVERALL}/standings/?page_standings=${Math.ceil(r / 50)}`);
      const rows = (s.standings && s.standings.results) || [];
      const row = rows.reduce((b, x) => (!b || Math.abs(x.rank - r) < Math.abs(b.rank - r) ? x : b), null);
      if (row) bands.push({ rank: r, total: row.total, at: row.rank });
      await sleep(GAP_MS);
    }
    if (!bands.length) throw new Error("no standings");
    /* batch 5: FPL's own figures for the week in play (it updates them through the week) */
    const body = { gw, final, builtAt: new Date().toISOString(), me: { rank: me.summary_overall_rank, total: me.summary_overall_points, gwRank: me.summary_event_rank ?? null, gwPts: me.summary_event_points ?? null, gw: me.current_event ?? null }, bands };
    await writeJson("rankbands.json", body);
    state.bands = { gw, lastOk: body.builtAt, error: null };
    log("rankbands", `ok gw=${gw}${final ? " final" : ""} bands=${bands.length}`, Date.now() - t0);
  } catch (e) {
    state.bands.error = e.message;
    log("rankbands", "fail " + e.message, Date.now() - t0);
  }
}

/* Price log: FPL's progress for every player near a change, at each
   bootstrap fetch, the last 48 hours (Price Watch's "per hour"). */
export async function recordPrices() {
  let b;
  try { b = JSON.parse(await readFile(join(CONFIG.STATE_DIR, "fpl", "bootstrap.json"), "utf8")); } catch { return; }
  const p = {};
  for (const e of b.elements || []) { const v = e.price_change_percent == null ? null : +e.price_change_percent; if (v != null && Math.abs(v) >= 20) p[e.id] = v; }
  const log0 = (await readJson("pricelog.json")) || { samples: [] };
  const t = Date.now();
  log0.samples = log0.samples.filter(s => t - s.t < 48 * 3600000);
  if (log0.samples.length && t - log0.samples[log0.samples.length - 1].t < 10 * 60000) return;
  log0.samples.push({ t, p });
  await writeJson("pricelog.json", log0);
}

export function fieldStatus() { return { field: { ...state.field }, rankBands: { ...state.bands } }; }
