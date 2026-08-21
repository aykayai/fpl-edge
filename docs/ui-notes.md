ui-notes
UI and bugs — notes
This chat's authority
May add or remove tabs, restructure navigation, and change any copy or layout
across the whole app. The xFPL and FDR chats change only their own logic.
Structure
Single file. Hash routing (#/team-planner, #/transfers, …) via the NAV
array — add or remove a page there and in the S.tab render switch.
Icon system
One shield silhouette, gradient plus gloss highlight, drawn as SVG. Differential
diamond, hot-streak flame, attack football, defence shield-and-tick, DefCon stop
sign, nailed stopwatch, caution triangle. Set pieces use the same shield.
Spacing gotcha: signal and set-piece groups are separate spans. Nesting flex
gaps made the join between groups wider than gaps within them — fixed with
display:contents so every badge sits in one flex row.
The recurring trap: stale caches
Several rounds have been lost to a build being live but showing old behaviour.
The service worker caches index.html separately from the browser cache, and an
installed PWA keeps its own again. When something "isn't working":
Check the footer version first.
Bump CACHE in sw.js on every release — always.
Clearing requires: uninstall the PWA, clear browser cache, hard reload.
Recent fixes worth remembering
Name-bar click called pick (prepares transfer) not card.
Two separate failure blocks existed in the Odds tab; editing one left the
other live. Check for duplicates before assuming an edit didn't apply.
Player Pool markup differed from what an edit assumed — verify the target
string exists before trusting a replacement.
