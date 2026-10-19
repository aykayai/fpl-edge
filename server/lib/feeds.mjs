/* FPL Signals server - the actuals and rivals feeds, built locally.

   The repo's scripts/build-actuals.mjs already knows how to build
   data/actuals.json and data/rivals.json from the official API, so it is
   run unchanged as a child process on the bootstrap cadence (15 min).
   Its output paths are env-driven (FPL_OUT, FPL_RIVALS_OUT, FPL_PRED_OUT),
   so absolute paths point it into the server's own state dir and nothing
   is ever written into the repo's data/ or committed anywhere. This is
   what takes rivals.json off the public repo at cutover. */

import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG } from "./config.mjs";
import { log } from "./util.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts", "build-actuals.mjs");

export const FEEDS_DIR = () => join(CONFIG.STATE_DIR, "feeds");
export const SNAP_DIR = () => join(CONFIG.STATE_DIR, "snapshots");

const state = { lastRun: null, lastOk: null, error: null };

export async function buildFeeds() {
  const t0 = Date.now();
  state.lastRun = new Date().toISOString();
  await mkdir(FEEDS_DIR(), { recursive: true });
  await mkdir(SNAP_DIR(), { recursive: true });
  const env = {
    ...process.env,
    FPL_ENTRY_ID: CONFIG.FPL_TEAM_ID,
    FPL_LEAGUE_ID: CONFIG.FPL_LEAGUE_ID,
    FPL_OUT: join(FEEDS_DIR(), "actuals.json"),
    FPL_RIVALS_OUT: join(FEEDS_DIR(), "rivals.json"),
    FPL_PRED_OUT: join(SNAP_DIR(), "predictions.json")
  };
  const code = await new Promise(resolve => {
    const child = spawn(process.execPath, [SCRIPT], {
      cwd: REPO_ROOT, env, stdio: ["ignore", "ignore", "pipe"]
    });
    let err = "";
    child.stderr.on("data", d => { err += d; });
    child.on("error", () => resolve({ code: -1, err: "spawn failed" }));
    child.on("close", c => resolve({ code: c, err }));
  });
  if (code.code === 0) {
    state.lastOk = new Date().toISOString();
    state.error = null;
    log("feeds.build", "ok", Date.now() - t0);
  } else {
    state.error = `exit ${code.code}: ${String(code.err).split("\n")[0].slice(0, 200)}`;
    log("feeds.build", "fail " + state.error, Date.now() - t0);
  }
}

export async function feedsStatus() {
  const file = async name => {
    try {
      const s = await stat(join(FEEDS_DIR(), name));
      return { present: true, modifiedAt: s.mtime.toISOString(), bytes: s.size };
    } catch { return { present: false }; }
  };
  return {
    lastRun: state.lastRun,
    lastOk: state.lastOk,
    ageMinutes: state.lastOk ? Math.round((Date.now() - Date.parse(state.lastOk)) / 60000) : null,
    error: state.error,
    actuals: await file("actuals.json"),
    rivals: await file("rivals.json")
  };
}
