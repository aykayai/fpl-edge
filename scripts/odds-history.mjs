#!/usr/bin/env node
/* Odds history for the backtest (19 Oct 2026). Pulls the closing prices of
   every Premier League match played this season from odds-api.io's
   historical endpoints, for the account's selected bookmakers, into
   STATE_DIR/odds-history/<eventId>.json (one file a match, never refetched).
   Run inside the server container, where ODDS_API_KEY lives:
     docker exec fpl-signals node scripts/odds-history.mjs 2026-08-14
   The key is never printed or written. Requests are paced to stay well
   inside the hourly limit. */
import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

const KEY = process.env.ODDS_API_KEY;
const BASE = process.env.ODDS_API_BASE || "https://api.odds-api.io/v3";
const DIR = join(process.env.STATE_DIR || "./state", "odds-history");
const FROM = process.argv[2] || "2026-08-14";
if (!KEY) { console.error("ODDS_API_KEY is not set"); process.exit(2); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const scrub = s => String(s).split(KEY).join("[key]");
async function get(p) {
  const r = await fetch(BASE + p + (p.includes("?") ? "&" : "?") + "apiKey=" + encodeURIComponent(KEY));
  const t = await r.text();
  if (!r.ok) throw new Error(scrub(`HTTP ${r.status} ${t.slice(0, 160)}`));
  return JSON.parse(t);
}

await mkdir(DIR, { recursive: true });
const sel = await get("/bookmakers/selected");
const books = (sel.bookmakers || []).join(",");
const events = [];
/* the events endpoint allows 31 days a call */
for (let t = Date.parse(FROM + "T00:00:00Z"); t < Date.now(); t += 30 * 86400000) {
  const to = new Date(Math.min(t + 30 * 86400000, Date.now())).toISOString();
  const j = await get(`/historical/events?sport=football&league=england-premier-league&from=${new Date(t).toISOString()}&to=${to}`);
  events.push(...(Array.isArray(j) ? j : (j.data || j.events || [])));
  await sleep(1500);
}
const played = [...new Map(events.map(e => [e.id, e])).values()].filter(e => Date.parse(e.date) < Date.now() - 3 * 3600000);
console.log(`books: ${books}; ${played.length} played matches since ${FROM}`);
let got = 0, had = 0, failed = 0;
for (const e of played) {
  const f = join(DIR, e.id + ".json");
  try { await access(f); had++; continue; } catch { /* not fetched yet */ }
  try {
    const o = await get(`/historical/odds?eventId=${e.id}&bookmakers=${encodeURIComponent(books)}`);
    await writeFile(f, JSON.stringify({ event: e, books, fetchedAt: new Date().toISOString(), odds: o }));
    got++;
  } catch (err) { failed++; console.log(`  ${e.home} v ${e.away}: ${err.message}`); }
  await sleep(1500);
}
console.log(`fetched ${got}, already had ${had}, failed ${failed}`);
