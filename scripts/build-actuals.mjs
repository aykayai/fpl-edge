#!/usr/bin/env node
/* FPL Edge — live actuals and rivals feeds.
   Builds data/actuals.json and data/rivals.json from the official FPL API.
   Run by .github/workflows/actuals.yml on a schedule; safe to run by hand.

   Both feeds come out of one process on purpose. The per-gameweek live scores
   are the expensive fetch, and every rival's captain points and transfer
   difference are derived from them, so a second script would double the API
   load to compute the same numbers twice.

   Contracts:
     actuals.json  { season, team:{ totalPlayers, gw[], chips{} }, players{} }
     rivals.json   { season, leagueId, leagueName, lastEvent, updated,
                     standings[], entries{} }

   Everything is best-effort: a field that cannot be derived is omitted rather
   than guessed, because the UI renders "—" for a missing value but would
   render a wrong number as fact. */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const API = "https://fantasy.premierleague.com/api";
const ENTRY_ID = String(process.env.FPL_ENTRY_ID || "301830");
const SEASON = process.env.FPL_SEASON || "2027";
const OUT = process.env.FPL_OUT || "data/actuals.json";
const RIVALS_OUT = process.env.FPL_RIVALS_OUT || "data/rivals.json";
const LEAGUE_ID = String(process.env.FPL_LEAGUE_ID || "391690");

/* Fallback roster, used only if the standings fetch fails. The league itself
   is the real source of membership — managers can join or leave. */
const LEAGUE_FALLBACK = [
  "301830", "1211068", "2028894", "2696963", "4000342", "1132821", "3600000"
];

/* Picks are the only per-entry cost that scales with gameweeks: seven managers
   across a full season is a few hundred requests a run. Settled weeks are
   therefore reused from the previous rivals.json and only the current and
   preceding gameweek refetched. Set FPL_REBUILD_ALL=1 to force a full rebuild
   after a logic change. */
const REBUILD_ALL = process.env.FPL_REBUILD_ALL === "1";
const REFETCH_LAST = 2;

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
const FREE_SQUAD_CHIPS = new Set(["wildcard", "freehit"]);

/* Free transfer rules: one a week, banked up to five, and a Wildcard or Free
   Hit week makes its transfers free without spending the bank. */
const FT_MAX = 5;

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

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
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

/* ---- chip labelling ------------------------------------------------------ */
function labelChips(chips) {
  const seen = {};
  return (chips || [])
    .slice()
    .sort((a, b) => a.event - b.event)
    .map(c => {
      const base = CHIP_LABELS[c.name] || c.name;
      seen[c.name] = (seen[c.name] || 0) + 1;
      return {
        name: c.name,
        label: UNNUMBERED_CHIPS.has(c.name) ? base : `${base} ${seen[c.name]}`,
        event: c.event
      };
    });
}

/* ---- one manager's season ------------------------------------------------
   Returns rich rows; each feed projects the fields it needs. gwPoints is the
   shared live-score map, so nothing is fetched here beyond history, transfers
   and picks. */
async function buildEntry(entryId, gwPoints, cachedRows, lastEvent) {
  const [history, transfers] = await Promise.all([
    getJson(`/entry/${entryId}/history/`, { attempts: 3, quiet: true }),
    getJson(`/entry/${entryId}/transfers/`, { attempts: 3, quiet: true })
  ]);
  if (!history) {
    console.warn(`  entry ${entryId}: history unavailable, skipped`);
    return null;
  }

  const byGw = new Map();
  for (const t of transfers || []) {
    if (!byGw.has(t.event)) byGw.set(t.event, []);
    byGw.get(t.event).push(t);
  }

  const chips = labelChips(history.chips);
  const chipAt = new Map(chips.map(c => [c.event, c]));
  const cache = new Map((cachedRows || []).map(r => [r.event, r]));

  const rows = [];
  let ft = 1; // GW1 starts with one free transfer

  for (const h of history.current || []) {
    const gw = h.event;
    const pts = gwPoints.get(gw);

    const row = {
      event: gw,
      points: h.points,                       // passed through verbatim
      totalPoints: h.total_points ?? null,
      gwRank: h.rank ?? null,
      overallRank: h.overall_rank ?? null,
      bank: r1((h.bank ?? 0) / 10),           // millions, e.g. 100.5
      value: r1((h.value ?? 0) / 10),
      transfers: h.event_transfers ?? 0,
      transferCost: h.event_transfers_cost ?? 0,
      bench: h.points_on_bench ?? 0,
      ftAvailable: ft                          // before this week's transfers
    };

    /* The free transfer bank rolls forward. A Wildcard or Free Hit week makes
       its transfers free, so the bank is untouched rather than spent. */
    const chip = chipAt.get(gw);
    const spent = chip && FREE_SQUAD_CHIPS.has(chip.name) ? 0 : row.transfers;
    ft = Math.min(FT_MAX, Math.max(0, ft - spent) + 1);

    /* Settled weeks are reused from the previous run; the current and previous
       week are refetched because bonus points and auto-subs are still moving. */
    const cached = cache.get(gw);
    const settled = !REBUILD_ALL && cached && cached.picks?.length && gw <= lastEvent - REFETCH_LAST;

    if (settled) {
      row.captainId = cached.captainId;
      row.captainPts = cached.captainPts;
      row.transferDiff = cached.transferDiff;
      row.picks = cached.picks;
    } else if (pts) {
      const picks = await getJson(`/entry/${entryId}/event/${gw}/picks/`, {
        attempts: 3,
        quiet: true
      });
      const squad = picks?.picks || [];
      if (squad.length) {
        row.picks = squad.map(p => ({ id: p.element, multiplier: p.multiplier }));

        /* Captain: the pick carrying the highest multiplier, which is how the
           endpoint reports an auto vice-captain takeover. Points are already
           multiplied, so a tripled 12 reads as 36. */
        const cap = squad.reduce(
          (best, p) => (p.multiplier > (best?.multiplier ?? 1) ? p : best),
          null
        );
        if (cap) {
          row.captainId = cap.element;
          row.captainPts = (pts.get(cap.element) ?? 0) * cap.multiplier;
        }
      }

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

    rows.push(row);
  }

  /* ---- what each chip was worth -----------------------------------------
     Bench Boost and Triple Captain are exact. Wildcard and Free Hit are a
     counterfactual — the previous squad replayed against this week's scores —
     so they are approximate, and omitted outright when the previous week's
     picks are unavailable rather than reported as zero. Auto-substitutions are
     not modelled, which flatters the old squad if it had non-playing starters,
     making the uplift read slightly low. */
  const withUplift = chips.map(c => {
    const row = rows.find(r => r.event === c.event);
    const out = { name: c.name, label: c.label, event: c.event };
    if (!row) return out;

    if (c.name === "bboost") {
      out.uplift = row.bench;
    } else if (c.name === "3xc") {
      /* the extra 1x on top of an ordinary captaincy */
      const mult = row.picks?.find(p => p.id === row.captainId)?.multiplier;
      if (row.captainPts != null && mult) out.uplift = row.captainPts / mult;
    } else if (FREE_SQUAD_CHIPS.has(c.name)) {
      const prev = rows.find(r => r.event === c.event - 1);
      const pts = gwPoints.get(c.event);
      if (prev?.picks?.length && pts) {
        const counterfactual = prev.picks
          .filter(p => p.multiplier > 0)
          .reduce((s, p) => s + (pts.get(p.id) ?? 0) * p.multiplier, 0);
        out.uplift = row.points - counterfactual;
      }
    }
    return out;
  });

  return { history, rows, chips: withUplift };
}

async function main() {
  console.log(`Building feeds for entry ${ENTRY_ID}, league ${LEAGUE_ID}, season ${SEASON}`);

  const bootstrap = await getJson("/bootstrap-static/");
  const totalPlayers = bootstrap.total_players;
  const events = bootstrap.events || [];

  /* Every gameweek that has kicked off: finished ones plus the one in play,
     so the app shows live points rather than waiting for the round to end. */
  const liveGws = events
    .filter(e => e.finished || e.is_current || e.data_checked)
    .map(e => e.id)
    .sort((a, b) => a - b);
  const lastEvent = liveGws.length ? liveGws[liveGws.length - 1] : 0;

  if (!liveGws.length) console.log("No gameweek has started yet — writing empty feeds.");

  /* ---- shared live scores ------------------------------------------------ */
  const players = {};
  const gwPoints = new Map();
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

  /* ---- league membership ------------------------------------------------- */
  const league = await getJson(
    `/leagues-classic/${LEAGUE_ID}/standings/`,
    { attempts: 3, quiet: true }
  );
  const table = league?.standings?.results || [];
  if (!table.length) {
    console.warn(`  league ${LEAGUE_ID}: standings unavailable, using fallback roster`);
  }
  const members = table.length
    ? table.map(r => ({
        entryId: String(r.entry),
        entryName: r.entry_name ?? null,
        manager: r.player_name ?? null,
        rank: r.rank ?? null,
        lastRank: r.last_rank ?? null,
        gwPoints: r.event_total ?? null,
        totalPoints: r.total ?? null
      }))
    : LEAGUE_FALLBACK.map(id => ({
        entryId: id, entryName: null, manager: null,
        rank: null, lastRank: null, gwPoints: null, totalPoints: null
      }));

  if (table.length) {
    const ids = new Set(members.map(m => m.entryId));
    const missing = LEAGUE_FALLBACK.filter(id => !ids.has(id));
    if (missing.length) {
      console.warn(`  note: expected entries not in league standings: ${missing.join(", ")}`);
    }
  }

  /* ---- build every manager ----------------------------------------------- */
  const prevRivals = await readJson(RIVALS_OUT);
  const built = new Map();
  for (const m of members) {
    const res = await buildEntry(
      m.entryId, gwPoints, prevRivals?.entries?.[m.entryId]?.gw, lastEvent
    );
    if (res) {
      built.set(m.entryId, res);
      console.log(`  entry ${m.entryId}: ${res.rows.length} gameweeks, ${res.chips.length} chips`);
    }
    await sleep(250);
  }

  /* Own entry may sit outside the league; build it if the loop missed it. */
  if (!built.has(ENTRY_ID)) {
    const res = await buildEntry(
      ENTRY_ID, gwPoints, prevRivals?.entries?.[ENTRY_ID]?.gw, lastEvent
    );
    if (res) built.set(ENTRY_ID, res);
  }

  /* ---- actuals.json ------------------------------------------------------ */
  const own = built.get(ENTRY_ID);
  if (!own) throw new Error(`entry ${ENTRY_ID} could not be built`);

  const teamGw = own.rows.map(r => {
    const row = {
      event: r.event,
      points: r.points,
      gwRank: r.gwRank,
      orRank: r.overallRank,
      bank: r.bank,
      value: r.value,
      transfers: r.transfers,
      transferCost: r.transferCost,
      bench: r.bench
    };
    if (r.captainPts != null) row.captain = r.captainPts;
    if (r.transferDiff != null) row.transferDiff = r.transferDiff;
    return row;
  });

  const chipsMap = {};
  for (const c of own.chips) {
    const row = teamGw.find(g => g.event === c.event);
    chipsMap[c.label] = row ? row.points : null;
  }

  const prevActuals = await readJson(OUT);
  const priorOff = new Map();
  for (const g of prevActuals?.team?.gw || []) {
    const keep = {};
    for (const f of Object.keys(RANK_TARGETS)) if (g[f] != null) keep[f] = g[f];
    if (Object.keys(keep).length) priorOff.set(g.event, keep);
  }

  const latest = teamGw[teamGw.length - 1];
  if (latest) {
    const yourTotal = (own.history.current || []).reduce(
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

  const actuals = {
    season: SEASON,
    team: { totalPlayers, gw: teamGw, chips: chipsMap },
    players
  };

  /* ---- rivals.json ------------------------------------------------------- */
  const entries = {};
  for (const m of members) {
    const res = built.get(m.entryId);
    if (!res) continue;
    entries[m.entryId] = {
      name: m.entryName,
      manager: m.manager,
      gw: res.rows.map(r => ({
        event: r.event,
        points: r.points,
        totalPoints: r.totalPoints,
        overallRank: r.overallRank,
        bank: r.bank,
        value: r.value,
        transfers: r.transfers,
        transferCost: r.transferCost,
        bench: r.bench,
        captainId: r.captainId ?? null,
        captainPts: r.captainPts ?? null,
        transferDiff: r.transferDiff ?? null,
        ftAvailable: r.ftAvailable,
        picks: r.picks || []
      })),
      chips: res.chips
    };
  }

  const rivals = {
    season: SEASON,
    leagueId: LEAGUE_ID,
    leagueName: league?.league?.name ?? null,
    lastEvent,
    updated: new Date().toISOString(),
    standings: members,
    entries
  };

  /* `updated` moves every run, which would commit the file four times a day
     even when nothing changed. Keep the previous timestamp when the substance
     is identical so the diff stays empty. */
  const stripped = o => JSON.stringify({ ...o, updated: null });
  if (prevRivals && stripped(prevRivals) === stripped(rivals)) {
    rivals.updated = prevRivals.updated;
    console.log("Rivals unchanged — keeping previous timestamp.");
  }

  /* ---- write ------------------------------------------------------------- */
  for (const [path, payload, note] of [
    [OUT, actuals, `${teamGw.length} gameweeks, ${Object.keys(players).length} players`],
    [RIVALS_OUT, rivals, `${Object.keys(entries).length} managers, last GW ${lastEvent}`]
  ]) {
    const json = JSON.stringify(payload);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, json + "\n");
    console.log(`Wrote ${path}: ${note}, ${(json.length / 1024).toFixed(0)} KB`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
