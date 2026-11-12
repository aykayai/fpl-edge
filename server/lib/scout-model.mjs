/* The Scout (12 Nov 2026): the app's own model, kept warm on the server.

   The Scout's tools answer from the numbers the page shows, so this loads the
   app's scripts (app-core, app-squad, app-render, app-odds, app-tracker; not
   app-main, which only wires up the page) into a Node vm, exactly as the
   deadline snapshot does, with every fetch pointed at this server. Nothing is
   drawn: render and the page painters are no-ops.

   One copy, rebuilt when the dataset, the feeds or the odds change (checked
   at most once a minute, on demand). Tools run one at a time (a queue),
   because a tool may lay his draft plan over S for the length of its call
   and must put it back before the next one starts. */

import fs from "node:fs";
import vm from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FILES = ["app-core.js", "app-squad.js", "app-render.js", "app-odds.js", "app-tracker.js"];
const read = f => fs.readFileSync(join(ROOT, f), "utf8");

function sandbox(base) {
  const store = {};
  const noop = () => {};
  const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    setAttribute: noop, getAttribute: () => null, appendChild: noop, removeChild: noop, addEventListener: noop,
    querySelector: () => null, querySelectorAll: () => [], insertAdjacentHTML: noop, innerHTML: "", textContent: "",
    children: [], dataset: {} });
  const doc = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el,
    addEventListener: noop, body: el(), head: el(), documentElement: el(), title: "", hidden: false, visibilityState: "visible" };
  const sb = {
    console: { log: noop, info: noop, warn: noop, error: noop },
    fetch: (u, o) => fetch(new URL(String(u), base), o),
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    location: { hash: "", href: base + "/", search: "", hostname: "localhost", pathname: "/" },
    history: { replaceState: noop, pushState: noop },
    document: doc, navigator: { userAgent: "fpl-signals-scout", serviceWorker: undefined },
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: noop, requestAnimationFrame: f => setTimeout(f, 0),
    URL, URLSearchParams, Intl, performance, matchMedia: () => ({ matches: false, addEventListener: noop }),
    getComputedStyle: () => ({}), scrollTo: noop, alert: noop, confirm: () => false
  };
  sb.window = sb; sb.self = sb; sb.addEventListener = noop; sb.removeEventListener = noop;
  return sb;
}

export class ScoutModel {
  constructor({ base, log = () => {} } = {}) {
    this.base = base;
    this.log = log;
    this.ctx = null;
    this.builtFor = null;     // the status signature the model was built from
    this.builtAt = 0;
    this.checkedAt = 0;
    this.queue = Promise.resolve();
    this.loading = null;
  }

  get(expr) { return vm.runInContext(expr, this.ctx); }

  async build() {
    const ctx = vm.createContext(sandbox(this.base));
    for (const f of FILES) {
      try { vm.runInContext(read(f), ctx, { filename: f }); }
      catch (e) { throw new Error(`${f} did not load on the server: ${e.message}`); }
    }
    /* The Scout's tools, beside the app's own functions */
    vm.runInContext(fs.readFileSync(join(dirname(fileURLToPath(import.meta.url)), "scout-vm.js"), "utf8"), ctx, { filename: "scout-vm.js" });
    /* nothing is drawn here */
    vm.runInContext("render=function(){};renderPage=function(){};if(typeof a11yPass==='function')a11yPass=function(){};", ctx);
    const prev = this.ctx;
    this.ctx = ctx;
    try {
      await this.get("loadAll")(true);
      if (this.get("S.err")) throw new Error(String(this.get("S.err")));
      try { if (this.get("typeof loadOdds") === "function") { await this.get("loadOdds")(); this.get("buildModel")(); } }
      catch (e) { this.log("scout: odds " + e.message); }
      try { if (this.get("typeof syncOfficialSquad") === "function") this.get("syncOfficialSquad")(); } catch (e) { this.log("scout: squad " + e.message); }
      if (!this.get("S.model")) throw new Error("no model");
    } catch (e) { this.ctx = prev; throw e; }
    this.builtAt = Date.now();
  }

  /* the dataset commit, feed build and odds fetch the model was built from */
  async signature() {
    const st = await (await fetch(new URL("/api/status", this.base))).json();
    const ds = st.dataset || {}, feeds = st.feeds || {}, odds = st.odds || {}, fpl = st.fpl || {};
    return [ds.commit || ds.committedAt, feeds.lastOk, odds.fetchedAt, fpl.gw].join("|");
  }

  /* a warm model, rebuilt if the data under it changed */
  async ready() {
    if (this.loading) return this.loading;
    const now = Date.now();
    if (this.ctx && now - this.checkedAt < 60_000) return;
    this.loading = (async () => {
      let sig = null;
      try { sig = await this.signature(); } catch (e) { this.log("scout: status " + e.message); }
      this.checkedAt = Date.now();
      if (this.ctx && sig && sig === this.builtFor) return;
      if (this.ctx && !sig) return;          // status unreadable: keep what we have
      await this.build();
      this.builtFor = sig;
      this.log(`scout: model built (GW${this.get("S.model.next.id")})`);
    })().finally(() => { this.loading = null; });
    return this.loading;
  }

  /* run fn(model) alone, with his draft plan laid over S if given, and put
     everything back afterwards */
  run(fn, plan) {
    const job = this.queue.then(async () => {
      await this.ready();
      const S = this.get("S");
      const KEYS = ["squad", "original", "planByGw", "captain", "vice", "chips", "bank", "ft", "forceXI", "benchOrder", "flagged", "startGW"];
      const keep = {};
      KEYS.forEach(k => { keep[k] = S[k]; });
      try {
        if (plan && typeof plan === "object") KEYS.forEach(k => { if (k in plan && plan[k] !== undefined) S[k] = JSON.parse(JSON.stringify(plan[k])); });
        this.clearCaches();
        return await fn(this);
      } finally {
        KEYS.forEach(k => { S[k] = keep[k]; });
        this.clearCaches();
      }
    });
    this.queue = job.catch(() => {});
    return job;
  }

  /* the app memoises a few answers on the squad; a plan change must not hit them */
  clearCaches() {
    try { vm.runInContext("try{if(typeof _bsCache!=='undefined')for(const k in _bsCache)delete _bsCache[k];}catch(e){}" +
      "try{if(typeof _planCache!=='undefined')for(const k in _planCache)delete _planCache[k];}catch(e){}" +
      "try{if(typeof _sqCache!=='undefined')for(const k in _sqCache)delete _sqCache[k];}catch(e){}", this.ctx); } catch { /* none */ }
  }
}
