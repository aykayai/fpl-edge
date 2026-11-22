/* News: what a story is about, and who (22 Nov 2026, Andy's News redesign).

   1. category. One per story, from words in the headline (and summary):
      availability first (Injury, Return, Transfer, Team News, Press
      Conference), then Blanks & Doubles and Chip Strategy, then FPL, then
      plain news. The first rule that matches wins, so "back in training
      after a hamstring injury" is a Return, not an Injury.
   2. players. Stricter matching (Andy, 22 Nov): a story names a player only
      when it has his surname AND his first name or his club, or his surname
      alone when no other Premier League player shares it. So "Gomez" alone
      no longer counts for Diego Gómez while Joe Gomez exists, and "Justin"
      needs Leeds or James.

   Shared by the news job (every item it serves) and the tests. */

export const fold = s => String(s == null ? "" : s)
  .replace(/ß/g, "ss").replace(/[øØ]/g, "o").replace(/[æÆ]/g, "ae").replace(/[łŁ]/g, "l").replace(/[đĐ]/g, "d")
  .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const words = s => " " + fold(s).replace(/[^a-z0-9]+/g, " ").trim() + " ";

/* key, label, order (lower ranks first on the page) */
export const CATS = {
  inj: ["Injury", 0], ret: ["Return", 1], trf: ["Transfer", 2], team: ["Team News", 3], pc: ["Press Conference", 4],
  bgw: ["Blanks & Doubles", 5], chip: ["Chip Strategy", 6], fpl: ["FPL", 7], news: ["News", 8]
};
const RULES = [
  ["bgw", /\b(blank|double) ?game ?weeks?\b|\b[bd]gw ?\d|\bfixture (amendment|change|moved)s?\b|\bpostpone|\brearrang|\bblanks? and doubles?\b/],
  ["chip", /\bwild ?card\b|\bfree hit\b|\bbench boost\b|\btriple captain\b|\bchip (strategy|plan)|\bchips\b/],
  ["ret", /\bback in (full |first-team |group )?training\b|\breturns? to (training|fitness|the squad)\b|\breturn date\b|\bfit again\b|\bavailable again\b|\bback from injury\b|\bnears? (a )?return\b|\bcloser to (a )?return\b|\bboost as\b|\bset to return\b|\breturning\b/],
  ["inj", /\binjur(?!y[- ]time)|\bscan\b|\bruled out (of|for|with|until|after)\b|\bdoubt|\bhamstring\b|\bknee\b|\bankle\b|\bgroin\b|\bthigh\b|\bcalf\b|\bshoulder\b|\bfoot\b|\bconcussion\b|\billness\b|\bknock\b|\bsurgery\b|\bsidelined\b|\bsuspen|\bbanned\b|\bban\b|\bred card\b|\blimp|\bfitness (update|concern|worry|news)\b|\bsetback\b|\bout for\b/],
  ["trf", /\btransfer\b|\bbid\b|\bsigns?\b|\bsigning\b|\bsigned\b|\bloan\b|\bfee\b|\bjanuary (window|move|exit|offer)\b|\bcontract\b|\brelease clause\b|\bmove to\b|\btalks\b|\boffer for\b|\bapproach\b|\btarget\b|\bexit\b|\bwant away\b/],
  ["team", /\bteam news\b|\bline ?ups?\b|\bstarting (xi|eleven|line)\b|\bpredicted (xi|line)|\bstarts?\b|\bbenched\b|\bdropped\b|\brotat(e|ion)\b|\bconfirmed xi\b/],
  ["pc", /\bpress conference\b|\bpresser\b|\bpre-?match (press|conference)\b/],
  ["fpl", /\bfpl\b|\bfantasy\b|\bgame ?week\b|\bcaptain(cy)?\b|\bdifferential|\bdefcon\b|\bprice (rise|fall|change)|\bscout picks\b|\bdeadline\b/]
];
export function categorise(title, summary) {
  const t = fold(title), s = fold(summary || "");
  for (const [k, re] of RULES) if (re.test(t)) return k;
  for (const [k, re] of RULES) if (k !== "team" && k !== "fpl" && re.test(s)) return k;   // the summary only for the clearer kinds
  return "news";
}

/* Common names the press uses for FPL's club names. */
const CLUB_ALT = {
  "Man City": ["manchester city", "man city"], "Man Utd": ["manchester united", "man utd", "man united"],
  "Spurs": ["tottenham", "spurs"], "Nott'm Forest": ["nottingham forest", "forest"], "Wolves": ["wolverhampton", "wolves"],
  "Newcastle": ["newcastle"], "West Ham": ["west ham"], "Brighton": ["brighton"], "Leeds": ["leeds"], "Sunderland": ["sunderland"],
  "Crystal Palace": ["crystal palace", "palace"], "Aston Villa": ["aston villa", "villa"], "Bournemouth": ["bournemouth"],
  "Brentford": ["brentford"], "Burnley": ["burnley"], "Chelsea": ["chelsea"], "Everton": ["everton"], "Fulham": ["fulham"],
  "Liverpool": ["liverpool"], "Arsenal": ["arsenal"], "Ipswich Town": ["ipswich"], "Leicester": ["leicester"], "Southampton": ["southampton"],
  "Hull City": ["hull"], "Coventry City": ["coventry"]
};
/* a club FPL names that is not listed above: its name and its first word */
const clubNames = team => CLUB_ALT[team] || [fold(team), fold(team).split(" ")[0]].filter(w => w.length >= 4);

/* players: [{id, first, second, web, team}] with team the FPL club name */
export function buildIndex(players) {
  const list = (players || []).map(p => {
    const second = fold(p.second).replace(/[^a-z ]+/g, " ").trim();
    const web = fold(p.web).replace(/^[a-z]\.\s*/, "").replace(/[^a-z ]+/g, " ").trim();
    const sur = new Set([web, second, second.split(" ").pop()].filter(w => w && w.length >= 3));
    const first = fold(p.first).replace(/[^a-z ]+/g, " ").trim().split(" ")[0] || "";
    const club = clubNames(p.team).map(fold);
    return { id: p.id, sur: [...sur], first, club };
  });
  const count = {};
  list.forEach(p => p.sur.forEach(w => { count[w] = (count[w] || 0) + 1; }));
  return { list, count };
}
/* strict: full names only ("Bryan Mbeumo"), for sources that also cover
   other sports and leagues (RotoWire) */
export function tagPlayers(text, idx, only, strict) {
  if (!idx) return [];
  const t = words(text), has = (s, w) => w && s.includes(" " + w + " ");
  /* full names first ("Justin Kluivert"): a match on its own, and masked out
     before the looser tests so "Justin" there is not James Justin */
  const out = new Set();
  let masked = t;
  for (const p of idx.list) {
    if (p.first.length < 3) continue;
    for (const w of p.sur) if (has(t, p.first + " " + w)) {
      if (!only || only.has(p.id)) out.add(p.id);
      masked = masked.split(" " + p.first + " " + w + " ").join(" | ");
    }
  }
  if (strict) return [...out];
  /* a surname alone is not enough when the story names other clubs but not
     his ("Brentford: Andrews hails ..." is not Coventry's Andrews) */
  const named = Object.values(CLUB_ALT).filter(alts => alts.some(c => has(t, c))).length;
  for (const p of idx.list) {
    if (out.has(p.id) || (only && !only.has(p.id))) continue;
    const hit = p.sur.filter(w => has(masked, w));
    if (!hit.length) continue;
    const unique = hit.some(w => idx.count[w] === 1 && w.length >= 4);
    const ownClub = p.club.some(c => has(t, c));
    if ((unique && (ownClub || !named)) || (p.first.length >= 3 && has(t, p.first)) || ownClub) out.add(p.id);
  }
  return [...out];
}
