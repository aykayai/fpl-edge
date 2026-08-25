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
