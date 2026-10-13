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
       team.gw rows for the owner also carry the official per-week history:
       picks [{id,pos,multiplier,isC,isVC}], autoSubs [{out,in}], chip,
       chipLabel, totalPoints, ftAvailable (into this week) and ftNext (the
       reconciled free transfers into the next week). All additive.
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
/* Written by scripts/snapshot-predictions.mjs before each round kicks off.
   Read-only here: this job never writes it. */
const PRED_IN = process.env.FPL_PRED_OUT || "data/predictions.json";
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
/* Bump whenever the logic behind a CACHED field changes (captainId, captainPts,
   transferDiff, picks). Settled weeks are otherwise reused verbatim, so a
   correctness fix would never reach them and would silently depend on someone
   remembering to tick rebuild_all. A mismatch here discards the cache and
   rebuilds everything once, automatically.
   2 — transferDiff nulled on Wildcard and Free Hit weeks.
   3 - picks carry position, captain and vice flags; automatic subs cached. */
const LOGIC_VERSION = 3;

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

/* Free transfer rules, as verified against the observed transferCost of seven
   managers over five gameweeks (28 of 28 observations consistent):
     - GW1 has unlimited transfers, so nothing is banked and GW2 always
       starts at exactly 1.
     - A Wildcard or Free Hit week carries the bank forward UNCHANGED. The
       transfers are free, and no weekly free transfer is added either.
     - Otherwise one is added each week, capped.
   transferCost is the ground truth: a hit means transfers exceeded the free
   allowance, so ft = transfers - cost/4. That reconciliation runs below and
   overrides the rule when the two disagree, which keeps the feed correct even
   if FPL changes the rules again. */
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
  let ft = null; // GW1: unlimited transfers before the deadline

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
      ftAvailable: ft                          // before this week's transfers; null in GW1
    };

    const chip = chipAt.get(gw);
    const onFreeSquadChip = chip && FREE_SQUAD_CHIPS.has(chip.name);

    /* Reconcile against the hit actually charged. A cost means the free
       allowance was exceeded, which pins the real figure exactly. */
    if (ft != null && row.transferCost > 0) {
      const implied = row.transfers - row.transferCost / 4;
      if (implied >= 0 && implied !== ft) {
        console.warn(`  entry ${entryId} GW${gw}: ft rule said ${ft}, hit implies ${implied} — using ${implied}`);
        ft = implied;
        row.ftAvailable = implied;
      }
    }

    if (gw === 1) ft = 1;                       // GW2 always starts at one
    else if (onFreeSquadChip) { /* bank carries, and no weekly one is added */ }
    else ft = Math.min(FT_MAX, Math.max(0, ft - row.transfers) + 1);

    /* The reconciled count carried INTO the next gameweek. This is the number
       the app's header shows as official, so it is published rather than
       recomputed client-side from rules the client cannot verify. */
    row.ftNext = ft;

    /* Settled weeks are reused from the previous run; the current and previous
       week are refetched because bonus points and auto-subs are still moving. */
    const cached = cache.get(gw);
    const settled = !REBUILD_ALL && cached && cached.picks?.length && gw <= lastEvent - REFETCH_LAST;

    if (settled) {
      row.captainId = cached.captainId;
      row.captainPts = cached.captainPts;
      row.transferDiff = cached.transferDiff;
      row.picks = cached.picks;
      if (cached.autoSubs?.length) row.autoSubs = cached.autoSubs;
    } else if (pts) {
      const picks = await getJson(`/entry/${entryId}/event/${gw}/picks/`, {
        attempts: 3,
        quiet: true
      });
      const squad = picks?.picks || [];
      if (squad.length) {
        /* Position 1-11 is the picked XI in formation order, 12-15 the bench
           in substitution order. isC/isVC are the picked armbands; an auto
           vice-captain takeover still shows up through the multiplier. */
        row.picks = squad.map(p => ({
          id: p.element, multiplier: p.multiplier, pos: p.position,
          isC: !!p.is_captain, isVC: !!p.is_vice_captain
        }));

        /* The automatic substitutions the API applied once the week settled,
           so the published line-up matches what actually scored. */
        const asubs = picks?.automatic_subs || [];
        if (asubs.length) row.autoSubs = asubs.map(s => ({ out: s.element_out, in: s.element_in }));

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
         points in, less points out, less the hit paid for them.
         Meaningless on a Wildcard or Free Hit, where the whole squad turns
         over and the API reports event_transfers as 0 while the transfers
         endpoint still lists every move. The chip uplift covers those weeks,
         so this is left null rather than reporting a number against a
         transfer count of zero. */
      const moves = onFreeSquadChip ? [] : (byGw.get(gw) || []);
      if (onFreeSquadChip) {
        row.transferDiff = null;
      } else if (moves.length) {
        const gained = moves.reduce((s, t) => s + (pts.get(t.element_in) ?? 0), 0);
        const lost = moves.reduce((s, t) => s + (pts.get(t.element_out) ?? 0), 0);
        row.transferDiff = gained - lost - row.transferCost;
      } else {
        row.transferDiff = 0;
      }
      await sleep(250);
    }

    /* Applied after the cache branch on purpose. Whether a week was a Wildcard
       or Free Hit is known from the chip record, which is fetched every run, so
       this correctness rule needs no picks and no live data and must not be
       gated behind the pick cache. */
    if (onFreeSquadChip) row.transferDiff = null;

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

  return { history, rows, chips: withUplift, transfers: transfers || [] };
}

/* D13 (13 Oct 2026): what the manager actually paid for each player he owns,
   so the app's selling prices follow FPL's rule (paid + half the rise, rounded
   down) instead of assuming everyone was bought at the season-start price.
   The owned squad is the latest non-Free-Hit week's picks (a Free Hit squad
   reverts). For each player, the latest transfer in outside a Free Hit week
   gives the price; a player never transferred in was in the GW1 squad and
   cost his start price. */
function purchasePrices(own, elements) {
  const fhWeeks = new Set(own.chips.filter(c => c.name === "freehit").map(c => c.event));
  const base = [...own.rows].reverse().find(r => r.picks?.length && !fhWeeks.has(r.event));
  if (!base) return null;
  const el = new Map((elements || []).map(e => [e.id, e]));
  const out = {};
  for (const pk of base.picks) {
    const t = own.transfers
      .filter(x => x.element_in === pk.id && !fhWeeks.has(x.event))
      .sort((a, b) => (b.event - a.event) || String(b.time || "").localeCompare(String(a.time || "")))[0];
    if (t) { out[pk.id] = { paid: r1(t.element_in_cost / 10), from: "transfer", event: t.event }; continue; }
    const e = el.get(pk.id);
    if (e) out[pk.id] = { paid: r1((e.now_cost - (e.cost_change_start || 0)) / 10), from: "start" };
  }
  return { asOf: base.event, players: out };
}

/* ---- free-transfer self-check ---------------------------------------------
   Recomputes the whole trajectory straight from the entry's history (transfer
   counts, hit costs and chip events; nothing read back from the rows being
   checked except the published numbers themselves) and logs a line whenever
   the published ftAvailable/ftNext disagree, or the official hit charged does
   not match what the reconstructed allowance says it should have been. */
function ftSelfCheck(own) {
  const chipAt = new Map((own.history.chips || []).map(c => [c.event, c.name]));
  let ft = null, bad = 0, checked = 0;
  for (const h of own.history.current || []) {
    const gw = h.event;
    const tr = h.event_transfers ?? 0, cost = h.event_transfers_cost ?? 0;
    const free = FREE_SQUAD_CHIPS.has(chipAt.get(gw));
    if (ft != null && cost > 0) {
      const implied = tr - cost / 4;
      if (implied >= 0 && implied !== ft) ft = implied;
    }
    const row = own.rows.find(r => r.event === gw);
    checked++;
    if (row && (row.ftAvailable ?? null) !== (ft ?? null)) {
      bad++; console.warn(`  ft self-check: GW${gw} ftAvailable ${row.ftAvailable} != recomputed ${ft}`);
    }
    if (ft != null && gw > 1 && !free) {
      const expCost = Math.max(0, tr - ft) * 4;
      if (expCost !== cost) {
        bad++; console.warn(`  ft self-check: GW${gw} allowance ${ft} with ${tr} transfers implies a ${expCost} hit, API charged ${cost}`);
      }
    }
    if (gw === 1) ft = 1;
    else if (free) { /* bank carried unchanged */ }
    else ft = Math.min(FT_MAX, Math.max(0, ft - tr) + 1);
    if (row && row.ftNext != null && row.ftNext !== ft) {
      bad++; console.warn(`  ft self-check: GW${gw} ftNext ${row.ftNext} != recomputed ${ft}`);
    }
  }
  console.log(bad
    ? `  ft self-check: ${bad} inconsistencies across ${checked} gameweeks`
    : `  ft self-check: consistent across ${checked} gameweeks`);
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
  /* F106 (bundle 10): a fixed order (rank, then entry id), so the API
     returning tied entries in a different order is not a change */
  members.sort((a, b) => ((a.rank ?? 1e9) - (b.rank ?? 1e9)) || a.entryId.localeCompare(b.entryId));

  if (table.length) {
    const ids = new Set(members.map(m => m.entryId));
    const missing = LEAGUE_FALLBACK.filter(id => !ids.has(id));
    if (missing.length) {
      console.warn(`  note: expected entries not in league standings: ${missing.join(", ")}`);
    }
  }

  /* ---- build every manager ----------------------------------------------- */
  let prevRivals = await readJson(RIVALS_OUT);
  if (prevRivals && prevRivals.logicVersion !== LOGIC_VERSION) {
    console.log(`  cache logic v${prevRivals.logicVersion ?? "none"} != v${LOGIC_VERSION} — rebuilding every gameweek once`);
    prevRivals = null;
  }
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
  ftSelfCheck(own);

  /* Per-week history for the owner's own entry. Everything here is ADDITIVE
     to the old shape (the GitHub Pages app ignores unknown fields): the
     official picks with armbands, the auto subs, the chip played, the week's
     running total, and the reconciled free-transfer counts (ftAvailable into
     this week, ftNext into the following week). This is what lets the planner
     show the real line-up, formation and transfers for a finished week. */
  const ownChipAt = new Map(own.chips.map(c => [c.event, c]));
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
    if (r.totalPoints != null) row.totalPoints = r.totalPoints;
    if (r.picks?.length) row.picks = r.picks;
    if (r.autoSubs?.length) row.autoSubs = r.autoSubs;
    if (r.ftAvailable != null) row.ftAvailable = r.ftAvailable;
    if (r.ftNext != null) row.ftNext = r.ftNext;
    const chip = ownChipAt.get(r.event);
    if (chip) { row.chip = chip.name; row.chipLabel = chip.label; }
    /* F55: a week in play is published with partial points; these flags let
       the app call its score "so far" until FPL marks the week finished. */
    const ev = events.find(e => e.id === r.event);
    if (ev) { row.finished = !!ev.finished; row.dataChecked = !!ev.data_checked; }
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

  /* Fold in what was predicted before each deadline, where a snapshot exists.
     Absent for any gameweek snapshotted before the job was introduced, and the
     UI renders "—" for a missing value. */
  const preds = await readJson(PRED_IN);
  let predCount = 0;
  if (preds?.gw) {
    for (const g of teamGw) {
      const p = preds.gw[g.event];
      if (p && p.squad != null) { g.predicted = p.squad; predCount++; }
      /* snapshots taken before the deadline cannot see the picks; the squad
         figure is the official picks (with their multipliers) against the
         per-player projections recorded before the deadline */
      else if (p && p.players && g.picks?.length) {
        g.predicted = Math.round(g.picks.reduce((s, k) => s + (p.players[k.id] ?? 0) * (k.multiplier || 0), 0) * 100) / 100;
        predCount++;
      }
    }
  }

  const actuals = {
    season: SEASON,
    team: { totalPlayers, gw: teamGw, chips: chipsMap, purchase: purchasePrices(own, bootstrap.elements) },
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
        picks: r.picks || [],
        /* additive: lets the pick cache round-trip the applied auto subs */
        ...(r.autoSubs?.length ? { autoSubs: r.autoSubs } : {})
      })),
      chips: res.chips
    };
  }

  const rivals = {
    season: SEASON,
    leagueId: LEAGUE_ID,
    logicVersion: LOGIC_VERSION,
    leagueName: league?.league?.name ?? null,
    lastEvent,
    updated: new Date().toISOString(),
    standings: members,
    entries
  };

  /* `updated` moves every run, which would commit the file four times a day
     even when nothing changed. Keep the previous timestamp when the substance
     is identical so the diff stays empty. */
  const stripped = o => JSON.stringify({ ...o, updated: null, logicVersion: null });
  if (prevRivals && stripped(prevRivals) === stripped(rivals)) {
    rivals.updated = prevRivals.updated;
    console.log("Rivals unchanged — keeping previous timestamp.");
  }

  /* ---- write ------------------------------------------------------------- */
  for (const [path, payload, note] of [
    [OUT, actuals, `${teamGw.length} gameweeks (${predCount} with predictions), ${Object.keys(players).length} players`],
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
