/* FPL Signals server - last season's player stats, final rows only (F79,
   13 Oct 2026).

   A finished season's playerstats.csv holds one row per player per
   gameweek (about 9.4 MB). The app only ever reads each player's final row
   (it sorts by gameweek and the last row wins), so the server serves that
   row alone: about 2% of the bytes, and the browser no longer parses ~30,000
   rows on every open. The derived file sits beside its source and is
   rebuilt whenever the source is newer. */

import { readFile, writeFile, stat, rename } from "node:fs/promises";

/* split one CSV record, honouring quotes */
function fields(line) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
/* records, allowing newlines inside quoted fields */
function records(text) {
  const recs = []; let start = 0, q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') q = !q;
    else if (c === "\n" && !q) { recs.push(text.slice(start, i).replace(/\r$/, "")); start = i + 1; }
  }
  if (start < text.length) recs.push(text.slice(start).replace(/\r$/, ""));
  return recs.filter(r => r.length);
}

export function finalRows(text) {
  const recs = records(text);
  const head = fields(recs[0]);
  const iId = head.indexOf("id"), iGw = head.indexOf("gw");
  if (iId < 0 || iGw < 0) return null;
  const best = new Map();
  for (let r = 1; r < recs.length; r++) {
    const f = fields(recs[r]);
    const id = f[iId], gw = Number(f[iGw]) || 0;
    const cur = best.get(id);
    /* ties keep the later row, as the app's last-row-wins join does */
    if (!cur || gw >= cur.gw) best.set(id, { gw, rec: recs[r] });
  }
  return [recs[0], ...[...best.values()].map(v => v.rec)].join("\n") + "\n";
}

/* path of the derived file, built if missing or older than the source */
export async function finalRowsFile(full) {
  const out = full.replace(/\.csv$/, ".final.csv");
  const src = await stat(full);
  try { if ((await stat(out)).mtimeMs >= src.mtimeMs) return out; } catch { /* not built yet */ }
  const trimmed = finalRows(await readFile(full, "utf8"));
  if (!trimmed) return full;
  await writeFile(out + ".tmp", trimmed);
  await rename(out + ".tmp", out);
  return out;
}
