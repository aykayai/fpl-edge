/* FPL Signals server - news, fetched directly (no CORS proxies).

   Sources are the app's own FEEDS list from app-squad.js, plus
   r/FantasyPL (JSON first, RSS fallback). Everything is parsed and
   sanitised server-side into the app's item shapes:
     news   { src, title, url, time }
     reddit { src, title, url, time, score, comments, extra }
   Titles and sources become plain text, urls must be http(s), numbers
   are coerced. Each source keeps its last good copy with its age; a
   failing source stays listed in the status with its error. */

import { CONFIG, UA } from "./config.mjs";
import { log, fetchT, plainText, safeUrl, num } from "./util.mjs";

/* The exact list the page uses today (app-squad.js FEEDS). */
const DEFAULT_FEEDS = [
  ["Fantasy Football Scout", "https://www.fantasyfootballscout.co.uk/feed/"],
  ["Fantasy Football Pundit", "https://www.fantasyfootballpundit.com/feed/"],
  ["All About FPL", "https://allaboutfpl.com/feed/"],
  ["FPL Family", "https://www.fplfamily.com/feed/"],
  ["Premier League", "https://www.premierleague.com/rss/news"],
  ["BBC Football", "https://feeds.bbci.co.uk/sport/football/rss.xml"]
];

function feedList() {
  if (CONFIG.NEWS_FEEDS) {
    try { return JSON.parse(CONFIG.NEWS_FEEDS); } catch { /* fall through */ }
  }
  return DEFAULT_FEEDS;
}

/* The general sources only contribute FPL-flavoured items, same words
   the app uses (app-squad.js FPL_WORDS). */
const FPL_WORDS = ["fpl", "fantasy", "gameweek", "captain", "wildcard", "differential", "defcon",
  "price change", "bench boost", "free hit", "triple captain", "clean sheet", "predicted lineup"];
const looksFPL = t => { const l = (t || "").toLowerCase(); return FPL_WORDS.some(w => l.includes(w)); };
const GENERAL = /^(BBC Football|Premier League)$/;

/* Minimal RSS/Atom parser: item/entry blocks by regex, fields inside. */
function parseFeed(xml, src) {
  const items = [];
  const blocks = String(xml).match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];
  for (const b of blocks) {
    const pick = re => { const m = b.match(re); return m ? m[1] : ""; };
    const title = plainText(pick(/<title[^>]*>([\s\S]*?)<\/title>/i));
    let url = pick(/<link[^>]*href="([^"]+)"/i) || pick(/<link[^>]*>([\s\S]*?)<\/link>/i);
    url = safeUrl(url);
    const pd = plainText(pick(/<(?:pubDate|updated|published)[^>]*>([\s\S]*?)<\/(?:pubDate|updated|published)>/i));
    const t = pd ? Date.parse(pd) : NaN;
    if (title && url) items.push({ src, title, url, time: Number.isFinite(t) ? t : Date.now() });
    if (items.length >= 60) break;
  }
  return items;
}

/* per-source cache: { items, fetchedAt, ok, error } */
const sources = {};   // name -> cache
let lastRun = null;

async function fetchOne(name, url) {
  const t0 = Date.now();
  const prev = sources[name] || {};
  try {
    const r = await fetchT(url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, text/xml, */*" } }, 15000);
    if (!r.ok) throw new Error("HTTP " + r.status);
    let items = parseFeed(await r.text(), name);
    if (GENERAL.test(name)) items = items.filter(i => looksFPL(i.title));
    sources[name] = { items, fetchedAt: new Date().toISOString(), ok: true, error: null };
    log("news." + name.replace(/\s+/g, "_"), "ok " + items.length, Date.now() - t0);
  } catch (e) {
    /* keep the last good copy, record the failure */
    sources[name] = { items: prev.items || [], fetchedAt: prev.fetchedAt || null, ok: false, error: e.message };
    log("news." + name.replace(/\s+/g, "_"), "fail " + e.message, Date.now() - t0);
  }
}

async function fetchReddit() {
  const name = "r/FantasyPL";
  const t0 = Date.now();
  const prev = sources[name] || {};
  try {
    let items = null;
    try {
      const r = await fetchT(CONFIG.REDDIT_JSON_URL, { headers: { "User-Agent": UA, Accept: "application/json" } }, 15000);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const kids = (await r.json())?.data?.children || [];
      items = kids.map(c => c && c.data).filter(d => d && d.title).map(d => ({
        src: name,
        title: plainText(d.title),
        url: safeUrl("https://www.reddit.com" + String(d.permalink || "")),
        time: num(d.created_utc) * 1000,
        score: num(d.score),
        comments: num(d.num_comments),
        extra: plainText(d.link_flair_text || "")
      })).filter(i => i.title && i.url);
    } catch (eJson) {
      /* JSON refused: fall back to the subreddit RSS */
      const r2 = await fetchT(CONFIG.REDDIT_RSS_URL, { headers: { "User-Agent": UA } }, 15000);
      if (!r2.ok) throw new Error("json: " + eJson.message + "; rss: HTTP " + r2.status);
      items = parseFeed(await r2.text(), name).map(i => ({ ...i, score: 0, comments: 0, extra: "" }));
    }
    sources[name] = { items, fetchedAt: new Date().toISOString(), ok: true, error: null };
    log("news.reddit", "ok " + items.length, Date.now() - t0);
  } catch (e) {
    sources[name] = { items: prev.items || [], fetchedAt: prev.fetchedAt || null, ok: false, error: e.message };
    log("news.reddit", "fail " + e.message, Date.now() - t0);
  }
}

export async function refreshNews() {
  const jobs = feedList().map(([name, url]) => fetchOne(name, url));
  jobs.push(fetchReddit());
  await Promise.all(jobs);
  lastRun = new Date().toISOString();
}

export function newsPayload() {
  const news = [], reddit = [], perSource = {};
  for (const [name, c] of Object.entries(sources)) {
    perSource[name] = {
      ok: !!c.ok, fetchedAt: c.fetchedAt,
      ageMinutes: c.fetchedAt ? Math.round((Date.now() - Date.parse(c.fetchedAt)) / 60000) : null,
      count: (c.items || []).length, error: c.error || null
    };
    (c.items || []).forEach(i => (name === "r/FantasyPL" ? reddit : news).push(i));
  }
  news.sort((a, b) => b.time - a.time);
  return { fetchedAt: lastRun, news, reddit, perSource };
}

export function newsStatus() {
  const perSource = {};
  for (const [name, c] of Object.entries(sources)) {
    perSource[name] = { ok: !!c.ok, fetchedAt: c.fetchedAt, error: c.error || null };
  }
  return { fetchedAt: lastRun, perSource };
}

/* Google News per-player searches. The page knows the squad, the server
   does not, so this is one endpoint taking names: /api/player-news?names=a,b
   Each name is searched like the app does ("name" when:7d) and cached
   15 minutes per name. */
const playerCache = new Map();  // query -> { items, at }

export async function playerNews(namesParam) {
  const names = String(namesParam || "").split(",")
    .map(s => plainText(s).slice(0, 60)).filter(Boolean).slice(0, 30);
  const out = {};
  for (const name of names) {
    const hit = playerCache.get(name);
    if (hit && Date.now() - hit.at < 15 * 60000) { out[name] = hit.items; continue; }
    const t0 = Date.now();
    try {
      const q = encodeURIComponent(`"${name}" when:7d`);
      const r = await fetchT(`${CONFIG.GOOGLE_NEWS_BASE}?q=${q}&hl=en-GB&gl=GB&ceid=GB:en`,
        { headers: { "User-Agent": UA } }, 10000);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const items = parseFeed(await r.text(), name).slice(0, 10);
      playerCache.set(name, { items, at: Date.now() });
      out[name] = items;
      log("news.player", "ok " + items.length, Date.now() - t0);
    } catch (e) {
      out[name] = hit ? hit.items : [];
      log("news.player", "fail " + e.message, Date.now() - t0);
    }
  }
  return { fetchedAt: new Date().toISOString(), items: out };
}
