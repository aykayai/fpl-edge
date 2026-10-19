/* FPL Signals server - ownership among the managers ranked around you.

   Redesign wave 3 (20 Oct 2026): the Players hub shows "ownership around
   you" two ways, mini-league rivals (the rivals feed) and overall-rank
   neighbours (this file). Once per gameweek, after its deadline: read your
   overall rank, take the 50 managers either side of it from the overall
   league (id 314) standings, fetch each one's picks for the current week
   and count how many own each player. About 52 calls a week, spaced out. */

import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG, UA } from "./config.mjs";
import { log, fetchT } from "./util.mjs";
import { FEEDS_DIR } from "./feeds.mjs";

const OVERALL = 314, EACH_SIDE = 25, GAP_MS = 250;
const FILE = () => join(FEEDS_DIR(), "neighbours.json");
const state = { lastOk: null, error: null, gw: null };

async function getJson(path) {
  const r = await fetchT(CONFIG.FPL_API_BASE + path, { headers: { "User-Agent": UA, Accept: "application/json" } }, 25000);
  if (!r.ok) throw new Error(path + " HTTP " + r.status);
  return r.json();
}
const wait = ms => new Promise(r => setTimeout(r, ms));

export async function buildNeighbours(currentGw) {
  if (!currentGw) return;
  try {
    const old = JSON.parse(await readFile(FILE(), "utf8"));
    if (old && old.gw === currentGw && old.n > 0) { state.gw = old.gw; state.lastOk = old.builtAt; return; }
  } catch { /* first build */ }
  const t0 = Date.now();
  try {
    const me = await getJson(`/entry/${CONFIG.FPL_TEAM_ID}/`);
    const rank = me.summary_overall_rank;
    if (!rank) throw new Error("no overall rank yet");
    const pages = new Set([Math.ceil(Math.max(1, rank - EACH_SIDE) / 50), Math.ceil((rank + EACH_SIDE) / 50)]);
    let rows = [];
    for (const p of pages) {
      const s = await getJson(`/leagues-classic/${OVERALL}/standings/?page_standings=${p}`);
      rows = rows.concat((s.standings && s.standings.results) || []);
      await wait(GAP_MS);
    }
    const near = rows.filter(r => r.entry !== +CONFIG.FPL_TEAM_ID && Math.abs(r.rank - rank) <= EACH_SIDE);
    const own = {};
    let n = 0;
    for (const r of near) {
      try {
        const pk = await getJson(`/entry/${r.entry}/event/${currentGw}/picks/`);
        (pk.picks || []).forEach(x => { own[x.element] = (own[x.element] || 0) + 1; });
        n++;
      } catch { /* a missing team is skipped */ }
      await wait(GAP_MS);
    }
    if (!n) throw new Error("no neighbour picks");
    await mkdir(FEEDS_DIR(), { recursive: true });
    const body = { gw: currentGw, rank, n, from: rank - EACH_SIDE, to: rank + EACH_SIDE, own, builtAt: new Date().toISOString() };
    await writeFile(FILE() + ".tmp", JSON.stringify(body));
    await rename(FILE() + ".tmp", FILE());
    state.gw = currentGw; state.lastOk = body.builtAt; state.error = null;
    log("neighbours", `ok gw=${currentGw} rank=${rank} n=${n}`, Date.now() - t0);
  } catch (e) {
    state.error = e.message;
    log("neighbours", "fail " + e.message, Date.now() - t0);
  }
}
export function neighboursStatus() { return { ...state }; }
