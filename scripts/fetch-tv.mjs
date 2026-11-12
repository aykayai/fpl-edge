/* TV channels for the coming Premier League matches (Teams > Matches).

   The Premier League's broadcasting feed answers by the caller's country:
   from Ireland it lists Sky, TNT and Premier Sports; from the Oracle server
   (Netherlands) it lists nothing, and it refuses browsers on other sites. So
   this runs on Andy's PC, weekly (Windows Task Scheduler, "FPL Signals TV"),
   and pushes the result into the server's state volume over ssh.

   Usage:  node fetch-tv.mjs            fetch and push
           node fetch-tv.mjs --dry      fetch and print, push nothing
   ENV:    TV_SSH   ssh target (default ubuntu@158.101.217.101)
           TV_WEEKS matchweeks ahead, including the current one (default 6)

   Output (/state/tv.json on the server, served at /api/tv):
     { fetchedAt, country, from, to,
       matches: [{ gw, kickoff, home:{abbr,name}, away:{abbr,name},
                   channels:[{abbr,name}] }] }   abbr = FPL short names */

import { spawn } from "node:child_process";

const SSH = process.env.TV_SSH || "ubuntu@158.101.217.101";
const WEEKS = Math.max(1, Math.min(10, +process.env.TV_WEEKS || 6));
const DRY = process.argv.includes("--dry");
const H = { Origin: "https://www.premierleague.com", Referer: "https://www.premierleague.com/", "User-Agent": "Mozilla/5.0" };

async function json(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(20000) });
      if (r.ok) return await r.json();
      if (r.status < 500) throw new Error(`${r.status} ${url}`);
    } catch (e) { if (i === 2) throw e; }
    await new Promise(r => setTimeout(r, 2000 * (i + 1)));
  }
}

const now = new Date();
const season = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
const cur = (await json("https://resources.premierleague.com/premierleague25/config/current-gameweek.json")).matchweek;
const country = (await json("https://api.premierleague.com/country").catch(() => ({}))).country || "";
const to = Math.min(38, cur + WEEKS - 1);

const matches = [];
for (let mw = cur; mw <= to; mw++) {
  const d = await json(`https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v2/matches?competition=8&season=${season}&matchweek=${mw}&_limit=30`);
  for (const m of d.data || []) matches.push({
    id: String(m.matchId), gw: m.matchWeek, kickoff: m.kickoff, tz: m.kickoffTimezone,
    home: { abbr: m.homeTeam.abbr, name: m.homeTeam.shortName || m.homeTeam.name },
    away: { abbr: m.awayTeam.abbr, name: m.awayTeam.shortName || m.awayTeam.name },
    channels: []
  });
}

for (let i = 0; i < matches.length; i += 20) {
  const ids = matches.slice(i, i + 20).map(m => m.id).join(",");
  const d = await json(`https://api.premierleague.com/broadcasting/match-events?sportDataId=${ids}&pageSize=40`);
  for (const ev of d.content || []) {
    const m = matches.find(x => x.id === String(ev.contentReference && ev.contentReference.id));
    if (!m) continue;
    for (const c of ev.channels || []) {
      const info = c.info || {}, abbr = String(info.abbreviation || "").toLowerCase();
      if (!/^[a-z0-9]{2,12}$/.test(abbr) || m.channels.some(x => x.abbr === abbr)) continue;
      m.channels.push({ abbr, name: String(info.name || abbr).replace(/^Ireland - /, "") });
    }
  }
}

const out = { fetchedAt: now.toISOString(), country, from: cur, to, matches: matches.map(({ id, ...m }) => m) };
const body = JSON.stringify(out);
const withTv = out.matches.filter(m => m.channels.length).length;
console.log(`${new Date().toISOString()} GW${cur}-${to}: ${out.matches.length} matches, ${withTv} with channels (${country || "country unknown"})`);

if (DRY) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
if (!out.matches.length) { console.error("no matches found; nothing pushed"); process.exit(1); }

/* into the container's state volume; the server serves it at /api/tv */
const ssh = spawn("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=20", SSH,
  "docker exec -i fpl-signals sh -c 'cat > /state/tv.json.tmp && mv /state/tv.json.tmp /state/tv.json'"], { stdio: ["pipe", "inherit", "inherit"] });
ssh.stdin.end(body);
ssh.on("close", code => { console.log(code === 0 ? "pushed to the server" : "push failed, ssh exit " + code); process.exit(code); });
