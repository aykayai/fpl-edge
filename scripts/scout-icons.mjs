#!/usr/bin/env node
/* The Scout's icons into app-scout.js (12 Nov 2026).
   Reads design/scout-icon/*.svg (his set) and writes them into the ICONS
   block of app-scout.js. Run again after replacing the SVGs:
     node scripts/scout-icons.mjs */
import fs from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "design", "scout-icon");
const USE = { launcher: "01-launcher-primary-56.svg", hover: "07-state-hover-56.svg", thinking: "08-state-thinking-56.svg", avatar: "03-avatar-28.svg" };
const clean = s => s.replace(/<\?xml[^>]*>/, "").replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ").replace(/>\s+</g, "><").trim()
  .replace(/<svg /, '<svg aria-hidden="true" focusable="false" ');
const icons = {};
for (const [k, f] of Object.entries(USE)) {
  const s = clean(fs.readFileSync(join(DIR, f), "utf8"));
  if (!/^<svg[\s>]/.test(s) || /<script|on[a-z]+=|javascript:|<foreignObject/i.test(s)) throw new Error(`${f} is not a plain SVG`);
  icons[k] = s;
}
const file = join(ROOT, "app-scout.js");
const src = fs.readFileSync(file, "utf8");
const out = src.replace(/\/\*ICONS\*\/[\s\S]*?\/\*\/ICONS\*\//, `/*ICONS*/${JSON.stringify(icons)}/*/ICONS*/`);
if (out === src && !src.includes("/*ICONS*/")) throw new Error("no ICONS block in app-scout.js");
fs.writeFileSync(file, out);
console.log("icons written:", Object.keys(icons).join(", "));
