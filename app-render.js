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
  const cs=q&&!q.blank&&q.fixtures[0]
    ? Math.exp(-clamp(p.gc90/Math.max(.35,1.42/ (q.fixtures[0].xgc||1.42)),.25,3.2)) : null;
  const csPct=q&&!q.blank?Math.round(clamp(Math.exp(-(q.fixtures[0]?.xgc||1.42)),0,0.8)*100)+"%":"—";
  const n=(v,d)=>v==null||!isFinite(v)?"—":v.toFixed(d==null?2:d);
  const pc=v=>v==null||!isFinite(v)?"—":Math.round(v*100)+"%";
  if(p.pos===1)return[["CS %",csPct],["Saves/90",n(p.sv90)],
    ["Goals prev",n(w?w.gp:null,1)],["GC/90",n(p.gc90)]];
  if(p.pos===2)return[["CS %",csPct],["DefCon %",pc(p.dcHitRate)],
    ["Aerial/90",n(w?w.aer90:null,1)],["GC/90",n(p.gc90)]];
  if(p.pos===3)return[["F3 pass/90",n(w?w.f390:null,1)],["xA/90",n(p.xa90)],
    ["Shots/90",n(w?w.sh90:null,1)],["xGI/90",n(p.xg90+p.xa90)]];
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
    const cFlag=S.compare&&(S.compare.flagged||[]).length
      ? S.model.players.find(p=>p.id===S.compare.flagged[0])?.pos : 0;
    const lock=cFlag||(S.flagged.length===1?S.model.players.find(p=>p.id===S.flagged[0])?.pos:0);
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
  const f=p.gw[g]?.fixtures?.[0];
  return f?Math.exp(-clamp(p.gc90/(1+(3-(f.diffDef??3))*0.18),.25,3.2)):null;
}
function bpsPer90(p,q){return q&&q.mins>0?p.bps*90/Math.max(1,p.minutes||q.mins):null;}
const SORTVAL=(p,k,g)=>{
  const W=ws(String(p.code||""),p.pos,S.lWin||38)||{};
  const f0=p.gw[g]?.fixtures?.[0];
  const team=(S.model.teams||[]).find(t=>t.id===p.team);
  const gwr=lGwRange();
  return ({name:p.web_name,team:p.teamName,pos:p.pos,price:p.price,
  next:(p.gw[g]?.fixtures||[]).reduce((s,f)=>s+f.diff,0)||99,form:p.form,lastform:p.lastForm,
  pred:hPts(p,g,S.tab==="table"?1:S.horizon),prxfpl:hPts(p,gwr.from,gwr.count),pred3:hPts(p,g,3),pred5:hPts(p,g,5),avg:avgFP(p,g,S.horizon),
  total:p.total,owned:p.owned,ppg:p.ppg,xg:p.xg90,xa:p.xa90,dc:p.dc90,
  mins:p.minutes,xmins:p.xMins,bonus:p.bonus,tin:p.tIn,
  startpct:W.startPct||0,xgi:(W.xg90||0)+(W.xa90||0),
  npxg:W.npxg90||0,dchit:W.dcHit||0,cc:W.cc90||0,box:W.box90||0,
  bps:bpsPer90(p,W)??-1,csp:csProbNext(p,g)??-1,sv90:W.sv90||0,
  spthreat:p.spThreat||0,penord:p.penOrder||99,
  /* position-specific columns — previously missing, so their headers did not sort */
  oppatt:f0?(f0.oppAtt??3):0,teamdef:team?team.def:0,
  xgot:W.xgot90||0,gprev:W.gp||0,gc90:W.gc90||0,pensv:p.pensSaved||0,og:p.ownGoals||0,
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
    const budget=planBank()+sellPrice(o);
    const clubs={};(S.squad||[]).filter(x=>x!==id).forEach(x=>{const q=P2(x);
      if(q)clubs[q.team]=(clubs[q.team]||0)+1;});
    const opts=S.model.players
      .filter(q=>q.pos===o.pos&&!(S.squad||[]).includes(q.id)&&q.avail>0
        &&q.price<=budget+0.001&&(clubs[q.team]||0)<3&&!(S.ignored||[]).includes(q.id))
      .map(q=>({out:o,inn:q,gain:hPts(q,g,S.horizon)-hPts(o,g,S.horizon)}))
      .filter(m=>m.gain>=0.1)
      .sort((a,b)=>b.gain-a.gain).slice(0,3);
    return `<div class="repl"><div style="padding:9px 12px;display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap">
      <span style="font-size:10px;font-weight:700;color:var(--cyan)">
        Replace ${esc(o.web_name)} · ${POS[o.pos]}</span>
      <span class="note">£${(planBank()+sellPrice(o)).toFixed(1)} to spend · sells for £${sellPrice(o).toFixed(1)}</span></div>
      ${opts.length?opts.map(m=>`<button class="prow" onclick="act('doswap',${o.id},${m.inn.id})">
        ${shirtSVG(m.inn.teamName.toUpperCase(),m.inn.pos===1,24)}
        <span style="flex:1;min-width:0">
          <span style="display:flex;align-items:center;gap:5px"><span style="font-size:12.5px;font-weight:600">${esc(m.inn.web_name)}</span>${sigHTML(m.inn,g)}</span>
          <span style="display:block;font-size:10px;color:var(--mute)">${esc(m.inn.teamName)} · £${m.inn.price.toFixed(1)} · ${m.inn.xMins}′ xMins</span></span>
        <span class="mono" style="color:var(--mint);font-weight:700">+${m.gain.toFixed(1)}</span></button>`).join("")
        :`<div class="pbody"><p class="note">No option improves this pick by +0.1 or more.</p></div>`}</div>`;
  }).join("");
}
const backTag=p=>p.back?`<span class="src" style="background:#4A1220;color:#FFC9D2" title="${esc(p.news)}">${p.back==="unknown"?"no date":esc(p.back)}</span>`:"";
const INJ=p=>p.avail===0?`<span title="${esc(p.news||"Unavailable")}" style="color:var(--red);font-size:11px">✚</span>`
  :(p.avail<1?`<span title="${esc(p.news||"Doubt")}" style="color:var(--amber);font-size:11px">✚</span>`:"");
const PD_PAGE=100;
function listHTML(){
  const g=VG();
  const a=sortList(filtered("planner"),S.lSort,S.lDir,g);
  const cmp=S.compare&&(S.compare.flagged||[]).length?S.compare:null;
  /* budget available: bank plus whatever the flagged players would raise — in the
     comparison context when a comparison player is flagged, else the main squad */
  const flags=cmp?cmp.flagged:(S.flagged||[]);
  const ownIds=cmp?cmp.squad:(S.squad||[]);
  const raised=flags.reduce((t,id)=>{
    const o=S.model.players.find(p=>p.id===id);return t+(o?sellPrice(o):0);},0);
  const budget=+((cmp?cmp.bank:S.bank)+raised).toFixed(1);
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
function tableHTML(){
  const g=VG();
  const a=sortList(filtered("list"),S.sortKey,S.sortDir,g);
  const W=S.lWin||38;
  const w=p=>ws(String(p.code||""),p.pos,W,p.price,teamMaxPrice(p.team));
  const gwr=lGwRange();
  const cols=[["name","Player"],["price","Price"],["signals","Signals"],["next","Next 3"],["form","Form"],["pred","xFPL"],
    ["prxfpl",gwr.from===gwr.to?`Pr xFPL (GW${gwr.from})`:`Pr xFPL (GW${gwr.from}-${gwr.to})`],["owned","Own %"],["startpct","Start %"],
    ["xmins","xMins"],["xgi","xGI/90"],["npxg","npxG/90"],["xa","xA/90"],["dchit","DefCon %"],
    ["csp","CS %"],["cc","CC/90"],["box","Box/90"],["bonus","Bonus"],["bps","BPS/90"],
    ["tin","TI"],["total","Pts"]];
  const KEY={pred:1,prxfpl:1,form:1,xg:1,xa:1,dc:1,next:1,xmins:1};
  /* Filtering by position swaps in the stats that matter for that position */
  /* position-specific stats appended to the right, ordered by importance */
  const POSCOLS={
    1:[["sv90","Saves/90"],["oppatt","Opp att"],["xgot","xGoT/90"],["gprev","G prev"],
       ["gc90","GC/90"],["pensv","Pen sv"],["og","OG"]],
    2:[["oppatt","Opp att"],["teamdef","Team def"],["cbit","CBIT/90"],["spthreat","SP threat"],
       ["aer","Aerial/90"],["xg","xG/90"],["gc90","GC/90"]],
    3:[["penord","Pen ord"],["spthreat","SP threat"],["shbox","Sh box/90"],["sh90","Shots/90"],
       ["f3","F3 pass/90"],["drb","Dribbles/90"],["bcm","BC missed"]],
    4:[["penord","Pen ord"],["shbox","Sh box/90"],["bcm","BC missed"],["sot","SoT/90"],
       ["conv","Conversion"],["aer","Aerial/90"]]
  };
  const POSKEY=new Set();
  if(S.lPos&&POSCOLS[S.lPos]){
    /* Every orange column for this position — the position-specific stats AND the
       highlighted general ones (CS %, DefCon %, Start %, …) — sits together right
       after xMins, position-specific first. */
    const genOrange=({1:["startpct","csp"],2:["dchit","csp","startpct"],
      3:["xgi","npxg","xa","cc"],4:["npxg","xgi","box"]}[S.lPos]||[]);
    const pulled=[];
    genOrange.forEach(k=>{const i=cols.findIndex(c=>c[0]===k);if(i>-1)pulled.push(cols.splice(i,1)[0]);});
    const at=cols.findIndex(c=>c[0]==="xmins")+1;
    cols.splice(at,0,...POSCOLS[S.lPos],...pulled);
    POSCOLS[S.lPos].forEach(c=>POSKEY.add(c[0]));
    genOrange.forEach(k=>POSKEY.add(k));POSKEY.add("xmins");
  }
  const TDESC={name:"Player name, club and position",price:"Current price",
    signals:"Signals: differential, hot streak, attack/defence threat, nailed starter, caution",
    next:"Next 3 fixtures — colour shows difficulty",form:"Average points over recent gameweeks",
    pred:"Projected points, next gameweek (xFPL)",pred3:"Projected points, next 3 GWs",
    pred5:"Projected points, next 5 GWs",prxfpl:"Projected points over the selected gameweek window",
    owned:"% of managers who own him",
    startpct:"Estimated chance of starting",xmins:"Expected minutes next GW",
    xgi:"Expected goal involvements per 90",npxg:"Non-penalty xG per 90",xa:"Expected assists per 90",
    dchit:"% of games hitting the defensive-contribution points threshold",
    csp:"Clean-sheet probability",cc:"Chances created per 90",box:"Touches in the box per 90",
    bonus:"Bonus points so far",bps:"Bonus-point-system score per 90",tin:"Transfers in this GW",
    total:"Total points so far",oppatt:"Opponent attack strength (next fixture)",
    teamdef:"His team's defensive rating",cbit:"Clearances, blocks, interceptions, tackles per 90",
    spthreat:"Set-piece goal threat",aer:"Aerial duels won per 90",xg:"Expected goals per 90",
    gc90:"Goals conceded per 90",penord:"Penalty-taker order (1 = first)",shbox:"Shots in the box per 90",
    sh90:"Shots per 90",f3:"Final-third passes per 90",drb:"Successful dribbles per 90",
    bcm:"Big chances missed",conv:"Goal conversion vs xG",sot:"Shots on target per 90",
    sv90:"Saves per 90",xgot:"xG on target faced per 90",gprev:"Goals prevented vs xGoT",
    pensv:"Penalties saved",og:"Own goals"};
  const head=cols.map(([k,n])=>{
    if(k==="signals")return `<th style="text-align:center" title="${TDESC.signals}">Signals</th>`;
    const hl=POSKEY.has(k)?"color:var(--amber)"          // relevant to the filtered position
      :(KEY[k]&&S.sortKey!==k?"color:var(--cyan)":"");
    return `<th class="${S.sortKey===k?"act":""}" onclick="act('sort','${k}')" title="${TDESC[k]||n}"
      style="text-align:${k==="name"?"left":"right"};${hl}">${n}${S.sortKey===k?(S.sortDir==="desc"?" ↓":" ↑"):""}</th>`;}).join("");
  const iconCell=p=>{
    const all=signals(p,g).map(([k,t])=>sigTile(k,t)).join("");
    return all?`<span class="sigcell">${all}</span>`:`<span style="color:var(--ink3)">·</span>`;};
  const pct=v=>(v*100).toFixed(0)+"%";
  const CELL={
    pred3:p=>hPts(p,g,3).toFixed(1),
    startpct:p=>{const q=w(p);return q?(q.estimated?"~":"")+pct(q.startPct):"—";},
    xgi:p=>{const q=w(p);return q?(q.xg90+q.xa90).toFixed(2):"—";},
    npxg:p=>{const q=w(p);return q?q.npxg90.toFixed(2):"—";},
    dchit:p=>{const q=w(p);return q?pct(q.dcHit):"—";},
    csp:p=>{const v=csProbNext(p,g);return v!=null?pct(v):"—";},
    cc:p=>{const q=w(p);return q?q.cc90.toFixed(2):"—";},
    box:p=>{const q=w(p);return q?q.box90.toFixed(1):"—";},
    bps:p=>{const v=bpsPer90(p,w(p));return v!=null?v.toFixed(1):"—";},
    sv90:p=>{const q=w(p);return q?q.sv90.toFixed(2):"—";},
    xgot:p=>{const q=w(p);return q?q.xgot90.toFixed(2):"—";},
    gprev:p=>{const q=w(p);return q?q.gp.toFixed(1):"—";},
    gc90:p=>{const q=w(p);return q?q.gc90.toFixed(2):"—";},
    pensv:p=>p.pensSaved||0, og:p=>p.ownGoals||0,
    oppatt:p=>{const f=p.gw[g]?.fixtures?.[0];return f?(f.oppAtt??3).toFixed(0):"—";},
    teamdef:p=>{const t=S.model.teams.find(t2=>t2.id===p.team);return t?t.def.toFixed(2):"—";},
    cbit:p=>{const q=w(p);return q?q.cbit90.toFixed(1):"—";},
    spthreat:p=>(p.spThreat||0).toFixed(1),
    aer:p=>{const q=w(p);return q?q.aer90.toFixed(1):"—";},
    penord:p=>p.penOrder&&p.penOrder<99?p.penOrder:"—",
    shbox:p=>{const q=w(p);return q?(q.sh90*0.62).toFixed(2):"—";},
    sh90:p=>{const q=w(p);return q?q.sh90.toFixed(2):"—";},
    sot:p=>{const q=w(p);return q?q.sot90.toFixed(2):"—";},
    f3:p=>{const q=w(p);return q?q.f390.toFixed(1):"—";},
    drb:p=>{const q=w(p);return q?q.drb90.toFixed(2):"—";},
    bcm:p=>{const q=w(p);return q?q.bcm:"—";},
    conv:p=>{const q=w(p);return q&&q.xg90>0?((q.g/Math.max(.1,q.xg90*q.mins/90))).toFixed(2):"—";},
    price:p=>`£${p.price.toFixed(1)}${arw(p.priceChange)}`,
    form:p=>p.form.toFixed(1)+formTag(p), lastform:p=>p.lastForm?p.lastForm.toFixed(1):"—",
    pred:p=>hPts(p,g,1).toFixed(1),prxfpl:p=>{const r=lGwRange();return hPts(p,r.from,r.count).toFixed(1);},
    pred5:p=>hPts(p,g,5).toFixed(1), avg:p=>avgFP(p,g,S.horizon).toFixed(1),
    ppg:p=>p.ppg.toFixed(1), total:p=>p.total, owned:p=>p.owned.toFixed(1),
    xg:p=>p.xg90.toFixed(2), xa:p=>p.xa90.toFixed(2), dc:p=>p.dc90.toFixed(1),
    xmins:p=>p.xMins+"′"+minsTag(p), saves:p=>(p.sv90||0).toFixed(1), cs:p=>(p.csRate||0).toFixed(2),
    bonus:p=>p.bonus, ict:p=>p.ict.toFixed(0),
    tin:p=>p.tIn>999?(p.tIn/1000).toFixed(0)+"k":p.tIn};
  /* F77 (bundle 9): 100 rows at a time; laying out 320 took most of a
     redraw (about 70 ms on a laptop, several times that on a phone) */
  const lim=S.pdLimit||PD_PAGE;
  const rows=a.slice(0,lim).map(p=>{
    const q=p.gw[g]||{fixtures:[]};
    const nx=q.fixtures.length?q.fixtures.map(f=>fdrPill(f.opp,f.home,posDiff(p,f))).join(" ")
      :`<span style="color:var(--mute);font-size:10px">BLANK</span>`;
    const own=(S.squad||[]).includes(p.id);
    let tds=`<td class="nm"><span style="display:flex;align-items:center;gap:6px">
        <button class="pdstar${S.stars.includes(p.id)?" on":""}" onclick="act('star',${p.id})" title="${S.stars.includes(p.id)?"Remove from shortlist":"Shortlist"}" aria-label="${S.stars.includes(p.id)?"Remove "+esc(p.web_name)+" from shortlist":"Shortlist "+esc(p.web_name)}" aria-pressed="${S.stars.includes(p.id)}">★</button>
        ${shirtSVG(p.teamName.toUpperCase(),p.pos===1,22)}
      <span style="min-width:0"><span style="display:flex;align-items:center;gap:5px">
        <span style="font-weight:600;font-size:12px">${esc(p.web_name)}</span>${INJ(p)}
        ${own?"":`<button class="pdadd" onclick="act('addplan',${p.id})" title="Add to Team Planner" aria-label="Add ${esc(p.web_name)} to Team Planner">+</button>`}</span>
      <span style="display:flex;gap:4px;align-items:center;font-size:10px;color:var(--mute)">${esc(p.teamName)} · ${POS[p.pos]} ${backTag(p)}</span></span></span></td>`;
    cols.slice(1).forEach(([k])=>{
      if(k==="signals"){tds+=`<td style="text-align:center">${iconCell(p)}</td>`;return;}
      if(k==="next"){tds+=`<td style="text-align:center;white-space:nowrap">${fix3(p,g)}</td>`;return;}
      const hot=(k==="pred"||k==="pred5"||k==="pred3"||k==="prxfpl")?"color:var(--mint);font-weight:700;"
        :(POSKEY.has(k)?"color:var(--amber);":(KEY[k]?"color:var(--cyan);":""));
      tds+=`<td style="text-align:right;${hot}">${CELL[k]?CELL[k](p):""}</td>`;});
    return `<tr style="${p.avail===0?"opacity:.4;":""}${own?"opacity:.45":""}" title="${own?"Already in your squad":""}">${tds}</tr>`;}).join("");
  /* F5: the table used to stop at 320 with no way to reach the rest */
  const more=a.length>lim?`<div class="pdmore"><span class="note">Showing ${lim} of ${a.length} players</span>
    <button onclick="act('pdmore')">Show ${Math.min(PD_PAGE,a.length-lim)} more</button><button onclick="act('pdall')">Show all ${a.length}</button></div>`:
    (lim>PD_PAGE&&a.length>PD_PAGE?`<div class="pdmore"><span class="note">Showing all ${a.length} players</span><button onclick="act('pdless')">Show fewer</button></div>`:"");
  /* F92 (bundle 8): an empty shortlist says why, instead of a bare header row */
  if(S.starOnly&&!S.stars.length)return `<div class="pbody"><p class="note" style="margin:0">No shortlisted players yet. Tap ★ on any row to add one.</p></div>`;
  return `<div class="scroll tallscroll"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>${more}`;
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
/* ---------- player comparison radar (Transfers page) ---------- */
function radarHTML(){
  const g=VG();
  const ids=S.radarIds||[null,null,null];
  const search=S.radarSearch||["","",""];
  /* A position chosen up front (before any player is picked) locks search the
     same way picking a player used to — either sets it. */
  const posPick=S.radarPos||null;
  const active=ids.map(id=>id?S.model.players.find(p=>p.id===id):null);
  const activePlayers=active.filter(Boolean);
  const lockedPos=activePlayers.length?activePlayers[0].pos:posPick;
  const COL=["var(--mint)","var(--amber)","var(--cream)"];

  const HSTEPS=[1,3,5,10,"rest"];
  const curH=S.radarHorizon||5;
  const hIdx=Math.max(0,HSTEPS.indexOf(curH));
  const gwsFor=h=>h==="rest"?Math.max(1,39-g):h;
  const hLabel=h=>h==="rest"?"Rest of season":`Next ${h} GW${h>1?"s":""}`;

  const W=p=>ws(String(p.code||""),p.pos,S.lWin||38)||{};
  /* Every stat here is selectable — not just the six shown by default — matching
     the orange position-relevant stats on Player Data, using the same underlying
     figures the radar already had access to. Team/opponent-context columns from
     Player Data (Opp att, Team def, Pen ord…) are left out deliberately: a radar
     axis describes the player being compared, not their next fixture. */
  const AXF={
    "xFPL":p=>hPts(p,g,gwsFor(curH)),"Form":p=>p.form||0,
    "xGI/90":p=>{const w=W(p);return(w.xg90||0)+(w.xa90||0);},"xMins":p=>p.xMins||0,
    "npxG/90":p=>W(p).npxg90||0,"xA/90":p=>W(p).xa90||0,"CC/90":p=>W(p).cc90||0,
    "xG/90":p=>W(p).xg90||0,"Shots/90":p=>W(p).sh90||0,"SoT/90":p=>W(p).sot90||0,
    "DefCon/90":p=>W(p).dc90||W(p).cbit90||0,"CBIT/90":p=>W(p).cbit90||0,
    /* F35: CS % and Start % read the player's match record (share of his
       60-minute games with a clean sheet, share of appearances he started);
       they read fields model players never carry, so they always plotted 0.
       BPS/90 plotted the season total. */
    "CS %":p=>(W(p).csRate||0)*100,"Aerials/90":p=>W(p).aer90||0,"Saves/90":p=>W(p).sv90||0,
    "G prevented":p=>W(p).gp||0,"xGoT/90":p=>W(p).xgot90||0,"Start %":p=>(W(p).startPct||0)*100,
    "Dribbles/90":p=>W(p).drb90||0,"F3 pass/90":p=>W(p).f390||0,"Box/90":p=>W(p).box90||0,
    "Bonus":p=>p.bonus||0,"BPS/90":p=>bpsPer90(p,W(p))||0,"Owned %":p=>p.owned||0};
  const DEFAULT_AXSET={1:["xFPL","Form","Saves/90","CS %","G prevented","xMins"],
    2:["xFPL","Form","DefCon/90","CS %","Aerials/90","xMins"],
    3:["xFPL","Form","xGI/90","npxG/90","xA/90","CC/90"],
    4:["xFPL","Form","npxG/90","xG/90","Shots/90","xGI/90"]};
  /* Wider pool offered per position when picking stats — a superset of the
     default six, position-appropriate. */
  const OPTS={1:["xFPL","Form","Saves/90","CS %","G prevented","xMins","xGoT/90","Start %"],
    2:["xFPL","Form","DefCon/90","CBIT/90","CS %","Aerials/90","xMins","Start %","Bonus"],
    3:["xFPL","Form","xGI/90","npxG/90","xA/90","CC/90","Shots/90","F3 pass/90","Dribbles/90","Bonus"],
    4:["xFPL","Form","npxG/90","xG/90","Shots/90","SoT/90","xGI/90","Box/90","Bonus"]};
  const chosen=(S.radarAxes&&S.radarAxes[lockedPos])||null;
  const axes=(chosen&&chosen.length?chosen:DEFAULT_AXSET[lockedPos||3])||DEFAULT_AXSET[3];

  const takenIds=new Set(ids.filter(Boolean));
  const pool=i=>S.model.players.filter(p=>(p.id===ids[i]||!takenIds.has(p.id))&&(!lockedPos||p.pos===lockedPos));
  const results=i=>{const q=(search[i]||"").trim().toLowerCase();if(!q)return[];
    return pool(i).filter(p=>p.web_name.toLowerCase().includes(q)||p.teamName.toLowerCase().includes(q))
      .sort((a,b)=>hPts(b,g,S.horizon)-hPts(a,g,S.horizon)).slice(0,8);};

  const slot=i=>{
    const p=active[i];
    if(p)return `<div class="rslot" style="--acc:${COL[i]}"><div class="rchip">
        <span class="rsw" style="background:${COL[i]}"></span>${shirtSVG(p.teamName.toUpperCase(),p.pos===1,24)}
        <span class="rchip-nm">${esc(p.web_name)}<span class="rchip-tm">${esc(p.teamName)} · £${p.price.toFixed(1)}</span></span>
        <button class="rchip-x" onclick="act('radarclear',${i})" title="Remove">✕</button></div></div>`;
    const rs=results(i);
    /* Fixed: typing used to trigger a full page re-render on every keystroke,
       which destroyed and recreated the input, stealing focus after one
       character. searchInput() debounces and restores focus + caret. */
    return `<div class="rslot" style="--acc:${COL[i]}">
      <span class="rsw" style="background:${COL[i]}"></span>
      <input class="rsearch" id="rsrch${i}" placeholder="${lockedPos?"Search "+POS[lockedPos]+"…":"Search a player…"}"
        value="${esc(search[i]||"")}" oninput="searchInput('radarsearch',this,${i})">
      ${(search[i]||"").trim()?`<div class="rsdrop">${rs.length?rs.map(pl=>`<div class="rsopt" onclick="act('radarpick',${i},${pl.id})">
          ${shirtSVG(pl.teamName.toUpperCase(),pl.pos===1,18)}<span class="rsopt-nm">${esc(pl.web_name)}</span>
          <span class="note">${esc(pl.teamName)}</span></div>`).join(""):`<div class="rsopt" style="cursor:default"><span class="note">No matches</span></div>`}</div>`:""}
      </div>`;};

  const posFilter=`<span class="rposf">
    ${[1,2,3,4].map(p=>`<button class="${lockedPos===p?"on":""}" ${activePlayers.length?"disabled":""}
      onclick="act('radarpos',${p})" title="${activePlayers.length?"Clear players to change position":""}">${POS[p]}</button>`).join("")}
    ${lockedPos&&!activePlayers.length?`<button onclick="act('radarpos',null)" title="Clear position">✕</button>`:""}</span>`;
  const horizonCtl=`<span class="rhorizon2"><span class="note">xFPL over</span>
    <input type="range" min="0" max="4" step="1" value="${hIdx}" oninput="act('radarhorizon',this.value)">
    <span class="rhval2">${hLabel(curH)}</span></span>`;

  const statPicker=lockedPos?`<div class="rstatpick">
      <span class="note" style="display:block;margin-bottom:5px">Compare on (up to 6) — <button class="rlink" onclick="act('radaraxes',${lockedPos},null)">reset to default</button></span>
      <div style="display:flex;gap:5px;flex-wrap:wrap">
        ${OPTS[lockedPos].map(ax=>`<button class="chipbtn ${axes.includes(ax)?"on":""}" onclick="act('radaraxes',${lockedPos},'${ax}')">${ax}</button>`).join("")}
      </div></div>`:"";

  let content;
  if(!activePlayers.length){
    content=`<p class="note" style="margin:14px 0 0;text-align:center">Search for up to three players in the same position — own squad included — to compare them.</p>`;
  }else{
    const maxes=axes.map(ax=>Math.max(1e-6,...activePlayers.map(p=>AXF[ax](p))));
    const fmt=(ax,v)=>ax==="CS %"||ax==="Start %"||ax==="Owned %"?v.toFixed(0)+"%":(Number.isInteger(v)?v.toFixed(0):v.toFixed(1));
    /* Win-count per player across every row, to star the strongest overall
       performer in this specific comparison — separate from the per-row
       yellow highlight, which marks the best value in that one stat. */
    const wins=[0,0,0];
    const rows=axes.map(ax=>{
      const vals=active.map(p=>p?AXF[ax](p):null);
      const best=Math.max(...vals.filter(v=>v!=null));
      const bestJ=activePlayers.length>1?vals.findIndex(v=>v===best):-1;
      if(bestJ>=0)wins[bestJ]++;
      return `<tr><td class="rmet">${ax}</td>${active.map((p,j)=>{
        if(!p)return `<td class="rtd">—</td>`;
        const isBest=j===bestJ;
        return `<td class="rtd${isBest?" rbest":""}">${fmt(ax,vals[j])}</td>`;}).join("")}</tr>`;}).join("");
    const topWins=Math.max(...wins);
    const thead=`<tr><td></td>${active.map((p,j)=>{
      if(!p)return "<th></th>";
      const photoUrl=imgSrc("player",p.code);
      return `<th style="color:${COL[j]}">
        <span class="rphotowrap"><img class="rphoto" alt="" src="${photoUrl}"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <span class="rphotofallback" style="display:none">${shirtSVG(p.teamName.toUpperCase(),p.pos===1,32)}</span></span>
        <span class="rth-nm">${esc(p.web_name)}${wins[j]===topWins&&topWins>0?' <span class="rwinstar" title="Wins the most categories in this comparison">★</span>':""}</span></th>`;}).join("")}</tr>`;
    const table=`<table class="rtable"><thead>${thead}</thead><tbody>${rows}</tbody></table>`;

    const cx=150,cy=150,R=104,N=axes.length;
    const ang=i=>(-90+i*360/N)*Math.PI/180;
    const pt=(i,f)=>[(cx+Math.cos(ang(i))*R*f).toFixed(1),(cy+Math.sin(ang(i))*R*f).toFixed(1)];
    const rings=[0.25,0.5,0.75,1].map(f=>`<polygon points="${axes.map((_,i)=>pt(i,f).join(",")).join(" ")}" fill="none" stroke="var(--ink3)" stroke-width="1" opacity=".6"/>`).join("");
    const spokes=axes.map((_,i)=>`<line x1="${cx}" y1="${cy}" x2="${pt(i,1)[0]}" y2="${pt(i,1)[1]}" stroke="var(--ink3)" stroke-width="1" opacity=".6"/>`).join("");
    const labels=axes.map((ax,i)=>{const[x,y]=pt(i,1.17);
      return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="9.5" fill="var(--mute)">${ax}</text>`;}).join("");
    const polys=active.map((p,j)=>{if(!p)return"";const pts=axes.map((ax,i)=>pt(i,Math.min(1,AXF[ax](p)/maxes[i])).join(",")).join(" ");
      return `<polygon points="${pts}" fill="${COL[j]}" fill-opacity=".16" stroke="${COL[j]}" stroke-width="2.5"/>`;}).join("");
    const svg=`<svg viewBox="0 0 300 300" style="width:100%;max-width:300px;height:auto;display:block;margin:0 auto">${rings}${spokes}${labels}${polys}</svg>`;
    const legend=activePlayers.map(p=>{const j=active.indexOf(p);
      return `<span class="tlegend"><span class="tdot" style="background:${COL[j]};height:8px;width:8px;border-radius:50%"></span>${esc(p.web_name)}</span>`;}).join("");

    content=`<div class="rgrid">
        <div class="rtablewrap">${table}</div>
        <div class="rradarwrap">
          <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-bottom:8px">${legend}</div>
          ${svg}
        </div>
      </div>
      <p class="note" style="margin:10px 0 0;text-align:center">Yellow = best in that row · ★ = wins the most categories · axes scaled to the strongest player shown · ${esc(POS[lockedPos])} only.</p>`;
  }

  return `<div class="panel rcompare"><div class="phead"><h2>Compare players</h2>
      <span class="note">${lockedPos?POS[lockedPos]+" only":"up to 3 · same position"}</span></div>
    <div class="pbody">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">${posFilter}${horizonCtl}</div>
      <div class="rslots">${[0,1,2].map(slot).join("")}</div>
      ${statPicker}
      ${content}
    </div></div>`;
}
function transfersHTML(){
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
  const top=pool[0];
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
  const headScout=(top&&pool.length&&top.gain>=moveBar(g))?`<div class="panel" style="border-color:var(--amber);background:#33240B">
      <div class="phead" style="border-color:#5A3F10"><h2 style="color:var(--amber)">Head Scout</h2>
      <span class="note">GW${g}${S.horizon>1?`–${g+S.horizon-1}`:""}</span></div>
    <div class="pbody">
      <div style="font-size:10px;color:var(--mint);font-weight:700;margin-bottom:8px">Top target</div>
      ${top.gain>=moveBar(g)?swapCardHTML(top,g):`<p class="note" style="margin:0">Head Scout recommends no transfers: the best available move is worth only +${top.gain.toFixed(1)} points${freeLeft(g)>0?"":`, not enough to cover a ${HIT}-point hit`}.</p>`}</div></div>`
    :`<div class="panel"><div class="phead"><h2>Head Scout</h2></div><div class="pbody">
      <p class="note">No transfer improves your predicted total within budget and the three-per-club limit.</p></div></div>`;

  /* F95 (bundle 8): players taken off the suggestions can be put back */
  const ignoredP=(S.ignored||[]).map(id=>S.model.players.find(p=>p.id===id)).filter(Boolean);
  const ignoredPanel=ignoredP.length?`<div class="panel"><div class="phead"><h2>Not Suggesting</h2>
      <button onclick="act('unignore')">Suggest all again</button></div>
    <div class="pbody" style="display:flex;gap:8px;flex-wrap:wrap">${ignoredP.map(p=>`<button onclick="act('unignore',${p.id})" title="Suggest ${esc(p.web_name)} again">${esc(p.web_name)} ↺</button>`).join("")}</div></div>`:"";
  const suggestTitle=ignoredPanel+`<div class="panel"><div class="phead"><h2>Head Scout suggestions</h2>
      <span class="note">best four per position</span></div></div>`;
  const byPos=[1,2,3,4].map(pos=>{
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

  return planPanelHTML()+radarHTML()+picker+comboPanel+headScout+priceMovesHTML()+suggestTitle+byPos;
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
/* S8 (Stage 1, 19 Oct 2026): what a Fixtures cell shows. Difficulty is the
   1-5 band; Clean Sheet % is the chance of keeping one, from the fixture's
   expected goals against; Projected Goals is what the side should score.
   The same five-step colours, best green to worst dark red. */
function readPill(t,opp,home,lens){
  const r=S.fixRead||"fdr";
  if(r==="fdr"||!opp)return fdrPill(opp?.short||"?",home,fdrOf(opp,home,t,lens),{short:true});
  const xgc=fdrCalc(t,opp,home,"xgc"),xgf=fdrCalc(t,opp,home,"xgf");
  const band=r==="cs"?(v=>v>=45?1:v>=35?2:v>=25?3:v>=15?4:5)(Math.exp(-xgc)*100)
                     :(v=>v>=2?1:v>=1.6?2:v>=1.2?3:v>=0.9?4:5)(xgf);
  const [b,c]=fdrCol(band);
  const val=r==="cs"?Math.round(Math.exp(-xgc)*100)+"%":xgf.toFixed(1);
  return `<span class="fdrpill readpill" style="background:${b};color:${c};${home?"":"font-style:italic;"}">${esc(String(opp.short).slice(0,3))}<small>${val}</small></span>`;
}
function fixturesHTML(){
  const g=VG(), teams=S.model.teams;
  const mode=S.fixMode||"team";
  const lens=S.fdrLens||null;
  const span=S.expand.allFix?39-g:10;
  const start=Math.max(g,Math.min(S.fixGW||g,38));

  /* ---- targets: clubs whose strength meets a weak opposite number ---- */
  const targets=(kind)=>{
    const out=[];
    teams.forEach(t=>{
      const runs=[];
      for(let e=g;e<g+5&&e<=38;e++)(S.model.byEv[e]||[]).filter(f=>f.ht===t||f.at===t).forEach(f=>{
        const home=f.ht===t, opp=home?f.at:f.ht;
        const d=fdrOf(opp,home,t,kind==="att"?"att":"def");
        runs.push({e,opp:opp.short,home,d});});
      const good=runs.filter(r=>r.d<=2).length;
      if(good<4||runs.length<4)return;
      const rating=kind==="att"?t.att:(2.6-t.def);      // higher is better either way
      const avg=runs.reduce((a,r)=>a+r.d,0)/runs.length;
      out.push({t,runs,good,rating,avg});
    });
    /* strong side meeting weak opposition — rank on both, cap at five */
    return out.filter(x=>x.rating>=(kind==="att"?1.30:1.12))
      .sort((a,b)=>(b.good-a.good)||(a.avg-b.avg)||(b.rating-a.rating)).slice(0,5);
  };
  const targetPanel=(kind,title,note)=>{
    const list=targets(kind);
    return `<div class="panel">
      <div class="phead"><h2 style="color:${kind==="att"?"var(--mint)":"var(--cyan)"}">${title}</h2>
        <span class="note">${list.length?list.length+" clubs":"none right now"}</span></div>
      <div class="pbody" style="border-bottom:1px solid var(--ink3)"><p class="note" style="margin:0">${note}</p></div>
      ${list.length?list.map(x=>`<div class="fixrow">
        <span class="fixteam" style="flex:none;width:148px;gap:8px">${badgeOrShirt(x.t,20)}
          <b>${esc(x.t.name||x.t.short)}</b></span>
        <span class="note" style="flex:none;width:60px;text-align:right;font-family:'Geist',system-ui,sans-serif;font-weight:800;font-size:14px;color:${kind==="att"?"var(--mint)":"var(--cyan)"}">${x.avg.toFixed(2)}</span>
        <span class="note" style="flex:none;width:64px">${x.good} of ${x.runs.length}</span>
        <span class="pillrow">${x.runs.map(r=>
          fdrPill(r.opp,r.home,r.d,{short:true})).join("")}</span></div>`).join("")
        :`<div class="pbody"><p class="note">No club has four kind fixtures in the next five on this measure.</p></div>`}
    </div>`;
  };

  const head=`<div class="panel"><div class="phead"><h2>Fixtures</h2></div>
    <div class="pbody" style="border-bottom:1px solid var(--ink3);display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:center">
      <span class="pseg">
        <button class="${mode==="team"?"on":""}" onclick="act('fixmode','team')">Club</button>
        <button class="${mode==="gw"?"on":""}" onclick="act('fixmode','gw')">Gameweek</button></span>
      <span class="pseg">
        ${[["all","Overall"],["att","Attackers"],["def","Defenders"]].map(([k,n])=>
          `<button class="${(lens||"all")===k?"on":""}" onclick="act('lens','${k}')">${n}</button>`).join("")}</span>
      ${mode==="team"?`<span class="pseg" aria-label="What each cell shows">
        ${[["fdr","Difficulty"],["cs","Clean Sheet %"],["gf","Projected Goals"]].map(([k,n])=>
          `<button class="${(S.fixRead||"fdr")===k?"on":""}" onclick="act('fixread','${k}')">${n}</button>`).join("")}</span>`:""}
    </div>
    <div class="pbody" style="border-bottom:1px solid var(--ink3);display:flex;gap:12px;flex-wrap:wrap;align-items:center">
      <span class="note" style="flex:1;min-width:220px">A defender's rating reads the opponent's attack; an attacker's reads their defence.</span>
      <span style="display:flex;gap:4px;align-items:center">
        ${[1,2,3,4,5].map(d=>{const[b,c]=fdrCol(d);
          return `<span class="fdrpill" style="background:${b};color:${c};min-width:20px">${d}</span>`;}).join("")}</span>
    </div></div>`;

  if(mode==="team"){
    const windowAvg=(t,n)=>{let s2=0,c=0;
      for(let e=g;e<g+n&&e<=38;e++)(S.model.byEv[e]||[]).filter(f=>f.ht===t||f.at===t)
        .forEach(f=>{s2+=fdrOf(f.ht===t?f.at:f.ht,f.ht===t,t,lens);c++;});
      return c?s2/c:5;};
    const scored=teams.map(t=>({t,d1:windowAvg(t,1),d3:windowAvg(t,3),d5:windowAvg(t,5)}));
    const sk=S.fixSort||"d5", dir=S.fixDir||"asc";
    scored.sort((a,b)=>dir==="asc"?a[sk]-b[sk]:b[sk]-a[sk]);
    const best3=scored.slice(0,3).map(x=>x.t);
    const arrow=k=>sk===k?(dir==="asc"?" ↑":" ↓"):"";
    let th=`<th style="text-align:left">Club</th>`
      +[["d1","1 GW"],["d3","3 GW"],["d5","5 GW"]].map(([k,n])=>
        `<th class="${sk===k?"act":""}" style="text-align:right" onclick="act('fixsort','${k}')">${n}${arrow(k)}</th>`).join("");
    for(let e=start;e<start+span&&e<=38;e++)th+=`<th style="text-align:center">GW${e}</th>`;
    const rows=scored.map(({t,d1,d3,d5})=>{
      let cells="";
      for(let e=start;e<start+span&&e<=38;e++){
        const fx=(S.model.byEv[e]||[]).filter(f=>f.ht===t||f.at===t);
        if(!fx.length){cells+=`<td style="text-align:center"><span class="fdrpill" style="background:var(--ink3);color:var(--mute)">—</span></td>`;continue;}
        cells+=`<td style="text-align:center;white-space:nowrap"><span class="pillrow" style="justify-content:center">${fx.map(f=>{
          const home=f.ht===t, opp=home?f.at:f.ht;
          return readPill(t,opp,home,lens);}).join("")}</span></td>`;}
      const hot=best3.includes(t);
      const col=v=>v<=2.2?"var(--mint)":v>=3.6?"var(--red)":"var(--cream)";
      return `<tr style="${hot?"background:rgba(45,220,135,.07)":""}">
        <td class="nm" style="white-space:nowrap"><span style="display:flex;align-items:center;gap:7px">
          ${badgeOrShirt(t,20)}<b>${esc(t.name||t.short)}</b>
          ${hot?`<span class="sig" style="border-color:${lens==="def"?"var(--cyan)":"var(--mint)"};color:${lens==="def"?"var(--cyan)":"var(--mint)"}" title="${lens==="def"?"Kind defensive run":"Kind attacking run"}">${lens==="def"?ICON_DEF:ICON_ATT}</span>`:""}</span></td>
        <td class="mono" style="text-align:right;color:${col(d1)}">${d1.toFixed(1)}</td>
        <td class="mono" style="text-align:right;color:${col(d3)}">${d3.toFixed(2)}</td>
        <td class="mono" style="text-align:right;font-weight:700;color:${col(d5)}">${d5.toFixed(2)}</td>${cells}</tr>`;});
    return `<div class="trkrow2">${targetPanel("att","Attack",
        "Clubs with a strong attack meeting weak defences in at least four of the next five.")}${targetPanel("def","Defence",
        "Solid defences meeting weak attacks in at least four of the next five.")}</div>`
      +head+`<div class="panel">${navFix(start,span,g)}
        <div class="scroll"><table><thead><tr>${th}</tr></thead><tbody>${rows.join("")}</tbody></table></div>
        ${navFix(start,span,g)}</div>`;
  }

  /* ---- by gameweek ---- */
  let out="";
  for(let e=start;e<start+span&&e<=38;e++){
    const fx=(S.model.byEv[e]||[]).slice().sort((a,b)=>String(a.kickoff).localeCompare(String(b.kickoff)));
    if(!fx.length)continue;
    const ev=(S.events||[]).find(x=>x.id===e);
    /* UK time, always, with the GMT/BST label. The official FPL API's own
       nextDeadline (via /api/status) wins for the upcoming gameweek. */
    const dlIso=(e===g&&S.status&&S.status.fpl&&S.status.fpl.nextDeadline)
      ?S.status.fpl.nextDeadline:(ev&&ev.deadline?ev.deadline:null);
    const dl=dlIso?ukDeadline(dlIso):"";
    out+=`<div class="gwband"><span>Gameweek ${e}${e===g?" · next":""}</span>
      ${dl?`<span class="gwdl">Deadline ${esc(dl)}</span>`:""}</div>`;
    fx.forEach(f=>{
      const h=f.ht,a=f.at;if(!h||!a)return;
      const hd=fdrOf(a,true,h,lens), ad=fdrOf(h,false,a,lens);
      const dt=f.kickoff?new Date(f.kickoff):null;
      const d=dt?ukFmt(dt,{weekday:"short",day:"numeric",month:"short"}):"";
      const tm=dt?ukHHMM(dt):"";
      const strongSide=t=>t.att>=1.30?`<span class="sig" style="border:none">${ICON_ATT}</span>`
        :(2.6-t.def)>=1.12?`<span class="sig" style="border:none">${ICON_DEF}</span>`:"";
      out+=`<div class="fixrow" style="align-items:flex-start;flex-wrap:wrap">
        <span class="fixteam" style="gap:8px">${badgeOrShirt(h,22)}
          <span style="font-weight:600">${esc(h.name||h.short)}</span>${strongSide(h)}
          ${fdrPill(a.short,true,hd,{short:true})}</span>
        <span style="flex:none;width:112px;text-align:center;line-height:1.25">
          <span style="display:block;color:var(--cream);font-size:11px;font-weight:600">${esc(tm)}</span>
          <span style="display:block;color:var(--mute);font-size:10px">${esc(d)}</span></span>
        <span class="fixteam away" style="gap:8px">${fdrPill(h.short,false,ad,{short:true})}
          ${strongSide(a)}<span style="font-weight:600">${esc(a.name||a.short)}</span>
          ${badgeOrShirt(a,22)}</span>
        <span style="flex-basis:100%;display:flex;gap:14px;justify-content:center;margin-top:5px">
          <span class="last3">${lastResults(h,g)}</span>
          <span class="note" style="font-size:10px;align-self:center">vs</span>
          <span class="last3">${lastResults(a,g)}</span></span></div>`;
    });
  }
  return head+`<div class="panel">${navFix(start,span,g)}${out||'<div class="pbody"><p class="note">No fixtures in this range.</p></div>'}${navFix(start,span,g)}</div>`;
}
/* Last 3 completed results before a given gameweek — derived from fixture
   scores the app already loads (S.fixtures[].hs/as populate once a match has
   actually been played), so no new data source is needed.
   F21: fixture rows carry club codes, not club ids, and four codes equal
   another club's id, so matching f.h against team.id showed the wrong club's
   results. buildModel() already resolves each row to its club (f.ht, f.at),
   so the match is on that resolved club. */
function lastResults(team,beforeGw){
  const played=(S.fixtures||[]).filter(f=>(f.ht===team||f.at===team)&&f.hs!=null&&f.as!=null&&f.event<beforeGw)
    .sort((a,b)=>b.event-a.event).slice(0,3).reverse();
  if(!played.length)return `<span class="note" style="font-size:10px">no results yet</span>`;
  return played.map(f=>{
    const home=f.ht===team;
    const gf=home?f.hs:f.as, ga=home?f.as:f.hs;
    const res=gf>ga?"W":gf<ga?"L":"D";
    const col=res==="W"?"var(--mint)":res==="L"?"var(--red)":"var(--mute)";
    return `<span class="l3" style="background:${col}" title="GW${f.event} · ${gf}-${ga} (${home?"Home":"Away"})">${res}<sub>${home?"H":"A"}</sub></span>`;
  }).join("");
}
function navFix(start,span,g){
  return `<div class="pbody" style="display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap">
    <button class="${S.expand.allFix?"on":""}" onclick="act('expand','allFix')">${S.expand.allFix?"Ten at a time":"Show all 38"}</button>
    <button onclick="act('fixgw',${Math.max(g,start-10)})" ${start<=g?"disabled":""}>← earlier</button>
    <span class="note">GW${start}–${Math.min(38,start+span-1)}</span>
    <button onclick="act('fixgw',${Math.min(38,start+10)})" ${start+span>38?"disabled":""}>later →</button></div>`;
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

  return `<div class="sqgrid">
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
const SIG_ICONS={
  "trending-down":'<path d="M16 17h6v-6"/><path d="m22 17-8.5-8.5-5 5L2 7"/>',
  target:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  sparkles:'<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
  "triangle-alert":'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  "chevron-down":'<path d="m6 9 6 6 6-6"/>',
  "calendar-range":'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M16 2v3"/><path d="M3 9h18"/><path d="M8 2v3"/><path d="M17 13h-6"/><path d="M13 17H7"/><path d="M7 13h.01"/><path d="M17 17h.01"/>',
  "arrow-left-right":'<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  flame:'<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  shield:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  "shield-off":'<path d="m2 2 20 20"/><path d="M5 5a1 1 0 0 0-1 1v7c0 5 3.5 7.5 7.67 8.94a1 1 0 0 0 .67.01c2.35-.82 4.48-1.97 5.9-3.71"/><path d="M9.309 3.652A12.252 12.252 0 0 0 11.24 2.28a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1v7a9.784 9.784 0 0 1-.08 1.264"/>',
  gem:'<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>',
  crosshair:'<circle cx="12" cy="12" r="10"/><path d="M22 12h-4"/><path d="M6 12H2"/><path d="M12 6V2"/><path d="M12 22v-4"/>',
  trophy:'<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>'
};
const sgIcon=(k,cls="")=>`<svg class="sgi ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SIG_ICONS[k]||""}</svg>`;
/* thresholds, agreed with the mock-up */
const SIG={formHot:5,diffOwned:5,diffMins:60,sellOwned:10,sellForm:3,threatMins:270,replaceForm:3,replaceShare:0.8,replaceMins:45,swapHorizon:5,runWeeks:5};
const sgF1=v=>(Math.round(v*10)/10).toFixed(1);
const sgAvail=p=>p.status==="a"||p.status==="d";

function signalsHTML(){
  if(!S.model)return "";
  const M=S.model,G=VG(),H=S.sigH||3,posF=S.sigPos||0;
  const squad=new Set(S.squad||[]);
  const bank=+(S.bank||0);
  const pa=S.playerActuals||{};
  const lastGws=[];for(let e=G-6;e<G;e++)if(e>=1)lastGws.push(e);
  const pool=M.players.filter(p=>p.minutes>0);
  const posOk=p=>!posF||p.pos===posF;
  const fold=new Set(S.sigFold||[]);

  const spark=p=>{
    const a=pa[p.id]||pa[String(p.id)]||{};
    const vals=lastGws.map(e=>a[e]??a[String(e)]??null);
    const max=Math.max(8,...vals.map(v=>v||0)),bw=6,gap=3,h=22,wd=Math.max(1,vals.length*(bw+gap)-gap);
    const bars=vals.map((v,i)=>{
      if(v==null)return `<rect x="${i*(bw+gap)}" y="${h-2}" width="${bw}" height="2" rx="1" fill="var(--ink3)"/>`;
      const bh=Math.max(2,Math.round(Math.max(v,0)/max*h));
      const col=v>=8?"var(--mint)":v>=4?"#7FA8C9":"#55606F";
      return `<rect x="${i*(bw+gap)}" y="${h-bh}" width="${bw}" height="${bh}" rx="1.5" fill="${col}"><title>GW${lastGws[i]}: ${v} pts</title></rect>`;}).join("");
    return `<svg class="sgspark" width="${wd}" height="${h}" viewBox="0 0 ${wd} ${h}" role="img" aria-label="Points in the last ${vals.length} gameweeks">${bars}</svg>`;
  };
  const pills=(p,n,lens)=>{
    const out=[];
    for(let e=G;e<G+n;e++){
      const wk=p.gw[e];
      if(!wk||!wk.fixtures||!wk.fixtures.length){out.push(`<span class="sgfx blank" title="No fixture">-</span>`);continue;}
      wk.fixtures.forEach(f=>{const d=lens==="def"?(f.diffDef||f.diff):(f.diffAtt||f.diff);
        out.push(`<span class="sgfx d${d}" title="GW${e} ${esc(f.oppName||f.opp)} ${f.home?"home":"away"}">${esc(f.opp)}<i>${f.home?"H":"A"}</i></span>`);});
    }
    return `<span class="sgfxrow">${out.join("")}</span>`;
  };
  const posTag=p=>`<span class="sgpos p${p.pos}">${POS[p.pos]}</span>`;
  const row=(p,rank,fig,sub,o={})=>`<div class="sgrow" onclick="act('card',${p.id})">
    <span class="sgrank">${rank}</span>
    <span class="sgwho"><b>${esc(p.web_name)}</b>${squad.has(p.id)?`<span class="sgmine" title="In your squad">You</span>`:""}
      <em>${esc(p.teamName)} · ${posTag(p)} · £${sgF1(p.price)}${o.owned===false?"":` · ${sgF1(p.owned)}%`}</em></span>
    ${o.spark===false?"":spark(p)}
    <span class="sgfig"><b>${fig}</b>${sub?`<em>${sub}</em>`:""}</span></div>`;
  const card=(key,ic,tone,title,info,body,wide)=>{
    const shut=fold.has(key);
    return `<section class="sgcard ${tone}${shut?" shut":""}${wide?" wide":""}">
      <header><span class="sgico">${sgIcon(ic)}</span><h3>${title}</h3>
        <span class="sginfo" tabindex="0" title="${esc(info)}" aria-label="${esc(info)}">${sgIcon("info")}</span>
        <button class="sgfold" onclick="act('sigfold','${key}')" aria-label="${shut?"Open":"Fold"} ${esc(title)}" aria-expanded="${!shut}">${sgIcon("chevron-down")}</button></header>
      ${shut?"":body}</section>`;
  };
  const empty=t=>`<p class="sgempty">${t}</p>`;

  /* ----- your squad ----- */
  const mine=M.players.filter(p=>squad.has(p.id));
  const posAvg={};[1,2,3,4].forEach(pos=>{const xs=mine.filter(p=>p.pos===pos).map(p=>hPts(p,G,H));
    posAvg[pos]=xs.reduce((a,b)=>a+b,0)/Math.max(1,xs.length);});
  const keep=mine.filter(p=>p.form>=SIG.formHot&&sgAvail(p)).sort((a,b)=>b.form-a.form).slice(0,5)
    .map((p,i)=>row(p,i+1,sgF1(p.form),"form")).join("")||empty(`No one in your squad is on ${sgF1(SIG.formHot)} form or better.`);
  const weak=mine.map(p=>{
    const why=[],nx=hPts(p,G,H);
    if(p.form<SIG.replaceForm)why.push(`Form ${sgF1(p.form)}`);
    if(nx<posAvg[p.pos]*SIG.replaceShare)why.push(`Next ${H} ${sgF1(nx)}`);
    if(p.status!=="a")why.push(p.status==="d"?`${Math.round((p.avail??0.75)*100)}% fit${p.availAssumed?" (assumed)":""}`:"Unavailable");
    if((p.xMins||0)<SIG.replaceMins)why.push(`${p.xMins||0}′ expected`);
    return {p,why,score:why.length*10-nx};
  }).filter(x=>x.why.length>=2).sort((a,b)=>b.score-a.score).slice(0,4);
  const replace=weak.map(({p,why})=>{
    const budget=p.price+bank;
    const sub=M.players.filter(q=>q.pos===p.pos&&!squad.has(q.id)&&sgAvail(q)&&q.price<=budget+1e-9)
      .sort((a,b)=>hPts(b,G,SIG.swapHorizon)-hPts(a,G,SIG.swapHorizon))[0];
    const gain=sub?hPts(sub,G,SIG.swapHorizon)-hPts(p,G,SIG.swapHorizon):0;
    return `<div class="sgrep">
      <div class="sgreph" onclick="act('card',${p.id})"><b>${esc(p.web_name)}</b><em>${esc(p.teamName)} · ${posTag(p)} · £${sgF1(p.price)}</em>${pills(p,SIG.runWeeks,p.pos<=2?"def":"att")}</div>
      <div class="sgwhy">${why.map(r=>`<span class="sgchip">${esc(r)}</span>`).join("")}</div>
      ${sub&&gain>0?`<div class="sgswap" onclick="act('card',${sub.id})">${sgIcon("arrow-left-right")}<span>Swap to <b>${esc(sub.web_name)}</b> <em>${esc(sub.teamName)} · £${sgF1(sub.price)}</em></span><span class="sggain">+${sgF1(gain)}<em>next ${SIG.swapHorizon}</em></span></div>`:""}
    </div>`;}).join("")||empty("Nothing in your squad flags on two counts at once.");
  const flags=mine.filter(p=>p.status!=="a").map(p=>`<div class="sgrow" onclick="act('card',${p.id})">
    <span class="sgrank">${sgIcon("triangle-alert",p.status==="d"?"warn":"bad")}</span>
    <span class="sgwho"><b>${esc(p.web_name)}</b><em>${esc(p.news||(p.status==="d"?"Doubtful":"Unavailable"))}</em></span>
    <span class="sgfig"><b>${p.status==="d"?Math.round((p.avail??0.75)*100)+"%":"Out"}</b><em>chance${p.status==="d"?availTag(p):""}</em></span></div>`).join("")
    ||empty("Everyone in your squad is fit.");

  /* ----- players ----- */
  const byPos=(sortFn,fig,sub,filt)=>`<div class="sgcols${posF?" one":""}">${[1,2,3,4].filter(pos=>!posF||pos===posF).map(pos=>{
    const top=pool.filter(p=>p.pos===pos&&(!filt||filt(p))).sort(sortFn).slice(0,posF?10:5);
    return `<div class="sgcol"><div class="sgcolh">${POS[pos]}</div>${top.map((p,i)=>row(p,i+1,fig(p),sub(p),{spark:!!posF,owned:false})).join("")||empty("None yet.")}</div>`;}).join("")}</div>`;
  const topScorers=byPos((a,b)=>b.total-a.total,p=>p.total,p=>`${sgF1(p.ppg)} ppg`);
  const topPred=byPos((a,b)=>hPts(b,G,H)-hPts(a,G,H),p=>sgF1(hPts(p,G,H)),p=>`${p.xMins||0}′`,sgAvail);
  const list=(arr,fig,sub)=>arr.map((p,i)=>row(p,i+1,fig(p),sub)).join("")||empty("No players match right now.");
  const inForm=list(pool.filter(p=>p.minutes>=180&&sgAvail(p)&&posOk(p)).sort((a,b)=>b.form-a.form).slice(0,6),p=>sgF1(p.form),"form");
  const diffs=list(pool.filter(p=>p.owned<SIG.diffOwned&&(p.xMins||0)>=SIG.diffMins&&sgAvail(p)&&posOk(p))
    .sort((a,b)=>hPts(b,G,H)-hPts(a,G,H)).slice(0,6),p=>sgF1(hPts(p,G,H)),`next ${H}`);
  const sells=list(pool.filter(p=>p.owned>=SIG.sellOwned&&p.form<=SIG.sellForm&&posOk(p)).sort((a,b)=>b.owned-a.owned).slice(0,6),p=>sgF1(p.form),"form");
  const threat=list(pool.filter(p=>p.minutes>=SIG.threatMins&&p.pos>=2&&posOk(p))
    .sort((a,b)=>((b.xg90||0)+(b.xa90||0))-((a.xg90||0)+(a.xa90||0))).slice(0,6),p=>sgF1((p.xg90||0)+(p.xa90||0)),"xGI per 90");

  /* ----- teams ----- */
  const ts=S.curTeamStats||{};
  const teams=(S.teams||[]).map(t=>{const c=ts[t.short]||{},n=c.n||0;
    return {t,n,gf:c.gf||0,ga:c.ga||0,xg:n?c.xg/n:0,xga:n?c.xga/n:0};}).filter(x=>x.n>0);
  const trow=(x,i,fig,sub)=>`<div class="sgrow"><span class="sgrank">${i+1}</span>
    <span class="sgwho"><b>${esc(x.t.name)}</b><em>${sub}</em></span><span class="sgfig"><b>${fig}</b></span></div>`;
  const tl=(arr,fig,sub)=>arr.slice(0,5).map((x,i)=>trow(x,i,fig(x),sub(x))).join("")||empty("Waiting on this season's matches.");
  const bestAtt=tl(teams.slice().sort((a,b)=>b.xg-a.xg),x=>sgF1(x.xg),x=>`xG per game · ${x.gf} scored`);
  const weakAtt=tl(teams.slice().sort((a,b)=>a.xg-b.xg),x=>sgF1(x.xg),x=>`xG per game · ${x.gf} scored`);
  const bestDef=tl(teams.slice().sort((a,b)=>a.xga-b.xga),x=>sgF1(x.xga),x=>`xGA per game · ${x.ga} conceded`);
  const leaky=tl(teams.slice().sort((a,b)=>b.ga-a.ga||b.xga-a.xga),x=>x.ga,x=>`conceded · ${sgF1(x.xga)} xGA per game`);
  const rep={};M.players.forEach(p=>{if(!rep[p.team]||p.minutes>rep[p.team].minutes)rep[p.team]=p;});
  const runs=Object.values(rep).map(p=>{let s=0,n=0;
    for(let e=G;e<G+SIG.runWeeks;e++)(p.gw[e]&&p.gw[e].fixtures||[]).forEach(f=>{s+=(f.diffAtt||f.diff);n++;});
    return {p,avg:n?s/n:9};});
  const runRow=(x,i)=>`<div class="sgrow"><span class="sgrank">${i+1}</span>
    <span class="sgwho"><b>${esc(x.p.teamFull||x.p.teamName)}</b><em>avg difficulty ${sgF1(x.avg)}</em></span>${pills(x.p,SIG.runWeeks,"att")}</div>`;
  const easy=runs.slice().sort((a,b)=>a.avg-b.avg).slice(0,5).map(runRow).join("");
  const hard=runs.slice().sort((a,b)=>b.avg-a.avg).slice(0,5).map(runRow).join("");

  const seg=(items,cur,k)=>`<div class="sgseg" role="group">${items.map(([v,l])=>
    `<button class="${cur===v?"on":""}" aria-pressed="${cur===v}" onclick="act('${k}',${v})">${l}</button>`).join("")}</div>`;
  const ds=S.status&&S.status.dataset;
  return `<div class="sgpage">
    <div class="sghead"><div><h2>Signals</h2><p>Gameweek ${G} · players and teams worth a look, ranked from the model and this season's data${ds&&ds.committedAt?` · stats ${esc(ukWhen(ds.committedAt))}`:""}</p></div>
      <div class="sgctl">${seg([[0,"All"],[1,"GKP"],[2,"DEF"],[3,"MID"],[4,"FWD"]],posF,"sigpos")}${seg([[1,"Next GW"],[3,"Next 3"],[5,"Next 5"]],H,"sigh")}<a class="btnlink" href="${routeFor("transfers")}" onclick="return go(event,'transfers')">Transfers →</a></div></div>
    <h4 class="sgsec">Your Squad</h4>
    <div class="sggrid g3">
      ${card("sqform","flame","good","In Form",`Your players on ${sgF1(SIG.formHot)} form or better (average points per game over the last 30 days). Bars: points in each of the last six gameweeks.`,keep)}
      ${card("sqrep","trending-down","warn","Consider Replacing",`Your players flagged on at least two of: form under ${SIG.replaceForm}, the next ${H} gameweeks under ${Math.round(SIG.replaceShare*100)}% of your squad's average for the position, a fitness doubt, under ${SIG.replaceMins} expected minutes. The swap is the best player at the position you can afford with your bank, over the next ${SIG.swapHorizon}.`,replace)}
      ${card("sqflag","triangle-alert","bad","Availability","Your players with an injury, suspension or doubt flag from FPL.",flags)}
    </div>
    <h4 class="sgsec">Players</h4>
    <div class="sggrid g1">${card("scorers","trophy","","Top Scorers By Position","Season total points, with points per game.",topScorers)}</div>
    <div class="sggrid g1">${card("pred","sparkles","","Top Predicted By Position",`Model points over the next ${H} gameweek${H>1?"s":""}, with expected minutes. Available and doubtful players only.`,topPred)}</div>
    <div class="sggrid g3">
      ${card("form","flame","good","In Form","Highest form (average points per game over the last 30 days), 180 minutes or more this season.",inForm)}
      ${card("diff","gem","accent","Differentials",`Under ${SIG.diffOwned}% owned, ${SIG.diffMins} or more expected minutes, ranked by model points over the next ${H}.`,diffs)}
      ${card("sell","trending-down","bad","Sell Signals",`Owned by ${SIG.sellOwned}% or more with form at ${SIG.sellForm} or under: template players who have gone cold.`,sells)}
    </div>
    <div class="sggrid g1">${card("threat","crosshair","","Underlying Threat",`Expected goals plus expected assists per 90 minutes, outfield players with ${SIG.threatMins} minutes or more.`,`<div class="sgsplit">${threat}</div>`)}</div>
    <h4 class="sgsec">Teams</h4>
    <div class="sggrid g4">
      ${card("att","target","good","Best Attacks","Expected goals created per game this season, with goals scored.",bestAtt)}
      ${card("watt","target","bad","Weakest Attacks","Lowest expected goals per game this season, with goals scored.",weakAtt)}
      ${card("def","shield","good","Best Defences","Fewest expected goals conceded per game this season, with goals conceded.",bestDef)}
      ${card("leak","shield-off","bad","Leakiest Defences","Most goals conceded this season, with expected goals conceded per game.",leaky)}
    </div>
    <div class="sggrid g2">
      ${card("easy","calendar-range","good","Easiest Fixture Runs",`Average attacking difficulty over the next ${SIG.runWeeks} gameweeks from the model's own ratings, 1 easiest to 5 hardest.`,easy)}
      ${card("hard","calendar-range","bad","Toughest Fixture Runs",`The hardest next ${SIG.runWeeks} gameweeks for attackers.`,hard)}
    </div>
  </div>`;
}

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
  const card=(k,icon,tone,title,fig,line,foot)=>`<button class="wk" onclick="act('pop','${k}')" aria-haspopup="dialog">
    <span class="wkh"><span class="tile" style="--tc:${tone}">${lic(icon)}</span><span class="wkt">${title}</span><span class="chev">${lic("chevron-right",16)}</span></span>
    <span class="wkf">${fig}</span><span class="wkl">${line}</span>${foot?`<span class="wkft">${foot}</span>`:""}</button>`;
  const m=D.moves[0],m2=D.moves[1];
  const c=D.caps[0],v=D.caps[1];
  const opp=p=>{const f=((p.gw[g]||{}).fixtures||[])[0];return f?`${esc(f.opp)} (${f.home?"H":"A"})`:"no game";};
  const L=p=>fplLive(p)||{};
  const pct=p=>`<b class="${L(p).pcp>0?"up":"dn"}">${Math.round(L(p).pcp)}%</b>`;
  const w=D.warn[0],t=D.threats[0],t2=D.threats[1];
  const cards=[
    m?card("move","circle-arrow-up","#3DDC97","Top Move",`${esc(m.out.web_name)} <span class="arr">→</span> ${esc(m.inn.web_name)}`,
        `<b class="up">${sgn1(m.gain)} pts</b> ${wkSpan(g,h)} · £${m.inn.price.toFixed(1)} · ${esc(m.inn.teamName)}`,
        m2?`Next: ${esc(m2.out.web_name)} → ${esc(m2.inn.web_name)} ${sgn1(m2.gain)}`:"")
     :card("move","circle-arrow-up","#3DDC97","Top Move","Hold",`No single move improves your XI over ${wkSpan(g,h)}`,"Roll the free transfer"),
    c?card("cap","crown","#FFB020","Captain",`${esc(c.web_name)} <span class="cx">${(hPts(c,g,h)*2).toFixed(1)}</span>`,
        `${hPts(c,g,h).toFixed(1)} × 2 · ${h>1?wkSpan(g,h):opp(c)}`,v?`Vice: ${esc(v.web_name)} ${hPts(v,g,h).toFixed(1)}`:"")
     :card("cap","crown","#FFB020","Captain","—","No XI yet",""),
    D.rising.length||D.falling.length
     ?card("price",D.falling.length&&!D.rising.length?"trending-down":"trending-up",D.falling.length&&!D.rising.length?"#FF5A6E":"#4ADE80","Price Watch",
        D.rising.length?`${D.rising.length} of yours rising`:`${D.falling.length} of yours falling`,
        [...D.rising,...D.falling].slice(0,2).map(p=>`${esc(p.web_name)} ${pct(p)}`).join(" · ")+" progress",
        D.rising.length&&D.falling.length?`${D.falling.length} falling too`:D.rising.length?"Selling keeps half of each rise":"Sell before it drops to keep the value")
     :card("price","trending-up","#4ADE80","Price Watch",D.priced.length?"No changes due":"No predictor data",D.priced.length?"None of yours is near a rise or fall":"FPL's predictor did not load",""),
    w?card("warn","clock-alert","#FFB020","Warnings",`${D.warn.length} ${D.warn.length===1?"doubt":"doubts"}`,
        `${esc(w.p.web_name)} · ${w.p.avail<1?(w.p.avail>0?Math.round(w.p.avail*100)+"%":"out"):Math.round(w.p.xMins||0)+" mins"}${w.p.news?" · "+esc(String(w.p.news).split(/[-–(]/)[0].trim().slice(0,22)):""}`,
        w.inXI?"In your XI: consider a change":"On your bench: no change needed")
     :card("warn","clock-alert","#FFB020","Warnings","All clear","Every player fit and expected to start",""),
    t?card("rival","swords","#B388FF","Rival Threat",esc(t.p.web_name),`Owned by ${t.k} of ${D.R.n} rivals, not you`,t2?`Next: ${esc(t2.p.web_name)} ${t2.k}/${D.R.n}`:"")
     :card("rival","swords","#B388FF","Rival Threat","—",D.R?"No player most rivals own that you don't":"League feed not loaded","")
  ].join("");
  return `<section class="week"><div class="weekh"><h2>This Week</h2>${hzHTML(h,"weekh")}</div><div class="wkrow">${cards}</div></section>`;
}
/* what each strip card opens */
function popHTML(){
  const k=S.pop;if(!k||!S.model)return "";
  const D=weekData(),{g,h}=D;
  const L=p=>fplLive(p)||{};
  const ctl=hzHTML(h,"weekh");
  if(k==="move")return modalHTML(`Top Moves · ${wkSpan(g,h)}`,
    (D.moves.length?`<div class="tgrid">${D.moves.map(m=>swapCardHTML(m,g)).join("")}</div>`:`<p class="note">No single move improves your XI over ${wkSpan(g,h)}. Roll the transfer.</p>`)
    +`<p class="note" style="margin-top:10px">Each move is scored on your best XI plus captain, week by week${h>1?" (later weeks count for a little less)":""}, against your current team.</p>`
    +planPanelHTML(),{wide:true,ctl});
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
function keyStat(p,g){
  if(p.pos>=3){const w=ws(String(p.code||""),p.pos,6,p.price,teamMaxPrice(p.team));
    return w?{v:(w.xg90||0)+(w.xa90||0),txt:((w.xg90||0)+(w.xa90||0)).toFixed(2),unit:"xGI/90",est:!!w.estimated}:null;}
  const c=csProbNext(p,g);return c!=null?{v:c,txt:Math.round(c*100)+"%",unit:"CS",est:false}:null;
}
function aroundOwn(p){
  if(S.pAround==="rank"){const N=S.neighbours;return N&&N.n?{k:N.own[p.id]||0,n:N.n}:null;}
  const R=rivalOwn();return R&&R.n?{k:R.own[p.id]||0,n:R.n}:null;
}
function fixPills(p,g,n){
  let h="";
  for(let e=g;e<g+n&&e<=38;e++){const q=p.gw[e];
    if(!q||q.blank||!q.fixtures.length){h+=`<span class="fdrpill blankpill">—</span>`;continue;}
    h+=q.fixtures.map(f=>fdrPill(f.opp,f.home,posDiff(p,f),{short:true,tiny:true})).join("");}
  return `<span class="fxrow">${h}</span>`;
}
const HUB_SORT={
  pts:(p,g,h)=>hPts(p,g,h),mins:p=>p.xMins||0,key:(p,g)=>{const k=keyStat(p,g);return k?k.v:-1;},
  fix:(p,g,h)=>{let s=0,n=0;for(let e=g;e<g+Math.max(h,3)&&e<=38;e++)(p.gw[e]?.fixtures||[]).forEach(f=>{s+=posDiff(p,f);n++;});return n?-s/n:-9;},
  price:p=>p.price,pcp:p=>{const l=fplLive(p);return l&&l.pcp!=null?l.pcp:-999;},owned:p=>p.owned,
  around:p=>{const a=aroundOwn(p);return a?a.k/a.n:-1;},name:p=>p.web_name};
function hubRows(){
  const g=VG(),h=S.pH||1,view=S.pView||"all",mine=new Set(effectiveSquadIds(g).ids);
  let a=filtered("list");
  if(view==="mine")a=S.model.players.filter(p=>mine.has(p.id)&&(!S.lPos||p.pos===S.lPos));
  if(view==="buy")a=a.filter(p=>!mine.has(p.id)&&p.avail>0&&(p.xMins||0)>=45);
  const k=HUB_SORT[S.hubSort]?S.hubSort:"pts",dir=S.hubDir||"desc";
  const f=HUB_SORT[k];
  a=a.slice().sort((x,y)=>{const A=f(x,g,h),B=f(y,g,h);
    if(typeof A==="string")return dir==="asc"?A.localeCompare(B):B.localeCompare(A);
    return dir==="asc"?A-B:B-A;});
  return{g,h,view,mine,a};
}
function playersHubHTML(){
  if(!S.model)return "";
  const{g,h,view,mine,a}=hubRows();
  if(view==="stats")return hubHeadHTML(g,h,view)+statsViewHTML();
  const ticks=S.pTicks||[];
  const lim=S.pdLimit||PD_PAGE;
  const th=(k,n,tip,al)=>`<th class="${S.hubSort===k||(!S.hubSort&&k==="pts")?"act":""}" onclick="act('hubsort','${k}')" title="${esc(tip)}" style="text-align:${al||"right"}">${n}${(S.hubSort||"pts")===k?((S.hubDir||"desc")==="desc"?" ↓":" ↑"):""}</th>`;
  const aroundLbl=S.pAround==="rank"?"Near Rank":"Rivals";
  const head=`<tr><th style="width:34px"></th>${th("name","Player","Name, club, position and signals","left")}
    ${th("pts",`Predicted ${h>1?h+" GW":"GW"+g}`,"Model points over the horizon")}${th("mins","Minutes","Expected minutes next gameweek")}
    ${th("key",S.lPos===1||S.lPos===2?"CS %":S.lPos>=3?"xGI/90 L6":"Key Stat","MID/FWD: expected goal involvements per 90 over the last six matches. GK/DEF: chance of a clean sheet next match.")}
    ${th("fix",`Fixtures`,"Next fixtures, coloured by difficulty for his position (green easy, red hard). Italic = away.","left")}
    ${th("price","Price","Price, with FPL's price predictor progress (100% = changes tonight)")}${th("owned","Owned","Overall ownership")}
    ${th("around",aroundLbl,S.pAround==="rank"?"How many of the 50 managers ranked around you own him":"How many of your mini-league rivals own him")}<th></th></tr>`;
  const rows=a.slice(0,lim).map(p=>{
    const ks=keyStat(p,g),ar=aroundOwn(p),l=fplLive(p),on=ticks.includes(p.id),own=mine.has(p.id);
    const pc=l&&l.pcp!=null&&Math.abs(l.pcp)>=50?`<span class="pcp ${l.pcp>0?"up":"dn"}">${l.pcp>0?"+":""}${Math.round(l.pcp)}%</span>`:"";
    return `<tr class="${own?"mine":""}${on?" ticked":""}"${p.avail===0?' style="opacity:.45"':""}>
      <td><input type="checkbox" class="tick" ${on?"checked":""} ${!on&&ticks.length>=5?"disabled":""} onchange="act('tick',${p.id})" aria-label="Compare ${esc(p.web_name)}"></td>
      <td class="nm"><span class="pcell">${shirtSVG(p.teamName.toUpperCase(),p.pos===1,24)}<span class="pmeta"><span class="prow1">${pName(p)}${INJ(p)}${own?'<span class="mu" style="font-size:11px">yours</span>':""}</span>
        <span class="prow2">${esc(p.teamName)} · ${POS[p.pos]}${sigHTML(p,g)}</span></span></span></td>
      <td class="fig mint">${hPts(p,g,h).toFixed(1)}</td>
      <td class="fig">${Math.round(p.xMins||0)}′</td>
      <td class="fig">${ks?ks.txt+(ks.est?'<span class="srctag">est</span>':""):"—"}</td>
      <td style="text-align:left">${fixPills(p,g,Math.max(h,3))}</td>
      <td class="fig">£${p.price.toFixed(1)}${arw(p.priceChange)} ${pc}</td>
      <td class="fig">${p.owned.toFixed(1)}%</td>
      <td class="fig">${ar?`${ar.k}/${ar.n}`:"—"}</td>
      <td style="white-space:nowrap"><button class="pdstar${S.stars.includes(p.id)?" on":""}" onclick="act('star',${p.id})" title="Shortlist" aria-pressed="${S.stars.includes(p.id)}">★</button>${own?"":`<button class="pdadd" onclick="act('addplan',${p.id})" title="Add to the Planner" aria-label="Add ${esc(p.web_name)} to the Planner">+</button>`}</td></tr>`;}).join("");
  const more=a.length>lim?`<div class="pdmore"><span class="note">Showing ${lim} of ${a.length} players</span>
    <button onclick="act('pdmore')">Show ${Math.min(PD_PAGE,a.length-lim)} more</button><button onclick="act('pdall')">Show all ${a.length}</button></div>`:
    (lim>PD_PAGE&&a.length>PD_PAGE?`<div class="pdmore"><span class="note">Showing all ${a.length} players</span><button onclick="act('pdless')">Show fewer</button></div>`:"");
  return hubHeadHTML(g,h,view)+`<div class="panel"><div class="scroll tallscroll hub"><table><thead>${head}</thead><tbody>${rows||`<tr><td colspan="10" class="note" style="padding:14px">No players match.</td></tr>`}</tbody></table></div>${more}</div>`;
}
function hubHeadHTML(g,h,view){
  const ticks=S.pTicks||[];
  const seg=(cur,list,action)=>`<span class="hz">${list.map(([k,n])=>`<button class="${cur===k?"on":""}" onclick="act('${action}','${k}')">${n}</button>`).join("")}</span>`;
  const a=hubRows().a.length;
  return `<div class="pagetabs"><h1>Players</h1>
      <span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${ticks.length?`<button class="pri" onclick="act('pcmp')">Compare ${ticks.length}</button><button onclick="act('tickclear')">Clear ticks</button>`:`<span class="note">Tick up to 5 players to compare</span>`}
        <a class="btnlink" href="${routeFor("odds")}" onclick="return go(event,'odds')">Odds →</a></span></div>
    <div class="hubctl">
      ${seg(view,[["buy","Buy"],["mine","My Squad"],["all","All"],["stats","Stats"]],"pview")}
      ${view==="stats"?"":hzHTML(h,"ph")}
      <span class="hz">${[[0,"All"],[1,"GKP"],[2,"DEF"],[3,"MID"],[4,"FWD"]].map(([v,n])=>`<button class="${(S.lPos||0)===v?"on":""}" onclick="act('lpos',${v})">${n}</button>`).join("")}</span>
      ${view==="stats"||view==="mine"?"":`<input id="srch-l" placeholder="Search" value="${esc(S.lSearch||"")}" oninput="searchInput('lsearch',this)" style="width:170px">
      <select onchange="act('lteam',this.value)" aria-label="Club"><option value="0">All clubs</option>${S.model.teams.map(t=>`<option value="${t.id}" ${S.lTeam===t.id?"selected":""}>${esc(t.name)}</option>`).join("")}</select>
      <span class="note">Max £</span><input type="number" min="3.5" max="16" step="0.1" value="${(S.lMax||16).toFixed(1)}" onchange="act('lmax',this.value)" style="width:70px" aria-label="Max price">`}
      ${view==="stats"?"":`<span class="note" style="margin-left:auto">Around you</span>${seg(S.pAround||"league",[["league","Rivals"],["rank","Near rank"]],"paround")}`}
      ${view==="stats"?"":`<span class="note">${a} players</span>`}
    </div>`;
}
/* the old Player Data table, kept whole as the Stats view */
function statsViewHTML(){
  return `<div class="panel"><div class="phead"><h2>All Stats</h2><span class="note">${filtered("list").length} players · tap any column to sort</span></div>
    ${filtersHTML(false,'list')}
    <div class="pbody" style="display:flex;gap:5px;flex-wrap:nowrap;overflow-x:auto;align-items:center;border-bottom:1px solid var(--ink3)">
      <span style="font-size:11px;color:var(--mute);flex:none">Show only</span>
      ${SIG_ORDER.map(k=>`<button class="fbtn fbtn-icon ${S.iconF.includes(k)?"on":""}" onclick="act('iconf','${k}')" title="${esc(SIGNAL[k][2]+": "+SIG_RULE[k](S.horizon||1))}">${sigTile(k,SIGNAL[k][2])}</button>`).join("")}
      <button class="fbtn fbtn-icon ${S.starOnly?"on":""}" onclick="act('staronly')" title="Shortlist${S.stars.length?" ("+S.stars.length+")":""}" style="--fc:#FFB020">
        <span class="sig" style="color:#FFB020;font-size:14px">★</span>${S.stars.length?`<span class="fbtn-badge">${S.stars.length}</span>`:""}</button></div>
    <div class="pbody" style="display:flex;gap:16px;flex-wrap:wrap;border-bottom:1px solid var(--ink3)">
      <span style="flex:1;min-width:200px"><span style="font-size:11px;color:var(--mute)">Budget</span>
        <span style="margin:4px 0;display:block">${stepperInput("lmax",S.lMax,{min:3.5,max:16,step:0.1,big:1,dp:1,w:56})}</span></span>
      <span style="flex:1;min-width:230px"><span style="font-size:11px;color:var(--mute)">Past stats window</span>
        <span style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">
          ${[1,3,5,10,38].map(n=>`<button class="chipbtn ${(S.lWin||38)===n?"on":""}" onclick="act('lwin',${n})">${n===38?"Season":"Last "+n}</button>`).join("")}</span></span></div>
    ${tableHTML()}</div>`;
}
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
