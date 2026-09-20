# FPL Edge

Fantasy Premier League planner, projections and transfer assistant.

**Live:** https://aykayai.github.io/fpl-edge/

Vanilla JS, no build step, no framework. Seven files loaded in order as classic
scripts sharing one global scope, plus a service worker so the site installs and
survives a dropped connection.

> **GitHub `main` is the source of truth.** Project knowledge and chat history
> both go stale. Always fetch the file you are about to edit from
> `https://raw.githubusercontent.com/aykayai/fpl-edge/main/<file>` first.

## App files

Load order matters. `app-main.js` must stay last.

| File | Owns | Chat |
|---|---|---|
| `index.html` | Markup, all CSS, script tags | UI |
| `app-core.js` | Data loading, prediction model, team ratings, FDR, banding, `NAV`, routing, `APP_VERSION`, shared helpers (`shirtSVG`, `ptsCol`, `fdrPill`, `posDiff`) | xFPL and FDR |
| `app-squad.js` | Squad state, per-gameweek plan history, signals, chips, transfers, `cardHTML`, dashboard, compare squad | UI |
| `app-render.js` | Page markup: Player Data, Transfers, Fixtures, Chips, xFPL Model, radar, Free Hit optimiser | UI |
| `app-odds.js` | Bookmaker odds, Rivals, News **and the `render()` loop, nav bar and page shells** | UI |
| `app-tracker.js` | Season Tracker page | UI |
| `app-main.js` | Actions (`act`) and init — loads last | UI |
| `sw.js` | Service worker | any chat, on release |

Two things the filenames do not tell you, both of which have sent chats to the
wrong file before:

- **`render()`, `navHTML()` and the Team Planner / Player Data page shells live
  in `app-odds.js`**, not `app-render.js`. `app-render.js` holds the reusable
  markup those shells call.
- **`cardHTML()` (the pitch card) lives in `app-squad.js`**, not
  `app-render.js`.

`app-render.js` also still contains `filtersOLD()`, which nothing calls. Ignore
it; do not extend it.

## Fetch only what your domain owns

This is the rule that stops chats reading stale or irrelevant code. Fetch the
files your change touches, plus your own notes file. If you find you need
another, say why and ask first.

| Chat | Scope | Fetches | Notes file |
|---|---|---|---|
| **xFPL** | Prediction model, calibration, expected minutes | `app-core.js` | `docs/xfpl-notes.md` |
| **FDR** | Fixture difficulty, team ratings, banding | `app-core.js` | `docs/fdr-notes.md` |
| **UI and bugs** | Layout, pages, content, icons, bugs. Authority over page structure; may add or remove pages | `index.html`, `app-squad.js`, `app-render.js`, `app-odds.js`, `app-tracker.js`, `app-main.js` | `docs/ui-notes.md` |
| **Advice** | Recommendations only, never edits the app | nothing | `docs/advice-context.md` |

`app-core.js` is shared between the model chats and the UI chat. Fetch it fresh
immediately before editing and re-check after, or parallel work gets clobbered.

**Output only what you changed.** A calibration session returns `app-core.js`
and `sw.js`, not the whole set. The notes files live in `docs/` on GitHub, not
in project knowledge; each chat fetches and updates its own.

## Data

- **FPL Core Insights** — players, fixtures, teams, match stats. Public, fetched
  straight from the browser, refreshed a few times daily.
- **This repo's own pipeline** — `scripts/build-actuals.mjs`, run on a schedule
  by `.github/workflows/actuals.yml`. The official FPL API sends no CORS
  headers, so the browser cannot call it; the Action fetches server-side and
  commits `data/actuals.json` (entry history, per-gameweek points, rank,
  transfers, bank, chips, every tracked player's actual points) and
  `data/rivals.json` (mini-league table, rival squads and transfers). The app
  reads them as static files.

`data/actuals.json` does **not** yet publish `picks` or `ftAvailable`. Until it
does, historical squads are frozen from local snapshots and free transfers are
rebuilt from the published per-gameweek transfer counts.

## External dependency

The Free Hit optimiser solves for the highest-scoring legal squad as a 0/1
integer program using `javascript-lp-solver`, loaded from a CDN in
`index.html`. It is the only external script. If it fails to load the page falls
back to a heuristic rather than break.

## Releasing

Bump **`APP_VERSION` in `app-core.js` and `CACHE` in `sw.js` together**, every
time. Miss either and the service worker keeps serving the old build. Upload via
the GitHub web UI is error-prone: name the zip after the version, and verify the
footer version on the live site afterwards.

At the end of any session that changed the app, output the updated notes file
for your domain, whole and ready to commit.

Validate model or FDR changes against the reference CSVs before shipping, and
report MAE and bias against both the 292-player and 440-observation sets.

## What belongs in project knowledge

**Recommendation: keep the app files out.** Project knowledge should hold only
`README.md`, the reference CSVs (`ref_gws.csv`, `ref_gk/def/mid/fwd.csv`,
`ref_fdr.csv`) and this guidance — which is what it holds today.

The app files change every session across four chats. A copy in project
knowledge is stale the moment another chat ships, and a stale copy is worse than
no copy: a chat that reads it cannot tell it is out of date, which is exactly
how dead code gets edited. Fetching from `main` costs one request and is always
correct.

The reference CSVs are the opposite case. They are static validation fixtures,
never edited, and wanted in full at the start of a session, so project knowledge
is the right home for them.

`sw.js` is a borderline case. It is tiny and rarely changes, but it is still a
live app file, so fetch it from `main` with the rest rather than trusting a
cached copy.
