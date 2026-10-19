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
