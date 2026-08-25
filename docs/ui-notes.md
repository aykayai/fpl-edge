# UI and bugs — notes

## This chat's authority
May add or remove tabs, restructure navigation, and change any copy or layout
across the whole app. The xFPL and FDR chats change only their own logic.

## File layout (since v8.3)
The app was one 276KB `index.html`, which truncated on raw fetch and left chats
editing markup they could not see. Now split into six files, loaded in order as
classic scripts sharing one global scope:

| File | Size | Holds |
|---|---|---|
| `index.html` | 25KB | Markup, styles, script tags |
| `app-core.js` | 73KB | Data loading, team ratings, FDR, prediction model |
| `app-squad.js` | 53KB | Signals, squad, transfers, chips, news, dashboard |
| `app-render.js` | 55KB | Player card, pitch, list, tables, page markup |
| `app-odds.js` | 58KB | Bookmaker odds |
| `app-main.js` | 14KB | Actions and init — **must load last** |

Which file to fetch:
- **xFPL chat** → `app-core.js`
- **FDR chat** → `app-core.js`
- **UI chat** → `index.html`, plus `app-render.js` and/or `app-squad.js`
- Odds work → `app-odds.js`

`APP_VERSION` lives in `app-core.js`. Bump it and `CACHE` in `sw.js` together.

## Structure
Hash routing (`#/team-planner`, `#/transfers`, …) via the `NAV` array — add or
remove a page there and in the `S.tab` render switch in `app-render.js`.

## Icon system
One shield silhouette, gradient plus gloss highlight, drawn as SVG. Differential
diamond, hot-streak flame, attack football, defence shield-and-tick, DefCon stop
sign, nailed stopwatch, caution triangle. Set pieces use the same shield.

**Spacing gotcha**: signal and set-piece groups are separate spans. Nesting flex
gaps made the join between groups wider than gaps within them — fixed with
`display:contents` so every badge sits in one flex row.

## The recurring trap: stale caches
Several rounds have been lost to a build being live but showing old behaviour.
The service worker caches separately from the browser, and an installed PWA
keeps its own again. When something "isn't working":
1. Check the footer version first.
2. Bump `CACHE` in `sw.js` on every release — always.
3. Clearing requires: uninstall the PWA, clear browser cache, hard reload.

The `.js` files are served **network-first** by the service worker, so a new
release reaches users on next load rather than being pinned to a stale cache.

## Recent fixes worth remembering
- Name-bar click called `pick` (prepares transfer) not `card`.
- Two separate failure blocks existed in the Odds tab; editing one left the
  other live. Check for duplicates before assuming an edit didn't apply.
- Player Pool markup differed from what an edit assumed — verify the target
  string exists before trusting a replacement.

## v9.1 changes
Menu: `xFPL Model` moved into a new **Models** group (its own `NAV` group after Tools).
Header/sticky bar: the Refresh button moved out of the header into the sticky
mini-stats row, restyled as an orange pill (`.gwrefresh`) width-matched (132px) and
aligned with the GW selector (`.gwpill`, also min-width 132px).
Player Data: column headers stay visible — the table now lives in a bounded
`.tallscroll` container (`max-height:calc(100vh - 168px)`) with `position:sticky`
`thead th`; Signals column moved after Price and widened to fit 5 icons on one row
(`.sigcell` max-width 96px, `.sig` shrunk to 15px in that column); **all** orange
columns for the filtered position — position-specific AND highlighted generals
(CS %, DefCon %, Start %…) — now cluster together right after xMins (the generals
are pulled from their base positions and re-inserted, position-specific first).
Team Planner:
- **Compare "doesn't work" was the over-long pool** pushing `compareHTML` (rendered
  full-width below the grid) off-screen. Fixed by bounding the pool height.
- Pool pegged to the squad/dashboard column via an absolute-fill trick: on desktop
  `.poolcol{position:relative}` + `.poolpanel{position:absolute;inset:0}` so the
  panel contributes 0 intrinsic height — the grid row is sized by the left column
  and the pool fills it and scrolls internally (was stretching to its own 150-row
  content, which is why it ran long). Breakpoint aligned to 900px to match `.grid2`.
- Bench order: `orderBench` now always puts the keeper first; the ⇄ cycle
  (`benchcycle`) reorders **outfield subs only** — GK is fixed at bench position 1.
  `cardHTML(p, {slot, cycle})`: cyclable outfield show a tappable order number;
  the keeper shows its number but doesn't cycle.
- Compare + Optimise buttons moved off the header onto the pitch overlay, right-
  aligned level with the Pitch/List toggle (`.pitchctl` spanning left:8px right:8px,
  `justify-content:space-between`). Header now holds only Reset + Save.
- Player Pool transfer suggestions (`replHTML`) only show options that improve the
  pick by **+0.1 or more**.

**Open question for Andy:** the Refresh button was moved into the sticky bar beside
the GW selector (orange, width-matched). Confirm that placement is what "align with
the GW selector" meant, or say where you'd prefer it.

## v9.2 — Tracker page (Plan → Tracker)
New file **`app-tracker.js`** (loaded after app-odds.js, before app-main.js; new
`<script>` in index.html). Holds `TRACKER_HISTORY` (static past-season data) + all
`trk*` render functions. Wired via `NAV` Plan group + `TABPATH.tracker` (app-core),
a `render()` case in app-odds, and `act('trkstat',…)` (chart stat picker) in app-main.
State: `S.tracker` (current-season feed, null until wired), `S.trkStat` (chart stat).
(Also bundles the v9.1.1 "Refresh back in the header" revert, since GitHub was still
at 9.1.0 with Refresh in the sticky bar.)

Two data sources:
- **history** — committed in `TRACKER_HISTORY.seasons`. Overall/Best/Worst are
  computed across *all* seasons present, so adding a season widens them automatically.
  Currently only 25/26, and only the 5 clean rows (points, gwRank, orRank, captain,
  value); rankChange is derived from orRank.
- **current** — the FPL-API GitHub Action (same one the xFPL page needs) publishes
  into `S.tracker`:
  ```
  S.tracker = { season, totalPlayers, gw:[{event,points,gwRank,orRank,bank,value,
    transfers,transferCost,bench,captain,off1m,off500k,off100k,transferDiff}] }
  ```
  `entry/{id}/history/` covers most of it in one call; captain needs per-GW
  `event/{gw}/picks/`; **off1m/off500k/off100k are not in the FPL API** — LiveFPL's
  /rank is a JS app (no static HTML to scrape), so these come from the weekly feed or
  are supplied. Until `S.tracker` exists the summary/table show a waiting state.

Design: three bands (Average / Best / Worst) of stat cards, each showing This
season / Last season / All-time; an SVG GW-comparison line chart (one line per
season, rank stats flipped so up = better); chip panel awaiting season-labelled data.

**Open data asks (blocking full population):**
1. Chip table season labels were garbled (`26/27 24/25 24/25 23/34 22/23 21/22`).
2. Transfer Pts Diff + No. Transfers rows had blank cells that collapsed on paste.
3. Earlier seasons (2021–2025) to make the All-time column meaningful.
Wanted as clean per-GW arrays (38 values, blanks explicit) per stat per season.

## v9.2.1 — Tracker data populated
Five past seasons now baked into `TRACKER_HISTORY` (2026→2022, labelled by end year;
current live season = 2027 from the Action). Clean rows per season: points, gwRank,
orRank, captain (not 2022), value, transferDiff (rankChange derived from orRank).
transferDiff stores non-blank values only — fine for Average/Best/Worst (order-
independent), so it's shown in cards but kept off the comparison chart (blank GW
positions unknown). All-time = across all five seasons; Last season = 2026. Chip
panel now renders the real 8-chip × 5-season table, with a 2027 column reserved for
the current season once the feed lands.
Changed files: app-tracker.js, app-core.js (APP_VERSION 9.2.1), sw.js (cache).

## v9.2.2 — Tracker redesign
- **Historical section grouped by stat** (points/gwRank/orRank/rankChange/transferDiff/
  captain), 2 cards per row (`.tgrid2`). Each card = a mini 3×3 table: Avg/Best/Worst ×
  This yr / Last / All-time. The This-yr column is tinted with the stat's accent
  (`.tnow`, color-mix), and the single all-time-best value is starred (`.tbest`/`.tstar`).
- **Gameweek comparison is now a grouped bar chart** (was a line). One bar per season
  per GW, value printed above each bar (rotated, compacted — ranks show as 6.1M/975k).
  Paginated 10 GWs at a time via `act('trkgw','prev'|'next'|'all')` + `S.trkGwStart`/
  `S.trkGwAll`; "Show all" renders 38 GWs in a horizontally-scrollable SVG.
- **Career finishes** panel (`TRACKER_FINISHES`, 20 seasons of official FPL data:
  points net of hits, final rank, % finish). Best points and best % finish are starred.
  Note: per-GW "GW Points" are gross; the official season totals are net of transfer
  hits, so summing GW points runs higher (e.g. 2023 by ~114) — expected, not a bug.
- **Chip + finishes tables** use a new `.trktable` style (Sora labels, Barlow Condensed
  numbers) so they match the rest of the site instead of the default mono cell font.
Changed: app-tracker.js, index.html, app-core.js (9.2.2 + trkGw state), app-main.js
(trkgw action), sw.js (cache).

## v9.3.0
Player Data: player-name column stays visible when scrolling right (sticky first
column, th+td `:first-child` `position:sticky;left:0`, `--ink2` bg); Signals never
wraps (`.sigcell` `flex-wrap:nowrap`, icons 14px) so 5 fit on one row; every column
header has a concise `title` tooltip (`TDESC`).
Team Planner: comparison squad now renders inside the left column, under the squad
and above the chips (was full-width below); the pool lengthens to match via the
existing absolute-fill peg. Projected-points row shows **actual** big + predicted
small + highlighted difference when `S.actuals[gw]` is present (predicted-only until
the FPL-API feed provides it).
Transfers: new **Compare players** radar above the planner — up to 3 players
(`S.radarIds`, `act('radarpick')`) via dropdowns (own squad + top ~180 by xFPL),
position-aware axes (same-position → that position's stats, else general), each axis
scaled to the strongest compared player, one colour per player. **Team of the Week
removed** (covered by the Chips Free Hit team); `totwCard` left as dead code.
State added: radarIds, actuals. Version 9.3.0.
OPEN QUESTION — Free Hit "same rules": TOTW used a flat £100 budget (best-possible
XI); the Chips Free Hit team uses your team value + bank. Left as-is pending Andy's
call on which budget rule to apply.

## v9.3.1 — actual points wired
**New shared feed, one contract, three consumers.** `loadActuals()` (app-core.js)
fetches `https://raw.githubusercontent.com/aykayai/fpl-edge/main/data/actuals.json`
after every load (cached-data fast path too, since own-entry data moves faster than
the 6h core-data cache). Fails silently (try/catch, checks `r.ok`) if the file
doesn't exist yet — every consumer already has a waiting state. Contract:
```
{ season, team:{ totalPlayers, gw:[{event,points,gwRank,orRank,bank,value,
    transfers,transferCost,bench,captain,off1m,off500k,off100k,transferDiff}],
    chips:{name:points} },
  players:{ "<player_id>": { "<gw>":points } } }
```
Populates: `S.tracker` (Tracker page — contract unchanged, matches exactly),
`S.actuals` (planner header — unchanged, matches exactly), `S.playerActuals` (new).

**Per-player actual points (pitch cards):** `cardHTML` now checks
`S.playerActuals[p.id][g]`. When present, the points bar shows **actual** as the
primary number, **predicted** small underneath with the difference colour-coded
(new `.pv2` CSS). Captain-multiplied the same way as the prediction so the two are
comparable. Falls back to predicted-only until that GW is in the feed. Season-to-
date **actual total** (`p.total` — genuinely live today, no Action needed, it's the
same `total_points` field FPL Core Insights already publishes) is now shown as a
tooltip on every card ("142 pts this season (actual)").

**xFPL page — Predicted vs Actual widget**, top of page: squad-level predicted
(via new `weekPtsFor(g)`, a VG()-independent version of `weekPts()`) vs actual
(from `S.actuals`), with ← → to browse gameweeks (`act('xfplgw',...)`,
`S.xfplGW`). Defaults to the most recently played GW. **Caveat documented in the
UI comment**: "predicted" for a past GW is the model's *current* calibration
applied retrospectively, not a snapshot of what was shown before that GW's
deadline — a true snapshot would need the Action to record predictions pre-
deadline, which is a separate ask (see prompt given to Andy for the xFPL chat).

State added: playerActuals, xfplGW. Version 9.3.1.

## v9.4.0 — Compare players redesigned
Full rebuild of the Transfers-page radar (`radarHTML`, app-render.js):
- **Search-to-select** replaces the three `<select>` dropdowns — each slot is a text
  input with a live `.rsdrop` results list (`act('radarsearch',i,text)`), matching
  name or team, capped at 8 results sorted by xFPL. Picking fills a chip
  (shirt + name + team + price + ✕ to clear, `act('radarclear',i)`).
- **One position at a time.** The first pick locks `lockedPos`; search results for
  the other slots are filtered to it, and `act('radarpick',...)` also rejects a
  stray mismatched id defensively (belt-and-braces alongside the UI-level filter).
  Removed the old "mixed positions" general-axes fallback — no longer reachable.
- **Own squad players included** — the candidate pool is every player of the locked
  position, not pre-filtered by ownership (search narrows it, nothing excludes it).
- **Colours: green/orange/off-white** (`var(--mint)`, `var(--amber)`, `var(--cream)`)
  — the most contrasting trio already in the palette, assigned to players 1/2/3 in
  that order, used consistently across chips, table, legend and radar polygons.
- **Defenders: xGI/90 → xMins** in `AXSET[2]`.
- **Summary table**, left of the radar on desktop (`.rgrid`, stacks under 760px):
  one row per axis, one column per player, shirt (`shirtSVG`) as the "picture" —
  the app has no real player-photo source, so this matches how every other page
  represents players. Per-row best is bolded in that player's colour with a ★
  (only when ≥2 players are active).
  **Note:** the ★ appears only on the table's rows once ≥2 players are picked.
- **xFPL horizon slider** (`.rhorizon`, native range 0–4 styled like the site's
  existing sliders): 1 / 3 / 5 / 10 GWs / Rest of season. Scoped to the **xFPL axis
  only** (`gwsFor(curH)` feeds `hPts`) — the per-90 rate axes (xG/90, xGI/90, etc.)
  keep using the page's existing recent-form window, since "Rest of season" has no
  backward-looking equivalent. Flagged to Andy in case broader scope was intended.
- Layout redesigned to match site conventions throughout: `.panel`/`.phead`/`.pbody`,
  `.note` for meta text, same card/border/radius language as Tracker's stat cards.
State added: radarSearch, radarHorizon (replaces nothing — radarIds kept). Old
`.rsel` CSS removed, replaced with the full `.rslot`/`.rsdrop`/`.rtable`/`.rgrid`
etc. component set. Version 9.4.0.

## v9.4.1 — bugfix: couldn't scroll back past the current gameweek
**Root cause:** `VG()` (app-core.js) and the `startgw` action (app-main.js) both
clamped their lower bound to `S.model.next.id` (today's gameweek) instead of 1 —
left over from before the app had any reason to look backward. Both "Earlier
gameweek" arrow buttons (app-odds.js, planner + sticky bar) independently hardcoded
the same floor via `Math.max(S.model.next.id,VG()-1)`. All four fixed to floor at 1.

**Side effect handled:** the model only computes projections forward from the
current gameweek (`p.gw[e]` is built starting at `S.model.next.id`), so a naive
unlock would show a false "0.0" (and a bad-projection colour) on every pitch card
for a historical week. `cardHTML` now detects `noHistData` (past week, no
projection, no actual-points data) and shows a neutral "— · no data for GW{g}"
state instead. Once the live-actuals feed has that week, the card correctly shows
the actual points instead, same as any other tracked gameweek.

**Known gap, scoped out for now:** the comparison-squad card (`compareHTML`'s card
builder) still shows a raw predicted number with no historical guard — it's a
secondary view (used when comparing transfer scenarios) rather than the main
pitch, so I left it as-is. Flag it if you hit a stray 0.0 there while browsing
history and I'll apply the same fix.

Files: app-core.js, app-main.js, app-odds.js, app-squad.js, sw.js. Version 9.4.1.

## v9.4.2 — the real fix for scroll-back-to-GW1
v9.4.1 fixed `VG()`, the `startgw` action, and the two "Earlier gameweek" arrows in
the sticky bar and planner header — all correct, but **missed the actual control
Andy was using**: the big "GAMEWEEK X" slider at the top of the Team Planner
(`S.tab==="squad"`). That button dispatches `act('vgw',...)` — a separate action
name (aliased to the same `startgw` case, so the *handler* was already fixed in
9.4.1) — but the button's onclick **computed its own target value independently**:
`Math.max(first, g-1)` where `first=S.model.next.id`, and was `disabled` outright
once `g<=first`. So the one control most visible on the page was still hard-floored
and greyed out at the current gameweek, even though the underlying state could by
then legally go lower. Missed in the 9.4.1 pass because that fix searched for
`act('startgw'` specifically and didn't catch the `vgw` alias.
Fixed: floor changed to 1, disabled condition changed to `g<=1`.

Also fixed the same bug pattern on a completely different page while auditing: the
**Fixtures page** pagination (`case"fixgw"`, app-main.js) was still floored at
`S.model.next.id` — same category of bug, unrelated control, now floors at 1 too.

Exhaustively grepped afterward for any remaining `Math.max(first,`/
`Math.max(S.model.next.id,`/`<=first` patterns — none left.
Files: app-core.js (version only), app-odds.js, app-main.js, sw.js. Version 9.4.2.

## v9.4.3 — crash fix: dashboard threw when browsing a historical gameweek
The v9.4.2 fix genuinely unlocked GW1–{next.id-1} navigation, which immediately
exposed a real bug the app had never hit before: `dashData()`'s squad-strength
calculation (`app-squad.js`) read `p.gw[g].pts` **without** the `?.` every other
line in that function already uses — harmless while `g` was always `>=next.id`
(guaranteeing `p.gw[g]` existed), but a hard crash the moment `g` could be
historical and `p.gw[g]` is `undefined` (the model only builds projections
forward from the current gameweek). Console trace:
`Cannot read properties of undefined (reading 'pts') at app-squad.js:781`.

**Audited every `.gw[` access in the codebase** (not just this one line) for the
same gap — grepped for every access missing `?.`, then checked each by hand.
Found exactly one other place with the same *display* risk (not a crash, since it
already had a safe fallback): the **comparison-squad card** — same "0.0 for a week
with no data" issue flagged as a known gap back in 9.4.1, now given the same
honest no-data treatment as the main pitch card. Every other unguarded-looking hit
(in `bestXIScore`, `teamOfWeek`, chip planning, and the model-build loop in
app-core.js) was confirmed safe — each already filters its player pool to only
players with confirmed `p.gw[g]` data before ever touching it unguarded.

**Known cosmetic side-effect, not a bug:** for a fully historical week with zero
model data, the Squad Strength panel now shows 0% for every position (instead of
crashing) and the fixture outlook shows "blank" for every player — both correct
degradations, but worth knowing they look a bit stark. Flag it if it's confusing
in practice and I can add a clearer "no projection data for this week" banner.

Files: app-core.js (version only), app-squad.js, sw.js. Version 9.4.3.
