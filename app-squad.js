/* FPL Signals - app-squad.js
   signals, squad handling, transfers, chips, news, dashboard

   Part of a single script split across files so each stays small enough to
   fetch whole. Loaded in order as classic scripts, sharing one global scope,
   so the order in index.html matters: app-main.js must come last. */
/* ---------- signals ---------- */
/* First name on each club's list is the recognised taker */
/* 26/27 duties: first penalty taker, first two on free kicks and corners.
   Players marked with an asterisk in the source (injury or transfer doubt) are
   skipped in favour of the next name. */
/* One badge shape throughout — an 18px disc with a coloured ring — so the set
   reads as a family; only the glyph and hue differ. */
/* Shields rather than discs, with a gloss highlight so they read as objects
   rather than flat labels. One silhouette throughout keeps the set coherent. */
let _bid=0;
/* keyed on the design itself: badges built during a render (e.g. a number
   that changes) reuse their symbol instead of adding a new one each time */
const _bKey=new Map();
function badge(glyph,fill,ring){
  const key=glyph+"|"+fill+"|"+ring;
  if(_bKey.has(key)&&_spriteDone.has("b"+_bKey.get(key)))
    return `<svg viewBox="0 0 26 28" class="bdg" aria-hidden="true"><use href="#b${_bKey.get(key)}"/></svg>`;
  const id=++_bid;_bKey.set(key,id);
  const full=badgeFull(id,glyph,fill,ring);
  /* Bundle 9: drawn once in the sprite, referenced everywhere after */
  const m=/<defs>([\s\S]*?)<\/defs>([\s\S]*)<\/svg>/.exec(full);
  spriteAdd("b"+id,m[1],`<symbol id="b${id}" viewBox="0 0 26 28">${m[2]}</symbol>`);
  return _spriteDone.has("b"+id)?`<svg viewBox="0 0 26 28" class="bdg" aria-hidden="true"><use href="#b${id}"/></svg>`:full;
}
function badgeFull(id,glyph,fill,ring){
  return `<svg viewBox="0 0 26 28" class="bdg" aria-hidden="true">
    <defs>
      <linearGradient id="sg${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${ring}"/><stop offset="0.55" stop-color="${fill}"/>
        <stop offset="1" stop-color="${fill}"/></linearGradient>
      <linearGradient id="gl${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".55"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    </defs>
    <path d="M13 1.4 24.2 5v10.4c0 6.4-4.6 9.9-11.2 11.9C6.4 25.3 1.8 21.8 1.8 15.4V5Z"
      fill="url(#sg${id})" stroke="${ring}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M13 2.9 22.7 6v4.4c-3 1.9-6.4 2.8-9.7 2.8s-6.7-.9-9.7-2.8V6Z" fill="url(#gl${id})"/>
    ${glyph}</svg>`;
}
const G=(t,size)=>`<text x="13" y="${size>=11?18.6:18.1}" font-family="Inter,Segoe UI,Arial,sans-serif"
  font-size="${size}" font-weight="900" fill="#0A0D12" text-anchor="middle" letter-spacing="-0.4"
  paint-order="stroke" stroke="rgba(255,255,255,.35)" stroke-width="0.6">${t}</text>`;
/* Attack — a football */
const ICON_ATT=badge(`<circle cx="13" cy="15" r="6.1" fill="#FFFDF6" stroke="#8A5A12" stroke-width="1"/>
  <path d="M13 11.1 15.9 13.2 14.8 16.6H11.2L10.1 13.2Z" fill="#20160A"/>
  <path d="M13 8.9v2.2M9.3 13.4 7.2 12.6M16.7 13.4l2.1-.8M11.2 16.6l-1.3 2M14.8 16.6l1.3 2"
    stroke="#20160A" stroke-width="1.15" stroke-linecap="round"/>`,"#FFB020","#FFDFA6");
/* Defence — shield with a tick, inside the shield silhouette */
const ICON_DEF=badge(`<path d="M13 8.6 18 10.3v3.9c0 2.7-1.9 4.4-5 5.4-3.1-1-5-2.7-5-5.4v-3.9Z" fill="#06222B"/>
  <path d="M10.8 14.4l1.6 1.7 3-3.3" stroke="#9FF2FF" stroke-width="1.7" fill="none"
    stroke-linecap="round" stroke-linejoin="round"/>`,"#22C3E6","#8FEAFB");
const SPCOL={P:["#FF4D6D","#FFD1DA"],F:["#34D399","#C6F7E4"],C:["#C084FC","#E9D8FF"]};
const SETPIECE={
 ARS:{P:["Saka"],            F:["Saka","Rice"],            C:["Rice","Saka"]},
 AVL:{P:["Buendía"],         F:["Buendía","McGinn"],       C:["Cash","McGinn"]},
 BOU:{P:["Kluivert"],        F:["Tavernier","Scott"],      C:["Tavernier","Scott"]},
 BRE:{P:["Thiago"],          F:["Lewis-Potter","Jensen"],  C:["Jensen","Damsgaard"]},
 BHA:{P:["Groß"],            F:["Groß","De Cuyper"],       C:["Groß","De Cuyper"]},
 CHE:{P:["Palmer"],          F:["James","Neto"],           C:["James","Neto"]},
 COV:{P:["Awoniyi"],         F:["Grimes","Rudoni"],        C:["Grimes","Torp"]},
 CRY:{P:["Mateta"],          F:["Pino","Wharton"],         C:["Wharton","Pino"]},
 EVE:{P:["Ndiaye"],          F:["Dewsbury-Hall"],          C:["Dewsbury-Hall"]},
 FUL:{P:["García"],          F:["Iwobi"],                  C:["Iwobi","Bobb"]},
 HUL:{P:["McBurnie"],        F:["Giles","Belloumi"],       C:["Giles","Belloumi"]},
 IPS:{P:["Hirst"],           F:["Núñez","Davis"],          C:["Núñez","Davis"]},
 LEE:{P:["Calvert-Lewin"],   F:["Stach","Wilson"],         C:["Stach","Wilson"]},
 LIV:{P:["Isak"],            F:["Szoboszlai","Wirtz"],     C:["Szoboszlai","Wirtz"]},
 MCI:{P:["Haaland"],         F:["Cherki","Foden"],         C:["Cherki","Foden"]},
 MUN:{P:["Fernandes"],       F:["Fernandes","Mbeumo"],     C:["Fernandes","Mbeumo"]},
 NEW:{P:["Woltemade"],       F:["Hall","Schär"],           C:["Hall","Elanga"]},
 NFO:{P:["Gibbs-White"],     F:["Gibbs-White","Murillo"],  C:["N.Williams","Hutchinson"]},
 SUN:{P:["Le Fée"],          F:["Xhaka","Le Fée"],         C:["Xhaka","Le Fée"]},
 TOT:{P:["Richarlison"],     F:["Porro","Tonali"],         C:["Porro","Tonali"]}
};
/* SETPIECE above still feeds the model's penalty and set-piece points
   (app-core.js); changing it moves projections, so it waits for Andy. The
   icons below read FPL's live orders instead. */
/* ---------- signal icons (redesign wave 1, 19 Oct 2026) ----------
   Andy's set, in this order, as Lucide line icons in round tinted tiles
   (Fintel's .tile: background = tone at 22% over #171717). One rule each;
   the rule is the tile's hover text. Hot streak, Attack, Defence, DefCon,
   Nailed and Stats caution were dropped; Luck was tested and replaced by
   Heating Up / Cooling Off (research/predictors/momentum.py). */
const SIGNAL={
  buy:["circle-arrow-up","#3DDC97","Buy"],
  sell:["circle-arrow-down","#FF5A6E","Sell"],
  rise:["trending-up","#4ADE80","Price Rise"],
  fall:["trending-down","#FF5A6E","Price Fall"],
  mins:["clock-alert","#FFB020","Minutes Risk"],
  heat:["flame","#4ADE80","Heating Up"],
  cool:["snowflake","#FF5A6E","Cooling Off"],
  rival:["swords","#B388FF","Rival Threat"],
  diff:["gem","#BAE6FD","Differential"],
  pen:["circle-dot","NAVY","Penalty"],
  set:["flag-triangle-right","#22D3EE","Set Piece"]};
const SIG_ORDER=Object.keys(SIGNAL);
const SIG_RULE={
  buy:h=>"In the top picks for his position over "+(h>1?"the next "+h+" gameweeks":"this gameweek")+", with 60+ expected minutes",
  sell:h=>"One of yours whose best replacement gains 2+ pts over "+(h>1?"the next "+h+" gameweeks":"this gameweek"),
  rise:()=>"FPL's predictor: 100%+ progress to a rise tonight",
  fall:()=>"FPL's predictor: 100%+ progress to a fall tonight",
  mins:()=>"Doubt, out, or under 60 expected minutes",
  heat:()=>"Chances rising: last-4 xGI/90 at least 1.5x his season rate (and +0.15)",
  cool:()=>"Chances falling: last-4 xGI/90 at most 0.6x his season rate (and -0.15)",
  rival:()=>"Owned by managers around you, not by you",
  diff:()=>"Under 8% owned and predicted 3.5+ pts",
  pen:()=>"First-choice penalty taker",
  set:()=>"First choice on corners or free kicks"};
function sigTile(k,tip){
  const[ic,tone,label]=SIGNAL[k];
  return `<span class="tile${tone==="NAVY"?" navy":""}"${tone==="NAVY"?"":` style="--tc:${tone}"`} title="${esc(tip||label)}" data-sig="${k}">${lic(ic)}</span>`;
}
/* FPL's own live fields (server /api/fpl-players): price predictor and
   set-piece orders. Missing on the Pages backup, where the dataset's
   penalty order stands in and set pieces are not shown. */
function fplLive(p){return (S.fplLive&&S.fplLive.players&&S.fplLive.players[p.id])||null;}
/* Penalties: FPL's order, except where this season's kicks and a published
   source agree on someone else (research/setpieces.md, 19 Oct 2026). */
const PEN_OVERRIDE={COV:"Torp",NEW:"Wissa",SUN:"Le Fée"};
function setPieces(p){
  const L=fplLive(p),club=(p.teamName||"").toUpperCase();
  let pen;
  if(PEN_OVERRIDE[club]){const t=norm(PEN_OVERRIDE[club]),me=norm(p.web_name);pen=!!t&&(me===t||me.includes(t)||t.includes(me));}
  else pen=L?L.pen===1:p.penOrder===1;
  return{pen,cor:L?L.cor:null,dfk:L?L.dfk:null};
}
const ORD=n=>n===1?"1st":n===2?"2nd":n===3?"3rd":n+"th";
/* Buy: the top of each position over the horizon, regular starters only */
const BUY_N={1:3,2:6,3:6,4:4};
let _buyCache=null;
function buySet(g,h){
  const k=g+"|"+h;
  if(_buyCache&&_buyCache.k===k&&_buyCache.m===S.model)return _buyCache.set;
  const set=new Set();
  [1,2,3,4].forEach(pos=>S.model.players
    .filter(p=>p.pos===pos&&p.avail>0&&(p.xMins||0)>=60)
    .sort((a,b)=>hPts(b,g,h)-hPts(a,g,h)).slice(0,BUY_N[pos]).forEach(p=>set.add(p.id)));
  _buyCache={k,m:S.model,set};return set;
}
/* Sell: first version reads Head Scout (bestSwaps); wave 4 brings one engine */
let _sellBusy=false;
function sellMap(){
  if(_sellBusy)return new Map();
  _sellBusy=true;
  try{const m=new Map();bestSwaps(60).forEach(x=>{if(x.gain>=2&&!m.has(x.out.id))m.set(x.out.id,x);});return m;}
  finally{_sellBusy=false;}
}
/* Momentum: this season's matches only, raw per-90s, as in the study */
const _momCache=new Map();
function momentum(p){
  if(p.pos<3)return null;
  if(_momCache.has(p.code)&&_momCache.get(p.code).h===S.hist)return _momCache.get(p.code).v;
  const rows=((S.hist&&S.hist[p.code])||[]).filter(r=>r.tag==="now"&&r.mins>0);
  const per=rs=>{const m=rs.reduce((a,r)=>a+r.mins,0);return m>0?rs.reduce((a,r)=>a+(r.xg||0)+(r.xa||0),0)*90/m:null;};
  let v=null;
  const l4=rows.slice(-4);
  if(rows.length>=6&&rows.reduce((a,r)=>a+r.mins,0)>=450&&l4.reduce((a,r)=>a+r.mins,0)>=180){
    const sea=per(rows),last=per(l4);
    v={sea,last,heat:last>=1.5*sea&&last-sea>=0.15,cool:last<=0.6*sea&&sea-last>=0.15};}
  _momCache.set(p.code,{h:S.hist,v});return v;
}
/* Rival Threat: how many of the mini-league rivals own each player */
let _rivCache=null;
function rivalOwn(){
  const f=S.rivalsFeed;if(!f||!f.entries)return null;
  if(_rivCache&&_rivCache.f===f)return _rivCache;
  const own={};let n=0;
  Object.keys(f.entries).filter(k=>String(k)!==String(TEAM_ID)).forEach(k=>{
    const a=(f.entries[k]&&f.entries[k].gw)||[],r=a[a.length-1];if(!r||!r.picks)return;n++;
    r.picks.forEach(pk=>{const id=pk.id??pk;own[id]=(own[id]||0)+1;});});
  return _rivCache={f,own,n};
}
/* signals(p,g) -> [[key, hover text]] in Andy's order. noSell skips Sell
   (Head Scout's own tie-break calls this while Sell is being worked out). */
function signals(p,g,noSell){
  const out=[],h=S.horizon||1,mine=(S.squad||[]).includes(p.id);
  if(!S.model)return out;
  if(buySet(g,h).has(p.id)&&!mine)out.push(["buy",SIG_RULE.buy(h)+`: ${hPts(p,g,h).toFixed(1)} pts`]);
  if(mine&&!noSell){const m=sellMap().get(p.id);
    if(m)out.push(["sell",SIG_RULE.sell(h)+`: ${m.inn.web_name} +${m.gain.toFixed(1)}`]);}
  const L=fplLive(p);
  if(L&&L.pcp!=null&&!(L.pcLock&&Date.parse(L.pcLock)>Date.now())){
    if(L.pcp>=100)out.push(["rise",`FPL's predictor: ${Math.round(L.pcp)}% progress to a rise tonight`]);
    else if(L.pcp<=-100)out.push(["fall",`FPL's predictor: ${Math.round(-L.pcp)}% progress to a fall tonight`]);}
  if(p.status!=="u"&&((p.avail<1&&(mine||(p.roleMins||0)>=60))||((p.roleMins||0)>=60&&(p.xMins||0)<60)))
    out.push(["mins",p.avail<1?`${p.avail>0?Math.round(p.avail*100)+"% chance":"Out"}${p.news?" · "+p.news:""}`:`${Math.round(p.xMins||0)} expected minutes`]);
  const mo=momentum(p);
  if(mo&&mo.heat)out.push(["heat",`Heating Up: last-4 xGI/90 ${mo.last.toFixed(2)} vs season ${mo.sea.toFixed(2)}`]);
  if(mo&&mo.cool)out.push(["cool",`Cooling Off: last-4 xGI/90 ${mo.last.toFixed(2)} vs season ${mo.sea.toFixed(2)}`]);
  const R=rivalOwn();
  if(R&&R.n&&!mine){const k=R.own[p.id]||0;
    if(k>=Math.max(2,Math.ceil(R.n*0.3)))out.push(["rival",`Owned by ${k} of ${R.n} rivals, not you`]);}
  if(p.owned>0&&p.owned<8&&(p.gw[g]?.pts||0)>3.4)out.push(["diff",`${p.owned}% owned, predicted ${(p.gw[g]?.pts||0).toFixed(1)} pts`]);
  const sp=setPieces(p);
  if(sp.pen)out.push(["pen","First-choice penalty taker"]);
  if(sp.cor===1||sp.dfk===1)out.push(["set","Set pieces: "+[sp.cor&&sp.cor<=2?"Corners "+ORD(sp.cor):"",sp.dfk&&sp.dfk<=2?"Free kicks "+ORD(sp.dfk):""].filter(Boolean).join(" · ")]);
  return out;
}
function legendHTML(){
  const h=S.horizon||1;
  return `<div class="legend">${SIG_ORDER.map(k=>`<span class="lgi">${sigTile(k,SIG_RULE[k](h))}<span>${SIGNAL[k][2]}</span></span>`).join("")}</div>`;
}
const sigHTML=(p,g)=>{const s=signals(p,g);return s.length?`<span class="sigs">${s.map(([k,t])=>sigTile(k,t)).join("")}</span>`:"";};
/* the set-piece line on the player card */
function setPieceText(p){
  const sp=setPieces(p),bits=[];
  if(sp.pen)bits.push("Penalties 1st");
  if(sp.cor&&sp.cor<=3)bits.push("Corners "+ORD(sp.cor));
  if(sp.dfk&&sp.dfk<=3)bits.push("Free kicks "+ORD(sp.dfk));
  return bits.join(" · ");
}
/* Clubs whose next five contain at least four kind fixtures on that lens.
   Cached per gameweek — signals() runs for every player on every render. */
let _tcCache=null;
function targetClubs(){
  const g=VG();
  if(_tcCache&&_tcCache.g===g&&_tcCache.n===(S.model?S.model.teams.length:0))return _tcCache;
  const att=new Set(),def=new Set();
  (S.model?S.model.teams:[]).forEach(t=>{
    let ga=0,gd=0,n=0;
    for(let e=g;e<g+5&&e<=38;e++)(S.model.byEv[e]||[]).filter(f=>f.ht===t||f.at===t).forEach(f=>{
      const home=f.ht===t,o=home?f.at:f.ht;
      if(fdrOf(o,home,t,"att")<=2)ga++;
      if(fdrOf(o,home,t,"def")<=2)gd++;
      n++;});
    if(n>=4&&ga>=4&&(t.att||0)>=1.30)att.add(t.id);
    if(n>=4&&gd>=4&&(2.6-(t.def||1.4))>=1.12)def.add(t.id);
  });
  return _tcCache={g,n:(S.model?S.model.teams.length:0),att,def};
}
/* ---------- squad ---------- */
function saveState(){LS.set("state",{v:STATE_VERSION,squad:S.squad,original:S.original,captain:S.captain,
  vice:S.vice,chips:S.chips,bank:S.bank,ft:S.ft,ftLastGw:S.ftLastGw,forceXI:S.forceXI,benchOrder:S.benchOrder,replacedBy:S.replacedBy,
  planByGw:S.planByGw,baseGw:S.baseGw??null});}
/* The owner's official squad for the latest gameweek the feed has picks for.
   Returns null when the feed (or a complete, resolvable 15) isn't there, so
   callers fall back honestly rather than dressing the hard-coded seed up as
   official. */
function latestOfficialPicks(){
  if(!S.tracker||!Array.isArray(S.tracker.gw)||!S.model)return null;
  const rows=S.tracker.gw.filter(r=>Array.isArray(r.picks)&&r.picks.length===15);
  if(!rows.length)return null;
  const last=rows.reduce((a,b)=>(b.event>a.event?b:a));
  const picks=last.picks.slice().sort((a,b)=>(a.pos||0)-(b.pos||0));
  if(picks.some(pk=>!S.model.players.find(p=>p.id===pk.id)))return null; // a pick the dataset can't name: don't half-seed
  return {event:last.event,picks};
}
/* Seed an empty planner from the LATEST official picks. Returns false when no
   history is published yet (old feed cached, or feed unreachable). */
function resolveOfficial(quiet){
  const off=latestOfficialPicks();
  if(!off)return false;
  const ids=off.picks.map(pk=>pk.id);
  S.squad=ids.slice();S.original=ids.slice();S.forceXI=null;
  const cap=off.picks.find(pk=>pk.isC)||off.picks.find(pk=>pk.multiplier>=2);
  const vice=off.picks.find(pk=>pk.isVC);
  S.captain=cap?cap.id:ids[0];
  S.vice=(vice&&vice.id!==S.captain)?vice.id:ids.find(i=>i!==S.captain);
  S.benchOrder=off.picks.slice(11).map(pk=>pk.id);
  const bf=(typeof bankFromFeed==="function")?bankFromFeed():null;
  if(bf!=null)S.bank=bf;
  else{const P=id=>S.model.players.find(p=>p.id===id);
    S.bank=+Math.max(0,100-ids.reduce((a,i)=>a+(P(i)?.price||0),0)).toFixed(1);}
  S.baseGw=off.event;
  saveState();
  if(!quiet)toast("Squad set to your official GW"+off.event+" line-up");
  return true;
}
/* Keep the planner on the real squad. The draft remembers which official
   gameweek it was built from (baseGw). When FPL publishes a newer official
   squad (after each deadline), or the draft predates this (the old GW1 seed),
   the planner moves onto the latest official squad. The draft it replaces is
   kept under its own key so nothing is lost, and the toast says so. */
function syncOfficialSquad(){
  if(typeof latestOfficialPicks!=="function")return false;
  const off=latestOfficialPicks();
  if(!off)return false;
  if(S.baseGw!=null&&off.event<=S.baseGw)return false;
  const had=!!(S.squad&&S.squad.length);
  if(had){try{LS.set("state_before_gw"+off.event,LS.get("state"));}catch(e){}}
  /* plans were drafted against the old squad, so they go with the old draft */
  S.planByGw={};S.replacedBy={};
  resolveOfficial(true);
  dedupeSquad();
  S.seedProvisional=false;
  if(had)toast("Planner now starts from your official GW"+off.event+" squad. Your earlier draft is saved.");
  return true;
}
/* Returns "official" when the squad came from the feed's official picks, or
   "seed" when only the hard-coded GW1 seed was available (the last resort,
   kept for a fresh install whose feed has no history yet). */
function resolveSeed(quiet){
  if(!S.model)return;
  if(resolveOfficial(quiet))return "official";
  const used=new Set(),ids=[],miss=[];
  SEED.forEach(([n,t,pos])=>{
    const target=norm(n);
    const c=S.model.players.filter(p=>{if(used.has(p.id))return false;
      const wn=norm(p.web_name),fu=norm(p.first+" "+p.last);
      return wn===target||wn.includes(target)||fu.includes(target);});
    if(!c.length){miss.push(n);return;}
    const both=c.find(p=>p.teamName.toUpperCase()===t&&p.pos===pos);
    const byPosTeam=both||c.find(p=>p.pos===pos&&p.teamName.toUpperCase()===t)
      ||c.find(p=>p.pos===pos)||c[0];
    used.add(byPosTeam.id);ids.push(byPosTeam.id);});
  S.squad=ids;S.original=ids;S.forceXI=null;
  const P=id=>S.model.players.find(p=>p.id===id);
  S.captain=ids.map(P).find(p=>norm(p.web_name).includes("haaland"))?.id||ids[0];
  S.vice=ids.map(P).find(p=>norm(p.web_name).includes("fernandes"))?.id||ids[1];
  S.bank=+Math.max(0,100-ids.reduce((a,i)=>a+(P(i)?.price||0),0)).toFixed(1);
  saveState();
  if(miss.length&&!quiet)toast("Couldn't match: "+miss.join(", "));
  return "seed";
}
/* Captain/multiplier for the currently-viewed historical gameweek, keyed by
   player id — set as a side effect of squadPlayers() so cardHTML can read who
   was actually captained without squadPlayers() needing to return copies of
   the player objects (several call sites compare these by reference, e.g.
   xi.includes(p), so a spread copy would silently break those checks). */
let _histCaptain=null,_histSquadActive=false,_gwLocked=false;
/* The rest of the official record for that week, set alongside _histCaptain:
   the vice, the XI/bench split and order straight from the picks' positions
   (auto subs already applied by the API), and each pick's multiplier so a
   Triple Captain week multiplies by what was actually played, not by the
   local chip plan. Null whenever the viewed week has no official picks. */
let _histVice=null,_histXI=null,_histBench=null,_histMult=null;
/* The squad shown depends on which gameweek is being viewed:
   - a finished GW: the officially-locked squad from the feed (immutable);
   - the current/future GW: the base squad (S.squad) with any local per-GW plan
     overrides that cascade forward — an edit made for GW10 carries into GW11+
     until GW11 is itself edited. Free Hit is isolated: its week's squad neither
     reads from nor writes to the surrounding weeks. */
function effectiveSquadIds(g){
  /* Resolves the squad for ANY gameweek — past, current, or future — by
     finding every recorded plan entry at or before g and applying them in
     order, latest wins. A Free Hit week is excluded from this search unless
     it IS g itself, so its one-off changes never carry into a later week
     (including once that later week itself becomes historical — this same
     function is now used for locked weeks too, not just future planning). */
  const plan=S.planByGw||{};
  const keys=Object.keys(plan).map(Number).filter(e=>e<=g)
    .filter(e=>e===g||chipForWeek(e)!=="freehit")
    .sort((a,b)=>a-b);
  let ids=((S.original&&S.original.length)?S.original:(S.squad||[])).slice();
  keys.forEach(e=>{const ov=plan[e];if(ov&&Array.isArray(ov.squad))ids=ov.squad.slice();});
  return {ids,fhWeek:chipForWeek(g)==="freehit"};
}
/* Same cascade as the squad itself — captain/vice need the same per-gameweek
   history, not the single current S.captain/S.vice. Missing this was why a
   past week always showed whoever the CURRENT captain is, rather than who was
   actually captain that week (e.g. GW1 happening to look right because it
   matches today's captain by coincidence, GW2 showing wrong because a captain
   change since then overwrote the only place it was stored). */
function effectiveCaptainVice(g){
  const plan=S.planByGw||{};
  const keys=Object.keys(plan).map(Number).filter(e=>e<=g)
    .filter(e=>e===g||chipForWeek(e)!=="freehit")
    .sort((a,b)=>a-b);
  let captain=null,vice=null;
  keys.forEach(e=>{const ov=plan[e];
    if(ov&&ov.captain!==undefined)captain=ov.captain;
    if(ov&&ov.vice!==undefined)vice=ov.vice;});
  if(captain==null)captain=S.captain;
  if(vice==null)vice=S.vice;
  return {captain,vice};
}
const squadPlayers=()=>{
  _histCaptain=null;_histSquadActive=false;_gwLocked=false;
  _histVice=null;_histXI=null;_histBench=null;_histMult=null;
  const g=VG();
  const next=S.model?S.model.next.id:1;
  /* Finished gameweek → the officially-locked squad, immutable. */
  if(S.model&&g<next){
    _gwLocked=true;
    if(S.tracker&&Array.isArray(S.tracker.gw)){
      const row=S.tracker.gw.find(r=>r.event===g);
      if(row&&Array.isArray(row.picks)&&row.picks.length){
        /* Position order from the API: 1-11 the XI as it finally counted
           (auto subs applied), 12-15 the bench. Old feeds have no pos field,
           in which case the array order (already positional) is kept. */
        const picks=row.picks.slice().sort((a,b)=>((a.pos||0)-(b.pos||0)));
        const list=[];const mult={};const xi=[];const bench=[];
        picks.forEach((pk,i)=>{const p=S.model.players.find(x=>x.id===pk.id);
          if(!p)return;
          list.push(p);mult[p.id]=pk.multiplier;
          const slot=pk.pos||i+1;
          (slot<=11?xi:bench).push(p.id);});
        /* The C badge goes on whoever actually carried the armband that week:
           the pick with a 2x/3x multiplier (how the API reports an auto
           vice-captain takeover), falling back to the picked captain. */
        const capPk=picks.find(pk=>pk.multiplier>=2)||picks.find(pk=>pk.isC);
        if(capPk&&list.some(p=>p.id===capPk.id))_histCaptain=capPk.id;
        const vicePk=picks.find(pk=>pk.isVC);
        if(vicePk&&list.some(p=>p.id===vicePk.id))_histVice=vicePk.id;
        if(list.length){
          _histSquadActive=true;_histMult=mult;
          if(xi.length===11)_histXI=xi;
          if(bench.length)_histBench=bench;
          return list;
        }
      }
    }
    /* Feed hasn't published that week's official picks yet — fall back to the
       LOCAL plan cascade (same logic used for a future week) rather than
       today's live squad. This is the fix: the previous fallback returned
       S.squad directly, which is today's squad and changes with every future
       transfer — meaning every historical week silently tracked whatever the
       user's squad happened to be *right now*, and Free Hit's isolation never
       even ran for a week once it became historical, since this fallback
       bypassed effectiveSquadIds() (where the FH-skip logic lives) entirely.
       The cascade correctly freezes each week to whatever was last written to
       planByGw at or before that week — which is exactly what real edits
       already write when made while a week is live — and still respects the
       FH-skip. */
  }
  const {ids}=effectiveSquadIds(g);
  return ids.map(id=>S.model.players.find(p=>p.id===id)).filter(Boolean);
};
function startingXI(){
  const sp=squadPlayers();if(!sp.length)return[];
  const g=VG();
  /* The official XI for a finished gameweek, straight from the picks'
     positions. This outranks any local snapshot, because it is the line-up
     that actually scored. */
  if(_histSquadActive&&Array.isArray(_histXI)&&_histXI.length===11){
    const xi=_histXI.map(id=>sp.find(p=>p.id===id)).filter(Boolean);
    if(xi.length===11)return xi;
  }
  /* A finished gameweek uses the line-up captured at the time. Without this
     the XI was re-derived from that week's predicted points, which are all
     zero once the week is past, so the formation reshuffled on every render. */
  if(S.model&&g<S.model.next.id){
    const snap=S.planByGw&&S.planByGw[g]&&S.planByGw[g].xi;
    if(Array.isArray(snap)&&snap.length===11){
      const xi=snap.map(i=>sp.find(p=>p.id===i)).filter(Boolean);
      if(xi.length===11)return xi;
    }
  }
  if(S.forceXI?.length===11){const xi=S.forceXI.map(i=>sp.find(p=>p.id===i)).filter(Boolean);
    if(xi.length===11)return xi;}
  return legalBestXI(sp,p=>p.gw[g]?.pts||0);
}
/* The best legal XI from a 15-man squad by any value: one keeper, at least
   three defenders and one forward, then the best six outfielders left. From
   a legal squad (2/5/5/3) that is the true best, since the upper limits of
   five defenders, five midfielders and three forwards cannot be broken.
   Shared by the header XI and the Chips page's "your XI" (F34), which used
   to take the top 11 by points with no formation check. */
function legalBestXI(sp,val){
  const by={};sp.forEach(p=>(by[p.pos]=by[p.pos]||[]).push(p));
  Object.values(by).forEach(a=>a.sort((x,y)=>val(y)-val(x)));
  const xi=[];if(by[1]?.[0])xi.push(by[1][0]);
  (by[2]||[]).slice(0,3).forEach(p=>xi.push(p));(by[4]||[]).slice(0,1).forEach(p=>xi.push(p));
  [...(by[2]||[]).slice(3),...(by[3]||[]),...(by[4]||[]).slice(1)]
    .sort((a,b)=>val(b)-val(a)).slice(0,11-xi.length).forEach(p=>xi.push(p));
  return xi;
}
function legalXI(ids){const ps=ids.map(i=>S.model.players.find(p=>p.id===i)).filter(Boolean);
  if(ps.length!==11)return false;const c=n=>ps.filter(p=>p.pos===n).length;
  return c(1)===1&&c(2)>=3&&c(4)>=1;}
function trySub(a,b){
  const xi=startingXI().map(p=>p.id);const aIn=xi.includes(a),bIn=xi.includes(b);
  if(!aIn&&!bIn){
    /* both are substitutes — swap their order rather than refusing, so the
       bench can be reordered with the same control used on the pitch */
    const bench=orderBench(squadPlayers().filter(p=>!xi.includes(p.id))).map(p=>p.id);
    const i1=bench.indexOf(a),i2=bench.indexOf(b);
    if(i1>=0&&i2>=0){[bench[i1],bench[i2]]=[bench[i2],bench[i1]];
      S.benchOrder=bench;saveState();toast("Bench order changed");}
    S.subFrom=null;return;}
  if(aIn===bIn){toast("Pick one from the pitch and one from the bench");S.subFrom=null;return;}
  const next=xi.map(i=>i===(aIn?a:b)?(aIn?b:a):i);
  if(!legalXI(next)){toast("That would break the formation");S.subFrom=null;return;}
  S.forceXI=next;S.subFrom=null;saveState();toast("Substitution made");
}
/* which chip, if any, is assigned to this gameweek */
function chipForWeek(w){
  const half=w>=20?"2":"1";
  for(const k of ["bboost","3xc","freehit","wildcard"])
    if(S.chips[k+half]===w)return k;
  return null;
}
/* ---------- F19: free transfers and hits for planned weeks ----------
   The rule is the one the feed builder verified against FPL's own charged
   hits (scripts/build-actuals.mjs): one free transfer is added each week up
   to 5; a Wildcard or Free Hit week is free and carries the bank forward
   unchanged; every transfer beyond the free ones costs 4 points. A Free Hit
   squad reverts afterwards, so the week after one is compared with the
   squad from before it. */
const FT_MAX=RULES.ftMax,HIT=RULES.hit;
function officialBaseIds(){
  const off=(typeof latestOfficialPicks==="function")?latestOfficialPicks():null;
  return off?off.picks.map(pk=>pk.id):((S.original||S.squad||[]).slice());
}
function squadBefore(g){
  const next=S.model?S.model.next.id:1;
  let e=g-1;
  while(e>=next&&chipForWeek(e)==="freehit")e--;
  return e<next?officialBaseIds():(((effectiveSquadIds(e)||{}).ids)||[]);
}
function transfersIn(g){
  if(!S.model||g<S.model.next.id)return 0;
  const cur=((effectiveSquadIds(g)||{}).ids)||[], prev=squadBefore(g);
  return cur.filter(i=>!prev.includes(i)).length;
}
function freeWeek(g){const c=chipForWeek(g);return c==="wildcard"||c==="freehit";}
/* free transfers available going into week g */
function planFT(g){
  const next=S.model?S.model.next.id:1;
  let ft=freeTransfers();
  for(let e=next;e<g;e++){if(freeWeek(e))continue;ft=Math.min(FT_MAX,Math.max(0,ft-transfersIn(e))+1);}
  return ft;
}
function hitCost(g){return freeWeek(g)?0:Math.max(0,transfersIn(g)-planFT(g))*HIT;}
function hitsOver(g,h){let s=0;for(let e=g;e<g+(h||1);e++)s+=hitCost(e);return s;}
/* free transfers still unused in week g (Infinity in a free-squad week) */
function freeLeft(g){return freeWeek(g)?Infinity:Math.max(0,planFT(g)-transfersIn(g));}
/* D16 (13 Oct 2026, FPL Review's defaults). A move's gain counts week k of
   the horizon at DECAY^k, because later weeks are less certain, and it must
   beat FT_VALUE, what rolling the free transfer is worth; a move that costs a
   hit must beat the hit as well. In a Free Hit or Wildcard week nothing is
   given up, so TRANSFER_MIN applies. */
const DECAY=0.85, FT_VALUE=1.75;
function dGain(inn,out,g,h){
  let s=0;
  for(let k=0;k<(h||1)&&g+k<=38;k++)s+=Math.pow(DECAY,k)*((inn.gw[g+k]?.pts||0)-(out.gw[g+k]?.pts||0));
  return s;
}
function moveBar(g){return freeWeek(g)?TRANSFER_MIN:freeLeft(g)>0?FT_VALUE:FT_VALUE+HIT;}
/* The squad's predicted total from week g over h weeks: XI, captain, chip,
   vice and bench cover, less hits. The header uses the planner's week and
   horizon; the xFPL comparison asks for any single week (F103: these were
   two copies of the same sum). */
function weekPtsFor(g,h){
  h=h||1;
  const xi=startingXI();if(!xi.length)return 0;
  let s=xi.reduce((a,p)=>a+hPts(p,g,h),0);
  const cap=S.model.players.find(p=>p.id===S.captain);
  if(cap&&xi.includes(cap))s+=hPts(cap,g,h);
  const bench=squadPlayers().filter(p=>!xi.includes(p));
  const chip=chipForWeek(g);
  if(chip==="bboost")s+=bench.reduce((a,p)=>a+hPts(p,g,h),0);
  if(chip==="3xc"&&cap)s+=hPts(cap,g,h);
  if(chip!=="bboost"){const ob=orderBench(bench),vice=S.model.players.find(p=>p.id===S.vice);
    for(let e=g;e<g+h&&e<=38;e++)s+=coverPts(xi,ob,cap&&xi.includes(cap)?cap:null,vice,e,chip==="3xc"?3:2);}
  return s-hitsOver(g,h);
}
function weekPts(){return weekPtsFor(VG(),S.horizon);}
/* ---------- transfer engine ---------- */
/* Stage 1 (19 Oct 2026, Andy): a move is worth what it adds to the best
   legal XI plus captain, week by week over the horizon (later weeks x DECAY),
   not player against player. Player against player, Head Scout suggested
   swapping a bench keeper who never plays for "+4.0". */
function xiTotal(ids,e,byId){
  const ps=ids.map(i=>byId.get(i)).filter(Boolean),v=p=>p.gw[e]?.pts||0;
  const xi=legalBestXI(ps,v);
  return xi.reduce((a,p)=>a+v(p),0)+(xi.length?Math.max(...xi.map(v)):0);
}
function xiGain(ids,outId,inId,g,h,byId,base){
  const ns=ids.map(i=>i===outId?inId:i);let s=0;
  for(let k=0;k<(h||1)&&g+k<=38;k++)
    s+=Math.pow(DECAY,k)*(xiTotal(ns,g+k,byId)-(base?base[k]:xiTotal(ids,g+k,byId)));
  return s;
}
let _bsCache={};
function bestSwaps(limit,hh){
  if(!S.model||!S.squad)return[];
  const g=VG(),h=hh||S.horizon||1,bank=planBank();
  const key=[g,h,bank,S.squad.join("."),(S.ignored||[]).join("."),S.model.players.length].join("|");
  const hit=_bsCache[key];
  if(hit&&hit.model===S.model)return hit.res.slice(0,limit||10);
  const byId=new Map(S.model.players.map(p=>[p.id,p]));
  const base=[];for(let k=0;k<h&&g+k<=38;k++)base.push(xiTotal(S.squad,g+k,byId));
  const out=[];
  S.squad.forEach(oid=>{
    const o=byId.get(oid);if(!o)return;
    const cc={};S.squad.filter(i=>i!==oid).forEach(i=>{
      const p=byId.get(i);if(p)cc[p.team]=(cc[p.team]||0)+1;});
    /* shortlist by player gain, then score the shortlist on the XI */
    const cands=[];
    S.model.players.forEach(p=>{
      if(p.pos!==o.pos||S.squad.includes(p.id)||p.avail<=0)return;
      if((S.ignored||[]).includes(p.id))return;
      if(p.price>bank+sellPrice(o)+.001)return;
      if((cc[p.team]||0)>=RULES.clubMax)return;
      cands.push({p,pg:dGain(p,o,g,h)});});
    cands.sort((a,b)=>b.pg-a.pg).slice(0,12).forEach(({p})=>{
      const gain=xiGain(S.squad,oid,p.id,g,h,byId,base);
      /* where gains are level, prefer the player carrying signals */
      const sig=signals(p,g,true).length;
      if(gain>0.05)out.push({out:o,inn:p,gain,sig});});});
  out.sort((a,b)=>(b.gain-a.gain)||(b.sig-a.sig));
  const seen=new Set(),uniq=[];
  out.forEach(m=>{const k=m.out.id+"-"+m.inn.id;if(seen.has(k))return;seen.add(k);uniq.push(m);});
  if(Object.keys(_bsCache).length>24)_bsCache={};
  _bsCache[key]={model:S.model,res:uniq};
  return uniq.slice(0,limit||10);
}
/* S3 (Stage 1, 19 Oct 2026): a five-week plan. Week by week, the best single
   move scored on the XI over the weeks left in the plan; made only if it
   beats the bar (a saved transfer's worth, plus a hit when no free transfer
   is left), otherwise the transfer is rolled. */
const _planCache={};
function planWeeks(H){
  if(!S.model||!S.squad)return null;
  H=H||5;
  const g0=S.model.next.id;
  const key=[g0,H,planBank(),freeTransfers(),S.squad.join("."),(S.ignored||[]).join(".")].join("|");
  if(_planCache.key===key&&_planCache.model===S.model)return _planCache.res;
  const byId=new Map(S.model.players.map(p=>[p.id,p]));
  let squad=S.squad.slice(),bank=planBank(),ft=freeTransfers(),total=0;
  const weeks=[];
  for(let k=0;k<H&&g0+k<=38;k++){
    const w=g0+k,rem=Math.min(H-k,39-w);
    const base=[];for(let j=0;j<rem;j++)base.push(xiTotal(squad,w+j,byId));
    let best=null;
    squad.forEach(oid=>{
      const o=byId.get(oid);if(!o)return;
      const club={};squad.filter(i=>i!==oid).forEach(i=>{const q=byId.get(i);if(q)club[q.team]=(club[q.team]||0)+1;});
      const sell=sellPrice(o);
      S.model.players.filter(p=>p.pos===o.pos&&!squad.includes(p.id)&&p.avail>0&&!(S.ignored||[]).includes(p.id)
          &&p.price<=bank+sell+1e-9&&(club[p.team]||0)<RULES.clubMax)
        .map(p=>({p,pg:dGain(p,o,w,rem)})).sort((a,b)=>b.pg-a.pg).slice(0,12)
        .forEach(({p})=>{const gain=xiGain(squad,oid,p.id,w,rem,byId,base);
          if(!best||gain>best.gain)best={o,p,gain,sell};});
    });
    const bar=ft>0?FT_VALUE:FT_VALUE+HIT;
    if(best&&best.gain>bar){
      const hit=ft>0?0:HIT;
      bank=+(bank+best.sell-best.p.price).toFixed(1);
      weeks.push({w,ft,out:best.o,inn:best.p,gain:best.gain,hit,bank});
      total+=best.gain-hit;
      squad=squad.map(i=>i===best.o.id?best.p.id:i);
      ft=Math.min(FT_MAX,Math.max(0,ft-1)+1);
    }else{
      weeks.push({w,ft,roll:true,best:best?{out:best.o,inn:best.p,gain:best.gain}:null,bar});
      ft=Math.min(FT_MAX,ft+1);
    }
  }
  const res={weeks,total,H};
  Object.assign(_planCache,{key,model:S.model,res});
  return res;
}
function bestCombo(outIds){
  if(!S.model||!outIds.length)return null;
  const g=S.model.next.id;
  const outs=outIds.map(i=>S.model.players.find(p=>p.id===i)).filter(Boolean);
  let budget=planBank()+outs.reduce((a,p)=>a+sellPrice(p),0);
  const keep=(S.squad||[]).filter(i=>!outIds.includes(i));
  const club={};keep.forEach(i=>{const p=S.model.players.find(x=>x.id===i);
    if(p)club[p.team]=(club[p.team]||0)+1;});
  const taken=new Set(keep);
  /* fill the most expensive slot first so the budget isn't eaten by cheap upgrades */
  const order=[...outs].sort((a,b)=>b.price-a.price);
  const picks=[];
  order.forEach(o=>{
    const minFor=pos=>{let m=99;S.model.players.forEach(q=>{
      if(q.pos===pos&&!taken.has(q.id)&&q.avail>0&&q.price<m)m=q.price;});return m===99?3.9:m;};
    const cheapestRest=order.filter(x=>x!==o&&!picks.find(pk=>pk.out===x))
      .reduce((a,x)=>a+minFor(x.pos),0);
    let best=null;
    S.model.players.forEach(p=>{
      /* F60: the players being sold are not candidates for their own slots */
      if(p.pos!==o.pos||taken.has(p.id)||outIds.includes(p.id)||p.avail<=0)return;
      if(p.price>budget-cheapestRest+.001)return;
      if((club[p.team]||0)>=3)return;
      const gain=dGain(p,o,g,S.horizon);
      if(!best||gain>best.gain)best={out:o,inn:p,gain};});
    /* F60: a move that gains nothing is not a move; that player stays */
    if(best&&best.gain>0.05){picks.push(best);taken.add(best.inn.id);
      club[best.inn.team]=(club[best.inn.team]||0)+1;budget-=best.inn.price;budget+=0;}
  });
  const spent=picks.reduce((a,m)=>a+m.inn.price,0);
  const freed=planBank()+outs.reduce((a,p)=>a+sellPrice(p),0);
  return{picks,gain:picks.reduce((a,m)=>a+m.gain,0),left:+(freed-spent).toFixed(1),freed:+freed.toFixed(1)};
}
/* Persist an edit to the viewed gameweek's plan. Snapshots the currently-effective
   squad into planByGw[g] so the edit applies to g and every later week (cascade),
   without disturbing earlier weeks. For the current gameweek it also updates the
   base squad, so "now" and the plan stay in step. */
function editableGw(){
  const g=VG(), next=S.model?S.model.next.id:1;
  if(g<next){toast("Gameweek "+g+" is locked — its deadline has passed");return null;}
  return g;
}
/* Snapshots each squad member's predicted points for the CURRENT live gameweek
   into planByGw[next].predByPlayer, refreshed on every load and every edit made
   during that week. The model only ever computes predictions forward from the
   live gameweek — once a week passes into history there is no way to ask it
   "what would you have predicted then", so the only way to have a real number
   later is to capture it *while* the week is still live. The very last snapshot
   taken before that week's deadline is exactly "the final predicted score
   saved before the deadline", which is what should persist. */
/* Local free-transfer tracking — the feed still doesn't publish ftAvailable
   (confirmed: 0 of the currently-published gameweek rows have it), and S.ft
   was previously never updated by anything at all, frozen at its starting
   value forever. This walks forward one gameweek at a time whenever the live
   gameweek has advanced since the last check, applying the same confirmed
   rule ftFromFeed() already uses: +1 per week capped at 5, Wildcard/Free Hit
   consume that week's transfer but leave the bank otherwise untouched (their
   squad change isn't counted as ordinary transfers), everything else counts
   the real difference between that week's resolved squad and the week
   before via the existing plan cascade. First-ever run sets a baseline at
   "now" rather than guessing backward through weeks that predate this
   feature — accurate from this point forward, honest about not being able
   to reconstruct what it can't know. */
function localFtTrack(){
  if(!S.model)return;
  const next=S.model.next.id;
  const lastGw=S.ftLastGw||0;
  if(lastGw===0){S.ftLastGw=next-1;return;}
  if(lastGw>=next-1)return;
  let ft=S.ft??1;
  for(let g=lastGw+1;g<next;g++){
    const kind=chipForWeek(g);
    if(kind==="wildcard"||kind==="freehit")continue;   // bank unchanged, that week's FT went on the chip
    const before=new Set(effectiveSquadIds(g-1).ids);
    const after=effectiveSquadIds(g).ids;
    const transfersMade=after.filter(id=>!before.has(id)).length;
    const used=Math.min(ft,transfersMade);
    ft=clamp((ft-used)+1,0,5);
  }
  S.ft=ft;S.ftLastGw=next-1;
}
function snapshotPredictions(){
  if(!S.model)return;
  const g=S.model.next.id;
  const sp=(S.squad||[]).map(id=>S.model.players.find(p=>p.id===id)).filter(Boolean);
  if(!sp.length)return;
  /* One-gameweek basis, matching how the card reads it back for a past week.
     The display path previously recomputed with S.horizon, which for a past
     gameweek summed FORWARD into future weeks (past entries don't exist in the
     model), producing nonsense like "pred 19.0" for a single week. */
  const predByPlayer={};
  sp.forEach(p=>{predByPlayer[p.id]=hPts(p,g,1);});
  /* Freeze the line-up too. startingXI() re-sorts by that week's predicted
     points on every render, so once a week is past (all zeroes) the XI and
     formation drifted arbitrarily. Captured here so a finished week stays
     exactly as it was set. */
  let xi=[];
  try{xi=startingXI().map(p=>p.id);}catch(e){xi=[];}
  S.planByGw=S.planByGw||{};
  S.planByGw[g]={...(S.planByGw[g]||{}),predByPlayer,
    xi:xi.length===11?xi:undefined,
    captain:S.captain,vice:S.vice};
}
function writePlan(g,ids,extra){
  const next=S.model?S.model.next.id:1;
  if(g===next){                       // editing the live week updates the base squad directly
    if(ids)S.squad=ids.slice();
    if(extra){if(extra.captain!==undefined)S.captain=extra.captain;
      if(extra.vice!==undefined)S.vice=extra.vice;if(extra.bank!==undefined)S.bank=extra.bank;}
  }
  S.planByGw=S.planByGw||{};
  const prev=S.planByGw[g]||{};
  S.planByGw[g]={...prev,...(ids?{squad:ids.slice()}:{}),...(extra||{})};
  if(g===next)snapshotPredictions();
}
function applySwap(oid,iid){
  const g=editableGw();if(g==null)return;
  const o=S.model.players.find(p=>p.id===oid),i=S.model.players.find(p=>p.id===iid);
  if(!o||!i)return;
  const cur=squadPlayers().map(p=>p.id);
  /* Guarded at this level rather than in the callers: both listpick's swap
     branch and doswap reach here, and neither checked that the incoming
     player was already owned. map(x=>x===oid?iid:x) then replaced one slot
     and left the original in place, producing a squad with the same player
     twice (and a man short elsewhere). */
  if(iid!==oid&&cur.includes(iid)){toast(i.web_name+" is already in your squad");return;}
  const ids=cur.map(x=>x===oid?iid:x);
  /* F26: a sale credits the selling price (purchase price plus half the
     rise, rounded down), not the current price. F46: a swap the bank cannot
     cover is refused here, where every route to a swap passes, and the bank
     is left untouched. */
  const bank=+((planBank())+sellPrice(o)-i.price).toFixed(1);
  if(bank<-0.001){toast(`Not enough in the bank: £${(-bank).toFixed(1)} short for ${i.web_name}`,{warn:true});return false;}
  const extra={bank};
  if(S.captain===oid)extra.captain=iid;
  if(S.vice===oid)extra.vice=iid;
  writePlan(g,ids,extra);
  S.flagged=S.flagged.filter(x=>x!==oid);S.forceXI=null;saveState();
  return true;
}
/* A squad should never contain the same player twice. Repairs any state that
   already went wrong before the guard above existed, rather than leaving a
   broken saved squad stuck that way. */
function dedupeSquad(){
  const seen=new Set(),out=[];
  (S.squad||[]).forEach(id=>{if(!seen.has(id)){seen.add(id);out.push(id);}});
  if(out.length!==(S.squad||[]).length){S.squad=out;S.forceXI=null;return true;}
  return false;
}
/* bank as it stands for the viewed week's plan */
/* The official bank for the most recently completed gameweek. The feed
   publishes this per week, so it is authoritative for the live week rather
   than the locally-tracked S.bank, which drifted with every planned edit. */
function bankFromFeed(){
  if(!S.tracker||!Array.isArray(S.tracker.gw)||!S.model)return null;
  const g=S.model.next.id;
  const rows=S.tracker.gw.filter(r=>r.bank!=null&&r.event<=g).sort((a,b)=>a.event-b.event);
  if(!rows.length)return null;
  return +rows[rows.length-1].bank;
}
/* F59: FPL's own team value for the latest published week (it includes the
   bank), so the header can set it beside the squad's buy prices. */
function valueFromFeed(){
  if(!S.tracker||!Array.isArray(S.tracker.gw)||!S.model)return null;
  const g=S.model.next.id;
  const rows=S.tracker.gw.filter(r=>r.value!=null&&r.event<=g).sort((a,b)=>a.event-b.event);
  return rows.length?{value:+rows[rows.length-1].value,event:rows[rows.length-1].event}:null;
}
/* D12 (13 Oct 2026): what a Free Hit or Wildcard can spend, by FPL's rule:
   the squad's selling value plus the bank. One function for the Chips page,
   the Team Rating and anything else that needs the whole budget. */
function squadBudget(){
  return +(squadPlayers().reduce((a,p)=>a+sellPrice(p),0)+planBank()).toFixed(1);
}
/* D17 (13 Oct 2026): expected points the vice-captain and the bench add in
   week e. If the captain does not play the vice's score is doubled instead:
   (1 - P(captain plays)) x vice. A starter who does not play is replaced by
   the bench in order: the keeper by the bench keeper, outfielders by the
   outfield bench, each used with the probability that at least that many
   outfield starters miss (formation limits ignored). */
function coverPts(xi,bench,cap,vice,e,capMult){
  const pp=p=>{const q=p&&p.gw[e];return q&&!q.blank&&q.pPlay!=null?q.pPlay:1;};
  const pts=p=>(p&&p.gw[e]&&p.gw[e].pts)||0;
  let s=0;
  if(cap&&vice&&vice!==cap&&xi.includes(vice))s+=(1-pp(cap))*pts(vice)*((capMult||2)-1);
  const gkS=xi.find(p=>p.pos===1), gkB=bench.find(p=>p.pos===1);
  if(gkS&&gkB)s+=(1-pp(gkS))*pts(gkB);
  /* distribution of how many outfield starters miss (Poisson binomial) */
  let dist=[1];
  xi.filter(p=>p.pos!==1).forEach(p=>{const q=1-pp(p),nd=new Array(dist.length+1).fill(0);
    dist.forEach((v,k)=>{nd[k]+=v*(1-q);nd[k+1]+=v*q;});dist=nd;});
  const atLeast=k=>dist.slice(k).reduce((a,v)=>a+v,0);
  bench.filter(p=>p.pos!==1).forEach((p,i)=>{s+=atLeast(i+1)*pts(p);});
  return s;
}
function planBank(){
  const g=VG(), next=S.model?S.model.next.id:1;
  if(g>next&&S.planByGw&&S.planByGw[g]&&S.planByGw[g].bank!=null)return S.planByGw[g].bank;
  /* For the live week, trust the official figure unless the user has made
     planned edits this week that move it (those write their own bank). */
  if(g===next&&!(S.planByGw&&S.planByGw[g]&&S.planByGw[g].bank!=null)){
    const f=bankFromFeed();if(f!=null)return f;
  }
  return S.bank;
}
/* Historical returns for this manager, shown alongside each projection */
const TRANSFER_MIN=1.0;   // a suggestion has to be worth the transfer
const CHIP_HISTORY={wildcard:10.2,bboost:23.7,freehit:10.7,"3xc":14.2};
const chipKind=k=>k.replace(/[12]$/,"");
const CHIP_NAME={wildcard:"Wildcard",freehit:"Free Hit",bboost:"Bench Boost","3xc":"Triple Captain"};
/* The gameweek a chip (key like "freehit1") was actually played, from the
   official history in the feed; null when it has not been played. */
function chipPlayed(k){
  const kind=chipKind(k), half2=k.endsWith("2");
  const rows=(S.tracker&&S.tracker.gw)||[];
  const r=rows.find(r=>r.chip===kind&&((r.event>=20)===half2));
  return r?r.event:null;
}
/* F47: the official chip rules, checked for every planned chip. Returns the
   reason a plan is not allowed, or null when it is. */
function chipRuleBreak(k,e){
  const kind=chipKind(k), half2=k.endsWith("2"), name=CHIP_NAME[kind]||kind;
  const played=chipPlayed(k);
  if(played!=null)return `${name} ${half2?"2":"1"} was already played in GW${played}`;
  if(half2?(e<20||e>38):(e<1||e>19))return `${name} ${half2?"2":"1"} can only be played in GW${half2?"20 to 38":"1 to 19"}`;
  if(kind==="freehit"&&e===1)return "Free Hit cannot be played in GW1";
  const other=Object.entries(S.chips||{}).find(([kk,v])=>kk!==k&&v===e);
  if(other)return `Only one chip per gameweek: GW${e} already has ${CHIP_NAME[chipKind(other[0])]||other[0]}`;
  const playedThatWeek=((S.tracker&&S.tracker.gw)||[]).find(r=>r.event===e&&r.chip);
  if(playedThatWeek)return `GW${e} already had ${CHIP_NAME[playedThatWeek.chip]||playedThatWeek.chip} played`;
  if(kind==="freehit"){
    const near=["freehit1","freehit2"].filter(kk=>kk!==k).map(kk=>S.chips&&S.chips[kk]).concat(
      ((S.tracker&&S.tracker.gw)||[]).filter(r=>r.chip==="freehit").map(r=>r.event));
    if(near.some(v=>v===e-1||v===e+1))return "Free Hit cannot be played in two gameweeks in a row";
  }
  return null;
}

/* ---------- chip planning ----------
   Each chip is judged on what actually makes it pay, not one shared formula. */
/* "Your XI" for a week: the legal best XI plus the captain (its top scorer),
   and the four left on the bench (F34; was the top 11 with no formation). */
function weekScore(sp,e){
  const v=p=>p.gw[e]?.pts||0;
  const start=legalBestXI(sp,v);
  const bench=sp.filter(p=>!start.includes(p)).sort((a,b)=>v(b)-v(a));
  const cap=start.reduce((m,p)=>(!m||v(p)>v(m))?p:m,null);
  const vice=start.filter(p=>p!==cap).reduce((m,p)=>(!m||v(p)>v(m))?p:m,null);
  return{xi:start,bench,
    pts:start.reduce((a,p)=>a+v(p),0)+(cap?v(cap):0)+coverPts(start,[],cap,vice,e),   // vice only: compared with bestXIScore, which has no bench
    benchPts:bench.reduce((a,p)=>a+v(p),0)};
}
function bestXIScore(e){
  const pool=S.model.players.filter(p=>p.avail>0&&p.gw[e]&&!p.gw[e].blank);
  const by={1:[],2:[],3:[],4:[]};pool.forEach(p=>by[p.pos]&&by[p.pos].push(p));
  Object.values(by).forEach(a=>a.sort((x,y)=>y.gw[e].pts-x.gw[e].pts));
  const club={},take=[];
  const grab=(pos,n)=>{let c=0;for(const p of by[pos]){if(c>=n)break;if((club[p.team]||0)>=3)continue;
    club[p.team]=(club[p.team]||0)+1;take.push(p);c++;}};
  grab(1,1);grab(2,3);grab(4,1);
  const rest=[...by[2].slice(3),...by[3],...by[4].slice(1)].sort((a,b)=>b.gw[e].pts-a.gw[e].pts);
  for(const p of rest){if(take.length>=11)break;if(take.includes(p))continue;
    if((club[p.team]||0)>=3)continue;club[p.team]=(club[p.team]||0)+1;take.push(p);}
  const byPts=take.slice().sort((a,b)=>b.gw[e].pts-a.gw[e].pts),c=byPts[0];
  /* D17: vice cover, as weekScore counts it, so the two compare like for like */
  return take.reduce((a,p)=>a+p.gw[e].pts,0)+(c?c.gw[e].pts:0)+coverPts(take,[],c,byPts[1],e);
}
function chipPlan(kind){
  const sp=squadPlayers();if(!sp.length||!S.model)return[];
  const g=S.model.next.id,half=kind.endsWith("2");
  const from=half?Math.max(20,g):g, to=half?38:19;
  const weeks=[];for(let e=from;e<=to;e++)if(sp.some(p=>p.gw[e]&&!p.gw[e].blank))weeks.push(e);
  if(!weeks.length)return[];
  const k=chipKind(kind);
  if(k==="bboost"){
    const wc=S.chips[half?"wildcard2":"wildcard1"];
    return weeks.map(e=>{const w=weekScore(sp,e);
      return{e,up:w.benchPts,note:(wc&&e===wc+1?"straight after your Wildcard — ":"")+
        "bench: "+w.bench.map(p=>p.web_name).join(", ")};})
      .sort((a,b)=>b.up-a.up).slice(0,3);
  }
  if(k==="freehit"){
    return weeks.map(e=>{const mine=weekScore(sp,e).pts,best=bestXIScore(e);
      return{e,up:Math.max(0,best-mine),note:`your XI ${mine.toFixed(1)} v best available ${best.toFixed(1)}`};})
      .sort((a,b)=>b.up-a.up).slice(0,3);
  }
  if(k==="3xc"){
    return weeks.map(e=>{
      const top=[...sp].sort((a,b)=>(b.gw[e]?.pts||0)-(a.gw[e]?.pts||0))[0];
      const f=top?.gw[e]?.fixtures?.[0];
      return{e,up:top?.gw[e]?.pts||0,
        note:top?`${top.web_name} v ${f?f.opp:"?"} ${f?(f.home?"(H)":"(A)"):""}`:""};})
      .sort((a,b)=>b.up-a.up).slice(0,3);
  }
  const out=[];
  for(let i=0;i+2<weeks.length;i++){
    const win=[weeks[i],weeks[i+1],weeks[i+2]];
    const tot=win.reduce((a,e)=>a+weekScore(sp,e).pts,0);
    out.push({e:win[0],span:win,tot,up:CHIP_HISTORY.wildcard,
      note:`GW${win[0]}–${win[2]} projects only ${tot.toFixed(1)}`});
  }
  return out.sort((a,b)=>a.tot-b.tot).slice(0,3);
}
/* Every legal formation is built and scored; the best one wins. The single
   highest projected player in the game is always taken and captained. */
const FORMATIONS=[[3,4,3],[3,5,2],[4,3,3],[4,4,2],[4,5,1],[5,3,2],[5,4,1],[5,2,3]];
function teamOfWeek(){
  if(!S.model)return null;
  /* D19 (13 Oct 2026): the same budget as the Free Hit card (D12), not a
     fixed £100.0 */
  const g=VG(), BUDGET=squadBudget(), BENCH_MAX=17.5, need=RULES.squad;
  const pool=S.model.players.filter(p=>p.avail>0&&p.gw[g]&&!p.gw[g].blank&&p.gw[g].pts>0);
  if(!pool.length)return null;
  const by={1:[],2:[],3:[],4:[]};
  pool.forEach(p=>by[p.pos]&&by[p.pos].push(p));
  const rank=(a,b)=>(b.gw[g].pts-a.gw[g].pts)||(b.owned-a.owned);
  Object.values(by).forEach(a=>a.sort(rank));
  const star=pool.slice().sort(rank)[0];          // must-have, always captain

  let best=null;
  FORMATIONS.forEach(([d,m,f])=>{
    const XI={1:1,2:d,3:m,4:f};
    const picked=[],club={};
    const can=p=>!picked.includes(p)&&(club[p.team]||0)<3;
    const add=p=>{picked.push(p);club[p.team]=(club[p.team]||0)+1;};
    if(XI[star.pos]>=1)add(star);
    [4,3,2,1].forEach(pos=>{let n=picked.filter(x=>x.pos===pos).length;
      for(const p of by[pos]){if(n>=XI[pos])break;if(!can(p))continue;add(p);n++;}});
    if(picked.length<11)return;
    const startCost=()=>picked.reduce((a,p)=>a+p.price,0);
    /* cheapest legal bench that fits the remaining budget */
    const bench=[];
    let benchSpend=0;
    [1,2,3,4].forEach(pos=>{
      const want=need[pos]-picked.filter(x=>x.pos===pos).length;
      const cheap=by[pos].slice().sort((a,b)=>a.price-b.price||rank(a,b));
      let taken=0;
      for(const p of cheap){if(taken>=want)break;
        if(picked.includes(p)||bench.includes(p))continue;
        if((club[p.team]||0)>=3)continue;
        bench.push(p);club[p.team]=(club[p.team]||0)+1;benchSpend+=p.price;taken++;}
    });
    if(bench.length!==4||benchSpend>BENCH_MAX+0.001)return;
    /* trim starters until the whole squad fits £100 */
    let guard=0;
    while(startCost()+benchSpend>BUDGET&&guard++<200){
      const order=picked.slice().sort((a,b)=>(a.gw[g].pts/a.price)-(b.gw[g].pts/b.price));
      let done=false;
      for(const out of order){
        if(out===star)continue;
        const alt=by[out.pos].find(q=>!picked.includes(q)&&!bench.includes(q)&&q.price<out.price-0.05
          &&((club[q.team]||0)<3||q.team===out.team));
        if(alt){club[out.team]--;picked.splice(picked.indexOf(out),1);
          picked.push(alt);club[alt.team]=(club[alt.team]||0)+1;done=true;break;}}
      if(!done)break;
    }
    if(startCost()+benchSpend>BUDGET+0.001)return;
    /* spend anything spare on the XI without lowering the projection */
    let up=true,g2=0;
    while(up&&g2++<150){
      up=false;
      const spare=BUDGET-startCost()-benchSpend;
      if(spare<0.1)break;
      let pick=null;
      picked.forEach(out=>{
        if(out===star)return;
        by[out.pos].forEach(q=>{
          if(picked.includes(q)||bench.includes(q))return;
          const extra=q.price-out.price;
          if(extra<=0||extra>spare+1e-9)return;
          if(q.team!==out.team&&(club[q.team]||0)>=3)return;
          const dd=q.gw[g].pts-out.gw[g].pts;
          if(dd>=-1e-9&&(!pick||dd>pick.dd))pick={out,inn:q,dd};});});
      if(pick){club[pick.out.team]--;picked.splice(picked.indexOf(pick.out),1);
        picked.push(pick.inn);club[pick.inn.team]=(club[pick.inn.team]||0)+1;up=true;}
    }
    const total=picked.reduce((a,p)=>a+p.gw[g].pts,0)+star.gw[g].pts;   // captain doubled
    if(!best||total>best.total)
      best={squad:picked.concat(bench),xi:picked.slice(),bench:bench.slice(),cap:star,
        total,value:+(startCost()+benchSpend).toFixed(1),
        benchValue:+benchSpend.toFixed(1),shape:`${d}-${m}-${f}`};
  });
  return best;
}
function teamRating(){
  const t=teamOfWeek();if(!t||!t.total)return null;
  const g=VG();const xi=startingXI();if(!xi.length)return null;
  const cap=S.model.players.find(p=>p.id===S.captain);
  let mine=xi.reduce((a,p)=>a+(p.gw[g]?.pts||0),0)+(cap&&xi.includes(cap)?(cap.gw[g]?.pts||0):0);
  return{pct:Math.round(clamp(mine/t.total,0,1)*100),mine,best:t.total,totw:t,budget:squadBudget()};
}

/* ---------- news ---------- */
/* All feeds are fetched, parsed and sanitised by the FPL Signals server every
   15 minutes, so the page makes two cheap same-origin calls: /api/news for
   the general feeds and r/FantasyPL, and /api/player-news for the per-player
   Google News searches (the page knows the squad; the server does not). A
   source that fails upstream keeps serving its last good copy and reports its
   error in perSource, which fills srcLog. Nothing here blocks the squad data. */
async function loadNews(){
  if(!S.model)return;
  if(BACKUP){S.newsState="backup";render();return;}
  S.newsState="loading";S.news=[];S.reddit=[];S.squadNews=[];S.srcLog={};render();
  const log={};
  try{
    const r=await fetch("/api/news");
    if(!r.ok)throw new Error("HTTP "+r.status);
    const d=await r.json();
    const news=Array.isArray(d.news)?d.news:[];
    const reddit=Array.isArray(d.reddit)?d.reddit:[];
    Object.entries(d.perSource||{}).forEach(([name,s])=>{
      log[name]=s&&s.ok?(s.count??0):"failed"+(s&&s.error?" ("+s.error+")":"");
    });
    S.newsFetchedAt=d.fetchedAt||null;
    /* one server call for all fifteen squad searches, searched by full name
       as before; items come back keyed by the name that was sent */
    const squad=[];
    try{
      const sp=squadPlayers();
      const names=sp.map(p=>(((p.first||"")+" "+(p.last||"")).trim())||p.web_name);
      const r2=await fetch("/api/player-news?names="+encodeURIComponent(names.join(",")));
      if(r2.ok){
        const d2=await r2.json();
        sp.forEach((p,i)=>{
          const items=(d2.items&&d2.items[names[i]])||[];
          items.forEach(it=>squad.push({...it,src:p.web_name}));
          log["· "+p.web_name]=items.length;
        });
      }
    }catch(e){/* squad search is additive; the general feed already landed */}
    const seen=new Set();
    const dedupe=a=>a.filter(n=>{const k=(n.title||"").slice(0,64).toLowerCase();
      if(!k||seen.has(k))return false;seen.add(k);return true;});
    S.news=dedupe(news.sort((a,b)=>b.time-a.time));
    S.squadNews=dedupe(squad.sort((a,b)=>b.time-a.time));
    S.reddit=dedupe(reddit);
    S.srcLog=log;
    S.newsState=(S.news.length||S.reddit.length||S.squadNews.length)?"ok":"fail";
  }catch(e){
    S.srcLog=log;S.newsState="fail";
  }
  render();
}
function hits(title){
  if(!S.model||!S.squad)return[];
  const t=title.toLowerCase();
  return squadPlayers().filter(p=>{
    const n=norm(p.web_name),l=norm(p.last||"");
    return (n.length>3&&t.replace(/[^a-z]/gi,"").toLowerCase().includes(n))||
           (l.length>4&&t.toLowerCase().includes((p.last||"").toLowerCase()));
  }).map(p=>p.web_name);
}

/* ============================================================
   RENDER
   ============================================================ */
let tT=null;
function toast(m,o){let el=document.getElementById("toast");
  if(!el){el=document.createElement("div");el.id="toast";el.className="toast";document.body.appendChild(el);}
  /* o.warn: a refusal, shown in the warning colour for longer so it is read */
  el.textContent=m;el.classList.toggle("warn",!!(o&&o.warn));el.style.display="block";clearTimeout(tT);
  tT=setTimeout(()=>el.style.display="none",(o&&o.ms)||(o&&o.warn?6000:3000));}
/* F93: a signed one-decimal figure that never shows "-0.0" */
const sgn1=x=>{const r=Math.round(x*10)/10;return (r>0?"+":r<0?"−":"")+Math.abs(r).toFixed(1);};
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const arw=c=>c>0?'<span style="color:var(--mint)">▲</span>':c<0?'<span style="color:var(--red)">▼</span>':"";

function cardHTML(p,bench,ctx){
  const g=VG(),q=p.gw[g]||{fixtures:[],pts:0};
  /* ctx lets the comparison squad render through this exact same function
     instead of its own stripped-down copy, so it gains the form pill,
     actual-points display, injury dot, bench numbering and fixture strip
     automatically and can never drift out of step with the planner again.
     Its buttons dispatch the c-prefixed actions so edits land on the
     comparison team rather than the real one. */
  const C=ctx||null;
  const A=C?{sub:"csub",flag:"cflag",cap:"ccap",vice:"cvice"}
           :{sub:"sub",flag:"flag",cap:"cap",vice:"vice"};
  const capId=C?C.captain:null, viceId=C?C.vice:null;
  const flaggedList=C?(C.flagged||[]):S.flagged;
  const {captain:capForGw,vice:viceForGw}=C?{captain:capId,vice:viceId}:effectiveCaptainVice(g);
  const isC=C?(capId===p.id):(_histCaptain!=null?_histCaptain===p.id:capForGw===p.id);
  const isV=C?(viceId===p.id):(_histSquadActive?_histVice===p.id:(_histCaptain==null&&viceForGw===p.id));
  const fl=flaggedList.includes(p.id);
  /* A finished week with official picks is a record, not a draft: the edit
     controls don't render, and the multiplier comes from the official pick
     (so a real Triple Captain week triples), never from the local chip plan. */
  const official=_histSquadActive&&!C;

  const chipNow=chipForWeek(g);
  const capMult=official
    ?((_histMult&&_histMult[p.id]>=2)?_histMult[p.id]:1)
    :(isC?(chipNow==="3xc"?3:2):1);
  /* For a historical week, hPts() can't compute a real number (the model only
     projects forward) — use the snapshot captured while that week was still
     live, if one was taken. */
  const snapPred=(g<S.model.next.id&&S.planByGw&&S.planByGw[g]&&S.planByGw[g].predByPlayer
    &&S.planByGw[g].predByPlayer[p.id]!=null)?S.planByGw[g].predByPlayer[p.id]:null;
  /* For a finished gameweek, only a snapshot is trustworthy. hPts() sums
     forward from g, and the model holds no entries for past weeks, so calling
     it here silently added up FUTURE gameweeks instead (a single past week
     showing "pred 19.0"). No snapshot means no prediction, not a fabricated one. */
  const isPast=S.model&&g<S.model.next.id;
  const basePred=snapPred!=null?snapPred:(isPast?null:hPts(p,g,S.horizon));
  const hasPred=basePred!=null;
  const shownPts=hasPred?basePred*capMult:null;
  /* Actual points for this specific gameweek — only present once the live-actuals
     feed has that GW. Captain-multiplied the same way as the prediction, so the two
     compare like-for-like (both = "contribution to the squad total"). */
  const feedGW=(S.playerActuals&&(S.playerActuals[p.id]||S.playerActuals[String(p.id)]))||null;
  const actualRaw=feedGW?feedGW[g]??feedGW[String(g)]:null;
  const hasActual=actualRaw!=null;
  const actualShown=hasActual?actualRaw*capMult:null;
  const diff=(hasActual&&hasPred)?actualShown-shownPts:null;
  /* The score box colour must follow whichever number is actually displayed —
     previously it always used the predicted band, so a past week with a real
     (and possibly good) actual score still coloured itself off a near-zero
     retrospective prediction, which is why actuals looked permanently red. */
  const shownVal=hasActual?actualShown:(hasPred?shownPts:0);
  const col=ptsCol(shownVal/Math.max(1,S.horizon));
  const bg=col[0], fg=col[1], elite=col[2]==="elite";
  /* The model only projects forward from the current gameweek, so a past week
     with no live-actuals data yet has no real number to show — the naive shownPts
     would render a misleading "0.0" (and colour it as a bad projection) rather
     than making clear no data exists for that week. */
  const noHistData=g<S.model.next.id&&!p.gw[g]&&snapPred==null&&!hasActual;
  let n3="";
  if(g<S.model.next.id){
    /* Historical gameweek: show only the opponent for that week, not the next 3. */
    const w=p.gw[g];
    if(w&&!w.blank&&w.fixtures[0]){const f=w.fixtures[0],[b,c]=fdrCol(posDiff(p,f));
      n3=`<span style="background:${b};color:${c};${f.home?"":"font-style:italic"}" title="GW${g} · ${f.home?"home":"away"}">${esc(f.opp.slice(0,3))}</span>`;
    }else n3=`<span style="background:var(--ink3);color:var(--mute)">—</span>`;
  }else{
    for(let e=g;e<g+3&&e<=38;e++){const w=p.gw[e];
      if(!w||w.blank){n3+=`<span style="background:var(--ink3);color:var(--mute)">—</span>`;continue;}
      const f=w.fixtures[0],[b,c]=fdrCol(posDiff(p,f));
      n3+=`<span style="background:${b};color:${c};${f.home?"":"font-style:italic"}" title="GW${e} · ${f.home?"home":"away"} · difficulty ${posDiff(p,f)}">${esc(f.opp.slice(0,3))}</span>`;}
  }
  const sub=(C?C.subFrom:S.subFrom)===p.id;
  /* Bench players show their sub-order number; tapping ⇄ mid-substitution receives
     the swap. Outfield subs also cycle their order when idle (benchcycle); the
     keeper is fixed at position 1 and does not cycle. */
  const isBench=!!bench,slot=isBench?bench.slot:0,cyc=isBench&&bench.cycle;
  const subOnclick=isBench
    ? (cyc?`act(${C?"S.compare.subFrom":"S.subFrom"}!=null?'${A.sub}':'benchcycle',${p.id})`:`act('${A.sub}',${p.id})`)
    : `act('${A.sub}',${p.id})`;
  const subGlyph=isBench?(S.subFrom==null?slot:"⇄"):"⇄";
  const subTitle=isBench?(cyc?`Bench ${slot} · tap to change order (or to receive a substitution)`:`Bench ${slot} · goalkeeper (fixed)`):"Substitute";
  /* Official past week: no edit controls at all, just the armbands that were
     actually worn, as plain badges, and the bench number as a plain label. */
  const controls=official
    ?`${isC?`<span class="badge" style="bottom:-2px;left:4px;background:var(--cream);color:var(--ink)" title="Captain (official)">C</span>`:""}
      ${isV?`<span class="badge" style="bottom:-2px;right:4px;background:var(--cyan);color:var(--ink)" title="Vice-captain (official)">V</span>`:""}
      ${isBench?`<span class="badge" style="top:-2px;left:2px;background:var(--ink3);color:var(--cream)" title="Bench ${slot} (official)">${slot}</span>`:""}`
    :`<button class="badge" style="top:-2px;right:2px;background:${fl?"var(--mint)":"var(--ink3)"};color:${fl?"var(--ink)":"var(--cream)"}" onclick="act('${A.flag}',${p.id})" title="${fl?"Keep":"Replace"}">✕</button>
    <button class="badge" style="top:-2px;left:2px;background:${sub?"var(--cyan)":"var(--ink3)"};color:${sub?"var(--ink)":"var(--cream)"}" onclick="${subOnclick}" title="${subTitle}">${subGlyph}</button>
    <button class="badge" style="bottom:-2px;left:4px;background:${isC?"var(--cream)":"rgba(0,0,0,.5)"};color:${isC?"var(--ink)":"var(--mute)"}" onclick="act('${A.cap}',${p.id})" title="Captain">C</button>
    <button class="badge" style="bottom:-2px;right:4px;background:${isV?"var(--cyan)":"rgba(0,0,0,.5)"};color:${isV?"var(--ink)":"var(--mute)"}" onclick="act('${A.vice}',${p.id})" title="Vice-captain">V</button>`;
  return `<div class="card ${fl?"dim":""}" ${sub?'style="outline:2px solid var(--cyan);outline-offset:2px;border-radius:7px"':""}>
   <div class="kit">${shirtSVG(p.teamName.toUpperCase(),p.pos===1,38)}
    ${p.avail<1?`<span class="dot" style="top:-2px;left:20px;background:${p.avail===0?"var(--red)":"var(--amber)"}" title="${esc(p.news||"Doubt")}"></span>`:""}
    ${controls}</div>
   <div class="namebar" onclick="act('card',${p.id})"><span class="nm">${esc(p.web_name)}</span>
    <span class="pr">£${p.price.toFixed(1)}${arw(p.priceChange)}</span></div>
   ${p.avail<1?injLine(p):""}
   <div class="ptsbar" style="background:${noHistData?"var(--ink3)":bg};color:${noHistData?"var(--mute)":fg}${elite&&!noHistData?";box-shadow:0 0 0 2px #EAFFEF, 0 0 12px rgba(125,251,158,.85)":""}" title="${p.total} pts this season (actual)">
    <div class="pv">${noHistData?"—":(hasActual?actualShown.toFixed(1):(hasPred?shownPts.toFixed(1):"—"))}</div>
    ${noHistData?`<div class="pv2" style="opacity:.85">no data for GW${g}</div>`:""}</div>
   ${(hasActual&&hasPred)
     ?`<div class="fxpill" style="background:var(--ink2);color:var(--mute)">pred ${shownPts.toFixed(1)}
        <span style="font-weight:700;color:${diff>=0?"var(--mint)":"var(--red)"}">${diff>=0?"+":""}${diff.toFixed(1)}</span></div>`
     :(hasActual
       ?`<div class="fxpill" style="background:var(--ink2);color:var(--ink3)">no prediction stored</div>`
       :(()=>{const[fb,ff]=ptsCol(p.form||0);
        /* F56: form from last season, blended or estimated is muted and tagged */
        const ft=formTag(p);
        return `<div class="fxpill formpill${ft?" prior":""}" style="background:${fb};color:${ff}">
          <svg viewBox="0 0 14 10" width="10" height="8" aria-hidden="true"><path d="M0.5 8.5 L4 4.5 L6.5 6.5 L13.5 1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span class="formlbl">FORM</span><b>${(p.form||0).toFixed(1)}</b>${ft}</div>`;})())}
   <div class="next3">${n3}</div>
   <div class="cardsigs">${sigHTML(p,g)}</div></div>`;
}
/* F108 (bundle 8, 13 Oct 2026): the flag is readable on the pitch, not
   hover-only: "75% · Knee", "Out · Hamstring", "Suspended". */
function injLine(p){
  const n=String(p.news||"");
  const what=(/suspend/i.test(n)?"Suspended":n.replace(/\s*-\s*.*$/,"").replace(/\s*injury$/i,"").trim())||"Doubt";
  const pct=p.avail>0?Math.round(p.avail*100)+"%":"Out";
  return `<div class="injline${p.avail===0?" out":""}" title="${esc(n||what)}">${pct} · ${esc(what)}</div>`;
}
/* keep any explicit bench order the optimiser set, else best first */
function orderBench(list){
  const g=VG();
  /* A finished week with official picks keeps the official bench order
     (positions 12-15, auto subs applied), not the local S.benchOrder. */
  if(_histSquadActive&&Array.isArray(_histBench)&&_histBench.length){
    const off=_histBench.map(id=>list.find(p=>p.id===id)).filter(Boolean);
    if(off.length===list.length)return off;
  }
  const gk=list.filter(p=>p.pos===1);
  const out=list.filter(p=>p.pos!==1);
  const ordered=(S.benchOrder&&S.benchOrder.length)
    ?out.slice().sort((a,b)=>{const idx={};S.benchOrder.forEach((id,i)=>idx[id]=i);
        return (idx[a.id]??99)-(idx[b.id]??99);})
    :out.slice().sort((a,b)=>(b.gw[g]?.pts||0)-(a.gw[g]?.pts||0));
  return [...gk,...ordered];
}
/* ---------- squad dashboard ----------
   Six forward-looking readings. Everything here answers "what should I do
   next" — nothing retrospective, since the official app covers that better. */
/* ---------- comparison ----------
   A scratch clone of the squad. Same transfer and substitution behaviour, but
   only the original can be saved; the clone offers to apply its changes across. */
function compXI(){
  const C=S.compare;
  if(C&&C.forceXI&&C.forceXI.length===11){
    const xi=C.forceXI.map(id=>S.model.players.find(p=>p.id===id)).filter(Boolean);
    if(xi.length===11)return xi;
  }
  const sq=(S.compare&&S.compare.squad)||[];
  const sp=sq.map(id=>S.model.players.find(p=>p.id===id)).filter(Boolean);
  if(!sp.length)return[];
  const g=VG(),by={};
  sp.forEach(p=>(by[p.pos]=by[p.pos]||[]).push(p));
  Object.values(by).forEach(a=>a.sort((x,y)=>(y.gw[g]?.pts||0)-(x.gw[g]?.pts||0)));
  const xi=[];if(by[1]?.[0])xi.push(by[1][0]);
  (by[2]||[]).slice(0,3).forEach(p=>xi.push(p));(by[4]||[]).slice(0,1).forEach(p=>xi.push(p));
  [...(by[2]||[]).slice(3),...(by[3]||[]),...(by[4]||[]).slice(1)]
    .sort((a,b)=>(b.gw[g]?.pts||0)-(a.gw[g]?.pts||0)).slice(0,11-xi.length).forEach(p=>xi.push(p));
  return xi;
}
function compPts(weeks){
  const C=S.compare;if(!C)return 0;
  const g=VG(),xi=compXI();if(!xi.length)return 0;
  let s2=xi.reduce((a,p)=>a+hPts(p,g,weeks),0);
  const cap=S.model.players.find(p=>p.id===C.captain);
  if(cap&&xi.includes(cap))s2+=hPts(cap,g,weeks);
  const chip=chipForWeek(g);
  const bench=(C.squad||[]).map(i=>S.model.players.find(p=>p.id===i))
    .filter(p=>p&&!xi.includes(p));
  if(chip==="bboost")s2+=bench.reduce((a,p)=>a+hPts(p,g,weeks),0);
  if(chip==="3xc"&&cap)s2+=hPts(cap,g,weeks);
  return s2;
}
function compareHTML(){
  const C=S.compare;if(!C)return "";
  const g=VG();
  const deltas=[1,3,5].map(w=>({w,mine:weekPts_w(w),theirs:compPts(w)}));
  const xi=compXI();
  const sq=(C.squad||[]).map(id=>S.model.players.find(p=>p.id===id)).filter(Boolean);
  const bench=sq.filter(p=>!xi.includes(p));
  /* Renders through the planner's own cardHTML with a comparison context, so
     the two teams look and behave identically by construction rather than by
     two copies of markup being kept in sync by hand. */
  const bOrder=bench.slice();
  const card=(p)=>{
    const i=bOrder.findIndex(b=>b.id===p.id);
    return cardHTML(p,i>=0?{slot:i+1,cycle:p.pos!==1}:undefined,C);
  };
  const win=deltas[0].theirs>deltas[0].mine;
  return `<div class="panel" style="border-color:${win?"var(--mint)":"var(--ink3)"}">
    <div class="phead"><h2 style="${win?"color:var(--mint)":""}">Compare</h2>
      <span style="display:flex;gap:6px;align-items:center">
        <span class="note">£${(C.bank||0).toFixed(1)} bank</span>
        <button onclick="act('capply')">Apply to my team</button>
        <button onclick="act('cclose')">Close</button></span></div>
    <div class="pbody" style="border-bottom:1px solid var(--ink3);display:flex;gap:14px;flex-wrap:wrap">
      ${deltas.map(d=>{const diff=d.theirs-d.mine;
        return `<span style="flex:1;min-width:96px;text-align:center">
          <span style="display:block;font-size:10px;color:var(--mute);font-weight:800">${d.w===1?"This GW":d.w+" GW"}</span>
          <span style="display:block;font-family:'Geist';font-weight:800;font-size:22px;line-height:1.1;
            color:${diff>0.05?"var(--mint)":diff<-0.05?"var(--red)":"var(--cream)"}">${diff>0?"+":""}${diff.toFixed(1)}</span>
          <span style="display:block;font-size:10px;color:var(--mute)" class="mono">${d.theirs.toFixed(1)} v ${d.mine.toFixed(1)}</span></span>`;}).join("")}
    </div>
    <div class="pitch">${[1,2,3,4].map(pos=>{const r=xi.filter(p=>p.pos===pos);
      return r.length?`<div class="row">${r.map(card).join("")}</div>`:"";}).join("")}</div>
    <div class="benchbar"><div class="lb">Bench</div><div class="row">${bench.map(card).join("")}</div></div>
    ${(C.flagged||[]).length?`<div class="repl">
      <div style="padding:9px 12px;font-size:10px;color:var(--cyan);font-weight:700">
        Replace ${(C.flagged||[]).map(id=>esc(S.model.players.find(p=>p.id===id)?.web_name||"")).join(", ")} — pick from the player pool</div></div>`:""}
  </div>`;
}
function weekPts_w(weeks){
  const xi=startingXI();if(!xi.length)return 0;
  const g=VG();
  let s2=xi.reduce((a,p)=>a+hPts(p,g,weeks),0);
  const cap=S.model.players.find(p=>p.id===S.captain);
  if(cap&&xi.includes(cap))s2+=hPts(cap,g,weeks);
  const chip=chipForWeek(g);
  const bench=orderBench(squadPlayers().filter(p=>!xi.includes(p)));
  if(chip==="bboost")s2+=bench.reduce((a,p)=>a+hPts(p,g,weeks),0);
  if(chip==="3xc"&&cap)s2+=hPts(cap,g,weeks);
  return s2;
}
function dashData(){
  if(!S.model||!squadPlayers().length)return null;
  const g=VG(), sp=squadPlayers(), xi=startingXI();
  const bench=orderBench(sp.filter(p=>!xi.includes(p)));
  /* strength by position against the best affordable at the same price */
  const strength={};
  [1,2,3,4].forEach(pos=>{
    const mine=sp.filter(p=>p.pos===pos);
    if(!mine.length)return;
    const got=mine.reduce((a,p)=>a+(p.gw[g]?.pts||0),0);
    const pool=S.model.players.filter(p=>p.pos===pos&&p.avail>0)
      .sort((a,b)=>(b.gw[g]?.pts||0)-(a.gw[g]?.pts||0));
    let budget=mine.reduce((a,p)=>a+p.price,0), best=0, taken=0, club={};
    for(const p of pool){
      if(taken>=mine.length)break;
      if(p.price>budget-(mine.length-taken-1)*3.9)continue;
      if((club[p.team]||0)>=3)continue;
      club[p.team]=(club[p.team]||0)+1;best+=p.gw[g]?.pts||0;budget-=p.price;taken++;}
    strength[pos]={got,best,pct:best>0?clamp(got/best,0,1):0,n:mine.length};
  });
  /* five-week fixture outlook for the XI */
  const outlook=[];
  for(let e=g;e<g+5&&e<=38;e++){
    let sum=0,n=0;
    xi.forEach(p=>{const q=p.gw[e];if(q&&!q.blank)q.fixtures.forEach(f=>{sum+=posDiff(p,f);n++;});});
    outlook.push({e,avg:n?sum/n:0,pts:xi.reduce((a,p)=>a+(p.gw[e]?.pts||0),0),
      blanks:sp.filter(p=>!p.gw[e]||p.gw[e].blank).length});
  }
  /* risks, most serious first */
  const risks=[];
  sp.forEach(p=>{
    if(p.avail===0)risks.push({sev:3,who:p.web_name,what:p.back?`out · back ${p.back}`:"unavailable"});
    else if(p.avail<1)risks.push({sev:2,who:p.web_name,what:`doubt · ${Math.round(p.avail*100)}% to play${p.availAssumed?" (assumed)":""}`});
    else if(p.xMins<55&&xi.includes(p))risks.push({sev:1,who:p.web_name,what:`rotation risk · ${p.xMins}′`});
  });
  for(let e=g;e<g+5&&e<=38;e++){
    const bl=sp.filter(p=>!p.gw[e]||p.gw[e].blank);
    if(bl.length>=2)risks.push({sev:2,who:`GW${e}`,what:`${bl.length} players blank`});
    const db=sp.filter(p=>p.gw[e]&&p.gw[e].fixtures.length>1);
    if(db.length>=2)risks.push({sev:0,who:`GW${e}`,what:`${db.length} players have a double`});
  }
  risks.sort((a,b)=>b.sev-a.sev);
  /* club concentration in the XI */
  const conc={};xi.forEach(p=>conc[p.teamName]=(conc[p.teamName]||0)+1);
  const top=Object.entries(conc).sort((a,b)=>b[1]-a[1]).filter(x=>x[1]>=3)
    .map(([t,n])=>{
      const pl=xi.filter(p=>p.teamName===t);
      const f=pl[0]?.gw[g]?.fixtures?.[0];
      return{team:t,n,pct:Math.round(n/xi.length*100),
        fix:f?`${f.opp}${f.home?" (H)":" (A)"}`:"—"};});
  /* bench, which is what Bench Boost is worth */
  const benchPts=bench.reduce((a,p)=>a+(p.gw[g]?.pts||0),0);
  /* captaincy — the highest-leverage call each week */
  const caps=[...xi].sort((a,b)=>(b.gw[g]?.pts||0)-(a.gw[g]?.pts||0)).slice(0,3)
    .map(p=>({p,pts:p.gw[g]?.pts||0,f:p.gw[g]?.fixtures?.[0]}));
  /* how much of the projection rests on players whose role may have moved */
  const risky=sp.filter(p=>p.staleRole||(xi.includes(p)&&p.xMins<60));
  const riskPts=risky.filter(p=>xi.includes(p)).reduce((a,p)=>a+(p.gw[g]?.pts||0),0);
  const xiPts=xi.reduce((a,p)=>a+(p.gw[g]?.pts||0),0);
  /* template versus contrarian */
  const diffs=xi.filter(p=>p.owned<10);
  const diffPts=diffs.reduce((a,p)=>a+(p.gw[g]?.pts||0),0);
  /* fixture runs across the squad — which clubs swing your score */
  const runs={};
  sp.forEach(p=>{
    let good=0,bad=0,n=0;
    for(let e=g;e<g+5&&e<=38;e++){const q=p.gw[e];if(!q||q.blank)continue;
      q.fixtures.forEach(f=>{const d=posDiff(p,f);if(d<=2)good++;else if(d>=4)bad++;n++;});}
    if(!n)return;
    const t=p.teamName;
    runs[t]=runs[t]||{good:0,bad:0,n:0,players:0};
    runs[t].good+=good;runs[t].bad+=bad;runs[t].n+=n;runs[t].players++;
  });
  const runList=Object.entries(runs).map(([t,v])=>({t,
    score:(v.good-v.bad)/Math.max(1,v.n),players:v.players/1,good:v.good,bad:v.bad}))
    .sort((a,b)=>b.score-a.score);
  return{strength,outlook,risks,conc:top,bench,benchPts,caps,risky,riskPts,xiPts,diffs,diffPts,runList,xi};
}
function dashHTML(){
  const g=VG(), d=dashData();
  const open=k=>!!S.dash[k];
  const sp=squadPlayers(), xi=startingXI();
  const kind=p=>{let good=0,n=0;
    for(let e=g;e<g+5&&e<=38;e++){const q=p.gw[e];if(!q||q.blank)continue;
      q.fixtures.forEach(f=>{if(posDiff(p,f)<=2)good++;n++;});}
    return{good,n};};
  const rated=list=>list.map(p=>{const k=kind(p);
    return{p,...k,bad:k.n-k.good};}).filter(x=>x.n>=4);
  const bestOf=list=>rated(list).filter(x=>x.good>=4)
    .sort((a,b)=>b.good-a.good||(b.p.gw[g]?.pts||0)-(a.p.gw[g]?.pts||0)).slice(0,3);
  const worstOf=list=>rated(list).filter(x=>x.bad>=3)
    .sort((a,b)=>b.bad-a.bad||(a.p.gw[g]?.pts||0)-(b.p.gw[g]?.pts||0)).slice(0,3);
  const attP=sp.filter(p=>p.pos>=3), defP=sp.filter(p=>p.pos<=2);
  const att=bestOf(attP), attBad=worstOf(attP);
  const def=bestOf(defP), defBad=worstOf(defP);
  const byForm=[...sp].sort((a,b)=>b.form-a.form);
  const line=(l,r,c)=>`<div class="dline"><span>${l}</span><span class="mono" style="${c||""}">${r}</span></div>`;
  const plLine=(p,right,c)=>`<div class="dline">
      <span style="display:flex;align-items:center;gap:7px">${shirtSVG(p.teamName.toUpperCase(),p.pos===1,18)}
        <span><b>${esc(p.web_name)}</b><span class="note" style="display:block">${esc(p.teamName)} · ${POS[p.pos]}</span></span></span>
      <span class="mono" style="${c||""};font-weight:700">${right}</span></div>`;
  const cell=(k,title,head,body,colour)=>`
    <div class="dashcell ${open(k)?"open":""}">
      <button class="dashrow" onclick="act('dash','${k}')">
        <span class="dtop"><span class="dkey">${title}</span>
          <span class="dchev">${open(k)?"▲":"▼"}</span></span>
        <span class="dval" style="${colour||""}">${head}</span>
      </button>
      ${open(k)?`<div class="dashbody">${body}</div>`:""}</div>`;

  /* strength is keyed by position: {got, best, pct, n} for each */
  const st=d.strength||{};
  const totGot=[1,2,3,4].reduce((a,k)=>a+(st[k]?st[k].got:0),0);
  const totBest=[1,2,3,4].reduce((a,k)=>a+(st[k]?st[k].best:0),0);
  const barPct=Math.round(100*totGot/Math.max(1,totBest));
  return `<div class="dashgrid">
    ${cell("str","Squad strength",`${totGot.toFixed(1)} of ${totBest.toFixed(1)}`,
      `<div class="dbar"><span style="width:${clamp(barPct,3,100)}%"></span></div>
       <p class="note" style="margin:8px 0 10px">Your squad against the strongest one the same budget could buy.</p>
       ${[1,2,3,4].filter(k=>st[k]).map(k=>line(POS[k],
         `${st[k].got.toFixed(1)} / ${st[k].best.toFixed(1)}`,
         st[k].pct<0.75?"color:var(--red)":st[k].pct>=0.9?"color:var(--mint)":"")).join("")}`,
      barPct>=88?"color:var(--mint)":barPct>=75?"color:var(--amber)":"color:var(--red)")}
    ${(()=>{
      /* F63: this cell is a ranking of options, and it used to be titled
         "Captain" while the captain actually picked was someone else. The
         picked captain now leads, then the options by projected points. */
      const capId=_histCaptain!=null?_histCaptain:effectiveCaptainVice(g).captain;
      const mine=sp.find(p=>p.id===capId)||null, mp=mine?(mine.gw[g]?.pts||0)*2:0;
      const head=mine?`${esc(mine.web_name)} ${mp.toFixed(1)}`
        :(d.caps.length?`${esc(d.caps[0].p.web_name)} ${(d.caps[0].pts*2).toFixed(1)}`:"—");
      return cell("caps","Captain options",head,
        (mine?`<p class="dsub">Your captain</p>${plLine(mine,mp.toFixed(1),"color:var(--cream)")}<p class="dsub">Best options</p>`:"")
        +d.caps.map(c=>plLine(c.p,(c.pts*2).toFixed(1),"color:var(--mint)")).join("")
        +`<p class="note" style="margin:8px 0 0">Doubled score for GW${g}. The options are ranked by projected points.</p>`,
        mine?"color:var(--cream)":"color:var(--mint)");
    })()}
    ${cell("risk","Points at risk",
      `${d.riskPts.toFixed(1)} of ${d.xiPts.toFixed(1)}`,
      d.risky.length?d.risky.map(p=>plLine(p,(p.gw[g]?.pts||0).toFixed(1),
        p.staleRole?"color:var(--amber)":"color:var(--mute)")).join("")
        +`<p class="note" style="margin:8px 0 0">Amber marks a squad place that may have changed hands.</p>`
        :`<p class="note" style="margin:0">Nothing flagged.</p>`,
      d.riskPts/Math.max(1,d.xiPts)>0.25?"color:var(--red)":d.riskPts>0?"color:var(--amber)":"")}
    ${cell("form","Form",byForm.length?`${esc(byForm[0].web_name)} ${byForm[0].form.toFixed(1)}`:"—",
      `<p class="dsub">Best</p>${byForm.slice(0,3).map(p=>plLine(p,p.form.toFixed(1)+formTag(p),"color:var(--mint)")).join("")}
       <p class="dsub">Worst</p>${byForm.slice(-3).reverse().map(p=>plLine(p,p.form.toFixed(1)+formTag(p),"color:var(--red)")).join("")}`,
      "color:var(--mint)")}
    ${cell("aout","Attack outlook",
      att.length?`${esc(att[0].p.web_name)} ${att[0].good}/${att[0].n}`:"none kind",
      `<p class="dsub">Kind runs</p>${att.length?att.map(x=>plLine(x.p,`${x.good}/${x.n}`,"color:var(--amber)")).join("")
        :`<p class="note" style="margin:0">No forward or midfielder has four kind fixtures in the next five.</p>`}
       <p class="dsub">Hard runs</p>${attBad.length?attBad.map(x=>plLine(x.p,`${x.bad}/${x.n} hard`,"color:var(--red)")).join("")
        :`<p class="note" style="margin:0">None with three or more hard fixtures.</p>`}`,
      att.length?"color:var(--amber)":"color:var(--mute)")}
    ${cell("dout","Defence outlook",
      def.length?`${esc(def[0].p.web_name)} ${def[0].good}/${def[0].n}`:"none kind",
      `<p class="dsub">Kind runs</p>${def.length?def.map(x=>plLine(x.p,`${x.good}/${x.n}`,"color:var(--sky)")).join("")
        :`<p class="note" style="margin:0">No keeper or defender has four kind fixtures in the next five.</p>`}
       <p class="dsub">Hard runs</p>${defBad.length?defBad.map(x=>plLine(x.p,`${x.bad}/${x.n} hard`,"color:var(--red)")).join("")
        :`<p class="note" style="margin:0">None with three or more hard fixtures.</p>`}`,
      def.length?"color:var(--sky)":"color:var(--mute)")}
  </div>`;
}

function squadListHTML(){
  const g=VG(), xi=startingXI();
  const bench=orderBench(squadPlayers().filter(p=>!xi.includes(p)));
  const all=squadPlayers();
  /* Official past week: the armbands actually worn, and no edit controls,
     the same rule the pitch cards follow. */
  const official=_histSquadActive;
  const capId=official?_histCaptain:S.captain, viceId=official?_histVice:S.vice;
  const key=S.sqSort||"pos", dir=S.sqDir||"asc";
  const val={
    pos:p=>p.pos*100-(xi.includes(p)?50:0),
    name:p=>p.web_name.toLowerCase(),
    buy:p=>purchaseOf(p).paid,
    sell:p=>sellPrice(p),
    form:p=>p.form, xmins:p=>p.xMins,
    pred:p=>p.gw[g]?.pts||0, p3:p=>hPts(p,g,3), p5:p=>hPts(p,g,5)
  }[key]||(p=>p.pos);
  const rows=[...all].sort((a,b)=>{
    const x=val(a),y=val(b);
    const c=typeof x==="string"?x.localeCompare(y):x-y;
    return dir==="asc"?c:-c;});
  const cols=[["name","Player"],["buy","Bought"],["sell","Sells"],["form","Form"],
    ["xmins","xMins"],["pred","xFPL"],["p3","3GW"],["p5","5GW"]];
  const arrow=k=>key===k?(dir==="asc"?" ↑":" ↓"):"";
  const head=`<tr>${cols.map(([k,n])=>`<th class="${key===k?"act":""}"
      style="text-align:${k==="name"?"left":"right"}" onclick="act('sqsort','${k}')">${n}${arrow(k)}</th>`).join("")}
    <th style="text-align:center">Position stats</th>
    <th style="text-align:center">Next 3</th><th></th></tr>`;
  const body=rows.map(p=>{
    const starting=xi.includes(p);
    const q=p.gw[g]||{fixtures:[]};
    const buy=purchaseOf(p).paid;
    const sell=sellPrice(p);
    return `<tr class="${starting?"":"sub"}">
      <td class="nm"><span style="display:flex;align-items:center;gap:8px">
        ${shirtSVG(p.teamName.toUpperCase(),p.pos===1,22)}
        <span style="min-width:0">
          <button class="lname" onclick="act('card',${p.id})">${esc(p.web_name)}</button>
          ${capId===p.id?'<span class="tag c">C</span>':""}${viceId===p.id?'<span class="tag v">V</span>':""}
          ${starting?"":'<span class="tag s">SUB</span>'}
          <span style="display:block;font-size:10px;color:var(--mute)">${esc(p.teamName)} · ${POS[p.pos]}</span>
        </span></span></td>
      <td class="mono" style="text-align:right">£${buy.toFixed(1)}</td>
      <td class="mono" style="text-align:right;color:${sell>buy?"var(--mint)":sell<buy?"var(--red)":"var(--cream)"}">£${sell.toFixed(1)}</td>
      <td class="mono" style="text-align:right">${p.form.toFixed(1)}</td>
      <td class="mono" style="text-align:right">${p.xMins}′</td>
      <td class="mono" style="text-align:right;color:var(--mint);font-weight:700">${(q.pts||0).toFixed(1)}</td>
      <td class="mono" style="text-align:right;color:var(--cyan)">${hPts(p,g,3).toFixed(1)}</td>
      <td class="mono" style="text-align:right;color:var(--cyan)">${hPts(p,g,5).toFixed(1)}</td>
      <td style="white-space:nowrap"><span class="psrow">${posStats(p).map(([k,v])=>
        `<span class="ps"><span class="k">${k}</span><span class="v">${v}</span></span>`).join("")}</span></td>
      <td style="text-align:center;white-space:nowrap">${fix3(p,g)}</td>
      <td style="text-align:right;white-space:nowrap">${official?"":`
        <button class="mini" onclick="act('sub',${p.id})" title="Substitute">⇄</button>
        <button class="mini" onclick="act('cap',${p.id})" title="Captain">C</button>
        <button class="mini" onclick="act('flag',${p.id})" title="Transfer out">✕</button>`}</td></tr>`;}).join("");
  return `<div class="scroll"><table class="sqtable"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}
