xfpl-notes
xFPL algorithm — notes
Current accuracy (v8.2): 292-player 8GW set MAE 5.38, bias −0.15.
440 per-gameweek observations MAE 0.496, bias −0.18.
Rank correlation by position: GK 0.80, DEF 0.69, MID 0.56, FWD 0.69.
Shape of the model
Per-position calibration output = A × minutesFactor + B × rawComponents.
Raw components: appearance points, attacking output (xG×goalPoints + xA×3),
clean sheet (Poisson from expected goals conceded), DefCon, bonus, set pieces.
Constants that matter
CAL_BASE — fitted per position. MID and FWD carry a wider slope than least
squares gives, because minimising error alone pulls attackers toward the mean.
FIXTURE_AMP = 1.45 — deliberately light. It stretches a player around his own
average, which is blind to quality and reorders players if set high.
Fixture sensitivity comes from the xG multiplier raised to a power (1.9), which
multiplies and therefore cannot reorder two players in the same match.
Rejected approaches — don't retry without new evidence
Heavy FIXTURE_AMP (was 3.2): made McBurnie outscore João Pedro.
Pure MAE fitting on MID/FWD: compresses premiums into the pack.
Spread-matching solver on the full 292 set: collapses B toward zero.
Blending the old strength model (FDR_MIX): removed at v7.4.1, added nothing.
Expected minutes — the dominant error source
Minutes error correlates 0.92 with points error. Fitted per position from
start rate, duration when starting, and price relative to club maximum for
players with no history. Watch for: non-appearances counted as starts
(start_min is 0 both for a starter and for an unused sub — require mins > 0).
Known unfixable until real gameweeks accrue
Players whose role changed without their record changing — Grealish, Reijnders,
Tavernier. Flagged with the amber caution badge via squad over-allocation, not
corrected, because nothing in the data says by how much.
