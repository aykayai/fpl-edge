/* FPL Edge — app-render.js
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
  const buy=REAL_PRICE[p.web_name]??p.price;
  const five=[];for(let e=g;e<g+5&&e<=38;e++){const q=p.gw[e];
    five.push({e,pts:q&&!q.blank?q.pts:0,f:q&&q.fixtures[0]});}
  const mx=Math.max(1,...five.map(x=>x.pts));
  const stat=(k,v,c)=>`<div class="pcs"><span class="k">${k}</span><span class="v" style="${c||""}">${v}</span></div>`;
  return `<div class="pcwrap" onclick="act('card',0)">
    <div class="pcard" onclick="event.stopPropagation()">
      <button class="pcx" onclick="act('card',0)">✕</button>
      <div class="pchead">
        <span class="pcimgwrap">
          <img class="pcimg" alt="" src="https://resources.premierleague.com/premierleague/photos/players/110x140/p${esc(String(p.code||""))}.png"
            onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
          <span style="display:none">${shirtSVG(p.teamName.toUpperCase(),p.pos===1,72)}</span></span>
        <div class="pcname">${esc(p.web_name)}</div>
        <div class="note">${esc(p.teamFull||p.teamName)} · ${POS[p.pos]} · ${p.owned.toFixed(1)}% owned</div>
        <div style="margin-top:7px">${sigHTML(p,g)}</div>
      </div>
      ${p.avail<1?`<div class="warn" style="margin:12px 0 0">${esc(p.news||"Fitness doubt")}${p.back?` · back ${esc(p.back)}`:""}</div>`:""}
      <div class="pclab">Next five</div>
      <div class="pcbars">${five.map(x=>{
        const h=Math.max(5,Math.round(x.pts/mx*54));
        const[b,c]=x.f?fdrCol(posDiff(p,x.f)):["var(--ink3)","var(--mute)"];
        return `<span class="pcbar"><span class="pv">${x.pts.toFixed(1)}</span>
          <span class="bar" style="height:${h}px;background:${b}"></span>
          <span class="op" style="${x.f&&!x.f.home?"font-style:italic":""}">${x.f?esc(x.f.opp):"—"}</span>
          <span class="gw">GW${x.e}</span></span>`;}).join("")}</div>
      <div class="pcgrid">
        ${stat("Bought",`£${buy.toFixed(1)}`)}
        ${stat("Sells for",`£${sellPrice(p).toFixed(1)}`,
          sellPrice(p)>buy?"color:var(--mint)":sellPrice(p)<buy?"color:var(--red)":"")}
        ${stat("Form",p.form.toFixed(1))}
        ${stat("xMins",p.xMins+"′")}
      </div>
      <div class="pclab">${POS[p.pos]} detail</div>
      <div class="pcgrid">${posStats(p).map(([k,v])=>stat(k,v)).join("")}</div>
      ${setPieceHTML(p)?`<div class="pclab">Set pieces</div>
        <div style="padding-top:6px">${setPieceHTML(p)}</div>`:""}
    </div></div>`;
}

function pitchHTML(){
  const xi=startingXI();
  if(!xi.length)return `<div class="pbody" style="text-align:center"><p class="note">No squad loaded.</p>
    <button class="pri" onclick="act('seed')">Load my GW1 squad</button></div>`;
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
      return S.iconF.every(ix=>{
        /* the caution flag is an exclusion: selecting it hides those players */
        if(SIGDEF[ix][2]==="Stats caution")return !ic.includes(SIGDEF[ix][0]);
        return ic.includes(SIGDEF[ix][0]);});});
    if(S.spF)out=out.filter(p=>setPieceHTML(p).includes(">"+S.spF+"<"));
  }
  return out;
}
const fix3=(p,g)=>{let h='';const LENS=p2=>p2.pos<=2?'def':'att';for(let e=g;e<g+3&&e<=38;e++){const q=p.gw[e];
  if(!q||q.blank){h+='<span class="fdrpill" style="background:var(--ink3);color:var(--mute);font-size:8px;padding:1px 4px">—</span>';continue;}
  const f=q.fixtures[0],[b,c]=fdrCol(p.pos<=2?(f.diffDef??f.diff):(f.diffAtt??f.diff));
  h+=`<span class="fdrpill" style="background:${b};color:${c};font-size:8px;padding:1px 4px">${esc(f.opp.slice(0,3))}</span>`;}
  return `<span style="display:inline-flex;gap:2px">${h}</span>`;};
const SORTVAL=(p,k,g)=>{
  const W=ws(String(p.code||""),p.pos,S.lWin||38)||{};
  const f0=p.gw[g]?.fixtures?.[0];
  const team=(S.model.teams||[]).find(t=>t.id===p.team);
  return ({name:p.web_name,team:p.teamName,pos:p.pos,price:p.price,
  next:(p.gw[g]?.fixtures||[]).reduce((s,f)=>s+f.diff,0)||99,form:p.form,lastform:p.lastForm,
  pred:hPts(p,g,S.tab==="table"?S.lHorizon:S.horizon),pred3:hPts(p,g,3),pred5:hPts(p,g,5),avg:avgFP(p,g,S.horizon),
  total:p.total,owned:p.owned,ppg:p.ppg,xg:p.xg90,xa:p.xa90,dc:p.dc90,
  mins:p.minutes,xmins:p.xMins,bonus:p.bonus,tin:p.tIn,
  startpct:W.startPct||0,xgi:(W.xg90||0)+(W.xa90||0),
  npxg:W.npxg90||0,dchit:W.dcHit||0,cc:W.cc90||0,box:W.box90||0,
  bps:p.bps||0,csp:p.csRate||0,sv90:W.sv90||0,
  spthreat:p.spThreat||0,penord:p.penOrder||99,
  /* position-specific columns — previously missing, so their headers did not sort */
  oppatt:f0?(f0.diffDef??3):0,teamdef:team?team.def:0,
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
    const budget=S.bank+sellPrice(o);
    const clubs={};(S.squad||[]).filter(x=>x!==id).forEach(x=>{const q=P2(x);
      if(q)clubs[q.team]=(clubs[q.team]||0)+1;});
    const opts=S.model.players
      .filter(q=>q.pos===o.pos&&!(S.squad||[]).includes(q.id)&&q.avail>0
        &&q.price<=budget+0.001&&(clubs[q.team]||0)<3&&!(S.ignored||[]).includes(q.id))
      .map(q=>({out:o,inn:q,gain:hPts(q,g,S.horizon)-hPts(o,g,S.horizon)}))
      .filter(m=>m.gain>=0.1)
      .sort((a,b)=>b.gain-a.gain).slice(0,3);
    return `<div class="repl"><div style="padding:9px 12px;display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap">
      <span style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:var(--cyan)">
        Replace ${esc(o.web_name)} · ${POS[o.pos]}</span>
      <span class="note">£${(S.bank+sellPrice(o)).toFixed(1)} to spend · sells for £${sellPrice(o).toFixed(1)}</span></div>
      ${opts.length?opts.map(m=>`<button class="prow" onclick="act('doswap',${o.id},${m.inn.id})">
        ${shirtSVG(m.inn.teamName.toUpperCase(),m.inn.pos===1,24)}
        <span style="flex:1;min-width:0">
          <span style="display:flex;align-items:center;gap:5px"><span style="font-size:12.5px;font-weight:600">${esc(m.inn.web_name)}</span>${sigHTML(m.inn,g)}</span>
          <span style="display:block;font-size:9.5px;color:var(--mute)">${esc(m.inn.teamName)} · £${m.inn.price.toFixed(1)} · ${m.inn.xMins}′ xMins</span></span>
        <span class="mono" style="color:var(--mint);font-weight:700">+${m.gain.toFixed(1)}</span></button>`).join("")
        :`<div class="pbody"><p class="note">No option improves this pick by +0.1 or more.</p></div>`}</div>`;
  }).join("");
}
const backTag=p=>p.back?`<span class="src" style="background:#4A1220;color:#FFC9D2" title="${esc(p.news)}">${p.back==="unknown"?"no date":esc(p.back)}</span>`:"";
const INJ=p=>p.avail===0?`<span title="${esc(p.news||"Unavailable")}" style="color:var(--red);font-size:11px">✚</span>`
  :(p.avail<1?`<span title="${esc(p.news||"Doubt")}" style="color:var(--amber);font-size:11px">✚</span>`:"");
function listHTML(){
  const g=VG();
  const a=sortList(filtered("planner"),S.lSort,S.lDir,g);
  /* budget available: bank plus whatever the flagged players would raise */
  const raised=(S.flagged||[]).reduce((t,id)=>{
    const o=S.model.players.find(p=>p.id===id);return t+(o?sellPrice(o):0);},0);
  const budget=+(S.bank+raised).toFixed(1);
  const outP=(S.flagged||[]).map(id=>S.model.players.find(p=>p.id===id)).filter(Boolean);
  const cols=[["price","£"],["xmins","xMins"],["form","Form"],["pred","xPts"],["pred3","3GW"],["pred5","5GW"]];
  const head=`<div class="lhead"><span style="flex:1" data-k="name" class="${S.lSort==="name"?"act":""}" onclick="act('lsort','name')">Player</span>
    ${cols.map(([k,n])=>`<span class="lc ${S.lSort===k?"act":""}" data-k="${k}" onclick="act('lsort','${k}')">${n}</span>`).join("")}</div>`;
  return head+a.slice(0,150).map(p=>{
    const own=(S.squad||[]).includes(p.id);
    /* everything stays selectable; unaffordable players are simply dimmed */
    const afford=!(S.flagged||[]).length || p.price<=budget+0.001 || own;
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
        <span style="display:block;font-size:9.5px;color:var(--mute);margin-top:1px">${esc(p.teamName)} · ${POS[p.pos]}${own?' · <span style="color:var(--mint)">in squad</span>':""}</span>
        <span style="display:block;margin-top:2px">${fix3(p,g)}</span>
        <span class="poolsigs">${sigHTML(p,g)}</span></span>
      <span class="lc mono" style="font-size:11px">£${p.price.toFixed(1)}${arw(p.priceChange)}</span>
      <span class="lc mono" style="font-size:11px;color:var(--mute)">${p.xMins}′</span>
      <span class="lc mono" style="font-size:11px;color:var(--mute)">${p.form.toFixed(1)}</span>
      <span class="lc mono" style="font-size:12px;font-weight:700;color:${
        delta==null?"var(--mint)":(delta<0?"var(--red)":"var(--mint)")}">${
        delta==null?hPts(p,g,S.horizon).toFixed(1):(delta>0?"+":"")+delta.toFixed(1)}</span>
      <span class="lc mono" style="font-size:11px;color:var(--cyan)">${hPts(p,g,3).toFixed(1)}</span>
      <span class="lc mono" style="font-size:11px;color:var(--cyan)">${hPts(p,g,5).toFixed(1)}</span>
    </button>`;}).join("");
}
function plannerControls(){
  const g=S.model.next.id;
  return `<div class="pbody" style="display:flex;gap:16px;flex-wrap:wrap;border-bottom:1px solid var(--ink3)">
    <span style="flex:1;min-width:200px">
      <span style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--mute)"><span>Budget</span></span>
      <span class="pricebox" style="margin:4px 0">
        <input type="number" min="3.5" max="16" step="0.1" value="${S.fMax.toFixed(1)}" onchange="act('fmax',this.value)">
        <input type="range" min="3.5" max="16" step="0.1" value="${S.fMax}" oninput="act('fmax',this.value)" style="flex:1"></span>
    </span>
    <span style="flex:1;min-width:200px">
      <span style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--mute)"><span>From gameweek</span></span>
      <span class="pricebox" style="margin:4px 0">
        <input type="number" min="${g}" max="38" step="1" value="${VG()}" onchange="act('startgw',this.value)">
        <input type="range" min="${g}" max="38" step="1" value="${VG()}" oninput="act('startgw',this.value)" style="flex:1"></span>
    </span>
    <span style="flex:1;min-width:200px">
      <span style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--mute)"><span>Gameweeks</span></span>
      <span class="pricebox" style="margin:4px 0">
        <input type="number" min="1" max="8" step="1" value="${S.horizon}" onchange="act('horizon',this.value)">
        <input type="range" min="1" max="8" step="1" value="${S.horizon}" oninput="act('horizon',this.value)" style="flex:1"></span>
    </span></div>`;
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
    ${L?"":`<span class="pricebox" style="width:auto">
      <span class="note" style="white-space:nowrap">Max £</span>
      <input type="number" min="3.5" max="16" step="0.1" value="${S.fMax.toFixed(1)}"
        onchange="act('fmax',this.value)" style="width:70px"></span>`}
    <select ${compact?"":'style="width:auto"'} onchange="act('${A('team')}',this.value)"><option value="0">All clubs</option>
      ${S.model.teams.map(t=>`<option value="${t.id}" ${team===t.id?"selected":""}>${esc(t.name)}</option>`).join("")}</select>
  </div>`;
}
function filtersOLD(compact){
  return `<div class="pbody" style="display:flex;${compact?"flex-direction:column":"flex-wrap:wrap;align-items:end"};gap:9px;border-bottom:1px solid var(--ink3)">
    <input ${compact?"":'style="width:auto;min-width:150px;flex:1"'} placeholder="Search" value="${esc(S.fSearch)}" oninput="act('search',this.value)">
    <span style="display:flex;gap:4px;flex-wrap:wrap">${[[0,"All"],[1,"GKP"],[2,"DEF"],[3,"MID"],[4,"FWD"]]
      .map(([v,n])=>`<button class="${S.fPos===v?"on":""}" onclick="act('pos',${v})">${n}</button>`).join("")}</span>
    <select ${compact?"":'style="width:auto"'} onchange="act('team',this.value)"><option value="0">All clubs</option>
      ${S.model.teams.map(t=>`<option value="${t.id}" ${S.fTeam===t.id?"selected":""}>${esc(t.name)}</option>`).join("")}</select>
  </div>`;
}
function tableHTML(){
  const g=VG();
  const a=sortList(filtered("list"),S.sortKey,S.sortDir,g);
  const W=S.lWin||38;
  const w=p=>ws(String(p.code||""),p.pos,W,p.price,teamMaxPrice(p.team));
  const cols=[["name","Player"],["price","Price"],["signals","Signals"],["next","Next 3"],["form","Form"],["pred","xFPL"],
    ["pred3","3GW"],["pred5","5GW"],["owned","Own %"],["startpct","Start %"],
    ["xmins","xMins"],["xgi","xGI/90"],["npxg","npxG/90"],["xa","xA/90"],["dchit","DefCon %"],
    ["csp","CS %"],["cc","CC/90"],["box","Box/90"],["bonus","Bonus"],["bps","BPS/90"],
    ["tin","TI"],["total","Pts"]];
  const KEY={pred:1,pred5:1,form:1,xg:1,xa:1,dc:1,next:1,xmins:1};
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
    pred5:"Projected points, next 5 GWs",owned:"% of managers who own him",
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
    const s=signals(p,g).map(([l,c,t])=>sigIcon(l,c,t)).join("");
    const sp=setPieceHTML(p).replace(/^<span class="sigs">/,"").replace(/<\/span>$/,"");
    const all=s+sp;
    return all?`<span class="sigcell">${all}</span>`:`<span style="color:var(--ink3)">·</span>`;};
  const pct=v=>(v*100).toFixed(0)+"%";
  const CELL={
    pred3:p=>hPts(p,g,3).toFixed(1),
    startpct:p=>{const q=w(p);return q?(q.estimated?"~":"")+pct(q.startPct):"—";},
    xgi:p=>{const q=w(p);return q?(q.xg90+q.xa90).toFixed(2):"—";},
    npxg:p=>{const q=w(p);return q?q.npxg90.toFixed(2):"—";},
    dchit:p=>{const q=w(p);return q?pct(q.dcHit):"—";},
    csp:p=>{const f=p.gw[g]?.fixtures?.[0];
      return f?pct(Math.exp(-clamp(p.gc90/(1+(3-(f.diffDef??3))*0.18),.25,3.2))):"—";},
    cc:p=>{const q=w(p);return q?q.cc90.toFixed(2):"—";},
    box:p=>{const q=w(p);return q?q.box90.toFixed(1):"—";},
    bps:p=>{const q=w(p);return q&&q.mins>0?(p.bps*90/Math.max(1,p.minutes||q.mins)).toFixed(1):"—";},
    sv90:p=>{const q=w(p);return q?q.sv90.toFixed(2):"—";},
    xgot:p=>{const q=w(p);return q?q.xgot90.toFixed(2):"—";},
    gprev:p=>{const q=w(p);return q?q.gp.toFixed(1):"—";},
    gc90:p=>{const q=w(p);return q?q.gc90.toFixed(2):"—";},
    pensv:p=>p.pensSaved||0, og:p=>p.ownGoals||0,
    oppatt:p=>{const f=p.gw[g]?.fixtures?.[0];return f?(f.diffDef??3).toFixed(0):"—";},
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
    form:p=>p.form.toFixed(1), lastform:p=>p.lastForm?p.lastForm.toFixed(1):"—",
    pred:p=>hPts(p,g,S.lHorizon).toFixed(1),
    pred5:p=>hPts(p,g,5).toFixed(1), avg:p=>avgFP(p,g,S.horizon).toFixed(1),
    ppg:p=>p.ppg.toFixed(1), total:p=>p.total, owned:p=>p.owned.toFixed(1),
    xg:p=>p.xg90.toFixed(2), xa:p=>p.xa90.toFixed(2), dc:p=>p.dc90.toFixed(1),
    xmins:p=>p.xMins+"′", saves:p=>(p.sv90||0).toFixed(1), cs:p=>(p.csRate||0).toFixed(2),
    bonus:p=>p.bonus, ict:p=>p.ict.toFixed(0),
    tin:p=>p.tIn>999?(p.tIn/1000).toFixed(0)+"k":p.tIn};
  const rows=a.slice(0,320).map(p=>{
    const q=p.gw[g]||{fixtures:[]};
    const nx=q.fixtures.length?q.fixtures.map(f=>fdrPill(f.opp,f.home,posDiff(p,f))).join(" ")
      :`<span style="color:var(--mute);font-size:9.5px">BLANK</span>`;
    const own=(S.squad||[]).includes(p.id);
    let tds=`<td class="nm"><span style="display:flex;align-items:center;gap:6px">
        <button onclick="act('star',${p.id})" title="Shortlist"
          style="border:none;background:none;padding:0;cursor:pointer;font-size:16px;line-height:1;flex:none;color:${S.stars.includes(p.id)?"var(--amber)":"var(--ink3)"}">★</button>
        ${shirtSVG(p.teamName.toUpperCase(),p.pos===1,22)}
      <span style="min-width:0"><span style="display:flex;align-items:center;gap:5px">
        <span style="font-weight:600;font-size:12px">${esc(p.web_name)}</span>${INJ(p)}
        ${own?"":`<button onclick="act('addplan',${p.id})" title="Add to Team Planner"
          style="border:none;background:none;padding:0 2px;cursor:pointer;font-size:14px;line-height:1;color:var(--ink3)">+</button>`}</span>
      <span style="display:flex;gap:4px;align-items:center;font-size:9.5px;color:var(--mute)">${esc(p.teamName)} · ${POS[p.pos]} ${backTag(p)}</span></span></span></td>`;
    cols.slice(1).forEach(([k])=>{
      if(k==="signals"){tds+=`<td style="text-align:center">${iconCell(p)}</td>`;return;}
      if(k==="next"){tds+=`<td style="text-align:center;white-space:nowrap">${fix3(p,g)}</td>`;return;}
      const hot=(k==="pred"||k==="pred5"||k==="pred3")?"color:var(--mint);font-weight:700;"
        :(POSKEY.has(k)?"color:var(--amber);":(KEY[k]?"color:var(--cyan);":""));
      tds+=`<td style="text-align:right;${hot}">${CELL[k]?CELL[k](p):""}</td>`;});
    return `<tr style="${p.avail===0?"opacity:.4;":""}${own?"opacity:.45":""}" title="${own?"Already in your squad":""}">${tds}</tr>`;}).join("");
  return `<div class="scroll tallscroll"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
function xfplHTML(){
  if(!S.model)return `<div class="panel"><div class="pbody"><p class="note">Load data first.</p></div></div>`;
  const g=S.model.next.id;
  const played=S.model.gwPlayed||0;
  const stamp=S.stamp?new Date(S.stamp).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"—";
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

  const status=`<div class="panel"><div class="phead"><h2>xFPL model</h2>
    <span class="note">data ${esc(stamp)}</span></div>
    <div class="pbody">
      <p class="note" style="margin:0 0 10px">Projections come from the FPL Core Insights dataset, then get calibrated per position. Once gameweeks finish, the model compares what each position actually returns per appearance with what it projected and nudges the calibration toward the truth — it needs 25+ regular starters and 4+ finished gameweeks in a position before anything moves, and every adjustment is capped.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${[[played,"GW finished"],["GW"+g,"projecting"],[overall?overall.mae.toFixed(2):"—","MAE (pts)"],[overall?(overall.bias>0?"+":"")+overall.bias.toFixed(2):"—","bias"]]
          .map(([v,l])=>`<span style="flex:1;min-width:88px;background:var(--ink2);border:1px solid var(--ink3);border-radius:9px;padding:8px 10px;text-align:center">
            <b style="display:block;font-family:'Barlow Condensed';font-size:22px;font-weight:800;color:var(--mint)">${v}</b>
            <span style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute)">${l}</span></span>`).join("")}
      </div>
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
    </tbody></table></div></div>`;

  const pva=played<1?"":`<div class="panel"><div class="phead"><h2>Predicted vs actual</h2>
    <span class="note">projection vs actual pts / appearance</span></div>
    <div class="scroll"><table><thead><tr>
      <th style="text-align:left">Position</th><th>N</th><th>Predicted</th><th>Actual</th><th>MAE</th><th>Bias</th></tr></thead><tbody>
    ${[1,2,3,4].map(k=>{const s=summ(acc[k]);
      if(!s)return `<tr><td style="text-align:left">${POS[k]}</td><td colspan="5" class="note" style="text-align:left">not enough minutes yet</td></tr>`;
      const mp=acc[k].reduce((a,x)=>a+x.p,0)/s.n,ma=acc[k].reduce((a,x)=>a+x.a,0)/s.n;
      return `<tr><td style="text-align:left">${POS[k]}</td><td class="mono">${s.n}</td>
        <td class="mono">${mp.toFixed(2)}</td><td class="mono">${ma.toFixed(2)}</td>
        <td class="mono">${s.mae.toFixed(2)}</td><td class="mono">${(s.bias>0?"+":"")+s.bias.toFixed(2)}</td></tr>`;}).join("")}
    </tbody></table></div>
    <div class="pbody"><p class="note" style="margin:0">Actual is points per appearance across the ${played} finished gameweek${played>1?"s":""} — a proxy until per-gameweek projection snapshots are published. Positive bias = the model projects higher than players are returning.</p></div></div>`;

  const movers=`<div class="panel"><div class="phead"><h2>Projection movers &amp; xMins shifts</h2></div>
    <div class="pbody">
    ${rep&&rep.movers&&rep.movers.length?`<span class="note" style="color:var(--cyan)">Biggest projection movers</span>
      <div class="scroll"><table><thead><tr><th style="text-align:left">Player</th><th>Before</th><th>After</th><th>Δ</th></tr></thead><tbody>
      ${rep.movers.slice(0,12).map(m=>`<tr><td style="text-align:left">${esc(m.name)}</td><td class="mono">${(+m.before).toFixed(1)}</td><td class="mono">${(+m.after).toFixed(1)}</td><td class="mono">${arrow(m.after-m.before,true)}</td></tr>`).join("")}</tbody></table></div>`:""}
    ${rep&&rep.xminsShifts&&rep.xminsShifts.length?`<span class="note" style="color:var(--cyan);display:block;margin-top:10px">Expected-minutes shifts</span>
      <div class="scroll"><table><thead><tr><th style="text-align:left">Player</th><th>Before</th><th>After</th><th>Δ</th></tr></thead><tbody>
      ${rep.xminsShifts.slice(0,12).map(m=>`<tr><td style="text-align:left">${esc(m.name)}</td><td class="mono">${Math.round(m.before)}′</td><td class="mono">${Math.round(m.after)}′</td><td class="mono">${arrow(m.after-m.before,true)}</td></tr>`).join("")}</tbody></table></div>`:""}
    ${(!rep||((!rep.movers||!rep.movers.length)&&(!rep.xminsShifts||!rep.xminsShifts.length)))?`<p class="note" style="margin:0">Waiting on per-gameweek snapshots — the biggest projection movers and expected-minutes shifts appear here once the model stores a projection snapshot each gameweek.</p>`:""}
    </div></div>`;

  const foot=`<div class="panel"><div class="pbody"><p class="note" style="margin:0">Richer per-gameweek actuals — live points, bonus, minutes — come from the official FPL API, which the browser can't read directly. A scheduled job publishes them to the data repo, and the model reads them like every other file.</p></div></div>`;

  return status+calib+pva+movers+foot;
}
function swapCardHTML(m,g){
  return `<div class="tcard"><div class="tline">
    ${shirtSVG(m.out.teamName.toUpperCase(),m.out.pos===1,26)}
    <span class="tp"><span class="n">${esc(m.out.web_name)}</span>
      <span class="s">${esc(m.out.teamName)} · £${m.out.price.toFixed(1)} · form ${m.out.form.toFixed(1)} · ${(m.out.gw[g]?.pts||0).toFixed(1)} xPts</span></span>
    <span class="arrow">→</span>
    ${shirtSVG(m.inn.teamName.toUpperCase(),m.inn.pos===1,26)}
    <span class="tp"><span class="n">${esc(m.inn.web_name)}</span>
      <span class="s" style="display:flex;gap:5px;align-items:center">${esc(m.inn.teamName)} · £${m.inn.price.toFixed(1)} · ${(m.inn.gw[g]?.pts||0).toFixed(1)} xPts ${sigHTML(m.inn,g)}</span></span>
    <span class="gain">+${m.gain.toFixed(1)}</span></div>
    <span style="display:flex;gap:6px;margin-top:8px">
      <button style="flex:1" onclick="act('doswap',${m.out.id},${m.inn.id})">Make this transfer</button>
      <button onclick="act('ignore',${m.inn.id})" title="Stop suggesting this player">Ignore</button></span></div>`;
}
/* ---------- player comparison radar (Transfers page) ---------- */
function radarHTML(){
  const g=VG();
  const ids=S.radarIds||[null,null,null];
  const own=new Set(S.squad||[]);
  const byPred=[...S.model.players].sort((a,b)=>hPts(b,g,S.horizon)-hPts(a,g,S.horizon));
  const cand=[],seen=new Set();
  S.model.players.filter(p=>own.has(p.id)).forEach(p=>{cand.push(p);seen.add(p.id);});
  byPred.forEach(p=>{if(cand.length<180&&!seen.has(p.id)){cand.push(p);seen.add(p.id);}});
  cand.sort((a,b)=>a.web_name.localeCompare(b.web_name));
  const opts=sel=>[1,2,3,4].map(pos=>`<optgroup label="${POS[pos]}">${cand.filter(p=>p.pos===pos)
    .map(p=>`<option value="${p.id}" ${sel===p.id?"selected":""}>${esc(p.web_name)} · ${esc(p.teamName)}</option>`).join("")}</optgroup>`).join("");
  const selects=[0,1,2].map(i=>`<select class="rsel" onchange="act('radarpick',${i},this.value)">
    <option value="">Player ${i+1}…</option>${opts(ids[i])}</select>`).join("");

  const W=p=>ws(String(p.code||""),p.pos,S.lWin||38)||{};
  const AXF={
    "xFPL":p=>hPts(p,g,S.horizon),"Form":p=>p.form||0,
    "xGI/90":p=>{const w=W(p);return (w.xg90||0)+(w.xa90||0);},"xMins":p=>p.xMins||0,
    "npxG/90":p=>W(p).npxg90||0,"xA/90":p=>W(p).xa90||0,"CC/90":p=>W(p).cc90||0,
    "xG/90":p=>W(p).xg90||0,"Shots/90":p=>W(p).sh90||0,"DefCon/90":p=>W(p).dc90||W(p).cbit90||0,
    "CS %":p=>(p.csRate||0)*100,"Aerials/90":p=>W(p).aer90||0,"Saves/90":p=>W(p).sv90||0,"G prevented":p=>W(p).gp||0};
  const AXSET={gen:["xFPL","Form","xGI/90","npxG/90","xA/90","xMins"],
    1:["xFPL","Form","Saves/90","CS %","G prevented","xMins"],
    2:["xFPL","Form","DefCon/90","CS %","xGI/90","Aerials/90"],
    3:["xFPL","Form","xGI/90","npxG/90","xA/90","CC/90"],
    4:["xFPL","Form","npxG/90","xG/90","Shots/90","xGI/90"]};

  const active=ids.map(id=>id?S.model.players.find(p=>p.id===id):null).filter(Boolean);
  const COL=["var(--cyan)","var(--amber)","var(--mint)"];
  let body;
  if(!active.length){
    body=`<p class="note" style="margin:0">Pick up to three players above to compare them across xFPL, form and the stats that matter for their position.</p>`;
  }else{
    const positions=[...new Set(active.map(p=>p.pos))];
    const axes=(positions.length===1&&AXSET[positions[0]])?AXSET[positions[0]]:AXSET.gen;
    const maxes=axes.map(ax=>Math.max(1e-6,...active.map(p=>AXF[ax](p))));
    const cx=150,cy=150,R=104,N=axes.length;
    const ang=i=>(-90+i*360/N)*Math.PI/180;
    const pt=(i,f)=>[(cx+Math.cos(ang(i))*R*f).toFixed(1),(cy+Math.sin(ang(i))*R*f).toFixed(1)];
    const rings=[0.25,0.5,0.75,1].map(f=>`<polygon points="${axes.map((_,i)=>pt(i,f).join(",")).join(" ")}" fill="none" stroke="var(--ink3)" stroke-width="1" opacity=".6"/>`).join("");
    const spokes=axes.map((_,i)=>`<line x1="${cx}" y1="${cy}" x2="${pt(i,1)[0]}" y2="${pt(i,1)[1]}" stroke="var(--ink3)" stroke-width="1" opacity=".6"/>`).join("");
    const labels=axes.map((ax,i)=>{const[x,y]=pt(i,1.16);
      return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="9.5" fill="var(--mute)">${ax}</text>`;}).join("");
    const polys=active.map((p,j)=>{const pts=axes.map((ax,i)=>pt(i,Math.min(1,AXF[ax](p)/maxes[i])).join(",")).join(" ");
      return `<polygon points="${pts}" fill="${COL[j]}" fill-opacity=".14" stroke="${COL[j]}" stroke-width="2"/>`;}).join("");
    const svg=`<svg viewBox="0 0 300 300" style="width:100%;max-width:340px;height:auto;display:block;margin:0 auto">
      ${rings}${spokes}${labels}${polys}</svg>`;
    const legend=active.map((p,j)=>`<span class="tlegend"><span class="tdot" style="background:${COL[j]};height:8px;width:8px;border-radius:50%"></span>${esc(p.web_name)}</span>`).join("");
    body=`<div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-bottom:6px">${legend}</div>
      ${svg}
      <p class="note" style="margin:8px 0 0;text-align:center">Each axis is scaled to the strongest of the compared players${positions.length>1?" · mixed positions, so general stats are shown":""}.</p>`;
  }
  return `<div class="panel"><div class="phead"><h2>Compare players</h2><span class="note">up to 3</span></div>
    <div class="pbody">
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${selects}</div>
      ${body}
    </div></div>`;
}
function transfersHTML(){
  const g=VG();
  const outIds=S.outList.length?S.outList:null;
  const all=bestSwaps(400);
  const pool=outIds?all.filter(m=>outIds.includes(m.out.id)):all;
  const budget=outIds
    ? S.bank+outIds.reduce((a,i)=>a+(S.model.players.find(p=>p.id===i)?.price||0),0)
    : S.bank;
  const top=pool[0];
  const posName={1:"Goalkeepers",2:"Defenders",3:"Midfielders",4:"Forwards"};
  const chosen=S.outList.map(i=>S.model.players.find(p=>p.id===i)).filter(Boolean);

  const picker=`<div class="panel"><div class="phead"><h2>Plan your transfers</h2>
      <span class="note">£${budget.toFixed(1)} available</span></div>
    <div class="pbody">
      <p class="note" style="margin:0 0 8px">Tap players to sell. Recommendations use the combined budget.</p>
      ${[1,2,3,4].map(pos=>{const list=squadPlayers().filter(p=>p.pos===pos);if(!list.length)return"";
        return `<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap">
          <span style="font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--mute);font-weight:700;width:34px">${POS[pos]}</span>
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
  const headScout=(top&&pool.length&&top.gain>=TRANSFER_MIN)?`<div class="panel" style="border-color:var(--amber);background:#33240B">
      <div class="phead" style="border-color:#5A3F10"><h2 style="color:var(--amber)">Head Scout</h2>
      <span class="note">GW${g}${S.horizon>1?`–${g+S.horizon-1}`:""}</span></div>
    <div class="pbody">
      <div style="font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--mint);font-weight:700;margin-bottom:8px">Top target</div>
      ${top.gain>=TRANSFER_MIN?swapCardHTML(top,g):`<p class="note" style="margin:0">Head Scout recommends no transfers — the best available move is worth only +${top.gain.toFixed(1)} points.</p>`}</div></div>`
    :`<div class="panel"><div class="phead"><h2>Head Scout</h2></div><div class="pbody">
      <p class="note">No transfer improves your predicted total within budget and the three-per-club limit.</p></div></div>`;

  const suggestTitle=`<div class="panel"><div class="phead"><h2>Head Scout suggestions</h2>
      <span class="note">best four per position</span></div></div>`;
  const byPos=[1,2,3,4].map(pos=>{
    /* One recommendation per player being sold, not a list of near-identical
       alternatives, and only where the gain is worth a transfer. */
    const seen=new Set();
    const list=pool.filter(m=>{
      if(m.inn.pos!==pos||(S.squad||[]).includes(m.inn.id))return false;
      if(m.gain<TRANSFER_MIN)return false;
      if(seen.has(m.out.id))return false;
      seen.add(m.out.id);return true;}).slice(0,4);
    return `<div class="panel"><div class="phead"><h2>${posName[pos]}</h2>
        <span class="note">${list.length?"top "+list.length:""}</span></div>
      <div class="pbody">${list.length?`<div class="tgrid">${list.map(m=>swapCardHTML(m,g)).join("")}</div>`
        :`<p class="note" style="margin:0">Head Scout recommends no transfers in this position.</p>`}</div></div>`;
  }).join("");

  return radarHTML()+picker+comboPanel+headScout+suggestTitle+byPos;
}
function totwCard(p,cap){
  const isCap=cap&&cap.id===p.id;
  const g=VG(),q=p.gw[g]||{fixtures:[],pts:0};
  const f0=q.fixtures[0];
  const[bg,fg,elite]=ptsCol(q.pts);
  const own=(S.squad||[]).includes(p.id);
  return `<div class="card">
    <div class="kit" style="cursor:pointer" onclick="act('card',${p.id})">${shirtSVG(p.teamName.toUpperCase(),p.pos===1,38)}
      ${cap&&cap.id===p.id?`<span class="badge" style="bottom:-2px;left:4px;background:var(--cream);color:var(--ink)">C</span>`:""}
      ${own?`<span class="badge" style="top:-2px;right:2px;background:var(--mint);color:var(--ink)">✓</span>`:""}</div>
    <div class="namebar"><span class="nm">${esc(p.web_name)}</span><span class="pr">£${p.price.toFixed(1)}</span></div>
    <div class="ptsbar" style="background:${bg};color:${fg};${elite?"box-shadow:0 0 0 2px var(--cyan) inset":""}"><div class="pv">${(q.pts*(isCap?2:1)).toFixed(1)}</div>
      <div class="fx">${f0?esc(f0.opp+" ("+(f0.home?"H":"A")+")"):"No fixture"}</div></div></div>`;
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
        <span class="fixteam" style="flex:none;width:148px;gap:8px">${shirtSVG(x.t.short.toUpperCase(),false,20)}
          <b>${esc(x.t.name||x.t.short)}</b></span>
        <span class="note" style="flex:none;width:74px">${x.good} of ${x.runs.length}</span>
        <span style="display:flex;gap:4px;flex-wrap:wrap">${x.runs.map(r=>
          fdrPill(r.opp,r.home,r.d,{short:true})).join("")}</span></div>`).join("")
        :`<div class="pbody"><p class="note">No club has four kind fixtures in the next five on this measure.</p></div>`}
    </div>`;
  };

  const head=`<div class="panel"><div class="phead"><h2>Fixtures</h2>
     <span style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
       <button class="${mode==="team"?"on":""}" onclick="act('fixmode','team')">By club</button>
       <button class="${mode==="gw"?"on":""}" onclick="act('fixmode','gw')">By gameweek</button>
       <span style="width:8px"></span>
       ${[["all","Overall"],["att","For attackers"],["def","For defenders"]].map(([k,n])=>
         `<button class="${(lens||"all")===k?"on":""}" onclick="act('lens','${k}')">${n}</button>`).join("")}
     </span></div>
    <div class="pbody" style="border-bottom:1px solid var(--ink3);display:flex;gap:12px;flex-wrap:wrap;align-items:center">
      <span class="note" style="flex:1;min-width:220px">Away fixtures are shown in <i>italics</i>. A defender's rating reads the opponent's attack; an attacker's reads their defence.</span>
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
        cells+=`<td style="text-align:center;white-space:nowrap">${fx.map(f=>{
          const home=f.ht===t, opp=home?f.at:f.ht;
          return fdrPill(opp?.short||"?",home,fdrOf(opp,home,t,lens),{short:true});}).join(" ")}</td>`;}
      const hot=best3.includes(t);
      const col=v=>v<=2.2?"var(--mint)":v>=3.6?"var(--red)":"var(--cream)";
      return `<tr style="${hot?"background:rgba(45,220,135,.07)":""}">
        <td class="nm" style="white-space:nowrap"><span style="display:flex;align-items:center;gap:7px">
          ${shirtSVG(t.short.toUpperCase(),false,20)}<b>${esc(t.short)}</b>
          ${hot?'<span class="sig" style="border-color:var(--mint);color:var(--mint)">🏃</span>':""}</span></td>
        <td class="mono" style="text-align:right;color:${col(d1)}">${d1.toFixed(1)}</td>
        <td class="mono" style="text-align:right;color:${col(d3)}">${d3.toFixed(2)}</td>
        <td class="mono" style="text-align:right;font-weight:700;color:${col(d5)}">${d5.toFixed(2)}</td>${cells}</tr>`;});
    return targetPanel("att","Attack",
        "Clubs with a strong attack meeting weak defences in at least four of the next five.")
      +targetPanel("def","Defence",
        "Solid defences meeting weak attacks in at least four of the next five.")
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
    const dl=ev&&ev.deadline?new Date(ev.deadline).toLocaleString("en-GB",
      {weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"";
    out+=`<div class="gwband"><span>Gameweek ${e}${e===g?" · next":""}</span>
      ${dl?`<span class="gwdl">Deadline ${esc(dl)}</span>`:""}</div>`;
    fx.forEach(f=>{
      const h=f.ht,a=f.at;if(!h||!a)return;
      const hd=fdrOf(a,true,h,lens), ad=fdrOf(h,false,a,lens);
      const dt=f.kickoff?new Date(f.kickoff):null;
      const d=dt?dt.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"}):"";
      const tm=dt?dt.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}):"";
      out+=`<div class="fixrow">
        <span class="fixteam" style="gap:8px">${shirtSVG(h.short.toUpperCase(),false,22)}
          <span style="font-weight:600">${esc(h.name||h.short)}</span>
          ${fdrPill(a.short,true,hd,{short:true})}</span>
        <span style="flex:none;width:112px;text-align:center;line-height:1.25">
          <span style="display:block;color:var(--cream);font-size:11px;font-weight:600">${esc(tm)}</span>
          <span style="display:block;color:var(--mute);font-size:9px">${esc(d)}</span></span>
        <span class="fixteam away" style="gap:8px">${fdrPill(h.short,false,ad,{short:true})}
          <span style="font-weight:600;font-style:italic">${esc(a.name||a.short)}</span>
          ${shirtSVG(a.short.toUpperCase(),false,22)}</span></div>`;
    });
  }
  return head+`<div class="panel">${navFix(start,span,g)}${out||'<div class="pbody"><p class="note">No fixtures in this range.</p></div>'}${navFix(start,span,g)}</div>`;
}
function navFix(start,span,g){
  return `<div class="pbody" style="display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap">
    <button class="${S.expand.allFix?"on":""}" onclick="act('expand','allFix')">${S.expand.allFix?"Ten at a time":"Show all 38"}</button>
    <button onclick="act('fixgw',${Math.max(g,start-10)})" ${start<=g?"disabled":""}>← earlier</button>
    <span class="note">GW${start}–${Math.min(38,start+span-1)}</span>
    <button onclick="act('fixgw',${Math.min(38,start+10)})" ${start+span>38?"disabled":""}>later →</button></div>`;
}

const FORMS=[[3,4,3],[3,5,2],[4,4,2],[4,3,3],[4,5,1],[5,3,2],[5,4,1]];
const _sqCache={};
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
  const need={1:2,2:5,3:5,4:3};
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
    const total=xi.reduce((a,p)=>a+val(p),0)+(cap?val(cap):0);
    if(!best||total>best.total)
      best={xi:xi.slice().sort(rank),bench,cap,total,shape:`${d}-${m}-${f}`,
        value:+spend().toFixed(1),benchValue:+bspend.toFixed(1),weeks,val};
  });
  _sqCache[key]=best;
  return best;
}
function myScore(gw,weeks){
  const sp=squadPlayers();if(!sp.length)return 0;
  const v=p=>{let t=0;for(let e=gw;e<gw+weeks&&e<=38;e++)t+=(p.gw[e]?.pts||0);return t/weeks;};
  const xi=[...sp].sort((a,b)=>v(b)-v(a)).slice(0,11);
  return xi.reduce((a,p)=>a+v(p),0)+(xi[0]?v(xi[0]):0);
}
function chipsHTML(){
  const g=VG();
  const budget=+(squadPlayers().reduce((a,p)=>a+p.price,0)+S.bank).toFixed(1);
  const half=g>=20?2:1;
  const openHalf=S.chipHalf||half;                       // active half expands by default

  /* ---- squad card, reusing the Planner pitch ---- */
  const sqCard=(kind,title,note,formKey)=>{
    const form=S[formKey]||null;
    const t=buildSquad(kind,g,form,budget);
    const weeks=kind==="wildcard"?5:1;
    const mine=myScore(g,weeks);
    const delta=t?t.total-mine:0;
    const label=kind==="wildcard"?`GW${g}–${Math.min(38,g+4)} average`:`GW${g}`;
    return `<div class="panel">
      <div class="phead"><h2>${title}</h2>
        <span style="text-align:right">
          <span style="display:block;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:22px;
            line-height:1;color:${delta>0?"var(--mint)":"var(--mute)"}">${delta>0?"+":""}${delta.toFixed(1)}</span>
          <span class="note">vs your team · ${label}</span></span></div>
      <div class="pbody" style="border-bottom:1px solid var(--ink3)">
        <p class="note" style="margin:0 0 8px">${note}</p>
        <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
          <span class="note" style="width:100%">Formation</span>
          <button class="chipbtn ${!form?"on":""}" onclick="act('${formKey}','')">Best${t&&!form?` · ${t.shape}`:""}</button>
          ${FORMS.map(f=>{const k=f.join("-");
            return `<button class="chipbtn ${form===k?"on":""}" onclick="act('${formKey}','${k}')">${k}</button>`;}).join("")}
        </div>
        ${t?`<p class="note" style="margin:8px 0 0">${t.total.toFixed(1)} projected · £${t.value.toFixed(1)} of £${budget.toFixed(1)} · bench £${t.benchValue.toFixed(1)}</p>`:""}
      </div>
      ${t?`<div class="pitch">${[1,2,3,4].map(pos=>{const r=t.xi.filter(p=>p.pos===pos);
        return r.length?`<div class="row">${r.map(p=>chipCard(p,t)).join("")}</div>`:"";}).join("")}</div>
        <div class="benchbar"><div class="lb">Bench</div>
          <div class="row">${t.bench.map(p=>chipCard(p,t)).join("")}</div></div>`
        :`<div class="pbody"><p class="note">Not enough data for this gameweek.</p></div>`}
    </div>`;
  };

  /* ---- chip timeline ---- */
  const basis={wildcard:"Worst three-week run — rebuild before it",
    freehit:"Biggest gap between your XI and the best available",
    bboost:"Week your four substitutes score most",
    "3xc":"Week your best player has his highest single score"};
  const chipRow=(k,n)=>{
    const plan=chipPlan(k)||[], locked=S.chips[k], hist=CHIP_HISTORY[chipKind(k)];
    const isHalf2=k.endsWith("2");
    const from=isHalf2?Math.max(20,g):g, to=isHalf2?38:19;
    const byWeek={};plan.forEach(o=>byWeek[o.e]=o.up);
    const all=chipAllWeeks(k);
    const max=Math.max(0.1,...Object.values(all));
    const best=plan[0];
    return `<div class="chipblock">
      <div class="chiphead">
        <span><span class="chipname">${n}</span>
          <span class="note" style="margin-left:8px">${esc(basis[chipKind(k)])}</span></span>
        <span class="note">you average ${hist.toFixed(1)}</span></div>
      ${locked?`<div class="chiplocked">
        <span><b>GW${locked}</b> selected${byWeek[locked]!=null||all[locked]!=null?` · projected +${(all[locked]||0).toFixed(1)} pts`:""}</span>
        <button onclick="act('clearchip','${k}')">Clear</button></div>`
        :best?`<div class="chipbest">Best week — <b>GW${best.e}</b>, +${best.up.toFixed(1)} pts${best.note?` · ${esc(best.note)}`:""}</div>`:""}
      <div class="tl">
        ${Object.keys(all).map(Number).sort((a,b)=>a-b).map(e=>{
          const v=all[e]||0, h=Math.max(3,Math.round(v/max*34));
          const isBest=best&&best.e===e, isSel=locked===e;
          return `<button class="tlweek ${isSel?"sel":""} ${isBest&&!isSel?"best":""}"
            onclick="act('setchip','${k}',${e})" title="GW${e} · +${v.toFixed(1)} pts">
            <span class="tlbar" style="height:${h}px"></span>
            <span class="tlnum">${e}</span></button>`;}).join("")}
      </div></div>`;
  };
  const set=[["wildcard","Wildcard"],["freehit","Free Hit"],["3xc","Triple Captain"],["bboost","Bench Boost"]];
  const halfPanel=hf=>`<div class="panel">
      <div class="phead" style="cursor:pointer" onclick="act('chiphalf',${hf})">
        <h2 style="${openHalf===hf?"color:var(--mint)":""}">${hf===1?"First half · GW1–19":"Second half · GW20–38"}</h2>
        <span class="note">${hf===1?"expire 2 Jan, 13:30 GMT":"reset at GW20"} ${openHalf===hf?"▲":"▼"}</span></div>
      ${openHalf===hf?set.map(([k,n])=>chipRow(k+hf,n)).join(""):""}</div>`;

  return `<div class="sqgrid">
      <div class="${S.chipView==="wc"?"hideSm":""}">${sqCard("freehit","Free Hit team",
        "One week only, so every penny goes into the XI and the bench is fodder.","fhForm")}</div>
      <div class="${S.chipView==="fh"||!S.chipView?"hideSm":""}">${sqCard("wildcard","Wildcard squad",
        "A squad you keep — judged across the next five gameweeks, with a bench that can actually play.","wcForm")}</div>
    </div>
    <div class="sqtoggle">
      <button class="${(S.chipView||"fh")==="fh"?"on":""}" onclick="act('chipview','fh')">Free Hit</button>
      <button class="${S.chipView==="wc"?"on":""}" onclick="act('chipview','wc')">Wildcard</button>
    </div>
    ${halfPanel(half)}${halfPanel(half===1?2:1)}`;
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
    if(k==="bboost")out[e]=xi.slice(11).reduce((a,p)=>a+(p.gw[e]?.pts||0),0);
    else if(k==="3xc")out[e]=xi[0]?.gw[e]?.pts||0;
    else out[e]=known[e]!=null?known[e]:(plan.length?plan[plan.length-1].up*0.6:0);
  }
  return out;
}
function chipCard(p,t){
  const g=VG();
  const v=t.val(p), isC=t.cap&&t.cap.id===p.id;
  const q=p.gw[g]||{fixtures:[]};
  const[bg,fg,elite]=ptsCol(v*(isC?2:1));
  const f0=q.fixtures[0];
  const own=(S.squad||[]).includes(p.id);
  return `<div class="card">
    <div class="kit" style="cursor:pointer" onclick="act('card',${p.id})">${shirtSVG(p.teamName.toUpperCase(),p.pos===1,38)}
      ${isC?`<span class="badge" style="bottom:-2px;left:4px;background:var(--cream);color:var(--ink)">C</span>`:""}
      ${own?`<span class="badge" style="top:-2px;right:2px;background:var(--mint);color:var(--ink)">✓</span>`:""}</div>
    <div class="namebar"><span class="nm">${esc(p.web_name)}</span><span class="pr">£${p.price.toFixed(1)}</span></div>
    <div class="ptsbar" style="background:${bg};color:${fg};${elite?"box-shadow:0 0 0 2px var(--cyan) inset":""}">
      <div class="pv">${(v*(isC?2:1)).toFixed(1)}</div>
      <div class="fx">${f0?`<span style="${f0.home?"":"font-style:italic"}">${esc(f0.opp)} (${f0.home?"H":"A"})</span>`:"No fixture"}</div></div>
    <div class="cardsigs">${sigHTML(p,g)}</div>
    <div class="next3">${(()=>{let h="";for(let e=g;e<g+3&&e<=38;e++){const w=p.gw[e];
      if(!w||w.blank){h+=`<span style="background:var(--ink3);color:var(--mute)">—</span>`;continue;}
      const f=w.fixtures[0],[b,c]=fdrCol(posDiff(p,f));
      h+=`<span style="background:${b};color:${c};${f.home?"":"font-style:italic"}">${esc(f.opp.slice(0,3))}</span>`;}return h;})()}</div></div>`;
}

function itemHTML(n,score){
  const h=hits(n.title),ago=Math.max(0,Math.round((Date.now()-n.time)/3600000));
  const when=ago<1?"just now":(ago<24?ago+"h ago":Math.round(ago/24)+"d ago");
  return `<a class="item ${h.length?"hit":""}" href="${esc(n.url)}" target="_blank" rel="noopener">
    <div class="ttl" ${h.length?'style="color:var(--mint)"':""}>${h.length?`<span class="tag">${esc(h.join(", "))}</span>`:""}${esc(n.title)}</div>
    <div class="meta"><span class="src">${esc(n.src)}</span><span>${when}</span>
      ${score&&n.score?`<span>▲ ${n.score}</span>`:""}${n.comments?`<span>${n.comments} comments</span>`:""}
      ${n.extra?`<span>${esc(n.extra)}</span>`:""}</div></a>`;
}
function sectionHTML(key,title,items,score,empty){
  const any=items.some(n=>hits(n.title).length),open=!!S.expand[key];
  const shown=open?items.slice(0,40):items.slice(0,10);
  return `<div class="panel"><div class="phead">
      <h2 style="${any?"color:var(--mint)":""}">${title}${any?' <span style="font-size:11px">· your squad</span>':""}</h2>
      <span class="note">${items.length}</span></div>
    ${items.length?shown.map(n=>itemHTML(n,score)).join(""):`<div class="pbody"><p class="note">${esc(empty)}</p></div>`}
    ${items.length>10?`<button style="margin:10px 13px 13px" onclick="act('expand','${key}')">${open?"Show less":"Read more · "+(items.length-10)+" more"}</button>`:""}</div>`;
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

