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
/* the season from the date, the app's rule: a season starts in August */
const SEASON_Y = (d => d.getUTCMonth() >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1)(new Date());
const SEASON = `${SEASON_Y}-${SEASON_Y + 1}`;
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
    try { if ((await fetch(BASE + `/data/insights/${SEASON}/players.csv`, { method: "HEAD" })).ok) return; } catch { /* not up */ }
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
    flagNow,flagTitle,startChance,newsDown,statusState,dsTile,dsChips,dsFace,hz4HTML,hzWeeks,lastNextHTML,applyHash,planWeeks,transferLog,capRecord,hPts,rankMilestones,teamRating,lkCalc,lkRankAt,lkTotalAt,ywSim,fieldEO10k,weekPtsFor,
    
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

  /* ---------- This Week batch 3 (22 Nov 2026): Team News, Price Watch, Fixture Outlook, Performance ---------- */
  {
    const b3 = vm.runInContext(`({tnRisk,tnStatus,tnOpen,wpStats,pwDue,pwRate,pwNextChange,foRun,pmWeeks,hPts,LS,squadPlayers,startingXI,VG})`, ctx);
    const G = NEXT, sq3 = b3.squadPlayers(), app = () => doc.getElementById("app"), q = s => [...doc.querySelectorAll(s)];
    const fx = (d, extra) => ({ opp: "AAA", home: true, diff: d, diffAtt: d, diffDef: d, ...(extra || {}) });
    const fake = o => ({ id: -1, pos: 3, avail: 1, status: "a", roleMins: 85, xMins: 85, news: "", gw: { [G]: { pts: 5, fixtures: [fx(3)] }, [G + 1]: { pts: 5, fixtures: [fx(3)] }, [G + 2]: { pts: 5, fixtures: [fx(3)] } }, ...o });
    const noYc = new Map([[-1, { yellow_cards: 0 }]]), fourYc = new Map([[-1, { yellow_cards: 4 }]]);
    /* the one risk rule (approved maths change) */
    check(!b3.tnRisk(fake(), G, 3, noYc), "Team News risk rule: a fit starter with three fixtures is not at risk");
    check(b3.tnRisk(fake({ avail: 0.75 }), G, 1, noYc), "Team News risk rule: a doubt (chance under 100) is at risk");
    check(b3.tnRisk(fake({ xMins: 50 }), G, 1, noYc), "Team News risk rule: a starter whose expected minutes dropped under 60 is at risk");
    check(G > 19 || b3.tnRisk(fake(), G, 1, fourYc), "Team News risk rule: one yellow from a ban is at risk");
    { const p = fake(); p.gw[G + 2] = { pts: 0, blank: true, fixtures: [] };
      check(b3.tnRisk(p, G, 3, noYc) && !b3.tnRisk(p, G, 1, noYc), "Team News risk rule: a blank counts only inside the window"); }
    check(b3.tnStatus(fake({ avail: 0, status: "i", news: "Hamstring injury - Expected back 29 Nov" }), G, noYc).k === "inj"
      && b3.tnStatus(fake({ status: "s" }), G, noYc).k === "sus" && b3.tnStatus(fake({ avail: 0.5, status: "d" }), G, noYc).l === "50% to play"
      && b3.tnStatus(fake({ xMins: 5, roleMins: 5 }), G, noYc).k === "bk", "Team News status: injured, suspended, doubt and back-up read from FPL's flag");
    /* the pop-up: your 15, a cell per gameweek, BGW/DGW wording, no Replace column */
    b3.LS.set("tnSeen", { t: 1700000000000, sc: {}, yc: {}, pen: {} });
    S.tab = "squad"; S.tnOpen = false; S.tnH = 5; g.act("pop", "warn");
    const tn = app().querySelector(".wp.tn");
    check(!!tn && q(".tn-rows .tn-row").length === sq3.length, "Team News lists your whole squad", tn ? String(q(".tn-rows .tn-row").length) : "no pop-up");
    check(S.tnSince === 1700000000000 && b3.LS.get("tnSeen").t > 1700000000000, "Team News: what's changed counts from when you last opened it, and the time is saved");
    const cells = q(".tn-rows .tn-row")[0].querySelectorAll(".tn-c").length;
    check(cells === Math.min(5, 39 - G), "Team News: one availability cell per gameweek in the window", String(cells));
    const tnText = tn ? tn.textContent : "";
    check(!/Blank|×2|Replace|Fitness and Risk/.test(tnText) && /Open on News page/.test(tnText) && /What's changed/.test(tnText), "Team News: BGW/DGW wording, no Replace column, a link to the News page");
    g.act("tnh", "ROS");
    check(q(".tn-rows .tn-row")[0].querySelectorAll(".tn-c").length === Math.min(8, 39 - G), "Team News: ROS shows up to eight gameweek cells");
    /* Price Watch */
    check(b3.pwDue({ pcp: 101 })[0] === "Tonight" && b3.pwDue({ pcp: 50, pcProj: [[0, 80, 3], [1, 105, 3]] })[0] === "Tomorrow"
      && b3.pwDue({ pcp: -60, pcProj: [[0, -70, -3], [1, -80, -3], [2, -90, -3]] })[0] === "> 2 days" && b3.pwDue({ pcp: 90, pcLock: new Date(Date.now() + 3600000).toISOString() })[0] === "Locked",
      "Price Watch: due is the first night FPL projects 100%, locked players never move");
    { const nx = b3.pwNextChange(), lon = new Date(nx).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
      check(nx > Date.now() && nx - Date.now() <= 86400000 && lon === "01:30", "Price Watch: the next change is the coming 01:30 UK time", lon); }
    { const keep = S.priceLog, now = Date.now(), cut = b3.pwNextChange() - 86400000, a = Math.max(cut + 60000, now - 3 * 3600000);
      if (now - a >= 0.6 * 3600000) {
        S.priceLog = { samples: [{ t: a, p: { 1: 40 } }, { t: now, p: { 1: 40 + 10 * (now - a) / 3600000 } }] };
        const r = b3.pwRate(1); check(r != null && Math.abs(r - 10) < 0.01, "Price Watch: per hour comes from the price log", String(r));
      }
      S.priceLog = { samples: [{ t: now, p: { 1: 40 } }] }; check(b3.pwRate(1) === null, "Price Watch: per hour waits for two samples");
      S.priceLog = keep; }
    g.act("pop", "price");
    const pw = app().querySelector(".wp.pw");
    check(!!pw && q(".pw-rows .pw-r").length === sq3.length && q(".pw-t .ds-tile").length === 6 && !/Price Moves/.test(pw.textContent), "Price Watch: one view, six tiles, your squad, no Price Moves tab");
    { const other = S.model.players.find(p => !sq3.includes(p));
      g.act("pwstar", other.id); g.act("pwtab", "watch");
      check(q(".pw-rows .pw-r").length === 1 && q(".pw-rows .ds-name")[0].textContent === other.web_name, "Price Watch: a starred player shows on the watchlist");
      g.act("pwstar", other.id); g.act("pwtab", "mine"); }
    /* Fixture Outlook: the one method */
    { const p = fake(); p.gw[G] = { pts: 5, fixtures: [fx(2, { diffAtt: 1 })] }; p.gw[G + 1] = { pts: 0, blank: true, fixtures: [] }; p.gw[G + 2] = { pts: 9, fixtures: [fx(4), fx(2)] };
      check(Math.abs(b3.foRun(p, G, 3, "all") - 3) < 1e-9 && Math.abs(b3.foRun(p, G, 3, "att") - (1 + 5 + 2) / 3) < 1e-9, "Fixture Outlook: the chip scale averaged, a blank counts 5, a double one easier"); }
    S.foH = 5; S.foLens = "all"; g.act("pop", "out");
    const fo = app().querySelector(".wp.fo");
    check(!!fo && q(".fo-rows .fo-r").length === sq3.length && q(".fo-cl.up").length === 3 && q(".fo-cl.dn").length === 3 && /Fixture Grid/.test(fo.textContent), "Fixture Outlook: your 15, three clubs to target, three to avoid, a link to the Fixture Grid");
    { const p0 = [...sq3].sort((a, b) => a.pos - b.pos || b3.hPts(b, G, 5) - b3.hPts(a, G, 5))[0], tot = q(".fo-rows .fo-r")[0].querySelector(".fo-tot").textContent;
      check(tot === b3.hPts(p0, G, 5).toFixed(1), "Fixture Outlook: the xPts column is the projected points over the window", tot); }
    g.act("folens", "def");
    check(/class="on"[^>]*>Defence/.test(app().innerHTML), "Fixture Outlook: the Attack/Defence toggle switches the lens");
    /* Performance */
    g.act("pop", "form");
    const pm = app().querySelector(".wp.pm");
    check(!!pm && q(".pm-rows .pm-r").length === sq3.length && /Positive/.test(pm.textContent) && /Negative/.test(pm.textContent) && /Expected vs actual/.test(pm.textContent), "Performance: your 15, the scatter, and Hot and Cold as Positive and Negative");
    { const vp = q(".pm-rows .pm-r").map(r => r.children[4].textContent).filter(t => t !== "–").map(t => +t.replace("−", "-"));
      check(vp.every((v, i) => !i || vp[i - 1] >= v), "Performance: the board is sorted by points against prediction", vp.join(",")); }
    { const names = new Set(sq3.map(p => p.web_name));
      const targets = [...pm.querySelectorAll(".pm-hr.tg")].map(r => r.querySelector(".ds-name").textContent);
      check(targets.every(n => !names.has(n)), "Performance: Targets are players you do not own", targets.join(", ")); }
    g.act("pmwin", "3");
    check(b3.pmWeeks(3).length === Math.min(3, NEXT - 1) && /class="on"[^>]*>Last 3/.test(app().innerHTML), "Performance: the window switch sets the weeks");
    g.act("popclose");
    /* the four cards, renamed */
    S.tab = "squad"; S.startGW = NEXT; g.render();
    const its = q(".pz-it").map(e => e.textContent);
    check(["Team News", "Price Watch", "Fixture Outlook", "Performance"].every(t => its.includes(t)) && !its.includes("Fitness and Risk") && !its.includes("Form"), "This Week cards: Team News, Price Watch, Fixture Outlook, Performance", its.join(", "));
  }

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
        /* the bench player worth most, so the check is the mechanism, not a near-zero player */
        const pv = p => p.gw[e0]?.pts || 0, xi = g.legalBestXI(sp, pv), bench = sp.filter(p => !xi.includes(p) && pv(p) > 0).sort((a, b) => pv(b) - pv(a));
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


  /* ---------- News (22 Nov 2026, Andy's redesign) ---------- */
  {
    /* server: categories, stricter player matching, feed parsing */
    const NT = await import("./lib/news-tag.mjs"), NM = await import("./lib/news.mjs");
    const cat = t => NT.categorise(t);
    check(cat("Raya set to have scan on injury") === "inj" && cat("Calafiori back in full training after a knee injury") === "ret"
      && cat("Saudi clubs ready January offer for Isak") === "trf" && cat("Fixture amendments for matches in January") === "bgw"
      && cat("Best weeks to play your Bench Boost") === "chip" && cat("Hull v Brighton team news: Kostoulas benched") === "team",
      "News: categories (injury, return beats injury, transfer, blanks and doubles, chips, team news)");
    check(cat("Haaland scores injury-time winner") !== "inj" && cat("Was Haaland's goal correctly ruled out?") !== "inj" && cat("Joe Gomez ruled out for six weeks") === "inj",
      "News: injury time and a disallowed goal are not injuries; 'ruled out for' is");
    const IX = NT.buildIndex([{ id: 1, first: "Diego", second: "Gómez Amarilla", web: "Gomez", team: "Brighton" }, { id: 2, first: "Joe", second: "Gomez", web: "Gomez", team: "Liverpool" },
      { id: 3, first: "James", second: "Justin", web: "Justin", team: "Leeds" }, { id: 4, first: "Justin", second: "Kluivert", web: "Kluivert", team: "Bournemouth" },
      { id: 5, first: "Keane", second: "Andrews", web: "Andrews", team: "Coventry City" }, { id: 6, first: "Kristoffer", second: "Ajer", web: "Ajer", team: "Brentford" },
      { id: 7, first: "Pascal", second: "Groß", web: "Groß", team: "Brighton" }]);
    const tag = t => NT.tagPlayers(t, IX).sort().join(",");
    check(tag("Joe Gomez ruled out for six weeks") === "2" && tag("Gomez starts for Brighton") === "1" && tag("Gomez to miss out") === "",
      "News: stricter matching: a shared surname needs the first name or the club", [tag("Joe Gomez ruled out for six weeks"), tag("Gomez starts for Brighton"), tag("Gomez to miss out")].join(" | "));
    check(tag("Justin Kluivert scores again") === "4" && tag("Leeds full-back Justin back in training") === "3",
      "News: another player's full name is not a match ('Justin Kluivert' is not James Justin)", tag("Justin Kluivert scores again"));
    check(tag("Brentford: Andrews hails Kristoffer Ajer's start") === "6" && tag("Gross rested as Brighton rotate") === "7",
      "News: a lone surname with another club named is not a match; ß reads as ss", tag("Brentford: Andrews hails Kristoffer Ajer's start"));
    check(NT.tagPlayers("Justin Kluivert News: Back in training", IX, null, true).join() === "4" && NT.tagPlayers("Gomez starts for Brighton", IX, null, true).length === 0,
      "News: strict sources (RotoWire) need the full name");
    const xml = `<rss><channel>
      <item><title>Raya &lt;b&gt;scan&lt;/b&gt; latest</title><link>https://example.com/a</link><pubDate>${new Date().toUTCString()}</pubDate>
        <media:thumbnail width="240" url="https://img.example.com/s.jpg"/><media:content width="976" url="https://img.example.com/l.jpg"/>
        <description><![CDATA[<p>He goes for a scan on Monday.</p><p>The post Raya scan latest appeared first on Some Site.</p>]]></description></item>
      <item><title>Undated story</title><link>https://example.com/b</link></item>
      <item><title>Evil link</title><link>javascript:alert(1)</link><pubDate>${new Date().toUTCString()}</pubDate></item>
      <item><title>Plain picture</title><link>https://example.com/c</link><pubDate>${new Date().toUTCString()}</pubDate><enclosure url="http://img.example.com/x.jpg" type="image/jpeg"/></item>
    </channel></rss>`;
    const it = NM.parseFeed(xml, "Test", false);
    check(it.length === 2 && it[0].img === "https://img.example.com/l.jpg" && it[0].sum === "He goes for a scan on Monday." && !/</.test(it[0].title),
      "News: feed parsing takes the widest picture, drops the 'appeared first on' line, drops undated and javascript: items", JSON.stringify(it.map(i => [i.title, i.img, i.sum])));
    check(it[1] && it[1].img === "", "News: pictures must be https", it[1] && it[1].img);
    check(NM.matchEventPost("⚽ | GOAL - McBurnie 🐯 Hull City 2-0 Brighton #FPL") && NM.matchEventPost("🅰 | ASSIST - Gourna-Douath") && NM.matchEventPost("⚽ | GOAL - McBurnie | ASSIST - Belloumi")
      && NM.matchEventPost("🟥 | RED CARD - Costinha 🐯 Hull City 1-0 Brighton") && NM.matchEventPost("✅ | DEF CON POINTS 🕊 Groß (+2) 🕊")
      && !NM.matchEventPost("LINE-UPS | #LIVMUN LIV: Alisson, van Dijk") && !NM.matchEventPost("Rogers now has 6 goal involvements in his last 5"),
      "News: FFScout's goal, assist, red card and DefCon posts are left out of Social Media; line-ups and other posts stay");

    /* the one flag mechanism: every page shows the same chance and the same 'since' */
    const keepFlags = S.flags, keepNews = [S.news, S.social, S.squadNews, S.newsState, S.newsWindow, S.newsSources];
    const sqp = g.squadPlayers(), p = sqp.find(x => x.pos >= 2 && x.avail >= 1) || sqp[0];
    const keepP = { avail: p.avail, news: p.news };
    const since = Date.now() - 2 * 86400000, iso = ms => new Date(ms).toISOString();
    S.flags = { updated: iso(Date.now()), players: { [p.id]: [{ t: iso(since), seen: iso(since), st: "d", cn: 75, news: "Knee injury - 75% chance of playing" }] } };
    p.avail = 0.75; p.news = "Knee injury - 75% chance of playing";
    const fn = g.flagNow(p), day = new Date(since).toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" });
    check(fn && fn.c === 75 && fn.was === 100 && Math.abs(fn.since - since) < 1000, "Flags: flagNow gives the chance, since when and the chance before", JSON.stringify(fn));
    const title = g.flagTitle(p);
    check(title.includes(`75% since ${day}`) && title.includes("was 100%"), "Flags: the hover text names the chance, the day and the chance before", title);
    S.tab = "squad"; S.sqView = "pitch"; S.cardId = null; g.render();
    const escT = title.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    check(doc.getElementById("app").innerHTML.includes(`title="${escT}"`) || !g.startingXI().some(x => x.id === p.id),
      "Flags: the Planner's injury badge uses the same hover text");
    g.act("card", p.id); g.render();
    check(S.cardTab === "overview" && new RegExp(`since ${day}`).test((doc.querySelector(".pkwarn") || {}).textContent || ""), "Flags: the player card's flag line says since when");
    g.act("cardtab", "news"); g.render();
    const cardTxt = (doc.querySelector(".pkcard") || {}).textContent || "";
    check(S.cardTab === "news" && /Flag History/.test(cardTxt) && /Start Chance/.test(cardTxt) && /75%/.test(cardTxt) && cardTxt.includes(`since ${day}`),
      "Flags: the card's News tab shows the same chance and day", cardTxt.slice(0, 160));
    const sc = g.startChance(p);
    check(sc >= 0 && sc <= 75, "Start Chance is within 0 and FPL's chance (75%)", String(sc));
    g.act("card", null);

    /* the page: the window filters, availability and your players lead, hostile text stays text */
    S.news = [
      { src: "Feed A", title: "FPL tips for the weekend", url: "https://example.com/1", time: Date.now() - 1 * 3600000, cat: "fpl", ids: [] },
      { src: "Feed B", title: "Squad man injury worry", url: "https://example.com/2", time: Date.now() - 3 * 3600000, cat: "inj", ids: [p.id], img: "" },
      { src: "Feed C", title: "Older transfer story", url: "https://example.com/3", time: Date.now() - 50 * 3600000, cat: "trf", ids: [p.id] },
      { src: "Feed <img id=xs>", title: "Hostile <img id=xt src=x>", url: "javascript:alert(1)", time: Date.now() - 2 * 3600000, cat: "news", ids: [], img: "javascript:alert(2)" }];
    S.social = [{ kind: "pin", src: "Ben Crellin", pub: "Fantasy Football Hub", title: "Crellin's calendar updated", url: "https://example.com/c", time: Date.now() - 86400000, ids: [] }];
    S.squadNews = []; S.newsState = "ok"; S.newsWindow = 24; S.nwCat = "all";
    S.newsSources = { "Feed A": { ok: true }, "Feed B": { ok: false } };
    S.tab = "news"; g.render();
    const page = doc.getElementById("app"), ptxt = page.textContent;
    check(/Squad man injury worry/.test(ptxt) && !/Older transfer story/.test(ptxt), "News: the 24h window leaves out a two-day-old story");
    const lead = (page.querySelector(".nw-lead h2") || {}).textContent || "";
    check(lead === "Squad man injury worry", "News: an injury story naming your player leads over a newer FPL article", lead);
    check(!page.querySelector("#xs,#xt") && ![...page.querySelectorAll("a")].some(a => /^javascript:/i.test(a.getAttribute("href") || "")) && ![...page.querySelectorAll("img")].some(i => /^javascript:/i.test(i.getAttribute("src") || "")),
      "News: hostile text stays text, and only http(s) links and pictures");
    check(/Ben Crellin/.test((page.querySelector(".nw-so.pin") || {}).textContent || ""), "News: Ben Crellin is pinned in Social Media");
    check(/1 of 2/.test(ptxt), "News: the Sources figure counts live sources", (ptxt.match(/Sources.{0,30}/) || [""])[0]);
    const tile = [...page.querySelectorAll(".nw-sw")].find(b => b.textContent.includes(p.web_name));
    check(tile && /75%/.test(tile.textContent) && tile.classList.contains("flag"), "News: Squad Watch shows the flagged player's FPL chance", tile && tile.textContent);
    g.act("nwin", 72); g.render();
    check(/Older transfer story/.test(page.textContent), "News: the 3d window brings the older story back");
    g.act("nwcat", "trf"); g.render();
    check((page.querySelector(".nw-lead h2") || {}).textContent === "Older transfer story" && !/Squad man injury worry/.test((page.querySelector(".nw-top") || {}).textContent || ""),
      "News: the Transfers filter shows only transfer stories");
    g.act("nwcat", "all");
    /* the player card lists his stories newest first (Andy, 22 Nov 2026) */
    S.news = [...S.news, { src: "Feed D", title: "Newest FPL note about him", url: "https://example.com/4", time: Date.now() - 1800000, cat: "fpl", ids: [p.id] }];
    g.act("cardnews", p.id); g.render();
    const firstStory = ((doc.querySelector(".pk-ns b") || {}).textContent) || "";
    check(firstStory === "Newest FPL note about him", "News: the player card shows his newest story first, whatever its category", firstStory);
    g.act("card", null);
    /* Injury Room and Social Media scroll inside their boxes */
    S.tab = "news"; g.render();
    check(!!doc.querySelector("#r-nwso .nw-list.nw-scroll") && (!doc.querySelector("#r-nwir .nw-ir") || !!doc.querySelector("#r-nwir .nw-list.nw-scroll")),
      "News: Injury Room and Social Media lists scroll inside their boxes");

    /* the Status page turns amber for a source down over an hour, not for a blip */
    const keepStatus = S.status;
    S.status = { ...(keepStatus || {}), news: { perSource: { Blip: { ok: false, failingSince: iso(Date.now() - 600000) }, Gone: { ok: false, failingSince: iso(Date.now() - 2 * 3600000) } } } };
    const down = g.newsDown(), stt = g.statusState();
    check(down.join() === "Gone" && /1 news source down/.test(stt.txt) && stt.cls === "wait", "Status: a news source down for over an hour turns the status amber; a blip does not", JSON.stringify([down, stt.cls, stt.plain]));
    S.tab = "xfpl"; g.render();
    /* Bundle D: a compact grid; the state is the dot, the detail is the hover */
    { const rowsN = [...doc.querySelectorAll("#r-stnews .ax-s")], gone = rowsN.find(r => /Gone/.test(r.textContent)), blip = rowsN.find(r => /Blip/.test(r.textContent));
      check(/News Sources/.test(doc.getElementById("app").textContent) && !!gone && !!gone.querySelector(".sdot.bad") && !!blip && !!blip.querySelector(".sdot.amb"), "Status: the page lists each news source and its state"); }
    S.status = keepStatus;
    [S.news, S.social, S.squadNews, S.newsState, S.newsWindow, S.newsSources] = keepNews; S.flags = keepFlags;
    p.avail = keepP.avail; p.news = keepP.news; S.tab = "squad"; g.render();
  }

  /* ---------- This Week batch 1 (22 Nov 2026) ---------- */
  {
    const t = g.dsTile("Gap", "−6.3", "points this week", "dn");
    check(/class="ds-tile dn"/.test(t) && t.includes("<em>Gap</em>") && t.includes("<i>points this week</i>"), "Design parts: a tile has label, figure and sub-line");
    const ch = g.dsChips(["wildcard", "bboost"], "bboost");
    check((ch.match(/class="ds-chip[ "]/g) || []).length === 4 && (ch.match(/ds-chip on/g) || []).length === 2 && / act"/.test(ch), "Design parts: chips are always four fixed slots, used filled, active ringed");
    const hz = g.hz4HTML("ROS", "x", [1]);
    check(/>ROS</.test(hz) && /disabled/.test(hz) && /class="on"/.test(hz), "Design parts: the 1/3/5/ROS switch marks the current one and greys off ones");
    check(g.hzWeeks("ROS", 12) === 27 && g.hzWeeks(3, 12) === 3, "Design parts: ROS covers the rest of the season");
    const ln = g.lastNextHTML(sq.slice(0, 2));
    check(/Actual/.test(ln) && /Predicted/.test(ln) && (ln.match(/stroke-dasharray="4 3"/g) || []).length === 6, "Design parts: the last-3 / next-3 chart draws three predicted bars a player");
    /* a pop-up belongs to its page: leaving the page closes it */
    S.pop = "move"; S.tab = "transfers"; w.location.hash = "#/planner"; g.applyHash();
    check(S.pop === null && S.tab === "squad", "Audit fix: leaving a page closes its pop-up", JSON.stringify([S.pop, S.tab]));
    S.pop = "cap"; g.act("tab", "fixtures");
    check(S.pop === null, "Audit fix: switching tab closes the pop-up");
    S.tab = "squad"; g.render();
  }

  /* ---------- This Week batch 2 (22 Nov 2026) ---------- */
  {
    const P = g.planWeeks(5), moves = P ? P.weeks.filter(x => !x.roll) : [];
    const bought = new Set(), churn = [];
    moves.forEach(x => { if (bought.has(x.out.id)) churn.push(x.out.web_name); bought.add(x.inn.id); });
    const sold = new Set(moves.map(x => x.out.id)), back = moves.filter(x => sold.has(x.inn.id)).map(x => x.inn.web_name);
    check(!!P && churn.length === 0 && back.length === 0, "Plan: never sells a player it bought, never buys back one it sold", JSON.stringify([churn, back]));
    g.act("pop", "move");
    const pop = () => doc.querySelector(".modal") ? doc.querySelector(".modal").textContent : "";
    check(/Transfers/.test(doc.querySelector(".modal h2").textContent) && !!doc.querySelector(".modal .tw-hero .tw-duel") && doc.querySelectorAll(".modal .tw-row").length > 0, "Transfers: Optimal Moves shows the chosen move and the list");
    g.act("poptab", "plan");
    check(!!doc.querySelector(".modal .tw-weeks .tw-wk") && doc.querySelectorAll(".modal .ds-hz button[disabled]").length === 2, "Transfers: Plan shows its weeks; 1 GW and ROS are off");
    g.act("poptab", "rivals");
    check(/Threats to cover/.test(pop()) && /Your differentials/.test(pop()), "Transfers: Rivals tab shows threats and differentials");
    g.act("pop", "cap");
    const capFig = doc.querySelector(".modal .ca-big b"), xi = g.startingXI(), best = Math.max(...xi.map(p => g.hPts(p, g.VG(), 1))) * 2;
    check(!!capFig && Math.abs(+capFig.textContent - best) < 0.06, "Captain: the headline figure is the doubled best option, as on the card", capFig ? capFig.textContent + " vs " + best.toFixed(1) : "none");
    g.act("poptab", "record");
    const rec = g.capRecord();
    check(rec.length > 0 && rec.every(w => w.bp >= w.cp) && doc.querySelectorAll(".modal .cr-rows .cr-row").length === rec.length, "Captain: Season Record has a row a finished week, best in squad never below your captain");
    const tl = g.transferLog();
    check(tl.length > 0 && tl.every(r => r.chip || (r.out && r.inn && r.out.pos === r.inn.pos)), "Transfer Record: every move pairs players of one position; chips are blocks");
    g.act("pop", "trec");
    check(doc.querySelectorAll(".modal .xr-rows .xr-r").length === tl.length, "Transfer Record: one row a move or chip block");
    g.act("pop", null);
  }

  /* ---------- This Week batch 4 (22 Nov 2026) ---------- */
  {
    g.act("pop", "rank");
    check(!!doc.querySelector(".modal .rk-g") && doc.querySelectorAll(".modal .rk-t .ds-tile").length === 6, "Rank: the header pop-up opens with six tiles and the season chart");
    const heads = [...doc.querySelectorAll(".pz-stats .pz-stc")].map(e => e.getAttribute("onclick") || "");
    check(heads.length === 3 && heads.filter(x => x.includes("'rank'")).length === 2 && heads.some(x => x.includes("'rating'")), "Rank: Overall Rank and GW Rank open Rank, Team Rating opens its own", heads.join(" | "));
    g.act("pop", "rating");
    const rt = g.teamRating(), ring = doc.querySelector(".modal .rt-v");
    check(!!rt && !!ring && +ring.textContent === rt.pct, "Team Rating: the pop-up's rating is the header's", ring ? ring.textContent + " vs " + (rt && rt.pct) : "none");
    check(doc.querySelectorAll(".modal .rt-pos .rt-row:not(.rt-rh)").length === 5, "Team Rating: position by position covers the four lines and the bench");
    g.act("pop", "str");
    check(!!doc.querySelector(".modal .rt-hero"), "Squad Strength's pop-up now opens Team Rating");
    g.act("pop", null);
  }

  /* ---------- This Week batch 5: the live gameweek (22 Nov 2026) ---------- */
  {
    const LG = NEXT - 1, row = (S.tracker && S.tracker.gw || []).find(r => r.event === LG && Array.isArray(r.picks) && r.picks.length);
    if (!row) check(false, "Live: the last week has official picks to test with");
    else {
      /* an invented live week on his real picks: one match in play, four BPS
         figures with a tie at the top (FPL: 3, 3, then 1; the fourth none) */
      const ids = row.picks.map(k => k.id), pl = id => S.model.players.find(p => p.id === id);
      const players = {}; ids.forEach((id, i) => { players[id] = { p: 2 + (i % 5), m: 90, g: 0, a: 0, cs: 0, b: 0, sv: 0, yc: 0, rc: 0, og: 0, ps: 0, pm: 0, dc: 0, dt: 0, bps: 0, dcn: 0 }; });
      const t0 = pl(ids[0]).team, other = S.model.teams.find(t => t.id !== t0).id;
      const fx = { id: 9901, h: t0, a: other, hs: 1, as: 0, done: false, fp: false, started: true, min: 63, ko: new Date().toISOString(),
        st: { bps: { h: [[ids[0], 30], [ids[1], 30]], a: [[ids[2], 20], [ids[3], 10]] } } };
      S.wkLive = S.wkLive || {}; const keepW = S.wkLive[LG]; S.wkLive[LG] = { gw: LG, players, fixtures: [fx] };
      w.__lgOrig = vm.runInContext("liveGW", ctx); vm.runInContext("liveGW=function(){return " + LG + "}", ctx);
      const L = g.lkCalc(LG);
      const want = { [ids[0]]: 3, [ids[1]]: 3, [ids[2]]: 1 };
      check(!!L && ids.slice(0, 4).every(id => (L.prov[id] || 0) === (want[id] || 0)), "Live: provisional bonus goes 3, 3, 1 on a tie at the top, none to the fourth",
        L && JSON.stringify(ids.slice(0, 4).map(id => L.prov[id] || 0)));
      const exp = row.picks.reduce((a, k, i) => a + (players[k.id].p + (want[k.id] || 0)) * (k.multiplier != null ? k.multiplier : (i < 11 ? 1 : 0)), 0) - (row.transferCost || 0);
      check(!!L && Math.abs(L.pre - exp) < 1e-9, "Live: points are each pick's live points with bonus, times his multiplier, less the hit", L && L.pre + " vs " + exp);
      /* invented bands (the frozen state has none): a band total gives its own rank */
      const keepB = S.rankBands; S.rankBands = { gw: LG, bands: [{ rank: 10000, at: 10000, total: 760 }, { rank: 100000, at: 100000, total: 730 }, { rank: 1000000, at: 1000000, total: 680 }] };
      check(g.lkRankAt(730, LG) === 100000 && g.lkRankAt(760, LG) === 10000, "Live rank: a band total gives that band rank", g.lkRankAt(730, LG) + " " + g.lkRankAt(760, LG));
      const r1 = g.lkRankAt(700, LG), r2 = g.lkRankAt(720, LG);
      {
        check(r2 < r1, "Live rank: more points, a better rank", r1 + " vs " + r2);
        check(Math.abs(g.lkTotalAt(r1, LG) - 700) < 0.5, "Live rank: rank to total and back agree", String(g.lkTotalAt(r1, LG)));
      }
      S.startGW = LG; g.render();
      check(!!doc.querySelector(".lp-sum") && !!doc.querySelector(".lv4 .lg4-r.me") && !!doc.querySelector(".lk-rank .rk4-hero") && !!doc.querySelector(".mc5 .m4.lv"),
        "Live: summary bar, Live panel with his row, Rank and Match Centre all draw");
      check(!doc.querySelector(".pz-in"), "Live: This Week's cards give way to Rank and Match Centre");
      const rival = L.league.find(x => !x.mine);
      if (rival) { g.act("h2h", rival.id); check(!!doc.querySelector(".modal .hh-g .hh-side.me") && doc.querySelectorAll(".modal .hh-side").length === 2, "Head to head: opens from a league row with both sides"); g.act("pop", null); }
      S.rankBands = keepB; vm.runInContext("liveGW=window.__lgOrig", ctx); S.wkLive[LG] = keepW; S.startGW = NEXT; g.render();
    }
  }

  /* ---------- This Week batch 6: Your Week and the field's ownership (22 Nov 2026) ---------- */
  {
    S.startGW = NEXT; g.render();
    const a = g.ywSim(NEXT), b = g.ywSim(NEXT);
    check(a === b && a.lo <= a.mean + 1e-9 && a.mean <= a.hi + 1e-9 && a.lo < a.hi, "Your Week: the likely range brackets the prediction and holds between repaints", a.lo.toFixed(1) + " " + a.mean.toFixed(1) + " " + a.hi.toFixed(1));
    /* each draw is scaled to the player's prediction, so the runs average out near it */
    const avg = Array.from(a.mine).reduce((x, y) => x + y, 0) / a.N;
    check(Math.abs(avg - a.mean) / Math.max(1, a.mean) < 0.06, "Your Week: the simulated average matches the predicted score", avg.toFixed(1) + " vs " + a.mean.toFixed(1));
    check(a.above(a.lo) >= a.above(a.hi) && Math.abs(a.above(-1) - 1) < 1e-9, "Your Week: chances fall as the target rises");
    check(!!doc.querySelector(".pz-in[onclick*=\"'week'\"]"), "Your Week: the card sits in This Week");
    g.act("pop", "week");
    check(doc.querySelectorAll(".modal .yw-g > section").length === 3 && !!doc.querySelector(".modal .yw-big"), "Your Week: This Week shows the score, against the field and the matches");
    g.act("poptab", "last");
    check(doc.querySelectorAll(".modal .yw-g > section").length === 3, "Your Week: Last Week shows what happened and why");
    g.act("pop", null);
    /* the field's ownership: an invented sample, so the figures are known */
    const keepF = S.field, pid = S.model.players[0].id;
    S.field = { latest: NEXT - 1, gws: { [NEXT - 1]: { gw: NEXT - 1, top10k: { eo: { [pid]: 137 }, own: {}, cap: {}, chips: { bboost: 7.5 }, avg: {} }, near: { eo: {}, own: {}, cap: {}, chips: { bboost: 3.1 }, avg: {} } } } };
    check((g.fieldEO10k() || {})[pid] === 137, "Field EO: read from the top 10k sample");
    g.act("tab", "table"); g.act("pown", "eo");
    const heads = [...doc.querySelectorAll("th")].map(t => t.textContent);
    check(heads.some(t => /EO 10k/.test(t)), "Player Data: the ownership column can show EO 10k");
    g.act("pown", "all"); g.act("tab", "fixtures");
    check([...doc.querySelectorAll("th")].some(t => /^EO/.test(t.textContent.trim())), "Teams: an EO column for the top 10k");
    g.act("tab", "chips"); S.chipPop = "report"; g.render();
    check(doc.querySelectorAll(".modal .cx-tier").length === 5 && /7\.5%/.test(doc.querySelector(".modal").textContent), "Chips: Chip Report shows chips by rank tier");
    S.chipPop = null; S.field = keepF; g.act("tab", "squad"); S.startGW = NEXT; g.render();
  }

  /* ---------- v14: Gameweek Brief (22 Nov 2026) ---------- */
  {
    S.startGW = NEXT; S.pop = null; g.render();
    const sec = doc.querySelector(".pz-sec.gb");
    check(!!sec && sec.querySelector("h2").textContent === "Gameweek Brief" && ![...doc.querySelectorAll("h2")].some(h => h.textContent === "This Week"), "Gameweek Brief: This Week is renamed");
    const keys = sec ? [...sec.querySelectorAll(".gb-c")].map(b => (/act\('pop','(\w+)'\)/.exec(b.getAttribute("onclick")) || [])[1]) : [];
    check(keys.join(",") === "week,warn,move,cap,price,out,form,trec", "Gameweek Brief: before the deadline, then market and season", keys.join(","));
    /* one team total: the Planner's, on Your Week and Team News alike */
    const team = g.weekPtsFor(NEXT, 1).toFixed(1);
    const yw = sec && sec.querySelector(".gb-c[onclick*=\"'week'\"] .gb-fig"), tn = sec && sec.querySelector(".gb-c[onclick*=\"'warn'\"] .gb-ft");
    check(!!yw && yw.textContent === team && !!tn && tn.textContent.trim().endsWith("of " + team), "Gameweek Brief: Your Week and Team News show the Planner's total", (yw && yw.textContent) + " / " + (tn && tn.textContent) + " / " + team);
    const ins = sec ? [...sec.querySelectorAll(".gb-c[onclick*=\"'move'\"] .gb-mv .gb-n b")].map(b => b.textContent.split(" → ")[1]) : [];
    check(ins.length > 0 && new Set(ins).size === ins.length, "Transfers: each row brings in a different player", ins.join(", "));
    check(sec && !sec.querySelector(".pz-dts"), "Gameweek Brief: no Dream Team stars on the cards");
    const shape = sec ? [...sec.querySelectorAll(".gb-c")].every(c => c.querySelector(".gb-fig") && c.querySelector(".gb-ft") && c.querySelectorAll(".gb-rows > .gb-r").length <= 3) : false;
    check(shape, "Gameweek Brief: every card has a headline figure, at most three rows and a footer");
  }

  /* ---------- League: Rivals folded in (22 Nov 2026) ---------- */
  {
    const feed = S.rivalsFeed, TID = String(vm.runInContext("TEAM_ID", ctx));
    S.pop = null; S.tab = "tracker"; S.lgView = "gw"; S.rivalGwView = "next"; S.rivalPick = null; g.render();
    const grid = doc.querySelector(".trkpage .repgrid"), ids = grid ? [...grid.children].map(e => e.id) : [];
    check(!doc.querySelector(".trkpage .sgtabs") && ids[0] === "r-lgtable" && ids[1] === "r-lgh2h" && ids[2] === "r-trkweek",
      "League: no Tracker/Rivals tabs; the mini-league table and Head to Head lead, then the Tracker cards", ids.slice(0, 3).join(","));
    w.location.hash = "#/league/rivals"; g.applyHash();
    check(S.tab === "tracker", "League: old Rivals links open League", S.tab);
    w.location.hash = "#/league"; g.applyHash(); S.tab = "tracker"; g.render();
    if (feed && feed.standings && feed.standings.length > 1) {
      const rows = [...doc.querySelectorAll("#r-lgtable tbody tr")];
      check(rows.length === feed.standings.length, `League table: one row per manager (${feed.standings.length})`, rows.length);
      /* pick a rival that is not the default, and Head to Head follows */
      const other = feed.standings.filter(r => String(r.entryId) !== TID).slice(-1)[0];
      g.act("rivalpick", String(other.entryId));
      const nm = (doc.querySelector("#r-lgh2h .lg-snap .lg-nm b") || {}).textContent;
      const sel = doc.querySelector("#r-lgtable tr.lg-sel .lg-nm b");
      check(nm === other.entryName && sel && sel.textContent === other.entryName, "Head to Head: picking a rival in the table switches the card and marks the row", `${nm} / ${sel && sel.textContent}`);
      /* the edge, worked out here from the feed: projected points of the players only one side owns */
      const ent = feed.entries[other.entryId], last = ent && ent.gw && ent.gw[ent.gw.length - 1];
      if (last && last.picks) {
        const theirs = new Set(last.picks.map(p => p.id ?? p)), mine = new Set(S.squad), P = id => S.model.players.find(p => p.id === id);
        const pts = p => g.hPts(p, NEXT, S.horizon);
        const ys = g.squadPlayers().filter(p => !theirs.has(p.id)).reduce((a, p) => a + pts(p), 0);
        const ts = [...theirs].map(P).filter(p => p && !mine.has(p.id)).reduce((a, p) => a + pts(p), 0);
        const shown = [...doc.querySelectorAll("#r-lgh2h .lg-es b")].map(b => b.textContent);
        const want = [ys.toFixed(1), ts.toFixed(1), (ys - ts >= 0 ? "+" : "−") + Math.abs(ys - ts).toFixed(1)];
        check(JSON.stringify(shown) === JSON.stringify(want), "Head to Head: Yours, Theirs and Edge match the squads in the feed", `${shown} vs ${want}`);
      }
      /* the season view: totals from each manager's weeks */
      g.act("lgview", "season");
      const me = feed.entries[TID], heads = [...doc.querySelectorAll("#r-lgtable thead th")].map(t => t.textContent);
      const myRow = doc.querySelector("#r-lgtable tr.me"), cells = myRow ? [...myRow.children].map(c => c.textContent.trim()) : [];
      const moves = me && me.gw ? me.gw.reduce((a, r) => a + (+r.transfers || 0), 0) : null;
      check(heads.includes("Best GW") && cells[heads.indexOf("Moves")] === String(moves), "League table, Season: your moves are the sum of your weeks", `${cells[heads.indexOf("Moves")]} vs ${moves}`);
      g.act("lgview", "gw"); S.rivalPick = null;
    }
    /* the Planner panels carry the card header, not the old one */
    S.tab = "squad"; S.startGW = NEXT; g.render();
    const pool = doc.querySelector(".poolpanel .pnl-h h3");
    check(pool && pool.textContent === "Player Pool" && !doc.querySelector(".poolpanel .phead"), "Planner: Player Pool has the card header");
    S.startGW = NEXT - 2; g.render();
    const rev = doc.querySelector(".pv-rev .pnl-h h3");
    check(rev && /^GW\d+ Review$/.test(rev.textContent) && !doc.querySelector(".pv-rev .phead"), "Planner: GW Review has the card header", rev && rev.textContent);
    S.startGW = NEXT; S.tab = "squad"; g.render();
  }

  /* ---------- Season Against History: Transfer Pts over transfer weeks only (22 Nov 2026) ---------- */
  {
    const keep = S.tracker;
    /* an invented season: two weeks with transfers (+6, +2), two without (0, 0) */
    S.tracker = { ...keep, gw: [1, 2, 3, 4].map(e => ({ event: e, points: 50, gwRank: 1e6, orRank: 1e6, captain: 4, transfers: e % 2 ? 1 : 0, transferDiff: e === 1 ? 6 : e === 3 ? 2 : 0 })) };
    S.tab = "tracker"; g.render();
    const tr = [...doc.querySelectorAll("#r-trkhist tbody tr")].find(r => /Transfer Pts/.test(r.textContent));
    const cell = tr ? tr.children[1].textContent.replace(" ★", "").trim() : null;
    check(cell === "+4", "Season Against History: Transfer Pts averages only the weeks with transfers (+6, +2 → +4, not +2)", cell);
    S.tracker = keep; S.tab = "squad"; g.render();
  }

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
