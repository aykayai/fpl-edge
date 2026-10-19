/* FPL Signals server - mirror of the FPL Core Insights dataset.

   The upstream workflow is on a cron but GitHub starts its runs hours
   late and the lateness drifts, so there is no clock worth scheduling
   to. Instead the commits API is polled every 15 minutes with an ETag
   (a 304 does not count against the unauthenticated 60/hour limit) and
   a pull happens only when the head commit for data/ changes.

   A pull downloads into a temp dir pinned to the commit sha, validates
   the result, and swaps directories atomically. On any failure the
   previous copy keeps being served and the status says stale, with the
   reason. A half-written file is never served. */

import { mkdir, readFile, writeFile, rename, rm, copyFile, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { CONFIG, UA } from "./config.mjs";
import { log, fetchT, parseCSV, sleep } from "./util.mjs";

const DS = () => join(CONFIG.STATE_DIR, "dataset");
const CUR = () => join(DS(), "current");
const META = ".signals-meta.json";

/* in-memory state, rebuilt from disk at boot */
const state = {
  etag: null,
  meta: null,          // { commit, committedAt, fetchedAt }
  lastError: null,     // string reason the newest pull failed, or null
  lastCheck: null
};

export async function initDataset() {
  try {
    state.meta = JSON.parse(await readFile(join(CUR(), META), "utf8"));
  } catch { state.meta = null; }
}

/* The exact file set the app reads, and nothing else. */
function fixedFiles() {
  const S = CONFIG.SEASON, L = CONFIG.LAST;
  const files = [
    `${S}/players.csv`, `${S}/playerstats.csv`, `${S}/teams.csv`,
    `${S}/gameweek_summaries.csv`,
    `${S}/By Tournament/Friendlies/GW0/playermatchstats.csv`,
    `${L}/players.csv`, `${L}/playerstats.csv`, `${L}/teams.csv`
  ];
  for (let gw = 1; gw <= 38; gw++) {
    files.push(`${S}/By Gameweek/GW${gw}/fixtures.csv`);
    files.push(`${L}/By Gameweek/GW${gw}/fixtures.csv`);
  }
  return files;
}

function rawUrl(sha, path) {
  return `${CONFIG.RAW_BASE}/${CONFIG.DATASET_REPO}/${sha}/${CONFIG.DATASET_PATH}/` +
    path.split("/").map(encodeURIComponent).join("/");
}

async function download(sha, path, destRoot) {
  const r = await fetchT(rawUrl(sha, path), { headers: { "User-Agent": UA } }, 60000);
  if (!r.ok) throw new Error(`${path} HTTP ${r.status}`);
  const body = Buffer.from(await r.arrayBuffer());
  const dest = join(destRoot, path);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, body);
  return body.length;
}

/* Last season never changes, so reuse the copy already on disk when one
   exists rather than re-downloading 10 MB three times a day. */
async function reuseOrDownload(sha, path, destRoot) {
  if (path.startsWith(CONFIG.LAST + "/")) {
    try {
      const prev = join(CUR(), path);
      await stat(prev);
      const dest = join(destRoot, path);
      await mkdir(dirname(dest), { recursive: true });
      await copyFile(prev, dest);
      return 0;
    } catch { /* fall through to a real download */ }
  }
  return download(sha, path, destRoot);
}

async function pool(jobs, width) {
  const queue = [...jobs];
  let bytes = 0;
  const workers = Array.from({ length: width }, async () => {
    while (queue.length) {
      /* add after the await, or concurrent workers lose each other's bytes */
      const n = await queue.shift()();
      bytes += n;
    }
  });
  await Promise.all(workers);
  return bytes;
}

/* Validation: closes the audit's silent-fallback findings. A dataset that
   does not meet all of this is refused outright and the old copy stays. */
async function validate(root) {
  const S = CONFIG.SEASON;
  const csv = async p => {
    const parsed = parseCSV(await readFile(join(root, p), "utf8"));
    if (parsed.ragged) throw new Error(`${p}: ragged or truncated rows`);
    return parsed;
  };
  const players = await csv(`${S}/players.csv`);
  if (players.rows.length < 600) throw new Error(`players.csv: ${players.rows.length} rows (< 600)`);
  const pstats = await csv(`${S}/playerstats.csv`);
  if (pstats.rows.length < 600) throw new Error(`playerstats.csv: ${pstats.rows.length} rows (< 600)`);
  if (!pstats.header.includes("now_cost")) throw new Error("playerstats.csv: no now_cost column");
  const teams = await csv(`${S}/teams.csv`);
  if (teams.rows.length < 20) throw new Error(`teams.csv: ${teams.rows.length} rows (< 20)`);
  const gws = await csv(`${S}/gameweek_summaries.csv`);
  if (gws.rows.length !== 38) throw new Error(`gameweek_summaries.csv: ${gws.rows.length} rows (expected 38)`);
  if (!gws.header.includes("finished")) throw new Error("gameweek_summaries.csv: no finished column");
  for (let gw = 1; gw <= 38; gw++) {
    await stat(join(root, `${S}/By Gameweek/GW${gw}/fixtures.csv`)).catch(() => {
      throw new Error(`GW${gw}/fixtures.csv missing`);
    });
  }
  return gws;
}

async function pull(sha, committedAt) {
  const t0 = Date.now();
  const tmp = join(DS(), "tmp-" + sha.slice(0, 12));
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });

  /* summaries first: they decide which per-gameweek stat files exist yet */
  await download(sha, `${CONFIG.SEASON}/gameweek_summaries.csv`, tmp);
  const gws = parseCSV(await readFile(join(tmp, `${CONFIG.SEASON}/gameweek_summaries.csv`), "utf8"));
  const fin = gws.header.indexOf("finished");
  const idc = gws.header.indexOf("id");
  const played = [];
  if (fin >= 0) gws.rows.forEach(r => {
    if (String(r[fin]).toLowerCase() === "true") played.push(Math.round(Number(r[idc >= 0 ? idc : 0])) || played.length + 1);
  });
  /* the first unfinished week too: during a round its files carry the
     matches played so far */
  const upTo = Math.min((played.length ? Math.max(...played) : 0) + 1, 38);

  const files = fixedFiles().filter(f => !f.endsWith("gameweek_summaries.csv"));
  for (let gw = 1; gw <= upTo; gw++) {
    files.push(`${CONFIG.SEASON}/By Gameweek/GW${gw}/playermatchstats.csv`);
    files.push(`${CONFIG.SEASON}/By Gameweek/GW${gw}/matches.csv`);
  }
  const bytes = await pool(files.map(f => () => reuseOrDownload(sha, f, tmp)), 8);

  await validate(tmp);

  const meta = { commit: sha, committedAt, fetchedAt: new Date().toISOString() };
  await writeFile(join(tmp, META), JSON.stringify(meta) + "\n");

  /* atomic swap: current -> prev, tmp -> current */
  const prev = join(DS(), "prev");
  await rm(prev, { recursive: true, force: true });
  try { await rename(CUR(), prev); } catch { /* first ever pull */ }
  await rename(tmp, CUR());
  state.meta = meta;
  state.lastError = null;
  log("dataset.pull", `ok ${sha.slice(0, 7)} ${files.length + 1} files ${(bytes / 1048576).toFixed(1)}MB`, Date.now() - t0);
}

/* One poll: has the dataset repo's data/ path a new head commit? */
export async function pollDataset() {
  const t0 = Date.now();
  state.lastCheck = new Date().toISOString();
  const url = `${CONFIG.GITHUB_API_BASE}/repos/${CONFIG.DATASET_REPO}/commits?path=${CONFIG.DATASET_PATH}&per_page=1`;
  const headers = { "User-Agent": UA, Accept: "application/vnd.github+json" };
  if (state.etag) headers["If-None-Match"] = state.etag;
  let sha, committedAt;
  try {
    const r = await fetchT(url, { headers }, 20000);
    if (r.status === 304) { log("dataset.poll", "304 unchanged", Date.now() - t0); return; }
    if (!r.ok) throw new Error("commits HTTP " + r.status);
    state.etag = r.headers.get("etag");
    const list = await r.json();
    if (!Array.isArray(list) || !list[0]?.sha) throw new Error("commits: unexpected shape");
    sha = list[0].sha;
    committedAt = list[0].commit?.committer?.date || list[0].commit?.author?.date || null;
  } catch (e) {
    state.lastError = "poll failed: " + e.message;
    log("dataset.poll", "fail " + e.message, Date.now() - t0);
    return;
  }
  if (state.meta && state.meta.commit === sha) {
    state.lastError = null;
    log("dataset.poll", "same commit", Date.now() - t0);
    return;
  }
  try {
    await pull(sha, committedAt);
  } catch (e) {
    state.lastError = "pull rejected: " + e.message;
    log("dataset.pull", "fail " + e.message, Date.now() - t0);
    /* leave the temp dir behind for inspection? no: tidy it */
    await rm(join(DS(), "tmp-" + sha.slice(0, 12)), { recursive: true, force: true }).catch(() => {});
  }
}

/* The current gameweek from gameweek_summaries: the lowest id whose
   finished flag is not true. The rows are sorted by id first, because
   the live file is NOT in gameweek order (seen 1, 2, 15, 16, ... on
   11 Oct 2026); the app's own first-unfinished-row read trips on that. */
export async function datasetGW() {
  try {
    const gws = parseCSV(await readFile(join(CUR(), `${CONFIG.SEASON}/gameweek_summaries.csv`), "utf8"));
    const fin = gws.header.indexOf("finished");
    const idc = gws.header.indexOf("id");
    if (fin < 0 || idc < 0) return null;
    const rows = gws.rows
      .map(r => ({ id: Math.round(Number(r[idc])), done: String(r[fin]).toLowerCase() === "true" }))
      .filter(r => Number.isFinite(r.id) && r.id >= 1)
      .sort((a, b) => a.id - b.id);
    for (const r of rows) if (!r.done) return r.id;
    return rows.length ? 38 : null;
  } catch { return null; }
}

export function datasetStatus() {
  const m = state.meta;
  const age = m?.fetchedAt ? Math.round((Date.now() - Date.parse(m.fetchedAt)) / 60000) : null;
  const cage = m?.committedAt ? Math.round((Date.now() - Date.parse(m.committedAt)) / 60000) : null;
  return {
    season: CONFIG.SEASON,
    commit: m?.commit || null,
    committedAt: m?.committedAt || null,
    fetchedAt: m?.fetchedAt || null,
    ageMinutes: cage,
    /* stale: the newest attempt failed, or the upstream commit is over
       12 hours old (it normally lands about three times a day) */
    stale: !!state.lastError || cage == null || cage > 720,
    staleReason: state.lastError || (cage != null && cage > 720 ? "upstream commit over 12h old" : (m ? null : "no dataset yet"))
  };
}

export function datasetMeta() { return state.meta; }
export function currentDir() { return CUR(); }
