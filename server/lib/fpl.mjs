/* FPL Signals server - the official FPL API.
   bootstrap-static every 15 minutes, every 5 minutes in the three hours
   before a deadline, one extra fetch shortly after 00:05 UK for price
   changes, and event/{gw}/live every 2 minutes while a fixture is in
   play. No key, no auth; a plain User-Agent. */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG, UA } from "./config.mjs";
import { log, fetchT, parseCSV } from "./util.mjs";
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
      const t = Date.parse(r[k]);
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
    await writeFile(join(DIR(), `live-gw${gw}.json`), JSON.stringify(d));
    state.liveFetchedAt = new Date().toISOString();
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
const _week = new Map();
export async function fplWeekPayload(gwIn) {
  const gw = Math.round(+gwIn), cur = state.currentGw || state.gw || 0;
  if (!(gw >= 1 && gw <= 38)) return { gw, players: {}, fixtures: [] };
  const hit = _week.get(gw);
  if (hit && (gw < cur || Date.now() - hit.at < 50000)) return hit.body;
  const lp = join(DIR(), `live-gw${gw}.json`), fp = join(DIR(), `fixtures-gw${gw}.json`);
  let live = null, fx = null;
  try { live = JSON.parse(await readFile(lp, "utf8")); } catch { /* not kept yet */ }
  /* batch 5: the week in play is fetched again; a finished one is kept */
  if ((!live || (cur && gw >= cur)) && (!cur || gw <= cur)) {
    try { live = await getJson(`/event/${gw}/live/`); await mkdir(DIR(), { recursive: true }); await writeFile(lp, JSON.stringify(live)); }
    catch (e) { log("fpl.week", "live fail gw=" + gw + " " + e.message, 0); }
  }
  try { fx = JSON.parse(await readFile(fp, "utf8")); } catch { /* not kept yet */ }
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
      bps: t.bps ?? 0, dcn: t.defensive_contribution ?? null };
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
  const body = { gw, players, fixtures };
  _week.set(gw, { at: Date.now(), body });
  return body;
}
