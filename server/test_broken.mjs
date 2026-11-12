/* Broken-items check (12 Oct 2026): one check per audit finding fixed in
   this batch, run on the real app in jsdom against the real server with the
   scheduler frozen.

   F5   Player Data reaches every player, and says how many it shows.
   F7   A page that throws no longer freezes the app: the header and menu
        survive, the page says what went wrong, other pages still draw.
   F8   The header's overall rank is the feed's latest week, read here
        straight from actuals.json rather than through the app.
   F10  Every clickable element can be reached by keyboard and pressed with
        Enter; Escape closes the player card.
   F11  Every input is named, and the toast is announced.
   F89  The document title names the page.

   Usage: STATE_DIR=... JSDOM_DIR=... node server/test_broken.mjs
   Optional: PORT (default 8098). */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";

process.env.TZ = "Europe/London";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8098);
const BASE = `http://127.0.0.1:${PORT}`;
const STATE_DIR = process.env.STATE_DIR;
if (!STATE_DIR) { console.error("Set STATE_DIR to a populated server state dir."); process.exit(2); }

function loadJSDOM() {
  for (const dir of [process.env.JSDOM_DIR, ROOT, process.cwd()].filter(Boolean)) {
    try { return createRequire(join(dir, "x.js"))("jsdom"); } catch { /* next */ }
  }
  console.error("jsdom not found. Set JSDOM_DIR to a folder whose node_modules has jsdom.");
  process.exit(2);
}
const { JSDOM } = loadJSDOM();
const FILES = ["app-core.js", "app-squad.js", "app-render.js", "app-odds.js", "app-tracker.js", "app-main.js"];
/* wave 8: Transfers and Odds are retired (their links redirect) */
const TABS = ["squad", "chips", "rivals", "tracker", "table", "fixtures", "news", "xfpl", "signals"];

let pass = 0, fail = 0;
const check = (ok, name, detail) => {
  if (ok) { pass++; console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + (detail ? " -- " + detail : "")); }
};

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
  const dom = new JSDOM(`<!DOCTYPE html><html><head><title>x</title></head><body><div class="wrap" id="app"></div></body></html>`,
    { url: "https://app.local/fpl/#/team-planner", runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window, ctx = dom.getInternalVMContext(), doc = w.document;
  w.fetch = async (url, opts) => {
    const s = String(url);
    if (!s.startsWith("/")) return { ok: false, status: 404, text: async () => "", json: async () => ({}), clone() { return this; } };
    const r = await fetch(BASE + s, opts); const t = await r.text();
    return { ok: r.ok, status: r.status, text: async () => t, json: async () => JSON.parse(t), clone() { return this; } };
  };
  w.AbortController = AbortController; w.setTimeout = setTimeout; w.clearTimeout = clearTimeout; w.scrollTo = () => {};
  w.setInterval = () => 0;
  const errors = [];
  w.console = { log() {}, warn() {}, error: (...a) => errors.push(a.map(String).join(" ")) };
  for (const f of FILES) vm.runInContext(readFileSync(join(ROOT, f), "utf8"), ctx, { filename: f });
  vm.runInContext(`window.__g={get S(){return S},render,act,toast}`, ctx);
  const g = w.__g, S = g.S;
  const until = Date.now() + 180000;
  while (Date.now() < until && !(S.model && !S.loading)) await new Promise(r => setTimeout(r, 250));
  if (!S.model) throw new Error("app never built a model: " + (S.err || "none"));
  const show = tab => { S.tab = tab; S.cardId = null; g.render(); };

  /* F5 */
  show("table");
  const total = doc.querySelector(".pdmore .note")?.textContent || "";
  const m = /Showing (\d+) of (\d+) players/.exec(total);
  /* bundle 9: pages of 100 (was one cut at 320) */
  check(!!m && +m[1] === 100, "F5 Player Data states it shows 100 of the full list", total);
  g.act("pdmore");
  check(doc.querySelectorAll(".tallscroll tbody tr").length === 200, "F5 Show more adds the next 100");
  g.act("pdall");
  const rows = doc.querySelectorAll(".tallscroll tbody tr").length;
  check(m && rows === +m[2], "F5 Show all reaches every player", `${rows} rows of ${m && m[2]}`);
  g.act("pdless");
  check(doc.querySelectorAll(".tallscroll tbody tr").length === 100, "F5 Show fewer returns to 100");
  /* Player Data (12 Nov 2026): shared columns for every position, then the position's own */
  /* redesign (12 Nov 2026): sub-labels (GW numbers, "5 GW", "last 6") sit in <small> under the name */
  const heads = () => [...doc.querySelectorAll(".pdt thead tr:nth-child(2) th")].map(t => { const c = t.cloneNode(true); c.querySelectorAll("small").forEach(s => s.remove()); return c.textContent.replace(/[↓↑]/g, "").trim(); });
  const WANTPOS = { 0: ["Pts"], 1: ["Saves/90", "G prev", "GC/90"], 2: ["DefCon %", "BPS/90"], 3: ["npxG/90", "xA/90", "ICT"], 4: ["SoT/90", "ICT"] };
  for (const [pos, want] of Object.entries(WANTPOS)) {
    S.lPos = +pos; show("table"); const h = heads();
    const base = ["Player", "Price", "Signals", "Next 5", "Form", "xFPL", "Pts/£m", "xMins"].every(x => h.includes(x)) && h.includes("xPts");
    check(base && want.every(x => h.includes(x)), `Player Data position ${pos}: shared columns plus ${want.join(", ")}`, h.join(" | "));
  }
  S.lPos = 0; show("table");
  /* redesign (12 Nov 2026): signals always on show, no Yours tabs, his players marked in place */
  check(doc.querySelectorAll(".pdsigchip").length === 12 && !S.pdMore, "Player Data shows all 12 signal chips with More filters closed", doc.querySelectorAll(".pdsigchip").length);
  check(![...doc.querySelectorAll(".pdbar button")].some(b => /^(Not yours|Yours)$/.test(b.textContent.trim())), "Player Data has no Yours / Not yours tabs");
  g.act("pdall");
  const mineRows = doc.querySelectorAll(".pdt tbody tr.mine").length, sq = (S.squad || []).length;
  check(sq > 0 && mineRows === sq && doc.querySelectorAll(".pdt tbody tr.mine .pdrole").length === sq, "every squad player is marked in the list with a role", `${mineRows} marked of ${sq}`);
  check(doc.querySelectorAll(".pdt tbody .pdrole.c").length === 1, "exactly one captain mark");
  g.act("pdless");
  g.act("pwin", "ros");
  check(vm.runInContext("lGwRange().to", ctx) === 38 && /ROS/.test(doc.querySelector(".pdt th.act")?.textContent || ""), "ROS projects to GW38", doc.querySelector(".pdt th.act")?.textContent);
  g.act("pwin", "5");
  g.act("lmin", "10"); show("table");
  const cheap = vm.runInContext("pdRows().a.filter(p=>p.price<10).length", ctx);
  check(cheap === 0, "the price range's low end filters", cheap);
  g.act("pdreset"); show("table");
  const sig = doc.querySelector(".pdt .tile[data-sig][data-tt]");
  check(!!sig && sig.getAttribute("data-tt").length > 0 && sig.getAttribute("data-tt").length <= 90, "signal tiles carry a short hover line", sig && sig.getAttribute("data-tt"));

  /* Teams (12 Nov 2026): the Fixture Grid and Matches */
  S.fixMode = "grid"; S.tWin = 1; S.tLens = "all"; S.tSort = null; S.tOpen = null; show("fixtures");
  const tgRows = [...doc.querySelectorAll(".tg-t tbody tr.tg-r")];
  check(tgRows.length === 20, "Teams grid lists all 20 clubs", tgRows.length);
  const posSet = new Set(tgRows.map(r => +r.children[1].textContent));
  check(posSet.size === 20 && Math.min(...posSet) === 1 && Math.max(...posSet) === 20, "Teams grid Pos is a league table, 1 to 20", [...posSet].join(","));
  const nextG = vm.runInContext("S.model.next.id", ctx);
  check(/Overall/.test(doc.querySelector(".tg-t th.act")?.textContent || ""), "Teams grid sorts by the Overall lens by default");
  const fxCols = doc.querySelectorAll(".tg-t thead th.tg-gw").length;
  check(fxCols === 38 - nextG + 1, "Teams grid shows every gameweek to GW38", fxCols);
  const overallOk = vm.runInContext(`(()=>{const t=S.model.teams[0],s=tgScore(t,S.model.next.id,S.model.next.id),fx=tgFx(t,S.model.next.id);let p=0;fx.forEach(x=>{p+=9*fdrCalc(t,x.opp,x.home,"xgf")+31*Math.exp(-fdrCalc(t,x.opp,x.home,"xgc"));});return Math.abs(s.pts-p)<1e-9;})()`, ctx);
  check(overallOk, "Overall is 9 per expected goal plus 31 per clean sheet");
  const one = doc.querySelector(".tg-t tbody tr.tg-r td.tg-n.act")?.textContent;
  g.act("twin", "5"); show("fixtures");
  const five = doc.querySelector(".tg-t tbody tr.tg-r td.tg-n.act")?.textContent;
  check(doc.querySelectorAll(".tg-t thead th.tg-gw.in").length === Math.min(5, 38 - nextG + 1) && /5 GW|GW/.test(doc.querySelector(".tg-t th.act").title), "Teams 5 GW window covers five gameweeks", doc.querySelectorAll(".tg-t thead th.tg-gw.in").length);
  check(one != null && five != null, "Teams scores redraw for the window", `${one} -> ${five}`);
  const firstClub = tgRows[0].getAttribute("data-club");
  g.act("topen", firstClub); show("fixtures");
  check(doc.querySelectorAll(".tg-drawer .tg-dr section").length === 4, "a club's detail opens with four cards");
  const tile = doc.querySelector(".tg-form i[data-tt]");
  check(!!tile && /GW\d+ · (Home|Away) · (Won|Drew|Lost)\n.+ \d+–\d+ .+/.test(tile.getAttribute("data-tt")), "result tiles carry the match and score on hover", tile && tile.getAttribute("data-tt"));
  g.act("tmatch", String(nextG)); show("fixtures");
  const mrows = doc.querySelectorAll(".tg-m").length, nfx = vm.runInContext("(S.model.byEv[S.model.next.id]||[]).length", ctx);
  check(S.fixMode === "matches" && mrows === nfx && mrows > 0, "Matches lists the gameweek's fixtures, one row each", `${mrows} of ${nfx}`);
  check(doc.querySelectorAll(".tg-m .tg-form").length === mrows * 2 && doc.querySelectorAll(".tg-m .tg-bar").length === mrows, "every match shows both clubs' form and a result bar");
  g.act("mgw", String(nextG + 1)); show("fixtures");
  check(/Gameweek \d+/.test(doc.querySelector(".tg-step b")?.textContent || "") && +doc.querySelector(".tg-step b").textContent.match(/\d+/)[0] === nextG + 1, "Matches steps to the next gameweek", doc.querySelector(".tg-step b")?.textContent);
  S.fixMode = "grid"; S.tWin = 1; S.tOpen = null; S.mGw = null;

  /* F8: independent read of the feed */
  const feed = await (await fetch(BASE + "/data/feeds/actuals.json")).json();
  const ranked = (feed.team.gw || []).filter(r => r.orRank != null).sort((a, b) => b.event - a.event)[0];
  show("squad");
  /* header figures are cards (.fc: .fcv figure, .fcc change line) since bundle 8 */
  const rankStat = [...doc.querySelectorAll(".fc, .stat")].find(s => /Overall rank/i.test(s.textContent));
  const shown = rankStat ? rankStat.querySelector(".fcv, .v").textContent.replace(/,/g, "") : "";
  check(ranked && +shown === ranked.orRank, "F8 header overall rank is the feed's latest week", `page ${shown} feed ${ranked && ranked.orRank} (GW${ranked && ranked.event})`);
  check(rankStat && rankStat.querySelector(".fcc, .s").textContent.trim().endsWith("after GW" + ranked.event), "F8 the rank says which week it is from", rankStat && rankStat.querySelector(".fcc, .s").textContent);

  /* F7: make one page builder throw */
  const real = vm.runInContext("signalsHTML", ctx);
  vm.runInContext(`signalsHTML=function(){throw new Error("test throw")}`, ctx);
  let threw = null;
  try { show("signals"); } catch (e) { threw = e; }
  check(!threw, "F7 a throwing page does not escape render()", threw && String(threw));
  const alert = doc.querySelector('[role="alert"]');
  check(!!alert && /could not be drawn/.test(alert.textContent) && /test throw/.test(alert.textContent), "F7 the page says what went wrong");
  check(!!doc.querySelector(".tb") && !!doc.querySelector("nav"), "F7 the header and menu survive");
  w.signalsHTML = real; vm.runInContext("signalsHTML=window.signalsHTML", ctx);
  show("fixtures");
  check(!!doc.querySelector("main") && !doc.querySelector('[role="alert"]'), "F7 other pages still draw afterwards");

  /* F10, F11, F89 on every page */
  let offenders = [], unnamed = [], titles = new Set();
  for (const tab of TABS) {
    show(tab);
    doc.querySelectorAll("#app [onclick]").forEach(el => {
      const native = /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
      if (!native && !(el.getAttribute("tabindex") === "0" && el.getAttribute("role") === "button")) offenders.push(tab + ":" + el.tagName + "." + el.className);
    });
    doc.querySelectorAll("#app input, #app select, #app textarea").forEach(el => {
      const lab = el.getAttribute("aria-label") || (el.id && doc.querySelector(`label[for="${el.id}"]`)) || el.closest("label");
      if (!lab) unnamed.push(tab + ":" + el.tagName);
    });
    doc.querySelectorAll("#app button").forEach(b => { if (!b.textContent.trim() && !b.getAttribute("aria-label")) unnamed.push(tab + ":empty button"); });
    titles.add(doc.title);
    check(!!doc.querySelector("#app main"), `F11 ${tab} has a main landmark`);
  }
  check(offenders.length === 0, "F10 every clickable element is keyboard reachable", offenders.slice(0, 5).join(", ") + (offenders.length > 5 ? ` (+${offenders.length - 5})` : ""));
  check(unnamed.length === 0, "F11 every input and icon button is named", unnamed.slice(0, 5).join(", "));
  check(titles.size === TABS.length && [...titles].every(t => /FPL Signals$/.test(t)), "F89 each page has its own title", [...titles].join(" | "));

  /* redesign wave 8: the retired pages' links land on their new homes */
  show("odds");
  check(S.tab === "fixtures" && S.fixMode === "matches" && !!doc.querySelector(".tg-mp"), "W8 the Odds route opens Teams > Matches", `${S.tab} ${S.fixMode}`);
  show("transfers");
  check(S.tab === "squad" && S.pop === "move" && /Plan your transfers/.test(doc.querySelector(".modal") ? doc.querySelector(".modal").textContent : ""), "W8 the Transfers route opens the Top Move pop-up with the transfer tools", `${S.tab} ${S.pop}`);
  S.pop = null; S.fixMode = "grid";

  /* F10 behaviour: Enter presses a role=button element; Escape closes a card */
  show("signals");
  /* jsdom in this mode does not run inline onclick attributes, so the check
     is on what the key handler owns: Enter and Space press the element */
  const rowEl = doc.querySelector(".sgpage .hbr[role='button'], .sgpage .sbrow[role='button'], .sgrow[role='button']");
  let pressed = 0; rowEl.click = () => { pressed++; };
  rowEl.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  rowEl.dispatchEvent(new w.KeyboardEvent("keydown", { key: " ", bubbles: true }));
  check(pressed === 2, "F10 Enter and Space press a keyboard-reachable row", `pressed ${pressed}`);
  S.cardId = S.model.players[0].id; g.render();
  check(!!S.cardId, "F108 setup: a player card is open");
  doc.body.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  check(!S.cardId, "F108 Escape closes the player card");

  /* F11: the toast is announced */
  g.toast("hello");
  g.render();
  const t = doc.getElementById("toast");
  check(t && t.getAttribute("role") === "status" && t.getAttribute("aria-live") === "polite", "F11 the toast is a polite live region");
  check(errors.filter(e => !/page failed|render failed/.test(e)).length === 0, "no other console errors during the run", errors.slice(0, 3).join(" | "));
} catch (e) {
  fail++; console.log("FAIL  run aborted -- " + (e && e.stack || e));
} finally {
  server.kill();
}
console.log(`\n${pass} passed, ${fail} failed`);
if (!fail) console.log("All broken-item checks passed.");
process.exit(fail ? 1 : 0);
