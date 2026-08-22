# UI and bugs — notes

## This chat's authority
May add or remove tabs, restructure navigation, and change any copy or layout
across the whole app. The xFPL and FDR chats change only their own logic.
**Standing permission (granted v9):** this chat may edit `app-core.js` directly
where page structure requires it (`NAV`, `TABPATH`, `APP_VERSION`, render/routing),
not only its four usual files. Coordinate on release timing so model work there
isn't clobbered.

## File layout (since v8.3)
Six files, loaded in order as classic scripts sharing one global scope:

| File | Size | Holds |
|---|---|---|
| `index.html` | 25KB | Markup, styles, script tags |
| `app-core.js` | 73KB | Data loading, team ratings, FDR, prediction model, **`NAV`/`TABPATH`/`APP_VERSION`**, `POS`, `CAL`/`CAL_BASE`, `hPts`, `VG` |
| `app-squad.js` | 53KB | Signals, squad, transfers, chips, news, dashboard, `cardHTML`, `compareHTML`, `orderBench`, `startingXI` |
| `app-render.js` | 55KB | Reusable page-markup components: `tableHTML`, `listHTML`, `pitchHTML`, `filtersHTML`, `SORTVAL`, `xfplHTML` |
| `app-odds.js` | 58KB | Bookmaker odds **and the app's `render()` loop, nav bar, and the Team Planner + Player Data page shells** |
| `app-main.js` | 14KB | Actions (`act`) and init — **must load last** |

**Correction (v9):** the render loop, `NAV` consumption, and the page *shells*
(the planner's pitch/list toggle, projected-points row, Compare/Optimise/Reset
buttons, pool panel; the Player Data filter bar / window / horizon controls) live
in **`app-odds.js`**, not `app-render.js`. `app-render.js` only holds the reusable
building blocks those shells call. The old note claiming the `S.tab` render switch
is in `app-render.js` was wrong.

`APP_VERSION` lives in `app-core.js`. Bump it and `CACHE` in `sw.js` together on
every release. (Project knowledge lagged at v8.2.0 while GitHub was v8.3.0 — always
trust GitHub.)

## Structure
Hash routing (`#/team-planner`, `#/xfpl-model`, …) via the `NAV` array and
`TABPATH` in `app-core.js`. To add a page: add to `NAV` + `TABPATH` (core) and a
`main=…HTML()` case in `render()` (`app-odds.js`); put the markup function in
`app-render.js`.

## xFPL Model page (v9, Tools → xFPL Model)
Renders live from existing model fields: per-position calibration (`CAL` vs
`CAL_BASE`), the learn signal (`LS.get("learn")` → `{pos:{scale,spread,n,gw}}`),
and a predicted-vs-actual **proxy** (upcoming-GW projection vs `pl.total/gwPlayed`,
with MAE/bias). The proxy is honest but coarse.

For true per-GW predicted-vs-actual, movers and xMins shifts, the page reads an
optional contract the **xFPL chat** populates in `app-core.js`:
```
S.model.report = {
  movers:      [{name, pos, before, after}],   // projection change vs last snapshot
  xminsShifts: [{name, before, after}],        // expected-minutes change
  perGW:       [{gw, mae, bias, n}]            // calibration error per finished GW
}
```
Until it exists, those sections show a clean empty state. The self-learning loop
is already wired: `learnFromResults()` runs in the model build and
`applyLearning()` nudges `CAL` (needs 25+ starters and 4+ finished GWs per
position; capped).

**FPL API / actuals:** the browser can't read `fantasy.premierleague.com/api`
directly (no CORS). Richer per-GW actuals need a server-side step — recommended: a
scheduled GitHub Action commits `gw-actuals.json` to the data repo, read like any
other file. (App does proxy some cross-origin fetches for News, but those proxies
are flaky; a committed file is the reliable path.) This is xFPL-chat work.

## Icon system
One shield silhouette, gradient plus gloss, drawn as SVG. Differential diamond,
hot-streak flame, attack football, defence shield-and-tick, DefCon stop sign,
nailed stopwatch, caution triangle. Set pieces use the same shield.

**Spacing gotcha**: signal and set-piece groups are separate spans. Nesting flex
gaps made the join between groups wider than gaps within them — fixed with
`display:contents` (`.cardsigs`). The pitch `cardHTML` signal row now uses
`.cardsigs` too (was an inline flex div, which is why its spacing was uneven).
The Player Data **Signals column** (`.sigcell`) flattens signals then set pieces
into one flex row (filter-bar order); it strips `setPieceHTML`'s `.sigs` wrapper so
every badge is a direct child with a uniform gap.

## The recurring trap: stale caches
1. Check the footer version first.
2. Bump `CACHE` in `sw.js` on every release — always.
3. Clearing requires: uninstall the PWA, clear browser cache, hard reload.
`.js` files are network-first, so releases reach users on next load.

## v9 changes (this release)
Player Data: Signals moved to their own column (filter-bar order); shortlist ★
moved left of the jersey; Next 3 moved after Price; orange position stats grouped
immediately after xMins; redundant in-squad `+` hidden on owned rows; **sort bug
fixed** — position-stat columns had no `SORTVAL` entry so their headers silently
didn't sort (worst with a position filter applied); stat headers now always sort
high→low, only name toggles.
Team Planner: Pitch/List toggle moved onto the board (`.pitchctl` overlay);
Compare moved up beside Reset/Optimise; the dead gwbar Optimise removed
(`act('optimise')` had no handler); projected-points row is now points+arrows only;
bench ⇄ cycles bench order FPL-style when idle (`benchcycle`) and still receives a
swap mid-substitution; compare squad now renders full-width **below** the grid
(grid2, not the old grid3 middle column); only the name bar opens the Player Card
(kit/points no longer do — that was the sub/✕ "opens card" bug), applied to the
compare card too; pool icons moved below fixture pills; pool name column widened
(`.lc` 33px, tighter gaps); pool pegged to the squad/dashboard column height on
desktop via `grid2{align-items:stretch}` + `poolpanel{height:100%}` instead of a
viewport-height sticky.

## Recent fixes worth remembering
- Name-bar click once called `pick` (prepares transfer) not `card`.
- Two separate failure blocks existed in the Odds tab; editing one left the other
  live. Check for duplicates before assuming an edit didn't apply.
- Player Pool markup differed from what an edit assumed — verify the target string
  exists before trusting a replacement.
- `.map(cardHTML)` leaks the array index as the 2nd arg — since `cardHTML` now
  takes `benchSlot`, XI rows must call `r.map(p=>cardHTML(p))`, bench passes the slot.
