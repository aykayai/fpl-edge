# xFPL algorithm — notes

**Current accuracy** (v8.2 fit, unchanged at v9.3.3): 292-player 8GW set MAE
**5.38**, bias −0.15. 440 per-gameweek observations MAE **0.496**, bias −0.18.
Rank correlation by position: GK 0.80, DEF 0.69, MID 0.56, FWD 0.69.

The reference sets are a **pre-GW1 snapshot** — projections *for* 2026/27 made
with no completed matches in the model's state. Anything gated on this-season
data is therefore inert against them by construction, and those numbers stay
valid. They stop being a live measure of accuracy the moment real gameweeks
accrue; the actuals feed replaces them for that.

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
Two places govern how much this season counts, and both were changed together.
Neither moves a pre-season projection.

**`windowStats` — recency and season weighting.** Each appearance now carries
a weight: this season `SEASON_W (2.0) × 0.5^(appsAgo / HALF_LIFE (6))`, last
season `1`, faded toward `LAST_FLOOR (0.35)` over the first `FADE_OVER (12)`
matches of this season.

Two constraints hold the pre-season baseline exactly:
- The decay runs over **this season's appearances only**; last-season rows stay
  flat. Fading a last-season-only history would move every pre-season number.
- The last-season fade is a function of this-season match count, so at zero it
  is exactly 1.

Counts (`apps`, `mins`, `starts`, goals) stay **raw** — they are evidence gates
(`wd.apps>=8`, `wq.mins>600`) and weighting them would silently shift the
thresholds. Only rates are weighted. Keeper goals-prevented now reads the
weighted `gp90` rather than dividing raw `gp` by raw `mins`, which would have
mixed weighted and unweighted quantities.

**`pick()` — smooth this-season ramp.** Previously this season's rate was
discarded entirely below 270 minutes whenever a player had last-season data,
then took over outright in one step. A striker three games into a hot run was
projected off last May until his fourth start. Now blends over `NOW_FULL`
(250 minutes): 1 match ≈ 36% this season, 3 matches ≈ 100%. At `mins=0` the
ramp is 0 and returns the prior unchanged.

Verified: with a last-season-only history, old and new `windowStats` agree to
1e-12 on every field; `pick()` is exactly equal at `mins=0` both with and
without last-season data.

## Rejected approaches — don't retry without new evidence
- **Heavy FIXTURE_AMP** (was 3.2): made McBurnie outscore João Pedro.
- **Pure MAE fitting** on MID/FWD: compresses premiums into the pack.
- **Spread-matching solver** on the full 292 set: collapses B toward zero.
- **Blending the old strength model** (FDR_MIX): removed at v7.4.1, added nothing.
- **Decaying last-season rows by recency**: shifts DefCon hit-rate and keeper
  goals-prevented at the pre-season state, moving the GW1–8 baseline for no
  gain. Last season is flat on purpose.

## Expected minutes — the dominant error source
Minutes error correlates **0.92** with points error. Fitted per position from
start rate, duration when starting, and price relative to club maximum for
players with no history. Watch for: non-appearances counted as starts
(`start_min` is 0 both for a starter and for an unused sub — require mins > 0).
Minutes already prefer this season: the appearance path switches to live rows
after 3 of them, so the v9.3.3 work deliberately left it alone.

## Calibration learning — known defects, not yet fixed
`learnFromResults()` is dormant until `gwPlayed >= 4` with 25+ players per
position. Three problems to fix before that gate opens:
1. **Feedback loop.** `proj` is read from `pl.gw[g].pts`, built with the
   *already-learned* CAL, then the ratio is applied back to `CAL_BASE`. Each
   load re-derives the correction from the error remaining after the previous
   one, which oscillates rather than converges. Should measure against a
   base-calibration projection.
2. **Absences double-counted.** `actual = pl.total / gwPlayed` divides by
   league gameweeks, not the player's appearances, biasing `scale` downward.
   Same shape as the historic minutes bug.
3. **Mismatched quantities.** Next gameweek's fixture-adjusted projection is
   compared against a flat season mean.

Also: `a.n<0` on an array is always false — dead guard, reads as protection
that isn't there. And `learn` lives in localStorage, so devices drift apart.

`S.playerActuals` from the actuals feed (per-player, per-gameweek points) is
the right input for 2 and 3. Fixing 1 properly wants the pre-deadline
predicted snapshot.

## Known unfixable until real gameweeks accrue
Players whose role changed without their record changing — Grealish, Reijnders,
Tavernier. Flagged with the amber caution badge via squad over-allocation, not
corrected, because nothing in the data says by how much. The v9.3.3 weighting
shortens how long this persists — a changed role now reprices within about six
appearances rather than being averaged against a full prior season.
