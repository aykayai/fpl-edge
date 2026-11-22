/* FPL Signals server - news, fetched directly (no CORS proxies).

   Rebuilt 22 Nov 2026 for Andy's News redesign: availability news first,
   pictures where the source has them, and only free sources.

   Stories (every 15 minutes):
     - RSS feeds: Fantasy Football Scout, All About FPL, BBC Sport, The
       Guardian and Sky Sports (Premier League feeds, which carry pictures);
     - sites that dropped their own feed, read through a Google News search
       of the site: the Premier League (fixture changes and team news),
       Fantasy Football Hub (Ben Crellin's calendar), RotoWire (player
       injury and start notes) and Premier Injuries; plus a Google News
       "FPL" search.
   Social media (same cadence): the Creators' YouTube channels (RSS, with
   thumbnails), Bluesky posts from accounts that post there (public API),
   and Ben Crellin pinned: the newest story naming him (X itself has no
   free way to read posts, and Andy does not want to pay for it).

   Every item is parsed and sanitised here: titles and summaries plain
   text, urls and pictures http(s) only, numbers coerced. Each item gets a
   category and the ids of the players it names (news-tag.mjs). A source
   that fails keeps its last good copy, and its failure, with the time it
   started failing, is listed in the status. */

import { CONFIG, UA } from "./config.mjs";
import { log, fetchT, plainText, safeUrl, decodeEntities } from "./util.mjs";
import { categorise, buildIndex, tagPlayers } from "./news-tag.mjs";
import { fplNamesPayload } from "./fpl.mjs";

const gnews = (q, days = 7) => `${CONFIG.GOOGLE_NEWS_BASE}?q=${encodeURIComponent(q + " when:" + days + "d")}&hl=en-GB&gl=GB&ceid=GB:en`;

/* [name, url, rule] - rule: "all" keeps every item, "pl" keeps items about
   availability, fixtures, chips or FPL or naming a player, "named" keeps
   only items naming a Premier League player */
const DEFAULT_FEEDS = [
  ["Fantasy Football Scout", "https://www.fantasyfootballscout.co.uk/feed/", "all"],
  ["All About FPL", "https://allaboutfpl.com/feed/", "all"],
  ["BBC Sport", "https://feeds.bbci.co.uk/sport/football/premier-league/rss.xml", "pl"],
  ["The Guardian", "https://www.theguardian.com/football/premierleague/rss", "pl"],
  ["Sky Sports", "https://www.skysports.com/rss/11661", "pl"],
  ["Premier League", gnews("site:premierleague.com"), "all"],
  ["Fantasy Football Hub", gnews("site:fantasyfootballhub.co.uk"), "all"],
  ["RotoWire", gnews("site:rotowire.com"), "named"],
  ["Premier Injuries", gnews("site:premierinjuries.com"), "all"],
  ["Google News", gnews('"FPL" OR "Fantasy Premier League"'), "all"]
];
/* the Creators' channels that post (checked 22 Nov 2026) */
const YOUTUBE = [
  ["FPL Harry", "UCcPWnCj5AKC19HaySZjb25g"], ["Let's Talk FPL", "UCxeOc7eFxq37yW_Nc-69deA"],
  ["FPL BlackBox", "UCGJ8-xqhOLwyJNuPMsVoQWQ"], ["FPL Focal", "UC72QokPHXQ9r98ROfNZmaDw"],
  ["Fantasy Football Hub", "UCcqEr3DfrRwtoF2a1yW8qgQ"], ["FPL Raptor", "UC54QLWzsMifTRjNQ02z5pCw"]
];
const BLUESKY = [
  ["Fantasy Football Scout", "ffscoutfpl.bsky.social"], ["FPL Focal", "fpl.page"], ["Holly Shand", "hollyshand.bsky.social"]
];
const KEEP_MS = 8 * 86400000;

function feedList() {
  if (CONFIG.NEWS_FEEDS) {
    try { return JSON.parse(CONFIG.NEWS_FEEDS).map(f => [f[0], f[1], f[2] || "all"]); } catch { /* fall through */ }
  }
  return DEFAULT_FEEDS;
}
/* the gate points NEWS_FEEDS at a stub; social media stays off there */
const socialOn = () => !CONFIG.NEWS_FEEDS && CONFIG.NEWS_SOCIAL !== "0";

const httpsOnly = u => { const s = safeUrl(u); return /^https:\/\//.test(s) ? s : ""; };

/* Minimal RSS/Atom parser: item/entry blocks by regex, fields inside. The
   picture: media:thumbnail / media:content (the widest), an image
   enclosure, or the first <img> in the description. */
export function parseFeed(xml, src, gn) {
  const items = [];
  const blocks = String(xml).match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];
  for (const b of blocks) {
    const pick = re => { const m = b.match(re); return m ? m[1] : ""; };
    let title = plainText(pick(/<title[^>]*>([\s\S]*?)<\/title>/i));
    let url = pick(/<link[^>]*href="([^"]+)"/i) || pick(/<link[^>]*>([\s\S]*?)<\/link>/i);
    url = safeUrl(plainText(url));
    const pd = plainText(pick(/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/i));
    const t = pd ? Date.parse(pd) : NaN;
    /* an undated item no longer poses as "just now" */
    if (!title || !url || !Number.isFinite(t)) continue;
    let pub = "";
    if (gn) { const m = /^(.*\S)\s+-\s+([^-]{2,60})$/.exec(title); if (m) { title = m[1]; pub = m[2].trim(); } }
    let img = "";
    const med = [...b.matchAll(/<media:(?:thumbnail|content)\b[^>]*>/gi)].map(m => m[0])
      .filter(tag => !/medium="(video|audio)"/i.test(tag))
      .map(tag => ({ u: (/url="([^"]+)"/i.exec(tag) || [])[1], w: +((/width="(\d+)"/i.exec(tag) || [])[1] || 0) }))
      .filter(x => x.u).sort((a, b) => b.w - a.w);
    if (med.length) img = med[0].u;
    if (!img) {
      const e = /<enclosure\b[^>]*type="image[^"]*"[^>]*>/i.exec(b) || /<enclosure\b[^>]*url="[^"]+\.(?:jpe?g|png|webp)[^"]*"[^>]*>/i.exec(b);
      if (e) img = (/url="([^"]+)"/i.exec(e[0]) || [])[1] || "";
    }
    const descRaw = pick(/<description[^>]*>([\s\S]*?)<\/description>/i) || pick(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i) || pick(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
    if (!img && descRaw) { const d = decodeEntities(descRaw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")); const m = /<img[^>]+src="([^"]+)"/i.exec(d); if (m) img = m[1]; }
    let sum = gn ? "" : plainText(descRaw).replace(/\s*The post .{0,200}? appeared first on .*$/i, "").trim();
    if (sum.length > 260) sum = sum.slice(0, 257).replace(/\s+\S*$/, "") + "…";
    if (sum && sum.toLowerCase().startsWith(title.toLowerCase().slice(0, 40))) sum = "";
    items.push({ src, pub, title, url, time: t, img: httpsOnly(decodeEntities(img || "")), sum });
    if (items.length >= 60) break;
  }
  return items;
}

/* per-source cache: { items, fetchedAt, ok, error, failingSince, kind } */
const sources = {};
let lastRun = null;
let index = null;

function keep(name, kind, items) {
  sources[name] = { items, fetchedAt: new Date().toISOString(), ok: true, error: null, failingSince: null, kind };
}
function fail(name, kind, e) {
  const prev = sources[name] || {};
  sources[name] = { items: prev.items || [], fetchedAt: prev.fetchedAt || null, ok: false, error: e.message,
    failingSince: prev.failingSince || new Date().toISOString(), kind };
}
const enrich = i => ({ ...i, cat: categorise(i.title, i.sum), ids: tagPlayers(i.title + " " + (i.sum || ""), index) });
const AVAIL = new Set(["inj", "ret", "trf", "team", "pc", "bgw", "chip", "fpl"]);
const fresh = i => Date.now() - i.time < KEEP_MS;

async function fetchFeed([name, url, rule]) {
  const t0 = Date.now();
  try {
    const r = await fetchT(url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, text/xml, */*" } }, 15000);
    if (!r.ok) throw new Error("HTTP " + r.status);
    let items = parseFeed(await r.text(), name, url.startsWith(CONFIG.GOOGLE_NEWS_BASE)).filter(fresh).map(enrich);
    if (rule === "pl") items = items.filter(i => i.ids.length || AVAIL.has(i.cat));
    if (rule === "named") items = items.map(i => ({ ...i, ids: tagPlayers(i.title, index, null, true) })).filter(i => i.ids.length);
    keep(name, "news", items);
    log("news." + name.replace(/\s+/g, "_"), "ok " + items.length, Date.now() - t0);
  } catch (e) { fail(name, "news", e); log("news." + name.replace(/\s+/g, "_"), "fail " + e.message, Date.now() - t0); }
}
async function fetchYouTube([name, id]) {
  const key = "YouTube · " + name, t0 = Date.now();
  try {
    const r = await fetchT(`${CONFIG.YOUTUBE_FEED_BASE}?channel_id=${encodeURIComponent(id)}`, { headers: { "User-Agent": UA } }, 15000);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const items = parseFeed(await r.text(), name, false).filter(fresh).slice(0, 6)
      .map(i => enrich({ ...i, kind: "yt", sum: "", pub: "YouTube" }));
    keep(key, "social", items);
  } catch (e) { fail(key, "social", e); log("news.youtube", "fail " + name + " " + e.message, Date.now() - t0); }
}
/* FFScout's live-match posts (goals, assists, red cards, DefCon points:
   "⚽ | GOAL - McBurnie ...", "✅ | DEF CON POINTS ...") are left out (Andy,
   22 Nov 2026): they crowded out everything else */
export const matchEventPost = t => /\|\s*(GOAL|ASSIST|RED CARD)\s*-|\|\s*DEF ?CON POINTS/i.test(String(t || ""));
async function fetchBluesky([name, handle]) {
  const key = "Bluesky · " + name, t0 = Date.now();
  try {
    const r = await fetchT(`${CONFIG.BLUESKY_API_BASE}/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(handle)}&limit=25&filter=posts_no_replies`,
      { headers: { "User-Agent": UA, Accept: "application/json" } }, 15000);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const feed = ((await r.json()) || {}).feed || [];
    const items = feed.filter(x => x && !x.reason && x.post && x.post.record).map(x => {
      const p = x.post, rkey = String(p.uri || "").split("/").pop(), e = p.embed || {};
      const img = (e.images && e.images[0] && e.images[0].thumb) || (e.external && e.external.thumb)
        || (e.media && e.media.images && e.media.images[0] && e.media.images[0].thumb) || "";
      return { src: name, pub: "Bluesky", kind: "bs", title: plainText(p.record.text || "").slice(0, 300), sum: "",
        url: safeUrl(`https://bsky.app/profile/${handle}/post/${rkey}`), time: Date.parse(p.record.createdAt || p.indexedAt || ""), img: httpsOnly(img) };
    }).filter(i => i.title && !matchEventPost(i.title) && Number.isFinite(i.time) && fresh(i)).slice(0, 10).map(enrich);
    keep(key, "social", items);
  } catch (e) { fail(key, "social", e); log("news.bluesky", "fail " + name + " " + e.message, Date.now() - t0); }
}
/* Ben Crellin, pinned: the newest stories naming him (his calendar and team
   reveals on Fantasy Football Hub, his results on Fantasy Football Scout) */
async function fetchCrellin() {
  const key = "Ben Crellin", t0 = Date.now();
  try {
    const r = await fetchT(gnews('"Ben Crellin"', 30), { headers: { "User-Agent": UA } }, 15000);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const items = parseFeed(await r.text(), "Ben Crellin", true).sort((a, b) => b.time - a.time).slice(0, 3)
      .map(i => enrich({ ...i, kind: "pin" }));
    keep(key, "social", items);
  } catch (e) { fail(key, "social", e); log("news.crellin", "fail " + e.message, Date.now() - t0); }
}

export async function refreshNews() {
  try { const names = await fplNamesPayload(); if (names.length) index = buildIndex(names); } catch { /* tags wait for the next run */ }
  const jobs = feedList().map(fetchFeed);
  if (socialOn()) { YOUTUBE.forEach(c => jobs.push(fetchYouTube(c))); BLUESKY.forEach(c => jobs.push(fetchBluesky(c))); jobs.push(fetchCrellin()); }
  await Promise.all(jobs);
  lastRun = new Date().toISOString();
}

/* one copy of a story: Google News repeats what the feeds already carry,
   so it is read last */
const keyOf = t => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 70);
function sourceRow(c) {
  return { ok: !!c.ok, kind: c.kind || "news", fetchedAt: c.fetchedAt, failingSince: c.failingSince || null,
    ageMinutes: c.fetchedAt ? Math.round((Date.now() - Date.parse(c.fetchedAt)) / 60000) : null,
    count: (c.items || []).length, error: c.error || null };
}
export function newsPayload() {
  const news = [], social = [], perSource = {}, seen = new Set();
  const ordered = Object.entries(sources).sort((a, b) => (a[0] === "Google News") - (b[0] === "Google News"));
  for (const [name, c] of ordered) {
    perSource[name] = sourceRow(c);
    for (const i of c.items || []) {
      const k = (i.kind ? "s:" : "") + keyOf(i.title);
      if (seen.has(k)) continue;
      if (i.kind) { seen.add(k); social.push(i); continue; }
      seen.add(k); news.push(i);
    }
  }
  news.sort((a, b) => b.time - a.time);
  social.sort((a, b) => b.time - a.time);
  return { fetchedAt: lastRun, news, social, perSource };
}
export function newsStatus() {
  const perSource = {};
  for (const [name, c] of Object.entries(sources)) perSource[name] = sourceRow(c);
  return { fetchedAt: lastRun, perSource };
}

/* Google News per player, for the squad: /api/player-news?ids=1,2. The
   page knows the squad, the server does not. Each player is searched by
   full name over 7 days and cached 15 minutes; only stories that name him
   under the stricter rule are kept. (?names= still answers, untagged.) */
const playerCache = new Map();  // query -> { items, at }
async function searchName(q) {
  const hit = playerCache.get(q);
  if (hit && Date.now() - hit.at < 15 * 60000) return hit.items;
  const t0 = Date.now();
  try {
    const r = await fetchT(gnews(`"${q}"`), { headers: { "User-Agent": UA } }, 10000);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const items = parseFeed(await r.text(), q, true).slice(0, 12);
    playerCache.set(q, { items, at: Date.now() });
    log("news.player", "ok " + items.length, Date.now() - t0);
    return items;
  } catch (e) {
    log("news.player", "fail " + e.message, Date.now() - t0);
    return hit ? hit.items : [];
  }
}
export async function playerNews(namesParam, idsParam) {
  const out = {};
  if (idsParam) {
    const names = await fplNamesPayload().catch(() => []);
    if (!index && names.length) index = buildIndex(names);
    const byId = new Map(names.map(n => [n.id, n]));
    const ids = String(idsParam).split(",").map(x => parseInt(x, 10)).filter(x => byId.has(x)).slice(0, 30);
    await Promise.all(ids.map(async id => {
      const n = byId.get(id), only = new Set([id]);
      const items = await searchName(`${n.first} ${n.second}`.trim().slice(0, 60));
      out[id] = items.filter(i => tagPlayers(i.title, index, only).length)
        .map(i => ({ ...i, src: i.pub || "Google News", cat: categorise(i.title, i.sum), ids: tagPlayers(i.title, index) }));
    }));
    return { fetchedAt: new Date().toISOString(), items: out };
  }
  const names = String(namesParam || "").split(",").map(s => plainText(s).slice(0, 60)).filter(Boolean).slice(0, 30);
  for (const name of names) out[name] = await searchName(name);
  return { fetchedAt: new Date().toISOString(), items: out };
}
