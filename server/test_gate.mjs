/* FPL Signals server - gate. Run: node server/test_gate.mjs
   No network needed: a fixture state dir is built from scratch, a stub
   upstream (local http server) stands in for GitHub, the FPL API, the
   news feeds, reddit and odds-api.io, and the real server is started as
   a child process pointed at both. Prints PASS/FAIL per check and ends
   with "All checks passed." only when everything passed. */

import { createServer } from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HERE, "server.mjs");
const SEASON = "2026-2027", LAST = "2025-2026";
const GOOD_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TRUNC_SHA = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const ODDS_KEY = "TESTKEY-9f3a77-SECRETVALUE";

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + (detail ? " -- " + detail : "")); }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(name, fn, timeoutMs = 20000) {
  const end = Date.now() + timeoutMs;
  let last;
  while (Date.now() < end) {
    try { const v = await fn(); if (v) return v; last = v; } catch (e) { last = e.message; }
    await sleep(150);
  }
  throw new Error(`timeout waiting for ${name} (last: ${JSON.stringify(last)})`);
}

/* ------------- synthetic dataset generator for the stub ------------- */

function csv(header, rows) {
  return header.join(",") + "\n" + rows.map(r => r.join(",")).join("\n") + "\n";
}
function genPlayers(n) {
  const rows = [];
  for (let i = 1; i <= n; i++) rows.push([i, 1000 + i, "First" + i, "Last" + i, "P" + i, (i % 20) + 1, "MID"]);
  return csv(["player_id", "player_code", "first_name", "second_name", "web_name", "team_code", "position"], rows);
}
function genPlayerstats(n) {
  const rows = [];
  for (let i = 1; i <= n; i++) rows.push([i, 5, 55, "4.2", "a"]);
  return csv(["id", "gw", "now_cost", "form", "status"], rows);
}
function genTeams() {
  const rows = [];
  for (let i = 1; i <= 20; i++) rows.push([i, i, "Team " + i, "T" + i]);
  return csv(["id", "code", "name", "short_name"], rows);
}
function genSummaries() {
  const rows = [];
  for (let i = 1; i <= 38; i++) {
    rows.push([i, "Gameweek " + i, `2026-0${(i % 9) + 1}-01T10:00:00Z`, i <= 5 ? "True" : "False"]);
  }
  return csv(["id", "name", "deadline_time", "finished"], rows);
}
function genFixtures(gw) {
  return csv(["gameweek", "home_team", "away_team", "kickoff_time", "finished", "home_score", "away_score", "match_id"],
    [[gw, 1, 2, `2026-01-01T15:00:00Z`, gw <= 5 ? "True" : "False", gw <= 5 ? 1 : "", gw <= 5 ? 0 : "", `m${gw}-prem-1`]]);
}
const genSmall = () => csv(["id", "gw", "minutes"], [[1, 1, 90], [2, 1, 45]]);

function datasetFile(path, truncated) {
  if (path === `${SEASON}/players.csv`) return genPlayers(610);
  if (path === `${SEASON}/playerstats.csv`) {
    const full = genPlayerstats(615);
    return truncated ? full.slice(0, Math.floor(full.length * 0.45)) : full;
  }
  if (path === `${SEASON}/teams.csv`) return genTeams();
  if (path === `${SEASON}/gameweek_summaries.csv`) return genSummaries();
  let m = path.match(new RegExp(`^${SEASON}/By Gameweek/GW(\\d+)/fixtures\\.csv$`));
  if (m) return genFixtures(Number(m[1]));
  if (path === `${SEASON}/By Tournament/Friendlies/GW0/playermatchstats.csv`) return genSmall();
  if (new RegExp(`^${SEASON}/By Gameweek/GW\\d+/(playermatchstats|matches)\\.csv$`).test(path)) return genSmall();
  if (path === `${LAST}/players.csv`) return genPlayers(50);
  if (path === `${LAST}/playerstats.csv`) return genPlayerstats(50);
  if (path === `${LAST}/teams.csv`) return genTeams();
  m = path.match(new RegExp(`^${LAST}/By Gameweek/GW(\\d+)/fixtures\\.csv$`));
  if (m) return genFixtures(Number(m[1]));
  return null;
}

/* ----------------------------- stub ----------------------------- */

let mode = "good";   // good | truncated | down
const deadline = new Date(Date.now() + 2 * 24 * 3600000).toISOString().replace(/\.\d+Z$/, "Z");

const HOSTILE_RSS = `<?xml version="1.0"?><rss><channel>
<item><title>Breaking &lt;img src=x onerror=alert(1)&gt; transfer news &amp; prices</title>
<link>https://example.com/story-one</link><pubDate>Thu, 09 Oct 2026 10:00:00 GMT</pubDate></item>
<item><title>Evil link headline about the gameweek</title>
<link>javascript:alert(document.cookie)</link><pubDate>Thu, 09 Oct 2026 09:00:00 GMT</pubDate></item>
<item><title><![CDATA[Plain captain pick headline]]></title>
<link>https://example.com/story-two</link><pubDate>Thu, 09 Oct 2026 08:00:00 GMT</pubDate></item>
</channel></rss>`;

function stubHandler(req, res) {
  const u = new URL(req.url, "http://localhost");
  const p = decodeURIComponent(u.pathname);
  const json = o => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
  const text = (s, t = "text/plain") => { res.writeHead(200, { "Content-Type": t }); res.end(s); };

  if (p.startsWith("/gh/repos/")) {
    if (mode === "down") { res.writeHead(500); res.end("nope"); return; }
    const sha = mode === "truncated" ? TRUNC_SHA : GOOD_SHA;
    res.writeHead(200, { "Content-Type": "application/json", ETag: '"' + sha + '"' });
    /* a recent commit time, so the server's 12-hour staleness rule
       cannot trip during the gate run itself */
    res.end(JSON.stringify([{ sha, commit: { committer: { date: new Date(Date.now() - 3600000).toISOString() } } }]));
    return;
  }
  let m = p.match(/^\/raw\/olbauday\/FPL-Core-Insights\/([0-9a-f]{40})\/data\/(.+)$/);
  if (m) {
    const body = datasetFile(m[2], m[1] === TRUNC_SHA);
    if (body == null) { res.writeHead(404); res.end("missing"); return; }
    text(body, "text/csv");
    return;
  }
  if (p === "/fplapi/bootstrap-static/") {
    return json({
      events: [
        { id: 5, is_current: true, is_next: false, finished: true, deadline_time: "2026-10-01T10:00:00Z" },
        { id: 6, is_current: false, is_next: true, finished: false, deadline_time: deadline }
      ],
      elements: [], total_players: 11000000
    });
  }
  if (/^\/fplapi\/event\/\d+\/live\/$/.test(p)) return json({ elements: [] });
  if (p === "/feed1") return text(HOSTILE_RSS, "application/rss+xml");
  if (p === "/reddit.json") {
    return json({ data: { children: [{ data: { title: "<b>Captain</b> &lt;script&gt;alert(1)&lt;/script&gt; poll", permalink: "/r/FantasyPL/comments/abc/x/", created_utc: 1760000000, score: "12", num_comments: "7", link_flair_text: "Discussion" } }] } });
  }
  if (p.startsWith("/gnews")) return text(HOSTILE_RSS, "application/rss+xml");
  if (p === "/v3odds/leagues") return json([{ name: "Premier League", slug: "england-premier-league", country: "England" }]);
  if (p === "/v3odds/bookmakers/selected") return json(["Bet365"]);
  if (p === "/v3odds/events") return json([{ id: "e1", home: "Team 1", away: "Team 2", date: "2026-10-12T15:00:00Z" }]);
  if (p === "/v3odds/odds/multi") {
    return json([{ eventId: "e1", home: "Team 1", away: "Team 2", bookmakers: { Bet365: [{ name: "ML", odds: [{ home: "2.10", draw: "3.40", away: "3.30" }] }] } }]);
  }
  res.writeHead(404); res.end("stub: no route " + p);
}

function freePort() {
  return new Promise(r => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => { const port = s.address().port; s.close(() => r(port)); });
  });
}

/* ----------------------------- fixture state ----------------------------- */

async function buildFixture(root) {
  const cur = join(root, "dataset", "current");
  const put = async (rel, body) => {
    const f = join(cur, rel);
    await mkdir(dirname(f), { recursive: true });
    await writeFile(f, body);
  };
  await put(`${SEASON}/players.csv`, genPlayers(610));
  await put(`${SEASON}/playerstats.csv`, genPlayerstats(615));
  await put(`${SEASON}/teams.csv`, genTeams());
  await put(`${SEASON}/gameweek_summaries.csv`, genSummaries());
  for (let gw = 1; gw <= 38; gw++) {
    await put(`${SEASON}/By Gameweek/GW${gw}/fixtures.csv`, genFixtures(gw));
    await put(`${LAST}/By Gameweek/GW${gw}/fixtures.csv`, genFixtures(gw));
  }
  await put(`${SEASON}/By Tournament/Friendlies/GW0/playermatchstats.csv`, genSmall());
  await put(`${LAST}/players.csv`, genPlayers(50));
  await put(`${LAST}/playerstats.csv`, genPlayerstats(50));
  await put(`${LAST}/teams.csv`, genTeams());
  await writeFile(join(cur, ".signals-meta.json"), JSON.stringify({
    commit: "f1x7ure0000000000000000000000000000000000",
    committedAt: "2026-10-10T03:00:00Z",
    fetchedAt: "2026-10-10T03:05:00Z"
  }));
  const feeds = join(root, "feeds");
  await mkdir(feeds, { recursive: true });
  await writeFile(join(feeds, "actuals.json"), JSON.stringify({
    season: "2027", team: { totalPlayers: 11000000, gw: [{ event: 5, points: 52, orRank: 300000 }], chips: {} }, players: { 1: { 5: 6 } }
  }));
  await writeFile(join(feeds, "rivals.json"), JSON.stringify({
    season: "2027", leagueId: "391690", lastEvent: 5, updated: "2026-10-10T07:22:00Z", standings: [], entries: {}
  }));
}

/* ----------------------------- run ----------------------------- */

async function main() {
  const root = await mkdtemp(join(tmpdir(), "fpl-signals-gate-"));
  await buildFixture(root);

  const stub = createServer(stubHandler);
  await new Promise(r => stub.listen(0, "127.0.0.1", r));
  const sp = stub.address().port;
  const S = `http://127.0.0.1:${sp}`;

  const port = await freePort();
  const B = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env,
      PORT: String(port),
      STATE_DIR: root,
      ODDS_API_KEY: ODDS_KEY,
      GITHUB_API_BASE: `${S}/gh`,
      RAW_BASE: `${S}/raw`,
      FPL_API_BASE: `${S}/fplapi`,
      ODDS_API_BASE: `${S}/v3odds`,
      NEWS_FEEDS: JSON.stringify([["Hostile Feed", `${S}/feed1`]]),
      REDDIT_JSON_URL: `${S}/reddit.json`,
      GOOGLE_NEWS_BASE: `${S}/gnews`,
      SIGNALS_TICK_MS: "150",
      SIGNALS_JITTER_MS: "0",
      DATASET_POLL_MS: "300",
      FPL_POLL_MS: "300",
      NEWS_POLL_MS: "300",
      ODDS_POLL_MS: "300",
      FEEDS_POLL_MS: "0"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let childLog = "";
  child.stdout.on("data", d => { childLog += d; });
  child.stderr.on("data", d => { childLog += d; });

  const get = async (path, opts) => {
    const r = await fetch(B + path, opts);
    const body = await r.text();
    return { status: r.status, body, headers: Object.fromEntries(r.headers.entries()) };
  };
  const status = async () => JSON.parse((await get("/api/status")).body);

  try {
    /* server comes up and reports the fixture's season and gameweek */
    await waitFor("server up", async () => (await get("/api/status")).status === 200);
    let st = await status();
    check("status: fixture season", st.dataset.season === SEASON, JSON.stringify(st.dataset));
    check("status: fixture gameweek 6 (GW1-5 finished)", st.dataset.gw === 6, "gw=" + st.dataset.gw);

    /* fpl poller read the stub bootstrap */
    st = await waitFor("fpl gw", async () => { const s = await status(); return s.fpl.gw === 6 ? s : null; });
    check("status: fpl gw and deadline from bootstrap", st.fpl.gw === 6 && st.fpl.nextDeadline === deadline);

    /* a good pull lands and is served with provenance headers */
    st = await waitFor("good pull", async () => { const s = await status(); return s.dataset.commit === GOOD_SHA ? s : null; });
    check("dataset: good commit pulled, not stale", st.dataset.commit === GOOD_SHA && st.dataset.stale === false, JSON.stringify(st.dataset));
    let r = await get(`/data/insights/${SEASON}/players.csv`);
    const lines = r.body.trim().split("\n").length;
    check("insights: players.csv served, 610 rows", r.status === 200 && lines === 611, "lines=" + lines);
    check("insights: X-Source-Time and X-Fetched-At set", !!r.headers["x-source-time"] && !!r.headers["x-fetched-at"]);
    r = await get("/data/feeds/actuals.json");
    check("feeds: actuals.json parses", r.status === 200 && JSON.parse(r.body).season === "2027");
    r = await get("/data/feeds/rivals.json");
    check("feeds: rivals.json parses", r.status === 200 && JSON.parse(r.body).lastEvent === 5);

    /* a truncated CSV is rejected; the old copy keeps being served */
    mode = "truncated";
    st = await waitFor("truncated rejected", async () => {
      const s = await status();
      return s.dataset.stale && /rejected/.test(s.dataset.staleReason || "") ? s : null;
    });
    check("dataset: truncated playerstats rejected, stale:true", st.dataset.stale === true && /rejected/.test(st.dataset.staleReason));
    check("dataset: old commit still current after rejection", st.dataset.commit === GOOD_SHA, st.dataset.commit);
    r = await get(`/data/insights/${SEASON}/players.csv`);
    check("insights: old copy still served after rejection", r.status === 200 && r.body.trim().split("\n").length === 611);

    /* upstream down: old copy served, stale with a reason */
    mode = "down";
    st = await waitFor("poll failure noted", async () => {
      const s = await status();
      return /poll failed/.test(s.dataset.staleReason || "") ? s : null;
    });
    check("dataset: upstream 500 leaves old copy served, stale:true",
      st.dataset.stale === true && st.dataset.commit === GOOD_SHA);
    r = await get(`/data/insights/${SEASON}/playerstats.csv`);
    check("insights: playerstats still the good copy", r.status === 200 && r.body.includes("now_cost"));

    /* news sanitisation */
    await waitFor("news fetched", async () => {
      const s = await status();
      return s.news.perSource["Hostile Feed"] && s.news.perSource["Hostile Feed"].ok ? s : null;
    });
    r = await get("/api/news");
    const news = JSON.parse(r.body);
    const all = [...news.news, ...news.reddit];
    check("news: items present", all.length >= 2, "items=" + all.length);
    check("news: hostile markup stripped from titles",
      all.every(i => !/[<>]/.test(i.title) && !/onerror/i.test(i.title)),
      JSON.stringify(all.map(i => i.title)));
    check("news: javascript: url dropped, all urls http(s)",
      all.every(i => /^https?:\/\//.test(i.url)) && !all.some(i => /Evil link/.test(i.title)));
    const red = news.reddit[0];
    check("news: reddit numbers coerced", red && red.score === 12 && red.comments === 7, JSON.stringify(red));
    check("news: failed source would stay listed (perSource present)", !!news.perSource["Hostile Feed"]);

    /* odds: stub answered, and the key never leaks anywhere */
    await waitFor("odds fetched", async () => {
      const s = await status();
      return s.odds.state === "ok" ? s : null;
    });
    r = await get("/api/odds");
    const odds = JSON.parse(r.body);
    check("odds: state ok with rows", odds.state === "ok" && odds.rows.length === 1, JSON.stringify(odds).slice(0, 120));
    for (const path of ["/api/status", "/api/odds", "/api/news", `/data/insights/${SEASON}/players.csv`, "/"]) {
      const rr = await get(path);
      const hay = rr.body + JSON.stringify(rr.headers);
      check(`no key leak in ${path}`, !hay.includes(ODDS_KEY));
    }

    /* methods, 404, traversal */
    r = await get("/", { method: "POST", body: "x" });
    check("POST / is 405", r.status === 405);
    r = await get("/api/status", { method: "PUT" });
    check("PUT /api/status is 405", r.status === 405);
    r = await get("/definitely-not-a-page");
    check("unknown path is 404", r.status === 404);
    r = await get("/data/insights/../../server/server.mjs");
    check("traversal (plain ..) refused", r.status >= 400 && !r.body.includes("createServer"), "status=" + r.status);
    r = await get("/data/insights/..%2f..%2fserver%2fserver.mjs");
    check("traversal (encoded ..) refused", r.status >= 400 && !r.body.includes("createServer"), "status=" + r.status);
    r = await get(`/data/insights/${SEASON}/%2e%2e/%2e%2e/.signals-meta.json`);
    check("traversal (encoded dots) refused", r.status >= 400, "status=" + r.status);
    r = await get("/data/feeds/other.json");
    check("feeds route only serves the two feed files", r.status === 404);
  } catch (e) {
    check("gate run completed", false, e.message);
    console.log("--- server log tail ---\n" + childLog.split("\n").slice(-25).join("\n"));
  } finally {
    child.kill();
    stub.close();
    await sleep(300);
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail === 0) console.log("All checks passed.");
  else process.exit(1);
}

main();
