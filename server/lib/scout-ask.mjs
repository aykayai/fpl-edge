/* The Scout pop-up's routes (12 Nov 2026): ask, and the conversation so far.

   The pop-up is a window onto the one assistant in Jeevs (Andy, 12 Nov 2026),
   as Fintel's is. The browser talks only to this server, same-origin; this
   server passes the question to Jeevs over the private docker network with a
   bearer token (FPL_ASSISTANT_TOKEN), so the browser never holds a token.

   What goes to Jeevs is his question and where he asked from (page, the
   player or card he asked about). His draft plan stays here: it is saved for
   the tools to read (scout-mcp.mjs), never sent as figures. The reply is cut
   to the fields the pop-up draws, links checked, as Fintel's clean_turn does. */

import { savePlan } from "./scout-mcp.mjs";

const URL_DEFAULT = "http://jeevs:8080/fpl-assistant";
const TIMEOUT = 120000, MAX_MESSAGE = 4000, MAX_REPLY = 512 * 1024;
const ID = /^[A-Za-z0-9_.:-]{1,80}$/;
const KINDS = ["good", "warn", "next", "info"];
const SAID = { 401: "FPL Signals and Jeevs do not agree on The Scout's token, so Jeevs refused.",
  429: "The Scout has reached this month's cost cap.", 503: "The Scout is not answering at the moment." };

const short = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const link = v => { v = String(v || ""); return v.startsWith("/") && !v.startsWith("//") && v.length < 400 ? v : ""; };
const url = v => { v = String(v || ""); return /^https?:\/\//.test(v) && v.length < 1000 ? v : ""; };
const strs = (v, n = 12) => (Array.isArray(v) ? v.slice(0, n).filter(x => ["string", "number"].includes(typeof x)).map(x => short(x, 600)) : []);
const icon = v => (/^[a-z0-9-]{2,40}$/.test(String(v || "")) ? String(v) : "");
const points = (items, n = 8) => (Array.isArray(items) ? items : []).slice(0, n).filter(p => p && p.text)
  .map(p => ({ kind: KINDS.includes(p.kind) ? p.kind : "info", text: short(p.text, 400), icon: icon(p.icon) }));

export function ready() { return (process.env.FPL_ASSISTANT_TOKEN || "").trim().length >= 32; }

function pageContext(raw) {
  raw = raw && typeof raw === "object" ? raw : {};
  let path = String(raw.path || "/");
  if (!path.startsWith("/") || path.startsWith("//") || path.length > 200) path = "/";
  const out = { app: "fpl", path, title: short(raw.title, 80) || "FPL Signals", period: null, card: null };
  const c = raw.card;
  if (c && typeof c === "object" && c.title) out.card = { id: ID.test(String(c.id || "")) ? String(c.id) : "", title: short(c.title, 80) };
  return out;
}

function actions(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list.slice(0, 4).filter(a => a && a.kind === "fpl_plan" && Array.isArray(a.changes)).map(a => ({
    kind: "fpl_plan", label: short(a.label, 200),
    changes: a.changes.slice(0, 5).map(c => {
      if (c.type === "transfer" && Number.isInteger(c.out_id) && Number.isInteger(c.in_id)) return { type: "transfer", out_id: c.out_id, in_id: c.in_id, label: short(c.label, 120) };
      if ((c.type === "captain" || c.type === "vice") && Number.isInteger(c.id)) return { type: c.type, id: c.id, label: short(c.label, 120) };
      if (c.type === "chip" && ["wildcard", "freehit", "bboost", "3xc"].includes(c.chip) && Number.isInteger(c.gw)) return { type: "chip", chip: c.chip, gw: c.gw, label: short(c.label, 120) };
      return null;
    }).filter(Boolean)
  })).filter(a => a.changes.length);
}

export function cleanTurn(raw) {
  const rec = raw.recommendation;
  const draft = raw.draft && typeof raw.draft === "object" ? raw.draft : {};
  return {
    turn_id: short(raw.turn_id, 80),
    role: raw.role === "user" ? "user" : "scout",
    text: String(raw.answer || raw.text || "").slice(0, 20000),
    at: short(raw.at, 40),
    from: (Array.isArray(raw.from) ? raw.from : []).slice(0, 8).filter(f => f && typeof f === "object").map(f => ({ label: short(f.label, 120), link: link(f.link) })),
    sources: (Array.isArray(raw.sources) ? raw.sources : []).slice(0, 12).filter(s => s && typeof s === "object").map((s, i) => ({
      n: /^\d+$/.test(String(s.n || "")) ? +s.n : i + 1, title: short(s.title, 200), url: url(s.url), checked: short(s.checked, 30) })),
    unverified: strs(raw.unverified),
    recommendation: rec && typeof rec === "object" && rec.text ? { text: short(rec.text, 600), reasons: strs(rec.reasons), assumptions: strs(rec.assumptions), risks: strs(rec.risks) } : null,
    headline: short(raw.headline, 200), icon: icon(raw.icon), meta: short(raw.meta, 120),
    tiles: (Array.isArray(raw.tiles) ? raw.tiles : []).slice(0, 4).filter(x => x && x.label && x.value != null)
      .map(x => ({ label: short(x.label, 40), value: short(x.value, 30), icon: icon(x.icon), tone: ["good", "warn"].includes(x.tone) ? x.tone : "" })),
    points: points(raw.points), key_points: points(raw.key_points, 5),
    sections: (Array.isArray(raw.sections) ? raw.sections : []).slice(0, 6).filter(s => s && s.title).map(s => ({ title: short(s.title, 80), icon: icon(s.icon), text: String(s.text || "").slice(0, 4000) })),
    follow_ups: strs(raw.follow_ups).slice(0, 4),
    actions: actions(raw.actions)
  };
}

async function callJeevs(method, path, body) {
  const base = (process.env.FPL_ASSISTANT_URL || "").trim() || URL_DEFAULT;
  try {
    const r = await fetch(base.replace(/\/$/, "") + path, {
      method, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(TIMEOUT),
      headers: { Authorization: "Bearer " + (process.env.FPL_ASSISTANT_TOKEN || "").trim(), "Content-Type": "application/json", Accept: "application/json" } });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_REPLY) return [502, { ok: false, error: "The Scout's answer was too long to show." }];
    let out = {}; try { out = JSON.parse(buf.toString("utf8") || "{}"); } catch { return [502, { ok: false, error: "The Scout's answer could not be read." }]; }
    return [r.status, out && typeof out === "object" ? out : {}];
  } catch { return [503, { ok: false, error: "Jeevs could not be reached." }]; }
}
const answer = (status, out) => (status !== 200 || !out.ok)
  ? { ok: false, error: SAID[status] || short(out.error, 300) || "The Scout could not answer." } : out;

/* body: {message, conversation_id, page, plan} */
export async function ask(body, log) {
  const message = String(body.message || "").trim();
  if (!message) return { ok: false, error: "Type a question first." };
  if (message.length > MAX_MESSAGE) return { ok: false, error: `Keep it under ${MAX_MESSAGE} characters.` };
  if (body.plan) { try { await savePlan(body.plan); } catch (e) { log && log("scout", "plan not saved: " + e.message); } }
  if (!ready()) return { ok: false, error: "The Scout is not connected yet." };
  const conv = typeof body.conversation_id === "string" && ID.test(body.conversation_id) ? body.conversation_id : null;
  const send = { conversation_id: conv, message, page: pageContext(body.page), mode: "assistant" };
  log && log("scout", `asked (${message.length} chars, ${send.page.path})`);
  const [status, out] = await callJeevs("POST", "/ask", send);
  if (status === 200 && out.ok) return { ok: true, conversation_id: short(out.conversation_id, 80), ...cleanTurn(out) };
  return answer(status, out);
}
export async function history() {
  if (!ready()) return { ok: true, conversation_id: null, turns: [] };
  const [status, out] = await callJeevs("GET", "/history?limit=20");
  if (status === 200 && Array.isArray(out.turns)) return { ok: true, conversation_id: short(out.conversation_id, 80),
    turns: out.turns.slice(-40).filter(t => t && typeof t === "object").map(cleanTurn) };
  return answer(status, out);
}
export async function newThread() {
  if (!ready()) return { ok: true, conversation_id: null };
  const [status, out] = await callJeevs("POST", "/new", {});
  return status === 200 ? { ok: true, conversation_id: short(out.conversation_id, 80) } : answer(status, out);
}
