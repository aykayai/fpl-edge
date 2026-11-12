/* The Scout's tools, inside the app's vm (12 Nov 2026).
   Loaded after the app scripts by scout-model.mjs, so every figure here is
   worked out by the app's own functions: the same numbers the page shows.
   Each tool returns the shape Ask Jeevs reads (interface v1, as Fintel's):
     {ok, from:{label,link}, as_of, inputs, figures, ...detail}
   A tool that cannot answer says why ({ok:false, error}), never a zero. */
var __scout = (function () {
  const POS = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };
  const POSIN = { gk: 1, gkp: 1, goalkeeper: 1, def: 2, defender: 2, mid: 3, midfielder: 3, fwd: 4, forward: 4, striker: 4 };
  const r1 = v => (v == null || !isFinite(v) ? null : Math.round(v * 10) / 10);
  const r2 = v => (v == null || !isFinite(v) ? null : Math.round(v * 100) / 100);
  const today = () => new Date().toISOString().slice(0, 10);
  const g0 = () => S.model.next.id;
  const H = h => ([1, 3, 5].includes(+h) ? +h : 1);
  const ok = (label, link, inputs, figures, detail) => Object.assign({ ok: true, from: { label, link }, as_of: today(), inputs, figures }, detail || {});
  const no = (error, inputs) => ({ ok: false, error, inputs, as_of: today() });
  const mine = () => new Set(S.squad || []);
  const byId = () => new Map(S.model.players.map(p => [p.id, p]));
  const live = p => (S.fplLive && S.fplLive.players && S.fplLive.players[p.id]) || {};

  /* a player from what he typed: exact short name, full name, surname, then a part of a name */
  function findPlayer(q) {
    if (q == null || q === "") return { error: "Which player?" };
    if (/^\d+$/.test(String(q))) { const p = S.model.players.find(x => x.id === +q); return p ? { p } : { error: "No player " + q }; }
    const n = norm(String(q));
    const P = S.model.players;
    const tiers = [
      p => norm(p.web_name) === n,
      p => norm((p.first || "") + (p.last || "")) === n,
      p => norm(p.last || "") === n,
      p => (p.last || "").split(/\s+/).some(w => norm(w) === n) || norm(p.web_name).endsWith(n),
      p => norm(p.web_name).includes(n) || norm((p.first || "") + " " + (p.last || "")).includes(n)
    ];
    for (const t of tiers) {
      const hits = P.filter(t);
      if (hits.length === 1) return { p: hits[0] };
      if (hits.length > 1) {
        const sorted = hits.slice().sort((a, b) => (b.owned || 0) - (a.owned || 0) || (b.xMins || 0) - (a.xMins || 0));
        if ((sorted[0].owned || 0) > 5 * ((sorted[1].owned || 0) + 0.1) && (sorted[0].xMins || 0) >= 45) return { p: sorted[0] };
        return { error: "More than one player matches " + JSON.stringify(q) + ": say which.", candidates: sorted.slice(0, 6).map(p => p.web_name + " (" + p.teamName + ", " + POS[p.pos] + ", £" + p.price.toFixed(1) + ")") };
      }
    }
    return { error: "No player matches " + JSON.stringify(q) + "." };
  }
  function findClub(q) {
    const n = norm(String(q || ""));
    const T = S.model.teams;
    const t = T.find(t => norm(t.short) === n) || T.find(t => norm(t.name) === n) || T.find(t => norm(t.name).includes(n)) ||
      T.find(t => n.length >= 3 && norm(t.name).startsWith(n.slice(0, 4)));
    return t || null;
  }
  const fixturesOf = (p, from, n) => {
    const out = [];
    for (let e = from; e < from + n && e <= 38; e++) {
      const q = p.gw[e] || {};
      if (q.blank || !(q.fixtures || []).length) { out.push({ gw: e, blank: true }); continue; }
      q.fixtures.forEach(f => out.push({ gw: e, opp: f.opp, home: !!f.home, difficulty: p.pos <= 2 ? (f.diffDef ?? f.diff) : (f.diffAtt ?? f.diff) }));
    }
    return out;
  };
  const ptsOver = (p, g, h) => r1(hPts(p, g, h));
  const sigList = (p, g, h) => { try { return signals(p, g, false, h).map(([k, t]) => ({ signal: k, detail: sigShort(k, t) })); } catch (e) { return []; } };
  const setPieces = p => { const L = live(p); return { penalties: L.pen || null, corners: L.cor || null, direct_free_kicks: L.dfk || null }; };
  const availability = p => {
    const L = live(p);
    return { status: p.status, chance_next_gw: Math.round((p.avail ?? 1) * 100), news: p.news || "",
      fpl_note_updated: L.na || null, expected_back: p.back === "unknown" ? "unknown" : (p.back || null),
      model_return_gw: p.avail > 0 ? null : (p.outUntil || null), expected_minutes: p.xMins };
  };
  const price = p => {
    const L = live(p), own = mine().has(p.id);
    return { price: p.price, sell_price: own ? r1(sellPrice(p)) : null, change_this_season: r1(p.seasonChange),
      predictor_progress_pct: L.pcp ?? null, predictor_next_nights: (L.pcProj || []).map(([o, pct, lk]) => ({ night: o, pct, likelihood: lk })),
      locked_until: L.pcLock || null };
  };
  const row = (p, g, h) => ({ name: p.web_name, id: p.id, club: p.teamName, pos: POS[p.pos], price: p.price,
    pts: ptsOver(p, g, h), pts_next_gw: r1(p.gw[g] && p.gw[g].pts), xmins: p.xMins, owned_pct: p.owned,
    mine: mine().has(p.id), chance_next_gw: Math.round((p.avail ?? 1) * 100) });

  function my_team(a) {
    const g = g0(), h = H(a.horizon);
    const sp = squadPlayers(); if (!sp.length) return no("No squad is loaded.", a);
    const xi = startingXI(), xs = new Set(xi.map(p => p.id));
    const players = sp.map(p => Object.assign(row(p, g, h), { in_xi: xs.has(p.id), captain: p.id === S.captain, vice: p.id === S.vice,
      sell_price: r1(sellPrice(p)), news: p.news || "" }));
    const chipsUsed = Object.entries(S.chips || {}).filter(([, w]) => w).map(([k, w]) => ({ chip: CHIP_NAME[chipKind(k)] + (k.endsWith("2") ? " (2nd half)" : ""), gw: w }));
    return ok("FPL Signals · Planner", "/#/planner", { horizon: h, gw: g },
      { predicted_pts: r1(weekPtsFor(g, h)), bank: r1(planBank()), free_transfers: freeTransfers(), squad_budget: r1(squadBudget()),
        overall_rank: S.entryRank || null, chip_this_gw: chipForWeek(g) ? CHIP_NAME[chipKind(chipForWeek(g))] : null },
      { players, chips_planned_or_used: chipsUsed, note: "Uses his draft plan from the Planner when the pop-up sent one." });
  }

  function player(a) {
    const f = findPlayer(a.name); if (!f.p) return no(f.error, a);
    const p = f.p, g = g0();
    let odds = null;
    try { const op = oddsPlayers(g)[p.id]; if (op) odds = { score: r2(op.goal), assist: r2(op.assist), goal_or_assist: r2(op.ret), card: r2(op.card) }; } catch (e) {}
    const L = live(p);
    return ok("FPL Signals · Player Data · " + p.web_name, "/#/player-data", { name: a.name, gw: g },
      { pts_next_gw: r1(p.gw[g] && p.gw[g].pts), pts_next_3: ptsOver(p, g, 3), pts_next_5: ptsOver(p, g, 5),
        price: p.price, owned_pct: p.owned, total_pts: p.total, form: p.form, ppg: p.ppg, xg_per90: r2(p.xg90), xa_per90: r2(p.xa90),
        expected_minutes: p.xMins, fpl_expected_pts: L.ep ?? null },
      { player: { name: p.web_name, full_name: (p.first || "") + " " + (p.last || ""), club: p.teamFull || p.teamName, pos: POS[p.pos], mine: mine().has(p.id) },
        availability: availability(p), price_detail: price(p), set_pieces: setPieces(p), signals: sigList(p, g, 1),
        fixtures: fixturesOf(p, g, 5), market_odds_next_gw: odds,
        per_gw: [0, 1, 2, 3, 4].map(k => ({ gw: g + k, pts: r1(p.gw[g + k] && p.gw[g + k].pts) })) });
  }

  function compare(a) {
    const names = Array.isArray(a.names) ? a.names.slice(0, 5) : [];
    if (names.length < 2) return no("Give two to five players.", a);
    const g = g0(), h = H(a.horizon), rows = [];
    for (const nm of names) { const f = findPlayer(nm); if (!f.p) return no(f.error, a); rows.push(f.p); }
    return ok("FPL Signals · Player Data · compare", "/#/player-data", { names, horizon: h },
      Object.fromEntries(rows.map(p => [p.web_name + "_pts", ptsOver(p, g, h)])),
      { players: rows.map(p => Object.assign(row(p, g, h), { xg_per90: r2(p.xg90), xa_per90: r2(p.xa90), form: p.form,
        fixtures: fixturesOf(p, g, h), availability: availability(p), price_detail: price(p), set_pieces: setPieces(p), signals: sigList(p, g, h) })) });
  }

  function search_players(a) {
    const g = g0(), h = H(a.horizon), lim = Math.max(1, Math.min(15, +a.limit || 10));
    const pos = a.position ? POSIN[String(a.position).toLowerCase()] : null;
    if (a.position && !pos) return no("Position is GK, DEF, MID or FWD.", a);
    let club = null; if (a.club) { club = findClub(a.club); if (!club) return no("No club matches " + a.club + ".", a); }
    const m = mine();
    let pool = S.model.players.filter(p => p.gw[g] && (!pos || p.pos === pos) && (!club || p.team === club.id) &&
      (a.max_price == null || p.price <= +a.max_price + 1e-9) && (a.min_price == null || p.price >= +a.min_price - 1e-9) &&
      (!a.exclude_mine || !m.has(p.id)) && (a.include_unavailable || p.avail > 0));
    const sort = a.sort || "points";
    const key = sort === "value" ? p => hPts(p, g, h) / Math.max(3.8, p.price) : sort === "ownership" ? p => p.owned :
      sort === "form" ? p => +p.form || 0 : sort === "price" ? p => p.price : p => hPts(p, g, h);
    pool = pool.sort((x, y) => key(y) - key(x)).slice(0, lim);
    return ok("FPL Signals · Player Data", "/#/player-data", a, { results: pool.length },
      { players: pool.map(p => Object.assign(row(p, g, h), { value_pts_per_m: r2(hPts(p, g, h) / p.price), fixtures: fixturesOf(p, g, Math.min(h, 3)) })) });
  }

  function transfer_options(a) {
    const g = g0(), h = H(a.horizon), lim = Math.max(1, Math.min(10, +a.limit || 5));
    let outs = null;
    if (a.out) { const f = findPlayer(a.out); if (!f.p) return no(f.error, a); if (!mine().has(f.p.id)) return no(f.p.web_name + " is not in his squad.", a); outs = [f.p.id]; }
    const bank = planBank();
    const moves = engineMoves({ squad: S.squad, bank, g, h, outs: outs || undefined }).filter(m => m.gain > 0.05);
    const seen = new Set(), uniq = [];
    for (const m of moves) { const k = m.out.id + "-" + m.inn.id; if (seen.has(k)) continue; seen.add(k); uniq.push(m); if (uniq.length >= lim) break; }
    return ok("FPL Signals · Transfer engine", "/#/planner", { out: a.out || null, horizon: h },
      { bank: r1(bank), free_transfers: freeTransfers(), hit_cost_per_extra_transfer: 4, moves_found: uniq.length },
      { moves: uniq.map(m => ({ out: m.out.web_name, out_id: m.out.id, in: m.inn.web_name, in_id: m.inn.id, in_club: m.inn.teamName, in_price: m.inn.price,
          sell_price: r1(m.sell), gain_pts: r1(m.gain), bank_after: r1(bank + m.sell - m.inn.price),
          in_pts: ptsOver(m.inn, g, h), out_pts: ptsOver(m.out, g, h), in_fixtures: fixturesOf(m.inn, g, Math.min(h, 3)) })),
        method: "Gain is what the move adds to the best legal XI plus captain, week by week over the horizon (later weeks count a little less), the same engine the Planner uses." });
  }

  function evaluate_transfers(a) {
    const g = g0(), h = H(a.horizon), list = Array.isArray(a.moves) ? a.moves.slice(0, 5) : [];
    if (!list.length) return no("Give at least one move {out, in}.", a);
    const B = byId(); let squad = (S.squad || []).slice(), bank = planBank();
    const steps = [];
    for (const mv of list) {
      const fo = findPlayer(mv.out), fi = findPlayer(mv.in);
      if (!fo.p) return no(fo.error, a); if (!fi.p) return no(fi.error, a);
      if (!squad.includes(fo.p.id)) return no(fo.p.web_name + " is not in the squad at that point.", a);
      if (squad.includes(fi.p.id)) return no(fi.p.web_name + " is already in the squad.", a);
      if (fo.p.pos !== fi.p.pos) return no("A " + POS[fo.p.pos] + " can only be swapped for a " + POS[fo.p.pos] + ".", a);
      bank = bank + sellPrice(fo.p) - fi.p.price;
      squad = squad.map(i => (i === fo.p.id ? fi.p.id : i));
      steps.push({ out: fo.p.web_name, in: fi.p.web_name, bank_after: r1(bank) });
    }
    const clubs = {}; squad.forEach(i => { const p = B.get(i); if (p) clubs[p.teamName] = (clubs[p.teamName] || 0) + 1; });
    const over = Object.entries(clubs).filter(([, n]) => n > RULES.clubMax).map(([c]) => c);
    let gain = 0; const weeks = [];
    for (let k = 0; k < h && g + k <= 38; k++) { const d = xiTotal(squad, g + k, B) - xiTotal(S.squad, g + k, B); weeks.push({ gw: g + k, gain: r1(d) }); gain += Math.pow(DECAY, k) * d; }
    const ft = freeTransfers(), hits = Math.max(0, list.length - ft) * 4;
    return ok("FPL Signals · Transfer engine", "/#/planner", { moves: list, horizon: h },
      { gain_pts: r1(gain), hit_cost: hits, net_gain_pts: r1(gain - hits), bank_after: r1(bank), free_transfers: ft },
      { legal: bank >= -0.001 && !over.length, problems: [...(bank < -0.001 ? ["£" + (-bank).toFixed(1) + "m short"] : []), ...over.map(c => "more than 3 from " + c)],
        steps, per_gw: weeks });
  }

  function captain(a) {
    const g = a.gw ? +a.gw : g0();
    const xi = startingXI(); if (!xi.length) return no("No squad is loaded.", a);
    const nb = S.neighbours, rf = S.rivalsFeed || {}, caps = {}; let nr = 0;
    Object.entries(rf.entries || {}).forEach(([id, e]) => { if (id === TEAM_ID) return; const last = (e.gw || [])[(e.gw || []).length - 1];
      const c = last && (last.picks || []).find(x => x.isC); nr++; if (c) caps[c.id] = (caps[c.id] || 0) + 1; });
    const opts = xi.slice().sort((x, y) => (y.gw[g]?.pts || 0) - (x.gw[g]?.pts || 0)).slice(0, 6);
    return ok("FPL Signals · Planner · Captaincy", "/#/planner", { gw: g },
      { best_pts: r1(opts[0].gw[g]?.pts), current_captain_pts: r1(S.model.players.find(p => p.id === S.captain)?.gw[g]?.pts) },
      { options: opts.map(p => ({ name: p.web_name, club: p.teamName, pts: r1(p.gw[g]?.pts), captained_pts: r1((p.gw[g]?.pts || 0) * 2),
          chance_plays_pct: Math.round(((p.gw[g] && p.gw[g].pPlay) ?? p.avail ?? 1) * 100), owned_pct: p.owned,
          owned_by_rank_neighbours_pct: nb && nb.own && nb.n ? Math.round(100 * (nb.own[p.id] || 0) / nb.n) : null,
          rivals_captained_last_gw: caps[p.id] || 0, fixtures: fixturesOf(p, g, 1), current: p.id === S.captain })),
        rivals_counted: nr });
  }

  function chips(a) {
    const g = g0(), kinds = a.chip ? [String(a.chip).toLowerCase()] : ["wildcard", "freehit", "bboost", "3xc"];
    const name = { wildcard: "wildcard", "free hit": "freehit", freehit: "freehit", "bench boost": "bboost", bboost: "bboost", "triple captain": "3xc", "3xc": "3xc", tc: "3xc", bb: "bboost", fh: "freehit", wc: "wildcard" };
    const half = g >= 20 ? "2" : "1", out = [];
    for (const k0 of kinds) {
      const k = name[k0]; if (!k) return no("Chip is Wildcard, Free Hit, Bench Boost or Triple Captain.", a);
      const key = k + half, used = S.chips && S.chips[key];
      let best = [];
      try { best = chipPlan(key).map(w => ({ gw: w.e, value_pts: r1(w.up), total_pts: r1(w.tot), note: w.note })); } catch (e) {}
      out.push({ chip: CHIP_NAME[k], half: half === "1" ? "first half (to GW19)" : "second half (GW20-38)", played_or_planned_gw: used || null, best_weeks: best });
    }
    let fh = null, wc = null;
    try { const b = squadBudget(); const f = buildSquad("freehit", g, null, b); if (f) fh = { pick_pts: r1(f.total), your_pts: r1(myScore(g, 1, "freehit")), players: (f.xi || []).map(p => p.web_name) };
      const w = buildSquad("wildcard", g, null, b); if (w) wc = { pick_avg_pts_per_gw_next5: r1(w.total), your_avg_pts_per_gw_next5: r1(myScore(g, 5, "wildcard")), players: (w.xi || []).concat(w.bench || []).map(p => p.web_name) }; } catch (e) {}
    return ok("FPL Signals · Chips", "/#/chips", a, { gw: g }, { chips: out, free_hit_this_gw: fh, wildcard_from_this_gw: wc,
      method: "Free Hit and Wildcard picks come from the quick builder; the Chips page and Compare run the full solver, which can pick slightly better." });
  }

  function club(a) {
    const t = findClub(a.club); if (!t) return no("No club matches " + a.club + ".", a);
    const g = g0(), h = Math.max(1, Math.min(8, +a.horizon || 5)), cs = (S.curTeamStats || {})[t.short] || {};
    const runs = [];
    for (let e = g; e < g + h && e <= 38; e++) (S.model.byEv[e] || []).filter(f => f.ht === t || f.at === t).forEach(f => {
      const home = f.ht === t, o = home ? f.at : f.ht;
      runs.push({ gw: e, opp: o.short, home, attack_difficulty: fdrOf(o, home, t, "att"), defence_difficulty: fdrOf(o, home, t, "def"),
        model_goals_for: r2(fdrCalc(t, o, home, "xgf")), model_goals_against: r2(fdrCalc(t, o, home, "xgc")),
        clean_sheet_pct: Math.round(100 * Math.exp(-fdrCalc(t, o, home, "xgc"))) }); });
    let market = null;
    try { const f = oddsFixtures().find(x => x.goals && (x.ht === t || x.at === t)); if (f) { const home = f.ht === t;
      market = { opp: (home ? f.at : f.ht).short, goals_for: r2(home ? f.goals.xgHome : f.goals.xgAway), goals_against: r2(home ? f.goals.xgAway : f.goals.xgHome), clean_sheet_pct: Math.round(100 * (home ? f.goals.csHome : f.goals.csAway)) }; } } catch (e) {}
    const assets = S.model.players.filter(p => p.team === t.id && p.avail > 0).sort((x, y) => hPts(y, g, h) - hPts(x, g, h)).slice(0, 5)
      .map(p => ({ name: p.web_name, pos: POS[p.pos], price: p.price, pts: ptsOver(p, g, h), owned_pct: p.owned }));
    return ok("FPL Signals · Teams · " + t.name, "/#/teams", { club: a.club, horizon: h },
      { attack_rating_goals_per_game: r2(t.att), defence_rating_conceded_per_game: r2(t.def), season_xg_per_game: cs.n ? r2(cs.xg / cs.n) : null,
        season_xga_per_game: cs.n ? r2(cs.xga / cs.n) : null, season_goals_per_game: cs.n ? r2(cs.gf / cs.n) : null, season_conceded_per_game: cs.n ? r2(cs.ga / cs.n) : null,
        avg_attack_difficulty: r1(runs.reduce((s, x) => s + x.attack_difficulty, 0) / (runs.length || 1)),
        avg_defence_difficulty: r1(runs.reduce((s, x) => s + x.defence_difficulty, 0) / (runs.length || 1)) },
      { club: t.name, fixtures: runs, market_next_gw: market, best_players: assets,
        scale: "Difficulty 1 (easiest) to 5 (hardest); attack is for his attackers, defence for his keeper and defenders." });
  }

  function fixtures(a) {
    const g = a.gw ? +a.gw : g0();
    const list = (S.model.byEv[g] || []).map(f => ({ home: f.ht.short, away: f.at.short, kickoff: f.kickoff || null,
      model_home_goals: r2(fdrCalc(f.ht, f.at, true, "xgf")), model_away_goals: r2(fdrCalc(f.at, f.ht, false, "xgf")) }));
    if (!list.length) return no("No fixtures in GW" + g + ".", a);
    try { if (g === g0()) oddsFixtures().forEach(o => { const m = list.find(x => o.ht && o.at && x.home === o.ht.short && x.away === o.at.short);
      if (m && o.goals) Object.assign(m, { market_home_goals: r2(o.goals.xgHome), market_away_goals: r2(o.goals.xgAway), market_home_cs_pct: Math.round(100 * o.goals.csHome), market_away_cs_pct: Math.round(100 * o.goals.csAway) }); }); } catch (e) {}
    return ok("FPL Signals · Teams · GW" + g, "/#/teams", { gw: g }, { matches: list.length }, { fixtures: list });
  }

  function rivals(a) {
    const rf = S.rivalsFeed; if (!rf || !rf.standings) return no("The mini-league feed has not loaded.", a);
    const B = byId(), m = mine(), g = g0(), last = e => (e.gw || [])[(e.gw || []).length - 1] || {};
    const owners = {}, caps = {};
    const others = Object.entries(rf.entries || {}).filter(([id]) => id !== TEAM_ID);
    others.forEach(([, e]) => { const l = last(e); (l.picks || []).forEach(x => { owners[x.id] = (owners[x.id] || 0) + 1; if (x.isC) caps[x.id] = (caps[x.id] || 0) + 1; }); });
    const threats = Object.entries(owners).filter(([id]) => !m.has(+id)).map(([id, n]) => ({ p: B.get(+id), n })).filter(x => x.p)
      .sort((x, y) => y.n - x.n || hPts(y.p, g, 1) - hPts(x.p, g, 1)).slice(0, 8)
      .map(x => ({ name: x.p.web_name, club: x.p.teamName, rivals_owning: x.n, pts_next_gw: r1(x.p.gw[g]?.pts) }));
    const diffs = [...m].filter(id => !owners[id]).map(id => B.get(id)).filter(Boolean).map(p => ({ name: p.web_name, pts_next_gw: r1(p.gw[g]?.pts) }));
    const nb = S.neighbours;
    const nbThreats = nb && nb.own ? Object.entries(nb.own).filter(([id]) => !m.has(+id)).map(([id, n]) => ({ p: B.get(+id), n })).filter(x => x.p)
      .sort((x, y) => y.n - x.n).slice(0, 8).map(x => ({ name: x.p.web_name, owned_by_pct: Math.round(100 * x.n / nb.n), pts_next_gw: r1(x.p.gw[g]?.pts) })) : [];
    const me = rf.standings.find(s => String(s.entryId) === TEAM_ID);
    return ok("FPL Signals · League · " + (rf.leagueName || "mini-league"), "/#/league/rivals", a,
      { league_rank: me ? me.rank : null, league_points: me ? me.totalPoints : null, rivals: others.length,
        leader_points: rf.standings[0] ? rf.standings[0].totalPoints : null },
      { standings: rf.standings.slice(0, 10).map(s => ({ rank: s.rank, team: s.entryName, manager: s.manager, total: s.totalPoints, gw_points: s.gwPoints })),
        threats_owned_by_rivals_not_you: threats, your_differentials: diffs,
        rivals_captains_last_gw: Object.entries(caps).map(([id, n]) => ({ name: (B.get(+id) || {}).web_name, rivals: n })).sort((x, y) => y.rivals - x.rivals).slice(0, 5),
        rank_neighbours: nb ? { managers: nb.n, around_rank: nb.rank, as_of_gw: nb.gw, owned_by_them_not_you: nbThreats } : null });
  }

  function prices(a) {
    const L = S.fplLive && S.fplLive.players; if (!L) return no("FPL's price predictor has not loaded.", a);
    const B = byId(), m = mine();
    const rows = Object.entries(L).filter(([, x]) => x.pcp != null && !(x.pcLock && Date.parse(x.pcLock) > Date.now()))
      .map(([id, x]) => ({ p: B.get(+id), x })).filter(r => r.p);
    const pick = r => ({ name: r.p.web_name, club: r.p.teamName, price: r.p.price, progress_pct: Math.round(r.x.pcp), mine: m.has(r.p.id),
      next_nights: (r.x.pcProj || []).map(([o, pct]) => Math.round(pct)) });
    const rise = rows.filter(r => r.x.pcp > 0).sort((x, y) => y.x.pcp - x.x.pcp).slice(0, 8).map(pick);
    const fall = rows.filter(r => r.x.pcp < 0).sort((x, y) => x.x.pcp - y.x.pcp).slice(0, 8).map(pick);
    const yours = rows.filter(r => m.has(r.p.id) && Math.abs(r.x.pcp) >= 50).sort((x, y) => Math.abs(y.x.pcp) - Math.abs(x.x.pcp)).map(pick);
    return ok("FPL's price predictor", "/#/player-data", a, { rising_tonight: rows.filter(r => r.x.pcp >= 100).length, falling_tonight: rows.filter(r => r.x.pcp <= -100).length },
      { likely_risers: rise, likely_fallers: fall, your_players_moving: yours,
        rule: "100% or more means FPL expects the change at its next overnight price update; it is a guide, not a promise. Selling keeps only half of any rise." });
  }

  function model_check(a) {
    const acc = trueAccuracy(); if (!acc) return no("No graded weeks yet.", a);
    return ok("FPL Signals · Status · model accuracy", "/#/status", a,
      { player_weeks: acc.all.n, average_error_pts: r2(acc.all.mae), bias_pts: r2(acc.all.bias), live_weeks: acc.live },
      { by_week: acc.weeks.slice(-6).map(w => ({ gw: w.g, error: r2(w.mae), bias: r2(w.bias), source: w.src })),
        by_position: Object.fromEntries(Object.entries(acc.byPos).map(([k, v]) => [POS[k], { error: r2(v.mae), bias: r2(v.bias) }])),
        meaning: "Average error is how far a player's predicted points were from what he scored; bias above 0 means it predicted too high." });
  }

  /* availability part of the news tool; the server adds the injury log and the reports */
  function availability_of(a) {
    const f = findPlayer(a.name); if (!f.p) return no(f.error, a);
    const p = f.p;
    return ok("FPL injury note", "/#/player-data", { name: a.name }, { chance_next_gw: Math.round((p.avail ?? 1) * 100) },
      { player: { id: p.id, name: p.web_name, full_name: (p.first || "") + " " + (p.last || ""), club: p.teamFull || p.teamName, club_short: p.teamName, mine: mine().has(p.id) },
        availability: availability(p) });
  }

  /* proposed plan changes: checked here, made only when he presses Apply in the pop-up */
  function propose(a) {
    const list = Array.isArray(a.changes) ? a.changes.slice(0, 5) : [];
    if (!list.length) return no("No changes given.", a);
    const out = [];
    for (const c of list) {
      if (c.type === "transfer") { const fo = findPlayer(c.out), fi = findPlayer(c.in); if (!fo.p) return no(fo.error, a); if (!fi.p) return no(fi.error, a);
        if (!mine().has(fo.p.id)) return no(fo.p.web_name + " is not in his squad.", a);
        if (fo.p.pos !== fi.p.pos) return no("Positions must match.", a);
        out.push({ type: "transfer", out_id: fo.p.id, in_id: fi.p.id, label: fo.p.web_name + " → " + fi.p.web_name }); }
      else if (c.type === "captain" || c.type === "vice") { const f = findPlayer(c.player); if (!f.p) return no(f.error, a);
        if (!mine().has(f.p.id)) return no(f.p.web_name + " is not in his squad.", a);
        out.push({ type: c.type, id: f.p.id, label: (c.type === "captain" ? "Captain " : "Vice-captain ") + f.p.web_name }); }
      else if (c.type === "chip") { const k = { wildcard: "wildcard", "free hit": "freehit", freehit: "freehit", "bench boost": "bboost", bboost: "bboost", "triple captain": "3xc", "3xc": "3xc" }[String(c.chip || "").toLowerCase()];
        if (!k) return no("Chip is Wildcard, Free Hit, Bench Boost or Triple Captain.", a);
        const gw = +c.gw || g0(); out.push({ type: "chip", chip: k, gw, label: CHIP_NAME[k] + " in GW" + gw }); }
      else return no("A change is a transfer, captain, vice or chip.", a);
    }
    return ok("FPL Signals · Planner", "/#/planner", a, { changes: out.length },
      { action: { kind: "fpl_plan", changes: out, label: out.map(x => x.label).join(", ") },
        note: "Nothing is changed until he presses Apply in the pop-up; it changes his draft plan in FPL Signals only, never his FPL team." });
  }

  return { my_team, player, compare, search_players, transfer_options, evaluate_transfers, captain, chips, club, fixtures, rivals, prices, model_check, availability_of, propose };
})();
