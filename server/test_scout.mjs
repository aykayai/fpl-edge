#!/usr/bin/env node
/* The Scout (12 Nov 2026): the tool endpoint Jeevs calls and the pop-up's routes.
   Runs a server on a COPY of the test state (The Scout writes its plan and
   injury log into the state dir; the shared fixture must stay untouched).
   No upstream fetches: news searches are not exercised here.
   usage: STATE_DIR=<fixture> node server/test_scout.mjs */
import { spawn } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = process.env.STATE_DIR;
if (!SRC || !existsSync(SRC)) { console.error("STATE_DIR (the frozen test state) is required"); process.exit(2); }
const STATE = mkdtempSync(join(tmpdir(), "scout-test-"));
cpSync(SRC, STATE, { recursive: true });
rmSync(join(STATE, ".frozen"), { force: true });
const PORT = 8000 + Math.floor(Math.random() * 400) + 500;
const TOKEN = "scout-test-token-0123456789abcdef";
const srv = spawn(process.execPath, [join(ROOT, "server", "server.mjs")], {
  env: { ...process.env, STATE_DIR: STATE, PORT: String(PORT), SIGNALS_TICK_MS: "86400000", FPL_SCOUT_MCP_TOKEN: TOKEN, FPL_ASSISTANT_TOKEN: "", ODDS_API_KEY: "" },
  stdio: ["ignore", "ignore", "pipe"] });
srv.stderr.on("data", () => {});

let pass = 0, fail = 0;
const check = (name, ok, got) => { if (ok) pass++; else { fail++; console.log("FAIL " + name + (got !== undefined ? " · got " + JSON.stringify(got).slice(0, 200) : "")); } };
const post = (path, body, headers) => new Promise((ok, bad) => {
  const data = JSON.stringify(body);
  const r = http.request({ host: "127.0.0.1", port: PORT, path, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data), ...headers } },
    res => { let s = ""; res.on("data", c => s += c); res.on("end", () => ok({ status: res.statusCode, body: s })); });
  r.on("error", bad); r.end(data);
});
const get = (path, headers) => new Promise((ok, bad) => {
  http.get({ host: "127.0.0.1", port: PORT, path, headers }, res => { let s = ""; res.on("data", c => s += c); res.on("end", () => ok({ status: res.statusCode, body: s })); }).on("error", bad);
});
const J = s => { try { return JSON.parse(s); } catch { return null; } };

try {
  for (let i = 0; i < 80; i++) { try { await get("/api/status"); break; } catch { await new Promise(r => setTimeout(r, 250)); } }
  const good = { Host: "fpl-signals:8090", Authorization: "Bearer " + TOKEN };
  const rpc = (method, params, h = good) => post("/mcp", { jsonrpc: "2.0", id: 7, method, params }, h);

  let r = await rpc("tools/list", {}, { Host: "fpl-signals.example.ts.net", Authorization: "Bearer " + TOKEN });
  check("the tool endpoint refuses the tailnet host", r.status === 404, r.status);
  r = await rpc("tools/list", {}, { Host: "fpl-signals:8090", Authorization: "Bearer not-the-token-0123456789abcdef" });
  check("the tool endpoint refuses a wrong token", r.status === 404, r.status);
  r = await rpc("tools/list", {}, { Host: "fpl-signals:8090" });
  check("the tool endpoint refuses no token", r.status === 404, r.status);
  r = await get("/mcp", good);
  check("the tool endpoint takes POST only", r.status === 404, r.status);
  r = await rpc("initialize", { protocolVersion: "2025-06-18" });
  check("initialize answers", J(r.body)?.result?.serverInfo?.name === "fpl-signals-scout", r.body);
  r = await rpc("tools/list", {});
  const tools = J(r.body)?.result?.tools || [];
  check("16 tools, all fpl_ and read-only", tools.length === 16 && tools.every(t => t.name.startsWith("fpl_") && t.annotations.readOnlyHint), tools.map(t => t.name));

  const call = async (name, args) => J((await rpc("tools/call", { name, arguments: args })).body)?.result?.structuredContent;
  let d = await call("fpl_my_team", { horizon: 1 });
  check("my team: 15 players and a predicted score", d && d.ok && d.players.length === 15 && d.figures.predicted_pts > 0, d);
  check("my team: says where the squad came from", d && d.plan && /official FPL team|draft plan/.test(d.plan.from), d && d.plan);
  check("my team: the v1 shape", d && d.from && d.from.link && d.as_of && d.inputs && d.figures, d && Object.keys(d));
  d = await call("fpl_player", { name: d.players[0].name });
  check("player: next five gameweeks", d && d.ok && d.per_gw.length === 5, d);
  d = await call("fpl_player", { name: "Nobody Atall" });
  check("player: an unknown name is a refusal, not a zero", d && d.ok === false && /No player/.test(d.error), d);
  d = await call("fpl_transfer_options", { limit: 3 });
  check("transfers: moves with gains", d && d.ok && Array.isArray(d.moves), d);
  if (d && d.moves && d.moves[0]) {
    const m = d.moves[0];
    const e = await call("fpl_evaluate_transfers", { moves: [{ out: m.out, in: m.in }] });
    check("evaluate: the engine's own move is legal and gains", e && e.ok && e.legal && e.figures.gain_pts > 0, e);
    const p = await call("fpl_propose_plan_change", { changes: [{ type: "transfer", out: m.out, in: m.in }] });
    check("propose: an action for the pop-up", p && p.ok && p.action && p.action.kind === "fpl_plan" && p.action.changes[0].in_id > 0, p);
  }
  d = await call("fpl_propose_plan_change", { changes: [{ type: "sell everything" }] });
  check("propose: an unknown change is refused", d && d.ok === false, d);
  d = await call("fpl_captain_options", {});
  check("captain: options", d && d.ok && d.options.length > 0, d);
  d = await call("fpl_fixtures", {});
  check("fixtures: a gameweek's matches", d && d.ok && d.fixtures.length > 0, d);
  r = await rpc("tools/call", { name: "fpl_player", arguments: { nme: "x" } });
  check("a wrong argument is a JSON-RPC error", J(r.body)?.error?.code === -32602, r.body);
  r = await rpc("tools/call", { name: "fpl_delete_team", arguments: {} });
  check("an unknown tool is a JSON-RPC error", J(r.body)?.error?.code === -32602, r.body);

  r = await post("/api/scout/ask", { message: "hi" }, { Host: "127.0.0.1:" + PORT });
  check("the pop-up route refuses a request without its header", r.status === 403, r.status);
  r = await post("/api/scout/ask", { message: "hi" }, { Host: "127.0.0.1:" + PORT, "X-Scout": "1", Origin: "https://evil.example" });
  check("the pop-up route refuses another site", r.status === 403, r.status);
  r = await post("/api/scout/ask", { message: "hi" }, { Host: "127.0.0.1:" + PORT, "X-Scout": "1" });
  check("without the token it says not connected", /not connected yet/.test(J(r.body)?.error || ""), r.body);
  r = await get("/api/scout/status", { "X-Scout": "1" });
  check("status says not connected", J(r.body)?.connected === false, r.body);
  r = await get("/index.html");
  check("the page loads The Scout", /app-scout\.js/.test(r.body), r.status);
} catch (e) { fail++; console.log("FAIL " + e.message); }
finally { srv.kill(); try { rmSync(STATE, { recursive: true, force: true }); } catch { /* temp */ } }
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
