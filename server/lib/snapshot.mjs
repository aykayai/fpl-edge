/* FPL Signals server - prediction snapshot scheduler (stub).

   scripts/snapshot-predictions.mjs deliberately runs the real app in a
   real browser (it imports Playwright and loads the live site) so the
   snapshot can never drift from the model users see. Installing a
   browser inside this zero-dependency server was ruled out, so this is
   a stub: it computes the two scheduled moments (deadline - 60 min and
   deadline - 15 min, from the official deadline_time) and logs exactly
   what it would have run. The owner decides whether to install
   Playwright and flip RUN_SNAPSHOTS=1, which makes it actually spawn
   the script with FPL_PRED_OUT pointed into the state dir. */

import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG } from "./config.mjs";
import { log } from "./util.mjs";
import { nextDeadline } from "./fpl.mjs";
import { SNAP_DIR } from "./feeds.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts", "snapshot-predictions.mjs");
const OFFSETS_MIN = [60, 15];
const RUN_FOR_REAL = process.env.RUN_SNAPSHOTS === "1";

const state = { fired: new Set(), last: null, next: null };

export function snapshotTick() {
  const dl = nextDeadline();
  if (!dl) { state.next = null; return; }
  const dlMs = Date.parse(dl);
  if (!Number.isFinite(dlMs)) return;
  const now = Date.now();
  state.next = null;
  for (const off of OFFSETS_MIN) {
    const at = dlMs - off * 60000;
    const id = dl + "-" + off;
    if (at > now && state.next == null) state.next = new Date(at).toISOString();
    /* fire once, within 5 minutes after the mark */
    if (now >= at && now < at + 5 * 60000 && !state.fired.has(id)) {
      state.fired.add(id);
      state.last = new Date().toISOString();
      if (RUN_FOR_REAL) {
        const env = { ...process.env, FPL_PRED_OUT: join(SNAP_DIR(), "predictions.json") };
        const child = spawn(process.execPath, [SCRIPT], { cwd: REPO_ROOT, env, stdio: "ignore" });
        child.on("error", () => {});
        log("snapshot", `started (deadline-${off}min)`);
      } else {
        log("snapshot", `stub: would run scripts/snapshot-predictions.mjs at deadline-${off}min ` +
          `(needs Playwright and a browser; set RUN_SNAPSHOTS=1 after installing them)`);
      }
    }
  }
  /* earliest upcoming mark across both offsets */
  const upcoming = OFFSETS_MIN.map(o => dlMs - o * 60000).filter(t => t > now);
  state.next = upcoming.length ? new Date(Math.min(...upcoming)).toISOString() : null;
}

export function snapshotStatus() {
  return {
    last: state.last,
    next: state.next,
    mode: RUN_FOR_REAL ? "real" : "stub",
    note: RUN_FOR_REAL ? null :
      "stub only: snapshot-predictions.mjs needs Playwright; the moment is logged, nothing runs"
  };
}
