/* Planner rules check (12 Oct 2026), one block per audit finding fixed in
   the rules batch. Real app in jsdom, real server, scheduler frozen. Every
   expected value is worked out here from the official rules, not taken from
   the app.

   F26  A sale credits the selling price: purchase price plus half the rise,
        rounded down to 0.1 (the official examples).
   F46  A transfer the bank cannot cover is refused; bank and squad unchanged.
   F19  Each transfer beyond the free ones costs 4; free transfers grow by one
        a week to a cap of 5; Wildcard and Free Hit weeks are free.
   F47  Chip plans that break the rules are refused with a reason.
   F60  Best combination never swaps a player for himself.
   F61  A Wildcard week shows Unlimited transfers.

   Usage: STATE_DIR=... JSDOM_DIR=... node server/test_rules.mjs
   Optional: PORT (default 8110). */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";

process.env.TZ = "Europe/London";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8110);
const BASE = `http://127.0.0.1:${PORT}`;
const STATE_DIR = process.env.STATE_DIR;
if (!STATE_DIR) { console.error("Set STATE_DIR to a populated server state dir."); process.exit(2); }
function loadJSDOM() {
  for (const dir of [process.env.JSDOM_DIR, ROOT, process.cwd()].filter(Boolean)) {
    try { return createRequire(join(dir, "x.js"))("jsdom"); } catch { /* next */ }
  }
  console.error("jsdom not found. Set JSDOM_DIR."); process.exit(2);
}
const { JSDOM } = loadJSDOM();
const FILES = ["app-core.js", "app-squad.js", "app-render.js", "app-odds.js", "app-tracker.js", "app-main.js"];
let pass = 0, fail = 0;
const check = (ok, name, detail) => {
  if (ok) { pass++; console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + (detail ? " -- " + detail : "")); }
};
const r1 = n => Math.round(n * 10) / 10;
/* the official selling price, written from the rule, not the app */
const officialSell = (bought, now) => now <= bought ? now : r1(bought + Math.floor(r1(now - bought) * 10 / 2) / 10);

function startServer() {
  const child = spawn(process.execPath, [join(ROOT, "server", "server.mjs")], {
    env: { ...process.env, PORT: String(PORT), STATE_DIR, ODDS_API_KEY: "", SIGNALS_TICK_MS: "86400000" },
    stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", () => {}); child.stderr.on("data", d => process.stderr.write("[server] " + d));
  return child;
}
async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE + "/data/insights/2026-2027/players.csv", { method: "HEAD" })).ok) return; } catch { /* not up */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error("server did not come up at " + BASE);
}

const server = startServer();
try {
  await waitForServer();
  const dom = new JSDOM(`<!DOCTYPE html><html><body><div class="wrap" id="app"></div></body></html>`,
    { url: "https://app.local/fpl/#/team-planner", runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window, ctx = dom.getInternalVMContext(), doc = w.document;
  w.fetch = async (url, opts) => {
    const s = String(url);
    if (!s.startsWith("/")) return { ok: false, status: 404, text: async () => "", json: async () => ({}), clone() { return this; } };
    const r = await fetch(BASE + s, opts); const t = await r.text();
    return { ok: r.ok, status: r.status, text: async () => t, json: async () => JSON.parse(t), clone() { return this; } };
  };
  w.AbortController = AbortController; w.setTimeout = setTimeout; w.clearTimeout = clearTimeout; w.scrollTo = () => {};
  w.setInterval = () => 0; w.console = { log() {}, warn() {}, error() {} };
  for (const f of FILES) vm.runInContext(readFileSync(join(ROOT, f), "utf8"), ctx, { filename: f });
  vm.runInContext(`window.__g={get S(){return S},render,act,sellPrice,applySwap,planBank,hitCost,planFT,transfersIn,
    weekPts,bestCombo,chipRuleBreak,freeTransfers,squadPlayers,chipPlayed,VG}`, ctx);
  const g = w.__g, S = g.S;
  const until = Date.now() + 180000;
  while (Date.now() < until && !(S.model && !S.loading)) await new Promise(r => setTimeout(r, 250));
  if (!S.model) throw new Error("app never built a model: " + (S.err || "none"));
  const NEXT = S.model.next.id;
  const toastText = () => (doc.getElementById("toast") || {}).textContent || "";
  const snapshot = () => JSON.stringify({ squad: S.squad, bank: S.bank, plan: S.planByGw, chips: S.chips });
  const restore = s => { const o = JSON.parse(s); S.squad = o.squad; S.bank = o.bank; S.planByGw = o.plan; S.chips = o.chips; S.startGW = NEXT; };
  S.startGW = NEXT; g.render();
  const clean = snapshot();

  /* ---------- F26 selling price ---------- */
  for (const [bought, now, want] of [[5.0, 5.5, 5.2], [5.0, 5.1, 5.0], [5.0, 4.8, 4.8], [7.0, 7.4, 7.2]]) {
    const got = g.sellPrice({ price: now, seasonChange: r1(now - bought) });
    check(got === want && officialSell(bought, now) === want, `F26 bought ${bought} now ${now} sells ${want}`, `app ${got}`);
  }
  const sq = g.squadPlayers();
  const P = S.model.players;
  /* an affordable like-for-like swap for a squad player */
  function cheapSwap(o, exclude = []) {
    return P.filter(q => q.pos === o.pos && !S.squad.includes(q.id) && !exclude.includes(q.id) && q.avail > 0
      && q.price <= o.price && P.filter(x => S.squad.includes(x.id) && x.team === q.team && x.id !== o.id).length < 3)
      .sort((a, b) => a.price - b.price)[0];
  }
  const o1 = sq.find(p => p.pos === 3) || sq[0];
  const i1 = cheapSwap(o1);
  const bank0 = g.planBank();
  const ok1 = g.applySwap(o1.id, i1.id);
  const wantBank = r1(bank0 + officialSell(r1(o1.price - (o1.seasonChange || 0)), o1.price) - i1.price);
  check(ok1 === true && Math.abs(g.planBank() - wantBank) < 0.001, "F26 the bank after a sale uses the selling price", `bank ${g.planBank()} want ${wantBank}`);
  restore(clean); g.render();

  /* ---------- F46 over budget refused ---------- */
  const o2 = sq.find(p => p.pos === 2) || sq[1];
  const room = g.planBank() + g.sellPrice(o2);
  const dear = P.filter(q => q.pos === o2.pos && !S.squad.includes(q.id) && q.price > room + 0.05).sort((a, b) => b.price - a.price)[0];
  const before = snapshot();
  const ok2 = g.applySwap(o2.id, dear.id);
  check(ok2 === false && snapshot() === before, "F46 an unaffordable swap is refused, bank and squad unchanged", `returned ${ok2}`);
  check(/Not enough in the bank: £\d+\.\d short/.test(toastText()) && doc.getElementById("toast").classList.contains("warn"), "F46 the refusal says how much is short, in the warning style", toastText());
  restore(clean); g.render();

  /* ---------- F19 hits ---------- */
  /* plan in the first week with no live score yet (a week in play shows its
     score, not a prediction) */
  const W = (S.actuals && S.actuals[NEXT] != null) ? NEXT + 1 : NEXT;
  const ft0 = g.freeTransfers();
  const ftW = Math.min(5, ft0 + (W - NEXT));          /* one added per week, cap 5 */
  S.startGW = W; g.render();
  check(g.planFT(W) === ftW, `F19 free transfers into GW${W}: ${ftW}`, `planFT ${g.planFT(W)}`);
  check(g.hitCost(W) === 0 && g.transfersIn(W) === 0, "F19 no transfers planned, no hit", `transfers ${g.transfersIn(W)} hit ${g.hitCost(W)}`);
  const doSwaps = n => { const used = []; let made = 0;
    for (const o of g.squadPlayers().filter(p => p.pos >= 2)) {
      if (made >= n) break; const i = cheapSwap(o, used); if (!i) continue;
      used.push(i.id); if (g.applySwap(o.id, i.id)) made++; }
    return made; };
  doSwaps(ftW + 1);
  check(g.transfersIn(W) === ftW + 1 && g.hitCost(W) === 4, `F19 ${ftW} free and ${ftW + 1} transfers costs 4`, `transfers ${g.transfersIn(W)} hit ${g.hitCost(W)}`);
  g.render();
  /* header figures are cards (.fc) since bundle 8 */
  const header = [...doc.querySelectorAll(".fc, .stat")].find(s => /Predicted/i.test(s.textContent));
  check(header && /[-−]4 hit/.test(header.textContent), "F19 the header shows the hit beside the predicted figure", header && header.textContent.replace(/\s+/g, " "));
  check(new RegExp(`${ftW + 1} transfers · -4 hit`).test(doc.getElementById("app").textContent), "F19 the planner shows the transfers and the hit");
  restore(clean); S.startGW = W; g.render();
  doSwaps(ftW);
  check(g.transfersIn(W) === ftW && g.hitCost(W) === 0, `F19 ${ftW} free and ${ftW} transfers costs nothing`, `transfers ${g.transfersIn(W)} hit ${g.hitCost(W)}`);
  restore(clean);
  check(g.planFT(Math.min(38, NEXT + 9)) === 5, "F19 free transfers stop at 5", `planFT ${g.planFT(NEXT + 9)}`);

  /* ---------- F61 + F19: a Wildcard week is free and unlimited ---------- */
  const half = NEXT >= 20 ? "2" : "1";
  const wcWeek = NEXT;
  if (!g.chipRuleBreak("wildcard" + half, wcWeek)) {
    S.chips = { ...S.chips, ["wildcard" + half]: wcWeek };
    const used3 = [];
    for (const o of sq.filter(p => p.pos >= 2).slice(0, 4)) { const i = cheapSwap(o, used3); if (!i) continue; used3.push(i.id); g.applySwap(o.id, i.id); }
    check(g.hitCost(wcWeek) === 0, "F19 a Wildcard week costs nothing however many transfers", `transfers ${g.transfersIn(wcWeek)} hit ${g.hitCost(wcWeek)}`);
    g.render();
    const ftStat = [...doc.querySelectorAll(".fc, .stat")].find(s => /Free transfers/i.test(s.textContent));
    check(ftStat && /Unlimited/.test(ftStat.textContent) && /Wildcard this week/.test(ftStat.textContent), "F61 a Wildcard week shows Unlimited", ftStat && ftStat.textContent.replace(/\s+/g, " "));
  } else check(false, "F61 setup: Wildcard could be planned for the next week", g.chipRuleBreak("wildcard" + half, wcWeek));
  restore(clean); g.render();

  /* ---------- F47 chip rules ---------- */
  const refused = (k, e, re, name) => {
    const before = JSON.stringify(S.chips);
    g.act("setchip", k, e);
    check(JSON.stringify(S.chips) === before && re.test(toastText()), name, toastText());
  };
  const free1 = g.chipPlayed("freehit1");
  if (free1 != null) refused("freehit1", 12, /already played in GW\d+/, `F47 Free Hit 1 played in GW${free1} cannot be planned again`);
  refused("freehit2", 1, /can only be played in GW20 to 38/, "F47 a second-half chip cannot go in the first half");
  refused("bboost1", 25, /can only be played in GW1 to 19/, "F47 a first-half chip cannot go in the second half");
  S.chips = { ...S.chips, bboost2: 24 };
  refused("3xc2", 24, /Only one chip per gameweek/, "F47 two chips in one gameweek are refused");
  S.chips = { ...S.chips, freehit2: 30 };
  refused("freehit1", 19, /can only|already played|two gameweeks in a row/, "F47 setup clash handled");
  delete S.chips.freehit2; delete S.chips.bboost2;
  /* the GW1 and back-to-back rules, with the played history set aside (Free
     Hit 1 is already played, which would answer first) */
  const keepT = S.tracker;
  S.tracker = { ...S.tracker, gw: (S.tracker.gw || []).map(r => ({ ...r, chip: null })) };
  check(/GW1/.test(g.chipRuleBreak("freehit1", 1) || ""), "F47 no Free Hit in GW1", g.chipRuleBreak("freehit1", 1));
  S.chips = { ...S.chips, freehit2: 20 };
  check(/two gameweeks in a row/.test(g.chipRuleBreak("freehit1", 19) || ""), "F47 Free Hit cannot go in consecutive weeks, across the halves too", g.chipRuleBreak("freehit1", 19));
  check(g.chipRuleBreak("freehit1", 17) == null, "F47 Free Hit two weeks apart is allowed", g.chipRuleBreak("freehit1", 17));
  delete S.chips.freehit2;
  S.tracker = keepT;
  check(g.chipRuleBreak("bboost2", 30) == null, "F47 a legal plan is allowed", g.chipRuleBreak("bboost2", 30));
  restore(clean); g.render();
  S.tab = "chips"; g.render();
  if (free1 != null) check(/Played in GW\d+ · used/.test(doc.getElementById("app").textContent), "F47 the Chips page shows a played chip as used");
  S.tab = "squad"; g.render();

  /* ---------- F60 best combination ---------- */
  const outIds = sq.filter(p => p.pos >= 2).slice(0, 3).map(p => p.id);
  const combo = g.bestCombo(outIds);
  const selfs = (combo && combo.picks || []).filter(m => m.inn.id === m.out.id || outIds.includes(m.inn.id));
  const nil = (combo && combo.picks || []).filter(m => !(m.gain > 0.05));
  check(combo && selfs.length === 0 && nil.length === 0, "F60 best combination has no self-swap and no zero-gain move", `self ${selfs.length} nil ${nil.length}`);
} catch (e) {
  fail++; console.log("FAIL  run aborted -- " + (e && e.stack || e));
} finally {
  server.kill();
}
console.log(`\n${pass} passed, ${fail} failed`);
if (!fail) console.log("All rules checks passed.");
process.exit(fail ? 1 : 0);
