/* FPL Signals server - prediction snapshot scheduler (F2, 13 Oct 2026).

   At deadline - 60 and deadline - 15 minutes (from the official
   deadline_time) it runs scripts/snapshot-node.mjs, which loads the app's
   own model in Node and records every player's projection for the coming
   gameweek into STATE_DIR/snapshots/predictions.json. The later run
   replaces the earlier one; the script refuses to write after the deadline.
   No browser and no packages (Andy chose this over Playwright, 13 Oct). */

import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG } from "./config.mjs";
import { log } from "./util.mjs";
import { nextDeadline, fplStatus } from "./fpl.mjs";
import { SNAP_DIR } from "./feeds.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts", "snapshot-node.mjs");
const OFFSETS_MIN = [60, 15];

const state = { fired: new Set(), last: null, next: null, lastResult: null, running: false };

export function runSnapshot(why) {
  if (state.running) return;
  state.running = true;
  const t0 = Date.now();
  const gw = fplStatus().gw;
  const env = {
    ...process.env,
    BASE: `http://127.0.0.1:${CONFIG.PORT}`,
    FPL_PRED_OUT: join(SNAP_DIR(), "predictions.json"),
    SNAPSHOT_GW: gw ? String(gw) : ""
  };
  const child = spawn(process.execPath, [SCRIPT], { cwd: REPO_ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  child.stdout.on("data", d => { out += d; });
  child.stderr.on("data", d => { out += d; });
  child.on("error", e => {
    state.running = false;
    state.lastResult = { ok: false, at: new Date().toISOString(), msg: String(e.message || e) };
  });
  child.on("close", code => {
    state.running = false;
    const msg = out.trim().split("\n").pop() || "";
    state.lastResult = { ok: code === 0, at: new Date().toISOString(), msg };
    log("snapshot", `${why}: ${code === 0 ? "ok" : "FAILED"} ${msg}`, Date.now() - t0);
  });
}

export function snapshotTick() {
  const dl = nextDeadline();
  if (!dl) { state.next = null; return; }
  const dlMs = Date.parse(dl);
  if (!Number.isFinite(dlMs)) return;
  const now = Date.now();
  for (const off of OFFSETS_MIN) {
    const at = dlMs - off * 60000;
    const id = dl + "-" + off;
    /* fire once, within 5 minutes after the mark */
    if (now >= at && now < at + 5 * 60000 && !state.fired.has(id)) {
      state.fired.add(id);
      state.last = new Date().toISOString();
      runSnapshot(`deadline-${off}min`);
    }
  }
  const upcoming = OFFSETS_MIN.map(o => dlMs - o * 60000).filter(t => t > now);
  state.next = upcoming.length ? new Date(Math.min(...upcoming)).toISOString() : null;
}

export function snapshotStatus() {
  return { last: state.last, next: state.next, mode: "node", result: state.lastResult };
}
