# FPL Signals server

One Node 24 process, no npm dependencies. It serves the app's static
files, mirrors the FPL Core Insights dataset with validation and atomic
swaps, builds the actuals and rivals feeds locally (so they come off the
public repo), and caches news and odds server-side. Step 1 of moving the
app onto its own box; the front end switches to these endpoints in step 2.

## Run locally

PowerShell:

    $env:ODDS_API_KEY="your-key"      # optional; leave unset for state "nokey"
    $env:STATE_DIR="C:\somewhere\fpl-state"
    node server\server.mjs

bash:

    ODDS_API_KEY=your-key STATE_DIR=/var/lib/fpl-state node server/server.mjs

Then open http://localhost:8090/. Environment: PORT (8090), STATE_DIR
(./state), ODDS_API_KEY, FPL_LEAGUE_ID (391690), FPL_TEAM_ID (301830).
Keys come from env only and are never logged or echoed.

Gate (no network needed, Windows or Linux):

    node server/test_gate.mjs

Docker:

    cp .env.signals.example .env.signals    # fill in the key there
    docker compose -f docker-compose.signals.yml up -d --build

## Endpoints

- `/` and the root files: the app shell (index.html, app-*.js, sw.js,
  manifest.json, icons), HTML and JS served no-cache.
- `/data/insights/<path>`: the mirrored dataset, same relative paths the
  app uses against raw.githubusercontent.com (for example
  `/data/insights/2026-2027/players.csv`). Every response carries
  `X-Source-Time` (the upstream commit time) and `X-Fetched-At`.
- `/data/feeds/actuals.json`, `/data/feeds/rivals.json`: built locally
  by the repo's own scripts/build-actuals.mjs, never committed anywhere.
- `/api/status`: `{ now, dataset:{season,gw,commit,committedAt,fetchedAt,
  ageMinutes,stale,staleReason}, fpl:{fetchedAt,ageMinutes,nextDeadline,
  gw,liveFetchedAt,error}, feeds:{lastRun,lastOk,ageMinutes,error,
  actuals,rivals}, news:{fetchedAt,perSource:{name:{ok,fetchedAt,error}}},
  odds:{state,fetchedAt}, snapshots:{last,next,mode,note} }`.
- `/api/news`: `{ fetchedAt, news:[{src,title,url,time}],
  reddit:[{src,title,url,time,score,comments,extra}], perSource }`.
  Titles are plain text, urls are http(s) only, numbers are numbers. A
  failed source keeps serving its last good copy and reports its error.
- `/api/player-news?names=First Last,Other Name`: Google News search per
  name (the page passes its own squad names), 15 minute cache per name.
- `/api/odds`: `{ state, fetchedAt, rows:[{home,away,commence,
  bookmakers}] }` where `bookmakers` is the raw odds-api.io per-book
  object, so the page's normaliseBooks runs on each row unchanged.
  Without a key: `{ state: "nokey" }`, HTTP 200. Cache 4 hours.

GET and HEAD only; anything else is 405.

## Schedules

A single 60-second tick decides what is due; no job overlaps itself and
the start is jittered.

- Dataset: the upstream workflow's cron runs 2-7 hours late, so instead
  of a clock the GitHub commits API is polled every 15 minutes with an
  ETag (304s stay inside the unauthenticated 60/hour limit). A new
  commit is downloaded into a temp dir pinned to that sha, validated
  (players/playerstats/teams parse cleanly, 600/600/20 row minimums,
  now_cost present, 38 fixtures files, 38-row gameweek_summaries with a
  finished column), then swapped in by directory rename. On any failure
  the old copy keeps being served and status says stale with the reason.
  Last-season files are reused from the previous copy, not re-fetched.
- Official FPL API: bootstrap-static every 15 minutes, every 5 minutes
  in the 3 hours before a deadline, one extra fetch just after 00:05 UK
  for price changes, and event/{gw}/live every 2 minutes while a fixture
  is in play (kickoff to kickoff + 130 minutes, from the dataset).
- Feeds: scripts/build-actuals.mjs runs as a child process every
  15 minutes with env-driven output paths pointing into STATE_DIR, so
  nothing is written into the repo's data/ or pushed anywhere.
- News: every 15 minutes, fetched directly with a plain User-Agent (no
  CORS proxies); reddit JSON first, subreddit RSS as fallback.
- Odds: every 4 hours when ODDS_API_KEY is set.
- Snapshots: at deadline minus 60 and minus 15 minutes.

## Decisions made

- scripts/snapshot-predictions.mjs imports Playwright and drives a real
  browser against the live site on purpose, and the repo has no
  package.json. Pulling a browser into this server was out of scope, so
  the snapshot scheduler is a stub: it logs exactly what it would run at
  each moment and reports last/next in /api/status. Install Playwright
  and set RUN_SNAPSHOTS=1 to make it spawn the real script (output goes
  to STATE_DIR/snapshots/predictions.json).
- The mirror carries exactly the file set the app reads. The app today
  also requests last-season playermatchstats.csv and matches.csv (they
  come back header-only or get swallowed by catch(()=>[])); those are
  not mirrored, so after cutover they will 404, which the app already
  treats as empty. Step 2 can drop those requests.
- BBC and Premier League items are filtered to FPL-flavoured titles
  server-side, with the same word list the app uses.
- Dataset status counts as stale when the newest pull attempt failed or
  the upstream commit is more than 12 hours old (it normally lands about
  three times a day).
