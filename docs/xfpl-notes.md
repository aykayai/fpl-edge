# xFPL algorithm — notes

## Accuracy — read this before quoting any number

The figures carried in these notes until v11.2.1 (292-player MAE **5.38**;
440-observation MAE **0.496**; rank correlation GK 0.80 / DEF 0.69 / MID 0.56 /
FWD 0.69) were **never accuracy against reality**. 440 is 55 players × 8
gameweeks, which is the `ref_gws.csv` grid itself, and 292 is the position
files. Those numbers measure how closely the app reproduces the reference
snapshot: a regression test against itself. A per-gameweek MAE of 0.5 is not
achievable in FPL by anyone. Keep them, but label them for what they are.

They remain useful as a **regression guard**: the reference set is a pre-GW1
snapshot, so anything gated on this-season data must leave them untouched.

### Real accuracy — first measurement, GW1–4 of 2026/27
Pre-season projections vs actual points, 54 of 55 players matched, 216
observations (GW5 excluded, still in play):

| | MAE | bias |
|---|---|---|
| Per gameweek, all | **3.156** | **−0.151** |
| DEF | 2.890 | −0.277 |
| MID | 3.306 | +0.094 |
| FWD | 4.093 | −0.429 |
| GK (n=4 only) | 3.425 | +2.725 |

MAE around 3.2 is normal for an FPL model; the week-to-week noise is
irreducible. **Bias of −0.15 over 216 observations is the important number**:
the level is right. Do not "fix" the level on the strength of MAE alone.

Rank correlation against actual four-week totals: GK 0.58, DEF 0.28, MID 0.42,
FWD 0.61 (n=289). Not comparable with the reference-set figures above. Four
gameweeks of FPL points are mostly variance, so DEF at 0.28 is weak but not yet
damning — revisit at GW10 before acting.

## Shape of the model
Per-position calibration `output = A × minutesFactor + B × rawComponents`.
Raw components: appearance points, attacking output (xG×goalPoints + xA×3),
clean sheet (Poisson from expected goals conceded), DefCon, bonus, set pieces.

## Constants that matter
- `CAL_BASE` — fitted per position. MID and FWD carry a wider slope than least
  squares gives, because minimising error alone pulls attackers toward the mean.
- `FIXTURE_AMP` = 1.45 — deliberately light. It stretches a player around his own
  average, which is blind to quality and **reorders players** if set high.
- Fixture sensitivity comes from the xG multiplier raised to a power (1.9), which
  multiplies and therefore cannot reorder two players in the same match.

## This-season weighting (v9.3.3)
`windowStats` weights each appearance: this season `SEASON_W (2.0) ×
0.5^(appsAgo / HALF_LIFE (6))`, last season `1` faded toward `LAST_FLOOR (0.35)`
over `FADE_OVER (12)` matches. Decay runs over **this season's rows only** and
last season stays flat; the fade is a function of this-season match count, so at
zero it is exactly 1. Counts (`apps`, `mins`, `starts`) stay raw because they are
evidence gates. `pick()` ramps this season in over `NOW_FULL` (250 minutes)
rather than the old 270-minute cliff.

Both are inert at the pre-season state by construction, which is what keeps the
reference sets valid as a regression guard.

## Learning from results — rebuilt at v11.2.1
The GW4 gate opened during the 2026/27 season with three faults live, all
pushing calibration the wrong way. Fixed:

1. **Feedback loop.** It read `pl.gw[g].pts`, built with the already-learned
   `CAL`, and applied the ratio back to `CAL_BASE` — re-deriving a correction
   from the residue of the previous one. Measured oscillation on unchanging
   inputs: 1.102, 1.008, 1.093, 1.016, 1.087… The projection is now rebuilt
   from `CAL_BASE` and `pl.rawPts`, which owe nothing to learned `CAL`. Same
   simulation now returns a flat 1.102 on every reload.
2. **Absences counted as bad weeks.** `actual = pl.total / gwPlayed` divided by
   league gameweeks, not the player's appearances. ~80% of qualifying starters
   had missed at least one of GW1–4, understating `actual` by roughly 40% and
   driving `scale` to its 0.7 floor — a ~30% cut to every projection, against a
   measured bias of only −0.15. Players must now have featured in
   `LEARN_MIN_APP` (75%) of completed gameweeks.
3. **Mismatched quantities.** A flat season mean against one fixture-adjusted
   gameweek. Both sides are now per gameweek; fixtures largely cancel across a
   position because every club plays each week.

Other changes: the learn record is written **whole**, so a position dropping
below its evidence threshold lapses back to base instead of keeping a stale
multiplier forever. Learning is skipped entirely when the actuals feed is
missing rather than falling back to the old season-average path.

`LEARN_MIN_N = {GK 15, DEF 25, MID 25, FWD 20}`. **25 is structurally
unreachable for keepers** — 20 clubs means at most 20 regular starters — and
forwards are thin for the same reason. A flat 25 meant GK could never learn.

`learningFrom()` is split out as a pure function specifically so it can be
driven with synthetic samples — the browser model cannot be stood up headless,
so this is the only way the part that moves every projection gets test coverage.

## FDR v11.3.0 — what it did to this chat's work

FDR now blends current-season results into team ratings (`FDR_MIX=1.00`, attack
weight ramping to 0.65 by GW12, defence to 0.70 by GW24). Two consequences here.

**The v11.2.1 loop fix still holds.** `rawPts` depends on FDR, not on learned
`CAL`, so no feedback path is reintroduced and the learn record still re-derives
cleanly each load. Confirmed, no intervention needed.

**But `spread` is now measured against a contaminated projection.** Ratings
carry GW1–5 results, so `rawPts` partly reflects the same realised form the
actuals measure. `scale` is a ratio of means and is largely safe. `spread` is a
ratio of standard deviations and is not: `sd(proj)` inflates, so `spread` is
biased **downward**. Illustrative simulation, relative sizes only:

| FDR state | bias in learned `spread` |
|---|---|
| frozen (pre-11.3) | baseline |
| defence weight at GW5 (0.21) | −5% |
| attack weight at GW5 (0.42) | −15% |
| attack weight at cap (0.65) | −28% |

A suppressed `spread` narrows `B`, and `CAL_BASE` deliberately carries a wider
slope for MID and FWD or the premiums stop separating. So this risks the
learning layer quietly undoing what the calibration was tuned to protect, and it
worsens as the weights ramp.

**Open decision:** hold `spread` at 1.0 while FDR carries in-season results and
no scored snapshots exist, keeping `scale` learning. Not implemented pending a
call. Snapshots only begin at the next deadline, so this stays live for roughly
a month either way.

Partial mitigation: `oddsFor` overrides ratings entirely where bookmaker prices
exist, and `rawPts` is stored for the next gameweek only, so when odds are
present the contaminated ratings barely touch the projection. Odds reflect the
same results, so this reduces the exposure rather than removing it. The odds key
is per-browser and not committed, so the ratings path is live most of the time.

## Pre-deadline snapshot — shipped
`scripts/snapshot-predictions.mjs` plus `.github/workflows/snapshot.yml`.

Runs the **real app** headless via Playwright rather than porting the model to
Node: a second implementation could drift from the one that produces the
projections, and a backtest measuring a drifted copy is worthless.

The window is the design. It runs **after the deadline** (picks are not visible
before it) and **before first kickoff** (ratings must not yet carry the round's
results), roughly 90 minutes. Outside it, nothing is written. A missing snapshot
is recoverable; a contaminated one poisons every future measurement. Hourly
cron, gated by a sub-second check so an idle hour costs nothing.

**It builds the model twice on purpose.** `learnFromResults()` writes the learned
calibration at the *end* of a build, so a first build in a fresh profile uses
base calibration while a returning browser applies stored learning at boot.
Building twice makes the snapshot reflect the learned state and derives it from
the data rather than from one browser's localStorage. This only terminates
because the v11.2.1 fix removed the feedback loop.

Each snapshot records `cal`, `learn` and `oddsUsed` alongside the predictions,
so a future backtest can separate a model change from a genuine accuracy change.

Not yet exercised against the live site: the FPL API and the Pages site are both
outside the build container's allowlist, so the Playwright path is untested. If
`loadAll` times out on the first real run, raise the 180s budget first.

Collection starts at the next deadline. GW1–5 are unrecoverable.

## Rejected approaches — don't retry without new evidence
- **Heavy FIXTURE_AMP** (was 3.2): made McBurnie outscore João Pedro.
- **Pure MAE fitting** on MID/FWD: compresses premiums into the pack.
- **Spread-matching solver** on the full 292 set: collapses B toward zero.
- **Blending the old strength model** (FDR_MIX): removed at v7.4.1, added nothing.
  Note v11.3 reintroduces `FDR_MIX` for a different purpose — blending the
  xG-based ratings, not the old strength model. Not the same thing.
- **Decaying last-season rows by recency**: shifts DefCon hit-rate and keeper
  goals-prevented at the pre-season state, moving the GW1–8 baseline for no gain.
- **Learning from `pl.total / gwPlayed`**: the v11.2.1 bug above. Any future
  "season average" shortcut reintroduces it.
- **Porting the model to Node for backtesting**: rejected in favour of driving
  the real app headless. Two implementations of the calibration is the failure
  mode, not the solution.

## Expected minutes — the dominant error source
Minutes error correlates **0.92** with points error. Fitted per position from
start rate, duration when starting, and price relative to club maximum for
players with no history. Watch for: non-appearances counted as starts
(`start_min` is 0 both for a starter and for an unused sub — require mins > 0).

**Open decision, deliberately not touched:** `xMins = mins / gwPlayed` uses the
same divide-by-league-gameweeks pattern that was a bug in the learning layer.
Here it is arguably correct, since a player who misses weeks should carry a
lower minutes expectation for rotation and injury risk. It is only wrong if the
points model applies an availability discount elsewhere as well, in which case
it is counted twice. Decide before touching anything near it.

## Carried, not yet shipped
`ftFromFeed()`'s local fallback still grants a free transfer on a Wildcard or
Free Hit week, the same bug fixed in the feed at v11.2.1. It only runs when the
feed has no `ftAvailable`, which no longer happens, so it is harmless. Fold in
next time `app-core.js` is open rather than releasing for it.

## Known unfixable until more gameweeks accrue
Players whose role changed without their record changing — Grealish, Reijnders,
Tavernier. Flagged with the amber caution badge via squad over-allocation, not
corrected, because nothing in the data says by how much. The v9.3.3 weighting
shortens how long this persists.

## Free transfer rules — verified, 2026/27
Derived from observed `transferCost` across seven managers, 28 of 28 consistent:
- GW1 is unlimited, so nothing banks and **GW2 always starts at exactly 1**.
- A Wildcard or Free Hit week **carries the bank unchanged** — transfers are
  free, and no weekly one is added either.
- Otherwise one is added per week, capped.
`transferCost` is ground truth: a hit means `ft = transfers − cost/4`. The feed
reconciles against it and logs any disagreement, so it self-heals if FPL changes
the rules again.
