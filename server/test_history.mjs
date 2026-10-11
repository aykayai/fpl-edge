#!/usr/bin/env node
/* FPL Signals - owner history check. Run: node server/test_history.mjs
   Needs network (the official FPL API) and built feeds.

   Independent proof that the feed's per-gameweek history for the owner's
   entry is exactly what the official API says. For EVERY finished gameweek
   it fetches /entry/{id}/history/, /entry/{id}/event/{gw}/picks/ and
   /event/{gw}/live/ directly - nothing shared with the builder - and asserts:
     - the stored picks match the API's ids, order, positions, multipliers
       and captain/vice flags exactly, and the auto subs match
     - the captain is the API's captain, and the formation derived from the
       feed's picks equals the formation derived from the API's picks
     - points, totalPoints, transfers, transferCost, bench, bank and value
       match the entry history
     - the picks actually account for the score: sum of multiplier x live
       points over all 15 equals the week's points
     - ftAvailable and ftNext match an independent recomputation of the
       official free-transfer rules (start 1 at GW2, +1 a week capped at 5,
       Wildcard/Free Hit weeks carry the bank unchanged, and a charged hit
       pins the real allowance at transfers - cost/4)
     - the chip stored for the week matches the API's chip record

   Feed locations come from the same env names the builder takes:
   FPL_OUT (default data/actuals.json), FPL_RIVALS_OUT (data/rivals.json),
   FPL_ENTRY_ID (301830). */

import { readFile } from "node:fs/promises";

const API = "https://fantasy.premierleague.com/api";
const ENTRY_ID = String(process.env.FPL_ENTRY_ID || "301830");
const ACTUALS = process.env.FPL_OUT || "data/actuals.json";
const RIVALS = process.env.FPL_RIVALS_OUT || "data/rivals.json";
const UA = "Mozilla/5.0 (compatible; fpl-signals-history-check/1.0)";
const FREE_SQUAD_CHIPS = new Set(["wildcard", "freehit"]);
const r1 = n => Math.round(n * 10) / 10;
const sleep = ms => new Promise(r => setTimeout(r, ms));

let fails = 0;
function expect(gw, name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { fails++; console.log(`FAIL  GW${gw} ${name}: feed ${g} vs API ${w}`); return false; }
  return true;
}

async function getJson(path) {
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(API + path, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (e) { if (i === 3) throw new Error(path + " failed: " + e.message); await sleep(1200 * (i + 1)); }
  }
}

const actuals = JSON.parse(await readFile(ACTUALS, "utf8"));
const rivals = JSON.parse(await readFile(RIVALS, "utf8"));
const rows = actuals?.team?.gw || [];
const rivalRows = rivals?.entries?.[ENTRY_ID]?.gw || [];

const bootstrap = await getJson("/bootstrap-static/");
const posOf = new Map(bootstrap.elements.map(e => [e.id, e.element_type]));
const finished = (bootstrap.events || []).filter(e => e.finished).map(e => e.id).sort((a, b) => a - b);
if (!finished.length) { console.log("No finished gameweek yet - nothing to check."); process.exit(0); }

const history = await getJson(`/entry/${ENTRY_ID}/history/`);
const histAt = new Map((history.current || []).map(h => [h.event, h]));
const chipAt = new Map((history.chips || []).map(c => [c.event, c.name]));

/* Independent free-transfer recomputation, straight off the API history. */
const ftByGw = new Map();   // gw -> { into: before this week, next: into gw+1 }
{
  let ft = null;
  for (const h of history.current || []) {
    const gw = h.event, tr = h.event_transfers ?? 0, cost = h.event_transfers_cost ?? 0;
    const free = FREE_SQUAD_CHIPS.has(chipAt.get(gw));
    if (ft != null && cost > 0) {
      const implied = tr - cost / 4;
      if (implied >= 0 && implied !== ft) ft = implied;
    }
    const into = ft;
    if (gw === 1) ft = 1;
    else if (free) { /* carried unchanged */ }
    else ft = Math.min(5, Math.max(0, ft - tr) + 1);
    ftByGw.set(gw, { into, next: ft });
  }
}

const formation = picks => {
  const c = { 2: 0, 3: 0, 4: 0 };
  picks.slice(0, 11).forEach(p => { const t = posOf.get(p.id ?? p.element); if (c[t] != null) c[t]++; });
  return `${c[2]}-${c[3]}-${c[4]}`;
};

for (const gw of finished) {
  const failsBefore = fails;
  const row = rows.find(r => r.event === gw);
  const rrow = rivalRows.find(r => r.event === gw);
  if (!row) { fails++; console.log(`FAIL  GW${gw}: no row in ${ACTUALS}`); continue; }
  const h = histAt.get(gw);
  if (!h) { fails++; console.log(`FAIL  GW${gw}: not in the API entry history`); continue; }

  const api = await getJson(`/entry/${ENTRY_ID}/event/${gw}/picks/`);
  const live = await getJson(`/event/${gw}/live/`);
  const pts = new Map(live.elements.map(e => [e.id, e.stats?.total_points ?? 0]));
  await sleep(250);

  /* picks, exactly as the API orders and flags them */
  const apiPicks = (api.picks || []).map(p => ({
    id: p.element, multiplier: p.multiplier, pos: p.position,
    isC: !!p.is_captain, isVC: !!p.is_vice_captain
  }));
  expect(gw, "picks", row.picks, apiPicks);
  const apiSubs = (api.automatic_subs || []).map(s => ({ out: s.element_out, in: s.element_in }));
  expect(gw, "autoSubs", row.autoSubs || [], apiSubs);

  /* captain and formation */
  const apiCap = apiPicks.reduce((b, p) => (p.multiplier > (b?.multiplier ?? 1) ? p : b), null);
  const feedCap = (row.picks || []).reduce((b, p) => (p.multiplier > (b?.multiplier ?? 1) ? p : b), null);
  expect(gw, "captain", feedCap?.id ?? null, apiCap?.id ?? null);
  if (rrow) expect(gw, "rivals captainId", rrow.captainId, apiCap?.id ?? null);
  const feedForm = formation(row.picks || []);
  expect(gw, "formation", feedForm, formation(apiPicks));

  /* entry history figures */
  expect(gw, "points", row.points, h.points);
  expect(gw, "totalPoints", row.totalPoints, h.total_points);
  expect(gw, "transfers", row.transfers, h.event_transfers ?? 0);
  expect(gw, "transferCost", row.transferCost, h.event_transfers_cost ?? 0);
  expect(gw, "bench", row.bench, h.points_on_bench ?? 0);
  expect(gw, "bank", row.bank, r1((h.bank ?? 0) / 10));
  expect(gw, "value", row.value, r1((h.value ?? 0) / 10));

  /* the stored picks must account for the official score */
  const acc = (row.picks || []).reduce((s, p) => s + (pts.get(p.id) ?? 0) * p.multiplier, 0);
  expect(gw, "picks x live points = points", acc, h.points);

  /* free transfers, independently recomputed */
  const ft = ftByGw.get(gw) || {};
  expect(gw, "ftAvailable", row.ftAvailable ?? null, ft.into ?? null);
  expect(gw, "ftNext", row.ftNext ?? null, ft.next ?? null);
  if (rrow) expect(gw, "rivals ftAvailable", rrow.ftAvailable ?? null, ft.into ?? null);

  /* chip */
  expect(gw, "chip", row.chip ?? null, chipAt.get(gw) ?? null);

  if (fails === failsBefore) {
    const hit = row.transferCost > 0 ? `, -${row.transferCost} hit` : "";
    console.log(`PASS  GW${gw} · picks+subs+captain ok · ${feedForm} · ${row.points} pts`
      + ` (${row.transfers} transfer${row.transfers === 1 ? "" : "s"}${hit})`
      + ` · ft ${row.ftAvailable ?? "unlimited"} in, ${row.ftNext} out`
      + (row.chip ? ` · ${row.chipLabel || row.chip}` : ""));
  }
}

if (fails) { console.log(`\n${fails} check(s) failed.`); process.exit(1); }
console.log("All history checks passed.");
