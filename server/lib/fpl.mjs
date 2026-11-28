/* FPL Signals server - the official FPL API.
   bootstrap-static every 15 minutes, every 5 minutes in the three hours
   before a deadline, one extra fetch shortly after 00:05 UK for price
   changes, and event/{gw}/live every 2 minutes while a fixture is in
   play. No key, no auth; a plain User-Agent. */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG, UA } from "./config.mjs";
import { log, fetchT, parseCSV, upstreamBlocked } from "./util.mjs";
import { currentDir } from "./dataset.mjs";

const DIR = () => join(CONFIG.STATE_DIR, "fpl");

const state = {
  fetchedAt: null,
  nextDeadline: null,   // ISO, from events[].deadline_time
  gw: null,             // the next (upcoming) gameweek id
  currentGw: null,      // is_current event id
  lastError: null,
  liveFetchedAt: null,
  lastPriceFetchDay: null   // "YYYY-MM-DD" in London time
};

async function getJson(path) {
  const r = await fetchT(CONFIG.FPL_API_BASE + path, {
    headers: { "User-Agent": UA, Accept: "application/json" }
  }, 25000);
  if (!r.ok) throw new Error(path + " HTTP " + r.status);
  return r.json();
}

export async function fetchBootstrap(reason) {
  const t0 = Date.now();
  try {
    const b = await getJson("/bootstrap-static/");
    const events = b.events || [];
    const next = events.find(e => e.is_next) || events.find(e => !e.finished);
    const cur = events.find(e => e.is_current);
    state.nextDeadline = next?.deadline_time || null;
    state.gw = next?.id ?? null;
    state.currentGw = cur?.id ?? null;
    state.fetchedAt = new Date().toISOString();
    state.lastError = null;
    await mkdir(DIR(), { recursive: true });
    await writeFile(join(DIR(), "bootstrap.json"), JSON.stringify(b));
    /* 29 Nov 2026: a flag that changes while the week is live goes in the Feed */
    if (cur && !cur.finished) await feedNews(cur.id, b.elements || []);
    log("fpl.bootstrap", `ok gw=${state.gw} deadline=${state.nextDeadline || "-"}${reason ? " (" + reason + ")" : ""}`, Date.now() - t0);
  } catch (e) {
    state.lastError = e.message;
    log("fpl.bootstrap", "fail " + e.message, Date.now() - t0);
  }
}

/* True inside the given hours before the next deadline (odds refresh
   hourly in the last 48, when bookmakers publish player markets). */
export function withinHoursOfDeadline(h) {
  if (!state.nextDeadline) return false;
  const d = Date.parse(state.nextDeadline) - Date.now();
  return d > 0 && d < h * 3600000;
}
/* True inside the 3 hours before the next deadline. */
export function nearDeadline() {
  if (!state.nextDeadline) return false;
  const d = Date.parse(state.nextDeadline) - Date.now();
  return d > 0 && d < 3 * 3600000;
}

/* A fixture is treated as live from kickoff to kickoff + 130 minutes.
   Kickoff times come from the mirrored dataset's fixtures file for the
   current (or next) gameweek. */
export async function anyFixtureLive() {
  const gw = state.currentGw || state.gw;
  if (!gw) return false;
  try {
    const f = parseCSV(await readFile(
      join(currentDir(), `${CONFIG.SEASON}/By Gameweek/GW${gw}/fixtures.csv`), "utf8"));
    const k = f.header.indexOf("kickoff_time");
    if (k < 0) return false;
    const now = Date.now();
    return f.rows.some(r => {
      const raw = String(r[k] || ""), t = Date.parse(/T\d\d:\d\d(:\d\d)?$/.test(raw) ? raw + "Z" : raw); /* C8: dataset times are UTC without a zone */
      return Number.isFinite(t) && now >= t && now <= t + 130 * 60000;
    });
  } catch { return false; }
}

export async function fetchLive() {
  const gw = state.currentGw || state.gw;
  if (!gw) return;
  const t0 = Date.now();
  try {
    const d = await getJson(`/event/${gw}/live/`);
    await mkdir(DIR(), { recursive: true });
    await writeFile(weekFile("live", gw), JSON.stringify(d));
    state.liveFetchedAt = new Date().toISOString();
    /* the match clock for the Feed's minutes and substitutions */
    let fx = null;
    try { fx = await getJson(`/fixtures/?event=${gw}`); await writeFile(weekFile("fixtures", gw), JSON.stringify(fx)); }
    catch { fx = await readWeek("fixtures", gw); }
    await feedRecordQ(gw, d, fx);
    log("fpl.live", "ok gw=" + gw, Date.now() - t0);
  } catch (e) {
    log("fpl.live", "fail " + e.message, Date.now() - t0);
  }
}

/* Price changes land on the API around 01:30 UTC in theory but the safe
   habit is one fetch shortly after 00:05 UK time: run it once per London
   day as soon as the local clock is past 00:05. */
export function priceFetchDue() {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const pastMark = Number(parts.hour) > 0 || Number(parts.minute) >= 5;
  if (pastMark && state.lastPriceFetchDay !== day) {
    state.lastPriceFetchDay = day;
    return true;
  }
  return false;
}

export function fplStatus() {
  return {
    fetchedAt: state.fetchedAt,
    ageMinutes: state.fetchedAt ? Math.round((Date.now() - Date.parse(state.fetchedAt)) / 60000) : null,
    nextDeadline: state.nextDeadline,
    gw: state.gw,
    liveFetchedAt: state.liveFetchedAt,
    error: state.lastError
  };
}

export function nextDeadline() { return state.nextDeadline; }
export function currentGw() { return state.currentGw; }

/* Redesign wave 1 (19 Oct 2026): the per-player fields the dataset mirror
   does not carry - FPL's own price-change predictor and its live set-piece
   orders - trimmed from the last bootstrap, cached until the next fetch. */
let _slim = null;
export async function fplPlayersPayload() {
  if (_slim && _slim.at === state.fetchedAt) return _slim.body;
  let b;
  try { b = JSON.parse(await readFile(join(DIR(), "bootstrap.json"), "utf8")); }
  catch { return { fetchedAt: null, players: {} }; }
  const players = {};
  for (const e of b.elements || []) {
    players[e.id] = {
      pcp: e.price_change_percent == null ? null : +e.price_change_percent,
      pcRate: e.price_change_hourly_rate ?? null,
      pcProj: (e.price_change_projections || []).map(x => [x.offset, +x.projected_percent, x.likelihood]),
      pcLock: e.price_change_locked_until || null,
      pcCal: !!e.price_change_calibrating,
      pen: e.penalties_order ?? null,
      cor: e.corners_and_indirect_freekicks_order ?? null,
      dfk: e.direct_freekicks_order ?? null,
      ep: e.ep_next == null ? null : +e.ep_next,
      dt: e.dreamteam_count ?? null,
      /* 21 Nov 2026: in FPL's season Dream Team (the Planner's star) */
      idt: e.in_dreamteam ? 1 : 0,
      /* 12 Nov 2026 audit: availability, news, price, ownership and transfers
         from this 15-minute fetch, so the page need not wait for the dataset
         mirror (hours behind). now_cost and cost changes in tenths, as FPL. */
      st: e.status ?? null,
      cn: e.chance_of_playing_next_round ?? null,
      ct: e.chance_of_playing_this_round ?? null,
      news: e.news ?? null,
      na: e.news_added ?? null,
      cost: e.now_cost ?? null,
      cce: e.cost_change_event ?? null,
      ccs: e.cost_change_start ?? null,
      sel: e.selected_by_percent ?? null,
      tie: e.transfers_in_event ?? null,
      toe: e.transfers_out_event ?? null,
      form: e.form ?? null,
      tp: e.total_points ?? null,
      /* 26 Nov 2026: season cards, for Ban Risk (5 yellows by GW19 is a ban) */
      yc: e.yellow_cards ?? null,
      rc: e.red_cards ?? null,
      ppg: e.points_per_game ?? null
    };
  }
  const body = { fetchedAt: state.fetchedAt, players };
  _slim = { at: state.fetchedAt, body };
  return body;
}

/* Every player's names and club, for tagging news stories (22 Nov 2026).
   From the last bootstrap on disk, cached until the next fetch. */
let _names = null;
export async function fplNamesPayload() {
  if (_names && _names.at === state.fetchedAt) return _names.list;
  let b;
  try { b = JSON.parse(await readFile(join(DIR(), "bootstrap.json"), "utf8")); }
  catch { return []; }
  const tm = {}; (b.teams || []).forEach(t => { tm[t.id] = t.name; });
  const list = (b.elements || []).map(e => ({ id: e.id, first: e.first_name, second: e.second_name, web: e.web_name, team: tm[e.team] || "" }));
  _names = { at: state.fetchedAt, list };
  return list;
}

/* One gameweek for the Planner's finished-week view (22 Nov 2026): each
   player's points, minutes, match events and that week's Dream Team, and
   the week's fixtures with their scores. A finished week never changes, so
   a week not on disk is fetched from FPL once and kept. */
/* S7 (audit, 22 Nov 2026): a kept week is named by season, so next
   season's GW5 is never served this season's file. A frozen test fixture
   still holds the old unseasoned names, which it may read but never writes. */
function weekFile(kind, gw) { return join(DIR(), `${kind}-${CONFIG.SEASON}-gw${gw}.json`); }
async function readWeek(kind, gw) {
  try { return JSON.parse(await readFile(weekFile(kind, gw), "utf8")); } catch { /* not kept yet */ }
  if (upstreamBlocked()) { try { return JSON.parse(await readFile(join(DIR(), `${kind}-gw${gw}.json`), "utf8")); } catch { /* none */ } }
  return null;
}
/* The live Feed (28 Nov 2026, Andy approved the mock). FPL's live data has
   running totals, not a timeline, so each fresh copy is compared with the
   last: every change in a player's points for a fixture (a goal, an assist,
   a card, a save point, DefCon, a clean sheet won or lost, goals conceded,
   bonus) is one event, timed when it was first seen, with the match minute.
   What was already there the first time a week is seen has no time. Kept
   per week in feed-<season>-gw<n>.json so a restart neither loses nor
   repeats anything. */
const FEED_SKIP = new Set(["minutes", "bps"]);
const FEED_VALUE = new Set(["goals_scored", "assists", "own_goals", "penalties_saved", "penalties_missed", "yellow_cards", "red_cards"]);
export function feedDiff(prev, live, fixtures, now) {
  const snap = {}, events = [], fmin = {};
  for (const f of Array.isArray(fixtures) ? fixtures : []) fmin[f.id] = f.minutes ?? null;
  const at = fx => (prev ? { t: now, min: fmin[fx] ?? null } : { t: null, min: null });
  /* 29 Nov 2026: substitutions. FPL has none, but a player's minutes stop
     while his match clock runs on once he is taken off (3 match minutes
     without a minute of his, before the 90th), and a player who first
     appears 3+ minutes after kick-off came on. Kept in snap["#sub"]. */
  const seen = !!(prev && prev["#sub"]), ps = seen ? prev["#sub"] : {}, ns = {};
  for (const e of (live && live.elements) || []) for (const f of e.explain || []) {
    const my = (f.stats || []).find(y => y.identifier === "minutes"), m = my ? (my.value ?? 0) : 0, clock = fmin[f.fixture];
    const key = e.id + ":" + f.fixture, was = ps[key];
    if (!m || clock == null) { if (was) ns[key] = was; continue; }
    if (!was) {
      ns[key] = { m, last: clock, off: 0 };
      if (seen && clock - m >= 3) events.push({ t: now, min: Math.max(1, clock - m), el: e.id, fx: f.fixture, k: "subbed_on", dv: 0, dp: 0 });
    } else if (m > was.m) ns[key] = { ...was, m, last: clock };
    else if (!was.off && seen && clock - was.last >= 3 && clock < 90) {
      ns[key] = { ...was, off: 1 };
      events.push({ t: now, min: m, el: e.id, fx: f.fixture, k: "subbed_off", dv: 0, dp: 0 });
    } else ns[key] = was;
  }
  snap["#sub"] = ns;
  for (const e of (live && live.elements) || []) for (const f of e.explain || []) for (const y of f.stats || []) {
    if (FEED_SKIP.has(y.identifier)) continue;
    const key = `${e.id}:${f.fixture}:${y.identifier}`, v = y.value ?? 0, p = y.points ?? 0;
    snap[key] = [v, p];
    const [pv, pp] = (prev && prev[key]) || [0, 0];
    if (p !== pp || (v !== pv && FEED_VALUE.has(y.identifier)))
      events.push({ ...at(f.fixture), el: e.id, fx: f.fixture, k: y.identifier, dv: v - pv, dp: p - pp });
  }
  /* a line FPL drops (a clean sheet lost) is an event too */
  if (prev) for (const key in prev) if (key[0] !== "#" && !(key in snap) && prev[key][1]) {
    const [el, fx, k] = key.split(":");
    events.push({ ...at(+fx), el: +el, fx: +fx, k, dv: -prev[key][0], dp: -prev[key][1] });
  }
  return { snap, events };
}
let _feed = null, _feedQ = Promise.resolve();
async function feedLoad(gw) {
  if (_feed && _feed.gw === gw) return _feed;
  try { const d = JSON.parse(await readFile(weekFile("feed", gw), "utf8")); _feed = { gw, snap: d.snap || null, events: d.events || [] }; }
  catch { _feed = { gw, snap: null, events: [] }; }
  return _feed;
}
async function feedRecord(gw, live, fixtures) {
  if (!live || !Array.isArray(live.elements) || !live.elements.length) return;
  const F = await feedLoad(gw), { snap, events } = feedDiff(F.snap, live, fixtures, Date.now());
  F.snap = snap;
  if (!events.length) return;
  F.events.push(...events);
  if (F.events.length > 4000) F.events = F.events.slice(-4000);
  try { await mkdir(DIR(), { recursive: true }); await writeFile(weekFile("feed", gw), JSON.stringify({ snap: F.snap, events: F.events })); }
  catch (e) { log("fpl.feed", "write fail gw=" + gw + " " + e.message, 0); }
}
/* a changed flag (injury, doubt, suspension) while the week is live: the
   first look after a restart only remembers, it never floods the Feed */
let _news = null;
async function feedNews(gw, elements) {
  const now = {};
  for (const e of elements) now[e.id] = [e.news || "", e.status || "a", e.chance_of_playing_next_round ?? null];
  const was = _news; _news = now;
  if (!was) return;
  const ev = [];
  for (const id in now) {
    const [txt, st, ch] = now[id], [ptxt] = was[id] || [""];
    if (txt && txt !== ptxt && st !== "a") ev.push({ t: Date.now(), min: null, el: +id, fx: null, k: "news", dv: 0, dp: 0, txt, ch });
  }
  if (!ev.length) return;
  _feedQ = _feedQ.then(async () => {
    const F = await feedLoad(gw); F.events.push(...ev);
    try { await mkdir(DIR(), { recursive: true }); await writeFile(weekFile("feed", gw), JSON.stringify({ snap: F.snap, events: F.events })); } catch { /* next write keeps them */ }
  }).catch(() => {});
  await _feedQ;
}
/* one at a time: two fetches landing together must not both count a goal */
function feedRecordQ(gw, live, fixtures) { _feedQ = _feedQ.then(() => feedRecord(gw, live, fixtures)).catch(() => {}); return _feedQ; }

const _week = new Map();
export async function fplWeekPayload(gwIn) {
  const gw = Math.round(+gwIn), cur = state.currentGw || state.gw || 0;
  if (!(gw >= 1 && gw <= 38)) return { gw, players: {}, fixtures: [] };
  const hit = _week.get(gw);
  if (hit && (gw < cur || Date.now() - hit.at < 50000)) return hit.body;
  const lp = weekFile("live", gw), fp = weekFile("fixtures", gw);
  let live = null, fx = null;
  live = await readWeek("live", gw);
  let fresh = false;
  /* batch 5: the week in play is fetched again; a finished one is kept */
  if ((!live || (cur && gw >= cur)) && (!cur || gw <= cur)) {
    try { live = await getJson(`/event/${gw}/live/`); fresh = true; await mkdir(DIR(), { recursive: true }); await writeFile(lp, JSON.stringify(live)); }
    catch (e) { log("fpl.week", "live fail gw=" + gw + " " + e.message, 0); }
  }
  fx = await readWeek("fixtures", gw);
  if ((!fx || (cur && gw >= cur)) && (!cur || gw <= cur)) {
    try { fx = await getJson(`/fixtures/?event=${gw}`); await mkdir(DIR(), { recursive: true }); await writeFile(fp, JSON.stringify(fx)); }
    catch (e) { log("fpl.week", "fixtures fail gw=" + gw + " " + e.message, 0); }
  }
  const players = {};
  for (const e of (live && live.elements) || []) {
    const t = e.stats || {};
    const dc = (e.explain || []).some(x => (x.stats || []).some(y => y.identifier === "defensive_contribution" && y.points > 0));
    players[e.id] = { p: t.total_points ?? 0, m: t.minutes ?? 0, g: t.goals_scored || 0, a: t.assists || 0, cs: t.clean_sheets || 0,
      b: t.bonus || 0, sv: t.saves || 0, yc: t.yellow_cards || 0, rc: t.red_cards || 0, og: t.own_goals || 0,
      ps: t.penalties_saved || 0, pm: t.penalties_missed || 0, dc: dc ? 1 : 0, dt: t.in_dreamteam ? 1 : 0,
      /* batch 5 (22 Nov 2026): the live Planner's BPS and DefCon count */
      bps: t.bps ?? 0, dcn: t.defensive_contribution ?? null,
      /* 23 Nov 2026: FPL's own points breakdown for the live player card,
         per fixture: [fixture, [[identifier, value, points], ...]] */
      x: (e.explain || []).map(f => [f.fixture, (f.stats || []).map(y => [y.identifier, y.value ?? 0, y.points ?? 0])]) };
  }
  /* batch 5 (22 Nov 2026): kick-off, minute and state, and the match's own
     stats (goals, assists, cards, saves, bonus, BPS, DefCon) for the live
     Planner's Match Centre: {identifier: {h: [[element, value]], a: [...]}} */
  const ST = ["goals_scored", "assists", "own_goals", "penalties_saved", "penalties_missed", "yellow_cards", "red_cards", "saves", "bonus", "bps", "defensive_contribution"];
  const fixtures = (Array.isArray(fx) ? fx : []).map(f => {
    const st = {};
    for (const s of f.stats || []) if (ST.includes(s.identifier)) st[s.identifier] = { h: (s.h || []).map(x => [x.element, x.value]), a: (s.a || []).map(x => [x.element, x.value]) };
    return { id: f.id, h: f.team_h, a: f.team_a, hs: f.team_h_score, as: f.team_a_score, done: !!f.finished, fp: !!f.finished_provisional,
      started: !!f.started, min: f.minutes ?? 0, ko: f.kickoff_time || null, st };
  });
  if (fresh && gw === cur) await feedRecordQ(gw, live, fx);
  const body = { gw, players, fixtures, feed: (await feedLoad(gw)).events };
  _week.set(gw, { at: Date.now(), body });
  return body;
}
