/* FPL Signals server - small shared helpers. No dependencies. */

/* One log line per action: time, action, result, ms. Never log keys,
   tokens or player names. Timestamps are UK time (Europe/London) with the
   GMT/BST label so the log reads in the owner's clock; everything in the
   API's JSON stays ISO UTC, since those are machine fields. */
const UK_LOG_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London", hour12: false, timeZoneName: "short",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit"
});
export function ukStamp(d = new Date()) {
  const p = {};
  for (const part of UK_LOG_FMT.formatToParts(d)) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} ${p.timeZoneName || ""}`.trim();
}
export function log(action, result, ms) {
  console.log(`${ukStamp()} ${action} ${result}${ms != null ? " " + ms + "ms" : ""}`);
}

/* fetch with a hard timeout, returning the Response or throwing. */
export async function fetchT(url, opts = {}, ms = 20000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/* Quote-aware CSV parser. Returns { header: [..], rows: [[..]], ragged }.
   ragged is true when any data row has a different cell count from the
   header, which is what a truncated or half-written file looks like. */
export function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQ = false;
      } else cell += c;
    } else if (c === '"') {
      inQ = true;
    } else if (c === ",") {
      row.push(cell); cell = "";
    } else if (c === "\n") {
      row.push(cell.endsWith("\r") ? cell.slice(0, -1) : cell);
      rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell.length || row.length) {
    row.push(cell.endsWith("\r") ? cell.slice(0, -1) : cell);
    rows.push(row);
  }
  const header = rows.shift() || [];
  /* drop a trailing fully-empty line */
  while (rows.length && rows[rows.length - 1].every(c => c === "")) rows.pop();
  const ragged = rows.some(r => r.length !== header.length);
  /* a file cut mid-quote never closed the quote: treat as ragged too */
  return { header, rows, ragged: ragged || inQ };
}

/* Decode the HTML entities that show up in RSS titles. */
export function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ");
}

/* Reduce any markup to plain text: unwrap CDATA, strip tags, decode
   entities, collapse whitespace. Run twice so entities that decode into
   tags (&lt;img ...&gt;) are stripped as well. */
export function plainText(s) {
  let t = String(s == null ? "" : s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  for (let pass = 0; pass < 2; pass++) {
    t = decodeEntities(t.replace(/<[^>]*>/g, " "));
  }
  return t.replace(/\s+/g, " ").trim();
}

/* Only plain absolute http(s) URLs survive; anything else becomes "". */
export function safeUrl(u) {
  const t = plainText(u);
  return /^https?:\/\/\S+$/i.test(t) ? t : "";
}

export function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function ageMinutes(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.round((Date.now() - t) / 60000);
}
