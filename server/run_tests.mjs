/* Run every suite at once and print one summary (12 Oct 2026).

   The suites used to be run one after another, which took 10 to 15 minutes;
   each starts its own frozen server on its own port, so they can run side by
   side against the same state dir (a frozen server only reads it).

   Usage: STATE_DIR=... JSDOM_DIR=... node server/run_tests.mjs
   Optional: OLD_REF for the regression baseline (default: HEAD). */

import { spawn, execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OLD_REF = process.env.OLD_REF || execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT }).toString().trim();
const SUITES = [
  { name: "gate", file: "test_gate.mjs", env: {} },
  { name: "regression", file: "test_regression.mjs", env: { PORT: "8093", OLD_REF } },
  { name: "planner history", file: "test_planner_history.mjs", env: { PORT: "8094" } },
  { name: "signals", file: "test_signals.mjs", env: { PORT: "8097" } },
  { name: "broken items", file: "test_broken.mjs", env: { PORT: "8098" } },
  ...(process.env.EXTRA ? process.env.EXTRA.split(",").map((f, i) => ({ name: f, file: f, env: { PORT: String(8110 + i) } })) : []),
];

const t0 = Date.now();
const run = s => new Promise(res => {
  const out = [];
  const child = spawn(process.execPath, [join(ROOT, "server", s.file)], { env: { ...process.env, ...s.env }, cwd: ROOT });
  child.stdout.on("data", d => out.push(String(d)));
  child.stderr.on("data", d => out.push(String(d)));
  const timer = setTimeout(() => { child.kill(); out.push("\nTIMED OUT after 10 minutes"); }, 600000);
  child.on("close", code => {
    clearTimeout(timer);
    const text = out.join("");
    const fails = text.split("\n").filter(l => l.startsWith("FAIL"));
    const tally = (text.match(/(\d+) passed, (\d+) failed/) || [])[0] || "no tally";
    res({ ...s, code, fails, tally, secs: Math.round((Date.now() - t0) / 1000) });
  });
});

const results = await Promise.all(SUITES.map(run));
let bad = 0;
for (const r of results) {
  const ok = r.code === 0;
  if (!ok) bad++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${r.name.padEnd(16)} ${r.tally.padEnd(22)} ${r.secs}s`);
  r.fails.slice(0, 8).forEach(l => console.log("      " + l.slice(0, 220)));
}
console.log(`\n${results.length - bad} of ${results.length} suites passed in ${Math.round((Date.now() - t0) / 1000)}s`);
process.exit(bad ? 1 : 0);
