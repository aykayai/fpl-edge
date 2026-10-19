/* FPL Signals server - odds-api.io v3, same call chain the app makes in
   app-odds.js: look the league slug up (never guess), read the account's
   selected bookmakers (fall back to two mainstream UK books), list
   events, then /odds/multi for up to ten of them.

   The key comes from env ODDS_API_KEY only. It is never written to disk,
   never logged and never included in a response; any upstream error text
   is scrubbed of it before being stored. Cache is 4 hours. Without a key
   /api/odds answers { state: "nokey" } with HTTP 200. */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG, UA } from "./config.mjs";
import { log, fetchT } from "./util.mjs";

const DIR = () => join(CONFIG.STATE_DIR, "odds");
const CACHE = () => join(DIR(), "cache.json");

const state = { cache: null, slug: null, books: null };

function scrub(s) {
  const k = CONFIG.ODDS_API_KEY;
  let t = String(s == null ? "" : s);
  if (k) t = t.split(k).join("[key]");
  return t.replace(/apiKey=[^&\s"']+/gi, "apiKey=[key]");
}

export async function initOdds() {
  try {
    const c = JSON.parse(await readFile(CACHE(), "utf8"));
    /* the persisted cache never contains the key; rows and slug only */
    state.cache = c.cache || null;
    state.slug = c.slug || null;
    state.books = c.books || null;
  } catch { /* nothing cached yet */ }
}

async function persist() {
  await mkdir(DIR(), { recursive: true });
  await writeFile(CACHE(), JSON.stringify({ cache: state.cache, slug: state.slug, books: state.books }));
}

async function get(path) {
  const r = await fetchT(CONFIG.ODDS_API_BASE + path, { headers: { "User-Agent": UA } }, 25000);
  if (!r.ok) {
    let why = "";
    try { const e = await r.json(); why = e.message || e.error || ""; } catch { /* no body */ }
    throw new Error(scrub(`HTTP ${r.status}${why ? " " + why : ""}`));
  }
  return r.json();
}

/* League scoring lifted from app-odds.js: reject amateur/regional/youth
   competitions and require the actual Premier League. */
function pickLeague(leagues) {
  const BAD = /amateur|women|u1[6-9]|u2[0-3]|youth|reserve|northern|southern|isthmian|county|regional|division\s*[a-z0-9]|cup|friendly|qualif/i;
  const score = l => {
    const name = String(l.name || l.title || "");
    const slug = String(l.slug || l.id || l.key || "");
    const hay = `${name} ${slug} ${l.country || ""}`;
    if (BAD.test(hay)) return -1;
    let sc = 0;
    if (/^(england[- ])?premier league$/i.test(name.trim())) sc += 10;
    if (/^england-premier-league$|^epl$/i.test(slug)) sc += 10;
    if (/premier league/i.test(name)) sc += 3;
    if (/england|english/i.test(hay)) sc += 3;
    if (/^premier league$/i.test(name.trim())) sc += 4;
    return sc;
  };
  const ranked = leagues.map(l => ({ l, sc: score(l) })).filter(x => x.sc >= 6)
    .sort((a, b) => b.sc - a.sc);
  return ranked.length ? ranked[0].l : null;
}

export async function refreshOdds() {
  if (!CONFIG.ODDS_API_KEY) return;
  const t0 = Date.now();
  const key = encodeURIComponent(CONFIG.ODDS_API_KEY);
  try {
    if (!state.slug) {
      const lj = await get(`/leagues?sport=football&apiKey=${key}`);
      const leagues = Array.isArray(lj) ? lj : (lj.data || lj.leagues || []);
      const hit = pickLeague(leagues);
      if (!hit) throw new Error(`no Premier League among ${leagues.length} leagues`);
      state.slug = hit.slug || hit.id || hit.key;
    }
    if (!state.books || !state.books.length) {
      let books = [];
      try {
        const bj = await get(`/bookmakers/selected?apiKey=${key}`);
        const list = bj ? (Array.isArray(bj) ? bj : (bj.data || bj.bookmakers || [])) : [];
        books = list.map(b => (typeof b === "string" ? b : (b.name || b.key || b.id))).filter(Boolean);
      } catch { /* fall back below */ }
      state.books = books.length ? books : ["Bet365", "PaddyPower"];
    }
    const ej = await get(`/events?sport=football&league=${encodeURIComponent(state.slug)}&apiKey=${key}`);
    /* 19 Oct 2026: matches not yet kicked off, soonest first, up to 20 (a
       full gameweek plus any left over from the current one). It used to
       take the first 10 the API listed, which mixed weeks and left two of
       GW8's fixtures without prices. /odds/multi takes ten ids a call. */
    const now = Date.now();
    const events = (Array.isArray(ej) ? ej : (ej.data || ej.events || []))
      .filter(e => { const t = Date.parse(e.date || e.commence || e.startTime || ""); return !Number.isFinite(t) || t > now; })
      .sort((a, b) => Date.parse(a.date || a.commence || 0) - Date.parse(b.date || b.commence || 0))
      .slice(0, 20);
    const rows = [];
    const raw = [];
    if (events.length) {
      const ids = events.map(e => e.id || e.eventId).filter(Boolean);
      const bParam = "&bookmakers=" + encodeURIComponent(state.books.join(","));
      for (let i = 0; i < ids.length; i += 10) {
        const oj = await get(`/odds/multi?eventIds=${encodeURIComponent(ids.slice(i, i + 10).join(","))}${bParam}&apiKey=${key}`);
        raw.push(...(Array.isArray(oj) ? oj : (oj.data || Object.values(oj || {}))));
      }
      raw.forEach(rw => {
        const id = rw.eventId || rw.id;
        const ev = events.find(e => String(e.id || e.eventId) === String(id)) || {};
        if (!rw || typeof rw.bookmakers !== "object") return;
        rows.push({
          home: rw.home || ev.home || null,
          away: rw.away || ev.away || null,
          commence: rw.date || ev.date || null,
          bookmakers: rw.bookmakers
        });
      });
    }
    state.cache = {
      state: rows.length ? "ok" : "empty",
      fetchedAt: new Date().toISOString(),
      rows
    };
    await persist();
    log("odds", `ok ${rows.length} fixtures`, Date.now() - t0);
  } catch (e) {
    const msg = scrub(e.message);
    /* keep the last good rows; record the failure */
    state.cache = state.cache
      ? { ...state.cache, error: msg }
      : { state: "fail", fetchedAt: new Date().toISOString(), rows: [], error: msg };
    await persist().catch(() => {});
    log("odds", "fail " + msg, Date.now() - t0);
  }
}

export function oddsPayload() {
  if (!CONFIG.ODDS_API_KEY) return { state: "nokey" };
  if (!state.cache) return { state: "loading" };
  return state.cache;
}

export function oddsStatus() {
  if (!CONFIG.ODDS_API_KEY) return { state: "nokey", fetchedAt: null };
  return { state: state.cache?.state || "loading", fetchedAt: state.cache?.fetchedAt || null };
}
