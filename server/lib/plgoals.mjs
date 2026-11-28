/* Goals with their assists and minutes, from the Premier League's own match
   data (29 Nov 2026, Andy approved using it). FPL lists scorers and
   assisters separately and never says which assist made which goal; the
   Premier League's match centre does. Its API is not a public one: requests
   carry the site's Origin, it could change or stop without notice, and the
   Planner falls back to pairing from the Feed's timing whenever it is not
   here. FPL's fixtures no longer carry the Premier League's match id, so a
   match is found by kick-off time and home team.

   plGoals(gw, fplFixtures, teamNames) -> { <FPL fixture id>: [{ min, side,
   scorer: {display, first, last}, assist: {...}|null, kind }] } from cache;
   a refresh runs in the background at most every 2 minutes. */
import { CONFIG } from "./config.mjs";
import { log } from "./util.mjs";

const BASE = "https://footballapi.pulselive.com/football";
const H = { headers: { Origin: "https://www.premierleague.com", Referer: "https://www.premierleague.com/", Accept: "application/json" } };
const TYPES = { G: "goal", P: "pen", O: "og" };

let compSeason = null, listAt = 0, list = [], busy = false, lastRun = 0;
const done = new Map();    // PL match id -> goals, for matches already finished
const live = new Map();    // PL match id -> { at, goals }
let out = {};              // FPL fixture id -> goals

const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

async function getJ(path) {
  const r = await fetch(BASE + path, { ...H, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(path + " HTTP " + r.status);
  return r.json();
}

async function season() {
  if (compSeason) return compSeason;
  const d = await getJ("/competitions/1/compseasons?page=0&pageSize=5");
  const want = String(CONFIG.SEASON || "").replace("-", "/");
  const c = (d.content || []).find(x => String(x.label).includes(want)) || (d.content || [])[0];
  compSeason = c ? c.id : null;
  return compSeason;
}

async function matchGoals(id) {
  const m = await getJ(`/fixtures/${id}`);
  const home = m.teams && m.teams[0] && m.teams[0].team && m.teams[0].team.id;
  const names = {};
  for (const t of m.teamLists || []) for (const p of [...(t.lineup || []), ...(t.substitutes || [])])
    names[p.id] = { display: p.name && p.name.display, first: p.name && p.name.first, last: p.name && p.name.last };
  const goals = (m.events || []).filter(e => TYPES[e.type]).map(e => ({
    min: e.clock && e.clock.label ? e.clock.label.replace(/'\d\d$/, "'").replace(/^0/, "") : null,
    secs: e.clock ? e.clock.secs : null,
    /* an own goal counts for the other side: the scorer is listed under his own team */
    side: (e.teamId === home) === (e.type !== "O") ? "h" : "a",
    kind: TYPES[e.type], scorer: names[e.personId] || null, assist: e.assistId ? (names[e.assistId] || null) : null
  }));
  const finished = m.status === "C";
  return { goals, finished };
}

async function refresh(fplFixtures, teamNames) {
  const cs = await season(); if (!cs) return;
  if (Date.now() - listAt > 10 * 60000 || !list.length) {
    const d = await getJ(`/fixtures?comps=1&compSeasons=${cs}&page=0&pageSize=40&sort=desc&statuses=C,L`);
    list = d.content || []; listAt = Date.now();
  }
  const next = {};
  for (const f of fplFixtures) {
    if (!f.started || !f.kickoff_time) continue;
    const ko = Date.parse(f.kickoff_time), hn = norm(teamNames[f.team_h]);
    const pm = list.find(x => x.kickoff && Math.abs(x.kickoff.millis - ko) < 30 * 60000 && x.teams && x.teams[0] && (norm(x.teams[0].team.name) === hn || norm(x.teams[0].team.shortName) === hn))
      || list.find(x => x.kickoff && Math.abs(x.kickoff.millis - ko) < 60000 && x.teams && x.teams[0] && norm(x.teams[0].team.shortName).slice(0, 4) === hn.slice(0, 4));
    if (!pm) continue;
    if (done.has(pm.id)) { next[f.id] = done.get(pm.id); continue; }
    const c = live.get(pm.id);
    if (c && Date.now() - c.at < 110000) { next[f.id] = c.goals; continue; }
    try {
      const g = await matchGoals(pm.id);
      if (g.finished) done.set(pm.id, g.goals); else live.set(pm.id, { at: Date.now(), goals: g.goals });
      next[f.id] = g.goals;
    } catch (e) { log("plgoals", "match " + pm.id + " " + e.message, 0); if (c) next[f.id] = c.goals; }
  }
  out = next;
}

export function plGoals(fplFixtures, teamNames) {
  if (!busy && Date.now() - lastRun > 120000 && Array.isArray(fplFixtures) && fplFixtures.some(f => f.started)) {
    busy = true; lastRun = Date.now();
    refresh(fplFixtures, teamNames || {}).catch(e => log("plgoals", "refresh " + e.message, 0)).finally(() => { busy = false; });
  }
  return out;
}
