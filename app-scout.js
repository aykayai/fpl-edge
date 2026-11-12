/* FPL Signals - app-scout.js
   The Scout (12 Nov 2026): the pop-up AI assistant, a window onto the one
   assistant in Jeevs (Andy's decision). The page talks only to this server
   (/api/scout/*); the server passes the question to Jeevs and keeps his
   draft plan for The Scout's tools, so every figure in an answer comes from
   the app's own model. Self-contained: it lives outside #app, so the page's
   renders never wipe it, and nothing else in the app depends on it.
   Answers use the format shared with Jeevs and Fintel (headline, tiles,
   points, sections, sources, follow-ups) plus "Apply to my plan", which
   changes his draft plan through the app's own actions, only when pressed. */
(function () {
  if (typeof document === "undefined" || typeof BACKUP !== "undefined" && BACKUP) return;
  /* ICONS: his set (design/scout-icon), embedded by scripts/scout-icons.mjs */
  const ICON = /*ICONS*/{"launcher":"<svg aria-hidden=\"true\" focusable=\"false\" xmlns=\"http://www.w3.org/2000/svg\" width=\"56\" height=\"56\" viewBox=\"0 0 56 56\"><circle cx=\"28\" cy=\"28\" r=\"28\" fill=\"#E8743B\"/><g transform=\"translate(10.64 10.64) scale(1.4466666666666665)\"><rect x=\"3.2\" y=\"3.2\" width=\"17.6\" height=\"17.6\" rx=\"5\" fill=\"none\" stroke=\"#0A0A0A\" stroke-width=\"2.1\"/><circle cx=\"8.4\" cy=\"10.6\" r=\"1.35\" fill=\"#0A0A0A\"/><circle cx=\"14.8\" cy=\"10.1\" r=\"2.9\" fill=\"none\" stroke=\"#0A0A0A\" stroke-width=\"1.9\"/><circle cx=\"14.8\" cy=\"10.1\" r=\"1.05\" fill=\"#0A0A0A\"/><path d=\"M8.3 15.2q2.3 2.1 4.6 0\" fill=\"none\" stroke=\"#0A0A0A\" stroke-width=\"1.9\" stroke-linecap=\"round\"/></g></svg>","hover":"<svg aria-hidden=\"true\" focusable=\"false\" xmlns=\"http://www.w3.org/2000/svg\" width=\"56\" height=\"56\" viewBox=\"0 0 56 56\"><circle cx=\"28\" cy=\"28\" r=\"28\" fill=\"#F08A55\"/><g transform=\"translate(10.64 10.64) scale(1.4466666666666665)\"><rect x=\"3.2\" y=\"3.2\" width=\"17.6\" height=\"17.6\" rx=\"5\" fill=\"none\" stroke=\"#0A0A0A\" stroke-width=\"2.1\"/><circle cx=\"9.200000000000001\" cy=\"9.799999999999999\" r=\"1.35\" fill=\"#0A0A0A\"/><circle cx=\"15.600000000000001\" cy=\"9.299999999999999\" r=\"2.9\" fill=\"none\" stroke=\"#0A0A0A\" stroke-width=\"1.9\"/><circle cx=\"15.600000000000001\" cy=\"9.299999999999999\" r=\"1.05\" fill=\"#0A0A0A\"/><path d=\"M9.100000000000001 14.399999999999999q2.3 2.1 4.6 0\" fill=\"none\" stroke=\"#0A0A0A\" stroke-width=\"1.9\" stroke-linecap=\"round\"/></g></svg>","thinking":"<svg aria-hidden=\"true\" focusable=\"false\" xmlns=\"http://www.w3.org/2000/svg\" width=\"56\" height=\"56\" viewBox=\"0 0 56 56\"><circle cx=\"28\" cy=\"28\" r=\"28\" fill=\"#E8743B\"/><g transform=\"translate(10.64 10.64) scale(1.4466666666666665)\"><rect x=\"3.2\" y=\"3.2\" width=\"17.6\" height=\"17.6\" rx=\"5\" fill=\"none\" stroke=\"#0A0A0A\" stroke-width=\"2.1\"/><circle cx=\"8.4\" cy=\"10.6\" r=\"1.35\" fill=\"#0A0A0A\"/><path d=\"M12.2 10.4a2.6 2.6 0 0 1 5.2 0\" fill=\"none\" stroke=\"#0A0A0A\" stroke-width=\"1.9\" stroke-linecap=\"round\"/><path d=\"M12.2 10.4h5.2\" fill=\"none\" stroke=\"#0A0A0A\" stroke-width=\"1.9\" stroke-linecap=\"round\"/><path d=\"M8.3 15.2q2.3 2.1 4.6 0\" fill=\"none\" stroke=\"#0A0A0A\" stroke-width=\"1.9\" stroke-linecap=\"round\"/></g></svg>","avatar":"<svg aria-hidden=\"true\" focusable=\"false\" xmlns=\"http://www.w3.org/2000/svg\" width=\"28\" height=\"28\" viewBox=\"0 0 28 28\"><circle cx=\"14\" cy=\"14\" r=\"14\" fill=\"#E8743B\"/><g transform=\"translate(4.479999999999999 4.479999999999999) scale(0.7933333333333334)\"><rect x=\"3.2\" y=\"3.2\" width=\"17.6\" height=\"17.6\" rx=\"5\" fill=\"none\" stroke=\"#0A0A0A\" stroke-width=\"2.1\"/><circle cx=\"8.4\" cy=\"10.6\" r=\"1.35\" fill=\"#0A0A0A\"/><circle cx=\"14.8\" cy=\"10.1\" r=\"2.9\" fill=\"none\" stroke=\"#0A0A0A\" stroke-width=\"1.9\"/><circle cx=\"14.8\" cy=\"10.1\" r=\"1.05\" fill=\"#0A0A0A\"/><path d=\"M8.3 15.2q2.3 2.1 4.6 0\" fill=\"none\" stroke=\"#0A0A0A\" stroke-width=\"1.9\" stroke-linecap=\"round\"/></g></svg>"}/*/ICONS*/;
  const st = { open: false, busy: false, conv: null, turns: [], loaded: false, connected: null, about: null, applied: {} };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const L = (n, sz) => (typeof lic === "function" ? lic(n, sz || 15) : "");
  const KIND_ICON = { good: "check", warn: "triangle-alert", next: "arrow-right", info: "info" };
  const PART = { "circle-check": "check", sparkles: "sparkles", "triangle-alert": "triangle-alert", "trending-up": "trending-up", calendar: "calendar",
    target: "target", gauge: "gauge", wallet: "wallet", users: "users", shield: "shield", crown: "crown", info: "info", "chevron-right": "chevron-right" };
  const pi = n => L(PART[n] || (typeof LUCIDE !== "undefined" && LUCIDE[n] ? n : "info"), 15);

  /* light markdown: **bold**, [n] references, - and 1. lists, line breaks */
  function md(t) {
    const lines = esc(t).split(/\n/);
    let out = "", list = null;
    const inline = s => s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\[(\d{1,2})\]/g, '<sup class="scx-ref">$1</sup>');
    for (const ln of lines) {
      const m = /^\s*(?:[-*]|(\d+)\.)\s+(.*)$/.exec(ln);
      if (m) { const kind = m[1] ? "ol" : "ul"; if (list !== kind) { if (list) out += `</${list}>`; out += `<${kind}>`; list = kind; } out += `<li>${inline(m[2])}</li>`; continue; }
      if (list) { out += `</${list}>`; list = null; }
      if (/^#{1,3}\s+/.test(ln)) out += `<p class="scx-h">${inline(ln.replace(/^#+\s+/, ""))}</p>`;
      else if (ln.trim()) out += `<p>${inline(ln)}</p>`;
    }
    return out + (list ? `</${list}>` : "");
  }

  const CSS = `
  .scx-btn{position:fixed;right:22px;bottom:22px;z-index:950;width:56px;height:56px;border:0;padding:0;border-radius:50%;background:none;cursor:pointer;
    box-shadow:0 10px 30px rgba(0,0,0,.45);transition:transform .15s}
  .scx-btn:hover{transform:translateY(-2px)}.scx-btn svg{display:block;width:56px;height:56px}
  .scx-btn .scx-h1{display:none}.scx-btn:hover .scx-h0{display:none}.scx-btn:hover .scx-h1{display:block}
  .scx-panel{position:fixed;top:72px;right:20px;bottom:20px;width:468px;max-width:calc(100vw - 32px);z-index:960;background:#111;border-radius:16px;
    box-shadow:0 0 0 1px rgba(255,255,255,.09),0 30px 80px rgba(0,0,0,.6);display:flex;flex-direction:column;font-family:'Geist',system-ui,sans-serif;color:#EDEDED}
  .scx-head{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.07)}
  .scx-av{flex:none;width:34px;height:34px}.scx-av svg{width:100%;height:100%;display:block}
  .scx-title b{display:block;font-size:15px}.scx-title span{font-size:12px;color:#8A8A8A}
  .scx-hb{margin-left:auto;display:flex;gap:6px}.scx-hb button{width:30px;height:30px;min-height:0;padding:0;border:0;border-radius:50%;background:#1A1A1A;color:#9A9A9A;display:grid;place-items:center;cursor:pointer}
  .scx-hb button:hover{color:#EDEDED}
  .scx-body{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:12px;scrollbar-width:thin}
  .scx-empty{color:#9A9A9A;font-size:13.5px;line-height:1.5}.scx-empty b{color:#EDEDED}
  .scx-sugg{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
  .scx-chip{font-size:12.5px;color:#E8B08F;background:#1A1512;border:0;border-radius:999px;padding:5px 11px;box-shadow:0 0 0 1px rgba(232,116,59,.25);cursor:pointer;min-height:0;text-align:left}
  .scx-chip:hover{background:#241a14}
  .scx-ctx{align-self:flex-start;font-size:11.5px;color:#9A9A9A;background:#1A1A1A;border-radius:999px;padding:4px 10px;box-shadow:0 0 0 1px rgba(255,255,255,.07);display:flex;gap:6px;align-items:center}
  .scx-ctx button{border:0;background:none;color:#7A7A7A;padding:0;min-height:0;cursor:pointer}
  .scx-q{align-self:flex-end;max-width:84%;background:#2A2018;color:#F4D9C6;border-radius:14px 14px 4px 14px;padding:9px 13px;font-size:14px;line-height:1.4;white-space:pre-wrap}
  .scx-a{display:flex;gap:10px;align-items:flex-start}.scx-a>.scx-av{width:26px;height:26px;margin-top:2px}
  .scx-card{flex:1;min-width:0;background:#161616;border-radius:14px;box-shadow:0 0 0 1px rgba(255,255,255,.07);padding:13px 14px;font-size:13.5px;line-height:1.45;color:#D6D6D6}
  .scx-card p{margin:0 0 7px}.scx-card ul,.scx-card ol{margin:0 0 7px;padding-left:18px}.scx-card li{margin:2px 0}.scx-card .scx-h{font-weight:600;color:#EDEDED;margin-top:6px}
  .scx-hl{display:flex;gap:9px;align-items:flex-start;font-size:15.5px;font-weight:600;line-height:1.35;color:#EDEDED}.scx-hl i{color:#E8743B;flex:none;margin-top:2px;font-style:normal}
  .scx-meta{font-size:12px;color:#8A8A8A;margin:4px 0 10px 24px}
  .scx-tiles{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 10px}
  .scx-tile{background:#1D1D1D;border-radius:10px;padding:6px 10px}.scx-tile span{font-size:11.5px;color:#8A8A8A;display:block}
  .scx-tile b{font:600 17px 'Geist Mono',monospace;color:#EDEDED}.scx-tile.scx-tg b{color:#3DDC97}.scx-tile.scx-tw b{color:#FFB020}
  .scx-kp{background:#1A1A1A;border-radius:10px;padding:8px 10px;margin:0 0 9px}
  .scx-pt{display:flex;gap:8px;font-size:13px;line-height:1.4;margin:5px 0}.scx-pt i{flex:none;margin-top:1px;font-style:normal}
  .scx-pt.scx-kgood i{color:#3DDC97}.scx-pt.scx-kwarn i{color:#FFB020}.scx-pt.scx-knext i{color:#E8743B}.scx-pt.scx-kinfo i{color:#8A8A8A}
  .scx-sec{margin:8px 0 4px}.scx-sec>b{display:flex;gap:7px;align-items:center;font-size:13.5px;color:#EDEDED;margin-bottom:3px}
  .scx-src{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
  .scx-src a,.scx-src span{font-size:11.5px;color:#BDBDBD;background:#1F1F1F;border-radius:999px;padding:3px 9px;display:inline-flex;gap:5px;align-items:center;text-decoration:none;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .scx-src a:hover{color:#EDEDED}.scx-src .scx-ok{color:#3DDC97}.scx-src .scx-uv{color:#FFB020}
  .scx-act{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;align-items:center}
  .scx-act button{border:0;border-radius:10px;padding:8px 14px;font:600 13px 'Geist',sans-serif;min-height:0;cursor:pointer}
  .scx-act .scx-ap{background:#E8743B;color:#0A0A0A}.scx-act .scx-no{background:#1F1F1F;color:#D6D6D6}.scx-act .scx-done{font-size:12.5px;color:#3DDC97}
  .scx-ref{color:#E8B08F;font-size:10px}
  .scx-fu{display:flex;flex-wrap:wrap;gap:6px;margin-left:36px}
  .scx-wait{display:flex;gap:5px;padding:10px 4px}.scx-wait i{width:7px;height:7px;border-radius:50%;background:#E8743B;animation:scxb 1s infinite ease-in-out}
  .scx-wait i:nth-child(2){animation-delay:.15s}.scx-wait i:nth-child(3){animation-delay:.3s}
  @keyframes scxb{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
  .scx-err{font-size:13px;color:#FFB020;background:#1F1A10;border-radius:10px;padding:9px 12px}
  .scx-in{margin:0 16px 16px;display:flex;align-items:flex-end;gap:8px;background:#171717;border-radius:12px;box-shadow:0 0 0 1px rgba(255,255,255,.09);padding:8px 8px 8px 12px}
  .scx-in textarea{flex:1;background:none;border:0;outline:0;resize:none;color:#EDEDED;font:13.5px/1.4 'Geist',sans-serif;max-height:120px;min-height:22px;padding:4px 0}
  .scx-in textarea::placeholder{color:#7A7A7A}
  .scx-send{flex:none;width:32px;height:32px;min-height:0;padding:0;border:0;border-radius:50%;background:#E8743B;color:#0A0A0A;display:grid;place-items:center;cursor:pointer}
  .scx-send:disabled{opacity:.4;cursor:default}
  @media(max-width:620px){.scx-panel{top:0;right:0;bottom:0;width:100vw;max-width:100vw;border-radius:0}.scx-btn{right:14px;bottom:14px}}`;

  const SUGGEST = ["Who should I transfer out this week?", "Who should I captain?", "Which injured players should I worry about?", "Is it worth taking a −4?"];

  function about() {
    try {
      const labels = typeof TAB_LABEL !== "undefined" ? TAB_LABEL : {};
      const page = labels[S.tab] || ({ squad: "Planner", signals: "Signals", table: "Player Data", fixtures: "Teams", tracker: "League", chips: "Chips", news: "News", xfpl: "Status" }[S.tab]) || "FPL Signals";
      const card = S.cardId && S.model ? S.model.players.find(p => p.id === S.cardId) : null;
      return { page, card: st.about || (card ? { id: "player-" + card.id, title: card.web_name } : null) };
    } catch (e) { return { page: "FPL Signals", card: null }; }
  }
  function plan() {
    try { const raw = localStorage.getItem("fpl3:state"); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  function tileHTML(t) { return `<div class="scx-tile ${t.tone === "good" ? "scx-tg" : t.tone === "warn" ? "scx-tw" : ""}"><span>${esc(t.label)}</span><b>${esc(t.value)}</b></div>`; }
  function ptHTML(p) { return `<div class="scx-pt scx-k${p.kind}"><i>${L(KIND_ICON[p.kind] || "info", 15)}</i><span>${md(p.text).replace(/^<p>|<\/p>$/g, "")}</span></div>`; }
  function answerHTML(t, i) {
    let h = "";
    if (t.headline) h += `<div class="scx-hl"><i>${pi(t.icon || "sparkles")}</i><span>${esc(t.headline)}</span></div>${t.meta ? `<div class="scx-meta">${esc(t.meta)}</div>` : ""}`;
    if ((t.tiles || []).length) h += `<div class="scx-tiles">${t.tiles.map(tileHTML).join("")}</div>`;
    if ((t.key_points || []).length) h += `<div class="scx-kp">${t.key_points.map(ptHTML).join("")}</div>`;
    if (t.text && !(t.points || []).length && !(t.sections || []).length) h += md(t.text);
    h += (t.points || []).map(ptHTML).join("");
    h += (t.sections || []).map(s => `<div class="scx-sec"><b>${pi(s.icon || "info")}${esc(s.title)}</b>${md(s.text)}</div>`).join("");
    if (t.recommendation) h += `<div class="scx-pt scx-knext"><i>${L("arrow-right", 15)}</i><span><b>${esc(t.recommendation.text)}</b></span></div>`;
    const src = [];
    (t.from || []).forEach(f => src.push(f.link ? `<a href="${esc(f.link)}" data-in="1">${L("gauge", 12)}${esc(f.label)}</a>` : `<span>${L("gauge", 12)}${esc(f.label)}</span>`));
    (t.sources || []).forEach(s => src.push(s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">[${s.n}] ${esc(s.title)}</a>` : `<span>[${s.n}] ${esc(s.title)}</span>`));
    const uv = (t.unverified || []).length;
    if (uv) src.push(`<span class="scx-uv">${L("triangle-alert", 12)}${uv} figure${uv === 1 ? "" : "s"} not checked</span>`);
    else if ((t.from || []).length) src.push(`<span class="scx-ok">${L("check", 12)}All figures checked</span>`);
    if (src.length) h += `<div class="scx-src">${src.join("")}</div>`;
    (t.actions || []).forEach((a, j) => {
      const key = (t.turn_id || i) + ":" + j;
      h += `<div class="scx-act">${st.applied[key] ? `<span class="scx-done">${L("check", 13)} Applied to your plan: ${esc(a.label)}</span>`
        : `<button class="scx-ap" data-apply="${esc(key)}" data-i="${i}" data-j="${j}">Apply to my plan</button><span style="font-size:12px;color:#8A8A8A">${esc(a.label)}</span>`}</div>`;
    });
    return h || md(t.text || "");
  }
  function bodyHTML() {
    let h = "";
    if (!st.turns.length && !st.busy) {
      h += `<div class="scx-empty"><b>Ask The Scout about your team.</b> Transfers, captaincy, chips, fixtures, prices, rivals, injuries and return dates. Every figure comes from FPL Signals' own model; news comes with its source and date.
        <div class="scx-sugg">${SUGGEST.map(q => `<button class="scx-chip" data-ask="${esc(q)}">${esc(q)}</button>`).join("")}</div></div>`;
    }
    st.turns.forEach((t, i) => {
      if (t.role === "user") { h += `<div class="scx-q">${esc(t.text)}</div>`; return; }
      h += `<div class="scx-a"><span class="scx-av">${ICON.avatar || ""}</span><div class="scx-card">${t.error ? `<div class="scx-err">${esc(t.error)}</div>` : answerHTML(t, i)}</div></div>`;
      if (i === st.turns.length - 1 && (t.follow_ups || []).length && !st.busy) h += `<div class="scx-fu">${t.follow_ups.map(q => `<button class="scx-chip" data-ask="${esc(q)}">${esc(q)}</button>`).join("")}</div>`;
    });
    if (st.busy) h += `<div class="scx-a"><span class="scx-av">${ICON.avatar || ""}</span><div class="scx-wait"><i></i><i></i><i></i></div></div>`;
    return h;
  }
  function draw() {
    let btn = document.getElementById("scx-btn"), panel = document.getElementById("scx-panel");
    if (!btn) {
      const s = document.createElement("style"); s.id = "scx-css"; s.textContent = CSS; document.head.appendChild(s);
      btn = document.createElement("button"); btn.id = "scx-btn"; btn.className = "scx-btn"; btn.setAttribute("aria-label", "Ask The Scout");
      btn.addEventListener("click", () => toggle(true)); document.body.appendChild(btn);
    }
    btn.innerHTML = st.busy ? (ICON.thinking || ICON.launcher || "") : `<span class="scx-h0">${ICON.launcher || ""}</span><span class="scx-h1">${ICON.hover || ICON.launcher || ""}</span>`;
    btn.style.display = st.open ? "none" : "";
    if (!st.open) { if (panel) panel.remove(); return; }
    const a = about(), g = S.model ? S.model.next.id : "";
    const keepDraft = panel ? (panel.querySelector("textarea") || {}).value || "" : "";
    if (!panel) { panel = document.createElement("div"); panel.id = "scx-panel"; panel.className = "scx-panel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "The Scout"); document.body.appendChild(panel); wire(panel); }
    panel.innerHTML = `<div class="scx-head"><span class="scx-av">${ICON.avatar || ""}</span><div class="scx-title"><b>The Scout</b><span>FPL Signals assistant${g ? " · GW" + g : ""}</span></div>
      <div class="scx-hb"><button data-new="1" title="New conversation" aria-label="New conversation">${L("refresh-cw", 14)}</button><button data-close="1" title="Close" aria-label="Close">${L("x", 15)}</button></div></div>
      <div class="scx-body">${a.card ? `<span class="scx-ctx">About: ${esc(a.page)} · ${esc(a.card.title)}<button data-unabout="1" aria-label="Clear">${L("x", 11)}</button></span>` : ""}${bodyHTML()}
      ${st.connected === false ? `<div class="scx-err">The Scout is not connected yet: the tokens between FPL Signals and Jeevs still need setting.</div>` : ""}</div>
      <div class="scx-in"><textarea rows="1" placeholder="Ask The Scout about players, transfers, fixtures…" aria-label="Your question">${esc(keepDraft)}</textarea>
        <button class="scx-send" data-send="1" aria-label="Send"${st.busy ? " disabled" : ""}>${L("arrow-right", 15)}</button></div>`;
    const body = panel.querySelector(".scx-body"); body.scrollTop = body.scrollHeight;
    const ta = panel.querySelector("textarea"); if (!st.busy) ta.focus();
  }
  function wire(panel) {
    panel.addEventListener("click", e => {
      const b = e.target.closest("button,a"); if (!b) return;
      if (b.dataset.close) toggle(false);
      else if (b.dataset.new) fresh();
      else if (b.dataset.unabout) { st.about = null; if (typeof S !== "undefined") S.cardId = null; draw(); }
      else if (b.dataset.send) send(panel.querySelector("textarea").value);
      else if (b.dataset.ask) send(b.dataset.ask);
      else if (b.dataset.apply) apply(b.dataset.apply, +b.dataset.i, +b.dataset.j);
      else if (b.dataset.in && b.getAttribute("href")) { e.preventDefault(); location.hash = b.getAttribute("href").replace(/^\/?#/, "#"); }
    });
    panel.addEventListener("keydown", e => {
      if (e.key === "Escape") toggle(false);
      if (e.key === "Enter" && !e.shiftKey && e.target.tagName === "TEXTAREA") { e.preventDefault(); send(e.target.value); }
    });
    panel.addEventListener("input", e => { if (e.target.tagName === "TEXTAREA") { e.target.style.height = "auto"; e.target.style.height = Math.min(120, e.target.scrollHeight) + "px"; } });
  }
  async function api(path, body) {
    const r = await fetch(path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", "X-Scout": "1" }, body: body ? JSON.stringify(body) : undefined });
    return r.json();
  }
  async function load() {
    if (st.loaded) return; st.loaded = true;
    try {
      const s = await api("/api/scout/status"); st.connected = !!(s && s.connected);
      if (st.connected) { const h = await api("/api/scout/history"); if (h && h.ok) { st.conv = h.conversation_id; st.turns = h.turns || []; } }
    } catch (e) { st.connected = null; }
    draw();
  }
  function toggle(open) { st.open = open; draw(); if (open) load(); }
  async function fresh() {
    st.turns = []; st.about = null; draw();
    try { const r = await api("/api/scout/new", {}); if (r && r.ok) st.conv = r.conversation_id || null; } catch (e) { /* the next ask starts one */ }
  }
  async function send(q) {
    q = String(q || "").trim(); if (!q || st.busy) return;
    const a = about();
    st.turns.push({ role: "user", text: q }); st.busy = true;
    const ta = document.querySelector("#scx-panel textarea"); if (ta) ta.value = "";
    draw();
    let reply;
    try {
      reply = await api("/api/scout/ask", { message: q, conversation_id: st.conv, plan: plan(),
        page: { path: location.pathname + location.hash, title: a.page, card: a.card } });
    } catch (e) { reply = { ok: false, error: "FPL Signals could not be reached." }; }
    st.busy = false;
    if (reply && reply.ok) { st.conv = reply.conversation_id || st.conv; st.turns.push(reply); }
    else st.turns.push({ role: "scout", error: (reply && reply.error) || "The Scout could not answer." });
    draw();
  }
  /* his OK: the app's own actions, exactly as if he pressed them on the Planner */
  function apply(key, i, j) {
    const act0 = (st.turns[i] && st.turns[i].actions || [])[j]; if (!act0 || typeof act !== "function") return;
    const done = [], failed = [];
    for (const c of act0.changes) {
      try {
        if (c.type === "transfer") { if (!(S.squad || []).includes(c.out_id) || (S.squad || []).includes(c.in_id)) { failed.push(c.label); continue; } act("doswap", c.out_id, c.in_id); if ((S.squad || []).includes(c.in_id)) done.push(c.label); else failed.push(c.label); }
        else if (c.type === "captain" || c.type === "vice") { act(c.type === "captain" ? "cap" : "vice", c.id); done.push(c.label); }
        else if (c.type === "chip") { const half = c.gw >= 20 ? "2" : "1"; act("setchip", c.chip + half, c.gw); done.push(c.label); }
      } catch (e) { failed.push(c.label); }
    }
    if (done.length) st.applied[key] = true;
    if (typeof saveState === "function") try { saveState(); } catch (e) { /* the app saves on its own render */ }
    if (failed.length && typeof toast === "function") toast("Not applied: " + failed.join(", ") + " (the plan has changed since)", { warn: true });
    draw();
  }
  /* "Ask about this": other parts of the page can open The Scout on a subject */
  window.askScout = function (title, id, question) { st.about = title ? { id: id || "", title } : null; toggle(true); if (question) send(question); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", draw); else draw();
})();
