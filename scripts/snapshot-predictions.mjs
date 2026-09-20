#!/usr/bin/env node
/* FPL Edge — pre-kickoff prediction snapshot.
   Records what the model ACTUALLY said before a gameweek was played, so
   predictions can later be scored against results.

   Why a real browser rather than a Node port of the model: a reimplementation
   would be a second copy of the calibration that can drift from the one that
   produces the projections people see. A backtest measuring a drifted copy is
   worth nothing. This loads the live site and reads the numbers the app itself
   computed.

   The window matters more than anything else here. It must run:
     AFTER  the deadline    — picks are not visible until it passes
     BEFORE the first kick  — ratings must not yet contain this round's results
   That is usually about 90 minutes. Outside it, the script writes nothing. A
   missing snapshot is recoverable; a contaminated one silently poisons every
   future calibration measurement, so refusing to write is always the right
   call. It is scheduled hourly and exits in under a second when there is
   nothing to do, so a delayed or failed run self-heals on the next hour. */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const API = "https://fantasy.premierleague.com/api";
const SITE = process.env.FPL_SITE || "https://aykayai.github.io/fpl-edge/";
const ENTRY_ID = String(process.env.FPL_ENTRY_ID || "301830");
const SEASON = process.env.FPL_SEASON || "2027";
const OUT = process.env.FPL_PRED_OUT || "data/predictions.json";
const FORCE = process.env.FPL_SNAPSHOT_FORCE === "1";
/* --check-only answers "is this hour in the window?" and stops. The workflow
   runs it first so an idle hour never pays for a browser install. */
const CHECK_ONLY = process.argv.includes("--check-only");

const UA = "Mozilla/5.0 (compatible; fpl-edge-actuals/1.0; +https://aykayai.github.io/fpl-edge)";
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJson(path, attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(API + path, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (e) { last = e; if (i < attempts - 1) await sleep(1500 * (i + 1)); }
  }
  throw new Error(path + " failed: " + last.message);
}

async function readJson(p) {
  try { return JSON.parse(await readFile(p, "utf8")); } catch { return null; }
}

async function main() {
  const now = Date.now();

  /* ---- 1. is there anything to do? (no browser yet) --------------------- */
  const bootstrap = await getJson("/bootstrap-static/");
  const ev = (bootstrap.events || []).find(e => e.is_next)
          || (bootstrap.events || []).find(e => !e.finished);
  if (!ev) { console.log("No upcoming gameweek."); return; }

  const gw = ev.id;
  const existing = await readJson(OUT);
  if (!FORCE && existing?.gw?.[gw]) {
    console.log(`GW${gw} already snapshotted (${existing.gw[gw].taken}).`);
    return;
  }

  const deadline = Date.parse(ev.deadline_time);
  const fixtures = await getJson(`/fixtures/?event=${gw}`);
  const kicks = fixtures.map(f => Date.parse(f.kickoff_time)).filter(Number.isFinite);
  if (!kicks.length) { console.log(`GW${gw}: no kickoff times yet.`); return; }
  const firstKick = Math.min(...kicks);

  const mins = ms => Math.round(ms / 60000);
  if (!FORCE && now < deadline) {
    console.log(`GW${gw}: ${mins(deadline - now)} min before deadline — picks not visible yet.`);
    return;
  }
  if (!FORCE && now >= firstKick) {
    /* Past first kick. Do not snapshot: the ratings may already carry results
       from this round, which is exactly the contamination this exists to avoid. */
    console.log(`GW${gw}: first match kicked off ${mins(now - firstKick)} min ago — refusing to snapshot.`);
    return;
  }
  console.log(`GW${gw}: in window (deadline +${mins(now - deadline)} min, kickoff in ${mins(firstKick - now)} min)`);
  if (CHECK_ONLY) return;

  /* ---- 2. the squad as actually submitted ------------------------------- */
  let picks = [];
  try {
    const p = await getJson(`/entry/${ENTRY_ID}/event/${gw}/picks/`);
    picks = (p?.picks || []).map(x => ({ id: x.element, multiplier: x.multiplier }));
  } catch {
    console.warn("  picks unavailable — squad total will be omitted");
  }

  /* ---- 3. run the real app ---------------------------------------------- */
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ userAgent: UA });
  page.on("console", m => { if (m.type() === "error") console.warn("  page error:", m.text()); });

  let snap;
  try {
    await page.goto(SITE, { waitUntil: "domcontentloaded", timeout: 60000 });

    /* A fresh profile has no cached data, and the app only builds a model on
       boot when localStorage already holds one, so the load is triggered here. */
    await page.evaluate(() => loadAll(true));
    await page.waitForFunction(() => window.S && S.model && S.ratingsReady, null,
      { timeout: 180000, polling: 1000 });

    /* Build a second time on purpose. learnFromResults() writes the learned
       calibration at the END of a build, so the first build necessarily used
       base calibration, while a returning user's browser would have applied
       the stored learning at boot. Building twice makes the snapshot reflect
       the learned state, and derives that state from the data itself rather
       than from whatever happens to sit in one person's browser, so the run is
       reproducible. This only terminates because the v11.2.1 fix removed the
       feedback loop; on the old code the two builds would not have agreed. */
    await page.evaluate(() => buildModel());
    await page.waitForFunction(() => S.model != null, null, { timeout: 60000 });

    snap = await page.evaluate(g => {
      const out = {};
      (S.model.players || []).forEach(p => {
        const cell = p.gw && p.gw[g];
        if (cell && !cell.blank) out[p.id] = Math.round(cell.pts * 100) / 100;
      });
      return {
        players: out,
        next: S.model.next ? S.model.next.id : null,
        gwPlayed: S.model.gwPlayed,
        /* what calibration was in force, so a future backtest can tell a model
           change from a genuine accuracy change */
        cal: typeof CAL === "undefined" ? null : JSON.parse(JSON.stringify(CAL)),
        learn: (typeof LS !== "undefined" && LS.get) ? LS.get("learn") : null,
        oddsUsed: !!(S.oddsKey && S.oddsMarkets)
      };
    }, gw);
  } finally {
    await browser.close();
  }

  const n = Object.keys(snap.players).length;
  if (!n) throw new Error("model produced no projections");
  if (snap.next !== gw) {
    console.warn(`  model's next gameweek is ${snap.next}, expected ${gw} — snapshotting ${gw} anyway`);
  }

  let squad = null;
  if (picks.length) {
    squad = picks.reduce((s, p) => s + (snap.players[p.id] ?? 0) * p.multiplier, 0);
    squad = Math.round(squad * 100) / 100;
  }

  /* ---- 4. merge and write ----------------------------------------------- */
  const payload = existing && existing.season === SEASON
    ? existing
    : { season: SEASON, updated: null, gw: {} };
  payload.gw[gw] = {
    taken: new Date().toISOString(),
    deadline: ev.deadline_time,
    firstKickoff: new Date(firstKick).toISOString(),
    gwPlayed: snap.gwPlayed,
    cal: snap.cal,
    learn: snap.learn || null,
    oddsUsed: snap.oddsUsed,
    squad,
    picks,
    players: snap.players
  };
  payload.updated = new Date().toISOString();

  await mkdir(dirname(OUT), { recursive: true });
  const json = JSON.stringify(payload);
  await writeFile(OUT, json + "\n");
  console.log(`Wrote ${OUT}: GW${gw}, ${n} players, squad ${squad ?? "—"}, ${(json.length / 1024).toFixed(0)} KB`);
}

main().catch(err => { console.error(err); process.exit(1); });
