#!/usr/bin/env node
/* FPL Edge — live actuals feed.
   Builds data/actuals.json from the official FPL API. Run by
   .github/workflows/actuals.yml on a schedule; safe to run by hand.

   Contract (consumed by the planner, pitch cards, xFPL page and Tracker):
     { season, team: { totalPlayers, gw[], chips{} }, players{} }

   Everything here is best-effort: a field that cannot be derived is omitted
   rather than guessed, because the UI renders "—" for a missing value but
   would render a wrong number as fact. */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const API = "https://fantasy.premierleague.com/api";
const ENTRY_ID = process.env.FPL_ENTRY_ID || "301830";
const SEASON = process.env.FPL_SEASON || "2027";
const OUT = process.env.FPL_OUT || "data/actuals.json";

/* The overall league. Standings are 50 per page, so rank N sits on
   page ceil(N/50). This is the fragile part of the job — deep pages are slow
   and occasionally refuse — so each target is allowed to fail on its own. */
const OVERALL_LEAGUE = 314;
const PAGE_SIZE = 50;
const RANK_TARGETS = { off100k: 100000, off500k: 500000, off1m: 1000000 };

/* Chip labels. Two of each per season since the 25/26 rules change, numbered
   in the order they were played. The assistant manager chip is once only. */
const CHIP_LABELS = {
  wildcard: "Wild Card",
  freehit: "Free Hit",
  bboost: "Bench Boost",
  "3xc": "Triple Captain",
  manager: "Assistant Manager"
};
const UNNUMBERED_CHIPS = new Set(["manager"]);

const UA = "Mozilla/5.0 (compatible; fpl-edge-actuals/1.0; +https://aykayai.github.io/fpl-edge)";

const sleep = ms => new Promise(r => setTimeout(r, ms));
const r1 = n => Math.round(n * 10) / 10;

async function getJson(path, { attempts = 4, quiet = false } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(API + path, {
        headers: { "User-Agent": UA, Accept: "application/json" }
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await sleep(1500 * (i + 1));
    }
  }
  if (quiet) return null;
  throw new Error(path + " failed: " + lastErr.message);
}

/* ---- points off a given overall rank -------------------------------------
   Only ever computable for right now: the standings endpoint has no history,
   so a value captured this week can never be recovered later. Previously
   captured weeks are carried forward from the existing file instead. */
async function totalAtRank(rank) {
  const page = Math.ceil(rank / PAGE_SIZE);
  const data = await getJson(
    `/leagues-classic/${OVERALL_LEAGUE}/standings/?page_standings=${page}`,
    { attempts: 3, quiet: true }
  );
  const rows = data?.standings?.results;
  if (!rows || !rows.length) return null;
  const hit = rows.find(r => r.rank === rank);
  return (hit || rows[rows.length - 1]).total ?? null;
}

async function offRanks(yourTotal) {
  const out = {};
  for (const [field, rank] of Object.entries(RANK_TARGETS)) {
    try {
      const total = await totalAtRank(rank);
      if (total != null) out[field] = yourTotal - total;
      else console.warn(`  ${field}: no standings row, omitted`);
    } catch {
      console.warn(`  ${field}: fetch failed, omitted`);
    }
    await sleep(600);
  }
  return out;
}

async function main() {
  console.log(`Building ${OUT} for entry ${ENTRY_ID}, season ${SEASON}`);

  const [bootstrap, history, transfers] = await Promise.all([
    getJson("/bootstrap-static/"),
    getJson(`/entry/${ENTRY_ID}/history/`),
    getJson(`/entry/${ENTRY_ID}/transfers/`, { attempts: 3, quiet: true })
  ]);

  const totalPlayers = bootstrap.total_players;
  const events = bootstrap.events || [];

  /* Every gameweek that has kicked off: finished ones plus the one in play,
     so the app shows live points rather than waiting for the round to end. */
  const liveGws = events
    .filter(e => e.finished || e.is_current || e.data_checked)
    .map(e => e.id)
    .sort((a, b) => a - b);

  if (!liveGws.length) {
    console.log("No gameweek has started yet — writing an empty feed.");
  }

  /* Transfers grouped by gameweek, for transferDiff. */
  const byGw = new Map();
  for (const t of transfers || []) {
    if (!byGw.has(t.event)) byGw.set(t.event, []);
    byGw.get(t.event).push(t);
  }

  const players = {};
  const gwPoints = new Map(); // gw -> Map(elementId -> points)

  for (const gw of liveGws) {
    const live = await getJson(`/event/${gw}/live/`, { attempts: 3, quiet: true });
    if (!live?.elements) {
      console.warn(`  GW${gw}: live data unavailable, skipped`);
      continue;
    }
    const map = new Map();
    for (const el of live.elements) {
      const pts = el.stats?.total_points ?? 0;
      map.set(el.id, pts);
      (players[el.id] ||= {})[gw] = pts;
    }
    gwPoints.set(gw, map);
    console.log(`  GW${gw}: ${live.elements.length} players`);
    await sleep(250);
  }

  /* ---- team, week by week ------------------------------------------------ */
  const teamGw = [];
  for (const h of history.current || []) {
    const gw = h.event;
    const pts = gwPoints.get(gw);

    const row = {
      event: gw,
      points: h.points,                       // passed through verbatim
      gwRank: h.rank ?? null,
      orRank: h.overall_rank ?? null,
      bank: r1((h.bank ?? 0) / 10),           // millions, e.g. 100.5
      value: r1((h.value ?? 0) / 10),
      transfers: h.event_transfers ?? 0,
      transferCost: h.event_transfers_cost ?? 0,
      bench: h.points_on_bench ?? 0
    };

    /* Captain: the pick carrying the highest multiplier, which is how the
       endpoint reports an auto vice-captain takeover. Points are already
       multiplied, so a tripled 12 reads as 36. */
    if (pts) {
      const picks = await getJson(`/entry/${ENTRY_ID}/event/${gw}/picks/`, {
        attempts: 3,
        quiet: true
      });
      const squad = picks?.picks || [];
      const cap = squad.reduce(
        (best, p) => (p.multiplier > (best?.multiplier ?? 1) ? p : best),
        null
      );
      if (cap) row.captain = (pts.get(cap.element) ?? 0) * cap.multiplier;

      /* transferDiff: what the week's moves were actually worth —
         points in, less points out, less the hit paid for them. */
      const moves = byGw.get(gw) || [];
      if (moves.length) {
        const gained = moves.reduce((s, t) => s + (pts.get(t.element_in) ?? 0), 0);
        const lost = moves.reduce((s, t) => s + (pts.get(t.element_out) ?? 0), 0);
        row.transferDiff = gained - lost - row.transferCost;
      } else {
        row.transferDiff = 0;
      }
      await sleep(250);
    }

    teamGw.push(row);
  }

  /* ---- chips ------------------------------------------------------------- */
  const chips = {};
  const seen = {};
  for (const c of (history.chips || []).slice().sort((a, b) => a.event - b.event)) {
    const base = CHIP_LABELS[c.name] || c.name;
    seen[c.name] = (seen[c.name] || 0) + 1;
    const label = UNNUMBERED_CHIPS.has(c.name) ? base : `${base} ${seen[c.name]}`;
    const row = teamGw.find(g => g.event === c.event);
    chips[label] = row ? row.points : null;
  }

  /* ---- points off the top ranks ------------------------------------------
     Computed for the most recent week only, then merged with whatever earlier
     weeks were captured on previous runs. */
  let previous = null;
  try {
    previous = JSON.parse(await readFile(OUT, "utf8"));
  } catch { /* first run */ }

  const priorOff = new Map();
  for (const g of previous?.team?.gw || []) {
    const keep = {};
    for (const f of Object.keys(RANK_TARGETS)) if (g[f] != null) keep[f] = g[f];
    if (Object.keys(keep).length) priorOff.set(g.event, keep);
  }

  const latest = teamGw[teamGw.length - 1];
  if (latest) {
    const yourTotal = (history.current || []).reduce(
      (s, h) => s + (h.points ?? 0) - (h.event_transfers_cost ?? 0),
      0
    );
    console.log(`Points off top ranks (total ${yourTotal}):`);
    Object.assign(latest, await offRanks(yourTotal));
  }
  for (const g of teamGw) {
    const kept = priorOff.get(g.event);
    if (kept) for (const [f, v] of Object.entries(kept)) if (g[f] == null) g[f] = v;
  }

  /* ---- write ------------------------------------------------------------- */
  const payload = {
    season: SEASON,
    team: { totalPlayers, gw: teamGw, chips },
    players
  };

  const json = JSON.stringify(payload);
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, json + "\n");
  console.log(
    `Wrote ${OUT}: ${teamGw.length} gameweeks, ` +
      `${Object.keys(players).length} players, ${(json.length / 1024).toFixed(0)} KB`
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
