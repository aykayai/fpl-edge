/* Planner rules check (12 Oct 2026), one block per audit finding fixed in
   the rules batch. Real app in jsdom, real server, scheduler frozen. Every
   expected value is worked out here from the official rules, not taken from
   the app.

   F26  A sale credits the selling price: purchase price plus half the rise,
        rounded down to 0.1 (the official examples).
   F46  A transfer the bank cannot cover goes into the plan with a warning; Save refuses while over budget.
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
    weekPts,bestCombo,chipRuleBreak,freeTransfers,squadPlayers,startingXI,chipPlayed,VG,
    teamScore,chipCurve,chipTeam,teamRating,effectiveSquadIds,chipPlans,ftPath,chipWeighted,chipPlayer,legalBestXI,cmpSide,filtered,
    get CRELLIN(){return CRELLIN}}`, ctx);
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
  /* The rule itself, on the estimate path (no recorded purchase prices): the
     app then takes the purchase price as today's price less the season's
     change. With the tracker feed loaded the app reads each owned player's
     recorded price instead, so the feed is hidden for these four. */
  const tracker0 = S.tracker;
  if (tracker0) S.tracker = { ...tracker0, purchase: null };
  for (const [bought, now, want] of [[5.0, 5.5, 5.2], [5.0, 5.1, 5.0], [5.0, 4.8, 4.8], [7.0, 7.4, 7.2]]) {
    const got = g.sellPrice({ price: now, seasonChange: r1(now - bought) });
    check(got === want && officialSell(bought, now) === want, `F26 bought ${bought} now ${now} sells ${want}`, `app ${got}`);
  }
  S.tracker = tracker0;
  /* the purchase price the feed records for a player (FPL's own transfer
     history), else the estimate: data the app reads, not its arithmetic */
  const paidOf = p => {
    const pm = S.tracker && S.tracker.purchase && S.tracker.purchase.players;
    const r = pm && (pm[p.id] || pm[String(p.id)]);
    return r ? r.paid : (pm ? p.price : r1(p.price - (p.seasonChange || 0)));
  };
  {
    const pm = S.tracker && S.tracker.purchase && S.tracker.purchase.players;
    const owned = pm && S.model.players.find(p => pm[p.id] || pm[String(p.id)]);
    if (owned) check(g.sellPrice(owned) === officialSell(paidOf(owned), owned.price),
      `F26 a squad player sells from his recorded purchase price (${owned.web_name}: paid ${paidOf(owned)}, now ${owned.price})`, `app ${g.sellPrice(owned)}`);
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
  const wantBank = r1(bank0 + officialSell(paidOf(o1), o1.price) - i1.price);
  check(ok1 === true && Math.abs(g.planBank() - wantBank) < 0.001, "F26 the bank after a sale uses the selling price", `bank ${g.planBank()} want ${wantBank}`);
  restore(clean); g.render();

  /* ---------- F46 over budget: allowed in the plan, Save refuses (22 Nov 2026) ---------- */
  const o2 = sq.find(p => p.pos === 2) || sq[1];
  const room = g.planBank() + g.sellPrice(o2);
  const dear = P.filter(q => q.pos === o2.pos && !S.squad.includes(q.id) && q.price > room + 0.05).sort((a, b) => b.price - a.price)[0];
  const before = snapshot();
  const ok2 = g.applySwap(o2.id, dear.id);
  check(ok2 === true && g.planBank() < 0 && g.effectiveSquadIds(g.VG()).ids.includes(dear.id), "F46 an unaffordable swap goes into the plan, bank below zero", `returned ${ok2}, bank ${g.planBank()}`);
  check(/Over budget by £\d+\.\d/.test(toastText()) && doc.getElementById("toast").classList.contains("warn"), "F46 it warns how much over, in the warning style", toastText());
  g.render();
  const savedBefore = JSON.stringify(S.original);
  g.act("save");
  check(JSON.stringify(S.original) === savedBefore && /Over budget by £\d+\.\d/.test(toastText()) && !!doc.querySelector(".pz-head .pri.blocked"), "F46 Save refuses an overspent squad and shows as blocked", toastText());
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
  /* the Planner's week line under the gameweek scroller (21 Nov 2026) */
  const header = doc.querySelector(".pz-wl");
  check(header && /[-−]4 hit/.test(header.textContent), "F19 the week line shows the hit", header && header.textContent.replace(/\s+/g, " "));
  check(new RegExp(`${ftW + 1} transfers · -4 hit`).test(doc.getElementById("app").textContent), "F19 the planner shows the transfers and the hit");
  restore(clean); S.startGW = W; g.render();
  doSwaps(ftW);
  check(g.transfersIn(W) === ftW && g.hitCost(W) === 0, `F19 ${ftW} free and ${ftW} transfers costs nothing`, `transfers ${g.transfersIn(W)} hit ${g.hitCost(W)}`);
  restore(clean);
  check(g.planFT(Math.min(38, NEXT + 9)) === 5, "F19 free transfers stop at 5", `planFT ${g.planFT(NEXT + 9)}`);

  /* ---------- F61 + F19: a Wildcard week is free and unlimited ---------- */
  /* the next week if a Wildcard is still available for it, else the first
     week of the second half (the first-half Wildcard may already be played,
     as Andy's was in GW8) */
  let half = NEXT >= 20 ? "2" : "1", wcWeek = NEXT;
  if (g.chipRuleBreak("wildcard" + half, wcWeek) && half === "1") { half = "2"; wcWeek = Math.max(NEXT, 20); }
  if (!g.chipRuleBreak("wildcard" + half, wcWeek)) {
    S.chips = { ...S.chips, ["wildcard" + half]: wcWeek };
    S.startGW = wcWeek;
    const used3 = [];
    for (const o of sq.filter(p => p.pos >= 2).slice(0, 4)) { const i = cheapSwap(o, used3); if (!i) continue; used3.push(i.id); g.applySwap(o.id, i.id); }
    check(g.hitCost(wcWeek) === 0, "F19 a Wildcard week costs nothing however many transfers", `transfers ${g.transfersIn(wcWeek)} hit ${g.hitCost(wcWeek)}`);
    g.render();
    /* free transfers sit on the Bank figure, the chip on the week line (21 Nov 2026) */
    const ftStat = [...doc.querySelectorAll(".pz-st")].find(s => /Bank/i.test(s.textContent)), wl = doc.querySelector(".pz-wl");
    check(ftStat && /Unlimited FT/.test(ftStat.textContent) && wl && /Wildcard/.test(wl.textContent), "F61 a Wildcard week shows Unlimited FT", ftStat && ftStat.textContent.replace(/\s+/g, " "));
  } else check(false, `F61 setup: a Wildcard could be planned for GW${wcWeek}`, g.chipRuleBreak("wildcard" + half, wcWeek));
  restore(clean); g.render();

  /* ---------- Team Planner (21 Nov 2026): menu, chip buttons, scroller ---------- */
  S.startGW = NEXT; g.render();
  {
    const c = doc.querySelector(".pz-c[data-pid]"), id = c ? +c.getAttribute("data-pid") : null;
    g.act("pmenu", id);
    const items = [...doc.querySelectorAll(".pz-menu button")].map(b => b.textContent.trim());
    check(items.includes("Substitute") && items.includes("Player card"), "Planner: a right-click opens the player menu", items.join("|"));
    g.act("sqview", "pitch");
    check(!doc.querySelector(".pz-menu") && S.pMenu == null, "Planner: any other action closes the menu");
    check(doc.querySelectorAll(".pz-cbs .pz-cb").length === 4, "Planner: one row of four chip buttons");
    const pills = doc.querySelectorAll(".pz-scr .pz-gp"), on = doc.querySelector(".pz-scr .pz-gp.on");
    check(pills.length === 8 && on && on.textContent.includes("GW" + NEXT), "Planner: the gameweek scroller shows eight weeks with the one in view lit");
    /* drag a bench player onto a starter: same position always works, the formation follows when legal */
    const keepXI = S.forceXI, xi0 = g.startingXI(), bench0 = g.squadPlayers().filter(p => !xi0.includes(p) && p.pos > 1);
    const b = bench0[0], x = b && xi0.find(p => p.pos === b.pos);
    if (b && x) { g.act("dragsub", b.id, x.id);
      const xi1 = g.startingXI().map(p => p.id);
      check(xi1.includes(b.id) && !xi1.includes(x.id), `Planner: dragging ${b.web_name} onto ${x.web_name} substitutes them`); }
    else check(false, "Planner setup: a bench outfielder with a starter in his position");
    const draggable = doc.querySelectorAll(".pz-c[draggable=true]").length;
    check(draggable === 15, `Planner: all 15 players can be dragged in an editable week (${draggable})`);
    S.forceXI = keepXI; g.render();
  }
  /* ---------- a finished week (22 Nov 2026): summary, results, events, prediction pills, review ---------- */
  {
    const fin = ((S.tracker && S.tracker.gw) || []).filter(r => Array.isArray(r.picks) && r.picks.length && r.event < NEXT).map(r => r.event).sort((a, b) => b - a)[0];
    if (fin) {
      g.act("startgw", fin); await new Promise(r => setTimeout(r, 2500)); g.render();
      const cards = doc.querySelectorAll(".pz-pitch.past .pz-c");
      check(cards.length === 15 && doc.querySelectorAll(".pz-pitch.past .pv-pills").length === 15 && doc.querySelectorAll(".pz-pitch.past .pv-res").length >= 15 && !doc.querySelector(".pz-pitch.past .pz-xf"),
        `Finished week GW${fin}: every card has its result and prediction pills, and no edit buttons`, cards.length);
      check(!!doc.querySelector(".pv-sum") && /GW\d+ points/.test(doc.querySelector(".pv-sum")?.textContent || "") && !!doc.querySelector(".pv-rev") && !doc.querySelector(".poolpanel") && /read-only/.test(doc.querySelector(".pz-head")?.textContent || ""),
        `Finished week GW${fin}: the summary bar, the GW Review in place of the Player Pool, read-only head`);
      g.act("startgw", NEXT);
    } else check(false, "Finished week setup: an official week before the next deadline");
  }
  /* ---------- Compare v3, the List view, the Player Pool filters (21 Nov 2026) ---------- */
  {
    g.act("compare");
    const md = doc.querySelector(".modal .mbox.cv");
    check(!!md && S.cmp.a === "cur" && S.cmp.b === "plan" && md.querySelectorAll(".cv-pz").length === 2 && md.querySelectorAll(".cv-pz .pz-c").length === 30,
      "Compare: current team on the left, your plan on the right, two Planner pitches of 15", md && md.querySelectorAll(".cv-pz .pz-c").length);
    const A = g.cmpSide("A"), outB = g.cmpSide("B").xi.find(p => p.pos > 1);
    g.act("cmprepl", "B", outB.id);
    const opts = [...doc.querySelectorAll(".cv-repl button")];
    check(opts.length > 0, `Compare: the transfer button lists replacements for ${outB.web_name} (${opts.length})`);
    const inId = +((opts[0]?.getAttribute("onclick") || "").match(/cmpswap','B',\d+,(\d+)/) || [])[1];
    if (inId) { g.act("cmpswap", "B", outB.id, inId);
      const B2 = g.cmpSide("B");
      check(B2.ids.includes(inId) && !B2.ids.includes(outB.id) && B2.edited && g.cmpSide("A").ids.join() === A.ids.join(), "Compare: a transfer edits that side only"); }
    const B3 = g.cmpSide("B"), bb = B3.bench.find(p => p.pos > 1), bx = bb && B3.xi.find(p => p.pos === bb.pos);
    if (bb && bx) { g.act("cmpsub", "B", bb.id, bx.id); const B4 = g.cmpSide("B");
      check(B4.xi.some(p => p.id === bb.id) && !B4.xi.some(p => p.id === bx.id), "Compare: dragging a bench player on substitutes on that side"); }
    g.act("cmpsrc", "B", "fh");
    check(S.cmp.b === "fh" && !S.cmp.ed.B && /Play Free Hit with B/.test(doc.querySelector(".cv-acts")?.textContent || ""), "Compare: picking Best Free Hit offers to play it with B", (() => { try { const T = g.cmpSide("B"); return "ids " + (T && T.ids ? T.ids.length : T && T.sub); } catch (e) { return "throws " + e.message; } })() + " | foot: " + (doc.querySelector(".cv-acts")?.textContent || "none").replace(/\s+/g, " ").slice(0, 120) + " | app: " + (doc.getElementById("app").textContent.match(/hit a problem.{0,200}/) || ["no error"])[0]);
    g.act("cmpclose");
    check(!doc.querySelector(".mbox.cv"), "Compare closes");
  }
  {
    g.act("sqview", "list");
    const groups = [...doc.querySelectorAll(".lv .lv-g span")].map(s => s.textContent);
    check(doc.querySelectorAll(".lv .lv-r").length === 15 && groups.join("|") === "Goalkeeper|Defenders|Midfielders|Forwards|Bench", "List: 15 rows grouped by position, bench last", groups.join("|"));
    g.act("sqsort", "total");
    const tots = [...doc.querySelectorAll(".lv .lv-r .lv-total")].map(e => +e.textContent);
    check(!doc.querySelector(".lv .lv-g") && tots.length === 15 && tots.every((t, i) => !i || tots[i - 1] >= t), "List: a header click sorts the whole squad high to low");
    g.act("sqsort", "total");
    const tots2 = [...doc.querySelectorAll(".lv .lv-r .lv-total")].map(e => +e.textContent);
    check(tots2.every((t, i) => !i || tots2[i - 1] <= t), "List: a second click reverses it");
    S.sqSort = "pos"; S.sqDir = "asc"; g.act("sqview", "pitch");
  }
  {
    const all = g.filtered("planner").length;
    g.act("fmax", 5.5);
    const cheap = g.filtered("planner");
    check(cheap.length < all && cheap.every(p => p.price <= 5.5 + 1e-9) && /up to 5\.5/.test(doc.querySelector(".pf-chips")?.textContent || ""), "Pool: the price filter (£0.1m steps) narrows the list and shows on its chip");
    g.act("poolpop", "price");
    const rng = doc.querySelector(".pf-pop input[type=range]");
    check(!!rng && rng.getAttribute("step") === "0.1", "Pool: the price slider moves in £0.1m steps");
    g.act("fitonly");
    check(g.filtered("planner").every(p => p.avail >= 1), "Pool: Fit only hides doubts and injuries");
    g.act("fitonly"); g.act("fmax", 16); S.poolPop = null; g.render();
    /* compact rows (22 Nov 2026): squad players carry Player Data's tags */
    const tags = [...doc.querySelectorAll(".plist .prow.pr2.mine .pdrole")].map(e => e.textContent);
    check(doc.querySelectorAll(".plist .prow.pr2").length > 0 && tags.length > 0 && tags.every(t => /^(XI|Bench|C|VC)$/.test(t)) && !/in squad/.test(doc.querySelector(".plist").textContent),
      "Pool: compact rows tag your players XI, Bench, C or VC as Player Data does", tags.join(","));
  }
  {
    const W2 = Math.max(NEXT, 20), keep = { ...S.chips };
    S.startGW = W2; g.render();
    if (!g.chipRuleBreak("wildcard2", W2)) {
      g.act("achip", "wildcard");
      const wc = [...doc.querySelectorAll(".pz-cb")].find(b => /Wildcard/.test(b.textContent));
      check(S.chips.wildcard2 === W2 && wc && wc.classList.contains("active") && /Build team/.test(wc.textContent) && /cmpopen','wc'/.test(wc.getAttribute("onclick") || ""),
        `Planner: the Wildcard button plays it in GW${W2} and then opens its best team`, wc && wc.textContent.replace(/\s+/g, " "));
    } else check(false, `Planner setup: a Wildcard could be played in GW${W2}`);
    S.chips = keep; S.startGW = NEXT; g.render();
  }

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
  /* Chips page (20 Nov 2026): one team score. A chip's gain is the team
     score with the chip minus without, and Team Rating divides by the same
     Free Hit team's score the Chips page and Compare show. */
  {
    const gw = S.model.next.id, ids = g.effectiveSquadIds(gw).ids;
    const bb = g.teamScore(ids, gw, "bboost") - g.teamScore(ids, gw, null);
    const cv = g.chipCurve(gw <= 19 ? "bboost1" : "bboost2")[gw];
    if (cv) check(Math.abs(cv.raw - bb) < 0.06, "Chips: Bench Boost gain is the team score with the chip minus without", `${cv.raw} vs ${bb.toFixed(2)}`);
    const r = g.teamRating(), T = g.chipTeam("freehit", gw, true);
    if (r && T) check(Math.abs(r.best - g.teamScore(T.ids, gw, null)) < 0.01, "Chips: Team Rating uses the Free Hit team's team score", `${r.best} vs ${g.teamScore(T.ids, gw, null)}`);
    const plans = g.chipPlans();
    check(plans.every(p => new Set(Object.values(p.pick).map(x => x[0])).size === Object.keys(p.pick).length), "Chips: every plan has one chip per week");
    /* 21 Nov 2026: plans listed highest total first, Most Points the highest */
    check(plans.every((p, i) => i === 0 || plans[i - 1].tot >= p.tot), "Chips: plans are listed highest total first", plans.map(p => p.tot.toFixed(1)).join(", "));
    if (plans.length) check(plans[0].name === "Most Points", "Chips: Most Points is the top plan", plans[0].name);
    /* 21 Nov 2026: the Wildcard is valued against one free transfer a week.
       The path is five legal squads, each at most one player from the last */
    {
      const e0 = Math.max(gw, 20), path = g.ftPath(ids, e0, e0 + 4);
      const legal = sq => sq.length === 15 && (() => { const c = {}; sq.forEach(i => { const p = g.chipPlayer(i); c[p.team] = (c[p.team] || 0) + 1; }); return Object.values(c).every(n => n <= 3); })();
      const moves = path.map((sq, i) => (i ? path[i - 1] : ids).filter(x => !sq.includes(x)).length);
      check(path.length === 5 && path.every(legal) && moves.every(n => n <= 1), "Chips: the free-transfer path is five legal squads, one transfer a week", JSON.stringify(moves));
    }
    /* a forecast double naming a bench player's club raises the Bench Boost
       for that week; one naming nobody's club leaves the plain gain */
    {
      const e0 = Object.keys(g.CRELLIN.weeks).map(Number).find(e => e >= gw && g.CRELLIN.weeks[e].t === "double");
      if (e0) {
        const keepW = g.CRELLIN.weeks[e0], ids0 = g.effectiveSquadIds(e0).ids, sp = ids0.map(g.chipPlayer).filter(Boolean);
        const pv = p => p.gw[e0]?.pts || 0, xi = g.legalBestXI(sp, pv), bench = sp.filter(p => !xi.includes(p) && pv(p) > 0);
        const raw = g.teamScore(ids0, e0, "bboost") - g.teamScore(ids0, e0, null);
        if (bench.length && g.chipWeighted("bboost", e0, raw, ids0).f) {
          const club = S.model.teams.find(t => t.id === bench[0].team).short;
          g.CRELLIN.weeks[e0] = { ...keepW, teams: [club] };
          const up = g.chipWeighted("bboost", e0, raw, ids0).v;
          g.CRELLIN.weeks[e0] = keepW;
          check(up > raw + 0.01, `Chips: a forecast double for ${club} raises the Bench Boost in GW${e0}`, `${raw.toFixed(2)} -> ${up.toFixed(2)}`);
        }
      }
    }
    /* placing a chip on the roadmap (click a chip, then a week) plans it, and
       the Planner shows it for that week: one shared plan */
    const k2 = ["bboost2", "3xc2", "freehit2", "wildcard2"].find(k => g.chipPlayed(k) == null);
    if (k2) {
      const keep = S.chips, wk = Math.max(gw, 20) + 3;
      S.chips = Object.fromEntries(Object.entries(S.chips || {}).filter(([k, e]) => k !== k2 && e !== wk));
      g.act("chippick", k2); g.act("chipplace", wk);
      check(S.chips[k2] === wk && !S.chipPick, `Chips: placing ${k2} on GW${wk} plans it`, JSON.stringify(S.chips));
      check(vm.runInContext(`chipForWeek(${wk})`, ctx) === k2.replace(/2$/, ""), "Chips: the Planner shows the placed chip for that week", vm.runInContext(`chipForWeek(${wk})`, ctx));
      /* 21 Nov 2026: the selected plan holds a planned chip in its week, and
         clicking that week again clears it */
      const sp = vm.runInContext("chipSelectedPlan()", ctx);
      if (sp) check(sp.pick[k2] && sp.pick[k2][0] === wk, "Chips: the selected plan keeps a planned chip in its week", JSON.stringify(sp.pick));
      g.act("chipset", k2, wk);
      check(S.chips[k2] == null, "Chips: clicking the planned week again clears the chip", JSON.stringify(S.chips));
      S.chips = keep;
    }
  }
  /* the rebuilt Chips page (20 Nov 2026, v3 21 Nov) marks a played chip on
     its roadmap, lists it in Chips Used and offers no best week for it */
  if (free1 != null) {
    const html = doc.getElementById("app").innerHTML, sec = id => (doc.getElementById(id) || {}).innerHTML || "";
    check(new RegExp(`GW${free1}: Free Hit played`).test(html), "F47 the Chips page shows a played chip as used");
    check(!/<b>Free Hit 1<\/b>/.test(sec("r-chleft")), "F47 a played chip gets no best week on the Chips page");
    check(/<b>Free Hit 1<\/b>/.test(sec("r-chused")), "F47 a played chip is listed in Chips Used");
  }
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
