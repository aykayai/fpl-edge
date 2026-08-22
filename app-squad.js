/* FPL Edge — app-squad.js
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
function badge(glyph,fill,ring){
  const id=++_bid;
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
/* Differential — a diamond, the odd one out */
const ICON_DIFF=badge(`<path d="M13 8.4 18.2 14.6 13 20.8 7.8 14.6Z" fill="#06222B" opacity=".9"/>
  <path d="M13 11.2 15.8 14.6 13 18 10.2 14.6Z" fill="#9FF2FF"/>`,"#22C3E6","#8FEAFB");
/* Hot streak — flame */
const ICON_HOT=badge(`<path d="M13 6.6c2.7 3 4.6 5.2 4.6 8.1a4.6 4.6 0 0 1-9.2 0c0-1.6.8-2.9 1.8-4.1.5 1 1.1 1.7 2 2-.1-2.1.3-4.1.8-6Z"
  fill="#3A1400"/><path d="M13 12.6c1.1 1.3 1.8 2.3 1.8 3.4a1.8 1.8 0 0 1-3.6 0c0-.8.4-1.5 1-2.1.3.4.5.6.8.7Z" fill="#FFE0C2"/>`,"#FF7A2F","#FFC08A");
/* Attack — a football */
const ICON_ATT=badge(`<circle cx="13" cy="15" r="6.1" fill="#FFFDF6" stroke="#8A5A12" stroke-width="1"/>
  <path d="M13 11.1 15.9 13.2 14.8 16.6H11.2L10.1 13.2Z" fill="#20160A"/>
  <path d="M13 8.9v2.2M9.3 13.4 7.2 12.6M16.7 13.4l2.1-.8M11.2 16.6l-1.3 2M14.8 16.6l1.3 2"
    stroke="#20160A" stroke-width="1.15" stroke-linecap="round"/>`,"#FFB020","#FFDFA6");
/* Defence — shield with a tick, inside the shield silhouette */
const ICON_DEF=badge(`<path d="M13 8.6 18 10.3v3.9c0 2.7-1.9 4.4-5 5.4-3.1-1-5-2.7-5-5.4v-3.9Z" fill="#06222B"/>
  <path d="M10.8 14.4l1.6 1.7 3-3.3" stroke="#9FF2FF" stroke-width="1.7" fill="none"
    stroke-linecap="round" stroke-linejoin="round"/>`,"#22C3E6","#8FEAFB");
/* DefCon — a stop sign */
const ICON_DC=badge(`<path d="M10.9 8.9h4.2l3 3v4.2l-3 3h-4.2l-3-3v-4.2Z" fill="#7A0F1E" stroke="#FFD9DF" stroke-width="1"/>
  <text x="13" y="16.9" font-family="Inter,Arial,sans-serif" font-size="5.6" font-weight="900"
    fill="#FFF" text-anchor="middle" letter-spacing="-0.2">STOP</text>`,"#E14156","#FFB3BF");
/* Nailed — stopwatch */
const ICON_MIN=badge(`<path d="M10.9 7.1h4.2" stroke="#0A0D12" stroke-width="2.1" stroke-linecap="round"/>
  <circle cx="13" cy="15.4" r="5.4" fill="#121B25" stroke="#E6EFFA" stroke-width="1.3"/>
  <path d="M13 12.1v3.5l2.4 1.5" stroke="#E6EFFA" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,"#93A8C2","#DCE8F5");
/* Stats caution — exclamation */
const ICON_STALE=badge(`<path d="M13 8.4 19 19.4H7Z" fill="#3A2000"/>
  <path d="M13 12v3.2" stroke="#FFEFC9" stroke-width="1.8" stroke-linecap="round"/>
  <circle cx="13" cy="17.3" r="1" fill="#FFEFC9"/>`,"#F2B33D","#FFE2A0");
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
function setPieceHTML(p){
  const duty=SETPIECE[(p.teamName||"").toUpperCase()];
  if(!duty)return "";
  const me=norm(p.web_name), out=[];
  const hit=list=>(list||[]).some(nm=>{const t=norm(nm);
    return t&&(me===t||me.includes(t)||t.includes(me));});
  [["P","Penalties"],["F","Free kicks"],["C","Corners"]].forEach(([k,label])=>{
    if(!hit(duty[k]))return;
    const[b,c]=SPCOL[k];
    out.push(`<span class="sig" title="${label}">${badge(G(k,11),b,c)}</span>`);
  });
  return out.length?`<span class="sigs">${out.join("")}</span>`:"";
}

const SIGDEF=[[ICON_DIFF,"#3ED8F0","Differential"],
 [ICON_HOT,"#FF8A3D","Hot streak"],
 [ICON_ATT,"#FFB020","Attack"],
 [ICON_DEF,"var(--sky)","Defence"],
 [ICON_DC,"#7C4DFF","DefCon"],
 [ICON_MIN,"#8FA3BC","Nailed 85+"],
 [ICON_STALE,"#F2C14E","Stats caution"]];
function legendHTML(){
  return `<div class="legend">
    ${SIGDEF.map(([l,c,t])=>`<span class="lgi">${sigIcon(l,c,t)}<span>${esc(t)}</span></span>`).join("")}
    ${[["P","Penalties"],["F","Free kicks"],["C","Corners"]].map(([k,t])=>{const[b,c]=SPCOL[k];
      return `<span class="lgi"><span class="sig">${badge(G(k,11),b,c)}</span><span>${t}</span></span>`;}).join("")}</div>`;
}
function signals(p,g){
  const out=[];
  if(p.owned>0&&p.owned<8&&(p.gw[g]?.pts||0)>3.4)out.push(SIGDEF[0]);
  /* Only meaningful when both sides of the comparison come from actual
     matches. A synthetic form estimate minus a two-game sample is noise, and
     a player projected not to play cannot be in form at all. */
  const realForm=p.formSrc==="this season"||/25\/26|2025/.test(p.formSrc||"");
  if(realForm&&p.ppg>=1.5&&p.xMins>=45&&p.form-p.ppg>0.7)out.push(SIGDEF[1]);
  /* the two target flags come from the club shortlists, so a player's badge and
     the Fixtures page always agree */
  /* Each target badge only goes to the players it can actually help: the star
     to midfielders and forwards, who score from attacking returns, and the
     shield to keepers and defenders, who score from clean sheets. */
  const T=targetClubs();
  if(p.pos>=3&&T.att.has(p.team))out.push(SIGDEF[2]);
  if(p.pos<=2&&T.def.has(p.team))out.push(SIGDEF[3]);
  /* DefCon is only a route to points for defenders and midfielders, and only
     worth flagging where he clears the threshold in a decent share of matches */
  if((p.pos===2||p.pos===3)&&p.dcHitRate!=null
     &&p.dcHitRate>=(p.pos===2?0.45:0.22))out.push(SIGDEF[4]);
  if(p.xMins>=85)out.push(SIGDEF[5]);
  if(p.staleRole)out.push(SIGDEF[6]);
  return out;
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
const sigIcon=(l,c,t)=>`<span class="sig" title="${t}">${l}</span>`;
const sigHTML=(p,g)=>{const s=signals(p,g);return setPieceHTML(p)+(s.length?
  `<span class="sigs">${s.map(([l,c,t])=>sigIcon(l,c,t)).join("")}</span>`:"");};

/* ---------- squad ---------- */
function saveState(){LS.set("state",{v:STATE_VERSION,squad:S.squad,original:S.original,captain:S.captain,
  vice:S.vice,chips:S.chips,bank:S.bank,ft:S.ft,forceXI:S.forceXI,activeChip:S.activeChip,benchOrder:S.benchOrder,replacedBy:S.replacedBy});}
function resolveSeed(quiet){
  if(!S.model)return;
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
}
const squadPlayers=()=>(S.squad||[]).map(id=>S.model.players.find(p=>p.id===id)).filter(Boolean);
function startingXI(){
  const sp=squadPlayers();if(!sp.length)return[];
  const g=VG();
  if(S.forceXI?.length===11){const xi=S.forceXI.map(i=>sp.find(p=>p.id===i)).filter(Boolean);
    if(xi.length===11)return xi;}
  const by={};sp.forEach(p=>(by[p.pos]=by[p.pos]||[]).push(p));
  Object.values(by).forEach(a=>a.sort((x,y)=>(y.gw[g]?.pts||0)-(x.gw[g]?.pts||0)));
  const xi=[];if(by[1]?.[0])xi.push(by[1][0]);
  (by[2]||[]).slice(0,3).forEach(p=>xi.push(p));(by[4]||[]).slice(0,1).forEach(p=>xi.push(p));
  [...(by[2]||[]).slice(3),...(by[3]||[]),...(by[4]||[]).slice(1)]
    .sort((a,b)=>(b.gw[g]?.pts||0)-(a.gw[g]?.pts||0)).slice(0,11-xi.length).forEach(p=>xi.push(p));
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
function weekPts(){
  const xi=startingXI();if(!xi.length)return 0;
  const g=VG();
  let s=xi.reduce((a,p)=>a+hPts(p,g,S.horizon),0);
  const cap=S.model.players.find(p=>p.id===S.captain);
  if(cap&&xi.includes(cap))s+=hPts(cap,g,S.horizon);
  const bench=squadPlayers().filter(p=>!xi.includes(p));
  const chip=chipForWeek(g);
  if(chip==="bboost")s+=bench.reduce((a,p)=>a+hPts(p,g,S.horizon),0);
  if(chip==="3xc"&&cap)s+=hPts(cap,g,S.horizon);
  return s;
}
/* ---------- transfer engine ---------- */
function bestSwaps(limit){
  if(!S.model||!S.squad)return[];
  const g=VG(),out=[];
  S.squad.forEach(oid=>{
    const o=S.model.players.find(p=>p.id===oid);if(!o)return;
    const cc={};S.squad.filter(i=>i!==oid).forEach(i=>{
      const p=S.model.players.find(x=>x.id===i);if(p)cc[p.team]=(cc[p.team]||0)+1;});
    S.model.players.forEach(p=>{
      if(p.pos!==o.pos||S.squad.includes(p.id)||p.avail<=0)return;
      if((S.ignored||[]).includes(p.id))return;
      if(p.price>S.bank+o.price+.001)return;
      if((cc[p.team]||0)>=3)return;
      const gain=hPts(p,g,S.horizon)-hPts(o,g,S.horizon);
      /* where gains are level, prefer the player carrying signals */
      const sig=signals(p,g).length;
      if(gain>0.05)out.push({out:o,inn:p,gain,sig});});});
  out.sort((a,b)=>(b.gain-a.gain)||(b.sig-a.sig));
  const seen=new Set(),uniq=[];
  out.forEach(m=>{const k=m.out.id+"-"+m.inn.id;if(seen.has(k))return;seen.add(k);uniq.push(m);});
  return uniq.slice(0,limit||10);
}
function bestCombo(outIds){
  if(!S.model||!outIds.length)return null;
  const g=S.model.next.id;
  const outs=outIds.map(i=>S.model.players.find(p=>p.id===i)).filter(Boolean);
  let budget=S.bank+outs.reduce((a,p)=>a+p.price,0);
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
      if(p.pos!==o.pos||taken.has(p.id)||p.avail<=0)return;
      if(p.price>budget-cheapestRest+.001)return;
      if((club[p.team]||0)>=3)return;
      const gain=hPts(p,g,S.horizon)-hPts(o,g,S.horizon);
      if(!best||gain>best.gain)best={out:o,inn:p,gain};});
    if(best){picks.push(best);taken.add(best.inn.id);
      club[best.inn.team]=(club[best.inn.team]||0)+1;budget-=best.inn.price;budget+=0;}
  });
  const spent=picks.reduce((a,m)=>a+m.inn.price,0);
  const freed=S.bank+outs.reduce((a,p)=>a+p.price,0);
  return{picks,gain:picks.reduce((a,m)=>a+m.gain,0),left:+(freed-spent).toFixed(1),freed:+freed.toFixed(1)};
}
function applySwap(oid,iid){
  const o=S.model.players.find(p=>p.id===oid),i=S.model.players.find(p=>p.id===iid);
  if(!o||!i)return;
  S.squad=S.squad.map(x=>x===oid?iid:x);
  S.bank=+(S.bank+o.price-i.price).toFixed(1);
  S.flagged=S.flagged.filter(x=>x!==oid);S.forceXI=null;saveState();
}
/* Historical returns for this manager, shown alongside each projection */
const TRANSFER_MIN=1.0;   // a suggestion has to be worth the transfer
const CHIP_HISTORY={wildcard:10.2,bboost:23.7,freehit:10.7,"3xc":14.2};
const chipKind=k=>k.replace(/[12]$/,"");

/* ---------- chip planning ----------
   Each chip is judged on what actually makes it pay, not one shared formula. */
function weekScore(sp,e){
  const xi=[...sp].sort((a,b)=>(b.gw[e]?.pts||0)-(a.gw[e]?.pts||0));
  const start=xi.slice(0,11);
  return{xi:start,bench:xi.slice(11),
    pts:start.reduce((a,p)=>a+(p.gw[e]?.pts||0),0)+(start[0]?.gw[e]?.pts||0),
    benchPts:xi.slice(11).reduce((a,p)=>a+(p.gw[e]?.pts||0),0)};
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
  const c=take.slice().sort((a,b)=>b.gw[e].pts-a.gw[e].pts)[0];
  return take.reduce((a,p)=>a+p.gw[e].pts,0)+(c?c.gw[e].pts:0);
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
  const g=VG(), BUDGET=100.0, BENCH_MAX=17.5, need={1:2,2:5,3:5,4:3};
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
  return{pct:Math.round(clamp(mine/t.total,0,1)*100),mine,best:t.total,totw:t};
}

/* ---------- news ---------- */
/* News is fetched alongside everything else on refresh. Each source gets a
   handful of routes; a source only counts as failed once all of them have been
   tried, and nothing here blocks the squad data. */
/* r.jina.ai sends CORS headers of its own and renders the target server-side,
   which is why it survives where the generic proxies fail. It goes first. */
const ROUTES=[
  u=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u=>`https://r.jina.ai/${u}`,
  u=>`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  u=>`https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
  u=>`https://api.cors.lol/?url=${encodeURIComponent(u)}`
];
async function grab(url,ms){
  for(const fn of ROUTES){
    try{
      const ctl=new AbortController();
      const timer=setTimeout(()=>ctl.abort(),ms||9000);
      const r=await fetch(fn(url),{signal:ctl.signal});
      clearTimeout(timer);
      if(!r.ok)continue;
      let t=await r.text();
      if(t&&t.trim().startsWith("{")&&t.includes('"contents"')){
        try{t=JSON.parse(t).contents;}catch(e){}
      }
      if(t&&t.length>120)return t;
    }catch(e){}
  }
  return null;
}
/* jina hands back markdown for HTML pages, so pull [title](url) pairs out of it */
function parseLinks(txt,src,sink,filter){
  if(!txt)return 0;
  let n=0,m;const seen=new Set();
  const re=/\[([^\]\n]{14,160})\]\((https?:\/\/[^\s)]+)\)/g;
  while((m=re.exec(txt))&&n<60){
    const title=m[1].replace(/\s+/g," ").trim(), url=m[2];
    if(filter&&!filter.test(url))continue;
    const k=title.toLowerCase();if(seen.has(k))continue;seen.add(k);
    sink.push({src,title,url,time:Date.now()});n++;
  }
  return n;
}
function parseFeed(txt,src,sink){
  if(!txt)return 0;let n=0;
  try{
    const d=new DOMParser().parseFromString(txt,"text/xml");
    d.querySelectorAll("item, entry").forEach(it=>{
      const t=(it.querySelector("title")?.textContent||"").trim();
      const l=it.querySelector("link")?.getAttribute("href")||it.querySelector("link")?.textContent||"";
      const pd=it.querySelector("pubDate, updated, published")?.textContent||"";
      if(t){sink.push({src,title:t,url:l,time:pd?new Date(pd).getTime():Date.now()});n++;}});
  }catch(e){}
  return n;
}
const FEEDS=[
  ["Fantasy Football Scout","https://www.fantasyfootballscout.co.uk/feed/"],
  ["Fantasy Football Pundit","https://www.fantasyfootballpundit.com/feed/"],
  ["All About FPL","https://allaboutfpl.com/feed/"],
  ["FPL Family","https://www.fplfamily.com/feed/"],
  ["Premier League","https://www.premierleague.com/rss/news"],
  ["BBC Football","https://feeds.bbci.co.uk/sport/football/rss.xml"]
];
const FPL_WORDS=["fpl","fantasy","gameweek","captain","wildcard","differential","defcon",
  "price change","bench boost","free hit","triple captain","clean sheet","predicted lineup"];
const looksFPL=t=>{const l=(t||"").toLowerCase();return FPL_WORDS.some(w=>l.includes(w));};

async function loadNews(){
  if(!S.model)return;
  S.newsState="loading";S.news=[];S.reddit=[];S.squadNews=[];S.srcLog={};render();
  const news=[],reddit=[],squad=[],log={};

  const jobs=FEEDS.map(async([name,url])=>{
    const t=await grab(url);
    const before=news.length;
    if(!parseFeed(t,name,news))parseLinks(t,name,news);
    /* general feeds only contribute FPL-flavoured items */
    if(/BBC|Premier League/.test(name)){
      const kept=news.slice(before).filter(n=>looksFPL(n.title));
      news.length=before;kept.forEach(n=>news.push(n));
    }
    log[name]=news.length-before;
  });

  jobs.push((async()=>{
    /* the original working route: allorigins wrapping reddit's own JSON */
    for(const u of ["https://www.reddit.com/r/FantasyPL/hot.json?limit=50&raw_json=1",
                    "https://www.reddit.com/r/FantasyPL/hot/.json?limit=50",
                    "https://old.reddit.com/r/FantasyPL/hot.json?limit=50",
                    "https://api.reddit.com/r/FantasyPL/hot?limit=50",
                    "https://www.reddit.com/r/FantasyPL/top.json?t=day&limit=50"]){
      const t=await grab(u,12000);if(!t)continue;
      try{
        const kids=JSON.parse(t)?.data?.children||[];
        if(kids.length){
          kids.forEach(c=>{const d=c.data;if(!d?.title)return;
            reddit.push({src:"r/FantasyPL",title:d.title,url:"https://www.reddit.com"+d.permalink,
              time:(d.created_utc||0)*1000,score:d.score||0,comments:d.num_comments||0,
              extra:d.link_flair_text||""});});
          log["r/FantasyPL"]=reddit.length;return;
        }
      }catch(e){}
    }
    for(const u of ["https://www.reddit.com/r/FantasyPL/hot/.rss?limit=50",
                    "https://old.reddit.com/r/FantasyPL/.rss?sort=hot&limit=50"]){
      const t=await grab(u);
      if(t&&parseFeed(t,"r/FantasyPL",reddit)){log["r/FantasyPL"]=reddit.length;return;}
    }
    /* last resort: read the rendered hot page and lift the post links */
    const t=await grab("https://www.reddit.com/r/FantasyPL/hot/");
    log["r/FantasyPL"]=parseLinks(t,"r/FantasyPL",reddit,/\/r\/FantasyPL\/comments\//);
  })());

  /* one search per squad player — the only reliable route to pre-season coverage */
  squadPlayers().forEach(p=>{
    jobs.push((async()=>{
      const q=encodeURIComponent(`"${p.first} ${p.last}" ${p.teamFull||p.teamName} when:7d`);
      const t=await grab(`https://news.google.com/rss/search?q=${q}&hl=en-GB&gl=GB&ceid=GB:en`,7000);
      const n=parseFeed(t,p.web_name,squad);log["· "+p.web_name]=n;
    })());
  });

  await Promise.all(jobs);
  const seen=new Set();
  const dedupe=a=>a.filter(n=>{const k=(n.title||"").slice(0,64).toLowerCase();
    if(!k||seen.has(k))return false;seen.add(k);return true;});
  S.news=dedupe(news.sort((a,b)=>b.time-a.time));
  S.squadNews=dedupe(squad.sort((a,b)=>b.time-a.time));
  S.reddit=dedupe(reddit);
  S.srcLog=log;
  S.newsState=(S.news.length||S.reddit.length||S.squadNews.length)?"ok":"fail";
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
function toast(m){let el=document.getElementById("toast");
  if(!el){el=document.createElement("div");el.id="toast";el.className="toast";document.body.appendChild(el);}
  el.textContent=m;el.style.display="block";clearTimeout(tT);tT=setTimeout(()=>el.style.display="none",3000);}
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const arw=c=>c>0?'<span style="color:var(--mint)">▲</span>':c<0?'<span style="color:var(--red)">▼</span>':"";

function cardHTML(p,benchSlot){
  const g=VG(),q=p.gw[g]||{fixtures:[],pts:0};
  const isC=S.captain===p.id,isV=S.vice===p.id,fl=S.flagged.includes(p.id);

  const shownPts=hPts(p,g,S.horizon)*(isC?(S.activeChip==="3xc"?3:2):1);
  const col=ptsCol(shownPts/Math.max(1,S.horizon));
  const bg=col[0], fg=col[1], elite=col[2]==="elite";
  const fixTxtHtml=q.fixtures.length?q.fixtures.map(f=>
    `<span style="${f.home?"":"font-style:italic"}">${esc(f.opp)} (${f.home?"H":"A"})</span>`).join(", "):"No fixture";
  let n3="";for(let e=g;e<g+3&&e<=38;e++){const w=p.gw[e];
    if(!w||w.blank){n3+=`<span style="background:var(--ink3);color:var(--mute)">—</span>`;continue;}
    const f=w.fixtures[0],[b,c]=fdrCol(posDiff(p,f));
    n3+=`<span style="background:${b};color:${c};${f.home?"":"font-style:italic"}" title="GW${e} · ${f.home?"home":"away"} · difficulty ${posDiff(p,f)}">${esc(f.opp.slice(0,3))}</span>`;}
  const sub=S.subFrom===p.id;
  /* On the bench the ⇄ button doubles as bench-order control: when no swap is in
     progress it cycles this player's substitute priority; when a pitch player is
     awaiting a partner it receives the substitution. On the pitch it just starts
     a swap as before. */
  const subOnclick=benchSlot?`act(S.subFrom!=null?'sub':'benchcycle',${p.id})`:`act('sub',${p.id})`;
  const subGlyph=benchSlot?(S.subFrom==null?benchSlot:"⇄"):"⇄";
  const subTitle=benchSlot?`Bench ${benchSlot} · tap to change order (or to receive a substitution)`:"Substitute";
  return `<div class="card ${fl?"dim":""}" ${sub?'style="outline:2px solid var(--cyan);outline-offset:2px;border-radius:7px"':""}>
   <div class="kit">${shirtSVG(p.teamName.toUpperCase(),p.pos===1,38)}
    ${p.avail<1?`<span class="dot" style="top:-2px;left:8px;background:${p.avail===0?"var(--red)":"var(--amber)"}" title="${esc(p.news||"Doubt")}"></span>`:""}
    <button class="badge" style="top:-2px;right:2px;background:${fl?"var(--mint)":"var(--ink3)"};color:${fl?"var(--ink)":"var(--cream)"}" onclick="act('flag',${p.id})" title="${fl?"Keep":"Replace"}">✕</button>
    <button class="badge" style="top:-2px;left:2px;background:${sub?"var(--cyan)":"var(--ink3)"};color:${sub?"var(--ink)":"var(--cream)"}" onclick="${subOnclick}" title="${subTitle}">${subGlyph}</button>
    <button class="badge" style="bottom:-2px;left:4px;background:${isC?"var(--cream)":"rgba(0,0,0,.5)"};color:${isC?"var(--ink)":"var(--mute)"}" onclick="act('cap',${p.id})" title="Captain">C</button>
    <button class="badge" style="bottom:-2px;right:4px;background:${isV?"var(--cyan)":"rgba(0,0,0,.5)"};color:${isV?"var(--ink)":"var(--mute)"}" onclick="act('vice',${p.id})" title="Vice-captain">V</button></div>
   <div class="namebar" onclick="act('card',${p.id})"><span class="nm">${esc(p.web_name)}</span>
    <span class="pr">£${p.price.toFixed(1)}${arw(p.priceChange)}</span></div>
   <div class="ptsbar" style="background:${bg};color:${fg}${elite?";box-shadow:0 0 0 2px #EAFFEF, 0 0 12px rgba(125,251,158,.85)":""}">
    <div class="pv">${shownPts.toFixed(1)}</div><div class="fx">${fixTxtHtml}</div></div>
   <div class="next3">${n3}</div>
   <div class="cardsigs">${sigHTML(p,g)}</div></div>`;
}
/* keep any explicit bench order the optimiser set, else best first */
function orderBench(list){
  const g=VG();
  if(S.benchOrder&&S.benchOrder.length){
    const idx={};S.benchOrder.forEach((id,i)=>idx[id]=i);
    return list.slice().sort((a,b)=>(idx[a.id]??99)-(idx[b.id]??99));
  }
  return list.slice().sort((a,b)=>(b.gw[g]?.pts||0)-(a.gw[g]?.pts||0));
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
  const card=p=>{
    const q=p.gw[g]||{fixtures:[],pts:0};
    const isC=C.captain===p.id;
    const[bg,fg]=ptsCol(q.pts*(isC?2:1));
    const f0=q.fixtures[0];
    return `<div class="card">
      <div class="kit">${shirtSVG(p.teamName.toUpperCase(),p.pos===1,38)}
        <button class="badge" style="bottom:-2px;left:4px;background:${isC?"var(--cream)":"rgba(0,0,0,.5)"};color:${isC?"var(--ink)":"var(--mute)"}"
          onclick="act('ccap',${p.id})" title="Captain">C</button>
        <button class="badge" style="top:-2px;left:2px;background:${C.subFrom===p.id?"var(--cyan)":"var(--ink3)"};color:${C.subFrom===p.id?"var(--ink)":"var(--cream)"}"
          onclick="act('csub',${p.id})" title="Substitute">⇄</button>
        <button class="badge" style="top:-2px;right:2px;background:${(C.flagged||[]).includes(p.id)?"var(--mint)":"var(--ink3)"};color:${(C.flagged||[]).includes(p.id)?"var(--ink)":"var(--cream)"}"
          onclick="act('cflag',${p.id})">✕</button></div>
      <div class="namebar" onclick="act('card',${p.id})"><span class="nm">${esc(p.web_name)}</span><span class="pr">£${p.price.toFixed(1)}</span></div>
      <div class="ptsbar" style="background:${bg};color:${fg}"><div class="pv">${(q.pts*(isC?2:1)).toFixed(1)}</div>
        <div class="fx">${f0?`<span style="${f0.home?"":"font-style:italic"}">${esc(f0.opp)} (${f0.home?"H":"A"})</span>`:"No fixture"}</div></div>
      <div class="cardsigs">${sigHTML(p,g)}</div>
    <div class="next3">${(()=>{let h="";for(let e=g;e<g+3&&e<=38;e++){const w2=p.gw[e];
        if(!w2||w2.blank){h+=`<span style="background:var(--ink3);color:var(--mute)">—</span>`;continue;}
        const f=w2.fixtures[0],[b,c]=fdrCol(posDiff(p,f));
        h+=`<span style="background:${b};color:${c};${f.home?"":"font-style:italic"}">${esc(f.opp.slice(0,3))}</span>`;}return h;})()}</div></div>`;
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
          <span style="display:block;font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:var(--mute);font-weight:800">${d.w===1?"This GW":d.w+" GW"}</span>
          <span style="display:block;font-family:'Barlow Condensed';font-weight:800;font-size:22px;line-height:1.1;
            color:${diff>0.05?"var(--mint)":diff<-0.05?"var(--red)":"var(--cream)"}">${diff>0?"+":""}${diff.toFixed(1)}</span>
          <span style="display:block;font-size:10px;color:var(--mute)" class="mono">${d.theirs.toFixed(1)} v ${d.mine.toFixed(1)}</span></span>`;}).join("")}
    </div>
    <div class="pitch">${[1,2,3,4].map(pos=>{const r=xi.filter(p=>p.pos===pos);
      return r.length?`<div class="row">${r.map(card).join("")}</div>`:"";}).join("")}</div>
    <div class="benchbar"><div class="lb">Bench</div><div class="row">${bench.map(card).join("")}</div></div>
    ${(C.flagged||[]).length?`<div class="repl">
      <div style="padding:9px 12px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--cyan);font-weight:700">
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
      club[p.team]=(club[p.team]||0)+1;best+=p.gw[g].pts;budget-=p.price;taken++;}
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
    else if(p.avail<1)risks.push({sev:2,who:p.web_name,what:`doubt · ${Math.round(p.avail*100)}% to play`});
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
    ${cell("caps","Captain",d.caps.length?`${esc(d.caps[0].p.web_name)} ${(d.caps[0].pts*2).toFixed(1)}`:"—",
      d.caps.map(c=>plLine(c.p,(c.pts*2).toFixed(1),"color:var(--mint)")).join("")
      +`<p class="note" style="margin:8px 0 0">Doubled score for GW${g}.</p>`,
      "color:var(--mint)")}
    ${cell("risk","Points at risk",
      `${d.riskPts.toFixed(1)} of ${d.xiPts.toFixed(1)}`,
      d.risky.length?d.risky.map(p=>plLine(p,(p.gw[g]?.pts||0).toFixed(1),
        p.staleRole?"color:var(--amber)":"color:var(--mute)")).join("")
        +`<p class="note" style="margin:8px 0 0">Amber marks a squad place that may have changed hands.</p>`
        :`<p class="note" style="margin:0">Nothing flagged.</p>`,
      d.riskPts/Math.max(1,d.xiPts)>0.25?"color:var(--red)":d.riskPts>0?"color:var(--amber)":"")}
    ${cell("form","Form",byForm.length?`${esc(byForm[0].web_name)} ${byForm[0].form.toFixed(1)}`:"—",
      `<p class="dsub">Best</p>${byForm.slice(0,3).map(p=>plLine(p,p.form.toFixed(1),"color:var(--mint)")).join("")}
       <p class="dsub">Worst</p>${byForm.slice(-3).reverse().map(p=>plLine(p,p.form.toFixed(1),"color:var(--red)")).join("")}`,
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
  const key=S.sqSort||"pos", dir=S.sqDir||"asc";
  const val={
    pos:p=>p.pos*100-(xi.includes(p)?50:0),
    name:p=>p.web_name.toLowerCase(),
    buy:p=>REAL_PRICE[p.web_name]??p.price,
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
    const buy=REAL_PRICE[p.web_name]??p.price;
    const sell=sellPrice(p);
    return `<tr class="${starting?"":"sub"}">
      <td class="nm"><span style="display:flex;align-items:center;gap:8px">
        ${shirtSVG(p.teamName.toUpperCase(),p.pos===1,22)}
        <span style="min-width:0">
          <button class="lname" onclick="act('card',${p.id})">${esc(p.web_name)}</button>
          ${S.captain===p.id?'<span class="tag c">C</span>':""}${S.vice===p.id?'<span class="tag v">V</span>':""}
          ${starting?"":'<span class="tag s">SUB</span>'}
          <span style="display:block;font-size:9.5px;color:var(--mute)">${esc(p.teamName)} · ${POS[p.pos]}</span>
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
      <td style="text-align:right;white-space:nowrap">
        <button class="mini" onclick="act('sub',${p.id})" title="Substitute">⇄</button>
        <button class="mini" onclick="act('cap',${p.id})" title="Captain">C</button>
        <button class="mini" onclick="act('flag',${p.id})" title="Transfer out">✕</button></td></tr>`;}).join("");
  return `<div class="scroll"><table class="sqtable"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}
