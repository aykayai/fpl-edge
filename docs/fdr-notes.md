fdr-notes
FDR algorithm — notes
Current accuracy vs reference (ref_fdr.csv, 20 clubs, 38 GWs):
Attack MAE 0.30, bias −0.02, rank correlation 0.85.
Defence MAE 0.25, bias +0.02, rank correlation 0.76.
How it works
Team ratings → multiplicative Poisson goal model → percentile banding.
Ratings blend expected goals with actual goals (62/38). xG alone misses
persistent keeper and finishing quality: Man City conceded 0.92 against an xGA
of 1.18, and rating them on xGA made them look softer than Everton.
Rolling form: closing eight matches weighted 40% against the season's 60%.
Promoted clubs regressed 80/20 toward the league mean. Over-regressing
(was 62/38) put Hull's defence better than the worst measured Premier League side.
Banding
Percentile-based, not a fixed goals-per-band step. A linear step cannot be both
skewed toward 2–3, as the published tickers are, and reach band 5 at the
extremes — the spread of expected goals is only about ±0.6 goals.
Separate mixes per lens, because clean sheets are rarer than goals:
BAND_MIX_ATT = [0.06, 0.18, 0.32, 0.29, 0.15] — reads hardest-first
BAND_MIX_DEF = [0.05, 0.16, 0.32, 0.30, 0.17] — reads easiest-first
The attack array is consumed in the opposite direction — low expected goals
for means a hard fixture. Getting this backwards inverted our levels once.
Position awareness
Defenders read the opponent's attack; attackers read their defence. The Fixtures
tab lens toggle overrides this; player chips default to position-aware.
Feeds the projection
The continuous expected-goals values feed xFPL directly. The 1–5 band is display
only — changing the band mix does not move a single predicted point.
