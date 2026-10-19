#!/usr/bin/env node
/* Release helper (F99, cutover 19 Oct 2026): sets one version everywhere it
   appears, so a browser never mixes old and new files after a deploy.
     app-core.js   APP_VERSION
     sw.js         the cache name
     index.html    ?v=<version> on every app script tag
   usage: node scripts/bump-version.mjs 12.19.0 */
import fs from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const v = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(v || "")) { console.error("usage: node scripts/bump-version.mjs <x.y.z>"); process.exit(2); }
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const edit = (file, re, to) => {
  const p = join(ROOT, file); const s = fs.readFileSync(p, "utf8");
  if (!re.test(s)) { console.error(`${file}: pattern not found ${re}`); process.exit(1); }
  fs.writeFileSync(p, s.replace(re, to));
};
edit("app-core.js", /const APP_VERSION="[\d.]+"/, `const APP_VERSION="${v}"`);
edit("sw.js", /const CACHE = "fpl-signals-v[\d.]+"/, `const CACHE = "fpl-signals-v${v}"`);
edit("index.html", /(<script src="\.\/app-[a-z]+\.js)(\?v=[\d.]+)?(")/g, `$1?v=${v}$3`);
console.log("version " + v);
