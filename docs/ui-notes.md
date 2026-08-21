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
