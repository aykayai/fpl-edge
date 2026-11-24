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
/* The regression baseline must be older code than the code under test
   (audit, 22 Nov 2026): defaulting to HEAD compared the code with itself, so
   a projection change could never fail. Default to origin/main, and refuse a
   baseline that is the same commit as HEAD when nothing has changed. */
const git = a => execFileSync("git", a, { cwd: ROOT }).toString().trim();
const OLD_REF = process.env.OLD_REF || git(["rev-parse", "--short", "origin/main"]);
if (git(["rev-parse", OLD_REF]) === git(["rev-parse", "HEAD"]) && !git(["status", "--porcelain", "--", "*.js", "*.mjs", "index.html"])) {
  console.error("OLD_REF is the same commit as HEAD with nothing changed: the regression suite would compare the code with itself. Set OLD_REF to an older commit.");
  process.exit(2);
}
const SUITES = [
  { name: "gate", file: "test_gate.mjs", env: {} },
  { name: "regression", file: "test_regression.mjs", env: { PORT: "8093", OLD_REF, SERVE_FULL_LAST: "1" } },
  { name: "planner history", file: "test_planner_history.mjs", env: { PORT: "8094" } },
  { name: "signals", file: "test_signals.mjs", env: { PORT: "8097" } },
  { name: "broken items", file: "test_broken.mjs", env: { PORT: "8098" } },
  { name: "extra", file: "test_extra.mjs", env: { PORT: "8091" } },
  { name: "the scout", file: "test_scout.mjs", env: {} },
  { name: "model", file: "test_model.mjs", env: { PORT: "8112" } },
  { name: "pages", file: "test_pages.mjs", env: { PORT: "8113" } },
  ...(process.env.EXTRA ? process.env.EXTRA.split(",").map((f, i) => ({ name: f, file: f, env: { PORT: String(8120 + i) } })) : []),
];

/* The least number of checks each suite passes today (Bundle F, 22 Nov
   2026). A suite whose passed count falls below its floor fails even with
   no FAIL line, so a block that silently stops running is caught. Raise a
   floor when checks are added; EXTRA suites are matched by file name. */
/* regression 17 -> 16 (22 Nov 2026): Rivals left the strict text comparison
   on purpose (folded into League); it is reported as changed by design */
const FLOORS = { "gate": 35, "regression": 16, "planner history": 16, "signals": 42, "broken items": 84, "extra": 14,
  "the scout": 26, "model": 45, "pages": 18, "test_rules.mjs": 177 };

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
    const m = text.match(/(\d+) passed, (\d+) failed/), tally = m ? m[0] : "no tally";
    const floor = FLOORS[s.name];
    if (floor != null && !(m && +m[1] >= floor)) {
      fails.unshift(`FAIL  only ${m ? m[1] : 0} checks passed; this suite's floor is ${floor} (a block stopped running?)`);
      code = code || 1;
    }
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
