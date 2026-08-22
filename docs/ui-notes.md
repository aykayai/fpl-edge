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
