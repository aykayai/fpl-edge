# FDR notes

State of the fixture-difficulty model. Read before changing ratings or banding.
Approaches listed under "rejected" have been tried; do not retry without new evidence.

## Current design (v11.3.0)

**Ratings** (`buildRatings`, app-core.js)
- Base is last season: npxG/xG mix at 75/25, blended with actual goals at 62/38.
- Rolling form: closing eight matches of last season at 40%, season at 60%.
- Promoted clubs: Championship goals discounted by `CHAMP_ATT=0.62`, defence
  anchored at `PL_GF*1.18`, then regressed 80/20 toward the league mean.
- **New at 11.3: current-season blend.** Separate ramps for attack and defence.
- Normalised so the league averages `PL_GF=1.42` goals a side.
- Home advantage is club-specific and halved, so it is applied once per fixture.

**Difficulty** (`fdrCalc`) is multiplicative Poisson:
- `xGF = ourAtt * oppDef / PL_GF`
- `xGC = oppAtt * ourDef / PL_GF`
- Raw values escape via the `"xgf"` / `"xgc"` kinds and feed xFPL at `FDR_MIX=1.00`.

**Banding** (`buildBands` / `bandOf`) is percentile over all remaining fixtures.
`BAND_MIX_ATT` reads hardest-first, `BAND_MIX_DEF` easiest-first. Implied means
2.71 attack and 3.38 defence, against published 2.72 and 3.36.

## The current-season blend (added 11.3.0)

Before 11.3 the ratings used **zero** current-season data. `buildRatings` read
only `lastTeams` / `lastTeamStats` / `lastTeamRecent`, all sourced from `LAST`.
Five gameweeks into 2026-27 the ratings were still the pre-season numbers, and
the "rolling form" weight was the last eight matches of the *previous* season,
not a moving window. The player projection had moved on (`minsSrc="this season"`
from GW3, recent form ramping in over six gameweeks) so xFPL was learning while
FDR was frozen.

Weights are calibrated, not guessed. For each gameweek k of 2025-26 we took the
weight on games 1..k that best predicted the rest of that season:

| k | attack | defence |
|---|---|---|
| 4 | 0.55 | 0.00 |
| 8 | 0.60 | 0.10 |
| 12 | 0.65 | 0.50 |
| 16 | 0.60 | 0.70 |
| 20 | 0.60 | 0.55 |
| 24 | 0.65 | 0.75 |

Attack stabilises almost immediately then plateaus. Defence is worth close to
nothing before GW8, because early clean sheets are largely fixture luck, and
only catches up around GW16. A single shared ramp is wrong in both directions at
once, so they ramp separately:

    CUR_ATT_FULL=12, CUR_ATT_CAP=0.65    // cap reached GW8
    CUR_DEF_FULL=24, CUR_DEF_CAP=0.70    // cap reached GW17

Neither reaches 1.0: 38 games of prior still carry information that 20 games of
current form does not. The blend is applied after the whole prior chain, so it
corrects promoted clubs too, which is where the weakest priors sit. Per-club
weight is scaled by matches actually completed, so a side with games in hand is
not weighted as if it had played them.

Caveats for whoever reads this next: fitted on a single season, so treat the
constants as plus or minus 0.1. The fit used the league mean as the stand-in
prior, because 2024-25 is not in the FPL-Core-Insights feed; the real prior is
better than the league mean, which makes these weights slightly generous to the
current season if anything.

## Accuracy

Against the published pre-season ticker (`ref_fdr.csv`, 20 clubs): attack MAE
0.30, rank correlation 0.85; defence MAE 0.25, rank correlation 0.76. Note this
measures agreement with the pre-season ticker, **not** whether the ratings are
currently right.

Against actual 2026-27 output through GW5 (92 team-matches):

| | attack corr | attack MAE | defence corr | defence MAE |
|---|---|---|---|---|
| 11.2.1 frozen | 0.56 | 0.283 | 0.44 | 0.286 |
| 11.3.0 blended | 0.86 | 0.190 | 0.71 | 0.225 |

**That table is not out-of-sample.** The blend consumes the same GW1-5 results
it is scored against, so the improvement there is partly circular.

A proper out-of-sample test was run on 2025-26 instead: train on GW1..k, predict
GW(k+1)..(k+6), averaged over k=4..26.

| ratings | attack MAE | defence MAE |
|---|---|---|
| 11.3 split ramp | 0.2455 | 0.2531 |
| single 0.65 ramp | 0.2465 | 0.2578 |
| frozen (11.2.1) | 0.3134 | 0.2733 |
| current season only | 0.2725 | 0.2809 |

The blend is a genuine improvement over frozen ratings, and blending beats
using the current season alone. Note the split ramp's margin over a single flat
0.65 is small and sits mostly on defence: keep the split, but do not oversell
it. A live GW6+ test on 2026-27 is still worth running once results exist.

## Fixed at 11.3.0: the "Opp att" column

`app-render.js` fed its "Opponent attack strength" column from `f.diffDef`,
which is `bandOf(oppAtt * ourDef / PL_GF)` — clean-sheet difficulty, half of
which is the player's *own* defence. Ranking clubs by it ranked them by how
leaky they were. Simulated across all 760 team-fixtures, the column's ordering
tracked each club's own `def` almost exactly: Hull read band 5 in 47% of their
fixtures while rating 0.97 for attack, the weakest in the league; Coventry 37%;
Bournemouth 18%.

`oppAttOf(opp,home)` now returns a true opponent-attack band. Holding our
defence at the league average collapses `xGC` to the opponent's attack at that
venue, which is what a league-average side would expect to concede against them,
so it bands correctly against the same goals-conceded cuts. Exposed as
`f.oppAtt` on the fixture object. Ordering is now MCI 5.0, ARS 4.5, MUN 4.5 at
the top and HUL 2.0, SUN 2.5, IPS 2.5 at the bottom.

**Open, for the UI chat:** `app-render.js` line 356 still reads `f.diffDef`. It
needs to read `f.oppAtt`. Core-side work is done; the column is still wrong
until that one line changes.

## Banding, stabilised at 11.3.0

`buildBands` previously iterated the REMAINING schedule, so the sample shrank
through the season and the cuts drifted with it. Measured on the real 2026-27
schedule with ratings held fixed, defence cuts moved from 0.87/1.12/1.42/1.79 at
GW1 to 0.89/1.14/1.41/1.81 at GW34, putting 2-4% of fixture-sides on the wrong
side of a boundary. Small, and smaller than first assumed, but it confounded
rating movement with schedule attrition.

Cuts are now built from all 380 fixtures implied by the ratings, which exist in
every gameweek, so they move if and only if the ratings move. `buildBands` no
longer depends on `S.model`.

## Interaction with xFPL (added after 11.3.0)

Reported by the xFPL chat; thresholds re-derived here and binding frequency
measured, which they could not do without standing up the model.

**1. Clamp exposure is asymmetric, and 11.3 widens it.** xFPL applies

    nA=clamp(pow(xgf/PL_GF,1.9),.30,2.40)
    nD=clamp(pow(PL_GF/max(.35,xgc),1.9),.35,2.30)

Inverting the exponent: nA binds at xgf below 0.754 or above 2.251; nD binds at
xgc above 2.467 or **below 0.916**. Both nA bounds are genuinely extreme. The nD
high bound is not: xgc under 0.92 is an ordinary good-defence-against-weak-attack
fixture, which is precisely where defensive returns concentrate.

Measured across all 760 fixture-sides of the real 2026-27 schedule:

| ratings | nA low | nA high | nD low | nD high |
|---|---|---|---|---|
| 11.2.1 frozen | 2.4% | 2.4% | 0.7% | 6.8% |
| 11.3.0 at GW5 | 3.0% | 4.3% | 1.7% | 10.4% |
| 11.3.0 at GW12 attack cap | 7.2% | 6.6% | 3.4% | 15.4% |
| 11.3.0 at GW17 both caps | 9.1% | 8.2% | 4.7% | 18.4% |

So the blend takes nD high-clamping from roughly one fixture-side in fifteen to
nearly one in five, against 8.2% for nA at the same point. This is a real cost of
the ramp, not a rounding effect.

**It does not argue against 11.3**, and the mitigation is xFPL's. But it is a
live constraint on any future FDR tuning: anything that widens rating spread
further buys accuracy in the ratings and spends it against a clamp that is
already binding on one defensive fixture in five. If the ramps are ever raised
past their current caps, check this table again first.

**2. FDR_MIX=1.00 biases the xFPL learned `spread` downward.** Because ratings
now carry in-season results, rawPts partly reflects the same realised form the
calibration scores its actuals against. Their measurement: `scale` (ratio of
means) is largely safe; `spread` (ratio of standard deviations) runs about -15%
at the current 0.42 attack weight and up to -28% at the 0.65 cap. A suppressed
spread narrows B, and CAL_BASE deliberately carries a wider slope for MID and
FWD or the premiums stop separating. Recorded here because it is a consequence
of our ramp; xFPL is handling it.

## Open

- **Arsenal reading band 4 on the Player Data defender view is unexplained.**
  Under current ratings Arsenal's ceiling on that column is band 2 and they
  never reach 5, so the observation is not reproducible from the model. Either
  the live app was on a stale `LS.get("data")` cache, or the ARS seen was the
  fixture pill rather than the player's club. Not treated as fixed.
- **A live out-of-sample test on 2026-27.** Once GW6 is scored, build ratings
  from GW1-5 only and test against GW6. The ramps are validated on 2025-26 but
  not yet on this season.
- Coventry at 1.35 attack under the frozen ratings was too generous, 13th in the
  league for a side that had scored nothing. The blend pulls them to 1.02
  without touching `CHAMP_ATT`. Revisit `CHAMP_ATT` only if promoted clubs are
  still mis-rated once the blend is at its cap.

## Rejected

- **Elo-based difficulty.** `eloDiff()` returned a constant and was superseded by
  the Poisson model. Removed. Elo conflates attack and defence into one number,
  which is exactly what the two lenses need kept apart.
- **Rating defence on xGA alone.** Missed persistent goalkeeping quality: Man City
  conceded 0.92 a game against 1.18 xGA, making them look a softer fixture than
  Everton. Hence the 62/38 xG-to-actual blend.
- **Applying home advantage to both clubs in a fixture.** Doubled the intended
  swing. It is halved and applied once.
- **A single shared current-season ramp for attack and defence.** Proposed at
  11.3 and rejected before shipping: the calibration shows the two stabilise at
  very different rates. Out-of-sample the split is only modestly ahead
  (0.2455/0.2531 against 0.2465/0.2578), so this is a weak preference, not a
  strong one.
- **A within-season recency window** (last six matches weighted up, mirroring
  the closing-eight window used on last season). Built, tested, rejected: a flat
  current-season average wins at nearly every horizon.

      k= 8  w=0.0:0.3072  w=0.2:0.3116  w=0.4:0.3163  w=0.6:0.3217
      k=12  w=0.0:0.2687  w=0.2:0.2784  w=0.4:0.2882  w=0.6:0.2980
      k=16  w=0.0:0.2891  w=0.2:0.2854  w=0.4:0.2820  w=0.6:0.2788
      k=20  w=0.0:0.2427  w=0.2:0.2557  w=0.4:0.2720  w=0.6:0.2917

  Only k=16 favours any recency at all. Within a season the sample is too small
  for recency to be anything but noise, which is the opposite of the
  cross-season case where the closing-eight window does help. Do not retry
  without a materially larger sample.
- `CHAMP_DEF=0.70` was declared and never read. Removed at 11.3.0.

## Naming trap

`FDR_MIX` appears in `xfpl-notes.md` as removed at v7.4.1. That was the **old
strength-model blend**, a different quantity that happened to share the name.
The xG-based `FDR_MIX=1.00` that 11.3 feeds is not the thing that was removed.
Anyone reading the xFPL notes and concluding FDR_MIX is dead will be wrong.
