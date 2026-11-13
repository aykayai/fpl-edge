/* FPL Signals - app-render.js
   player card, pitch, list, tables, all page markup

   Part of a single script split across files so each stays small enough to
   fetch whole. Loaded in order as classic scripts, sharing one global scope,
   so the order in index.html matters: app-main.js must come last. */
/* ---------- player detail card ---------- */
/* Position-specific stats, shared by the card and the list view so the two
   never disagree about what matters for a given position. */
function posStats(p){
  const w=ws(String(p.code||""),p.pos,38,p.price,teamMaxPrice(p.team));
  const g=VG(), q=p.gw[g];
  /* one clean-sheet figure everywhere: the model's own (odds when priced) */
  const csv=csProbNext(p,g),csPct=csv!=null?Math.round(csv*100)+"%":"—";
  /* FPL's own season figures (p.off), not the model's shrunk inputs */
  const o=p.off||{};
  const n=(v,d)=>v==null||!isFinite(v)?"—":v.toFixed(d==null?2:d);
  const pc=v=>v==null||!isFinite(v)?"—":Math.round(v*100)+"%";
  if(p.pos===1)return[["CS %",csPct],["Saves/90",n(o.sv90)],
    ["Goals prev",n(w?w.gp:null,1)],["GC/90",n(o.gc90)]];
  /* DefCon: his hit share (both seasons, recent weighted) and this season's
     hits out of matches played */
  const dcTile=["DefCon",`${pc(p.dcHitRate)}${p.dcApps?` · ${p.dcHits}/${p.dcApps}`:""}`];
  if(p.pos===2)return[["CS %",csPct],dcTile,
    ["Aerial/90",n(w?w.aer90:null,1)],["GC/90",n(o.gc90)]];
  /* a midfielder who has reached DefCon twice or more shows it in place of
     final-third passes */
  if(p.pos===3)return[(p.dcHits||0)>=2?dcTile:["F3 pass/90",n(w?w.f390:null,1)],["xA/90",n(o.xa90)],
    ["Shots/90",n(w?w.sh90:null,1)],["xGI/90",n(o.xgi90)]];
  /* conversion is goals against shots; big chances missed comes straight from
     the match records rather than being derived */
  const conv=w&&w.sh90>0&&w.mins>0?(w.g/Math.max(1,w.sh90*w.mins/90)):null;
  return[["Box/90",n(w?w.box90:null,1)],["SoT/90",n(w?w.sot90:null,1)],
    ["BC missed",n(w?w.bcm:null,0)],["Conversion",pc(conv)]];
}
function playerCardHTML(){
  const p=S.model.players.find(x=>x.id===S.cardId);
  if(!p)return "";
  const g=VG();
  const w=ws(String(p.code||""),p.pos,38,p.price,teamMaxPrice(p.team));
  const pu=purchaseOf(p), buy=pu.paid, owns=(S.squad||[]).includes(p.id);
  const five=[];for(let e=g;e<g+5&&e<=38;e++){const q=p.gw[e];
    five.push({e,pts:q&&!q.blank?q.pts:0,f:q&&q.fixtures[0]});}
  const mx=Math.max(1,...five.map(x=>x.pts));
  const stat=(k,v,c)=>`<div class="pcs"><span class="k">${k}</span><span class="v" style="${c||""}">${v}</span></div>`;
  return `<div class="pcwrap" onclick="act('card',0)">
    <div class="pcard" onclick="event.stopPropagation()">
      <button class="pcx" onclick="act('card',0)">✕</button>
      <div class="pchead">
        <span class="pcimgwrap">
          <img class="pcimg" alt="" src="${imgSrc("player",p.code)}"
            onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
          <span style="display:none">${shirtSVG(p.teamName.toUpperCase(),p.pos===1,72)}</span></span>
        <div class="pcname">${esc(p.web_name)}</div>
        <div class="note">${esc(p.teamFull||p.teamName)} · ${POS[p.pos]} · ${p.owned.toFixed(1)}% owned</div>
        <div style="margin-top:7px">${sigHTML(p,g)}</div>
      </div>
      ${p.avail<1?`<div class="warn" style="margin:12px 0 0">${esc(p.news||"Fitness doubt")}${p.back?` · back ${esc(p.back)}`:""}${p.availAssumed?` · 50% to play${availTag(p)}`:""}</div>`:""}
      <div class="pclab">Next five</div>
      <div class="pcbars">${five.map(x=>{
        const h=Math.max(5,Math.round(x.pts/mx*54));
        const[b,c]=x.f?fdrCol(posDiff(p,x.f)):["var(--ink3)","var(--mute)"];
        return `<span class="pcbar"><span class="pv">${x.pts.toFixed(1)}</span>
          <span class="bar" style="height:${h}px;background:${b}"></span>
          <span class="op" style="${x.f&&!x.f.home?"font-style:italic":""}">${x.f?esc(x.f.opp):"—"}</span>
          <span class="gw">GW${x.e}</span></span>`;}).join("")}</div>
      <div class="pcgrid">
        ${owns?stat("Bought",`£${buy.toFixed(1)}`+(pu.est?srcTag("est.","Estimated as the season-start price: the feed has not published what you paid."):"")):stat("Price",`£${p.price.toFixed(1)}`)}
        ${stat("Sells for",`£${sellPrice(p).toFixed(1)}`,
          sellPrice(p)>buy?"color:var(--mint)":sellPrice(p)<buy?"color:var(--red)":"")}
        ${stat("Form",p.form.toFixed(1)+formTag(p))}
        ${stat("xMins",p.xMins+"′"+minsTag(p))}
      </div>
      <div class="pclab">${POS[p.pos]} detail</div>
      <div class="pcgrid">${posStats(p).map(([k,v])=>stat(k,v)).join("")}</div>
      ${setPieceText(p)?`<div class="pclab">Set pieces</div>
        <div style="padding-top:6px;font-size:12.5px">${esc(setPieceText(p))}</div>`:""}
    </div></div>`;
}

function pitchHTML(){
  const xi=startingXI();
  if(!xi.length)return `<div class="pbody" style="text-align:center"><p class="note">No squad loaded.</p>
    <button class="pri" onclick="act('seed')">Load my squad</button></div>`;
  const bench=orderBench(squadPlayers().filter(p=>!xi.includes(p)));
  let h=`<div class="pitch">`;
  [1,2,3,4].forEach(pos=>{const r=xi.filter(p=>p.pos===pos);
    if(r.length)h+=`<div class="row">${r.map(p=>cardHTML(p)).join("")}</div>`;});
  h+=`</div>`;
  if(bench.length)h+=`<div class="benchbar"><div class="lb">Bench</div><div class="row">${bench.map((p,i)=>cardHTML(p,{slot:i+1,cycle:p.pos!==1})).join("")}</div></div>`;
  return h;
}
/* The two pages keep their own filters — changing one never moves the other */
function filtered(scope){
  const list=scope==="list";
  let pos=list?S.lPos:S.fPos, team=list?S.lTeam:S.fTeam;
  const cap=list?S.lMax:S.fMax, q=(list?S.lSearch:S.fSearch)||"";
  if(!list){
    /* When the comparison squad is open and has a player flagged for replacement,
       lock the pool to THAT player's position — otherwise the pool stayed keyed
       to the main squad and there was no way to pick a replacement into the
       comparison team. Falls back to the main-squad flag lock. */
    const lock=S.flagged.length===1?S.model.players.find(p=>p.id===S.flagged[0])?.pos:0;
    if(lock&&S.fPos!==lock){S.fPos=lock;pos=lock;}
  }
  let out=S.model.players.filter(p=>(!pos||p.pos===pos)&&(!team||p.team===team)
    &&p.price<=cap+.001&&p.price>=3.5-.001
    &&(!q||(p.web_name+" "+p.first+" "+p.last).toLowerCase().includes(q.toLowerCase())));
  if(list){
    const g=S.model.next.id;
    if(S.starOnly)out=out.filter(p=>S.stars.includes(p.id));
    if(S.iconF.length)out=out.filter(p=>{const ic=signals(p,g).map(x=>x[0]);
      return S.iconF.every(k=>ic.includes(k));});
  }
  return out;
}
const fix3=(p,g)=>{let h='';const LENS=p2=>p2.pos<=2?'def':'att';for(let e=g;e<g+3&&e<=38;e++){const q=p.gw[e];
  if(!q||q.blank){h+='<span class="fdrpill" style="background:var(--ink3);color:var(--mute);font-size:10px;padding:1px 4px">—</span>';continue;}
  const f=q.fixtures[0],[b,c]=fdrCol(p.pos<=2?(f.diffDef??f.diff):(f.diffAtt??f.diff));
  h+=`<span class="fdrpill" style="background:${b};color:${c};font-size:10px;padding:1px 4px">${esc(f.opp.slice(0,3))}</span>`;}
  return `<span style="display:inline-flex;gap:2px">${h}</span>`;};
/* F35: one expression for each figure Player Data shows, so its sort and
   the Transfers radar read the same number the cell prints. The CS % sort
   read p.csRate, which model players never carry, so it sorted on 0; the
   BPS/90 sort and the radar used the season total. */
function csProbNext(p,g){
  const q=p.gw[g],f=q?.fixtures?.[0];
  /* 12 Nov 2026: the model's own clean-sheet chance for the first fixture
     (the one its points use, bookmakers' when priced); the old band formula
     only where the model has none */
  if(q&&q.csPs&&q.csPs.length)return q.csPs[0];
  return f?Math.exp(-clamp(p.gc90/(1+(3-(f.diffDef??3))*0.18),.25,3.2)):null;
}
/* Stats windows (12 Nov 2026 audit). "Season" is this season only, and
   shows FPL's own per-90 figures where FPL publishes one; Last N reads the
   match rows. Start % is starts out of his club's matches, so weeks on the
   bench or injured count against him. */
function dispWin(){const w=S.lWin||38;return w>=38?SEASON_WIN:w;}
let _clubPlayed=null;
function clubPlayed(){
  if(_clubPlayed&&_clubPlayed.h===S.hist&&_clubPlayed.m===S.teamMatch)return _clubPlayed.v;
  const key={};(S.teams||[]).forEach(t=>{key[Math.round(num(t.code))]=t.short;key["id"+t.id]=t.short;});
  const sh=v=>key[v]||key["id"+v],seen=new Set(),v={};
  Object.values(S.hist||{}).forEach(rows=>rows.forEach(r=>{if(r.tag==="now"&&r.mins>0)seen.add(r.mid);}));
  seen.forEach(mid=>{const m=(S.teamMatch||{})[mid];if(!m)return;
    [sh(m.h),sh(m.a)].forEach(t=>{if(t)(v[t]=v[t]||[]).push({mid,gw:m.gw});});});
  Object.values(v).forEach(a=>a.sort((x,y)=>x.gw-y.gw));
  _clubPlayed={h:S.hist,m:S.teamMatch,v};return v;
}
function startShare(p,n){
  const all=clubPlayed()[p.teamName]||[],club=n?all.slice(-n):all;if(!club.length)return null;
  const mids=new Set(club.map(x=>x.mid));
  const st=((S.hist&&S.hist[String(p.code||"")])||[]).filter(r=>r.tag==="now"&&r.mins>0&&r.start===0&&mids.has(r.mid)).length;
  return st/club.length;
}
function statVal(p,k,W){
  const o=p.off,season=(S.lWin||38)>=38;
  if(k==="startpct")return startShare(p,season?0:S.lWin);
  if(season&&o){const m={xgi:o.xgi90,xa:o.xa90,xg:o.xg90,dc:o.dc90,sv90:o.sv90,gc90:o.gc90}[k];if(m!=null)return m;}
  if(!W)return null;
  return {xgi:(W.xg90||0)+(W.xa90||0),xa:W.xa90,xg:W.xg90,dc:W.dc90,sv90:W.sv90,gc90:p.pos===1?W.gc90:W.gcTeam90}[k];
}
function bpsPer90(p,q){return q&&q.mins>0?p.bps*90/Math.max(1,p.minutes||q.mins):null;}
const SORTVAL=(p,k,g)=>{
  const W=ws(String(p.code||""),p.pos,dispWin())||{};
  const sv=k=>statVal(p,k,W)??-1;
  const f0=p.gw[g]?.fixtures?.[0];
  const team=(S.model.teams||[]).find(t=>t.id===p.team);
  const gwr=lGwRange();
  return ({name:p.web_name,team:p.teamName,pos:p.pos,price:p.price,
  next:(p.gw[g]?.fixtures||[]).reduce((s,f)=>s+f.diff,0)||99,form:p.form,lastform:p.lastForm,
  pred:hPts(p,g,S.tab==="table"?1:S.horizon),prxfpl:hPts(p,gwr.from,gwr.count),pred3:hPts(p,g,3),pred5:hPts(p,g,5),avg:avgFP(p,g,S.horizon),
  total:p.total,owned:p.owned,ppg:p.ppg,xg:sv("xg"),xa:sv("xa"),dc:sv("dc"),
  mins:p.minutes,xmins:p.xMins,bonus:p.bonus,tin:p.tIn,
  startpct:sv("startpct"),xgi:sv("xgi"),
  npxg:W.npxg90||0,dchit:W.dcHit||0,dchits:W.estimated||p.pos<2?-1:(W.dcHits||0)-(W.dcApps||0)/1000,cc:W.cc90||0,box:W.box90||0,
  bps:bpsPer90(p,W)??-1,csp:csProbNext(p,g)??-1,sv90:sv("sv90"),
  spthreat:p.spThreat||0,penord:p.penOrder||99,
  /* position-specific columns — previously missing, so their headers did not sort */
  oppatt:f0?(f0.oppAtt??3):0,teamdef:team?team.def:0,
  xgot:W.xgot90||0,gprev:W.gp||0,gc90:sv("gc90"),pensv:p.pensSaved||0,og:p.ownGoals||0,
  cbit:W.cbit90||0,aer:W.aer90||0,shbox:(W.sh90||0)*0.62,sh90:W.sh90||0,sot:W.sot90||0,
  f3:W.f390||0,drb:W.drb90||0,bcm:W.bcm||0,
  conv:(W.xg90>0?(W.g||0)/Math.max(.1,W.xg90*(W.mins||0)/90):0)}[k]);
};
function sortList(arr,key,dir,g){
  return arr.sort((x,y)=>{const a=SORTVAL(x,key,g),b=SORTVAL(y,key,g);
    if(typeof a==="string")return dir==="asc"?a.localeCompare(b):b.localeCompare(a);
    return dir==="asc"?a-b:b-a;});
}

/* Top three replacements for whoever is flagged, pinned above the list */
function replHTML(){
  if(!S.flagged.length||!S.model)return "";
  const g=VG();
  const P2=id=>S.model.players.find(x=>x.id===id);
  return S.flagged.map(id=>{
    const o=S.model.players.find(p=>p.id===id);if(!o)return"";
    /* every affordable, legal option ranked by projection — not just ones that
       happen to beat the outgoing player */
    /* wave 4: ranked by what each adds to your XI over the horizon (the engine) */
    const opts=engineMoves({squad:S.squad||[],bank:planBank(),g,h:S.horizon||1,outs:[id]}).slice(0,3);
    return `<div class="repl"><div style="padding:9px 12px;display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap">
      <span style="font-size:10px;font-weight:700;color:var(--cyan)">
        Replace ${esc(o.web_name)} · ${POS[o.pos]}</span>
      <span class="note">£${(planBank()+sellPrice(o)).toFixed(1)} to spend · sells for £${sellPrice(o).toFixed(1)}</span></div>
      ${opts.length?opts.map(m=>`<button class="prow" onclick="act('doswap',${o.id},${m.inn.id})">
        ${shirtSVG(m.inn.teamName.toUpperCase(),m.inn.pos===1,24)}
        <span style="flex:1;min-width:0">
          <span style="display:flex;align-items:center;gap:5px"><span style="font-size:12.5px;font-weight:600">${esc(m.inn.web_name)}</span>${sigHTML(m.inn,g)}</span>
          <span style="display:block;font-size:10px;color:var(--mute)">${esc(m.inn.teamName)} · £${m.inn.price.toFixed(1)} · ${m.inn.xMins}′ xMins</span></span>
        <span class="mono" style="color:${m.gain>=0?"var(--mint)":"var(--red)"};font-weight:700" title="Change to your XI over ${S.horizon||1} GW">${sgn1(m.gain)}</span></button>`).join("")
        :`<div class="pbody"><p class="note">No affordable option at this position.</p></div>`}</div>`;
  }).join("");
}
const INJ=p=>p.avail===0?`<span title="${esc(p.news||"Unavailable")}" style="color:var(--red);font-size:11px">✚</span>`
  :(p.avail<1?`<span title="${esc(p.news||"Doubt")}" style="color:var(--amber);font-size:11px">✚</span>`:"");
const PD_PAGE=100;
function listHTML(){
  const g=VG();
  const a=sortList(filtered("planner"),S.lSort,S.lDir,g);
  /* budget available: bank plus whatever the flagged players would raise */
  const flags=S.flagged||[];
  const ownIds=S.squad||[];
  const raised=flags.reduce((t,id)=>{
    const o=S.model.players.find(p=>p.id===id);return t+(o?sellPrice(o):0);},0);
  const budget=+(planBank()+raised).toFixed(1);   // the header's bank, not the drifting S.bank (as F41)
  const outP=flags.map(id=>S.model.players.find(p=>p.id===id)).filter(Boolean);
  const cols=[["price","£"],["xmins","xMins"],["form","Form"],["pred","xPts"],["pred3","3GW"],["pred5","5GW"]];
  const head=`<div class="lhead"><span style="flex:1" data-k="name" class="${S.lSort==="name"?"act":""}" onclick="act('lsort','name')">Player</span>
    ${cols.map(([k,n])=>`<span class="lc ${S.lSort===k?"act":""}" data-k="${k}" onclick="act('lsort','${k}')">${n}</span>`).join("")}</div>`;
  /* F77 (bundle 9): the pool was 84% of the Planner's page (150 rows, ~4,000
     elements); 50 at a time, more on request */
  const plim=S.poolLimit||50;
  const pmore=a.length>plim?`<div class="pdmore"><span class="note">Showing ${plim} of ${Math.min(a.length,150)}</span>
    <button onclick="act('poolmore')">Show ${Math.min(50,Math.min(a.length,150)-plim)} more</button></div>`:"";
  return head+a.slice(0,Math.min(plim,150)).map(p=>{
    const own=ownIds.includes(p.id);
    /* everything stays selectable; unaffordable players are simply dimmed */
    const afford=!flags.length || p.price<=budget+0.001 || own;
    /* against whoever is being sold in this position, if any */
    const out=outP.find(o=>o.pos===p.pos);
    const delta=out?hPts(p,g,S.horizon)-hPts(out,g,S.horizon):null;
    return `<button class="prow ${own?"own":""}" onclick="act('listpick',${p.id})"
      title="${afford?"":"Over budget by £"+(p.price-budget).toFixed(1)}"
      style="${p.avail===0?"opacity:.35;":""}${!afford?"opacity:.42;":""}">
      ${shirtSVG(p.teamName.toUpperCase(),p.pos===1,24)}
      <span style="flex:1;min-width:0">
        <span style="display:flex;align-items:center;gap:5px">
          <span style="font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.web_name)}</span>
          ${INJ(p)}</span>
        <span style="display:block;font-size:10px;color:var(--mute);margin-top:1px">${esc(p.teamName)} · ${POS[p.pos]}${own?' · <span style="color:var(--mint)">in squad</span>':""}</span>
        <span style="display:block;margin-top:2px">${fix3(p,g)}</span>
        <span class="poolsigs">${sigHTML(p,g)}</span></span>
      <span class="lc mono" style="font-size:11px">£${p.price.toFixed(1)}${arw(p.priceChange)}</span>
      <span class="lc mono" style="font-size:11px;color:var(--mute)">${p.xMins}′</span>
      <span class="lc mono" style="font-size:11px;color:var(--mute)">${p.form.toFixed(1)}</span>
      <span class="lc mono" style="font-size:12px;font-weight:700;color:${
        delta==null?"var(--mint)":(delta<0?"var(--red)":"var(--mint)")}">${
        delta==null?hPts(p,g,S.horizon).toFixed(1):sgn1(delta)}</span>
      <span class="lc mono" style="font-size:11px;color:var(--cyan)">${hPts(p,g,3).toFixed(1)}</span>
      <span class="lc mono" style="font-size:11px;color:var(--cyan)">${hPts(p,g,5).toFixed(1)}</span>
    </button>`;}).join("")+(plim<150?pmore:"");
}
/* A plain range slider packs many possible values into a short drag distance —
   for budget (0.1 steps across 12.5 units, 125 stops) or a gameweek number,
   that makes landing on an exact value genuinely hard. Nudge buttons at two
   step sizes flanking the number input make every value reachable in one or
   two clicks, no dragging required. */
function stepperInput(action,value,opts){
  const o=opts||{};
  const min=o.min??0,max=o.max??100,step=o.step??1,big=o.big??(step*5),dp=o.dp??0;
  const clampv=v=>Math.min(max,Math.max(min,v));
  const fmt=v=>(+v).toFixed(dp);
  return `<span class="stepper">
    <button onclick="act('${action}',${fmt(clampv(value-big))})" title="-${fmt(big)}">«</button>
    <button onclick="act('${action}',${fmt(clampv(value-step))})" title="-${fmt(step)}">‹</button>
    <input type="number" min="${min}" max="${max}" step="${step}" value="${fmt(value)}"
      onchange="act('${action}',this.value)" style="width:${o.w||54}px">
    <button onclick="act('${action}',${fmt(clampv(+value+step))})" title="+${fmt(step)}">›</button>
    <button onclick="act('${action}',${fmt(clampv(+value+big))})" title="+${fmt(big)}">»</button>
  </span>`;
}
function filtersHTML(compact,scope){
  const L=scope==="list";
  const pos=L?S.lPos:S.fPos, team=L?S.lTeam:S.fTeam, q=L?S.lSearch:S.fSearch;
  const A=k=>L?"l"+k:k;
  return `<div class="pbody" style="display:flex;${compact?"flex-direction:column":"flex-wrap:wrap;align-items:end"};gap:9px;border-bottom:1px solid var(--ink3)">
    <input id="srch-${L?'l':'p'}" ${compact?"":'style="width:auto;min-width:150px;flex:1"'} placeholder="Search"
      value="${esc(q)}" oninput="searchInput('${A('search')}',this)">
    <span style="display:flex;gap:4px;flex-wrap:wrap">${[[0,"All"],[1,"GKP"],[2,"DEF"],[3,"MID"],[4,"FWD"]]
      .map(([v,n])=>`<button class="${pos===v?"on":""}" onclick="act('${A('pos')}',${v})">${n}</button>`).join("")}</span>
    ${L?(()=>{const r=lGwRange();return `<span style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
      <span class="note" style="white-space:nowrap">Pr xFPL: GW</span>
      ${stepperInput("lgwfrom",r.from,{min:1,max:38,step:1,big:5,w:40})}
      <span class="note">to</span>
      ${stepperInput("lgwto",r.to,{min:r.from,max:38,step:1,big:5,w:40})}
      </span>`;})():""}
    ${L?"":`<span class="pricebox" style="width:auto">
      <span class="note" style="white-space:nowrap">Max £</span>
      <input type="number" min="3.5" max="16" step="0.1" value="${S.fMax.toFixed(1)}"
        onchange="act('fmax',this.value)" style="width:70px"></span>`}
    <select ${compact?"":'style="width:auto"'} onchange="act('${A('team')}',this.value)"><option value="0">All clubs</option>
      ${S.model.teams.map(t=>`<option value="${t.id}" ${team===t.id?"selected":""}>${esc(t.name)}</option>`).join("")}</select>
  </div>`;
}

/* F45: the two accuracy tiles compare next week's projection with each
   player's season average so far. That smooths away the week-to-week swings
   and is partly built from the same weeks, so it reads far better than a real
   one-week error and must not be set beside other tools' figures. The (i)
   says what it measures and gives the honest one-week figure from the audit's
   pre-deadline backtest (GW1 to GW5, players owned by 1% or more). */
/* X3 (13 Oct 2026): the tiles show the true one-week error from
   pre-deadline projections (trueAccuracy); the old season-average proxy is
   kept as a second line, labelled. */
function xfplAccuracyInfo(g,played,n,T){
  const wk=T?T.weeks.map(w=>`GW${w.g} ${w.mae.toFixed(2)}${w.src==="backtest"?" (backtest)":""}`).join(" · "):"";
  return `<details class="infotip"><summary><span class="infoi" aria-hidden="true">i</span>What the MAE and bias tiles measure</summary>
    <div class="infobox">
      <p style="margin:0 0 6px">MAE is how far, on average, each player's projection made before the deadline was from the points he scored that week; bias is whether it ran high (+) or low (−). Every player with a projection counts, including those who did not play, finished weeks only.${T?` By week: ${wk}.`:""}</p>
      <p style="margin:0 0 6px">Weeks marked backtest (GW1 to GW6) are what this version of the model projects from the data as it stood before each deadline, without odds: a fair test of the model, but not a record of what the page showed at the time. From GW7 the server saves the real projection 60 and 15 minutes before every deadline, and those live weeks replace the backtest.</p>
      <p style="margin:0">The second line, against season average, is the older proxy: each player's GW${g} projection against his points so far divided by ${played} week${played===1?"":"s"} (${n} players on 45+ expected minutes). It smooths the weekly swings, so it reads better than a true one-week error.</p>
    </div></details>`;
}
function xfplHTML(){
  if(!S.model)return `<div class="panel"><div class="pbody"><p class="note">Load data first.</p></div></div>`;
  const g=S.model.next.id;
  const played=S.model.gwPlayed||0;
  const stamp=S.stamp?ukFmt(S.stamp,{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"—";
  const learn=(typeof LS!=="undefined"&&LS.get("learn"))||{};
  /* richer per-gameweek snapshots (movers / xMins shifts / per-GW error) are
     published by the model in app-core.js; the page renders them when present */
  const rep=S.model.report||null;

  const arrow=(d,good)=>{const up=d>0;
    const c=good===undefined?"var(--mute)":((good?up:!up)?"var(--mint)":"var(--red)");
    return `<span style="color:${c}">${up?"▲":"▼"}${Math.abs(d).toFixed(2)}</span>`;};

  /* Predicted vs actual — projection for the upcoming GW against actual points
     per appearance so far. A proxy until per-GW projection snapshots exist. */
  const acc={1:[],2:[],3:[],4:[]};
  if(played>=1)S.model.players.forEach(pl=>{
    if(!pl.minutes||pl.xMins<45)return;
    const proj=pl.gw[g]?.pts||0;if(proj<=0)return;
    acc[pl.pos].push({p:proj,a:pl.total/Math.max(1,played)});});
  const summ=arr=>{if(!arr.length)return null;const n=arr.length;
    return {n,mae:arr.reduce((s,x)=>s+Math.abs(x.p-x.a),0)/n,
      bias:arr.reduce((s,x)=>s+(x.p-x.a),0)/n};};
  const overall=summ([].concat(acc[1],acc[2],acc[3],acc[4]));
  const T=trueAccuracy();

  /* Squad-level predicted vs actual, navigable GW by GW.
     "Predicted" prefers the true snapshot the model job now takes right after
     each deadline (data.team.gw[].predicted) — what was actually predicted,
     not today's calibration applied backwards. Collection only started
     recently, so early gameweeks won't have one; for a PAST week with none,
     showing a retrospective estimate would misrepresent it as a real
     prediction, so it renders "—" instead. For the current or a future week
     there is nothing to be retrospective about yet, so the live forecast
     (weekPtsFor) is still shown as before. "Actual" comes from the
     live-actuals feed and only appears once that GW has been published. */
  const xg=clamp(S.xfplGW||(played>=1?played:g),1,38);
  const isPastGw=xg<g;
  const snapRow=S.tracker&&Array.isArray(S.tracker.gw)?S.tracker.gw.find(r=>r.event===xg):null;
  const snapPred=snapRow&&snapRow.predicted!=null?snapRow.predicted:null;
  const xPred=snapPred!=null?snapPred:(isPastGw?null:weekPtsFor(xg));
  const xActual=(S.actuals&&S.actuals[xg]!=null)?S.actuals[xg]:null;
  const xDiff=(xActual!=null&&xPred!=null)?xActual-xPred:null;
  const compare=`<div class="panel"><div class="phead"><h2>Predicted vs actual</h2>
      <span class="note">your squad, by gameweek</span></div>
    <div class="pbody">
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap">
        <button onclick="act('xfplgw','prev')" ${xg<=1?"disabled":""} aria-label="Earlier">←</button>
        <div style="text-align:center;min-width:96px">
          <span class="note" style="display:block">Predicted${snapPred!=null?"":(isPastGw?"":" (live)")}</span>
          <span style="display:block;font-family:'Geist',system-ui,sans-serif;font-weight:800;font-size:30px;color:${xPred!=null?"var(--cyan)":"var(--ink3)"}">${xPred!=null?xPred.toFixed(1):"—"}</span></div>
        <div style="text-align:center;min-width:64px">
          <span class="note" style="display:block">GW${xg}</span>
          ${xDiff!=null?`<span style="display:block;font-weight:800;font-family:'Geist',system-ui,sans-serif;font-size:15px;color:${xDiff>=0?"var(--mint)":"var(--red)"}">${xDiff>=0?"+":""}${xDiff.toFixed(1)}</span>`:`<span class="note" style="display:block">—</span>`}</div>
        <div style="text-align:center;min-width:96px">
          <span class="note" style="display:block">${xActual!=null&&!weekFinal(xg)?"So far"+LIVE_TAG:"Actual"}</span>
          <span style="display:block;font-family:'Geist',system-ui,sans-serif;font-weight:800;font-size:30px;color:${xActual!=null?"var(--mint)":"var(--ink3)"}">${xActual!=null?xActual.toFixed(1):"—"}</span></div>
        <button onclick="act('xfplgw','next')" ${xg>=38?"disabled":""} aria-label="Later">→</button>
      </div>
      ${xActual==null?`<p class="note" style="margin:8px 0 0;text-align:center">Actual score for GW${xg} lands once the live-actuals feed publishes it.</p>`
        :(xPred==null?`<p class="note" style="margin:8px 0 0;text-align:center">No predicted snapshot was taken for GW${xg} — snapshotting started from a later gameweek.</p>`:"")}
    </div></div>`;

  const status=`<div class="panel"><div class="phead"><h2>xFPL model</h2>
    <span class="note">data ${esc(stamp)}</span></div>
    <div class="pbody">
      <p class="note" style="margin:0 0 10px">Projections come from the FPL Core Insights dataset, then get calibrated per position. Automatic learning from results is off: position levels are re-fitted by a backtest instead, checked before anything changes (half applied 13 Oct, the full re-fit after GW10).</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${[[played,"GW finished"],["GW"+g,"projecting"],[T?T.all.mae.toFixed(2):"—","one-week MAE"],[T?(T.all.bias>0?"+":"")+T.all.bias.toFixed(2):"—","one-week bias"]]
          .map(([v,l])=>`<span style="flex:1;min-width:88px;background:var(--ink2);border:1px solid var(--ink3);border-radius:9px;padding:8px 10px;text-align:center">
            <b style="display:block;font-family:'Geist';font-size:22px;font-weight:800;color:var(--mint)">${v}</b>
            <span style="font-size:10px;color:var(--mute)">${l}</span></span>`).join("")}
      </div>
      ${T?`<p class="note" style="margin:8px 0 0">${T.all.n.toLocaleString()} player-weeks · ${T.live?T.live+" live":""}${T.live&&T.back?" + ":""}${T.back?T.back+" backtest":""} week${T.live+T.back===1?"":"s"}${overall?` · vs season average: MAE ${overall.mae.toFixed(2)}, bias ${(overall.bias>0?"+":"")+overall.bias.toFixed(2)}`:""}</p>`:""}
      ${overall||T?xfplAccuracyInfo(g,played,overall?overall.n:0,T):""}
      ${played<1?`<p class="note" style="margin:10px 0 0;color:var(--amber)">No finished gameweeks in the data yet — showing projections and the current calibration baseline. Predicted-vs-actual fills in once results land.</p>`:""}
    </div></div>`;

  const calib=`<div class="panel"><div class="phead"><h2>Calibration</h2>
    <span class="note">points = A×minutes + B×raw</span></div>
    <div class="scroll"><table><thead><tr>
      <th style="text-align:left">Position</th><th>A (floor)</th><th>Δ base</th><th>B (spread)</th><th>Δ base</th><th style="text-align:left">Learned from</th></tr></thead><tbody>
    ${[1,2,3,4].map(k=>{const c=CAL[k],b=CAL_BASE[k],L=learn[k];
      return `<tr><td style="text-align:left">${POS[k]}</td>
        <td class="mono">${c.A.toFixed(2)}</td><td class="mono">${Math.abs(c.A-b.A)<0.005?"—":arrow(c.A-b.A)}</td>
        <td class="mono">${c.B.toFixed(2)}</td><td class="mono">${Math.abs(c.B-b.B)<0.005?"—":arrow(c.B-b.B)}</td>
        <td class="note" style="text-align:left">${L?`${L.n} players · ${L.gw} GW`:"baseline (no learning yet)"}</td></tr>`;}).join("")}
    </tbody></table></div>
    ${Object.keys(learn).length&&!LEARN_APPLY
      ?`<div class="pbody" style="border-top:1px solid var(--ink3)"><p class="note" style="margin:0">Adjustments are recorded from results but not applied (decision D4, 13 Oct): levels are re-fitted by backtest at GW10 instead.</p></div>`:""}
    </div>`;

  const pva=played<1?"":`<div class="panel"><div class="phead"><h2>Predicted vs actual</h2>
    <span class="note">projection vs season average per gameweek</span></div>
    <div class="scroll"><table><thead><tr>
      <th style="text-align:left">Position</th><th>N</th><th>Predicted</th><th>Actual</th><th>MAE</th><th>Bias</th></tr></thead><tbody>
    ${[1,2,3,4].map(k=>{const s=summ(acc[k]);
      if(!s)return `<tr><td style="text-align:left">${POS[k]}</td><td colspan="5" class="note" style="text-align:left">not enough minutes yet</td></tr>`;
      const mp=acc[k].reduce((a,x)=>a+x.p,0)/s.n,ma=acc[k].reduce((a,x)=>a+x.a,0)/s.n;
      return `<tr><td style="text-align:left">${POS[k]}</td><td class="mono">${s.n}</td>
        <td class="mono">${mp.toFixed(2)}</td><td class="mono">${ma.toFixed(2)}</td>
        <td class="mono">${s.mae.toFixed(2)}</td><td class="mono">${(s.bias>0?"+":"")+s.bias.toFixed(2)}</td></tr>`;}).join("")}
    </tbody></table></div>
    <div class="pbody"><p class="note" style="margin:0">Actual is each player's points so far divided by the ${played} finished gameweek${played>1?"s":""}, so a week he missed counts as zero. It is a season average, not a one-week result, so this is not an accuracy figure (see the (i) under the tiles above). Positive bias means the model projects higher than players are returning.</p></div></div>`;

  /* F67: S.model.report is never set, so this panel only ever showed its
     waiting text. It now says why it is empty and where the figures are. */
  const movers=`<div class="panel"><div class="phead"><h2>Projection Movers and xMins Shifts</h2></div>
    <div class="pbody">
    ${rep&&rep.movers&&rep.movers.length?`<span class="note" style="color:var(--cyan)">Biggest projection movers</span>
      <div class="scroll"><table><thead><tr><th style="text-align:left">Player</th><th>Before</th><th>After</th><th>Δ</th></tr></thead><tbody>
      ${rep.movers.slice(0,12).map(m=>`<tr><td style="text-align:left">${esc(m.name)}</td><td class="mono">${(+m.before).toFixed(1)}</td><td class="mono">${(+m.after).toFixed(1)}</td><td class="mono">${arrow(m.after-m.before,true)}</td></tr>`).join("")}</tbody></table></div>`:""}
    ${rep&&rep.xminsShifts&&rep.xminsShifts.length?`<span class="note" style="color:var(--cyan);display:block;margin-top:10px">Expected-minutes shifts</span>
      <div class="scroll"><table><thead><tr><th style="text-align:left">Player</th><th>Before</th><th>After</th><th>Δ</th></tr></thead><tbody>
      ${rep.xminsShifts.slice(0,12).map(m=>`<tr><td style="text-align:left">${esc(m.name)}</td><td class="mono">${Math.round(m.before)}′</td><td class="mono">${Math.round(m.after)}′</td><td class="mono">${arrow(m.after-m.before,true)}</td></tr>`).join("")}</tbody></table></div>`:""}
    ${(!rep||((!rep.movers||!rep.movers.length)&&(!rep.xminsShifts||!rep.xminsShifts.length)))?`<p class="note" style="margin:0">Empty for now. The app does not yet keep the previous build's projections, so it has nothing to compare against and cannot list who moved. Each player's current projection and expected minutes are in Player Data, in the xFPL and xMins columns. This panel fills once the server saves a projection snapshot each gameweek; that job is not running yet.</p>`:""}
    </div></div>`;

  const foot=`<div class="panel"><div class="pbody"><p class="note" style="margin:0">Richer per-gameweek actuals — live points, bonus, minutes — come from the official FPL API, which the browser can't read directly. A scheduled job publishes them to the data repo, and the model reads them like every other file.</p></div></div>`;

  return compare+status+calib+pva+movers+foot;
}
function swapCardHTML(m,g){
  return `<div class="tcard"><div class="tline">
    ${shirtSVG(m.out.teamName.toUpperCase(),m.out.pos===1,26)}
    <span class="tp"><span class="n">${esc(m.out.web_name)}</span>
      <span class="s">${esc(m.out.teamName)} · £${m.out.price.toFixed(1)} · form ${m.out.form.toFixed(1)} · ${(m.out.gw[g]?.pts||0).toFixed(1)} xPts</span></span>
    <span class="arrow">→</span>
    ${shirtSVG(m.inn.teamName.toUpperCase(),m.inn.pos===1,26)}
    <span class="tp"><span class="n">${esc(m.inn.web_name)}</span>
      <span class="s">${esc(m.inn.teamName)} · £${m.inn.price.toFixed(1)} · ${(m.inn.gw[g]?.pts||0).toFixed(1)} xPts</span>
      <span style="display:flex;gap:5px;align-items:center;margin-top:3px">${sigHTML(m.inn,g)}</span></span>
    <span class="gain">+${m.gain.toFixed(1)}${freeLeft(g)>0?"":`<span style="display:block;font-size:10px;color:var(--red)">-${HIT} hit</span>`}</span></div>
    <span style="display:flex;gap:6px;margin-top:8px">
      <button style="flex:1" onclick="act('doswap',${m.out.id},${m.inn.id})">Make this transfer</button>
      <button onclick="act('ignore',${m.inn.id})" title="Stop suggesting this player">Ignore</button></span></div>`;
}
/* wave 8: the Transfers page retired; its tools live in the Planner's Top
   Move pop-up (several players at once, best moves by position, the
   players not being suggested). The five-week plan sits beside them, price
   moves are in Price Watch and the radar became Players > Compare. */
function transfersHTML(part){
  const g=VG();
  const outIds=S.outList.length?S.outList:null;
  const all=bestSwaps(400);
  const pool=outIds?all.filter(m=>outIds.includes(m.out.id)):all;
  /* F41: the same bank as the header (planBank: the official figure for the
     live week unless planned edits moved it), not the locally tracked S.bank,
     which read £0.0 beside the header's £0.4 */
  const budget=outIds
    ? planBank()+outIds.reduce((a,i)=>{const q=S.model.players.find(p=>p.id===i);return a+(q?sellPrice(q):0);},0)
    : planBank();
  const posName={1:"Goalkeepers",2:"Defenders",3:"Midfielders",4:"Forwards"};
  const chosen=S.outList.map(i=>S.model.players.find(p=>p.id===i)).filter(Boolean);

  const picker=`<div class="panel"><div class="phead"><h2>Plan your transfers</h2>
      <span class="note">£${budget.toFixed(1)} available</span></div>
    <div class="pbody">
      <p class="note" style="margin:0 0 8px">Tap players to sell. Recommendations use the combined budget.</p>
      ${[1,2,3,4].map(pos=>{const list=squadPlayers().filter(p=>p.pos===pos);if(!list.length)return"";
        return `<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap">
          <span style="font-size:10px;color:var(--mute);font-weight:700;width:34px">${POS[pos]}</span>
          ${list.slice().sort((a,b)=>b.price-a.price).map(p=>`<button class="chipbtn ${S.outList.includes(p.id)?"on":""}"
            onclick="act('toggleout',${p.id})">${esc(p.web_name)} £${p.price.toFixed(1)}</button>`).join("")}</div>`;}).join("")}
      ${chosen.length?`<p class="note" style="margin-top:8px">Selling ${chosen.map(p=>esc(p.web_name)).join(", ")} frees £${budget.toFixed(1)}.
        <button style="margin-left:6px" onclick="act('clearout')">Clear</button></p>`:""}
    </div></div>`;

  const combo=S.outList.length>1?bestCombo(S.outList):null;
  const comboPanel=combo&&combo.picks.length>1?`<div class="panel" style="border-color:var(--cyan)">
      <div class="phead"><h2 style="color:var(--cyan)">Best combination · ${combo.picks.map(m=>POS[m.out.pos]).join(" + ")}</h2>
        <span class="note">£${combo.freed.toFixed(1)} to spend · £${combo.left.toFixed(1)} left</span></div>
      <div class="pbody">
        ${combo.picks.map(m=>`<div class="tline" style="margin-bottom:8px">
          ${shirtSVG(m.out.teamName.toUpperCase(),m.out.pos===1,24)}
          <span class="tp"><span class="n">${esc(m.out.web_name)}</span><span class="s">£${m.out.price.toFixed(1)} · ${(m.out.gw[g]?.pts||0).toFixed(1)}</span></span>
          <span class="arrow">→</span>
          ${shirtSVG(m.inn.teamName.toUpperCase(),m.inn.pos===1,24)}
          <span class="tp"><span class="n">${esc(m.inn.web_name)}</span><span class="s">£${m.inn.price.toFixed(1)} · ${(m.inn.gw[g]?.pts||0).toFixed(1)}</span></span>
          <span class="gain">+${m.gain.toFixed(1)}</span></div>`).join("")}
        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--ink3);padding-top:9px">
          <span style="font-weight:700">Combined gain</span>
          <span class="gain" style="font-size:16px">+${combo.gain.toFixed(1)} pts</span></div>
        <button style="margin-top:9px;width:100%" onclick="act('docombo')">Make these transfers</button>
      </div></div>`:"";
  /* F95 (bundle 8): players taken off the suggestions can be put back */
  const ignoredP=(S.ignored||[]).map(id=>S.model.players.find(p=>p.id===id)).filter(Boolean);
  const ignoredPanel=ignoredP.length?`<div class="panel"><div class="phead"><h2>Not Suggesting</h2>
      <button onclick="act('unignore')">Suggest all again</button></div>
    <div class="pbody" style="display:flex;gap:8px;flex-wrap:wrap">${ignoredP.map(p=>`<button onclick="act('unignore',${p.id})" title="Suggest ${esc(p.web_name)} again">${esc(p.web_name)} ↺</button>`).join("")}</div></div>`:"";
  const suggestTitle=ignoredPanel+`<div class="panel"><div class="phead"><h2>Best Moves by Position</h2>
      <span class="note">up to four per position, each worth a transfer</span></div></div>`;
  const byPos=[1,2,3,4].filter(pos=>part!=="bypos"||!S.sigPos||pos===S.sigPos).map(pos=>{
    /* One recommendation per player being sold, not a list of near-identical
       alternatives, and only where the gain is worth a transfer. */
    const seen=new Set();
    const list=pool.filter(m=>{
      if(m.inn.pos!==pos||(S.squad||[]).includes(m.inn.id))return false;
      if(m.gain<moveBar(g))return false;
      if(seen.has(m.out.id))return false;
      seen.add(m.out.id);return true;}).slice(0,4);
    return `<div class="panel"><div class="phead"><h2>${posName[pos]}</h2>
        <span class="note">${list.length?"top "+list.length:""}</span></div>
      <div class="pbody">${list.length?`<div class="tgrid">${list.map(m=>swapCardHTML(m,g)).join("")}</div>`
        :`<p class="note" style="margin:0">Head Scout recommends no transfers in this position.</p>`}</div></div>`;
  }).join("");

  /* Signals > Transfers (25 Oct 2026) shows the parts in their own reports */
  if(part==="picker")return picker+comboPanel;
  if(part==="bypos")return byPos;
  if(part==="ignored")return ignoredPanel;
  return picker+comboPanel+suggestTitle+byPos;
}
/* S3 (Stage 1, 19 Oct 2026): the five-week plan, one card per week */
function planPanelHTML(){
  if(!S.model||VG()!==S.model.next.id)return "";        // the plan starts from the live week
  const P=planWeeks(5);if(!P)return "";
  const card=x=>x.roll
    ?`<div class="wkc roll"><div class="wkh"><span>GW${x.w}</span><span>${x.ft} FT</span></div>
        <div class="wkm"><b>Roll the transfer</b><br><span class="mu">${x.best?`Best move ${esc(x.best.out.web_name)} → ${esc(x.best.inn.web_name)} ${sgn1(x.best.gain)}, under the ${x.bar.toFixed(2)} bar`:"No move improves the XI"}</span></div></div>`
    :`<div class="wkc"><div class="wkh"><span>GW${x.w}</span><span>${x.ft} FT${x.hit?` · <span class="dn">−${x.hit}</span>`:""}</span></div>
        <div class="wkm"><span class="dn">${esc(x.out.web_name)}</span> <span class="mu">${esc(x.out.teamName)} £${sellPrice(x.out).toFixed(1)}</span><br>
        → <span class="up">${esc(x.inn.web_name)}</span> <span class="mu">${esc(x.inn.teamName)} £${x.inn.price.toFixed(1)}</span><br>
        <b class="up">${sgn1(x.gain)}</b> <span class="mu">to the XI · bank £${x.bank.toFixed(1)}</span></div>
        ${x.w===S.model.next.id?`<button style="margin-top:8px;width:100%" onclick="act('doswap',${x.out.id},${x.inn.id})">Make this move</button>`:""}</div>`;
  const first=P.weeks[0].w,last=P.weeks[P.weeks.length-1].w;
  return `<div class="panel"><div class="phead"><h2>Five-Week Plan</h2>
      <span class="note">GW${first}–${last} · ${sgn1(P.total)} net</span></div>
    <div class="pbody"><div class="wkgrid">${P.weeks.map(card).join("")}</div>
      <details class="infotip"><summary><span class="infoi" aria-hidden="true">i</span>How the plan is made</summary><div class="infobox">
        <p style="margin:0">Week by week, the best single move is scored by what it adds to your best XI and captain in each week left in the plan, later weeks counting 0.85 of the week before. A move is made only if it beats ${FT_VALUE} (what saving the transfer is worth), plus the ${HIT}-point hit when no free transfer is left; otherwise the transfer is rolled. A swap on a bench player who would not play adds nothing. Only this week's move can be made from here; later weeks show what the plan expects.</p></div></details>
    </div></div>`;
}
/* S6 (Stage 1, 19 Oct 2026): price pressure from FPL's own transfer counts */
function priceMovesHTML(){
  if(!S.model||!S.players)return "";
  const stats=new Map(S.players.map(p=>[p.id,p.stats||{}]));
  const mine=new Set(S.squad||[]);
  const rows=S.model.players.map(p=>{const s=stats.get(p.id)||{};
    return{p,net:num(s.transfers_in_event)-num(s.transfers_out_event),chg:num(s.cost_change_event)/10,mine:mine.has(p.id)};});
  const k=n=>(n>=0?"+":"−")+Math.abs(Math.round(n/1000))+"k";
  const t=(list,cell,head)=>`<table class="mkt"><thead><tr><th>Player</th><th>Price</th><th>${head}</th><th class="hide-ph">Owned</th></tr></thead><tbody>
    ${list.map(r=>`<tr${r.mine?' class="me"':""}><td>${esc(r.p.web_name)} <span class="mu">${esc(r.p.teamName)}</span></td><td>£${r.p.price.toFixed(1)}</td><td>${cell(r)}</td><td class="hide-ph">${r.p.owned}%</td></tr>`).join("")}</tbody></table>`;
  const net=r=>`<span class="${r.net>=0?"up":"dn"}">${k(r.net)}</span>`;
  const byNet=rows.slice().sort((a,b)=>b.net-a.net);
  const changed=rows.filter(r=>r.chg).sort((a,b)=>b.chg-a.chg);
  const sect=(title,body)=>`<div><div class="note" style="margin-bottom:4px">${title}</div>${body}</div>`;
  return `<div class="panel"><div class="phead"><h2>Price Moves</h2><span class="note">GW${S.model.next.id} so far</span></div>
    <div class="pbody"><div class="pmgrid">
      ${sect("Most Bought",t(byNet.slice(0,6),net,"Net"))}
      ${sect("Most Sold",t(byNet.slice(-6).reverse(),net,"Net"))}
      ${sect("Your Squad, Most Sold",t(rows.filter(r=>r.mine).sort((a,b)=>a.net-b.net).slice(0,4),net,"Net"))}
      ${changed.length?sect("Changed This Week",t([...changed.slice(0,3),...changed.slice(-3).filter(r=>r.chg<0)],r=>`<span class="${r.chg>0?"up":"dn"}">${r.chg>0?"▲":"▼"} ${Math.abs(r.chg).toFixed(1)}</span>`,"Change")):""}
    </div>
    <details class="infotip"><summary><span class="infoi" aria-hidden="true">i</span>What this shows</summary><div class="infobox">
      <p style="margin:0">Net transfers this gameweek (in minus out) from FPL's own counts, refreshed with the player data. FPL does not publish the thresholds at which prices move, so this shows the pressure rather than a guessed rise or fall time. Your players are highlighted.</p></div></details>
    </div></div>`;
}
/* ============================================================
   TEAMS (redesign 12 Nov 2026): two views, the Fixture Grid and Matches.

   Scores. Every fixture gives the club's expected goals (xG) and its chance
   of a clean sheet (CS), from the same ratings the projections use (both
   include the club's own strength: they say what the club should produce,
   not just how strong the opponent is). Overall is the FPL points those are
   worth to the club's players: 9 per goal, 31 per clean sheet, the values
   fitted to GW1-10 club points (backtest 12 Nov 2026: 0.41 rank correlation
   with the next week's club points, 0.53 over three weeks, against 0.31 and
   0.48 for the old averaged bands; goal difference and half-and-half tied).
   A window's score is the total over its gameweeks divided by the number of
   gameweeks, so a double counts twice and a blank counts zero.
   ============================================================ */
const TG_GOAL=9, TG_CS=31;
function tgOne(t,opp,home){const gf=fdrCalc(t,opp,home,"xgf"),gc=fdrCalc(t,opp,home,"xgc"),cs=Math.exp(-gc);
  return{gf,gc,cs,pts:TG_GOAL*gf+TG_CS*cs};}
/* Overall fixture colour: where the points sit among the season's 760
   fixture-sides, with the attack mix (6% red, 15% darkest green) */
let _tgCuts=null;
function tgCuts(){
  if(_tgCuts&&_tgCuts.k===S.bandCuts)return _tgCuts.v;
  const T=S.teams||[],all=[];
  T.forEach(t=>T.forEach(o=>{if(t!==o){all.push(tgOne(t,o,true).pts);all.push(tgOne(t,o,false).pts);}}));
  all.sort((a,b)=>a-b);let acc=0;const v=[];
  for(let i=0;i<4;i++){acc+=BAND_MIX_ATT[i];v.push(all[Math.min(all.length-1,Math.floor(acc*all.length))]);}
  _tgCuts={k:S.bandCuts,v};return v;
}
function tgBand(t,x,lens){
  if(lens==="att")return fdrOf(x.opp,x.home,t,"att");
  if(lens==="def")return fdrOf(x.opp,x.home,t,"def");
  const c=tgCuts(),p=tgOne(t,x.opp,x.home).pts;
  for(let i=0;i<4;i++)if(p<c[i])return 5-i;
  return 1;
}
const tgFx=(t,e)=>((S.model&&S.model.byEv[e])||[]).filter(f=>f.ht===t||f.at===t).map(f=>({f,opp:f.ht===t?f.at:f.ht,home:f.ht===t}));
function tgScore(t,a,b){let gf=0,cs=0,pts=0;
  for(let e=a;e<=b;e++)tgFx(t,e).forEach(x=>{const v=tgOne(t,x.opp,x.home);gf+=v.gf;cs+=v.cs;pts+=v.pts;});
  const n=Math.max(1,b-a+1);return{gf:gf/n,cs:cs/n,pts:pts/n};}
/* results so far, from the fixtures the app already loads */
const tgPlayed=()=>(S.fixtures||[]).filter(f=>f.ht&&f.at&&f.hs!=null&&f.as!=null&&f.finished!==false);
function tgResults(t,n){
  return tgPlayed().filter(f=>f.ht===t||f.at===t).sort((a,b)=>a.event-b.event||String(a.kickoff).localeCompare(String(b.kickoff))).slice(-(n||5))
    .map(f=>{const h=f.ht===t,us=h?f.hs:f.as,th=h?f.as:f.hs;
      return{r:us>th?"W":us<th?"L":"D",us,th,opp:h?f.at:f.ht,h,e:f.event,f};});
}
/* the Premier League table: points, goal difference, goals scored */
function tgTable(){
  const tb={};(S.model.teams||[]).forEach(t=>tb[t.id]={t,p:0,gf:0,ga:0,cs:0,n:0});
  tgPlayed().forEach(f=>{const H=tb[f.ht.id],A=tb[f.at.id];if(!H||!A)return;
    H.n++;A.n++;H.gf+=f.hs;H.ga+=f.as;A.gf+=f.as;A.ga+=f.hs;if(!f.as)H.cs++;if(!f.hs)A.cs++;
    if(f.hs>f.as)H.p+=3;else if(f.hs<f.as)A.p+=3;else{H.p++;A.p++;}});
  const list=Object.values(tb).sort((a,b)=>b.p-a.p||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf);
  list.forEach((x,i)=>x.pos=i+1);
  return tb;
}
/* a W/D/L tile that shows the match and the score on hover or focus */
function tgForm(list){
  return `<span class="tg-form">${list.map(x=>{const f=x.f,line=`${f.ht.name} ${f.hs}–${f.as} ${f.at.name}`;
    return `<i class="${x.r}" tabindex="0" data-tt="GW${x.e} · ${x.h?"Home":"Away"} · ${{W:"Won",D:"Drew",L:"Lost"}[x.r]}&#10;${esc(line)}" aria-label="GW${x.e}: ${esc(line)}">${x.r}</i>`;}).join("")}</span>`;
}
const tgWin=()=>[1,3,5,"ros"].includes(S.tWin)?S.tWin:1;
const tgLens=()=>["att","def","all"].includes(S.tLens)?S.tLens:"all";
const TG_KEY={att:"gf",def:"cs",all:"pts"};
const tgFmt=(k,v)=>k==="cs"?Math.round(v*100)+"%":k==="gf"?v.toFixed(2):v.toFixed(1);
function tgRate(t,opp,home){
  return ["att","def","all"].map(k=>{const d=tgBand(t,{opp,home},k),[b,c]=pdFdr(d);
    return `<span class="tg-rt"><span>${{att:"Att",def:"Def",all:"All"}[k]}</span><i style="background:${b};color:${c}">${d}</i></span>`;}).join("");
}
/* the market for a fixture (next gameweek only), margin removed */
function tgMarket(h,a){
  const m=(typeof oddsFixtures==="function"&&S.oddsState==="ok"?oddsFixtures():[]).find(x=>x.ht&&x.at&&x.ht.id===h.id&&x.at.id===a.id);
  if(!m)return null;
  let hda=null;const ml=(m.mk&&m.mk["h2h"]||[])[0];
  if(ml){const H=ml.outcomes.find(x=>x.name==="home"),D=ml.outcomes.find(x=>x.name==="draw"),A=ml.outcomes.find(x=>x.name==="away");
    if(H&&D&&A)hda=devig([H.price,D.price,A.price]);}
  return{hda,gl:m.goals||null};
}
/* the model's own home / draw / away, from the two expected-goal figures */
function tgModelHda(lh,la){
  const pois=(l,k)=>{let p=Math.exp(-l);for(let i=1;i<=k;i++)p*=l/i;return p;};
  let H=0,D=0,A=0;
  for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){const p=pois(lh,i)*pois(la,j);if(i>j)H+=p;else if(i<j)A+=p;else D+=p;}
  const s=H+D+A;return[H/s,D/s,A/s];
}

function fixturesHTML(){
  const m=["matches","gw","odds"].includes(S.fixMode)?"matches":"grid";
  const head=`<div class="tg-top"><h1>Teams</h1><span class="tg-views">${[["grid","Fixture Grid"],["matches","Matches"]].map(([k,n])=>
    `<button class="${m===k?"on":""}" onclick="act('fixmode','${k}')" aria-pressed="${m===k}">${n}</button>`).join("")}</span></div>`;
  return head+(m==="grid"?teamGridHTML():matchesHTML());
}

function teamGridHTML(){
  const g=S.model.next.id,T=S.model.teams,lens=tgLens(),win=tgWin();
  const g2=win==="ros"?38:Math.min(38,g+win-1),nW=g2-g+1;
  const winLbl=win===1?"GW"+g:win==="ros"?"ROS":win+" GW";
  const tb=tgTable();
  const rows=T.map(t=>({t,pos:tb[t.id].pos,gf:tb[t.id].gf,ga:tb[t.id].ga,w:tgScore(t,g,g2),form:tgResults(t,5)}));
  /* sort: the colour lens's score by default; any column header re-sorts */
  const SK={pos:r=>-r.pos,gf:r=>r.gf,ga:r=>r.ga,att:r=>r.w.gf,def:r=>r.w.cs,all:r=>r.w.pts};
  const sk=SK[S.tSort]?S.tSort:lens,dir=SK[S.tSort]?(S.tDir==="asc"?1:-1):-1;
  rows.sort((a,b)=>dir*(SK[sk](a)-SK[sk](b))||a.pos-b.pos);
  const seg=(cur,list,action)=>`<span class="hz">${list.map(([k,n])=>`<button class="${String(cur)===String(k)?"on":""}" onclick="act('${action}','${k}')">${n}</button>`).join("")}</span>`;
  const key=`<span class="tg-key"><span>Easy</span>${[1,2,3,4,5].map(d=>{const[b,c]=pdFdr(d);return `<i style="background:${b};color:${c}">${d}</i>`;}).join("")}<span>Hard</span></span>`;
  const card=`<div class="pdcard"><div class="pdbar">
    <div class="pdctl"><span class="pdl">Colour fixtures by</span>${seg(lens,[["att","Attack"],["def","Defence"],["all","Overall"]],"tlens")}</div>
    <div class="pdctl"><span class="pdl">Scores for</span>${seg(win,[[1,"Next GW"],[3,"3 GW"],[5,"5 GW"],["ros","ROS"]],"twin")}</div>
    <span class="pdsp"></span><div class="pdctl"><span class="pdl">Fixture rating</span>${key}</div></div></div>`;
  const arrow=k=>sk===k?(dir<0?" ↓":" ↑"):"";
  const sth=(k,n,sub,cls,tip)=>`<th class="${cls||""}${sk===k?" act":""}" onclick="act('tsort','${k}')" title="${esc(tip)}">${n}${arrow(k)}${sub?`<small>${sub}</small>`:""}</th>`;
  let th=`<th class="tg-club">Club</th>${sth("pos","Pos","","r","League position")}${sth("gf","Scored","","r","Goals scored this season")}${sth("ga","Conc.","","r","Goals conceded this season")}<th class="tg-gap">Form</th>
    ${sth("att","Attack","xG / GW","tg-s","Expected goals per gameweek over "+winLbl)}${sth("def","Defence","clean sheet","tg-s","Average chance of a clean sheet over "+winLbl)}${sth("all","Overall","pts / GW","tg-s tg-gap","FPL points from goals and clean sheets per gameweek over "+winLbl+" (9 a goal, 31 a clean sheet)")}`;
  for(let e=g;e<=38;e++)th+=`<th class="tg-gw${e<=g2?" in":""}">GW${e}</th>`;
  const ncol=8+(38-g+1);
  const body=rows.map(r=>{
    let cells="";
    for(let e=g;e<=38;e++){const xs=tgFx(r.t,e);
      cells+=`<td class="tg-gw${e<=g2?" in":""}">${xs.length?xs.map(x=>{const d=tgBand(r.t,x,lens),[b,c]=pdFdr(d);
        return `<span class="tg-fx${x.home?"":" aw"}" style="background:${b};color:${c}" onclick="act('tmatch',${e})" title="GW${e}: ${esc(x.opp.name)} ${x.home?"(home)":"(away)"} · ${d}">${esc(x.opp.short)}</span>`;}).join("")
        :'<span class="tg-fx bl" title="No match this gameweek">—</span>'}</td>`;}
    const open=S.tOpen===r.t.short;
    const num=k=>`<td class="tg-n${sk===k?" act":""}${k==="all"?" tg-gap":""}">${tgFmt(TG_KEY[k],r.w[TG_KEY[k]])}</td>`;
    let tr=`<tr class="tg-r${open?" open":""}" data-club="${r.t.short}">
      <td class="tg-club"><button class="tg-cb" onclick="act('topen','${r.t.short}')" aria-expanded="${open}">${badgeOrShirt(r.t,22)}<b>${esc(r.t.name||r.t.short)}</b><span class="tg-car" aria-hidden="true">${open?"▾":"▸"}</span></button></td>
      <td class="r mono">${r.pos}</td><td class="r mono" data-k="gf">${r.gf}</td><td class="r mono" data-k="ga">${r.ga}</td><td class="tg-gap">${tgForm(r.form)}</td>
      ${num("att")}${num("def")}${num("all")}${cells}</tr>`;
    if(open)tr+=`<tr class="tg-drawer"><td colspan="${ncol}">${tgDrawer(r.t,tb[r.t.id],g,nW,winLbl)}</td></tr>`;
    return tr;}).join("");
  return card+tgTargetsHTML()+`<div class="tg-panel"><div class="tg-scroll"><table class="tg-t"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>
    <div class="tg-foot">Click a club for its detail · click a fixture for the match · away fixtures in italics · faded gameweeks are outside the window
      <details class="infotip"><summary><span class="infoi" aria-hidden="true">i</span>How the scores work</summary><div class="infobox">
      <p style="margin:0 0 6px">Attack is the goals the club is expected to score, Defence its chance of a clean sheet, from the same team ratings the projections use. Both include the club's own strength, so they say what the club should produce, not only how hard the opponent is.</p>
      <p style="margin:0">Overall is what those are worth in FPL points to the club's players: 9 for each goal and 31 for each clean sheet, the values that fitted this season's club points. A window's score is per gameweek: a double gameweek counts twice and a blank counts zero.</p></div></details></div></div>`;
}
function tgDrawer(t,row,g,nW,winLbl){
  const f=teamForm()[t.short]||{},dg=(dcGiven()[t.short]||{}).per,nx=tgFx(t,g)[0];
  const top=a=>S.model.players.filter(p=>p.team===t.id&&p.avail>0&&(a?p.pos>=3:p.pos<=2)).sort((x,y)=>hPts(y,g,nW)-hPts(x,g,nW)).slice(0,3)
    .map(p=>`<div class="tg-li"><button class="pn" onclick="act('card',${p.id})">${esc(p.web_name)}</button><b>${hPts(p,g,nW).toFixed(1)}</b></div>`).join("")||'<div class="tg-li mu">No one available</div>';
  const trend=(now,s,up)=>now==null||s==null?"":`<small class="${(now>s)===up?"up":"dn"}">${now>s?"▲":"▼"} ${now.toFixed(2)} last 4</small>`;
  const big=(v,l,sub)=>`<div class="tg-big"><b>${v}</b><span>${l}</span>${sub||""}</div>`;
  const res=tgResults(t,5).reverse();
  let next='<p class="mu" style="margin:0">No match next gameweek.</p>';
  if(nx){const d=nx.f.kickoff?new Date(nx.f.kickoff):null,mk=nx.home?tgMarket(t,nx.opp):tgMarket(nx.opp,t),side=nx.home?0:2;
    next=`<div class="tg-nm">${badgeOrShirt(nx.opp,28)}<div><b>${nx.home?"v":"at"} ${esc(nx.opp.name)}</b><span>${d?esc(ukFmt(d,{weekday:"short",day:"numeric",month:"short"})+" · "+ukHHMM(d)):""}</span></div></div>
      <div class="tg-rts">${tgRate(t,nx.opp,nx.home)}</div>
      ${mk&&mk.hda?`<div class="tg-li"><span>Win · draw · lose</span><b>${Math.round(mk.hda[side]*100)}% · ${Math.round(mk.hda[1]*100)}% · ${Math.round(mk.hda[2-side]*100)}%</b></div>`:""}
      ${mk&&mk.gl?`<div class="tg-li"><span>Goals, market</span><b>${(nx.home?mk.gl.xgHome:mk.gl.xgAway).toFixed(1)}</b></div><div class="tg-li"><span>Clean sheet, market</span><b>${Math.round((nx.home?mk.gl.csHome:mk.gl.csAway)*100)}%</b></div>`
        :`<div class="tg-li"><span>Goals, model</span><b>${fdrCalc(t,nx.opp,nx.home,"xgf").toFixed(1)}</b></div><div class="tg-li"><span>Clean sheet, model</span><b>${Math.round(Math.exp(-fdrCalc(t,nx.opp,nx.home,"xgc"))*100)}%</b></div>`}`;}
  return `<div class="tg-dr">
    <section><h4>Recent results</h4>${res.map(x=>`<div class="tg-li"><span class="tg-res ${x.r}">${x.r}</span><span class="tg-op">${badgeOrShirt(x.opp,16)}${esc(x.opp.name)} <em>${x.h?"H":"A"} · GW${x.e}</em></span><b>${x.us}–${x.th}</b></div>`).join("")||'<div class="tg-li mu">No results yet</div>'}
      <div class="tg-li tg-sum"><span>${ordinalN(row.pos)} · ${row.p} pts</span><span>${row.cs} clean sheet${row.cs===1?"":"s"}</span></div></section>
    <section><h4>Attack</h4><div class="tg-bigs">${big(f.xg!=null?f.xg.toFixed(2):"—","xG / match",trend(f.xg4,f.xg,true))}${big(String(row.gf),"goals scored","")}</div>
      <h5>Top attackers · ${winLbl} pts</h5>${top(true)}</section>
    <section><h4>Defence</h4><div class="tg-bigs">${big(f.xga!=null?f.xga.toFixed(2):"—","xGA / match",trend(f.xga4,f.xga,false))}${big(dg==null?"—":dg.toFixed(1),"DefCon given","<small>opponents per match</small>")}</div>
      <h5>Top defenders · ${winLbl} pts</h5>${top(false)}</section>
    <section><h4>Next match</h4>${next}</section></div>`;
}
/* Teams to target (12 Nov 2026): four compact cards (the Planner's This
   Week card) over the grid's window; each opens the top ten in a pop-up.
   Best = the club's own numbers; "to target" turns it round: the clubs to
   buy from are the ones that face it. */
const TG_TARGETS={
  tgBestAtt:{title:"Best Attacks",icon:"flame",tone:"#3DDC97",k:"gf",dir:1,unit:"xG / GW",f:r=>r.gf.toFixed(2),mode:"own-att",
    why:"Most expected goals per gameweek: attackers to own."},
  tgTgtAtt:{title:"Attacks to Target",icon:"shield-check",tone:"#22D3EE",k:"gf",dir:-1,unit:"xG / GW",f:r=>r.gf.toFixed(2),mode:"vs-att",
    why:"Fewest expected goals per gameweek: own the defenders and keepers who face them."},
  tgBestDef:{title:"Best Defences",icon:"shield",tone:"#22D3EE",k:"cs",dir:1,unit:"clean sheet",f:r=>Math.round(r.cs*100)+"%",mode:"own-def",
    why:"Best clean-sheet chance per gameweek: defenders and keepers to own."},
  tgTgtDef:{title:"Defences to Target",icon:"target",tone:"#3DDC97",k:"gc",dir:1,unit:"xGA / GW",f:r=>r.gc.toFixed(2),mode:"vs-def",
    why:"Most expected goals conceded per gameweek: own the attackers who face them."}
};
function tgTargetRows(){
  const g=S.model.next.id,win=tgWin(),g2=win==="ros"?38:Math.min(38,g+win-1),n=g2-g+1;
  const rows=S.model.teams.map(t=>{let gf=0,gc=0,cs=0;const fx=[];
    for(let e=g;e<=g2;e++)tgFx(t,e).forEach(x=>{const v=tgOne(t,x.opp,x.home);gf+=v.gf;gc+=v.gc;cs+=v.cs;fx.push({e,...x});});
    return{t,gf:gf/n,gc:gc/n,cs:cs/n,fx};});
  return{g,g2,win,rows};
}
const tgRanked=(rows,d)=>rows.slice().sort((a,b)=>d.dir*(b[d.k]-a[d.k])||String(a.t.name).localeCompare(b.t.name));
const tgOpps=r=>[...new Set(r.fx.slice(0,3).map(x=>x.opp.short))].join(" · ");
function tgTargetsHTML(){
  const{win,rows}=tgTargetRows(),wl=win===1?"Next GW":win==="ros"?"ROS":win+" GW";
  return `<div class="wkrow tg-row4">${Object.entries(TG_TARGETS).map(([key,d])=>{const L=tgRanked(rows,d),a=L[0];
    const line=d.mode.startsWith("vs")?`Own ${d.mode==="vs-att"?"defenders":"attackers"} of <b>${esc(tgOpps(a))||"no one"}</b>`
      :`${esc(L[1].t.name)} ${d.f(L[1])} · ${esc(L[2].t.name)} ${d.f(L[2])}`;
    return `<button class="wk" onclick="act('pop','${key}')" aria-haspopup="dialog">
      <span class="wkh"><span class="tile" style="--tc:${d.tone}">${lic(d.icon)}</span><span class="wkt">${d.title} · ${wl}</span><span class="chev">${lic("chevron-right",16)}</span></span>
      <span class="wkf">${esc(a.t.name)} <span class="tgx">${d.f(a)}</span></span><span class="wkl">${line}</span></button>`;}).join("")}</div>`;
}
function tgTargetPopHTML(key){
  const d=TG_TARGETS[key];if(!d)return "";
  const{g,g2,win,rows}=tgTargetRows(),L=tgRanked(rows,d).slice(0,10),vs=d.mode.startsWith("vs");
  const chips=r=>r.fx.slice(0,6).map(x=>{
    const band=d.mode==="own-att"?tgBand(r.t,x,"att"):d.mode==="own-def"?tgBand(r.t,x,"def")
      :tgBand(x.opp,{opp:r.t,home:!x.home},d.mode==="vs-att"?"def":"att");
    const[b,c]=pdFdr(band),home=vs?!x.home:x.home;
    return `<i class="${home?"":"aw"}" style="background:${b};color:${c}" title="GW${x.e}: ${esc(vs?x.opp.name+(home?" at home to ":" away at ")+r.t.name:(home?"v ":"at ")+x.opp.name)}">${esc(x.opp.short)}</i>`;}).join("")+(r.fx.length>6?`<em>+${r.fx.length-6}</em>`:"");
  const ctl=`<span class="hz">${[[1,"Next GW"],[3,"3 GW"],[5,"5 GW"],["ros","ROS"]].map(([k,n])=>`<button class="${String(win)===String(k)?"on":""}" onclick="act('twin','${k}')">${n}</button>`).join("")}</span>`;
  const body=`<p class="note" style="margin:0 0 10px">${d.why} ${vs?"Fixtures show the clubs that face them, coloured for those clubs' players.":"Fixtures are their own, coloured for their players."}</p>
    <table class="tg-pt"><thead><tr><th></th><th class="l">Club</th><th>${d.unit}</th><th class="l">${vs?"Faced by":"Fixtures"}</th></tr></thead><tbody>
    ${L.map((r,i)=>`<tr><td class="mu">${i+1}</td><td><span class="tg-pc">${badgeOrShirt(r.t,20)}<b>${esc(r.t.name)}</b></span></td><td class="tg-pn">${d.f(r)}</td><td><span class="tg-ch">${chips(r)||'<span class="mu">no match</span>'}</span></td></tr>`).join("")}</tbody></table>`;
  return modalHTML(`${d.title} · ${g===g2?"GW"+g:`GW${g}–${g2}`}`,body,{ctl});
}
const ordinalN=n=>{const s=["th","st","nd","rd"],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);};

/* Matches: the official site's layout, one match per row, grouped by day,
   badges either side of the kick-off, stats underneath, TV channel at the
   side (Irish listings, pushed weekly from Andy's PC to /api/tv) */
function matchesHTML(){
  const g0=S.model.next.id,g=clamp(+S.mGw||g0,1,38);
  const ms=(S.model.byEv[g]||[]).slice().sort((a,b)=>String(a.kickoff).localeCompare(String(b.kickoff)));
  const ev=(S.events||[]).find(x=>x.id===g);
  const dlIso=(g===g0&&S.status&&S.status.fpl&&S.status.fpl.nextDeadline)?S.status.fpl.nextDeadline:(ev&&ev.deadline?ev.deadline:null);
  const day=f=>f.kickoff?ukFmt(new Date(f.kickoff),{weekday:"short",day:"numeric",month:"short"}):"Date to be confirmed";
  const days=[];ms.forEach(f=>{const d=day(f);let b=days.find(x=>x.d===d);if(!b)days.push(b={d,ms:[]});b.ms.push(f);});
  const tvs=(S.tv&&S.tv.matches)||[];
  const pct=v=>Math.round(v*100)+"%";
  const bar=(hda,model)=>`<span class="tg-bar${model?" model":""}" title="${model?"Model":"Market"}: home ${pct(hda[0])}, draw ${pct(hda[1])}, away ${pct(hda[2])}"><i class="h" style="flex:${hda[0]}">${pct(hda[0])}</i><i class="d" style="flex:${hda[1]}">${pct(hda[1])}</i><i class="a" style="flex:${hda[2]}">${pct(hda[2])}</i></span>`;
  let anyMk=false;
  const row=f=>{const h=f.ht,a=f.at;if(!h||!a)return "";
    const d=f.kickoff?new Date(f.kickoff):null,mk=g===g0?tgMarket(h,a):null;if(mk)anyMk=true;
    const mH=fdrCalc(h,a,true,"xgf"),mA=fdrCalc(a,h,false,"xgf"),cH=Math.exp(-fdrCalc(h,a,true,"xgc")),cA=Math.exp(-fdrCalc(a,h,false,"xgc"));
    const done=f.hs!=null&&f.as!=null&&f.finished!==false;
    const tm=tvs.find(m=>m.gw===g&&m.home&&m.away&&m.home.abbr===h.short&&m.away.abbr===a.short);
    const tv=(tm?tm.channels:[]).map(c=>`<span class="tg-tv" title="${esc(c.name)}"><img src="/img/tv/${esc(c.abbr)}.png" alt="${esc(c.name)}" loading="lazy" onerror="this.parentNode.textContent='${esc(c.name).replace(/'/g,"")}'"></span>`).join("");
    const goals=mk&&mk.gl?`<b>${mk.gl.xgHome.toFixed(1)} – ${mk.gl.xgAway.toFixed(1)}</b> <small>model ${mH.toFixed(1)} – ${mA.toFixed(1)}</small>`:`<b>${mH.toFixed(1)} – ${mA.toFixed(1)}</b> <small>model</small>`;
    const cs=mk&&mk.gl?`<b>${pct(mk.gl.csHome)} · ${pct(mk.gl.csAway)}</b> <small>model ${pct(cH)} · ${pct(cA)}</small>`:`<b>${pct(cH)} · ${pct(cA)}</b> <small>model</small>`;
    return `<div class="tg-m">
      <div class="tg-mrow"><span class="tg-hn">${esc(h.name)}</span>${badgeOrShirt(h,34)}<span class="tg-kb${done?" ft":""}">${done?`${f.hs} – ${f.as}`:d?esc(ukHHMM(d)):"TBC"}</span>${badgeOrShirt(a,34)}<span class="tg-an">${esc(a.name)}</span></div>
      ${tv?`<div class="tg-tvc">${tv}</div>`:""}
      <div class="tg-mst">
        <div class="tg-sd h">${tgForm(tgResults(h,5))}<span class="tg-rts">${tgRate(h,a,true)}</span></div>
        <div class="tg-ctr">${mk&&mk.hda?bar(mk.hda):bar(tgModelHda(mH,mA),true)}
          <div class="tg-kv"><span>Goals ${goals}</span><span>Clean sheet ${cs}</span></div></div>
        <div class="tg-sd a">${tgForm(tgResults(a,5))}<span class="tg-rts">${tgRate(a,h,false)}</span></div>
      </div></div>`;};
  const body=days.map(d=>`<h3 class="tg-day">${esc(d.d)}</h3>${d.ms.map(row).join("")}`).join("");
  const first=ms[0]?day(ms[0]):"",last=ms.length?day(ms[ms.length-1]):"";
  return `<div class="tg-mp"><div class="tg-step"><button onclick="act('mgw',${g-1})" ${g<=1?"disabled":""} aria-label="Earlier gameweek">‹</button>
      <div><b>Gameweek ${g}${g===g0?" · next":""}</b><span>${esc(first)}${last&&last!==first?" – "+esc(last):""}</span>${dlIso?`<em>Deadline ${esc(ukDeadline(dlIso))}</em>`:""}</div>
      <button onclick="act('mgw',${g+1})" ${g>=38?"disabled":""} aria-label="Later gameweek">›</button></div>
    <div class="tg-legend"><span>Result <i class="h"></i>home <i class="d"></i>draw <i class="a"></i>away</span><span>${anyMk?"Market odds, the model in grey":"The model's figures; bookmaker prices arrive for the next gameweek"}</span><span>Att · Def · All: fixture rating, 1 easy to 5 hard</span>${tvs.length?"":"<span>TV channels not loaded</span>"}</div>
    ${body||'<p class="note" style="text-align:center;padding:20px">No matches this gameweek.</p>'}</div>`;
}

const FORMS=[[3,4,3],[3,5,2],[4,4,2],[4,3,3],[4,5,1],[5,3,2],[5,4,1],[5,2,3]];
const _sqCache={};
/* ---------- Free Hit and Wildcard: the optimiser ----------
   Both chips are solved as a 0/1 integer programme (javascript-lp-solver):
   maximise the projected points of a legal XI plus captain from a 15-man
   squad inside the budget, three per club, any formation (or the one the
   user picked). The Free Hit scores one week; the Wildcard scores the
   five-week average, and its bench counts at the chance a bench player comes
   on (keeper 0.12, outfielders 0.38, the D17 rates averaged) so it buys a
   playable bench. Free Hit benches count nothing, as before.
   D18 (13 Oct 2026): a filtered pool (top 32 and cheapest 10 per position)
   answers at once and is labelled "best found"; the full pool is then solved
   in the background (about 2 s) and, if it finishes inside its time limit,
   replaces it as "proven optimal". Results are cached until the model is
   rebuilt (F76). buildSquad() below is the fallback if the solver fails. */
const OPT_TIMEOUT={fast:4000,full:15000};
/* bench weights shared by the solver and the comparison with your own team */
const BENCH_W={wildcard:{1:0.12,2:0.38,3:0.38,4:0.38},freehit:{1:0,2:0,3:0,4:0}};
const benchPart=(kind,bench,val)=>bench.reduce((a,p)=>a+BENCH_W[kind][p.pos]*val(p),0);
const _optPending={};
/* wave 2: opt {weeks, locks, bans} lets the Compare pop-up pick the horizon,
   keep players in (locks) and rule players out (bans) */
const optKey=opt=>opt?"|"+(opt.weeks||"")+"|"+(opt.locks||[]).join(".")+"|"+(opt.bans||[]).join("."):"";
function buildOptimal(kind,gw,budget,full,form,opt){
  if(typeof solver==="undefined"||!solver.Solve)return null;   // library failed to load — fall back
  const key="opt|"+kind+"|"+gw+"|"+(form||"")+"|"+budget.toFixed(1)+"|"+(full?"full":"fast")+optKey(opt);
  if(_sqCache[key]!==undefined)return _sqCache[key];
  opt=opt||{};const locks=opt.locks||[],bans=opt.bans||[];
  const weeks=opt.weeks||(kind==="wildcard"?5:1);
  const val=p=>{let t=0;for(let e=gw;e<gw+weeks&&e<=38;e++)t+=(p.gw[e]?.pts||0);return t/weeks;};
  const benchW=BENCH_W[kind];
  /* F37: available players count even at zero points (a blank or cheap
     enabler can still fill a bench) */
  const pool=S.model.players.filter(p=>(p.avail>0||locks.includes(p.id))&&p.gw[gw]&&!p.gw[gw].blank&&!bans.includes(p.id));
  if(pool.length<30)return null;
  const byPos={1:[],2:[],3:[],4:[]};
  pool.forEach(p=>byPos[p.pos]&&byPos[p.pos].push(p));
  let cand=pool;
  if(!full){
    cand=[];
    Object.values(byPos).forEach(list=>{
      const byValue=list.slice().sort((a,b)=>val(b)-val(a)).slice(0,32);
      const byCheap=list.slice().sort((a,b)=>a.price-b.price).slice(0,10);
      const seen=new Set();
      [...byValue,...byCheap].forEach(p=>{if(!seen.has(p.id)){seen.add(p.id);cand.push(p);}});
    });
    locks.forEach(id=>{const p=pool.find(q=>q.id===id);if(p&&!cand.includes(p))cand.push(p);});
  }
  if(locks.some(id=>!cand.find(p=>p.id===id))){_sqCache[key]=null;return null;}
  const vars={};
  const constraints={squad_total:{equal:15},squad_gk:{equal:2},squad_def:{equal:5},
    squad_mid:{equal:5},squad_fwd:{equal:3},xi_total:{equal:11},xi_gk:{equal:1},
    xi_def:{min:3,max:5},xi_fwd:{min:1,max:3},captain_total:{equal:1},budget:{max:budget}};
  if(form){const [d,,f]=form.split("-").map(Number);constraints.xi_def={equal:d};constraints.xi_fwd={equal:f};}
  const posKey={1:"gk",2:"def",3:"mid",4:"fwd"};
  new Set(cand.map(p=>p.team)).forEach(c=>constraints["club_"+c]={max:3});
  cand.forEach(p=>{
    const pk=posKey[p.pos],v=val(p),w=benchW[p.pos];
    vars["x_"+p.id]={squad_total:1,["squad_"+pk]:1,budget:p.price,["club_"+p.team]:1,["link_"+p.id]:-1,profit:w*v-1e-4*p.price};
    vars["y_"+p.id]={xi_total:1,xi_gk:p.pos===1?1:0,xi_def:p.pos===2?1:0,xi_fwd:p.pos===4?1:0,
      ["link_"+p.id]:1,["captainlink_"+p.id]:-1,profit:(1-w)*v};
    vars["c_"+p.id]={captain_total:1,["captainlink_"+p.id]:1,profit:v};
    constraints["link_"+p.id]={max:0};constraints["captainlink_"+p.id]={max:0};
    if(locks.includes(p.id)){vars["x_"+p.id]["lock_"+p.id]=1;constraints["lock_"+p.id]={equal:1};}
  });
  const timeout=full?OPT_TIMEOUT.full:OPT_TIMEOUT.fast;
  const model={optimize:"profit",opType:"max",constraints,variables:vars,
    binaries:Object.fromEntries(Object.keys(vars).map(k=>[k,1])),timeout};
  const t0=Date.now();
  let result;
  try{result=solver.Solve(model);}catch(e){result=null;}
  const ms=Date.now()-t0;
  if(!result||!result.feasible){_sqCache[key]=null;return null;}
  const xi=[],bench=[];let cap=null;
  cand.forEach(p=>{
    if(result["x_"+p.id]===1){
      if(result["y_"+p.id]===1)xi.push(p);else bench.push(p);
      if(result["c_"+p.id]===1)cap=p;
    }
  });
  /* Defensive validation — never trust a solver result blindly. Anything off
     falls back to the heuristic rather than risk showing an illegal team. */
  const xiPos={1:0,2:0,3:0,4:0};xi.forEach(p=>xiPos[p.pos]++);
  const clubCount={};[...xi,...bench].forEach(p=>{clubCount[p.team]=(clubCount[p.team]||0)+1;});
  const legal=xi.length===11&&bench.length===4&&cap&&xi.includes(cap)&&xiPos[1]===1&&xiPos[2]>=3&&xiPos[2]<=5
    &&xiPos[4]>=1&&xiPos[4]<=3&&Object.values(clubCount).every(n=>n<=3)
    &&([...xi,...bench].reduce((s,p)=>s+p.price,0))<=budget+0.001;
  if(!legal){_sqCache[key]=null;return null;}
  const rank=(a,b)=>(val(b)-val(a))||(b.owned-a.owned);
  const spend=xi.concat(bench).reduce((a,p)=>a+p.price,0);
  const bspend=bench.reduce((a,p)=>a+p.price,0);
  /* bench in the order it would come on: keeper first, then best outfielder */
  const benchOrdered=[...bench.filter(p=>p.pos===1),...bench.filter(p=>p.pos!==1).sort(rank)];
  const out={xi:xi.slice().sort(rank),bench:benchOrdered,cap,total:xi.reduce((a,p)=>a+val(p),0)+val(cap)+benchPart(kind,bench,val),
    shape:`${xiPos[2]}-${xiPos[3]}-${xiPos[4]}`,value:+spend.toFixed(1),
    benchValue:+bspend.toFixed(1),weeks,val,full:!!full,proven:!!full&&ms<timeout*0.95};
  _sqCache[key]=out;
  return out;
}
/* The answer to show now: the full-pool result when it exists, else the fast
   one, with the full solve queued in the background. */
function optimalSquad(kind,gw,budget,form,opt){
  const fullKey="opt|"+kind+"|"+gw+"|"+(form||"")+"|"+budget.toFixed(1)+"|full"+optKey(opt);
  if(_sqCache[fullKey])return _sqCache[fullKey];
  const fast=buildOptimal(kind,gw,budget,false,form,opt);
  if(_sqCache[fullKey]===undefined&&!_optPending[fullKey]){
    _optPending[fullKey]=1;
    setTimeout(()=>{try{buildOptimal(kind,gw,budget,true,form,opt);}finally{delete _optPending[fullKey];}
      if(S.tab==="chips"||S.cmp)render();},60);
  }
  return fast?Object.assign({},fast,{checking:!!_optPending[fullKey]}):null;
}
function buildSquad(kind,gw,form,budget){
  const key=kind+"|"+gw+"|"+(form||"auto")+"|"+budget.toFixed(1)+"|"+(S.model?S.model.players.length:0);
  if(_sqCache[key])return _sqCache[key];
  const weeks=kind==="wildcard"?5:1;
  const val=p=>{let t=0;for(let e=gw;e<gw+weeks&&e<=38;e++)t+=(p.gw[e]?.pts||0);return t/weeks;};
  const pool=S.model.players.filter(p=>p.avail>0&&p.gw[gw]&&!p.gw[gw].blank&&val(p)>0);
  if(pool.length<30)return null;
  const by={1:[],2:[],3:[],4:[]};
  pool.forEach(p=>by[p.pos]&&by[p.pos].push(p));
  const rank=(a,b)=>(val(b)-val(a))||(b.owned-a.owned);
  Object.values(by).forEach(a=>a.sort(rank));
  const shapes=form?[form.split("-").map(Number)]:FORMS;
  const need=RULES.squad;
  /* A Wildcard bench has to be able to come on; a Free Hit bench never will, so
     it is squeezed harder. The floor is whatever four cheap bodies actually
     cost — around £17.5 this season — so the cap sits above that. */
  const benchCap=kind==="wildcard"?21.0:18.5;
  let best=null;
  shapes.forEach(([d,m,f])=>{
    const XI={1:1,2:d,3:m,4:f};
    const club={},xi=[];
    const can=p=>!xi.includes(p)&&(club[p.team]||0)<3;
    const add=p=>{xi.push(p);club[p.team]=(club[p.team]||0)+1;};
    [4,3,2,1].forEach(pos=>{let n=0;
      for(const p of by[pos]){if(n>=XI[pos])break;if(!can(p))continue;add(p);n++;}});
    if(xi.length<11)return;
    const bench=[];let bspend=0;
    [1,2,3,4].forEach(pos=>{
      const want=need[pos]-xi.filter(p=>p.pos===pos).length;
      const cheap=by[pos].slice().sort((a,b)=>a.price-b.price||rank(a,b));
      let t=0;
      for(const p of cheap){if(t>=want)break;
        if(xi.includes(p)||bench.includes(p))continue;
        if((club[p.team]||0)>=3)continue;
        bench.push(p);club[p.team]=(club[p.team]||0)+1;bspend+=p.price;t++;}});
    if(bench.length!==4||bspend>benchCap)return;
    const spend=()=>xi.reduce((a,p)=>a+p.price,0)+bspend;
    let guard=0;
    while(spend()>budget&&guard++<220){
      const order=xi.slice().sort((a,b)=>(val(a)/a.price)-(val(b)/b.price));
      let done=false;
      for(const out of order){
        const alt=by[out.pos].find(q=>!xi.includes(q)&&!bench.includes(q)&&q.price<out.price-0.05
          &&((club[q.team]||0)<3||q.team===out.team));
        if(alt){club[out.team]--;xi.splice(xi.indexOf(out),1);add(alt);done=true;break;}}
      if(!done)break;}
    if(spend()>budget+0.001)return;
    /* spend whatever is left without lowering the projection */
    let up=true,g2=0;
    while(up&&g2++<160){
      up=false;const spare=budget-spend();if(spare<0.1)break;
      let pick=null;
      xi.forEach(out=>{by[out.pos].forEach(q=>{
        if(xi.includes(q)||bench.includes(q))return;
        const extra=q.price-out.price;
        if(extra<=0||extra>spare+1e-9)return;
        if(q.team!==out.team&&(club[q.team]||0)>=3)return;
        const dd=val(q)-val(out);
        if(dd>=-1e-9&&(!pick||dd>pick.dd))pick={out,inn:q,dd};});});
      if(pick){club[pick.out.team]--;xi.splice(xi.indexOf(pick.out),1);add(pick.inn);up=true;}}
    const cap=xi.slice().sort(rank)[0];
    const total=xi.reduce((a,p)=>a+val(p),0)+(cap?val(cap):0)+benchPart(kind,bench,val);
    if(!best||total>best.total)
      best={xi:xi.slice().sort(rank),bench,cap,total,shape:`${d}-${m}-${f}`,
        value:+spend().toFixed(1),benchValue:+bspend.toFixed(1),weeks,val,heuristic:true};
  });
  _sqCache[key]=best;
  return best;
}
function myScore(gw,weeks,kind){
  const sp=squadPlayers();if(!sp.length)return 0;
  const v=p=>{let t=0;for(let e=gw;e<gw+weeks&&e<=38;e++)t+=(p.gw[e]?.pts||0);return t/weeks;};
  /* F34: the legal best XI, not the top 11 by points */
  const xi=legalBestXI(sp,v);
  const cap=xi.reduce((m,p)=>(!m||v(p)>v(m))?p:m,null);
  /* a Wildcard squad is scored with its bench, so yours is too */
  const bench=kind==="wildcard"?sp.filter(p=>!xi.includes(p)):[];
  return xi.reduce((a,p)=>a+v(p),0)+(cap?v(cap):0)+(bench.length?benchPart("wildcard",bench,v):0);
}
function chipsHTML(){
  const g=VG();
  const budget=squadBudget();
  const half=g>=20?2:1;
  const openHalf=S.chipHalf||half;                       // active half expands by default

  /* ---- squad card, reusing the Planner pitch ---- */
  const sqCard=(kind,title,note,formKey)=>{
    const form=S[formKey]||null;
    const t=optimalSquad(kind,g,budget,form)||buildSquad(kind,g,form,budget);
    /* F57: say how sure the answer is */
    const how=!t?"":t.heuristic?"best found (quick builder)":t.proven?`proven optimal (${t.shape})`
      :t.checking?`best found (${t.shape}) · checking every player…`:`best found (${t.shape}) · solver time limit`;
    const weeks=kind==="wildcard"?5:1;
    const mine=myScore(g,weeks,kind);
    const delta=t?t.total-mine:0;
    const label=kind==="wildcard"?`GW${g}–${Math.min(38,g+4)} average`:`GW${g}`;
    /* Free Hit is a single-week team, so once that week's actuals land we can show
       what it really scored. Wildcard spans five weeks, so a one-week actual would
       be misleading there — deliberately Free Hit only. */
    const showActual=kind==="freehit";
    const actualOf=p=>{const f=S.playerActuals&&(S.playerActuals[p.id]||S.playerActuals[String(p.id)]);
      const v=f?(f[g]??f[String(g)]):null;return v==null?null:+v;};
    let actualTotal=null;
    if(showActual&&t){
      const vals=t.xi.map(actualOf);
      if(vals.some(v=>v!=null))
        actualTotal=vals.reduce((a,v)=>a+(v||0),0)+(t.cap?(actualOf(t.cap)||0):0);
    }
    return `<div class="panel">
      <div class="phead"><h2>${title}</h2>
        <span style="text-align:right">
          <span style="display:block;font-family:'Geist',system-ui,sans-serif;font-weight:800;font-size:22px;
            line-height:1;color:${delta>0?"var(--mint)":"var(--mute)"}">${delta>0?"+":""}${delta.toFixed(1)}</span>
          <span class="note">vs your team · ${label}</span></span></div>
      <div class="pbody" style="border-bottom:1px solid var(--ink3)">
        <p class="note" style="margin:0 0 8px">${note}</p>
        ${kind==="freehit"?"":`<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
          <span class="note" style="width:100%">Formation</span>
          <button class="chipbtn ${!form?"on":""}" onclick="act('${formKey}','')">Best${t&&!form?` · ${t.shape}`:""}</button>
          ${FORMS.map(f=>{const k=f.join("-");
            return `<button class="chipbtn ${form===k?"on":""}" onclick="act('${formKey}','${k}')">${k}</button>`;}).join("")}
        </div>`}
        ${t?`<p class="note" style="margin:8px 0 0">${t.total.toFixed(1)} projected · ${how} · £${t.value.toFixed(1)} of £${budget.toFixed(1)} · bench £${t.benchValue.toFixed(1)}</p>`:""}
        ${actualTotal!=null?`<p style="margin:6px 0 0;font-size:12.5px;color:var(--cream)">
          <b style="font-family:'Geist',system-ui,sans-serif;font-size:19px;color:var(--mint)">${actualTotal.toFixed(0)}</b> actual ·
          <span style="color:${actualTotal-t.total>=0?"var(--mint)":"var(--red)"};font-weight:700">${actualTotal-t.total>=0?"+":""}${(actualTotal-t.total).toFixed(1)}</span> vs projected</p>`:""}
      </div>
      ${t?`<div class="pitch">${[1,2,3,4].map(pos=>{const r=t.xi.filter(p=>p.pos===pos);
        return r.length?`<div class="row">${r.map(p=>chipCard(p,t,showActual)).join("")}</div>`:"";}).join("")}</div>
        <div class="benchbar"><div class="lb">Bench</div>
          <div class="row">${t.bench.map(p=>chipCard(p,t,showActual)).join("")}</div></div>`
        :`<div class="pbody"><p class="note">Not enough data for this gameweek.</p></div>`}
    </div>`;
  };

  /* ---- chip timeline ---- */
  const basis={wildcard:"Worst three-week run — rebuild before it",
    freehit:"Biggest gap between your XI and the best available",
    bboost:"Week your four substitutes score most",
    "3xc":"Week your best player has his highest single score"};
  /* Detail shown on the orange locked line, computed fresh for the week actually
     chosen (chipPlan only pre-computes the top three recommended weeks). */
  const fixOf=(p,e)=>{const f=p.gw[e]?.fixtures?.[0];return f?`${f.opp} (${f.home?"H":"A"})`:"no fixture";};
  const lockedDetail=(k,e)=>{
    const kind=chipKind(k), sp=squadPlayers();
    if(!sp.length)return "";
    if(kind==="3xc"){
      const top=[...sp].sort((a,b)=>(b.gw[e]?.pts||0)-(a.gw[e]?.pts||0))[0];
      return top?`${esc(top.web_name)} · ${esc(fixOf(top,e))}`:"";
    }
    if(kind==="bboost"){
      const w=weekScore(sp,e);
      return orderBench(w.bench).map(p=>`${esc(p.web_name)} (${esc(fixOf(p,e))})`).join(", ");
    }
    return "";                                   // wildcard and free hit: week + uplift only
  };
  /* F62: the Wildcard has no model uplift, so its row shows the team's own
     three-week projected totals instead of pretending to one. */
  const wcRow=(k,n,hist)=>{
    const plan=chipPlan(k)||[], locked=S.chips[k], all=wcWindowTotals(k), best=plan[0];
    const tots=Object.values(all).filter(Boolean).map(o=>o.tot);
    const hi=Math.max(...tots,0), lo=Math.min(...tots,hi);
    const span=w=>`GW${w.span[0]} to GW${w.span[2]}`;
    return `<div class="chipblock">
      <div class="chiphead">
        <span><span class="chipname">${n}</span>
          <span class="note" style="margin-left:8px">${esc(basis.wildcard)}</span></span>
        ${histNote(hist)}</div>
      ${locked?`<div class="chiplocked">
        <span>GW${locked} · ${all[locked]?`your team projects ${all[locked].tot.toFixed(1)} over ${span(all[locked])}`:"too late in the half for a three-week window"}</span>
        <button onclick="act('clearchip','${k}')">Clear</button></div>`
        :best?`<div class="chipbest">Best week: <b>GW${best.e}</b> · your team projects only ${best.tot.toFixed(1)} over GW${best.span[0]} to GW${best.span[2]}</div>`:""}
      <div class="tl">
        ${Object.keys(all).map(Number).sort((a,b)=>a-b).map(e=>{
          const w=all[e], isBest=best&&best.e===e, isSel=locked===e;
          const h=w?Math.max(3,Math.round((hi-w.tot)/((hi-lo)||1)*31)+3):3;
          const tip=w?`${span(w)}: your team projects ${w.tot.toFixed(1)} points. The lower the total, the taller the bar and the better the week to rebuild.`
            :`GW${e}: fewer than three gameweeks left in this half`;
          return `<button class="tlweek ${isSel?"sel":""} ${isBest&&!isSel?"best":""}"
            onclick="act('setchip','${k}',${e})" title="${esc(tip)}">
            <span class="tlval">${w?w.tot.toFixed(0):""}</span>
            <span class="tlbar" style="height:${h}px"></span>
            <span class="tlnum">${e}</span></button>`;}).join("")}
      </div>
      <p class="note" style="margin:6px 0 0;font-size:10px">Bars: your team's projected points over each three-week run. Lowest is best to rebuild before.</p></div>`;
  };
  const histNote=hist=>`<span class="note" title="The average gain from this chip in your past seasons. A record of what you did, not a projection.">your past average +${hist.toFixed(1)}</span>`;
  const chipRow=(k,n)=>{
    const plan=chipPlan(k)||[], locked=S.chips[k], hist=CHIP_HISTORY[chipKind(k)];
    if(chipKind(k)==="wildcard")return wcRow(k,n,hist);
    const isHalf2=k.endsWith("2");
    const from=isHalf2?Math.max(20,g):g, to=isHalf2?38:19;
    const byWeek={};plan.forEach(o=>byWeek[o.e]=o.up);
    const all=chipAllWeeks(k);
    const max=Math.max(0.1,...Object.values(all));
    const best=plan[0];
    const det=locked?lockedDetail(k,locked):"";
    const played=chipPlayed(k);
    return `<div class="chipblock">
      <div class="chiphead">
        <span><span class="chipname">${n}</span>
          <span class="note" style="margin-left:8px">${esc(basis[chipKind(k)])}</span></span>
        ${histNote(hist)}</div>
      ${played!=null?`<div class="chiplocked used"><span>Played in GW${played} · used</span></div>`
      :locked?`<div class="chiplocked">
        <span>GW${locked}${det?` · ${det}`:""} · +${(all[locked]||0).toFixed(1)} pts</span>
        <button onclick="act('clearchip','${k}')">Clear</button></div>`
        :best?`<div class="chipbest">Best week — <b>GW${best.e}</b>, +${best.up.toFixed(1)} pts${best.note?` · ${esc(best.note)}`:""}</div>`:""}
      ${played!=null?"":`<div class="tl">
        ${Object.keys(all).map(Number).sort((a,b)=>a-b).map(e=>{
          const v=all[e]||0, h=Math.max(3,Math.round(v/max*34));
          const isBest=best&&best.e===e, isSel=locked===e;
          const why=isSel?null:chipRuleBreak(k,e);
          return `<button class="tlweek ${isSel?"sel":""} ${isBest&&!isSel&&!why?"best":""} ${why?"no":""}"
            onclick="act('setchip','${k}',${e})" title="${why?esc(why):`GW${e} · +${v.toFixed(1)} pts`}"${why?' aria-disabled="true"':""}>
            <span class="tlval">${v>=0.05?"+"+v.toFixed(1):""}</span>
            <span class="tlbar" style="height:${h}px"></span>
            <span class="tlnum">${e}</span></button>`;}).join("")}
      </div>`}</div>`;
  };
  /* Two per row: Wildcard + Bench Boost, then Free Hit + Triple Captain */
  const set=[["wildcard","Wildcard"],["bboost","Bench Boost"],["freehit","Free Hit"],["3xc","Triple Captain"]];
  /* First-half chips expire at the GW19 deadline. The date comes from the
     data (gameweek_summaries, or the official nextDeadline when GW19 is the
     upcoming week), shown in UK time; it was hard-coded before and wrong. */
  const chipsExpiry=(()=>{
    const ev=(S.events||[]).find(e=>e.id===19);
    const iso=(ev&&ev.deadline)
      ||(S.model.next.id===19&&S.status&&S.status.fpl&&S.status.fpl.nextDeadline)||null;
    return iso?ukFmt(iso,{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})+" "+ukZone(iso)
      :"at the GW19 deadline";
  })();
  const halfPanel=hf=>`<div class="panel">
      <div class="phead" style="cursor:pointer" onclick="act('chiphalf',${hf})">
        <h2 style="${openHalf===hf?"color:var(--mint)":""}">${hf===1?"First half · GW1–19":"Second half · GW20–38"}</h2>
        <span class="note">${hf===1?"expire "+esc(chipsExpiry):"reset at GW20"} ${openHalf===hf?"▲":"▼"}</span></div>
      ${openHalf===hf?`<div class="chipgrid2">${set.map(([k,n])=>chipRow(k+hf,n)).join("")}</div>`:""}</div>`;

  return chipTimingHTML(g)+`<div class="sqgrid">
      <div class="${S.chipView==="wc"?"hideSm":""}">${sqCard("freehit","Free Hit team",
        "One week only, so every penny goes into the XI and the bench is fodder.","fhForm")}</div>
      <div class="${S.chipView==="fh"||!S.chipView?"hideSm":""}">${sqCard("wildcard","Wildcard squad",
        "Judged across the next 5 gameweeks, with a playable bench.","wcForm")}</div>
    </div>
    <div class="sqtoggle">
      <button class="${(S.chipView||"fh")==="fh"?"on":""}" onclick="act('chipview','fh')">Free Hit</button>
      <button class="${S.chipView==="wc"?"on":""}" onclick="act('chipview','wc')">Wildcard</button>
    </div>
    ${halfPanel(half)}${halfPanel(half===1?2:1)}`;
}
/* F62: the Wildcard bars used to be the owner's historical average (+10.2)
   on the three weakest windows and 60% of it (+6.1) on every other week,
   which read as model uplifts. The choice is really made on the team's own
   projected total over each three-week run, so that is what each week holds:
   {tot, span} for a full window, null when fewer than three weeks remain. */
function wcWindowTotals(kind){
  const sp=squadPlayers();const out={};
  if(!sp.length||!S.model)return out;
  const g=VG(),half=kind.endsWith("2");
  const from=half?Math.max(20,g):g, to=half?38:19;
  const weeks=[];for(let e=from;e<=to;e++)if(sp.some(p=>p.gw[e]&&!p.gw[e].blank))weeks.push(e);
  weeks.forEach((e,i)=>{
    if(i+2>=weeks.length){out[e]=null;return;}
    const span=[e,weeks[i+1],weeks[i+2]];
    out[e]={tot:span.reduce((a,w)=>a+weekScore(sp,w).pts,0),span};
  });
  return out;
}
/* uplift for every legal week, so the timeline has a full row */
function chipAllWeeks(kind){
  const sp=squadPlayers();const out={};
  if(!sp.length||!S.model)return out;
  const g=VG(),half=kind.endsWith("2");
  const from=half?Math.max(20,g):g, to=half?38:19;
  const plan=chipPlan(kind)||[];
  const known={};plan.forEach(o=>known[o.e]=o.up);
  const k=chipKind(kind);
  for(let e=from;e<=to;e++){
    if(!sp.some(p=>p.gw[e]&&!p.gw[e].blank))continue;
    if(known[e]!=null){out[e]=known[e];continue;}
    const xi=[...sp].sort((a,b)=>(b.gw[e]?.pts||0)-(a.gw[e]?.pts||0));
    if(k==="bboost")out[e]=weekScore(sp,e).benchPts;          // F34: the bench of the legal XI
    else if(k==="3xc")out[e]=xi[0]?.gw[e]?.pts||0;
    /* Free Hit: the same gap chipPlan measures (best available XI minus
       yours), for every week. It used to fill every week outside the top
       three with 60% of the third best, a made-up figure (as F62 found on the
       Wildcard row). */
    else if(k==="freehit")out[e]=Math.max(0,bestXIScore(e)-weekScore(sp,e).pts);
    else out[e]=known[e]!=null?known[e]:(plan.length?plan[plan.length-1].up*0.6:0);
  }
  return out;
}
function chipCard(p,t,showActual){
  const g=VG();
  const v=t.val(p), isC=t.cap&&t.cap.id===p.id;
  const q=p.gw[g]||{fixtures:[]};
  const[bg,fg,elite]=ptsCol(v*(isC?2:1));
  const f0=q.fixtures[0];
  const own=(S.squad||[]).includes(p.id);
  const proj=v*(isC?2:1);
  /* Free Hit only: actual points for this gameweek once the live feed has them,
     captain-multiplied the same way as the projection so they compare like for like. */
  const feed=showActual&&S.playerActuals?(S.playerActuals[p.id]||S.playerActuals[String(p.id)]):null;
  const raw=feed?(feed[g]??feed[String(g)]):null;
  const hasActual=raw!=null;
  const act1=hasActual?(+raw)*(isC?2:1):null;
  const diff=hasActual?act1-proj:null;
  return `<div class="card">
    <div class="kit" style="cursor:pointer" onclick="act('card',${p.id})">${shirtSVG(p.teamName.toUpperCase(),p.pos===1,38)}
      ${isC?`<span class="badge" style="bottom:-2px;left:4px;background:var(--cream);color:var(--ink)">C</span>`:""}
      ${own?`<span class="badge" style="top:-2px;right:2px;background:var(--mint);color:var(--ink)">✓</span>`:""}</div>
    <div class="namebar"><span class="nm">${esc(p.web_name)}</span><span class="pr">£${p.price.toFixed(1)}</span></div>
    <div class="ptsbar" style="background:${bg};color:${fg};${elite?"box-shadow:0 0 0 2px var(--cyan) inset":""}">
      <div class="pv">${hasActual?act1.toFixed(1):proj.toFixed(1)}</div>
      ${hasActual?`<div class="pv2">proj ${proj.toFixed(1)} <span style="font-weight:700;color:${diff>=0?"#0f5132":"#7a1f1f"}">${diff>=0?"+":""}${diff.toFixed(1)}</span></div>`:""}
      <div class="fx">${f0?`<span style="${f0.home?"":"font-style:italic"}">${esc(f0.opp)} (${f0.home?"H":"A"})</span>`:"No fixture"}</div></div>
    <div class="next3">${(()=>{let h="";for(let e=g;e<g+3&&e<=38;e++){const w=p.gw[e];
      if(!w||w.blank){h+=`<span style="background:var(--ink3);color:var(--mute)">—</span>`;continue;}
      const f=w.fixtures[0],[b,c]=fdrCol(posDiff(p,f));
      h+=`<span style="background:${b};color:${c};${f.home?"":"font-style:italic"}">${esc(f.opp.slice(0,3))}</span>`;}return h;})()}</div>
    <div class="cardsigs">${sigHTML(p,g)}</div></div>`;
}

/* F12/F13 (re-checked 13 Oct 2026): the server cleans the feeds, but the
   page no longer relies on it: only http(s) links, numbers as numbers */
const safeUrl=u=>/^https?:\/\//i.test(String(u||""))?String(u):"#";
const safeInt=v=>{const n=Number(v);return Number.isFinite(n)?Math.round(n):0;};
function itemHTML(n,score){
  const h=hits(n.title),ago=Math.max(0,Math.round((Date.now()-n.time)/3600000));
  const when=ago<1?"just now":(ago<24?ago+"h ago":Math.round(ago/24)+"d ago");
  return `<a class="item ${h.length?"hit":""}" href="${esc(safeUrl(n.url))}" target="_blank" rel="noopener">
    <div class="ttl" ${h.length?'style="color:var(--mint)"':""}>${h.length?`<span class="tag">${esc(h.join(", "))}</span>`:""}${esc(n.title)}</div>
    <div class="meta"><span class="src">${esc(n.src)}</span><span>${when}</span>
      ${score&&safeInt(n.score)?`<span>▲ ${safeInt(n.score)}</span>`:""}${safeInt(n.comments)?`<span>${safeInt(n.comments)} comments</span>`:""}
      ${n.extra?`<span>${esc(n.extra)}</span>`:""}</div></a>`;
}
const CREATORS=[["Ben Crellin","Blanks, doubles and fixture swings","https://x.com/BenCrellin"],
 ["FPL Harry","Data-led weekly analysis","https://x.com/FPLHarry"],
 ["FPL General","Three top-500 finishes","https://x.com/FPLGeneral"],
 ["FPL Salah","Four top-1k finishes","https://x.com/FPL_Salah"],
 ["Lateriser","Differential-hunting","https://x.com/FPL_Lateriser"],
 ["Holly Shand","Predicted lineups and team news","https://x.com/FFCommunity_"],
 ["Mark Sutherns","Founded FFScout; FPL BlackBox","https://x.com/markyfpl"],
 ["Big Man Bakar","The weekly Review thread","https://x.com/BigManBakar"],
 ["Pras","13 straight top-100k seasons","https://x.com/prasFPL"],
 ["Gianni Buttice","Sky Sports regular","https://x.com/GianniButtice"],
 ["The FPL Wire","Long-form pre-deadline pod","https://www.youtube.com/@TheFPLWire"],
 ["FPL BlackBox","Deep tactical discussion","https://www.youtube.com/@FPLBlackBox"],
 ["Let's Talk FPL","Daily video round-ups","https://www.youtube.com/@LetsTalkFPL"]];


/* ============================================================
   SIGNALS
   Player and team signals for transfers and the current squad, agreed from
   the mock-up on 12 Oct 2026. Every figure comes from the model and this
   season's data the rest of the app already uses, so a card can never
   disagree with Player Data, Fixtures or the planner. Card anatomy follows
   Fintel's Reports page: icon tile, Title Case heading, the explanation
   behind (i), and a fold arrow; colours are FPL Signals' own.
   Icons are Lucide (ISC licence), inlined so nothing is fetched.
   ============================================================ */
/* thresholds, agreed with the mock-up */


/* ============================================================
   REDESIGN WAVE 2 (20 Oct 2026, mock 2-3): the Planner's This Week strip
   (Top Move, Captain, Price Watch, Warnings, Rival Threat, each opening a
   pop-up) and the Compare pop-up (Your Edits / Wildcard / Free Hit).
   ============================================================ */
const WEEK_H=[1,3,5];
function wkSpan(g,h){return h>1?`GW${g}–${Math.min(38,g+h-1)}`:`GW${g}`;}
function modalHTML(title,body,opts){
  opts=opts||{};
  return `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" onclick="if(event.target===this)act('${opts.close||"popclose"}')">
    <div class="mbox${opts.wide?" wide":""}"><div class="mhead"><h2>${title}</h2>${opts.ctl||""}
      <button class="mx" onclick="act('${opts.close||"popclose"}')" aria-label="Close">${lic("x",18)}</button></div>
    <div class="mbody">${body}</div></div></div>`;
}
function hzHTML(cur,action,list){
  return `<span class="hz">${(list||WEEK_H).map(h=>`<button class="${cur===h?"on":""}" onclick="act('${action}',${h})">${h} GW</button>`).join("")}</span>`;
}
/* the five readings behind the strip and its pop-ups */
function weekData(){
  const g=VG(),h=S.weekH||1,mine=new Set(effectiveSquadIds(g).ids);
  const sp=squadPlayers();
  const moves=bestSwaps(8,h);
  const xi=startingXI();
  const caps=xi.slice().sort((a,b)=>hPts(b,g,h)-hPts(a,g,h));
  const L=p=>fplLive(p)||{};
  const priced=sp.filter(p=>L(p).pcp!=null);
  const rising=priced.filter(p=>L(p).pcp>=70).sort((a,b)=>L(b).pcp-L(a).pcp);
  const falling=priced.filter(p=>L(p).pcp<=-70).sort((a,b)=>L(a).pcp-L(b).pcp);
  const warn=sp.filter(p=>p.avail<1||((p.roleMins||0)>=60&&(p.xMins||0)<60)||(p.status&&p.status!=="a"&&p.status!=="u"&&p.avail<1))
    .map(p=>({p,inXI:xi.includes(p)})).sort((a,b)=>(b.inXI-a.inXI)||(a.p.avail-b.p.avail));
  const R=rivalOwn();
  const threats=R&&R.n?Object.keys(R.own).map(id=>({p:S.model.players.find(q=>q.id===+id),k:R.own[id]}))
    .filter(x=>x.p&&!mine.has(x.p.id)).sort((a,b)=>(b.k-a.k)||(hPts(b.p,g,h)-hPts(a.p,g,h))):[];
  return{g,h,mine,moves,caps,rising,falling,priced,warn,R,threats};
}
function weekStripHTML(){
  if(!S.model||VG()<S.model.next.id)return "";
  const D=weekData(),{g,h}=D;
  /* compact cards (12 Nov 2026): icon, title, figure, one line; the second
     pick (next move, vice, ...) is in each card's pop-up */
  const card=(k,icon,tone,title,fig,line)=>`<button class="wk" onclick="act('pop','${k}')" aria-haspopup="dialog">
    <span class="wkh"><span class="tile" style="--tc:${tone}">${lic(icon)}</span><span class="wkt">${title}</span><span class="chev">${lic("chevron-right",16)}</span></span>
    <span class="wkf">${fig}</span><span class="wkl">${line}</span></button>`;
  const m=D.moves[0],c=D.caps[0];
  const opp=p=>{const f=((p.gw[g]||{}).fixtures||[])[0];return f?`${esc(f.opp)} (${f.home?"H":"A"})`:"no game";};
  const L=p=>fplLive(p)||{};
  const pct=p=>`<b class="${L(p).pcp>0?"up":"dn"}">${Math.round(L(p).pcp)}%</b>`;
  const w=D.warn[0],t=D.threats[0];
  const cards=[
    m?card("move","circle-arrow-up","#3DDC97","Top Move",`${esc(m.out.web_name)} <span class="arr">→</span> ${esc(m.inn.web_name)}`,
        `<b class="up">${sgn1(m.gain)} pts</b> ${wkSpan(g,h)} · £${m.inn.price.toFixed(1)} · ${esc(m.inn.teamName)}`)
     :card("move","circle-arrow-up","#3DDC97","Top Move","Hold",`No single move improves your XI over ${wkSpan(g,h)}`),
    c?card("cap","crown","#FFB020","Captain",`${esc(c.web_name)} <span class="cx">${(hPts(c,g,h)*2).toFixed(1)}</span>`,
        `${hPts(c,g,h).toFixed(1)} × 2 · ${h>1?wkSpan(g,h):opp(c)}`)
     :card("cap","crown","#FFB020","Captain","—","No XI yet"),
    D.rising.length||D.falling.length
     ?card("price",D.falling.length&&!D.rising.length?"trending-down":"trending-up",D.falling.length&&!D.rising.length?"#FF5A6E":"#4ADE80","Price Watch",
        D.rising.length?`${D.rising.length} of yours rising`:`${D.falling.length} of yours falling`,
        [...D.rising,...D.falling].slice(0,2).map(p=>`${esc(p.web_name)} ${pct(p)}`).join(" · ")+(D.rising.length&&D.falling.length?` · ${D.falling.length} falling`:" progress"))
     :card("price","trending-up","#4ADE80","Price Watch",D.priced.length?"No changes due":"No predictor data",D.priced.length?"None of yours is near a rise or fall":"FPL's predictor did not load"),
    w?card("warn","clock-alert","#FFB020","Warnings",`${D.warn.length} ${D.warn.length===1?"doubt":"doubts"}`,
        `${esc(w.p.web_name)} · ${w.p.avail<1?(w.p.avail>0?Math.round(w.p.avail*100)+"%":"out"):Math.round(w.p.xMins||0)+" mins"}${w.p.news?" · "+esc(String(w.p.news).split(/[-–(]/)[0].trim().slice(0,22)):""}${w.inXI?"":" · bench"}`)
     :card("warn","clock-alert","#FFB020","Warnings","All clear","Every player fit and expected to start"),
    t?card("rival","swords","#B388FF","Rival Threat",esc(t.p.web_name),`Owned by ${t.k} of ${D.R.n} rivals, not you`)
     :card("rival","swords","#B388FF","Rival Threat","—",D.R?"No player most rivals own that you don't":"League feed not loaded")
  ].join("");
  return `<section class="week"><div class="weekh"><h2>This Week</h2>${hzHTML(h,"weekh")}</div><div class="wkrow">${cards}</div></section>`;
}
/* what each strip card opens */
function popHTML(){
  const k=S.pop;if(!k||!S.model)return "";
  if(TG_TARGETS[k])return tgTargetPopHTML(k);
  const D=weekData(),{g,h}=D;
  const L=p=>fplLive(p)||{};
  const ctl=hzHTML(h,"weekh");
  if(k==="move")return modalHTML(`Top Moves · ${wkSpan(g,h)}`,
    (D.moves.length?`<div class="tgrid">${D.moves.map(m=>swapCardHTML(m,g)).join("")}</div>`:`<p class="note">No single move improves your XI over ${wkSpan(g,h)}. Roll the transfer.</p>`)
    +`<p class="note" style="margin-top:10px">Each move is scored on your best XI plus captain, week by week${h>1?" (later weeks count for a little less)":""}, against your current team.</p>`
    +fundingHTML()+planPanelHTML()+transfersHTML(),{wide:true,ctl});
  if(k==="cap")return modalHTML("Captain",captaincyHTML()||`<p class="note">Captaincy is set for the next deadline.</p>`,{});
  if(k==="price"){
    const row=p=>{const l=L(p),pr=(l.pcProj||[]).map(([o,v,lk])=>`<td>${Math.round(v)}%</td>`).join("");
      return `<tr${D.mine.has(p.id)?' class="me"':""}><td>${esc(p.web_name)} <span class="mu">${esc(p.teamName)}</span></td><td>£${p.price.toFixed(1)}</td>
        <td><b class="${l.pcp>0?"up":l.pcp<0?"dn":""}">${l.pcp==null?"—":Math.round(l.pcp)+"%"}</b></td>${pr||"<td></td><td></td><td></td>"}<td>${p.owned}%</td></tr>`;};
    const head=`<thead><tr><th>Player</th><th>Price</th><th>Tonight</th><th>+1 night</th><th>+2</th><th>+3</th><th>Owned</th></tr></thead>`;
    const all=S.model.players.filter(p=>L(p).pcp!=null);
    const up=all.filter(p=>L(p).pcp>0).sort((a,b)=>L(b).pcp-L(a).pcp).slice(0,8);
    const dn=all.filter(p=>L(p).pcp<0).sort((a,b)=>L(a).pcp-L(b).pcp).slice(0,8);
    const mineRows=squadPlayers().filter(p=>L(p).pcp!=null).sort((a,b)=>Math.abs(L(b).pcp)-Math.abs(L(a).pcp));
    return modalHTML("Price Watch",`<div class="pmgrid">
      <div><div class="note">Your Squad</div><table class="mkt">${head}<tbody>${mineRows.map(row).join("")}</tbody></table></div>
      <div><div class="note">Closest to a Rise</div><table class="mkt">${head}<tbody>${up.map(row).join("")}</tbody></table></div>
      <div><div class="note">Closest to a Fall</div><table class="mkt">${head}<tbody>${dn.map(row).join("")}</tbody></table></div></div>
      <p class="note" style="margin-top:10px">FPL's own price predictor: progress towards tonight's change (100% = it changes), and where it projects the next three nights. Refreshed every 15 minutes.</p>
      ${priceMovesHTML()}`,{wide:true});
  }
  if(k==="warn"){
    const sw=new Map();bestSwaps(60,h).forEach(m=>{if(!sw.has(m.out.id))sw.set(m.out.id,m);});
    return modalHTML("Warnings",D.warn.length?`<table class="mkt"><thead><tr><th>Player</th><th>Where</th><th>Chance</th><th>xMins</th><th>News</th><th>Best replacement</th></tr></thead><tbody>
      ${D.warn.map(({p,inXI})=>{const m=sw.get(p.id);return `<tr><td>${esc(p.web_name)} <span class="mu">${esc(p.teamName)}</span></td><td>${inXI?"XI":"Bench"}</td>
        <td>${p.avail<1?Math.round(p.avail*100)+"%":"fit"}</td><td>${Math.round(p.xMins||0)}</td><td style="text-align:left;white-space:normal;max-width:360px">${esc(p.news||"")}</td>
        <td>${m?`${esc(m.inn.web_name)} <b class="up">${sgn1(m.gain)}</b> <button class="mini" onclick="act('doswap',${p.id},${m.inn.id})">Make</button>`:"—"}</td></tr>`;}).join("")}</tbody></table>`
      :`<p class="note">Every player in your squad is fit and expected to start.</p>`,{wide:true});
  }
  if(k==="rival"){
    if(!D.R)return modalHTML("Rival Threat",`<p class="note">The league feed has not loaded.</p>`,{});
    const top=D.threats.slice(0,12);
    const myOwn=squadPlayers().map(p=>({p,k:D.R.own[p.id]||0})).sort((a,b)=>a.k-b.k);
    const t=(rows,head)=>`<table class="mkt"><thead><tr><th>Player</th><th>${head}</th><th>Predicted ${wkSpan(g,h)}</th><th>Price</th><th>Overall</th></tr></thead><tbody>
      ${rows.map(x=>`<tr><td>${esc(x.p.web_name)} <span class="mu">${esc(x.p.teamName)}</span></td><td>${x.k}/${D.R.n}</td><td>${hPts(x.p,g,h).toFixed(1)}</td><td>£${x.p.price.toFixed(1)}</td><td>${x.p.owned}%</td></tr>`).join("")}</tbody></table>`;
    return modalHTML("Rival Threat",`<div class="pmgrid" style="grid-template-columns:repeat(auto-fit,minmax(420px,1fr))">
      <div><div class="note">Owned by your rivals, not you</div>${t(top,"Rivals")}</div>
      <div><div class="note">Your players, fewest rivals first (your differentials)</div>${t(myOwn,"Rivals")}</div></div>
      <p class="note" style="margin-top:10px">From each rival's latest published squad in your mini-league (${D.R.n} rivals).</p>`,{wide:true,ctl});
  }
  return "";
}
/* ---------- Compare pop-up (mock 3) ----------
   Left: the current team (Your Edits: the official squad; Wildcard and Free
   Hit: the plan for this week). Right: the proposal (your plan, or the
   Chips page optimiser's best Wildcard / Free Hit squad). Players leaving
   carry OUT, players arriving IN. On the left a tap locks a player into the
   proposal; on the right a tap rules him out; Re-run solves again. */
function cmpTeams(){
  const C=S.cmp,g=VG(),h=C.mode==="fh"?1:C.h;
  const cur=C.mode==="edits"?((latestOfficialPicks()||{}).picks||[]).map(pk=>pk.id):effectiveSquadIds(g).ids;
  let prop=null,meta={};
  if(C.mode==="edits"){prop=effectiveSquadIds(g).ids;meta={bank:planBank(),cap:effectiveCaptainVice(g).captain};}
  else if(C.mode==="draft"){const d=(LS.get("drafts")||[])[C.draft];if(d){prop=d.ids;meta={bank:d.bank,cap:d.cap,label:d.label};}}
  else{
    const kind=C.mode==="wc"?"wildcard":"freehit",budget=squadBudget();
    const r=optimalSquad(kind,g,budget,null,{weeks:h,locks:C.locks,bans:C.bans});
    if(r){prop=[...r.xi,...r.bench].map(p=>p.id);meta={bank:+(budget-r.value).toFixed(1),cap:r.cap&&r.cap.id,how:r.heuristic?"best found (quick builder)":r.proven?"proven optimal":r.checking?"best found, still checking":"best found",infeasible:false};}
    else meta={infeasible:true};
  }
  return{g,h,cur:cur.length?cur:effectiveSquadIds(g).ids,prop,meta};
}
function teamPtsOver(ids,g,h){
  const byId=new Map(S.model.players.map(p=>[p.id,p]));const out=[];
  for(let k=0;k<h&&g+k<=38;k++)out.push(xiTotal(ids,g+k,byId));
  return out;
}
function cmpPitchHTML(ids,other,g,h,side){
  const C=S.cmp,ps=ids.map(i=>S.model.players.find(p=>p.id===i)).filter(Boolean);
  const v=p=>p.gw[g]?.pts||0;
  const xi=legalBestXI(ps,v),bench=ps.filter(p=>!xi.includes(p)).sort((a,b)=>(a.pos===1?-1:b.pos===1?1:v(b)-v(a)));
  const cap=xi.slice().sort((a,b)=>v(b)-v(a))[0];
  const otherSet=new Set(other||[]);
  const chip=p=>{
    const moved=!otherSet.has(p.id),tag=moved?(side==="cur"?"OUT":"IN"):"";
    const locked=(C.locks||[]).includes(p.id),banned=(C.bans||[]).includes(p.id);
    const pend=side==="cur"?(C.pendLocks||[]).includes(p.id):(C.pendBans||[]).includes(p.id);
    const canTap=C.mode==="wc"||C.mode==="fh";
    const act2=canTap?(side==="cur"?`act('cmplock',${p.id})`:`act('cmpban',${p.id})`):`act('card',${p.id})`;
    return `<div class="cpl${tag?" moved":""}${pend?" pend":""}" onclick="${act2}" title="${canTap?(side==="cur"?"Tap to lock him into the proposal":"Tap to rule him out"):"Open player card"}">
      ${shirtSVG(p.teamName.toUpperCase(),p.pos===1,34)}
      <span class="cpn">${esc(p.web_name)}${p===cap?' <span class="tagy">C</span>':""}</span>
      <span class="cpv">${hPts(p,g,h).toFixed(1)}</span>
      ${tag?`<span class="ctag ${tag==="OUT"?"out":"in"}">${tag}</span>`:""}${pend||locked||banned?`<span class="cmark">${lic(side==="cur"?"lock":"ban",12)}</span>`:""}</div>`;};
  return `<div class="cpitch">${[1,2,3,4].map(pos=>{const r=xi.filter(p=>p.pos===pos);return r.length?`<div class="crow">${r.map(chip).join("")}</div>`:"";}).join("")}
    <div class="cbench"><span class="lb">Bench</span><div class="crow">${bench.map(chip).join("")}</div></div></div>`;
}
function compareModalHTML(){
  const C=S.cmp;if(!C||!S.model)return "";
  const T=cmpTeams(),{g,h}=T;
  const modes=[["edits","Your Edits"],["wc","Wildcard"],["fh","Free Hit"]];
  const drafts=LS.get("drafts")||[];
  const ctl=`<span class="pseg mseg">${modes.map(([k,n])=>`<button class="${C.mode===k?"on":""}" onclick="act('cmpmode','${k}')">${n}</button>`).join("")}</span>
    ${C.mode==="fh"?`<span class="hz"><button class="on" disabled>1 GW</button></span>`:hzHTML(C.h,"cmph")}`;
  if(!T.prop)return modalHTML(`Compare · ${wkSpan(g,h)}`,`<p class="note">${T.meta.infeasible?"No legal squad fits those locks and exclusions within your budget. Clear some and Re-run.":"Nothing to compare yet."}</p>
    <div class="mfoot"><button onclick="act('cmpclear')">Clear locks</button></div>`,{wide:true,ctl,close:"cmpclose"});
  const mine=teamPtsOver(T.cur,g,h),theirs=teamPtsOver(T.prop,g,h);
  const sum=a=>a.reduce((x,y)=>x+y,0),ms=sum(mine),ts=sum(theirs),gain=ts-ms;
  const outs=T.cur.filter(i=>!T.prop.includes(i)).length;
  const value=T.prop.reduce((a,i)=>{const p=S.model.players.find(q=>q.id===i);return a+(p?p.price:0);},0);
  const hit=C.mode==="edits"?hitCost(g):0;
  const cards=[
    figCard("Proposed",`Best XI plus captain of the proposal, week by week over ${wkSpan(g,h)}.`,ts.toFixed(1),`<span class="${gain>=0?"up":"dn"}">${sgn1(gain)}</span> vs your team`,h>1?theirs:null,"#3DDC97","mint"),
    figCard(C.mode==="edits"?"Official Team":"Your Team",`Best XI plus captain of ${C.mode==="edits"?"your official squad":"your plan for GW"+g}, scored the same way.`,ms.toFixed(1),wkSpan(g,h),h>1?mine:null,"#8A8A8A"),
    figCard("Gain",`Proposed minus yours over ${wkSpan(g,h)}${hit?", before the hit":""}.`,`<span class="${gain>=0?"up":"dn"}">${sgn1(gain)}</span>`,hit?`<span class="dn">−${hit} hit</span> · net ${sgn1(gain-hit)}`:`over ${h} GW`,null,"#8A8A8A"),
    figCard("Transfers","Players who change between the two teams.",String(outs),C.mode==="wc"?"Wildcard: no hits":C.mode==="fh"?"Free Hit: one week only":(hit?`<span class="dn">−${hit} hit</span>`:"within your free transfers"),null,"#8A8A8A"),
    figCard("Bank After","Money left once the proposal is bought.",`£${(T.meta.bank??0).toFixed(1)}`,`Squad £${value.toFixed(1)}${T.meta.how?" · "+T.meta.how:""}`,null,"#8A8A8A")
  ].join("");
  const pend=(C.pendLocks||[]).length+(C.pendBans||[]).length, applied=(C.locks||[]).length+(C.bans||[]).length;
  const body=`<div class="fcgrid c5">${cards}</div>
    <div class="cgrid"><div><div class="chd">${C.mode==="edits"?"Official team":"Current team"}${C.mode==="wc"||C.mode==="fh"?' <span class="mu">tap to lock in</span>':""}</div>${cmpPitchHTML(T.cur,T.prop,g,h,"cur")}</div>
      <div><div class="chd">${C.mode==="edits"?"Your edits":C.mode==="draft"?esc(T.meta.label||"Draft"):(C.mode==="wc"?"Wildcard":"Free Hit")+" proposal"}${C.mode==="wc"||C.mode==="fh"?' <span class="mu">tap to rule out</span>':""}</div>${cmpPitchHTML(T.prop,T.cur,g,h,"prop")}</div></div>
    <div class="mfoot">
      ${C.mode==="wc"||C.mode==="fh"?`<button class="${pend?"pri":""}" onclick="act('cmprerun')">${lic("refresh-cw",14)} Re-run${pend?` (${pend})`:""}</button>${applied||pend?`<button onclick="act('cmpclear')">Clear locks</button>`:""}`:""}
      ${drafts.length?`<select onchange="act('cmpdraft',+this.value)" aria-label="Open a draft"><option value="-1">Drafts (${drafts.length})</option>${drafts.map((d,i)=>`<option value="${i}">${esc(d.label)}</option>`).join("")}</select>`:""}
      <span style="flex:1"></span>
      <button onclick="act('cmpsave')">${lic("save",14)} Save as draft</button>
      ${C.mode==="edits"?`<button class="pri" onclick="act('save');act('cmpclose')">Save plan</button>`:`<button class="pri" onclick="act('cmpapply')">Apply</button>`}</div>`;
  return modalHTML(`Compare · ${wkSpan(g,h)}`,body,{wide:true,ctl,close:"cmpclose"});
}

/* ============================================================
   REDESIGN WAVE 3 (20 Oct 2026): the Players hub (Player Data renamed).
   One table of every player: views Buy / My Squad / All, horizon 1/3/5
   (default 1), position filter; predicted points, minutes, the position's
   key stat (xGI/90 over the last six for MID/FWD, clean-sheet chance for
   GK/DEF), fixture pills on one colour scale, price with FPL's change
   progress, overall ownership and ownership around you (mini-league rivals
   or the 50 managers ranked around you). Tick up to five to compare them
   in a pop-up of figure cards (replaces the Transfers radar). The full stat
   table stays as the Stats view, so no Player Data feature loses its home.
   ============================================================ */
const pName=(p,cls)=>`<button class="pn${cls?" "+cls:""}" onclick="act('card',${p.id})" title="Open ${esc(p.web_name)}'s card">${esc(p.web_name)}</button>`;
function aroundOwn(p,mode){
  mode=mode||"league";
  if(mode==="rank"){const N=S.neighbours;return N&&N.n?{k:N.own[p.id]||0,n:N.n}:null;}
  const R=rivalOwn();return R&&R.n?{k:R.own[p.id]||0,n:R.n}:null;
}
function fixPills(p,g,n){
  let h="";
  for(let e=g;e<g+n&&e<=38;e++){const q=p.gw[e];
    if(!q||q.blank||!q.fixtures.length){h+=`<span class="fdrpill blankpill">—</span>`;continue;}
    h+=q.fixtures.map(f=>fdrPill(f.opp,f.home,posDiff(p,f),{short:true,tiny:true})).join("");}
  return `<span class="fxrow">${h}</span>`;
}
/* the old Player Data table, kept whole as the Stats view */
/* tick-to-compare: up to five players side by side as figure cards */
function playerCompareHTML(){
  const ids=S.pTicks||[];if(!S.pCmp||!ids.length||!S.model)return "";
  const g=VG(),ps=ids.map(i=>S.model.players.find(p=>p.id===i)).filter(Boolean);
  const A=S.playerActuals||{};
  const last6=p=>{const a=A[p.id]||A[String(p.id)]||{},out=[];for(let e=Math.max(1,g-6);e<g;e++){const v=a[e]??a[String(e)];out.push(v==null?0:+v);}return out;};
  const rows=[
    ["Predicted 1 GW",p=>hPts(p,g,1),v=>v.toFixed(1),"high"],
    ["Predicted 3 GW",p=>hPts(p,g,3),v=>v.toFixed(1),"high"],
    ["Predicted 5 GW",p=>hPts(p,g,5),v=>v.toFixed(1),"high"],
    ["Expected Minutes",p=>p.xMins||0,v=>Math.round(v)+"′","high"],
    ["xGI/90, Last 6",p=>{const w=ws(String(p.code||""),p.pos,6,p.price,teamMaxPrice(p.team));return w?(w.xg90||0)+(w.xa90||0):0;},v=>v.toFixed(2),"high"],
    ["Clean Sheet Chance",p=>p.pos<=2?(csProbNext(p,g)||0):null,v=>Math.round(v*100)+"%","high"],
    ["Form",p=>p.form,v=>v.toFixed(1),"high"],
    ["Price",p=>p.price,v=>"£"+v.toFixed(1),"low"],
    ["Owned",p=>p.owned,v=>v.toFixed(1)+"%",null],
    ["Points Per Game",p=>p.ppg,v=>v.toFixed(1),"high"]];
  const cell=(row,p,best)=>{const v=row[1](p);if(v==null)return `<div class="cmc empty">—</div>`;
    return `<div class="cmc${best?" best":""}"><span class="cmv">${row[2](v)}</span></div>`;};
  const head=ps.map(p=>`<div class="cmh">${shirtSVG(p.teamName.toUpperCase(),p.pos===1,34)}<div>${pName(p,"big")}<div class="mu">${esc(p.teamName)} · ${POS[p.pos]} · £${p.price.toFixed(1)}</div>
      <div style="margin-top:4px">${sigHTML(p,g)}</div></div><button class="mx" onclick="act('tick',${p.id})" aria-label="Remove ${esc(p.web_name)}">${lic("x",14)}</button></div>`).join("");
  const body=rows.filter(r=>ps.some(p=>r[1](p)!=null)).map(r=>{const vals=ps.map(p=>r[1](p)),ok=vals.filter(v=>v!=null);
    const best=r[3]&&ok.length>1?(r[3]==="high"?Math.max(...ok):Math.min(...ok)):null;
    return `<div class="cml">${r[0]}</div>${ps.map((p,i)=>cell(r,p,best!=null&&vals[i]===best)).join("")}`;}).join("")
    +`<div class="cml">Next 5 Fixtures</div>${ps.map(p=>`<div class="cmc">${fixPills(p,g,5)}</div>`).join("")}`
    +`<div class="cml">Last 6 Gameweeks</div>${ps.map(p=>{const s=last6(p);return `<div class="cmc"><span class="cmv sm">${s.reduce((a,b)=>a+b,0)} pts</span>${s.length>1?spark(s,"#3DDC97",90,26):""}</div>`;}).join("")}`;
  return modalHTML(`Compare ${ps.length} Players`,`<div class="cmgrid" style="grid-template-columns:170px repeat(${ps.length},minmax(0,1fr))"><div></div>${head}${body}</div>
    <p class="note" style="margin-top:12px">Best in each row is outlined. Tick more players in the table to add them (up to five).</p>`,{wide:true,close:"pcmpclose"});
}

/* Signals board (redesign wave 4): one card per signal, in Andy's order,
   listing who carries it now (yours first), over the page's horizon. */
function signalBoardHTML(G,H,posF,bare){
  const mine=new Set(S.squad||[]);
  const by={};SIG_ORDER.forEach(k=>by[k]=[]);
  S.model.players.forEach(p=>{if(posF&&p.pos!==posF)return;
    signals(p,G,false,H).forEach(([k,t])=>by[k].push({p,t}));});
  const rank=(a,b)=>(mine.has(b.p.id)-mine.has(a.p.id))||(hPts(b.p,G,H)-hPts(a.p,G,H));
  const cards=SIG_ORDER.map(k=>{
    const list=by[k].sort(rank);
    const rows=list.slice(0,6).map(({p,t})=>`<div class="sbrow" onclick="act('card',${p.id})" title="${esc(t)}">
      <span class="sbn">${esc(p.web_name)}${mine.has(p.id)?' <span class="sgmine">You</span>':""}</span>
      <span class="sbm">${esc(p.teamName)} · ${POS[p.pos]} · £${p.price.toFixed(1)}</span>
      <span class="sbv">${hPts(p,G,H).toFixed(1)}</span></div>`).join("");
    return `<section class="sbcard"><header>${sigTile(k,SIG_RULE[k](H))}<h3>${SIGNAL[k][2]}</h3><span class="sbc">${list.length}</span></header>
      ${rows||'<p class="sgempty">Nobody right now.</p>'}${list.length>6?`<div class="sbmore">+${list.length-6} more · <a href="${routeFor("table")}" onclick="S.iconF=['${k}'];S.pdMore=true;return go(event,'table')">see all</a></div>`:""}</section>`;}).join("");
  if(bare)return `<div class="sbgrid">${cards}</div>`;
  return `<h4 class="sgsec">Signal Board <span class="mu" style="font-weight:400;font-size:12px">points over the next ${H}</span></h4><div class="sbgrid">${cards}</div>`;
}

/* ============================================================
   REDESIGN WAVE 5 (20 Oct 2026): Teams (Fixtures renamed). Tabs: Clubs
   (new, default), Fixture Grid (the club-by-gameweek grid) and By Gameweek
   (the fixture list). Clubs: attack and defence this season and over the
   last four matches (expected goals from the match data), the next 1/3/5
   on the view's lens, projected goals and clean-sheet chance from the
   model's fixture ratings, the bookmakers' figures for the next match when
   the odds are in, and each club's top assets. Views: Attacks to own,
   Defences to own, Opponents to target.
   ============================================================ */
let _tfCache=null;
function teamForm(){
  if(_tfCache&&_tfCache.m===S.teamMatch)return _tfCache.v;
  const key={};(S.teams||[]).forEach(t=>{key[Math.round(num(t.code))]=t.short;key["id"+t.id]=t.short;});
  const rows={};
  Object.values(S.teamMatch||{}).filter(m=>m.tag==="now").forEach(m=>{
    const hs=key[m.h]||key["id"+m.h],as=key[m.a]||key["id"+m.a];if(!hs||!as)return;
    (rows[hs]=rows[hs]||[]).push({gw:m.gw,xg:m.hxg,xga:m.axg});(rows[as]=rows[as]||[]).push({gw:m.gw,xg:m.axg,xga:m.hxg});});
  const v={};
  Object.entries(rows).forEach(([k,a])=>{a.sort((x,y)=>x.gw-y.gw);const l4=a.slice(-4);
    const avg=(r,f)=>r.length?r.reduce((s,x)=>s+(x[f]||0),0)/r.length:null;
    v[k]={n:a.length,xg:avg(a,"xg"),xga:avg(a,"xga"),xg4:avg(l4,"xg"),xga4:avg(l4,"xga")};});
  _tfCache={m:S.teamMatch,v};return v;
}
/* DefCon given (12 Nov 2026): this season, how many opposing players reached
   the DefCon target per match against each club. A side that keeps the ball
   and attacks makes its opponents defend, so their defenders and holding
   midfielders hit DefCon more (players hit it at 0.97x their usual share
   against the strongest attacks, 0.72x against the weakest, GW1-10). */
let _dcgCache=null;
function dcGiven(){
  if(_dcgCache&&_dcgCache.m===S.teamMatch&&_dcgCache.h===S.hist)return _dcgCache.v;
  const key={};(S.teams||[]).forEach(t=>{key[Math.round(num(t.code))]=t.short;key["id"+t.id]=t.short;});
  const sh=v=>key[v]||key["id"+v];
  const byCode={};((S.model&&S.model.players)||[]).forEach(p=>byCode[String(p.code)]=p);
  const hits={},games={};
  /* matches played: the calendar lists the whole season, so count only those
     with appearances recorded */
  const played=new Set();Object.values(S.hist||{}).forEach(rows=>rows.forEach(r=>{if(r.tag==="now"&&r.mins>0)played.add(r.mid);}));
  played.forEach(mid=>{const m=(S.teamMatch||{})[mid];if(!m)return;
    [sh(m.h),sh(m.a)].forEach(t=>{if(t)(games[t]=games[t]||new Set()).add(mid);});});
  Object.entries(S.hist||{}).forEach(([code,rows])=>{const p=byCode[code];if(!p||p.pos<2)return;
    const mine=key["id"+p.team];if(!mine)return;
    rows.forEach(r=>{if(r.tag!=="now"||!(r.mins>0)||!(r.dc>=(DC_THRESH[p.pos]||99)))return;
      const m=S.teamMatch[r.mid];if(!m)return;
      const h=sh(m.h),a=sh(m.a),opp=h===mine?a:a===mine?h:null;if(!opp)return;
      hits[opp]=(hits[opp]||0)+1;});});
  const v={};Object.entries(games).forEach(([t,set])=>{v[t]={n:set.size,hits:hits[t]||0,per:set.size?(hits[t]||0)/set.size:null};});
  _dcgCache={m:S.teamMatch,h:S.hist,v};return v;
}

/* ============================================================
   REDESIGN WAVE 7 (20 Oct 2026): the Status page. Data freshness (wave 1),
   then model performance against FPL's own prediction, fixture-rating
   accuracy, odds status, options, the signal key and the xFPL model page.
   ============================================================ */
function modelVsFplHTML(){
  const A=S.playerActuals;
  const rows=[];let tm=0,tf=0,tn=0,tb=0,top=[];
  for(let g=1;g<=38;g++){
    if(!weekFinal(g))continue;
    const live=S.predLive&&S.predLive.gw&&S.predLive.gw[g],back=S.predBack&&S.predBack.gw&&S.predBack.gw[g];
    const snap=live||back;if(!snap||!snap.players||!A)continue;
    const ep=snap.fplEp||null;
    let n=0,em=0,ef=0,b=0;const both=[];
    Object.entries(snap.players).forEach(([id,pred])=>{
      const a=A[id]||A[+id];const pts=a?(a[g]??a[String(g)]):null;if(pts==null)return;
      const f=ep?ep[id]:null;if(ep&&f==null)return;
      n++;em+=Math.abs(pred-pts);b+=pred-pts;if(ep){ef+=Math.abs(f-pts);both.push({pred,f,pts});}});
    if(!n)continue;
    const t10=k=>both.slice().sort((x,y)=>y[k]-x[k]).slice(0,10).reduce((s,x)=>s+x.pts,0)/Math.min(10,both.length||1);
    rows.push({g,src:live?"live":"backtest",n,mae:em/n,bias:b/n,fpl:ep?ef/n:null,tM:both.length?t10("pred"):null,tF:both.length?t10("f"):null});
    if(ep){tm+=em;tf+=ef;tn+=n;tb+=b;}
  }
  if(!rows.length)return `<p class="note" style="padding:14px;margin:0">No finished gameweek with a saved prediction yet.</p>`;
  const cmp=rows.filter(r=>r.fpl!=null);
  const avg=(k)=>cmp.length?cmp.reduce((s,r)=>s+r[k],0)/cmp.length:null;
  const cards=cmp.length?`<div class="fcgrid c5" style="padding:14px 14px 0">
    ${figCard("Model Error",`Average miss per player, model against points scored, over ${tn.toLocaleString()} player-weeks where FPL's own figure was saved too.`,(tm/tn).toFixed(2),"points per player",cmp.map(r=>-r.mae),"#3DDC97","mint")}
    ${figCard("FPL Error","The same players and weeks, FPL's own expected points (ep_next) taken before the deadline.",(tf/tn).toFixed(2),"points per player",cmp.map(r=>-r.fpl),"#8A8A8A")}
    ${figCard("Model vs FPL","How much closer the model is on average (positive = the model is better).",`<span class="${tf>tm?"up":"dn"}">${sgn1((tf-tm)/tn)}</span>`,`${cmp.filter(r=>r.mae<r.fpl).length} of ${cmp.length} weeks better`,null,"#8A8A8A")}
    ${figCard("Model Bias","Average of prediction minus points: positive means the model over-predicts.",sgn1(tb/tn),"points per player",null,"#8A8A8A")}
    ${figCard("Top 10 Picks","What the model's ten highest predictions went on to score, on average, against FPL's ten.",avg("tM").toFixed(1),`FPL's top 10: ${avg("tF").toFixed(1)}`,null,"#8A8A8A")}
  </div>`:"";
  return cards+`<div class="scroll" style="padding:0 14px 14px"><table class="mkt"><thead><tr><th>Gameweek</th><th>Source</th><th>Players</th><th>Model error</th><th>FPL error</th><th>Bias</th><th>Model top 10</th><th>FPL top 10</th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td>GW${r.g}</td><td>${r.src==="live"?"before the deadline":"backtest"}</td><td>${r.n}</td>
      <td><b class="${r.fpl!=null?(r.mae<=r.fpl?"up":"dn"):""}">${r.mae.toFixed(2)}</b></td><td>${r.fpl!=null?r.fpl.toFixed(2):"not saved"}</td>
      <td>${sgn1(r.bias)}</td><td>${r.tM!=null?r.tM.toFixed(1):"—"}</td><td>${r.tF!=null?r.tF.toFixed(1):"—"}</td></tr>`).join("")}</tbody></table>
    <p class="note" style="margin:8px 0 0">Backtest weeks (GW1-6) run today's model on the data as it stood before each deadline; FPL's figure for those weeks comes from the same pre-deadline data. Live weeks are snapshots taken an hour and 15 minutes before the deadline (FPL's figure saved with them from GW8).</p></div>`;
}
function fixtureAccuracyHTML(){
  if(!S.model||!S.ratingsReady)return `<p class="note" style="padding:14px;margin:0">Ratings not ready.</p>`;
  /* fixtures carry their model teams (ht, at) */
  const done=(S.fixtures||[]).filter(f=>f.finished&&f.hs!=null&&f.as!=null&&f.ht&&f.at);
  if(!done.length)return `<p class="note" style="padding:14px;margin:0">No finished matches yet.</p>`;
  let n=0,e=0,eBase=0,hit=0,games=0,tot=0;
  done.forEach(f=>{const h=f.ht,a=f.at;if(!h||!a)return;tot+=f.hs+f.as;});
  const base=tot/(2*done.length);
  done.forEach(f=>{const h=f.ht,a=f.at;if(!h||!a)return;
    const ph=fdrCalc(h,a,true,"xgf"),pa=fdrCalc(a,h,false,"xgf");
    e+=Math.abs(ph-f.hs)+Math.abs(pa-f.as);eBase+=Math.abs(base-f.hs)+Math.abs(base-f.as);n+=2;
    const pr=ph-pa>0.25?1:pa-ph>0.25?-1:0,ac=f.hs>f.as?1:f.as>f.hs?-1:0;if(pr!==0){games++;if(pr===ac)hit++;}});
  return `<div class="fcgrid c5" style="padding:14px">
    ${figCard("Goals Error","Average miss on each side's goals, today's fixture ratings against this season's results.",(e/n).toFixed(2),"goals per side",null,"#3DDC97","mint")}
    ${figCard("Baseline Error","The same misses if every side were given the season's average goals.",(eBase/n).toFixed(2),`average ${base.toFixed(2)} goals`,null,"#8A8A8A")}
    ${figCard("Skill",`How much better than the baseline (positive = the ratings help).`,`<span class="${eBase>e?"up":"dn"}">${Math.round((1-e/eBase)*100)}%</span>`,"vs the average",null,"#8A8A8A")}
    ${figCard("Favourite Won","When the ratings make one side clearly the better (a quarter of a goal or more), how often that side won.",games?Math.round(hit/games*100)+"%":"—",`${hit} of ${games} matches`,null,"#8A8A8A")}
    ${figCard("Matches","Finished league matches this season used here.",String(done.length),"in-sample: the ratings have seen them",null,"#8A8A8A")}
  </div>`;
}
function oddsStatusHTML(){
  const st=S.oddsState||"idle",fx=(S.odds||[]).length,teams=S.oddsTeams?Object.keys(S.oddsTeams).length/2:0;
  const props=S.propMarket?Object.keys(S.propMarket).length:0;
  const label={ok:"Loaded",live:"Loaded",loading:"Loading",nokey:"No key set on the server",backup:"Not on the backup copy",error:"Failed",idle:"Not loaded"}[st]||st;
  return `<div class="prov">
    <span>Status: <b>${esc(label)}</b>${S.oddsErr?` · ${esc(S.oddsErr)}`:""}</span>
    <span>Fetched: <b>${esc(ukWhen(S.oddsFetchedAt))}</b></span>
    <span>Fixtures priced: <b>${fx}</b></span>
    <span>Fixtures used by the model: <b>${teams}</b></span>
    <span>Players with goal or assist prices: <b>${props}</b></span>
    <span>Player odds in the model: <b>${typeof PROP_W!=="undefined"&&PROP_W>0?"on, weight "+PROP_W:"off (re-test at GW12)"}</b></span>
    ${(S.oddsRejected||[]).length?`<span style="flex-basis:100%;color:var(--amber)">Ignored as stale or in-play: ${esc(S.oddsRejected.join(", "))}</span>`:""}
  </div>`;
}
function optionsHTML(){
  const drafts=LS.get("drafts")||[],ign=(S.ignored||[]).map(id=>S.model&&S.model.players.find(p=>p.id===id)).filter(Boolean);
  return `<div class="pbody" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px">
    <div><div class="note" style="margin-bottom:6px">Compare drafts</div>${drafts.length?`${drafts.map(d=>`<div class="mu" style="font-size:12.5px">${esc(d.label)}</div>`).join("")}<button style="margin-top:8px" onclick="act('cleardrafts')">Delete all ${drafts.length} drafts</button>`:'<span class="mu">None saved.</span>'}</div>
    <div><div class="note" style="margin-bottom:6px">Not suggesting</div>${ign.length?`<span style="display:flex;gap:6px;flex-wrap:wrap">${ign.map(p=>`<button onclick="act('unignore',${p.id})" title="Suggest ${esc(p.web_name)} again">${esc(p.web_name)} ↺</button>`).join("")}<button onclick="act('unignore')">Suggest all again</button></span>`:'<span class="mu">Every player can be suggested.</span>'}</div>
    <div><div class="note" style="margin-bottom:6px">Shortlist</div>${S.stars.length?`<span class="mu">${S.stars.length} players</span> <button onclick="act('clearstars')">Clear</button>`:'<span class="mu">Empty. Tap ★ on Players to add.</span>'}</div>
  </div>`;
}

/* ============================================================
   RESEARCH LIST (20 Oct 2026): funding. Every pair of your players sold
   together, each slot filled through the one engine with the money pooled
   (bestCombo), over 3 or 5 GW. A pair is listed when it beats the best
   single move by half a point or more: a downgrade that pays for an
   upgrade. Each leg shows the money and the points, and points per £1m.
   ============================================================ */
let _fundCache=null;
function fundingHTML(){
  if(!S.model||!S.squad||VG()!==S.model.next.id)return "";
  const h=Math.max(3,S.weekH||1);
  if(!S.fundOn)return `<div class="panel"><div class="phead"><h2>Funding</h2><span class="note">two moves together, over ${h} GW</span>
    <button onclick="act('fundon')">Work out funding moves</button></div></div>`;
  const key=[h,planBank(),S.squad.join("."),(S.ignored||[]).join(".")].join("|");
  if(!_fundCache||_fundCache.key!==key||_fundCache.model!==S.model){
    const single=(bestSwaps(1,h)[0]||{gain:0}).gain,sq=S.squad,res=[];
    for(let i=0;i<sq.length;i++)for(let j=i+1;j<sq.length;j++){
      const c=bestCombo([sq[i],sq[j]],h,6);
      if(!c||c.picks.length!==2||c.gain<single+0.5)continue;
      /* a funding move: one sale frees money for an upgrade the bank alone
         could not pay for */
      const cost=m=>m.inn.price-m.sell,bank=planBank();
      if(c.picks.some(m=>cost(m)<-0.05)&&c.picks.some(m=>cost(m)>bank+0.05))res.push(c);}
    res.sort((a,b)=>b.gain-a.gain);
    _fundCache={key,model:S.model,res:res.slice(0,6),single};
  }
  const F=_fundCache;
  const leg=m=>{const d=m.inn.price-m.sell;
    return `<div class="fleg"><span class="dn">${esc(m.out.web_name)}</span> → <span class="up">${esc(m.inn.web_name)}</span>
      <span class="mu">${d<0?"saves £"+(-d).toFixed(1):"costs £"+d.toFixed(1)}</span> <b class="${m.gain>=0?"up":"dn"}">${sgn1(m.gain)}</b>
      ${Math.abs(d)>=0.5?`<span class="mu">(${sgn1(m.gain/Math.abs(d))} per £1m)</span>`:""}</div>`;};
  return `<div class="panel"><div class="phead"><h2>Funding</h2><span class="note">two moves together, over ${h} GW · best single move ${sgn1(F.single)}</span></div>
    <div class="pbody">${F.res.length?`<div class="tgrid">${F.res.map(c=>`<div class="tcard">${c.picks.map(leg).join("")}
      <div class="fsum"><b class="up">${sgn1(c.gain)}</b> to your XI · £${c.left.toFixed(1)} left
      ${freeLeft(VG())<2?`<span class="dn"> · 2 transfers with ${freeLeft(VG())} free: a ${HIT}-point hit</span>`:""}</div>
      <button class="mini" style="margin-top:6px" onclick="act('dofund',${c.picks[0].out.id},${c.picks[1].out.id})">Make both</button></div>`).join("")}</div>`
      :`<p class="note" style="margin:0">No downgrade that pays for an upgrade beats the best single move by half a point over ${h} GW.</p>`}
    <p class="note" style="margin:8px 0 0">Each pair is a downgrade that pays for an upgrade your bank (£${planBank().toFixed(1)}) could not cover alone: two of your players sold, the best replacements the pooled money allows, scored on your best XI plus captain over the next ${h}. Points per £1m shows what a downgrade gives up for the money it frees, and what an upgrade buys with it.</p></div></div>`;
}

/* ============================================================
   RESEARCH LIST (20 Oct 2026): squad shape. Points per £1m by position and
   price band over the horizon, regular starters only (60+ expected
   minutes), with the best value and the top scorer in each band and your
   own players marked: where the money works hardest.
   ============================================================ */
const PRICE_BANDS={1:[0,4.5,5,99],2:[0,4.5,5,5.5,6.5,99],3:[0,5.5,7,8.5,10,99],4:[0,6,7.5,9,99]};
/* Value (13 Nov 2026, Andy; replaces points per £1m by band). Per position,
   over the window from g: the budget starter (regular starters within £0.5
   of the cheapest), every price band's average and its "vs Budget", the
   extra points each extra £1m buys over the budget starter (bands at least
   £0.5 above it), the best points per £1m in each band (the Player Data
   tick) and the most points available at each price. Shared with Player
   Data's vs Budget column and tick, so the two always agree. */
const _valCache=new Map();
function valueData(from,count){
  const k=from+"|"+count,c=_valCache.get(k);
  if(c&&c.m===S.model)return c.v;
  const P=p=>hPts(p,from,count);
  const reg=S.model.players.filter(p=>p.avail>0&&(p.xMins||0)>=60);
  const lbl=(a,b)=>a===0?`under £${b.toFixed(1)}`:b===99?`£${a.toFixed(1)}+`:`£${a.toFixed(1)}–${(b-0.1).toFixed(1)}`;
  const v={};
  [1,2,3,4].forEach(pos=>{const a=reg.filter(p=>p.pos===pos);if(!a.length)return;
    const mn=Math.min(...a.map(p=>p.price)),b=a.filter(p=>p.price<=mn+0.5);
    const base={pts:b.reduce((s,p)=>s+P(p),0)/b.length,price:b.reduce((s,p)=>s+p.price,0)/b.length};
    const B=PRICE_BANDS[pos],bands=[],best={};
    for(let i=0;i<B.length-1;i++){const ps=a.filter(p=>p.price>=B[i]-1e-9&&p.price<B[i+1]-1e-9);if(!ps.length)continue;
      const ap=ps.reduce((s,p)=>s+P(p),0)/ps.length,apr=ps.reduce((s,p)=>s+p.price,0)/ps.length;
      const bv=ps.reduce((x,y)=>P(y)/y.price>P(x)/x.price?y:x),top=ps.reduce((x,y)=>P(y)>P(x)?y:x);
      const band=lbl(B[i],B[i+1]);best[bv.id]=band;
      bands.push({band,n:ps.length,ap,vs:ap-base.pts,epm:apr-base.price>=0.5?(ap-base.pts)/(apr-base.price):null,bv,top,ps});}
    const bb=bands.filter(x=>x.epm!=null).sort((x,y)=>y.epm-x.epm)[0]||null;
    v[pos]={a,base,bands,best,bb};});
  _valCache.set(k,{m:S.model,v});return v;
}
function squadShapeHTML(g,h,posF){
  const D=valueData(g,h),P=p=>hPts(p,g,h),mine=new Set(effectiveSquadIds(g).ids);
  const PN={1:"Goalkeepers",2:"Defenders",3:"Midfielders",4:"Forwards"};
  const show=[1,2,3,4].filter(pos=>D[pos]&&(!posF||posF===pos));
  if(!show.length)return sgEmpty("No regular starters yet.");
  const f1=v=>v.toFixed(1),sg=v=>(v>=0?"+":"")+v.toFixed(1);
  const tiles=show.map(pos=>{const d=D[pos],b=d.bb;return `<div class="vt"><span>${PN[pos]}</span>
    ${b?`<b>${sg(b.epm)}<small> pts per extra £1m</small></b><em>${b.band} · budget starter ${f1(d.base.pts)} pts at about £${d.base.price.toFixed(1)}</em>`
      :`<em>No band £0.5 or more above the budget starter</em>`}</div>`;}).join("");
  const chart=pos=>{const d=D[pos],W=500,Hh=250,l=40,r=12,t=12,b=30;
    const xs=d.a.map(p=>p.price),ys=d.a.map(P);
    const x0=Math.floor(Math.min(...xs)*2)/2-0.25,x1=Math.ceil(Math.max(...xs)*2)/2+0.25;
    const y0=Math.max(0,Math.floor((Math.min(...ys,d.base.pts)-1)/2)*2),y1=Math.ceil((Math.max(...ys)+1)/2)*2;
    const X=v=>l+(v-x0)/(x1-x0)*(W-l-r),Y=v=>t+(1-(v-y0)/((y1-y0)||1))*(Hh-t-b);
    const yt=[0,1,2,3,4].map(i=>y0+i*(y1-y0)/4);
    const xs2=(x1-x0)>6?2:(x1-x0)>3?1:0.5,xt=[];for(let q=Math.ceil(x0/xs2)*xs2;q<=x1;q+=xs2)xt.push(q);
    /* most points available at or below each price */
    let mx=-1,path="";d.a.slice().sort((p,q)=>p.price-q.price).forEach(p=>{const y=P(p);
      if(y>mx){path+=path?`H${X(p.price).toFixed(1)}V${Y(y).toFixed(1)}`:`M${X(p.price).toFixed(1)},${Y(y).toFixed(1)}`;mx=y;}});
    path+=`H${X(x1).toFixed(1)}`;
    const key=p=>d.best[p.id]||mine.has(p.id);
    const dots=d.a.slice().sort((p,q)=>(key(p)?1:0)-(key(q)?1:0)).map(p=>{const isB=!!d.best[p.id],isM=mine.has(p.id);
      return `<circle cx="${X(p.price).toFixed(1)}" cy="${Y(P(p)).toFixed(1)}" r="${isB||isM?4.5:3.5}" class="${isB?"vb":"vd"}${isM?" vm":""}"><title>${esc(p.web_name)} · £${p.price.toFixed(1)} · ${f1(P(p))} pts · ${sg(P(p)-d.base.pts)} vs budget${isB?` · best value ${d.best[p.id]}`:""}${isM?" · yours":""}</title></circle>`;}).join("");
    /* names for the ticked and your players, yours first, skipping any that
       would overlap a name already placed */
    const placed=[];
    const labs=d.a.filter(key).sort((p,q)=>(mine.has(q.id)?1:0)-(mine.has(p.id)?1:0)).map(p=>{
      const w=p.web_name.length*5.8;let x=X(p.price)+7,anchor="start";const y=Y(P(p))+3.5;
      if(x+w>W-6){x=X(p.price)-7;anchor="end";}
      const lx=anchor==="end"?x-w:x;
      if(placed.some(q=>Math.abs(q.y-y)<11&&lx<q.x+q.w&&lx+w>q.x))return "";
      placed.push({x:lx,y,w});
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" class="${mine.has(p.id)?"vlm":"vl"}">${esc(p.web_name)}</text>`;}).join("");
    return `<div class="vc"><div class="vch"><b>${PN[pos]}</b><span>${d.a.length} regular starters</span></div>
      <svg viewBox="0 0 ${W} ${Hh}" width="100%" role="img" aria-label="${PN[pos]}: model points against price, with the budget starter level">
      ${yt.map(v=>`<line class="vg" x1="${l}" x2="${W-r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="va" x="${l-6}" y="${(Y(v)+3.5).toFixed(1)}" text-anchor="end">${Math.round(v)}</text>`).join("")}
      ${xt.map(v=>`<text class="va" x="${X(v).toFixed(1)}" y="${Hh-10}" text-anchor="middle">£${v.toFixed(v%1?1:0)}</text>`).join("")}
      <line class="vbase" x1="${l}" x2="${W-r}" y1="${Y(d.base.pts).toFixed(1)}" y2="${Y(d.base.pts).toFixed(1)}"/>
      <text class="va" x="${W-r-2}" y="${(Y(d.base.pts)-5).toFixed(1)}" text-anchor="end">budget starter ${f1(d.base.pts)}</text>
      <path class="vf" d="${path}"/>${dots}${labs}</svg></div>`;};
  const rows=show.map(pos=>{const d=D[pos];return d.bands.map((x,i)=>{const mineIn=x.ps.filter(p=>mine.has(p.id));
    return `<tr${i?"":' class="vtop"'}><td class="mu">${i?"":POS[pos]}</td><td>${x.band}</td><td class="r">${x.n}</td><td class="r">${f1(x.ap)}</td>
      <td class="r${x.vs<0?" dn":""}">${sg(x.vs)}</td>
      <td class="r${x===d.bb?" vbest":""}">${x.epm==null?'<span class="mu">—</span>':sg(x.epm)}</td>
      <td><span class="pdbest">✓</span> ${pName(x.bv)} <span class="mu">${(P(x.bv)/x.bv.price).toFixed(2)}/£m</span></td>
      <td>${pName(x.top)} <span class="mu">${f1(P(x.top))}</span></td>
      <td>${mineIn.map(p=>pName(p)).join(", ")||'<span class="mu">—</span>'}</td></tr>`;}).join("");}).join("");
  return `<div class="vt4">${tiles}</div>
    <div class="vcs${show.length===1?" one":""}">${show.map(chart).join("")}</div>
    <div class="vkey"><span><i class="kb"></i>best value in price band</span><span><i class="km"></i>your players</span><span><i class="kl"></i>budget starter</span><span><i class="kf"></i>most points available at each price</span></div>
    <div class="scroll"><table class="vtab"><thead><tr><th></th><th>Price band</th><th class="r">Starters</th><th class="r">Avg pts</th><th class="r" title="Average points above the budget starter">vs Budget</th><th class="r" title="Extra points for each extra £1m over the budget starter (bands £0.5 or more above it)">Per extra £1m</th><th>Best value</th><th>Top scorer</th><th>Yours</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="note">Model points over ${h>1?"GW"+g+"–"+(g+h-1):"GW"+g}, regular starters only (60+ expected minutes). The budget starter is the average of the regular starters priced within £0.5 of the cheapest at that position.</p>`;
}

/* ============================================================
   RESEARCH LIST (20 Oct 2026): chip timing in one table. The next ten
   gameweeks: double and blank gameweeks across the league, how many of
   your squad play (and twice), your best XI plus captain, and what Bench
   Boost, Triple Captain and Free Hit would add each week (the same values
   as the bars below). The best week for each chip is green.
   ============================================================ */
function chipTimingHTML(g){
  if(!S.model)return "";
  const ids=effectiveSquadIds(g).ids,byId=new Map(S.model.players.map(p=>[p.id,p]));
  const weeks=[];for(let e=g;e<g+10&&e<=38;e++)weeks.push(e);
  const val={};
  ["bboost","3xc","freehit"].forEach(k=>{val[k]={};[1,2].forEach(hf=>{
    if(chipPlayed(k+hf)!=null)return;
    try{Object.entries(chipAllWeeks(k+hf)||{}).forEach(([e,v])=>{val[k][e]=v;});}catch(err){}});});
  const best=k=>{let b=null;weeks.forEach(e=>{const v=val[k][e];if(v!=null&&(b==null||v>val[k][b]))b=e;});return b;};
  const bk={bboost:best("bboost"),"3xc":best("3xc"),freehit:best("freehit")};
  const rows=weeks.map(e=>{
    const n={};(S.model.byEv[e]||[]).forEach(f=>{if(f.ht)n[f.ht.id]=(n[f.ht.id]||0)+1;if(f.at)n[f.at.id]=(n[f.at.id]||0)+1;});
    const dbl=S.model.teams.filter(t=>(n[t.id]||0)>=2),blank=S.model.teams.filter(t=>!n[t.id]);
    const sq=ids.map(i=>byId.get(i)).filter(Boolean);
    const play=sq.filter(p=>(p.gw[e]?.fixtures||[]).length>0).length,twice=sq.filter(p=>(p.gw[e]?.fixtures||[]).length>=2).length;
    const cell=k=>{const v=val[k][e];return v==null?'<td class="mu">—</td>':`<td><b class="${bk[k]===e?"up":""}">+${v.toFixed(1)}</b></td>`;};
    return `<tr><td>GW${e}</td><td>${dbl.length?dbl.map(t=>esc(t.short)).join(" "):'<span class="mu">—</span>'}</td>
      <td>${blank.length?`<span class="dn">${blank.map(t=>esc(t.short)).join(" ")}</span>`:'<span class="mu">—</span>'}</td>
      <td>${play}/15${twice?` <span class="up">(${twice} twice)</span>`:""}</td><td>${xiTotal(ids,e,byId).toFixed(1)}</td>
      ${cell("bboost")}${cell("3xc")}${cell("freehit")}</tr>`;}).join("");
  return `<div class="panel"><div class="phead"><h2>Chip Timing</h2><span class="note">next ${weeks.length} gameweeks · chips already played show —</span></div>
    <div class="scroll"><table class="mkt"><thead><tr><th>Week</th><th>Doubles</th><th>Blanks</th><th>Your squad plays</th><th>Your XI</th><th>Bench Boost</th><th>Triple Captain</th><th>Free Hit</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="pbody"><p class="note" style="margin:0">Your XI is your current squad's best XI plus captain each week; a run of low weeks is the time to Wildcard (the Wildcard row below shows it over three-week runs). Chip values match the bars in each chip's row below.</p></div></div>`;
}

/* ============================================================
   RESEARCH LIST (20 Oct 2026): signal hit rates. For each finished week
   with a saved pre-deadline prediction: Buy (the top six per position by
   that prediction) and Heating Up / Cooling Off (worked out from the
   matches before that week only). How many points the flagged players
   scored, against their prediction and against everyone else at the same
   positions. Sell, Price and Differential need the state of each week,
   which was not saved, so they are not graded.
   ============================================================ */
function signalHitsHTML(){
  const A=S.playerActuals;if(!A||!S.model)return "";
  const byId=new Map(S.model.players.map(p=>[String(p.id),p]));
  const acc={buy:[],heat:[],cool:[],base:[],baseAtt:[]};let weeks=0;
  for(let g=1;g<=38;g++){
    if(!weekFinal(g))continue;
    const live=S.predLive&&S.predLive.gw&&S.predLive.gw[g],back=S.predBack&&S.predBack.gw&&S.predBack.gw[g];
    const snap=live||back;if(!snap||!snap.players)continue;
    const rows=[];
    Object.entries(snap.players).forEach(([id,pred])=>{const p=byId.get(id),a=A[id]||A[+id];const pts=a?(a[g]??a[String(g)]):null;
      if(!p||pts==null||pred<1)return;rows.push({p,pred,pts});});
    if(!rows.length)continue;weeks++;
    [1,2,3,4].forEach(pos=>rows.filter(r=>r.p.pos===pos).sort((x,y)=>y.pred-x.pred).forEach((r,i)=>{(i<6?acc.buy:acc.base).push(r);}));
    /* the same rules as the icons, from the matches before that week */
    rows.filter(r=>r.p.pos!==4).forEach(r=>{const mo=momentum(r.p,g);if(!mo)return;
      if(mo.heat)acc.heat.push(r);else if(mo.cool)acc.cool.push(r);else acc.baseAtt.push(r);});
  }
  if(!weeks)return "";
  const avg=(a,f)=>a.length?a.reduce((s,r)=>s+f(r),0)/a.length:null;
  const line=(name,list,base,note)=>{if(!list.length&&/Heat|Cool/.test(name))return `<tr><td style="text-align:left">${name}</td><td>0</td><td colspan="6" style="text-align:left" class="mu">Needs six matches before the week, so the first flags can be graded from GW8.</td></tr>`;
    const ap=avg(list,r=>r.pts),pr=avg(list,r=>r.pred),d=avg(list,r=>r.pts-r.pred),bp=avg(base,r=>r.pts),bd=avg(base,r=>r.pts-r.pred);
    return `<tr><td style="text-align:left">${name}</td><td>${list.length}</td><td>${ap==null?"—":ap.toFixed(2)}</td><td>${pr==null?"—":pr.toFixed(2)}</td>
      <td>${d==null?"—":`<b class="${d>=0?"up":"dn"}">${sgn1(d)}</b>`}</td><td>${bp==null?"—":bp.toFixed(2)}</td><td>${bd==null?"—":sgn1(bd)}</td><td style="text-align:left;white-space:normal" class="mu">${note}</td></tr>`;};
  return `<div class="scroll" style="padding:0 14px 14px"><table class="mkt"><thead><tr><th style="text-align:left">Signal</th><th>Flags</th><th>Points</th><th>Predicted</th><th>Beat prediction</th><th>Others' points</th><th>Others vs prediction</th><th style="text-align:left">Compared with</th></tr></thead><tbody>
    ${line(SIGNAL.buy[2],acc.buy,acc.base,"the rest of the players at the same positions")}
    ${line(SIGNAL.heat[2],acc.heat,acc.baseAtt,"keepers, defenders and midfielders with no trend")}
    ${line(SIGNAL.cool[2],acc.cool,acc.baseAtt,"keepers, defenders and midfielders with no trend")}
    </tbody></table><p class="note" style="margin:8px 0 0">Over ${weeks} finished gameweeks with a saved pre-deadline prediction (players predicted 1 point or more). "Beat prediction" above zero means the signal knew something the prediction did not. Sell, Price Rise/Fall, Minutes Risk, Rival Threat and Differential are not graded: they depend on that week's squad, prices and ownership, which were not saved.</p></div>`;
}

/* ============================================================
   SIGNALS IN FOUR TABS (25 Oct 2026, Andy): Transfers, My Squad, Teams,
   Players. Each report is a card drawn the Fintel Reports way: icon and
   title, (i) for the explanation, fold; key figures in a row; charts with
   faint gridlines and a hover card (data-tip "title|figure|note"); ranked
   bars for leaderboards, split bars for plus and minus, columns for weeks.
   ============================================================ */
LUCIDE["chevron-up"]='<path d="m18 15-6-6-6 6"/>';
const SG_TABS=[["transfers","Transfers"],["squad","My Squad"],["teams","Teams"],["players","Players"]];
const SG_TONE={mint:"#3DDC97",red:"#FF5A6E",amber:"#FFB020",grey:"#8A8A8A",ice:"#BAE6FD",purple:"#B388FF",cyan:"#22D3EE"};
function rep(key,icon,title,info,body,o){
  o=o||{};const shut=(S.sigFold||[]).includes(key);
  return `<section class="rep sgcard${o.wide?" wide":""}${o.bare?" bare":""}${shut?" shut":""}" id="r-${key}">
    <header class="rh"><span class="rhi">${lic(icon,16)}</span><h3>${title}</h3>${o.badge!=null?`<span class="rbadge">${o.badge}</span>`:""}
      ${info?`<button class="fci" data-tip="${esc(info)}" aria-label="About ${esc(title)}">i</button>`:""}
      <button class="rfold sgfold" onclick="act('sigfold','${key}')" aria-expanded="${!shut}" aria-label="${shut?"Open":"Fold"} ${esc(title)}">${lic(shut?"chevron-down":"chevron-up",14)}</button></header>
    ${shut?"":`<div class="rb">${body}</div>`}</section>`;
}
const sgEmpty=t=>`<p class="sgempty">${t}</p>`;
/* key figures: [{label, value, sub, tone}] */
const rkv=figs=>`<div class="rkv">${figs.map(f=>`<div><span>${f.label}</span><b class="${f.tone||""}">${f.value}</b>${f.sub?`<em>${f.sub}</em>`:""}</div>`).join("")}</div>`;
/* ranked bars: rows [{label, sub, value, show, tone, pid, mine, extra}] */
function hbars(rows,o){
  o=o||{};if(!rows.length)return sgEmpty(o.empty||"Nobody right now.");
  const mx=Math.max(...rows.map(r=>Math.abs(r.value)),1e-9),lo=o.from!=null?o.from:0;
  return `<div class="hb${o.diverge?" dv":""}">${rows.map((r,i)=>{
    const w=o.diverge?Math.abs(r.value)/mx*50:Math.max(2,(r.value-lo)/((mx-lo)||1)*100);
    const tone=r.tone||(o.diverge?(r.value>=0?SG_TONE.mint:SG_TONE.red):SG_TONE.mint);
    return `<div class="hbr${r.mine?" me":""}"${r.pid?` onclick="act('card',${r.pid})"`:""}>
      ${o.rank?`<span class="hbn">${i+1}</span>`:""}<span class="hbl"><b>${r.label}</b>${r.sub?`<em>${r.sub}</em>`:""}</span>
      <span class="hbt"><i class="${o.diverge?(r.value<0?"neg":"pos"):""}" style="width:${w.toFixed(1)}%;background:${tone}"></i></span>
      <span class="hbv">${r.show!=null?r.show:r.value}</span>${r.extra||""}</div>`;}).join("")}</div>`;
}
/* week columns with optional line series:
   cats [labels], bars [{name, values, color}], lines [{name, values, color, dots}], stacked */
function colChart(cats,bars,lines,o){
  o=o||{};lines=lines||[];if(!cats.length)return sgEmpty(o.empty||"Nothing to draw yet.");
  const W=o.w||640,H=o.h||210,pl=38,pr=8,pt=10,pb=24,pw=W-pl-pr,ph=H-pt-pb;
  const all=[...(o.stacked?cats.map((c,i)=>bars.reduce((s,b)=>s+(b.values[i]||0),0)):bars.flatMap(b=>b.values)),...lines.flatMap(l=>l.values)].filter(v=>v!=null);
  const lo=o.min!=null?o.min:Math.min(0,...all);let hi=Math.max(...all,1);
  const step=(()=>{const r=(hi-lo)/4,m=Math.pow(10,Math.floor(Math.log10(r||1)));return [1,2,2.5,5,10].map(x=>x*m).find(x=>x>=r)||r;})();
  hi=lo+Math.ceil((hi-lo)/step)*step;
  const y=v=>pt+ph-(v-lo)/((hi-lo)||1)*ph,slot=pw/cats.length;
  const fmt=o.fmt||(v=>Math.round(v));
  let g="";
  for(let v=lo;v<=hi+1e-9;v+=step)g+=`<line class="${Math.abs(v)<1e-9?"czero":"cgrid"}" x1="${pl}" x2="${W-pr}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="cax" x="${pl-6}" y="${(y(v)+4).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`;
  cats.forEach((c,i)=>{
    const x0=pl+slot*i;
    if(o.stacked){let acc=0;const bw=Math.min(34,slot*.62);
      bars.forEach(b=>{const v=b.values[i]||0;if(!v)return;const y1=y(acc+v),y0=y(acc);acc+=v;
        g+=`<rect class="cbar" x="${(x0+(slot-bw)/2).toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(.5,y0-y1).toFixed(1)}" rx="3" fill="${b.color}" data-tip="${esc(c)}|${esc(b.name)} ${fmt(v)}|"/>`;});}
    else{const n=bars.length||1,bw=Math.min(26,(slot*.7)/n);
      bars.forEach((b,k)=>{const v=b.values[i];if(v==null)return;const yt=y(Math.max(v,0)),yb=y(Math.min(v,0));
        g+=`<rect class="cbar" x="${(x0+(slot-bw*n)/2+bw*k).toFixed(1)}" y="${yt.toFixed(1)}" width="${(bw-2).toFixed(1)}" height="${Math.max(.5,yb-yt).toFixed(1)}" rx="4" fill="${b.color}" data-tip="${esc(c)}|${esc(b.name)} ${fmt(v)}|${esc((b.notes||[])[i]||"")}"/>`;});}
    g+=`<text class="cax" x="${(x0+slot/2).toFixed(1)}" y="${H-6}" text-anchor="middle">${esc(c)}</text>`;
  });
  lines.forEach(l=>{const pts=l.values.map((v,i)=>v==null?null:[pl+slot*i+slot/2,y(v)]);
    const seg=pts.filter(Boolean).map(p=>p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ");
    if(!l.dotsOnly)g+=`<polyline points="${seg}" fill="none" stroke="${l.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${l.dash?' stroke-dasharray="4 4"':""}/>`;
    pts.forEach((p,i)=>{if(p)g+=`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${l.dotsOnly?4:3}" fill="${l.color}" data-tip="${esc(cats[i])}|${esc(l.name)} ${fmt(l.values[i])}|"/>`;});});
  const legend=[...bars.map(b=>[b.name,b.color,"sq"]),...lines.map(l=>[l.name,l.color,l.dotsOnly?"dot":"ln"])];
  return `<div class="chartbox"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label||"Chart")}">${g}</svg>
    ${legend.length>1||o.legend?`<div class="clegend">${legend.map(([n,c,k])=>`<span><i class="${k}" style="background:${c}"></i>${esc(n)}</span>`).join("")}</div>`:""}</div>`;
}
/* chance of playing as a ring */
function ringSVG(p,size,color){const r=size/2-3,c=2*Math.PI*r;
  return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#262626" stroke-width="4"/>
  <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${(c*p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size/2} ${size/2})"/></svg>`;}
const sgPos=p=>`<span class="sgpos p${p.pos}">${POS[p.pos]}</span>`;
function sgSpark(p,G){const pa=S.playerActuals||{},a=pa[p.id]||pa[String(p.id)]||{},vals=[];
  for(let e=G-6;e<G;e++)if(e>=1)vals.push(a[e]??a[String(e)]??null);
  const max=Math.max(8,...vals.map(v=>v||0)),bw=5,gap=2,h=18,wd=Math.max(1,vals.length*(bw+gap)-gap);
  return `<svg class="sgspark" width="${wd}" height="${h}" viewBox="0 0 ${wd} ${h}" aria-hidden="true">${vals.map((v,i)=>{const bh=v==null?2:Math.max(2,Math.round(Math.max(v,0)/max*h));
    return `<rect x="${i*(bw+gap)}" y="${h-bh}" width="${bw}" height="${bh}" rx="1.5" fill="${v==null?"#262626":v>=8?"#3DDC97":v>=4?"#7FA8C9":"#55606F"}"/>`;}).join("")}</svg>`;}

/* the page: header, tabs, position and horizon, then the tab's reports */
function signalsHTML(){
  if(!S.model)return "";
  const G=VG(),H=S.sigH||3,posF=S.sigPos||0,tab=SG_TABS.some(([k])=>k===S.sgTab)?S.sgTab:"transfers";
  const seg=(items,cur,k)=>`<span class="hz">${items.map(([v,l])=>`<button class="${cur===v?"on":""}" aria-pressed="${cur===v}" onclick="act('${k}',${typeof v==="string"?`'${v}'`:v})">${l}</button>`).join("")}</span>`;
  const usesPos=tab==="transfers"||tab==="players";
  const body={transfers:sgTransfers,squad:sgSquad,teams:sgTeams,players:sgPlayers}[tab](G,H,posF);
  return `<div class="sgpage" data-tab="${tab}">
    <div class="pagetabs"><h1>Signals</h1><span class="pseg sgtabs">${SG_TABS.map(([k,n])=>`<button class="${tab===k?"on":""}" onclick="act('sgtab','${k}')">${n}</button>`).join("")}</span></div>
    <div class="hubctl">${usesPos?seg([[0,"All"],[1,"GKP"],[2,"DEF"],[3,"MID"],[4,"FWD"]],posF,"sigpos"):""}
      ${seg([[1,"Next GW"],[3,"Next 3"],[5,"Next 5"]],H,"sigh")}
      <span class="note">Gameweek ${G}${tab==="transfers"?` · bank £${planBank().toFixed(1)} · ${freeWeek(G)?"free week":freeLeft(G)+" free transfer"+(freeLeft(G)===1?"":"s")}`:""}</span></div>
    ${body}</div>`;
}
const sgOk=(p,posF)=>!posF||p.pos===posF;
const hzL=H=>H>1?`next ${H}`:"next GW";

/* ---------------- Transfers ---------------- */
function sgTransfers(G,H,posF){
  const mine=new Set(S.squad||[]),M=S.model;
  const moves=bestSwaps(40,H).filter(m=>sgOk(m.out,posF));
  const first=new Map();engineMoves({squad:S.squad||[],bank:planBank(),g:G,h:H}).forEach(m=>{if(!first.has(m.out.id))first.set(m.out.id,m);});
  const sells=[...first.values()].filter(m=>m.gain>=2&&sgOk(m.out,posF)).sort((a,b)=>b.gain-a.gain);
  const L=p=>fplLive(p)||{};
  const rising=M.players.filter(p=>mine.has(p.id)&&L(p).pcp>=70);
  const top=moves[0];
  const figs=rkv([
    {label:"Best Move",value:top?`<span class="up">${sgn1(top.gain)}</span>`:"Hold",sub:top?`${esc(top.out.web_name)} → ${esc(top.inn.web_name)}`:"no move adds to your XI"},
    {label:"Sell Flags",value:String(sells.length),sub:`yours, ${hzL(H)}`,tone:sells.length?"bad":""},
    {label:"Your Players Rising",value:String(rising.length),sub:"FPL predictor 70%+",tone:rising.length?"good":""},
    {label:"Bank",value:`£${planBank().toFixed(1)}`,sub:`squad £${squadBudget().toFixed(1)} to spend`},
    {label:"Free Transfers",value:freeWeek(G)?"Unlimited":String(freeTransfers()),sub:hitCost(G)?`<span class="dn">−${hitCost(G)} hit planned</span>`:"no hit planned"}]);
  const mkBtn=m=>`<button class="mini" onclick="event.stopPropagation();act('doswap',${m.out.id},${m.inn.id})">Make</button>`;
  const moveRow=m=>({label:`${esc(m.out.web_name)} → ${esc(m.inn.web_name)}`,sub:`${esc(m.inn.teamName)} · ${POS[m.inn.pos]} · £${m.inn.price.toFixed(1)}`,value:m.gain,show:sgn1(m.gain),pid:m.inn.id,extra:mkBtn(m)});
  const why=p=>{const w=[];if(p.form<3)w.push(`form ${p.form.toFixed(1)}`);if(p.avail<1)w.push(`${Math.round(p.avail*100)}% fit`);if((p.xMins||0)<45)w.push(`${Math.round(p.xMins||0)}′ expected`);return w;};
  const sellBody=sells.length?`<div class="mvgrid">${sells.map(m=>`<div class="mv">
      <div class="mvh"><span class="dn">${esc(m.out.web_name)}</span><span class="arr">→</span><span class="up">${esc(m.inn.web_name)}</span><b class="up">${sgn1(m.gain)}</b></div>
      <div class="mvs">${esc(m.inn.teamName)} · £${m.inn.price.toFixed(1)} · to your XI, ${hzL(H)}</div>
      ${why(m.out).length?`<div class="sgwhy">${why(m.out).map(r=>`<span class="sgchip">${esc(r)}</span>`).join("")}</div>`:""}
      <button class="mini" onclick="act('doswap',${m.out.id},${m.inn.id})">Make this transfer</button></div>`).join("")}</div>`
    :sgEmpty(`No player of yours has a replacement worth 2+ points to your XI over the ${hzL(H)}.`);
  const pc=M.players.filter(p=>L(p).pcp!=null&&sgOk(p,posF));
  const pcRow=p=>({label:esc(p.web_name),sub:`${esc(p.teamName)} · £${p.price.toFixed(1)}${mine.has(p.id)?" · yours":""}`,value:Math.max(-150,Math.min(150,L(p).pcp)),show:`${Math.round(L(p).pcp)}%`,pid:p.id,mine:mine.has(p.id)});
  const up=pc.filter(p=>L(p).pcp>0).sort((a,b)=>L(b).pcp-L(a).pcp).slice(0,8),dn=pc.filter(p=>L(p).pcp<0).sort((a,b)=>L(a).pcp-L(b).pcp).slice(0,8);
  const stats=new Map((S.players||[]).map(p=>[p.id,p.stats||{}]));
  const net=p=>{const s=stats.get(p.id)||{};return num(s.transfers_in_event)-num(s.transfers_out_event);};
  const k=n=>(n>=0?"+":"−")+Math.abs(Math.round(n/1000))+"k";
  const tr=M.players.filter(p=>sgOk(p,posF));
  const bought=tr.slice().sort((a,b)=>net(b)-net(a)).slice(0,8),sold=tr.slice().sort((a,b)=>net(a)-net(b)).slice(0,8);
  const netRow=p=>({label:esc(p.web_name),sub:`${esc(p.teamName)} · ${p.owned}% owned`,value:net(p),show:k(net(p)),pid:p.id,mine:mine.has(p.id)});
  const diffs=M.players.filter(p=>p.owned<5&&(p.xMins||0)>=60&&p.avail>0&&sgOk(p,posF)).sort((a,b)=>hPts(b,G,H)-hPts(a,G,H)).slice(0,8);
  const cold=M.players.filter(p=>p.owned>=10&&p.form<=3&&sgOk(p,posF)).sort((a,b)=>b.owned-a.owned).slice(0,8);
  return figs+`<div class="sggrid1">${rep("board","sparkles","Signal Board",`Every player carrying each signal now, yours first, points over the ${hzL(H)}. Hover a tile for its rule.`,signalBoardHTML(G,H,posF,true),{wide:true})}</div>
  <div class="repgrid">
    ${rep("topmoves","circle-arrow-up","Top Moves",`The best single transfers, each scored by what it adds to your best XI plus captain over the ${hzL(H)} (later weeks count a little less). Make does the transfer in the Planner.`,hbars(moves.slice(0,10).map(moveRow),{empty:"No single move adds to your XI."}))}
    ${rep("sqrep","circle-arrow-down","Sell",`Your players whose best affordable replacement adds 2 or more points to your XI over the ${hzL(H)} (the Sell icon's rule). Chips show why he may be struggling.`,sellBody)}
  </div>
  <div class="repgrid">
    ${rep("funding","wallet","Funding","A downgrade that pays for an upgrade your bank could not cover alone, both scored on your XI.",(S.fundOn?fundingHTML():`<p class="rnote" style="margin:0 0 10px">Checks every pair of your players sold together (takes a second).</p><button onclick="act('fundon')">Work out funding moves</button>`)||sgEmpty("Funding works from the live gameweek."),{bare:true})}
    ${rep("plan5","calendar","Five-Week Plan","Week by week, the best move if it beats rolling the transfer, otherwise roll.",planPanelHTML()||sgEmpty("The plan starts from the live gameweek."),{bare:true})}
  </div>
  ${rep("bypos","target","Best Moves by Position","Up to four moves per position, each worth a transfer on its own.",transfersHTML("bypos"),{wide:true})}
  ${rep("several","arrow-right-left","Plan Several Transfers","Pick the players to sell; the best combination for the money they free.",transfersHTML("picker"),{wide:true,bare:true})}
  <div class="repgrid">
    ${rep("pricewatch","trending-up","Price Watch","FPL's own predictor: progress towards tonight's change (100% = it changes). Risers right, fallers left; yours highlighted.",
      up.length||dn.length?`<div class="split2"><div><h4 class="rsub">Closest to a rise</h4>${hbars(up.map(pcRow),{diverge:true})}</div><div><h4 class="rsub">Closest to a fall</h4>${hbars(dn.map(pcRow),{diverge:true})}</div></div>`:sgEmpty("FPL's price predictor did not load."))}
    ${rep("netmoves","users","Most Bought and Sold","Net transfers this gameweek (in minus out), FPL's own counts.",
      `<div class="split2"><div><h4 class="rsub">Most bought</h4>${hbars(bought.map(netRow),{diverge:true})}</div><div><h4 class="rsub">Most sold</h4>${hbars(sold.map(netRow),{diverge:true})}</div></div>`)}
  </div>
  <div class="repgrid">
    ${rep("diff","gem","Differentials",`Under 5% owned, 60+ expected minutes, ranked by points over the ${hzL(H)}.`,hbars(diffs.map(p=>({label:esc(p.web_name),sub:`${esc(p.teamName)} · ${POS[p.pos]} · ${p.owned}% owned`,value:hPts(p,G,H),show:hPts(p,G,H).toFixed(1),pid:p.id,tone:SG_TONE.ice})),{rank:true}))}
    ${rep("sell","trending-down","Sell Signals","Owned by 10% or more with form at 3 or under: template players gone cold.",hbars(cold.map(p=>({label:esc(p.web_name),sub:`${esc(p.teamName)} · form ${p.form.toFixed(1)}`,value:p.owned,show:p.owned.toFixed(1)+"%",pid:p.id,tone:SG_TONE.red,mine:mine.has(p.id)})),{rank:true}))}
  </div>
  ${(S.ignored||[]).length?rep("ignored","ban","Not Suggesting","Players taken off the suggestions; tap one to bring him back.",transfersHTML("ignored"),{bare:true,wide:true}):""}`;
}

/* ---------------- My Squad ---------------- */
function sgSquad(G,H){
  const M=S.model,mine=new Set(S.squad||[]),sq=M.players.filter(p=>mine.has(p.id));
  const T=((S.tracker&&S.tracker.gw)||[]).slice().sort((a,b)=>a.event-b.event);
  const evs=(S.events||[]).filter(e=>e.finished).sort((a,b)=>a.id-b.id);
  const A=S.playerActuals||{},act=(id,e)=>{const a=A[id]||A[String(id)];const v=a?(a[e]??a[String(e)]):null;return v==null?null:+v;};
  const fin=T.filter(r=>evs.some(e=>e.id===r.event));
  /* score against the game */
  const vs=fin.map(r=>({r,e:evs.find(x=>x.id===r.event)}));
  const seasonD=vs.reduce((s,x)=>s+(x.e.avg?r0(x.r.points-x.e.avg):0),0);
  function r0(v){return Math.round(v);}
  const last=vs[vs.length-1];
  /* captain against the best in the XI */
  const cap=T.filter(r=>Array.isArray(r.picks)&&r.picks.length).map(r=>{
    const c=r.picks.find(p=>p.isC)||r.picks.find(p=>p.multiplier>=2);let best=null;
    r.picks.filter(p=>p.multiplier>0).forEach(p=>{const v=act(p.id,r.event);if(v!=null&&(!best||v>best.v))best={id:p.id,v};});
    return{e:r.event,c:c&&{id:c.id,v:act(c.id,r.event)},best};}).filter(x=>x.c&&x.c.v!=null&&x.best);
  const lost=cap.reduce((s,x)=>s+(x.best.v-x.c.v),0);
  const nm=id=>{const p=M.players.find(x=>x.id===+id);return p?p.web_name:"#"+id;};
  /* league */
  const st=((S.rivalsFeed&&S.rivalsFeed.standings)||[]).slice().sort((a,b)=>a.rank-b.rank);
  const meRow=st.find(s=>String(s.entryId)===String(TEAM_ID));
  const figs=rkv([
    {label:"Season Points",value:T.length?String(T[T.length-1].totalPoints??T.reduce((s,r)=>s+(r.points||0),0)):"—",sub:last?`GW${last.r.event}: ${last.r.points}`:""},
    {label:"Overall Rank",value:S.entryRank?S.entryRank.toLocaleString():"—",sub:S.entryRankGw?`after GW${S.entryRankGw}`:""},
    {label:"Against The Average",value:`<span class="${seasonD>=0?"up":"dn"}">${seasonD>=0?"+":""}${seasonD}</span>`,sub:`over ${vs.length} finished weeks`},
    {label:"Armband Missed",value:String(lost),sub:"points, with hindsight",tone:lost?"bad":""},
    {label:"League Position",value:meRow?`${meRow.rank} of ${st.length}`:"—",sub:meRow&&st[0]&&meRow!==st[0]?`${st[0].totalPoints-meRow.totalPoints} behind the leader`:meRow?"leading":""}]);
  const vsChart=colChart(vs.map(x=>"GW"+x.r.event),[{name:"You",values:vs.map(x=>x.r.points),color:SG_TONE.mint}],
    [{name:"Average",values:vs.map(x=>x.e.avg),color:SG_TONE.grey},{name:"Highest",values:vs.map(x=>x.e.high),color:SG_TONE.amber,dotsOnly:true}],{label:"Your points against the game's average and highest each week"});
  const vsNote=last?`<p class="rnote rlatest">GW${last.r.event}: you ${last.r.points} · average ${last.e.avg??"—"} · highest ${last.e.high??"—"}</p>`:"";
  const capChart=colChart(cap.map(x=>"GW"+x.e),[{name:"Captain",values:cap.map(x=>x.c.v),color:SG_TONE.amber,notes:cap.map(x=>nm(x.c.id))},
    {name:"Best in XI",values:cap.map(x=>x.best.v),color:"#5A5A5A",notes:cap.map(x=>nm(x.best.id))}],[],{label:"Captain's points against the best scorer in your XI"});
  const capList=cap.slice().reverse().filter(x=>x.best.v>x.c.v).slice(0,4).map(x=>`<span class="sgchip">GW${x.e}: ${esc(nm(x.c.id))} ${x.c.v} vs ${esc(nm(x.best.id))} ${x.best.v}</span>`).join("");
  const vb=T.filter(r=>r.value!=null);
  const valChart=colChart(vb.map(r=>"GW"+r.event),[],[{name:"Team value",values:vb.map(r=>+r.value),color:SG_TONE.mint}],{min:Math.floor(Math.min(...vb.map(r=>+r.value),100)-1),fmt:v=>"£"+v.toFixed(1),w:340,h:190,label:"Team value by week"});
  const bankChart=colChart(vb.map(r=>"GW"+r.event),[{name:"Bank",values:vb.map(r=>+(r.bank||0)),color:SG_TONE.cyan}],[],{fmt:v=>"£"+v.toFixed(1),w:340,h:190,label:"Bank by week"});
  const form=sq.slice().sort((a,b)=>b.form-a.form);
  const flags=sq.filter(p=>p.status!=="a"||p.avail<1);
  const ents=(S.rivalsFeed&&S.rivalsFeed.entries)||{};
  const half=M.next.id>=20?2:1,KIND=[["wildcard","Wildcard"],["freehit","Free Hit"],["bboost","Bench Boost"],["3xc","Triple Captain"]],inHalf=e=>half===1?e<=19:e>=20;
  const meChips=[];KIND.forEach(([k])=>{const e=chipPlayed(k+half);if(e!=null)meChips.push({name:k,event:e});});
  const chipRows=[["You",meChips,true],...Object.entries(ents).filter(([id])=>String(id)!==String(TEAM_ID)).map(([id,e])=>[e.name||id,e.chips||[],false])];
  const chipGrid=Object.keys(ents).length?`<div class="scroll"><table class="cgridt"><thead><tr><th style="text-align:left">Manager</th>${KIND.map(([,n])=>`<th>${n}</th>`).join("")}<th>Left</th></tr></thead><tbody>
    ${chipRows.map(([n,used,me])=>{const u=used.filter(c=>inHalf(c.event));let left=0;
      return `<tr class="${me?"me":""}"><td style="text-align:left">${esc(n)}</td>${KIND.map(([k])=>{const c=u.find(x=>x.name===k);if(!c)left++;
        return c?`<td><span class="cused">GW${c.event}</span></td>`:`<td><span class="cleft" title="Still to play">●</span></td>`;}).join("")}<td><b>${left}</b></td></tr>`;}).join("")}</tbody></table></div>`:sgEmpty("League feed not loaded.");
  const ge=evs.filter(e=>(e.chips||[]).length);
  const CH=[["wildcard","Wildcard",SG_TONE.purple],["freehit","Free Hit",SG_TONE.cyan],["bboost","Bench Boost",SG_TONE.mint],["3xc","Triple Captain",SG_TONE.amber]];
  const chipPlays=colChart(ge.map(e=>"GW"+e.id),CH.map(([k,n,c])=>({name:n,color:c,values:ge.map(e=>{const x=(e.chips||[]).find(y=>y.name===k);return x?Math.round(x.n/1000):0;})})),[],
    {stacked:true,fmt:v=>v>=1000?(v/1000).toFixed(1)+"m":Math.round(v)+"k",legend:true,label:"Chip plays across the game each week"});
  const lead=st[0];
  const gaps=hbars(st.map(s=>({label:esc(s.entryName||""),sub:`${esc(s.manager||"")}${s===lead?" · leader":` · −${lead.totalPoints-s.totalPoints} lead`}`,value:s.totalPoints,show:String(s.totalPoints),mine:String(s.entryId)===String(TEAM_ID),tone:String(s.entryId)===String(TEAM_ID)?SG_TONE.mint:"#5A5A5A"})),
    {rank:true,from:st.length?Math.min(...st.map(s=>s.totalPoints))-25:0,empty:"League feed not loaded."});
  return figs+`<div class="repgrid">
    ${rep("vsgame","gauge","Your Score vs The Game","Your points each finished gameweek (bars) against the game's average (line) and the highest score (dots), FPL's own figures.",vsChart+vsNote)}
    ${rep("captbest","crown","Captain vs Best Pick","Your captain's points each week against the best scorer in your starting XI, with hindsight. The gap is what the armband missed.",capChart+(capList?`<div class="sgwhy" style="margin-top:8px">${capList}</div>`:""))}
  </div>
  <div class="repgrid">
    ${rep("bankval","wallet","Bank and Team Value","Team value (bank included, FPL's figure) and money in the bank after each gameweek.",`<div class="split2"><div><h4 class="rsub">Team value</h4>${valChart}</div><div><h4 class="rsub">Bank</h4>${bankChart}</div></div>`)}
    ${rep("sqform","flame","In Form","Your players by form (average points per game, last 30 days); bars are points in each of the last six gameweeks.",
      hbars(form.map(p=>({label:esc(p.web_name),sub:`${esc(p.teamName)} · ${POS[p.pos]}`,value:p.form,show:p.form.toFixed(1),pid:p.id,tone:p.form>=5?SG_TONE.mint:p.form>=3?"#7FA8C9":"#55606F",extra:sgSpark(p,G)}))))}
  </div>
  <div class="repgrid">
    ${rep("sqflag","clock-alert","Availability","Your players with an injury, suspension or doubt flag, and the chance of playing.",
      flags.length?`<div class="avl">${flags.map(p=>`<div class="sgrow" onclick="act('card',${p.id})">${ringSVG(p.avail,34,p.avail>=.75?SG_TONE.amber:SG_TONE.red)}
        <span class="sgwho"><b>${esc(p.web_name)}</b><em>${esc(p.news||(p.avail>0?"Doubtful":"Unavailable"))}</em></span><span></span>
        <span class="sgfig"><b>${p.avail>0?Math.round(p.avail*100)+"%":"Out"}</b><em>chance</em></span></div>`).join("")}</div>`:sgEmpty("Everyone in your squad is fit."))}
    ${rep("captaincy","crown","Captaincy","Your captain options this week: predicted points, the gap to the best option, chance of playing, the bookmakers' chance he scores, haul chance and how many rivals captained him last week.",captaincyHTML()||sgEmpty("Captaincy is for the next deadline."),{bare:true})}
  </div>
  <div class="repgrid">
    ${rep("gaps","users","League Gaps","Total points in your mini-league, with each manager's gap to the leader.",gaps)}
    ${rep("rchips","calendar","Chips Used and Left",`Which chips each manager has played this half (GW${half===1?"1-19":"20-38"}); a dot is still to play.`,chipGrid)}
  </div>
  ${rep("chipplays","activity","Chip Plays Across The Game","How many managers played each chip in each finished gameweek, in thousands (FPL's own counts).",chipPlays,{wide:true})}`;
}

/* ---------------- Teams ---------------- */
function sgTeams(G,H){
  const M=S.model,ts=S.curTeamStats||{};
  const tm=(S.teams||[]).map(t=>{const c=ts[t.short]||{},n=c.n||0,mt=M.teams.find(x=>x.short===t.short);
    return{t,mt,n,gf:c.gf||0,ga:c.ga||0,xg:n?c.xg/n:0,xga:n?c.xga/n:0};}).filter(x=>x.n>0&&x.mt);
  const row=(x,v,show,sub,tone)=>({label:esc(x.t.name),sub,value:v,show,tone});
  const fin=(S.fixtures||[]).filter(f=>f.finished&&f.hs!=null&&f.as!=null&&f.ht&&f.at).sort((a,b)=>(a.event-b.event)||String(a.kickoff).localeCompare(String(b.kickoff)));
  const form=M.teams.map(t=>{const l5=fin.filter(f=>f.ht===t||f.at===t).slice(-5).map(f=>{const us=f.ht===t?f.hs:f.as,them=f.ht===t?f.as:f.hs;
      return{r:us>them?"W":us<them?"L":"D",s:`${us}-${them}`,opp:(f.ht===t?f.at:f.ht).short};});
    return{t,l5,pts:l5.reduce((s,x)=>s+(x.r==="W"?3:x.r==="D"?1:0),0)};}).filter(x=>x.l5.length).sort((a,b)=>b.pts-a.pts);
  const formBody=form.length?`<div class="tform">${form.map((x,i)=>`<div class="hbr"><span class="hbn">${i+1}</span><span class="hbl"><b>${esc(x.t.name||x.t.short)}</b></span>
      <span class="wdl">${x.l5.map(r=>`<i class="${r.r}" title="${esc(r.opp)} ${r.s}">${r.r}</i>`).join("")}</span>
      <span class="hbt"><i style="width:${(x.pts/15*100).toFixed(0)}%;background:${x.pts>=10?SG_TONE.mint:x.pts>=6?"#7FA8C9":SG_TONE.red}"></i></span><span class="hbv">${x.pts} pts</span></div>`).join("")}</div>`:sgEmpty("Waiting on this season's matches.");
  const sorted=(k,dir)=>tm.slice().sort((a,b)=>dir*(a[k]-b[k])).slice(0,6);
  const runs=M.teams.map(t=>{const out=[];let s=0,n=0;
    for(let e=G;e<G+5&&e<=38;e++)(M.byEv[e]||[]).filter(f=>f.ht===t||f.at===t).forEach(f=>{const home=f.ht===t,opp=home?f.at:f.ht,d=fdrOf(opp,home,t,"att");s+=d;n++;out.push(fdrPill(opp.short,home,d,{short:true,tiny:true}));});
    return{t,avg:n?s/n:9,pills:out.join("")};});
  const runList=list=>`<div class="runs">${list.map((x,i)=>`<div class="hbr"><span class="hbn">${i+1}</span><span class="hbl"><b>${esc(x.t.name||x.t.short)}</b><em>avg difficulty ${x.avg.toFixed(1)}</em></span><span class="fxrow">${x.pills}</span></div>`).join("")}</div>`;
  const opp=M.teams.map(t=>{let c=0;const by=[];for(let e=G;e<G+H&&e<=38;e++)(M.byEv[e]||[]).filter(f=>f.ht===t||f.at===t).forEach(f=>{const home=f.ht===t,o=home?f.at:f.ht;c+=fdrCalc(o,t,!home,"xgf");by.push(o.short);});
    return{t,c,by};}).sort((a,b)=>b.c-a.c).slice(0,8);
  return `<div class="repgrid">
    ${rep("tform","activity","Team Form, Last Five","Each club's last five league results, newest on the right, ranked by points from them.",formBody)}
    ${rep("opp","target","Opponents to Target",`The defences expected to concede most over the ${hzL(H)} (from the model's fixture ratings), with the clubs that face them.`,
      hbars(opp.map(x=>({label:esc(x.t.name),sub:"faced by "+x.by.join(", "),value:x.c,show:x.c.toFixed(1),tone:SG_TONE.red})),{rank:true}))}
  </div>
  <div class="repgrid">
    ${rep("att","target","Attacks","Expected goals created per game this season (with goals scored): the best and the weakest.",
      `<div class="split2"><div><h4 class="rsub">Best</h4>${hbars(sorted("xg",-1).map(x=>row(x,x.xg,x.xg.toFixed(2),`${x.gf} scored`,SG_TONE.mint)),{rank:true})}</div>
       <div><h4 class="rsub">Weakest</h4>${hbars(sorted("xg",1).map(x=>row(x,x.xg,x.xg.toFixed(2),`${x.gf} scored`,SG_TONE.red)),{rank:true})}</div></div>`)}
    ${rep("def","shield","Defences","Expected goals conceded per game this season, and the leakiest by goals conceded.",
      `<div class="split2"><div><h4 class="rsub">Best</h4>${hbars(sorted("xga",1).map(x=>row(x,x.xga,x.xga.toFixed(2),`${x.ga} conceded`,SG_TONE.cyan)),{rank:true})}</div>
       <div><h4 class="rsub">Leakiest</h4>${hbars(tm.slice().sort((a,b)=>b.ga-a.ga||b.xga-a.xga).slice(0,6).map(x=>row(x,x.ga,String(x.ga),`${x.xga.toFixed(2)} xGA a game`,SG_TONE.red)),{rank:true})}</div></div>`)}
  </div>
  <div class="repgrid">
    ${rep("easy","calendar","Easiest Fixture Runs","The next five for attackers, from the model's own ratings (1 easiest, 5 hardest).",runList(runs.slice().sort((a,b)=>a.avg-b.avg).slice(0,6)))}
    ${rep("hard","calendar","Toughest Fixture Runs","The hardest next five for attackers.",runList(runs.slice().sort((a,b)=>b.avg-a.avg).slice(0,6)))}
  </div>
  <p class="note">Every club, its fixtures and each week's matches are on <a href="${routeFor("fixtures")}" onclick="S.fixMode='grid';return go(event,'fixtures')" style="color:var(--cyan)">Teams</a>.</p>`;
}

/* ---------------- Players ---------------- */
function sgPlayers(G,H,posF){
  const M=S.model,mine=new Set(S.squad||[]),pool=M.players.filter(p=>p.minutes>0&&sgOk(p,posF));
  const lr=(p,v,show,sub,tone)=>({label:esc(p.web_name),sub:sub||`${esc(p.teamName)} · ${POS[p.pos]}`,value:v,show,pid:p.id,tone,mine:mine.has(p.id)});
  const byPos=(sortFn,val,show,sub,filt,tone)=>posF
    ?hbars(pool.filter(p=>!filt||filt(p)).sort(sortFn).slice(0,10).map(p=>lr(p,val(p),show(p),sub&&sub(p),tone)),{rank:true})
    :`<div class="sgcols">${[1,2,3,4].map(pos=>`<div class="sgcol hbcol"><div class="sgcolh">${POS[pos]}</div>${hbars(M.players.filter(p=>p.minutes>0&&p.pos===pos&&(!filt||filt(p))).sort(sortFn).slice(0,5).map(p=>lr(p,val(p),show(p),sub?sub(p):esc(p.teamName),tone)),{rank:true})}</div>`).join("")}</div>`;
  const avail=p=>p.status==="a"||p.status==="d";
  const gx=pool.filter(p=>p.pos>=2).map(p=>{const rs=((S.hist&&S.hist[p.code])||[]).filter(r=>r.tag==="now");
    const g=rs.reduce((s,r)=>s+(r.g||0),0),xg=rs.reduce((s,r)=>s+(r.xg||0),0);return{p,g,xg,d:g-xg};}).filter(x=>x.xg>=1||x.g>=2);
  const gxRows=[...gx.slice().sort((a,b)=>b.d-a.d).slice(0,6),...gx.slice().sort((a,b)=>a.d-b.d).slice(0,6).reverse()]
    .map(x=>lr(x.p,x.d,(x.d>=0?"+":"")+x.d.toFixed(1),`${esc(x.p.teamName)} · ${x.g} goals from ${x.xg.toFixed(1)} xG`));
  const dtv=p=>{const L=fplLive(p);return L&&L.dt!=null?L.dt:(p.dreamteam||0);};
  const dt=pool.filter(p=>dtv(p)>0).sort((a,b)=>dtv(b)-dtv(a)||b.total-a.total).slice(0,10);
  const clubs=(S.teams||[]).map(t=>{const ps=M.players.filter(p=>p.teamName===t.short);const sp=ps.map(p=>({p,s:setPieces(p)}));
    const pen=sp.find(x=>x.s.pen),c1=sp.find(x=>x.s.cor===1),c2=sp.find(x=>x.s.cor===2),f1=sp.find(x=>x.s.dfk===1),f2=sp.find(x=>x.s.dfk===2);
    return{t,pen,c:[c1,c2].filter(Boolean),f:[f1,f2].filter(Boolean)};});
  const nmB=x=>x?`<button class="pn" onclick="act('card',${x.p.id})">${esc(x.p.web_name)}</button>`:'<span class="mu">—</span>';
  const evs=(S.events||[]).filter(e=>e.finished).sort((a,b)=>b.id-a.id).slice(0,8);
  const nm=id=>{const p=M.players.find(x=>x.id===+id);return p?`<button class="pn" onclick="act('card',${p.id})">${esc(p.web_name)}</button>`:"—";};
  /* FPL's own xG/xA per 90 (p.off), not the model's shrunk inputs */
  const ox=p=>(p.off||{}),xgi=p=>ox(p).xgi90||0;
  const threat=pool.filter(p=>p.minutes>=270&&p.pos>=2).sort((a,b)=>xgi(b)-xgi(a)).slice(0,10);
  const moreReps=`<div class="repgrid">
    ${rep("pvalue","wallet","Value",`Where your money works hardest over the ${hzL(H)}: model points against price for every regular starter, the budget starter's level, how many extra points each extra £1m buys in each price band, and the best value in each band (the ✓ in Player Data).`,squadShapeHTML(G,H,posF),{bare:true,wide:true})}
    ${rep("minwatch","clock-alert","Minutes Watch","Players the bookmakers rate likely to score who are not expected to play the full match: worth a check before the deadline.",S.oddsState==="ok"?minutesWatchHTML():sgEmpty("Needs the bookmakers' prices."),{bare:true})}
  </div>`;
  return `${rep("scorers","trophy","Top Scorers By Position","Season total points, with points per game.",byPos((a,b)=>b.total-a.total,p=>p.total,p=>String(p.total),p=>`${esc(p.teamName)} · ${p.ppg.toFixed(1)} ppg`),{wide:true})}
  ${rep("pred","sparkles","Top Predicted By Position",`Model points over the ${hzL(H)}, available and doubtful players only.`,byPos((a,b)=>hPts(b,G,H)-hPts(a,G,H),p=>hPts(p,G,H),p=>hPts(p,G,H).toFixed(1),p=>`${esc(p.teamName)} · ${Math.round(p.xMins||0)}′`,avail),{wide:true})}
  <div class="repgrid">
    ${rep("form","flame","In Form","Highest form (average points per game, last 30 days), 180 minutes or more this season.",
      hbars(pool.filter(p=>p.minutes>=180&&avail(p)).sort((a,b)=>b.form-a.form).slice(0,10).map(p=>({...lr(p,p.form,p.form.toFixed(1)),sub:`${esc(p.teamName)} · ${sgPos(p)}`})),{rank:true}))}
    ${rep("threat","crosshair","Underlying Threat","Expected goals plus expected assists per 90 minutes, outfield players with 270 minutes or more.",
      hbars(threat.map(p=>lr(p,xgi(p),xgi(p).toFixed(2),`${esc(p.teamName)} · ${POS[p.pos]} · xG ${(ox(p).xg90||0).toFixed(2)} xA ${(ox(p).xa90||0).toFixed(2)}`,SG_TONE.purple)),{rank:true}))}
  </div>
  <div class="repgrid">
    ${rep("xg","target","Goals Against xG","Goals this season minus expected goals. Right: finishing above the chances (the research found this does not last). Left: getting chances but not yet scoring.",
      hbars(gxRows,{diverge:true,empty:"Waiting on this season's matches."}))}
    ${rep("dream","star","Dream Team Appearances","How many times each player has made FPL's Dream Team (the week's best XI) this season.",
      hbars(dt.map(p=>lr(p,dtv(p),dtv(p)+"×",null,SG_TONE.amber)),{rank:true,empty:"No Dream Teams yet."}))}
  </div>
  <div class="repgrid">
    ${rep("takers","flag-triangle-right","Penalty and Set-Piece Takers","FPL's own live orders: first-choice penalty taker, then the first two on corners and direct free kicks. Penalty overrides for Coventry, Newcastle and Sunderland.",
      `<div class="scroll"><table class="cgridt"><thead><tr><th style="text-align:left">Club</th><th>Penalties</th><th>Corners</th><th>Free kicks</th></tr></thead><tbody>
      ${clubs.map(x=>`<tr><td style="text-align:left">${esc(x.t.name)}</td><td>${nmB(x.pen)}</td><td>${x.c.map(nmB).join(", ")||"—"}</td><td>${x.f.map(nmB).join(", ")||"—"}</td></tr>`).join("")}</tbody></table></div>`)}
    ${rep("popular","users","Most Captained, Selected and Bought","FPL's own figures for each finished gameweek, with that week's top scorer.",
      evs.length?`<div class="scroll"><table class="cgridt"><thead><tr><th>Week</th><th>Captained</th><th>Selected</th><th>Bought</th><th>Top scorer</th></tr></thead><tbody>
      ${evs.map(e=>`<tr><td>GW${e.id}</td><td>${nm(e.mostCapt)}</td><td>${nm(e.mostSel)}</td><td>${nm(e.mostIn)}</td><td>${nm(e.topEl)}${e.topPts?` <span class="mu">${e.topPts}</span>`:""}</td></tr>`).join("")}</tbody></table></div>`:sgEmpty("No finished gameweeks yet."))}
  </div>${moreReps}`;
}

/* ============================================================
   PLAYER DATA (12 Nov 2026, Andy): one table instead of the Buy / My
   Squad / All / Value / Stats views. Show (All / Not yours / Yours) and
   the filters replace the views; every position shares the base columns
   (Player, Price, Signals, Next 5, Form, xFPL, xPts for the window, Value,
   Own, xMins) and the stats that matter for the filtered position sit to
   the right, chosen from the 19 Oct predictor study (research/predictors):
     GK  clean-sheet chance and the market's, goals conceded, saves, goals
         prevented, bonus (keepers: team strength and fixtures lead)
     DEF clean-sheet chance and the market's, xGI/90 last 6 (attacking
         full-backs rank top), DefCon %, BPS/90, bonus
     MID xGI/90 last 6 (top over 5 GW), the market's goal chance, npxG/90,
         xA/90, ICT, DefCon %, bonus
     FWD xGI/90 last 6, the market's goal chance, npxG/90, xA/90 (ranks
         12th), ICT (ranks 1st over 5 GW), shots on target/90, bonus
   Colour no longer marks column types: the strongest values in each
   column are tinted green (top quarter of the players listed), so the eye
   goes to the good numbers in any column. Market columns show only when
   the odds are in; the model's own figure is in the hover.
   ============================================================ */
const PD_POS_COLS={0:["xgi6","cs","dchit","dchits","bonus","total"],1:["cs","csmk","gc90","sv90","gprev","bonus"],
  2:["cs","csmk","xgi6","dchit","dchits","bps","bonus"],3:["xgi6","goalmk","npxg","xa","ict","dchit","dchits","bonus"],
  4:["xgi6","goalmk","npxg","xa","ict","sot","bonus"]};
/* Value (12 Nov 2026, Andy): "vs Budget" is a player's model points over
   the xPts window minus those of an average budget starter in his position
   (the regular starters, 60+ expected minutes, priced within £0.5 of the
   cheapest); the tick marks the best points per £1m in each position and
   price band (PRICE_BANDS, the old Value tab's bands). Pts/£m alone always
   favours the cheapest players. */
let _pdVal=null;
function pdValue(r){
  const D=valueData(r.from,r.count),lab=pdWinLabel(r);
  if(_pdVal&&_pdVal.D===D&&_pdVal.lab===lab)return _pdVal.v;
  const base={},best={};
  [1,2,3,4].forEach(pos=>{const d=D[pos];if(!d)return;base[pos]=d.base;
    Object.entries(d.best).forEach(([id,band])=>{const p=d.a.find(x=>x.id===+id);
      best[id]=`Best value: ${POS[pos]} ${band}, ${(hPts(p,r.from,r.count)/p.price).toFixed(2)} pts per £1m over ${pdWinLabel(r)} (regular starters)`;});});
  _pdVal={D,lab,v:{base,best}};return _pdVal.v;
}
function pdCols(){
  const g=VG(),r=lGwRange(),W=p=>ws(String(p.code||""),p.pos,dispWin(),p.price,teamMaxPrice(p.team))||{};
  /* Season: FPL's own per-90 where FPL publishes one; Last N: match rows */
  const sv=(p,k)=>{const v=statVal(p,k,W(p));return v==null||!isFinite(v)?null:v;};
  const L6=p=>{const w=ws(String(p.code||""),p.pos,6,p.price,teamMaxPrice(p.team));return w?(w.xg90||0)+(w.xa90||0):null;};
  const mk=S.oddsState==="ok"?(()=>{const m={};try{Object.values(oddsPlayers(g)||{}).forEach(x=>{if(x&&x.p)m[x.p.id]=x;});}catch(e){}return m;})():null;
  const mcs=S.oddsState==="ok"?(()=>{try{return marketCS(g)||{};}catch(e){return {};}})():null;
  const pct=v=>v==null?"—":Math.round(v*100)+"%",f1=v=>v==null?"—":v.toFixed(1),f2=v=>v==null?"—":v.toFixed(2);
  /* Rivals is its own column since 13 Nov 2026 (Andy), so Own % switches
     only between everyone and the managers ranked around you */
  const ownMode=S.pOwn==="rank"?"rank":"all";
  const own=p=>{if(ownMode==="all")return p.owned;const a=aroundOwn(p,ownMode);return a?a.k/a.n:null;};
  const C={
    price:{label:"Price",tip:"Price now, with tonight's predicted change (FPL's predictor, 100% = it changes)",val:p=>p.price,heat:0,
      cell:p=>{const l=fplLive(p),c=l&&l.pcp!=null&&Math.abs(l.pcp)>=50?`<em class="${l.pcp>0?"up":"dn"}">${l.pcp>0?"▲":"▼"}${Math.round(Math.abs(l.pcp))}%</em>`:"";return `£${p.price.toFixed(1)}${c}`;}},
    form:{label:"Form",tip:"Average points per game over the last 30 days",val:p=>p.form,cell:p=>p.form.toFixed(1),heat:1},
    xfpl:{label:"xFPL",tip:`Model points, GW${g}`,val:p=>hPts(p,g,1),cell:p=>hPts(p,g,1).toFixed(1),heat:1,strong:1},
    proj:{label:`xPts ${r.from===r.to?"GW"+r.from:r.from+"–"+r.to}`,tip:`Model points over GW${r.from}${r.to>r.from?" to GW"+r.to:""} (set the window in Filters)`,val:p=>hPts(p,r.from,r.count),cell:p=>hPts(p,r.from,r.count).toFixed(1),heat:1,strong:1},
    best:{label:"✓",tip:"Best points per £1m in his position and price band (regular starters). Hover a tick for the band",
      val:p=>pdValue(r).best[p.id]?1:0,cell:p=>{const t=pdValue(r).best[p.id];return t?`<span class="pdbest" title="${esc(t)}" aria-label="${esc(t)}">✓</span>`:"";},heat:0},
    vsb:{label:"vs Budget",tip:"Model points over the window above an average budget starter in his position (regular starters within £0.5 of the cheapest)",
      val:p=>{const b=pdValue(r).base[p.pos];return b?hPts(p,r.from,r.count)-b.pts:null;},
      cell:p=>{const b=pdValue(r).base[p.pos];if(!b)return "—";const v=hPts(p,r.from,r.count)-b.pts;
        return `<span title="${hPts(p,r.from,r.count).toFixed(1)} pts against ${b.pts.toFixed(1)} for a budget ${POS[p.pos]} (about £${b.price.toFixed(1)})"${v<0?' class="dn"':""}>${v>=0?"+":""}${v.toFixed(1)}</span>`;},heat:1},
    value:{label:"Pts/£m",tip:"Model points over the window per £1m of price: where the money works hardest",val:p=>hPts(p,r.from,r.count)/p.price,cell:p=>(hPts(p,r.from,r.count)/p.price).toFixed(2),heat:1},
    rivals:{label:"Rivals",tip:"Owned by your mini-league rivals (how many of them own him)",
      val:p=>{const a=aroundOwn(p,"league");return a?a.k/a.n:null;},
      cell:p=>{const a=aroundOwn(p,"league");return a?(a.k?`${a.k}<span class="mu">/${a.n}</span>`:`<span class="mu">0/${a.n}</span>`):"—";},heat:1},
    own:{label:ownMode==="all"?"Own %":"Near rank",tip:ownMode==="all"?"Owned by all managers":"Owned by the 50 managers ranked around you",
      val:own,cell:p=>{if(ownMode==="all")return p.owned.toFixed(1)+"%";const a=aroundOwn(p,ownMode);return a?`${a.k}/${a.n}`:"—";},heat:0},
    xmins:{label:"xMins",tip:"Expected minutes next gameweek",val:p=>p.xMins||0,cell:p=>Math.round(p.xMins||0)+"′"+minsTag(p),heat:1},
    xgi6:{label:"xGI/90 L6",tip:"Expected goals plus assists per 90, last 6 matches (the study's best underlying number for midfielders and forwards)",val:L6,cell:p=>f2(L6(p)),heat:1},
    cs:{label:"CS %",tip:"Model chance of a clean sheet next match, as its points use it (bookmakers' odds when priced)",val:p=>csProbNext(p,g),cell:p=>pct(csProbNext(p,g)),heat:1},
    csmk:{label:"CS mkt",tip:"Bookmakers' clean-sheet chance next match (margin removed)",val:p=>mcs?mcs[p.team]??null:null,cell:p=>pct(mcs?mcs[p.team]:null),heat:1,market:1},
    goalmk:{label:"Goal mkt",tip:"Bookmakers' chance he scores next match, if he plays (the model's figure in the hover)",val:p=>mk&&mk[p.id]?mk[p.id].goal:null,
      cell:p=>{const x=mk&&mk[p.id];return x&&x.goal!=null?`<span title="Model ${pct(modelChance(p,p.xg90||0))}">${pct(x.goal)}</span>`:"—";},heat:1,market:1},
    npxg:{label:"npxG/90",tip:"Non-penalty expected goals per 90 (stats window; penalties scored or missed taken out)",val:p=>W(p).npxg90??null,cell:p=>f2(W(p).npxg90),heat:1},
    xa:{label:"xA/90",tip:"Expected assists per 90 (Season: FPL's figure; Last N: match records)",val:p=>sv(p,"xa"),cell:p=>f2(sv(p,"xa")),heat:1},
    ict:{label:"ICT",tip:"FPL's ICT index, season total (ranks first for forwards over 5 gameweeks)",val:p=>p.ict||0,cell:p=>(p.ict||0).toFixed(0),heat:1},
    sot:{label:"SoT/90",tip:"Shots on target per 90 (stats window)",val:p=>W(p).sot90??null,cell:p=>f2(W(p).sot90),heat:1},
    dchits:{label:"DefCon Hits",tip:"Matches this season reaching the DefCon target (10 for defenders, 12 for midfielders and forwards), out of the matches he played",
      val:p=>{const q=W(p);return q.estimated||p.pos<2||!q.dcApps?null:(q.dcHits||0)-(q.dcApps||0)/1000;},
      cell:p=>{const q=W(p);return !q.estimated&&p.pos>1&&q.dcApps?`${q.dcHits}<span class="mu">/${q.dcApps}</span>`:"—";},heat:1},
    dchit:{label:"DefCon %",tip:"Share of 60-minute games reaching the DefCon threshold (2 points)",val:p=>W(p).dcHit??null,cell:p=>pct(W(p).dcHit),heat:1},
    bps:{label:"BPS/90",tip:"Bonus-point-system score per 90",val:p=>bpsPer90(p,W(p)),cell:p=>f1(bpsPer90(p,W(p))),heat:1},
    bonus:{label:"Bonus",tip:"Bonus points this season",val:p=>p.bonus||0,cell:p=>p.bonus||0,heat:1},
    total:{label:"Pts",tip:"Total points this season",val:p=>p.total,cell:p=>p.total,heat:1},
    gc90:{label:"GC/90",tip:"Goals conceded per 90 (Season: FPL's figure; Last N: his team's goals conceded while he played); lower is better",val:p=>sv(p,"gc90"),cell:p=>f2(sv(p,"gc90")),heat:-1},
    sv90:{label:"Saves/90",tip:"Saves per 90 (Season: FPL's figure; Last N: match records)",val:p=>sv(p,"sv90"),cell:p=>f2(sv(p,"sv90")),heat:1},
    gprev:{label:"G prev",tip:"Goals prevented against the xG on target he faced (stats window)",val:p=>W(p).gp??null,cell:p=>f1(W(p).gp),heat:1}
  };
  const pos=S.lPos||0;
  const extra=PD_POS_COLS[pos].filter(k=>!C[k].market||S.oddsState==="ok");
  return{C,base:["price","best","form","xfpl","proj","value","vsb","own","rivals","xmins"],extra,pos};
}

/* Player Data redesign (12 Nov 2026, from the approved mock-up): one filter
   bar (search, position, projection 3 GW / 5 GW / ROS, club, price range),
   the twelve signals always on show as filter chips, everything else in
   More filters. His players stay in the list, marked by a green edge and
   their role (C, VC, XI, Bench) instead of a Yours tab. Figures are grey,
   white for the top quarter of the column and green for the top tenth. */
const PD_FDR={1:["#1F7A4C","#D9FBE8"],2:["#24533B","#A6E8C3"],3:["#383838","#D4D4D4"],4:["#6A2230","#FFC2CC"],5:["#9A1C31","#FFE5EA"]};
const pdFdr=d=>PD_FDR[clamp(Math.round(+d)||3,1,5)];
/* compact next-five fixtures: home in capitals, away in lower case */
function fix5(p,g){
  let h="";
  for(let e=g;e<g+5&&e<=38;e++){const q=p.gw[e];
    if(!q||q.blank||!q.fixtures.length){h+=`<i class="fx5 bl" title="GW${e}: no fixture">–</i>`;continue;}
    h+=`<span class="fx5s${q.fixtures.length>1?" dbl":""}">${q.fixtures.map(f=>{const d=posDiff(p,f),[b,c]=pdFdr(d),o=String(f.opp).slice(0,3);
      return `<i class="fx5" style="background:${b};color:${c}" title="GW${e}: ${esc(f.oppName||f.opp)} ${f.home?"home":"away"} · difficulty ${d}">${esc(f.home?o.toUpperCase():o.toLowerCase())}</i>`;}).join("")}</span>`;}
  return `<span class="fx5r">${h}</span>`;
}
/* a signal tile whose hover card (app-main) shows the name and one short line */
function pdTile(k,t,b){const[ic,tone,label]=SIGNAL[k],s=sigShort(k,t);
  return `<span class="tile${b?" bright":""}" style="--tc:${tone==="NAVY"?"#7AA2FF":tone}" data-sig="${k}" data-tt="${esc(s)}" tabindex="0" aria-label="${esc(label+": "+s)}">${lic(ic)}</span>`;}
function pdRows(){
  const g=VG(),mine=new Set(effectiveSquadIds(g).ids),q=(S.lSearch||"").toLowerCase();
  let a=S.model.players.filter(p=>(!S.lPos||p.pos===S.lPos)&&(!S.lTeam||p.team===S.lTeam)&&p.price<=(S.lMax||16)+.001&&p.price>=(S.lMin||0)-.001
    &&(!q||(p.web_name+" "+p.first+" "+p.last).toLowerCase().includes(q)));
  const show=S.pShow||"all";
  if(show==="mine")a=a.filter(p=>mine.has(p.id));
  if(show==="out")a=a.filter(p=>!mine.has(p.id));
  if(S.pStarters)a=a.filter(p=>p.avail>0&&(p.xMins||0)>=60);
  if(S.starOnly)a=a.filter(p=>S.stars.includes(p.id));
  if(S.iconF.length)a=a.filter(p=>{const ic=signals(p,g).map(x=>x[0]);return S.iconF.every(k=>ic.includes(k));});
  return{g,mine,a};
}
/* the projection window as one of the three buttons, or 0 for a custom one */
function pdWin(r){const g=S.model.next.id;if(r.from!==g)return 0;
  if(r.to===38&&r.count>5)return "ros";return r.count===3?3:r.count===5?5:0;}
const pdWinLabel=r=>{const w=pdWin(r);return w==="ros"?"ROS":w?w+" GW":r.from===r.to?"GW"+r.from:"GW"+r.from+"–"+r.to;};
/* the price slider's top end: the dearest player, to the next 0.5 */
const pdPriceTop=()=>Math.ceil(Math.max(...S.model.players.map(p=>p.price))*2)/2;
function pdPriceInput(el){const box=el.closest(".pdrange");if(!box)return;
  const [lo,hi]=[...box.querySelectorAll("input")],top=+hi.max,bot=+lo.min;
  if(+lo.value>+hi.value){if(el===lo)lo.value=hi.value;else hi.value=lo.value;}
  const f=box.querySelector(".fl");if(f){f.style.left=((lo.value-bot)/(top-bot)*100)+"%";f.style.right=(100-(hi.value-bot)/(top-bot)*100)+"%";}
  const l=document.getElementById("pdpricel");if(l)l.textContent=`£${(+lo.value).toFixed(1)} – £${(+hi.value).toFixed(1)}`;}
function playerDataHTML(){
  if(!S.model)return "";
  const{g,mine,a}=pdRows(),D=pdCols(),r=lGwRange();
  const cols=[...D.base,...D.extra];
  /* sort: any column; name sorts A-Z */
  const key=S.sortKey==="name"||D.C[S.sortKey]?S.sortKey:"proj",dir=S.sortDir||"desc";
  const sv=p=>key==="name"?p.web_name:(D.C[key].val(p)??-1e9);
  const rows=a.slice().sort((x,y)=>{const A=sv(x),B=sv(y);if(typeof A==="string")return dir==="asc"?A.localeCompare(B):B.localeCompare(A);return dir==="asc"?A-B:B-A;});
  /* the strongest quarter and tenth of each column, over every player listed */
  const heat={};cols.forEach(k=>{const c=D.C[k];if(!c.heat)return;
    const vs=rows.map(c.val).filter(v=>v!=null&&isFinite(v)).sort((x,y)=>x-y);if(vs.length<8)return;
    heat[k]={vs,dir:c.heat};});
  const lvl=(k,v)=>{const h=heat[k];if(!h||v==null||!isFinite(v))return "";
    let lo=0,hi=h.vs.length;while(lo<hi){const m=(lo+hi)>>1;if(h.vs[m]<v)lo=m+1;else hi=m;}
    let pc=lo/h.vs.length;if(h.dir<0)pc=1-pc;
    return pc>=0.9?" t10":pc>=0.75?" t25":"";};
  const lim=S.pdLimit||PD_PAGE,ticks=S.pTicks||[];
  const pmax=Math.max(1e-9,...rows.slice(0,lim).map(p=>D.C.proj.val(p)||0));
  const xi=new Set(startingXI().map(p=>p.id));
  const role=p=>!mine.has(p.id)?"":p.id===S.captain?`<span class="pdrole c" title="Your captain">C</span>`:p.id===S.vice?`<span class="pdrole v" title="Your vice-captain">VC</span>`
    :xi.has(p.id)?`<span class="pdrole xi" title="In your starting XI">XI</span>`:`<span class="pdrole bn" title="On your bench">Bench</span>`;
  const th=(k,label,tip,cls,sub)=>`<th class="${cls||""}${key===k?" act":""}" onclick="act('sort','${k}')" title="${esc(tip||label)}">${label}${key===k?(dir==="desc"?" ↓":" ↑"):""}${sub?` <small>${sub}</small>`:""}</th>`;
  const HSUB={xgi6:["xGI/90","last 6"]};
  const posName={0:"Key stats",1:"Keeper stats",2:"Defender stats",3:"Midfielder stats",4:"Forward stats"}[D.pos];
  const gwh=Array.from({length:Math.min(5,39-g)},(_,i)=>`<i>${g+i}</i>`).join("");
  const head=`<tr class="grp"><th colspan="5"></th><th colspan="3" class="gs">Model</th><th colspan="5" class="gs">Value and minutes</th><th colspan="${D.extra.length}" class="gs">${posName}</th><th></th></tr>
    <tr>${th("name","Player","Name, club and position","nm")}${th("price",D.C.price.label,D.C.price.tip)}${th("best","✓",D.C.best.tip,"pdbestc")}<th class="l sgh" title="Signals now: hover each for why">Signals</th><th class="l" title="Next five fixtures for his position: green easy, red hard; capitals home, lower case away">Next 5 <small class="pdgw">${gwh}</small></th>
    ${th("form",D.C.form.label,D.C.form.tip,"gs")}${th("xfpl","xFPL",D.C.xfpl.tip,"","GW"+g)}${th("proj","xPts",D.C.proj.tip,"",pdWinLabel(r))}
    ${th("value",D.C.value.label,D.C.value.tip,"gs")}${th("vsb",D.C.vsb.label,D.C.vsb.tip)}${th("own",D.C.own.label,D.C.own.tip)}${th("rivals",D.C.rivals.label,D.C.rivals.tip)}${th("xmins",D.C.xmins.label,D.C.xmins.tip)}
    ${D.extra.map((k,j)=>{const[l,s]=HSUB[k]||[D.C[k].label,""];return th(k,l,D.C[k].tip,j?"":"gs",s);}).join("")}<th></th></tr>`;
  const body=rows.slice(0,lim).map(p=>{const on=ticks.includes(p.id),own=mine.has(p.id),sg=signals(p,g),proj=D.C.proj.val(p)||0;
    return `<tr class="${own?"mine":""}${on?" ticked":""}"${p.avail===0?' style="opacity:.45"':""}>
      <td class="nm"><span class="pcell"><span class="pdshirt">${shirtSVG(p.teamName.toUpperCase(),p.pos===1,26)}<input type="checkbox" class="tick" ${on?"checked":""} ${!on&&ticks.length>=5?"disabled":""} onchange="act('tick',${p.id})" aria-label="Compare ${esc(p.web_name)}"></span>
        <span class="pmeta"><span class="prow1">${pName(p)}${INJ(p)}${role(p)}</span><span class="prow2">${esc(p.teamName)} · ${POS[p.pos]}</span></span></span></td>
      <td class="fig pdprice">${D.C.price.cell(p)}</td>
      <td class="pdbestc">${D.C.best.cell(p)}</td>
      <td class="sgc">${sg.length?`<span class="sigcell">${sg.slice(0,4).map(([k,t,b])=>pdTile(k,t,b)).join("")}${sg.length>4?`<span class="sgmore" title="${esc(sg.slice(4).map(x=>SIGNAL[x[0]][2]).join(", "))}">+${sg.length-4}</span>`:""}</span>`:""}</td>
      <td>${fix5(p,g)}</td>
      <td class="fig gs${lvl("form",p.form)}">${D.C.form.cell(p)}</td>
      <td class="fig${lvl("xfpl",D.C.xfpl.val(p))}">${D.C.xfpl.cell(p)}</td>
      <td class="fig pdproj"><b>${D.C.proj.cell(p)}</b><span class="pdpbar"><i style="width:${Math.max(3,Math.min(100,proj/pmax*100)).toFixed(0)}%"></i></span></td>
      <td class="fig gs${lvl("value",D.C.value.val(p))}">${D.C.value.cell(p)}</td>
      <td class="fig${lvl("vsb",D.C.vsb.val(p))}">${D.C.vsb.cell(p)}</td>
      <td class="fig">${D.C.own.cell(p)}</td>
      <td class="fig${lvl("rivals",D.C.rivals.val(p))}">${D.C.rivals.cell(p)}</td>
      <td class="fig${(p.xMins||0)<60?" warn":lvl("xmins",D.C.xmins.val(p))}">${D.C.xmins.cell(p)}</td>
      ${D.extra.map((k,j)=>`<td class="fig${j?"":" gs"}${lvl(k,D.C[k].val(p))}">${D.C[k].cell(p)}</td>`).join("")}
      <td class="acts"><button class="pdstar${S.stars.includes(p.id)?" on":""}" onclick="act('star',${p.id})" title="Shortlist" aria-label="Shortlist ${esc(p.web_name)}" aria-pressed="${S.stars.includes(p.id)}">★</button>${own?"":`<button class="pdadd" onclick="act('addplan',${p.id})" title="Add to the Planner" aria-label="Add ${esc(p.web_name)} to the Planner">+</button>`}</td></tr>`;}).join("");
  const more=rows.length>lim?`<div class="pdmore"><span class="note">Showing ${lim} of ${rows.length} players</span>
    <span><button onclick="act('pdmore')">Show ${Math.min(PD_PAGE,rows.length-lim)} more</button> <button onclick="act('pdall')">Show all ${rows.length}</button></span></div>`:
    (lim>PD_PAGE&&rows.length>PD_PAGE?`<div class="pdmore"><span class="note">Showing all ${rows.length} players</span><button onclick="act('pdless')">Show fewer</button></div>`:"");
  const key5=[1,2,3,4,5].map(d=>{const[b,c]=pdFdr(d);return `<i class="fx5" style="background:${b};color:${c}">${d}</i>`;}).join("");
  return pdHeadHTML(rows,r)+(S.starOnly&&!S.stars.length?`<div class="panel"><div class="pbody"><p class="note" style="margin:0">No shortlisted players yet. Tap ★ on any row to add one.</p></div></div>`:
    `<div class="panel pdpanel"><div class="scroll tallscroll pdt${ticks.length?" ticking":""}"><table><thead>${head}</thead><tbody>${body||`<tr><td colspan="${14+D.extra.length}" class="note" style="padding:14px">No players match these filters.</td></tr>`}</tbody></table></div>${more}</div>`)
    +`<div class="pdkey"><span><i class="kmine"></i>Your squad</span><span><span class="pdrole c">C</span><span class="pdrole v">VC</span><span class="pdrole xi">XI</span><span class="pdrole bn">Bench</span></span><i class="sep"></i>
      <span><b class="t10">4.6</b> top 10% of the column</span><span><b class="t25">4.6</b> top 25%</span><i class="sep"></i>
      <span>Fixture difficulty <span class="fx5r">${key5}</span> · capitals home</span>${S.oddsState==="ok"?`<i class="sep"></i><span>Market columns: bookmakers' figures, margin removed</span>`:""}</div>`;
}
function pdHeadHTML(rows,r){
  const seg=(cur,list,action,lbl)=>`<span class="hz" role="group" aria-label="${lbl}">${list.map(([k,l,t])=>`<button class="${String(cur)===String(k)?"on":""}" aria-pressed="${String(cur)===String(k)}" onclick="act('${action}','${k}')"${t?` title="${t}"`:""}>${l}</button>`).join("")}</span>`;
  const ticks=S.pTicks||[],g=S.model.next.id,win=pdWin(r);
  const nMine=rows.filter(p=>(S.squad||[]).includes(p.id)).length;
  /* signal counts over every player, whatever the filters */
  const cnt={};S.model.players.forEach(p=>signals(p,VG()).forEach(([k])=>{cnt[k]=(cnt[k]||0)+1;}));
  const top=pdPriceTop(),lo=clamp(S.lMin||3.5,3.5,top),hi=clamp(S.lMax||16,lo,top);
  const nMore=[(S.pShow||"all")!=="all",!win,(S.lWin||38)!==38,S.pOwn==="rank",!!S.pStarters,!!S.starOnly].filter(Boolean).length;
  const any=nMore||S.lSearch||S.lTeam||lo>3.5||hi<top||S.iconF.length||S.lPos;
  const box=(on,label,action)=>`<label class="pdchk"><input type="checkbox" ${on?"checked":""} onchange="act('${action}')"> ${label}</label>`;
  return `<div class="pagetabs"><h1>Player Data <span class="pdcount">${rows.length} players${nMine?` · <b>${nMine}</b> from your squad`:""}</span></h1>
      <span style="display:flex;gap:8px;align-items:center">${ticks.length?`<button class="pri" onclick="act('pcmp')">Compare ${ticks.length}</button><button onclick="act('tickclear')">Clear</button>`:`<span class="note">Tick up to 5 players to compare</span>`}</span></div>
    <div class="pdcard">
      <div class="pdbar">
        <label class="pdsearch">${lic("search",15)}<input id="srch-l" placeholder="Search players" value="${esc(S.lSearch||"")}" oninput="searchInput('lsearch',this)" aria-label="Search players"></label>
        <div class="pdctl"><span class="pdl">Position</span>${seg(S.lPos||0,[[0,"All"],[1,"GKP"],[2,"DEF"],[3,"MID"],[4,"FWD"]],"lpos","Position")}</div>
        <div class="pdctl"><span class="pdl">Projection</span>${seg(win,[[3,"3 GW"],[5,"5 GW"],["ros","ROS",`Rest of season, GW${g}–38`]],"pwin","Projection window")}</div>
        <div class="pdctl"><span class="pdl">Club</span><select class="pdsel" onchange="act('lteam',this.value)" aria-label="Club"><option value="0">All clubs</option>${S.model.teams.slice().sort((x,y)=>String(x.name).localeCompare(y.name)).map(t=>`<option value="${t.id}" ${S.lTeam===t.id?"selected":""}>${esc(t.name)}</option>`).join("")}</select></div>
        <div class="pdctl pdpricectl"><span class="pdl">Price <b id="pdpricel">£${lo.toFixed(1)} – £${hi.toFixed(1)}</b></span>
          <span class="pdrange"><i class="tr"></i><i class="fl" style="left:${((lo-3.5)/(top-3.5)*100).toFixed(1)}%;right:${(100-(hi-3.5)/(top-3.5)*100).toFixed(1)}%"></i>
            <input type="range" min="3.5" max="${top}" step="0.1" value="${lo}" oninput="pdPriceInput(this)" onchange="act('lmin',this.value)" aria-label="Lowest price">
            <input type="range" min="3.5" max="${top}" step="0.1" value="${hi}" oninput="pdPriceInput(this)" onchange="act('lmax',this.value)" aria-label="Highest price"></span></div>
        <div class="pdsp"></div>
        <div class="pdctl pdmorewrap"><span class="pdl">&nbsp;</span><span style="display:flex;gap:6px;position:relative">
          <button class="pdfbtn${S.pdMore?" on":""}" onclick="act('pdmorefilters')" aria-expanded="${!!S.pdMore}">${lic("chevron-down",14)} More filters${nMore?` <b>${nMore}</b>`:""}</button>
          ${any?`<button class="pdreset" onclick="act('pdreset')">Reset</button>`:""}
          ${S.pdMore?`<div class="pdpop" role="dialog" aria-label="More filters">
            <div class="pdpoph">More filters</div>
            <div class="pdpr"><span>Your players</span>${seg(S.pShow||"all",[["all","Show"],["out","Hide"],["mine","Only"]],"pshow","Your players")}</div>
            <div class="pdpr"><span>Custom window</span><span class="pdgwin">GW <input type="number" min="1" max="38" value="${r.from}" onchange="act('lgwfrom',this.value)" aria-label="From gameweek"> to GW <input type="number" min="${r.from}" max="38" value="${r.to}" onchange="act('lgwto',this.value)" aria-label="To gameweek"></span></div>
            <div class="pdpr"><span>Stats from</span>${seg(S.lWin||38,[[6,"Last 6"],[10,"Last 10"],[38,"Season"]],"lwin","Stats from")}</div>
            <div class="pdpr"><span>Own % shows</span>${seg(S.pOwn==="rank"?"rank":"all",[["all","Everyone"],["rank","Near rank"]],"pown","Own % shows")}</div>
            <div class="pdpr"><span>Only</span><span class="pdchks">${box(S.pStarters,"Available starters","pstart")}${box(S.starOnly,`★ Shortlist${S.stars.length?" ("+S.stars.length+")":""}`,"staronly")}</span></div>
            <div class="pdpopf"><button class="pdreset" onclick="act('pdreset')">Reset all</button><button class="pri" onclick="act('pdmorefilters')">Done</button></div>
          </div>`:""}</span></div>
      </div>
      <div class="pdsigs"><span class="pdl">Signals <span class="mu">tap to filter · hover any icon for why</span></span>
        <div class="pdchips">${SIG_ORDER.map(k=>{const[ic,tone,label]=SIGNAL[k],on=S.iconF.includes(k);
          return `<button class="pdsigchip${on?" on":""}" style="--tc:${tone==="NAVY"?"#7AA2FF":tone}" onclick="act('iconf','${k}')" aria-pressed="${on}" title="${esc(SIG_RULE[k](S.horizon||1))}"><span class="tile">${lic(ic)}</span>${label}<b>${cnt[k]||0}</b></button>`;}).join("")}</div>
      </div>
    </div>`;
}
