/* FPL Signals - app-render.js
   player card, pitch, list, tables, all page markup

   Part of a single script split across files so each stays small enough to
   fetch whole. Loaded in order as classic scripts, sharing one global scope,
   so the order in index.html matters: app-main.js must come last. */
/* ---------- player detail card ---------- */
/* Player card (20 Nov 2026, Andy picked the Dossier): a full-screen pop-up.
   Left, the hero panel: photo on club colour, name, price and tonight's
   change, signals, availability, ownership and rivals, what he cost and sells
   for if he is yours, set pieces. Right: the model's figures and FPL's with
   FPL's own ranks in his position; his last ten scores and the model's next
   five on one timeline with fixture chips; ranks against regular
   starters in his position; season totals. Opens from any name, and from a
   shirt on the Planner pitch. */
/* The player card in a live gameweek (23 Nov 2026, Andy's mock m17b): his
   live points with FPL's own breakdown, how your league holds him, and who
   started or benched him (an auto-sub moves across). Null when no week is
   in play or the live data has not arrived. */
const PKL_LAB={minutes:"Minutes",goals_scored:"Goals",assists:"Assists",clean_sheets:"Clean sheet",goals_conceded:"Goals conceded",saves:"Saves",
  bonus:"Bonus",yellow_cards:"Yellow card",red_cards:"Red card",own_goals:"Own goal",penalties_saved:"Penalty saved",penalties_missed:"Penalty missed",
  defensive_contribution:"DefCon"};
function pkLiveHTML(p){
  const g=typeof liveGW==="function"?liveGW():null;if(g==null)return null;
  const L=lkCalc(g);if(!L||!L.W)return null;
  const W=L.W,lp=W.players[p.id]||{},st=L.status(p.id),team=(S.model.teams||S.teams).find(t=>t.id===p.team);
  const chips=(st.fx||[]).map(f=>{const home=f.h===p.team,oid=home?f.a:f.h,o=(S.model.teams||S.teams).find(t=>t.id===oid);
    return o?fxChip(o.short,home,fdrOf(o,home,team,p.pos<=2?"def":"att"),{cls:"sm"}):"";}).join("");
  const state=st.s==="in"?`${st.min||0}′`:st.s==="dn"||st.s==="dnp"?"FT":st.s==="tp"&&st.ko?esc(new Date(st.ko).toLocaleString("en-GB",{weekday:"short",hour:"2-digit",minute:"2-digit"})):"";
  const sg=v=>`<b class="pkl-p ${v>0?"up":v<0?"dn":"z"}">${v>0?"+":v<0?"−":""}${Math.abs(v)}</b>`;
  let body;
  if(st.s==="bl")body=`<p class="pkl-none">No match this week</p>`;
  else if(st.s==="tp"){const pr=pastPred(p,g);body=`<p class="pkl-none">Not kicked off${pr?` · predicted ${pr.v.toFixed(1)} pts`:""}</p>`;}
  else{
    /* FPL's lines, summed over a double; bonus shows the provisional 3-2-1 until FPL adds it */
    const sum={};(lp.x||[]).forEach(([,ls])=>ls.forEach(([k,v,pt])=>{const s=sum[k]||(sum[k]={v:0,pt:0});s.v+=v;s.pt+=pt;}));
    /* FPL leaves a line out when it scores nothing; saves and DefCon still show, at 0 */
    if((lp.m||0)>0){if(p.pos===1&&!sum.saves&&lp.sv)sum.saves={v:lp.sv,pt:0};
      if(p.pos>1&&!sum.defensive_contribution&&lp.dcn)sum.defensive_contribution={v:lp.dcn,pt:0};}
    const rows=Object.keys(sum).filter(k=>k!=="bonus"&&(sum[k].pt||k==="minutes"||k==="saves"||k==="goals_conceded"||k==="defensive_contribution")).map(k=>
      `<span class="pkl-k">${PKL_LAB[k]||esc(k.replace(/_/g," "))}</span><span class="pkl-v">${k==="minutes"?sum[k].v+"′":sum[k].v}</span>${sg(sum[k].pt)}`);
    const bon=sum.bonus&&sum.bonus.pt?sum.bonus.pt:(L.prov[p.id]||0),conf=!!(sum.bonus&&sum.bonus.pt);
    if((lp.m||0)>0||bon)rows.push(`<span class="pkl-k">Bonus${conf||!bon?"":` <em>provisional</em>`}</span><span class="pkl-v">${lp.bps??0} BPS</span>${sg(bon)}`);
    /* the points are in but FPL's lines are not (an older copy of the week): say so, never a wrong sum */
    body=(lp.m||0)>0&&!(lp.x&&lp.x.length)?`<p class="pkl-none">Points breakdown not in yet</p>`
      :rows.length?`<div class="pkl-x">${rows.join("")}</div>`:`<p class="pkl-none">Did not play</p>`;
  }
  const tot=st.s==="bl"||st.s==="tp"?"–":String(L.pts(p.id));
  const live=`<div class="pkl-card"><div class="pkl-h"><span class="pkl-live"><span class="lp-dot"></span>Live</span><span class="pkl-fx">${chips?`<span class="fxrun">${chips}</span>`:""}${state?`<span class="pkl-min">${state}</span>`:""}</span>
    <span class="pkl-tot"><b>${tot}</b><em>pts</em></span></div>${body}</div>`;
  /* the league: each manager's pick of him, after FPL's auto-subs */
  const started=[],bench=[];let eo=0;
  (L.league||[]).forEach(e=>{const pk=(e.picks||[]).map((k,i)=>({id:k.id,p:L.P(k.id),m:k.multiplier!=null?k.multiplier:(i<11?1:0),i,isC:!!k.isC,isVC:!!k.isVC}));
    const k=pk.find(x=>x.id===p.id);if(!k)return;
    const sb=L.subsFor(pk,e.act==="bboost",0),auto=sb.subs.some(s=>s.inn&&s.inn.id===p.id),out=sb.subs.some(s=>s.out&&s.out.id===p.id);
    const xk=(sb.xi||[]).find(x=>x.id===p.id),m=e.act==="bboost"?k.m:auto?(xk?xk.m:1):out?0:(xk?xk.m:k.m);
    eo+=m;
    const who={name:e.mine?"You":e.name,mgr:e.manager||"",mine:e.mine,c:m>=2,tc:m>=3,auto,slot:out?"off":k.i===11?"GK":String(k.i-11)};
    (m>0?started:bench).push(who);});
  const n=L.nLg||0,av=w=>esc(String(w.mgr||w.name||"?").trim().split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase());
  started.sort((a,b)=>b.mine-a.mine);
  const rowB=(w,tag)=>`<div class="pkl-br${w.mine?" me":""}${tag?" bn":""}"><span class="pkl-av">${av(w)}</span><span class="pkl-bn"><b>${esc(w.name)}</b>${w.mgr?`<em>${esc(w.mgr)}</em>`:""}</span>${w.auto?`<span class="pkl-bs">Auto-sub</span>`:""}${tag?`<span class="pkl-bs">${tag}</span>`:""}${w.c?`<span class="pkl-c">${w.tc?"TC":"C"}</span>`:""}</div>`;
  const kv=`<div class="pkkv pkl-kv"><div><span>Started</span><b>${n?`${started.length} of ${n}`:"–"}</b><em>of your league</em></div>
    <div><span>League EO</span><b>${n?Math.round(eo/n*100)+"%":"–"}</b><em>with captaincy</em></div>
    <div><span>Selected by</span><b>${(+p.owned||0).toFixed(1)}%</b><em>overall</em></div></div>`;
  const by=n?`<div class="pkl-by"><div class="pkl-byh"><span>Started By</span><b>${started.length}</b></div>${started.map(w=>rowB(w)).join("")||`<p class="pkl-none">Nobody in your league</p>`}
    <div class="pkl-byh sub"><span>On The Bench</span><b>${bench.length}</b></div>${bench.map(w=>rowB(w,w.slot==="off"?"Subbed off":w.slot==="GK"?"Bench GK":"Bench "+w.slot)).join("")||`<p class="pkl-none">Nobody benched him</p>`}</div>`:"";
  return live+kv+by;
}
/* Next Match Odds on the player card (26 Nov 2026, Andy approved mock):
   the bookmakers' goal, assist, clean-sheet and booking chances for his next
   match, the model's figure under each; shown once anything is priced */
/* Next Match Odds (28 Nov 2026, Andy approved the mock): five columns,
   each the bookmakers' chance as a bar with our model's as a white line and
   the gap in a box; a market not priced yet is hatched. The match is his next
   one not kicked off: during a live week that can be this week's. */
function pkNextMatch(p){
  const lg=typeof liveGW==="function"?liveGW():null,now=Date.now();
  if(lg){const fx=(S.model.byEv[lg]||[]).filter(f=>f.ht&&f.at&&(f.ht.id===p.team||f.at.id===p.team)&&f.kickoff&&Date.parse(f.kickoff)>now);
    if(fx.length){const f=fx[0],home=f.ht.id===p.team;return{g:lg,live:true,home,opp:(home?f.at:f.ht).short,oppT:home?f.at:f.ht,ko:f.kickoff,xgf:null};}}
  const g=S.model.next.id,f=((p.gw[g]||{}).fixtures||[])[0];if(!f)return null;
  const fx=(S.model.byEv[g]||[]).find(x=>x.ht&&x.at&&(x.ht.id===p.team||x.at.id===p.team));
  return{g,live:false,home:f.home,opp:f.opp,oppT:fx?(fx.ht.id===p.team?fx.at:fx.ht):null,ko:fx?fx.kickoff:null,xgf:f.xgf};
}
function pkOddsHTML(p){
  if(!S.model||S.oddsState!=="ok")return "";
  const M=pkNextMatch(p);if(!M)return "";const g=M.g;
  let r={},cs=null,haul=null;try{r=(oddsPlayers(g)||{})[p.id]||{};cs=(marketCS(g)||{})[p.team]??null;haul=(marketHaul(g)||{})[p.team]??null;}catch(e){}
  const goal=r.goal??null,ast=r.assist??null,card=r.card??null;
  if(goal==null&&ast==null&&cs==null&&card==null&&haul==null)return "";
  /* the model's own: his per-90 chances; clean sheet and 3+ goals from his
     team's expected goals in the fixture (next week only: the live week's
     fixture has no model line) */
  const lam=M.xgf||0,mHaul=M.xgf!=null?1-Math.exp(-lam)*(1+lam+lam*lam/2):null;
  const mCS=M.live?null:(()=>{try{return modelCS(p);}catch(e){return null;}})();
  const br=banRisk(p,g);
  const cols=[["Goal",p.pos===1?null:goal,p.pos===1?null:modelChance(p,p.xg90||0),"#3DDC97",p.pos===1],["Assist",ast,modelChance(p,p.xa90||0),"#3DDC97"],
    ["Clean sheet",cs,mCS,"#3DDC97"],["Booked",card,null,"#FACC15",false,br],["3+ goals",haul,mHaul,"#FF8A3D"]];
  const top=Math.max(.3,...cols.flatMap(c=>[c[1],c[2]]).filter(v=>v!=null))*1.12;
  const pc=v=>Math.round(v*100);
  const col=([k,v,m,c,skip,ban])=>{
    if(skip)return `<div class="oc-x"><b class="np">–</b><div class="oc-c np"></div><em>${k}</em><span class="od-e eq">n/a</span></div>`;
    /* an injured or suspended player is simply not priced */
    if(v==null)return (p.avail??1)<0.25?`<div class="oc-x" title="${k}: not priced, he is out (${esc(p.news||"unavailable")})"><b class="np">–</b><div class="oc-c np"></div><em>${k}</em><span class="od-e dn">out</span></div>`
      :`<div class="oc-x" title="${k}: the bookmaker has not priced this yet"><b class="np">–</b><div class="oc-c np"></div><em>${k}</em><span class="od-e eq">not yet</span></div>`;
    const d=m==null?null:pc(v)-pc(m),t=`${k}: bookmakers ${pc(v)}%${m!=null?`, our model ${pc(m)}%`:""}${ban?` · ${ban.tip}`:""}`;
    return `<div class="oc-x" title="${esc(t)}"><b>${pc(v)}%</b><div class="oc-c" style="--c:${c}"><i style="height:${Math.min(100,v/top*100)}%"></i>${m!=null?`<u style="bottom:${Math.min(100,m/top*100)}%"></u>`:""}</div><em>${k}</em>`
      +(ban?`<span class="od-e dn">ban risk</span>`:d==null?`<span class="od-e eq">–</span>`:`<span class="od-e ${d>=2?"up":d<=-2?"dn":"eq"}">${d>0?"+":d<0?"−":""}${Math.abs(d)}</span>`)+`</div>`;};
  const chip=M.oppT?fxChip(M.opp,M.home,fdrOf(M.oppT,M.home,(S.model.teams||S.teams).find(t=>t.id===p.team),p.pos<=2?"def":"att"),{cls:"sm"}):`<span class="ds-sub">${M.home?"v":"@"} ${esc(M.opp)}</span>`;
  const book=esc((S.oddsBooks||[]).filter(b=>!/william/i.test(b))[0]||"bookmakers");
  return `<div class="oc-h"><b>Next Match Odds</b><span class="fci" data-tip="Bar: the bookmakers' chance. White line: our model's. Box: the gap.">i</span>${fxRun(chip)}<span class="ds-sub">${M.ko?esc(lkKo(M.ko))+" · ":""}${book}</span></div>
    <div class="oc">${cols.map(col).join("")}</div>`;
}
/* This Season (28 Nov 2026, Andy approved the mock): the points headline,
   attack as actual against expected, and a block per gameweek for starts,
   clean sheets and DefCon hits (goalkeepers: 3+ saves; midfielders and
   forwards: goal or assist instead of clean sheets) */
function pkSeasonHTML(p,s,G,opp){
  const n=x=>+x||0,rows=((S.hist||{})[p.code]||[]).filter(r=>r.tag==="now");
  const tot=n(s.total_points??p.total),starts=n(s.starts),mins=n(s.minutes);
  const same=S.model.players.filter(x=>x.pos===p.pos),rank=1+same.filter(x=>n(x.total)>tot).length;
  const apps=rows.filter(r=>n(r.mins)>0).length||null;
  const posS=["","GK","DEF","MID","FWD"][p.pos];
  const kv=(l,v)=>`<div><em>${l}</em><b>${v}</b></div>`;
  const top=`<div class="ms-top"><div class="ms-big">${tot}<small>FPL points</small></div><div class="ms-ts">${kv("Per start",starts?(tot/starts).toFixed(1):"–")}${kv(`Rank (${posS})`,"#"+rank)}${kv("Bonus",n(s.bonus))}${p.pos<=2?kv("BPS",n(s.bps)):kv("Clean sheets",n(s.clean_sheets))}</div></div>`;
  /* actual against expected: one scale for both rows */
  const xr=(lbl,act,exp,c,lowGood)=>{const d=act-exp,good=lowGood?d<0:d>0,M=Math.max(1,act,exp)*1.2;
    return `<div class="ms-xr"><span><b>${act}</b>${lbl}</span><div class="ms-bar" style="--c:${c}"><i style="width:${act/M*100}%"></i><u data-l="${lowGood?"xGC":lbl==="Goals"?"xG":"xA"} ${exp.toFixed(1)}" style="left:${exp/M*100}%"></u></div><span class="ms-d ${Math.abs(d)<0.05?"":good?"up":"dn"}">${d>0?"+":d<0?"−":""}${Math.abs(d).toFixed(1)}<em>vs ${lowGood?"xGC":lbl==="Goals"?"xG":"xA"}</em></span></div>`;};
  const attack=p.pos===1
    ?`<div class="ms-sec">Defence · actual vs expected</div>${xr("Conceded",n(s.goals_conceded),n(s.expected_goals_conceded),"#FF8A3D",true)}<div class="ms-xr"><span><b>${n(s.saves)}</b>Saves</span><div class="ms-bar" style="--c:#60A5FA"><i style="width:${Math.min(100,n(s.saves_per_90)/5*100)}%"></i></div><span class="ms-d">${n(s.saves_per_90).toFixed(1)}<em>per 90</em></span></div>`
    :`<div class="ms-sec">Attack · actual vs expected</div>${xr("Goals",n(s.goals_scored),n(s.expected_goals),"#3DDC97")}${xr("Assists",n(s.assists),n(s.expected_assists),"#60A5FA")}`;
  /* a block per gameweek: none where his team had no match */
  const weeks=[];for(let e=1;e<G;e++){const ms=rows.filter(r=>r.gw===e);weeks.push({e,fx:!!opp(e)||ms.length>0,ms});}
  const sm=(w,k)=>w.ms.reduce((a,r)=>a+n(r[k]),0);
  const dcT=lkDcT(p.pos);
  const pips=f=>`<div class="ms-pips" style="grid-template-columns:repeat(${weeks.length},1fr)">${weeks.map(w=>`<i class="${f(w)}" title="GW${w.e}"></i>`).join("")}</div>`;
  const played=w=>sm(w,"mins")>0;
  const pr=(lbl,sub,c,f,cnt,of)=>`<div class="ms-pr" style="--c:${c}"><span>${lbl}${sub?`<small>${sub}</small>`:""}</span>${pips(f)}<b>${cnt}<small>/${of}</small></b></div>`;
  const csW=w=>w.ms.some(r=>n(r.mins)>=60&&!n(r.tgc));
  const retW=w=>sm(w,"g")+sm(w,"a")>0;
  const dcW=w=>dcT&&w.ms.some(r=>n(r.dc)>=dcT);
  const svW=w=>w.ms.some(r=>n(r.sv)>=3);
  const gws=weeks.filter(w=>w.fx).length,ap=weeks.filter(played);
  const second=p.pos<=2?["Clean sheets","#A78BFA",csW]:["Goal or assist","#3DDC97",retW];
  const third=p.pos===1?["3+ saves","#60A5FA",svW]:["DefCon hits","#F5B33C",dcW];
  const out=(f)=>w=>!w.fx?"na":!played(w)?"":f(w)?"on":"";
  const week=`<div class="ms-sec">Week by week · GW1–${G-1}</div>
    ${pr("Starts",apps?`${Math.round(mins/apps)}′ a game`:"","#3DDC97",w=>!w.fx?"na":sm(w,"mins")>=60?"on":sm(w,"mins")>0?"half":"",starts,gws)}
    ${pr(second[0],"",second[1],out(second[2]),ap.filter(second[2]).length,ap.length)}
    ${pr(third[0],"",third[1],out(third[2]),ap.filter(third[2]).length,ap.length)}`;
  return `<div class="pkh">This Season<span>GW1–${G-1}</span></div>${top}${attack}${week}`;
}
/* Against Other <position> (28 Nov 2026): a summary of where he stands out,
   then each stat as a dot on a red-to-green track with its rank */
function pkAgainstHTML(p,posN){
  const keys=(CP_SETS[p.pos]||CP_SETS[0]).filter(k=>!/mk$/.test(k));
  const rows=keys.map(k=>({k,r:cpPr(k,p),v:cpVal(k,p)}));
  const pool=rows.find(x=>x.r)?.r.of;
  const hi=rows.filter(x=>x.r&&x.r.pct>=90).map(x=>CP_ST[x.k][0]),lo=rows.filter(x=>x.r&&x.r.pct<20).map(x=>CP_ST[x.k][0]);
  const col=x=>x>=90?"#3DDC97":x>=70?"#9BE7C4":x>=40?"#8A8A8A":"#FF5A6E";
  const sum=(hi.length||lo.length)?`<div class="ag-sum">${hi.length?`<span title="Top 10%: ${esc(hi.join(", "))}">Top 10%: ${esc(hi.join(" · "))}</span>`:""}${lo.length?`<span class="lo" title="Bottom 20%: ${esc(lo.join(", "))}">Bottom 20%: ${esc(lo.join(" · "))}</span>`:""}</div>`:"";
  return `<div class="pkh">Against Other ${posN}s<span>${pool?pool+" starters · ":""}rank, 1 is best</span></div>${sum}
    ${rows.map(({k,r,v})=>`<div class="ag-r"><span title="${esc(CP_ST[k][1])}">${CP_ST[k][0]}</span><div class="ag-t">${r?`<i style="left:${Math.max(3,Math.min(97,r.pct))}%;--c:${col(r.pct)}"></i>`:""}</div><b>${v==null?"–":CP_ST[k][2](v)}</b><span class="ag-k${r&&r.pct>=90?" t":r&&r.pct<20?" b":""}">${r?"#"+r.rank:"–"}</span></div>`).join("")}`;
}
function playerCardHTML(){
  const p=S.model.players.find(x=>x.id===S.cardId);
  if(!p)return "";
  const G=S.model.next.id,s=(S.players.find(x=>x.id===p.id)||{}).stats||{};
  const n=S.model.players.filter(x=>x.pos===p.pos).length,rk=r=>r?`${r} of ${n}`:"";
  const posN=["","Goalkeeper","Defender","Midfielder","Forward"][p.pos];
  const kit=(KITS[p.teamName]||KITS._d||{b:"#444"}).b;
  const pu=purchaseOf(p),owns=(S.squad||[]).includes(p.id),sell=sellPrice(p);
  const l=(typeof fplLive==="function"?fplLive(p):null)||{},pc=l.pcp;
  const R=rivalOwn(),rv=R&&R.n?(R.own[p.id]||0):null;
  const A=S.playerActuals||{},act=A[p.id]||A[String(p.id)]||{},pts=e=>{const v=act[e]??act[String(e)];return v==null?null:+v;};
  const team=(S.model.teams||S.teams).find(t=>t.id===p.team);
  const opp=e=>{const f=(S.model.byEv[e]||[]).find(f=>f.ht===team||f.at===team);return f?(f.ht===team?f.at:f.ht):null;};
  const sp=setPieceText(p);
  const pcTxt=pc==null?"":`<span class="pkpc" style="color:${pc>0?"var(--mint)":pc<0?"#FF8FAB":"#BDBDBD"}">${pc>0?"▲":pc<0?"▼":""} ${Math.abs(Math.round(pc))}% to a ${pc>=0?"rise":"fall"} tonight</span>`;
  const lvH=pkLiveHTML(p),heroK=pkTone(kit);
  /* Spotlight (28 Nov 2026, Andy picked A with B's name behind): the surname
     twice in outline behind the photo */
  const wmN=esc(s.second_name||p.web_name),pkWm=`<span class="pkwm" aria-hidden="true">${wmN}<i>${wmN}</i></span>`;
  const hero=lvH?`<div class="pkhero pklh" style="--k:${heroK}">
    ${pkWm}<div class="pkpos">${posN} · ${esc(p.teamFull||p.teamName)}</div>
    <div class="pknm"><div class="pkfirst">${esc(s.first_name||p.first||"")}</div><div class="pklast">${esc(s.second_name||p.web_name)}</div></div>
    <span class="pkph"><img alt="" src="${imgSrc("player",p.code)}" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="pkfb" style="display:none">${shirtSVG(p.teamName.toUpperCase(),p.pos===1,120)}</span></span>
    <div class="pkpr"><span class="pkprice">£${p.price.toFixed(1)}m</span>${pcTxt}</div>
    ${lvH}</div>`:`<div class="pkhero" style="--k:${heroK}">
    ${pkWm}<div class="pkpos">${posN} · ${esc(p.teamFull||p.teamName)}</div>
    <div class="pknm"><div class="pkfirst">${esc(s.first_name||p.first||"")}</div><div class="pklast">${esc(s.second_name||p.web_name)}</div></div>
    <span class="pkph"><img alt="" src="${imgSrc("player",p.code)}" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="pkfb" style="display:none">${shirtSVG(p.teamName.toUpperCase(),p.pos===1,120)}</span></span>
    <div class="pkpr"><span class="pkprice">£${p.price.toFixed(1)}m</span>${pcTxt}</div>
    ${sigHTML(p,G)?`<div>${sigHTML(p,G)}</div>`:""}
    ${p.avail<1?`<div class="pkwarn" title="${esc(flagTitle(p))}">${esc(p.news||"Fitness doubt")}${p.back?` · back ${esc(p.back)}`:""}${p.availAssumed?` · 50% to play${availTag(p)}`:""}${(flagNow(p)||{}).since?` · since ${esc(flagDay(flagNow(p).since))}`:""}</div>`:""}
    <div class="pkkv">
      <div><span>Selected by</span><b>${(+s.selected_by_percent||p.owned).toFixed(1)}%</b><em>${rk(s.selected_rank_type)}</em></div>
      <div><span>Your rivals</span><b>${rv!=null?`${rv} of ${R.n}`:"–"}</b><em>own him</em></div>
      ${owns?`<div><span>Bought</span><b>£${pu.paid.toFixed(1)}${pu.est?srcTag("est.","Estimated as the season-start price: the feed has not published what you paid."):""}</b><em>your price</em></div>
      <div><span>Sells for</span><b style="color:${sell>pu.paid?"var(--mint)":sell<pu.paid?"#FF8FAB":"inherit"}">£${sell.toFixed(1)}</b><em>if sold now</em></div>`:""}
      <div class="wide"><span>Set pieces</span><b class="txt">${esc(sp||"None")}</b></div>
    </div></div>`;
  const tile=(l2,v,e2,m)=>`<div class="pktile"><span>${l2}</span><b${m?' class="mdl"':""}>${v}</b><em>${e2||"&nbsp;"}</em></div>`;
  const tiles=tile(`xPts GW${G}–${Math.min(38,G+4)}`,hPts(p,G,5).toFixed(1),"model",1)+tile("xMins",Math.round(p.xMins||0)+"′"+minsTag(p),"model",1)
    +tile("Form",(+s.form||p.form||0).toFixed(1)+formTag(p),rk(s.form_rank_type))+tile("Pts / Match",s.points_per_game??p.ppg,rk(s.points_per_game_rank_type))
    +tile("Total Pts",s.total_points??p.total,`bonus ${s.bonus??p.bonus}`)+tile("ICT Index",s.ict_index??p.ict,rk(s.ict_index_rank_type));
  /* last ten played and the model's next five */
  const past=[],fut=[];
  for(let e=Math.max(1,G-10);e<G;e++)past.push({e,o:opp(e),v:pts(e)});
  for(let e=G;e<G+5&&e<=38;e++)fut.push({e,v:hPts(p,e,1)});
  const mx=Math.max(8,...past.map(x=>x.v||0),...fut.map(x=>x.v));
  const pc2=v=>v==null?"#1C1C1C":v>=10?"#2BD47D":v>=6?"#1E7A4D":v>=3?"#3A3A3A":"#4A1F2B";
  const tl=past.map(x=>`<div class="c"><span class="bw"><span class="v">${x.v??"–"}</span><span class="b" style="height:${Math.max(2,100*(x.v||0)/mx)}%;background:${pc2(x.v)}"></span></span><span class="lab">${x.o?esc(x.o.short):"–"}</span><span class="lab">GW${x.e}</span></div>`).join("")
    +fut.map(x=>`<div class="c pred"><span class="bw"><span class="v">${x.v.toFixed(1)}</span><span class="b" style="height:${Math.max(2,100*x.v/mx)}%"></span></span><span class="sm">${fxGW(p,x.e)}</span><span class="lab">GW${x.e}</span></div>`).join("");
  /* every gameweek played this season, latest first (a double sums its two matches) */
  const hrows=[];
  for(let e=G-1;e>=1;e--){const ms=((S.hist||{})[p.code]||[]).filter(r=>r.tag==="now"&&r.gw===e),o=opp(e),v=pts(e);
    if(!ms.length&&v==null&&!o)continue;
    /* D6 (Bundle D): the fixture strip, never text */
    const fxs=(S.model.byEv[e]||[]).filter(f=>f.ht===team||f.at===team),fx=fxs.length?fxRun(fxs.map(f=>{const home=f.ht===team,o=home?f.at:f.ht;return fxChip(o.short,home,fdrOf(o,home,team,p.pos<=2?"def":"att"),{cls:"sm"});}).join("")):"";
    const sm=k=>ms.reduce((a,r)=>a+(+r[k]||0),0),mins=sm("mins");
    const third=p.pos===1?["Saves",sm("sv")]:p.pos===2?["CS",mins>=60&&ms.length&&ms.every(r=>!(+r.tgc))?1:0]:["SoT",sm("sot")];
    hrows.push({e,fx:fx||"–",v,mins,g:sm("g"),a:sm("a"),xg:sm("xg"),xa:sm("xa"),t:third,dc:sm("dc")});}
  const third=hrows[0]?hrows[0].t[0]:(p.pos===1?"Saves":p.pos===2?"CS":"SoT");
  const hist=`<div class="pkpanel pkhistw"><div class="pkh">Game History</div><div class="pkhs"><table class="pkhist"><thead><tr><th>GW</th><th>Opponent</th><th>Pts</th><th>Mins</th><th>G</th><th>A</th><th>xG</th><th>xA</th><th>${third}</th><th>DefCon</th></tr></thead><tbody>${
    hrows.map(r=>`<tr><td>GW${r.e}</td><td>${r.fx}</td><td class="pp" style="color:${r.v==null?"#5A5A5A":r.v>=10?"var(--mint)":r.v>=6?"#9BE7C4":r.v<3?"#FF8FAB":"#E4E4E4"}">${r.v??"–"}</td><td>${r.mins||"–"}</td><td>${r.g}</td><td>${r.a}</td><td>${r.xg.toFixed(2)}</td><td>${r.xa.toFixed(2)}</td><td>${r.t[1]}</td><td>${r.dc}</td></tr>`).join("")
    ||'<tr><td colspan="10" style="text-align:left;color:#6E6E6E">No league matches yet this season.</td></tr>'}</tbody></table></div></div>`;
  const body=`<div class="pk2">${hero}<div class="pkright">
    <div class="pktiles">${tiles}</div>
    <div class="pkpanel pktlw"><div class="pkh">Points: Last ${past.length} Played, Next ${fut.length} Predicted<span>bars coloured by points · striped = predicted · chips = difficulty for him</span></div><div class="pktl" style="grid-template-columns:repeat(${past.length+fut.length},minmax(0,1fr))">${tl}</div></div>
    <div class="pkrow3"><div class="pkpanel pkag">${pkAgainstHTML(p,posN)}${pkOddsHTML(p)}</div>
      <div class="pkpanel pkse">${pkSeasonHTML(p,s,G,opp)}</div>${hist}</div>
  </div></div>`;
  /* News tab (22 Nov 2026): the flag, his chance of starting, the one flag
     log, minutes by gameweek, and every story and post naming him */
  const pStories=pkStories(p),flagged=p.avail<1;
  const tabs=`<span class="hz pk-tabs"><button class="${S.cardTab!=="news"?"on":""}" onclick="act('cardtab','overview')">Overview</button><button class="${S.cardTab==="news"?"on":""}" onclick="act('cardtab','news')">News${pStories.length||flagged?` <i class="${flagged?"pk-wn":""}">${pStories.length}</i>`:""}</button></span>`;
  const out=S.cardTab==="news"?`<div class="pk2">${hero}<div class="pkright">${pkNewsHTML(p,pStories)}</div></div>`:body;
  return modalHTML(`${esc(p.web_name)} · ${esc(p.teamName)}`,out,{wide:true,close:"card",cls:"pkcard",ctl:tabs});
}
/* every story naming him: the feeds, the squad's searches and his own */
function pkStories(p){
  const seen=new Set(),out=[];
  [...(S.news||[]),...(S.squadNews||[]),...((S.pNews||{})[p.id]||[])].forEach(n=>{
    if(!(n.ids||[]).includes(p.id))return;const k=newsKey(n.title);if(seen.has(k))return;seen.add(k);out.push(n);});
  /* newest first (Andy, 22 Nov 2026); the category chips filter */
  return out.sort((a,b)=>b.time-a.time);
}
function pkNewsHTML(p,stories){
  const f=flagNow(p),c=Math.round((p.avail==null?1:p.avail)*100),sc=startChance(p);
  const l=(typeof fplLive==="function"?fplLive(p):null)||{},pc=l.pcp;
  const inj=stories.filter(n=>n.cat==="inj").length;
  const ct=(l2,v,e2,col)=>`<div class="pktile"><span>${l2}</span><b${col?` style="color:${col}"`:""}>${v}</b><em>${e2||"&nbsp;"}</em></div>`;
  const tiles=ct("FPL Chance",c+"%",f&&f.since?(f.cleared?"fit since ":"since ")+flagDay(f.since):(c<100?"flag before the log":"no flag"),chCol(c))
    +ct("Start Chance",sc+"%","last six, × FPL chance",sc<60?"#FF9F2E":"#9FD9BE")
    +ct("Expected Back",p.avail<1?(p.back&&p.back!=="unknown"?esc(nwBack(p.back).replace("Back ","")):"–"):"Fit",p.avail<1?(p.back==="unknown"?"FPL: unknown":p.back?"from FPL":"no date from FPL"):"&nbsp;")
    +ct("xMins",Math.round(p.xMins||0)+"′",p.avail<1&&p.roleMins!=null?`was ${Math.round(p.roleMins)}′ before the flag`:"model")
    +ct("Stories",String(stories.length),inj?`${inj} injury`:"this week")
    +ct("Price",`£${p.price.toFixed(1)}m`,pc==null?"&nbsp;":`${Math.abs(Math.round(pc))}% to a ${pc>=0?"rise":"fall"} tonight`,pc>0?"var(--mint)":pc<0?"#FF8FAB":null);
  const cat=S.pkCat||"all",cats=[["all","All"],...Object.entries(NW_CAT).filter(([k])=>stories.some(n=>n.cat===k)).map(([k,v])=>[k,v[0]])];
  const shown=stories.filter(n=>cat==="all"||n.cat===cat).slice(0,12);
  const soc=(S.social||[]).filter(n=>(n.ids||[]).includes(p.id)).slice(0,6);
  return `<div class="pktiles">${tiles}</div>
    <div class="pk-nrow"><div class="pkpanel"><div class="pkh">Flag History<span>FPL's changes, newest first</span></div>${flagHistoryHTML(p,4)}</div>
      <div class="pkpanel"><div class="pkh">Availability This Season<span>minutes · bar = FPL chance at the deadline</span></div>${availStripHTML(p)}</div></div>
    <div class="pk-nrow b"><div class="pkpanel pk-nst"><div class="pkh">Stories<span class="nw-cat">${cats.map(([k,l2])=>`<button class="${cat===k?"on":""}" onclick="act('pkcat','${k}')">${l2}${k==="all"?" "+stories.length:" "+stories.filter(n=>n.cat===k).length}</button>`).join("")}</span></div>
        <div class="pk-nsl">${shown.length?shown.map(n=>`<a class="pk-ns" href="${esc(safeUrl(n.url))}" target="_blank" rel="noopener">${nwTag(n.cat)}<b>${esc(n.title)}</b>${n.sum?`<span>${esc(n.sum)}</span>`:""}<small>${nwSrc(n)}</small></a>`).join(""):sgEmpty(S.newsState==="loading"?"Reading the feeds…":"No stories name him this week.")}</div></div>
      <div class="pkpanel"><div class="pkh">Social Media<span>this week</span></div><div class="pk-nsl">${soc.length?soc.map(nwSoRow).join(""):sgEmpty("No posts name him this week.")}</div></div></div>`;
}

/* ============================================================
   TEAM PLANNER (21 Nov 2026, Andy's round-4 mock-up). A stats strip
   (team, Overall and GW rank, Team Rating, squad value, bank), a gameweek
   scroller in the Planner head, the pitch with FPL's own kits and the
   official badge places (left: transfer, armband, season Dream Team star;
   right: ownership, injury), predicted points, the next five fixtures
   (this week's bar white) and the signal icons; the bench as a band; a
   right-click menu (long press on a phone); chip buttons. Classes pz-.
   ============================================================ */
const POSL={1:"GKP",2:"DEF",3:"MID",4:"FWD"};
const inDT=p=>((typeof fplLive==="function"&&fplLive(p))||{}).idt===1;
const teamCodeOf=p=>((S.teams||[]).find(t=>t.id===p.team)||{}).code;
/* FPL's kit picture through the server's image cache, the drawn shirt if
   it will not load */
function kitHTML(p,cls){
  const c=teamCodeOf(p),fb=shirtSVG(p.teamName.toUpperCase(),p.pos===1,46);
  return c==null?fb:`<img class="${cls}" alt="" src="${imgSrc(p.pos===1?"shirtgk":"shirt",c)}" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-block'"><span class="pz-kfb" style="display:none">${fb}</span>`;
}
function kitSm(p,h){const c=teamCodeOf(p),fb=shirtSVG(p.teamName.toUpperCase(),p.pos===1,h);
  return c==null?fb:`<span class="kitsm" style="--kh:${h}px"><img alt="" src="${imgSrc(p.pos===1?"shirtgk":"shirt",c)}" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-block'"><span style="display:none">${fb}</span></span>`;}
const photoHTML=(p,cls)=>`<img class="${cls}" alt="" src="${imgSrc("player",p.code,110)}" onerror="this.style.visibility='hidden'">`;
const dtStar=(cls,sz)=>`<span class="${cls}" title="In FPL's season Dream Team">${lic("star",sz||10)}</span>`;

/* ---------- This Week design parts (22 Nov 2026) ----------
   One set of parts for every This Week pop-up, header pop-up and the live
   Planner: words in Geist, figures in Geist Mono; one tile (label, figure,
   sub-line, one height); one section header (icon, title, controls right);
   chips as four fixed slots that never wrap; a face (photo, else kit) and a
   club badge wherever a player or club appears. Classes are ds-. */
const DS_CHIPS=[["wildcard","WC"],["freehit","FH"],["bboost","BB"],["3xc","TC"]];
const dsTile=(label,fig,sub,tone)=>`<div class="ds-tile${tone?" "+tone:""}"><em>${label}</em><b>${fig}</b>${sub!=null&&sub!==""?`<i>${sub}</i>`:""}</div>`;
const dsHead=(icon,title,right)=>`<div class="ds-sh">${lic(icon,15)}<h3>${title}</h3>${right?`<span class="ds-shr">${right}</span>`:""}</div>`;
const dsFig=(v,tone)=>`<b class="ds-fig${tone?" "+tone:""}">${v}</b>`;
/* used: chip keys played; active: the key playing this week */
const dsChips=(used,active)=>`<span class="ds-chips">${DS_CHIPS.map(([k,s])=>{const u=CHIP_UI[k];
  return `<span class="ds-chip${used.includes(k)?" on":""}${active===k?" act":""}" style="--tc:${u.c}" title="${u.n}${active===k?" · this week":used.includes(k)?" · used":" · not used"}">${s}</span>`;}).join("")}</span>`;
/* a face: the player's photo, his kit when the photo fails; opens the card */
const dsFace=(p,cls)=>p?`<span class="ds-face ${cls||""}" onclick="event.stopPropagation();act('card',${p.id})" title="${esc(p.web_name)}: player card"><img alt="" src="${imgSrc("player",p.code,110)}" onerror="this.onerror=null;this.parentNode.classList.add('kit');this.src='${imgSrc(p.pos===1?"shirtgk":"shirt",teamCodeOf(p))}'"></span>`:"";
const dsBadge=(t,size)=>t?badgeOrShirt(t,size||24):"";
/* The 1 / 3 / 5 / ROS switch every This Week pop-up shares (ROS is the
   rest of the season). off: options greyed out on that pop-up. */
const HZ4=[1,3,5,"ROS"];
function hz4HTML(cur,action,off){off=off||[];
  return `<span class="hz ds-hz" role="group" aria-label="Horizon">${HZ4.map(h=>`<button class="${String(cur)===String(h)?"on":""}${off.includes(h)?" off":""}" ${off.includes(h)?"disabled":`onclick="act('${action}','${h}')"`}>${h==="ROS"?"ROS":h+" GW"}</button>`).join("")}</span>`;}
/* the number of gameweeks a horizon covers from gameweek g */
const hzWeeks=(h,g)=>h==="ROS"?Math.max(1,39-g):Math.max(1,+h||1);
/* Last three gameweeks actual, next three predicted, for one or two
   players: solid bars actual, dashed predicted; two players show the
   difference over each pair. */
function lastNextHTML(players,o){o=o||{};
  const G=VG(),A=S.playerActuals||{},cols=o.colors||["#FF5A6E","#3DDC97"];
  const act=(p,e)=>{const a=A[p.id]||A[String(p.id)]||{};const v=a[e]??a[String(e)];return v==null?0:+v;};
  const ser=players.map((p,i)=>({p,c:players.length===1?(o.color||"#FFB020"):cols[i],act:[G-3,G-2,G-1].map(e=>e>=1?act(p,e):0),pred:[G,G+1,G+2].map(e=>e<=38?hPts(p,e,1):0)}));
  const all=ser.flatMap(s=>[...s.act,...s.pred]),top=Math.max(8,Math.ceil(Math.max(...all)/4)*4);
  const Wd=o.w||700,H=o.h||230,pl=30,pb=22,pt=18,slot=(Wd-pl-6)/6,y=v=>pt+(H-pt-pb)*(1-v/top),n=ser.length,bw=Math.min(34,(slot-18)/n);
  let g="";
  for(let v=0;v<=top;v+=top/4)g+=`<line class="cgrid" x1="${pl}" x2="${Wd-6}" y1="${y(v)}" y2="${y(v)}"/><text class="cax" x="${pl-6}" y="${y(v)+4}" text-anchor="end">${+v.toFixed(1)}</text>`;
  g+=`<rect x="${pl+slot*3+2}" y="${pt-14}" width="${slot*3-4}" height="${H-pt-pb+14}" rx="8" fill="rgba(255,255,255,.025)"/><line x1="${pl+slot*3}" x2="${pl+slot*3}" y1="${pt-14}" y2="${H-pb}" stroke="#3A3A3A" stroke-dasharray="3 4"/>`;
  g+=`<text class="ds-ck" x="${pl+slot*1.5}" y="${pt-4}" text-anchor="middle">Actual</text><text class="ds-ck" x="${pl+slot*4.5}" y="${pt-4}" text-anchor="middle">Predicted</text>`;
  [G-3,G-2,G-1,G,G+1,G+2].forEach((w,k)=>{const x0=pl+slot*k,pred=k>=3,x1=x0+(slot-bw*n-4*(n-1))/2;
    ser.forEach((s,j)=>{const v=pred?s.pred[k-3]:s.act[k],x=x1+j*(bw+4);
      g+=pred?`<rect x="${x}" y="${y(v)}" width="${bw}" height="${y(0)-y(v)}" rx="4" fill="${s.c}" fill-opacity=".28" stroke="${s.c}" stroke-width="1.5" stroke-dasharray="4 3"/>`
        :`<rect x="${x}" y="${y(v)}" width="${bw}" height="${y(0)-y(v)}" rx="4" fill="${s.c}"/>`;
      if(n===1)g+=`<text x="${x+bw/2}" y="${y(v)-5}" text-anchor="middle" class="ds-cv">${pred?v.toFixed(1):v}</text>`;});
    if(n===2){const d=pred?ser[1].pred[k-3]-ser[0].pred[k-3]:ser[1].act[k]-ser[0].act[k],t=Math.max(...ser.map(s=>pred?s.pred[k-3]:s.act[k]));
      g+=`<text x="${x0+slot/2}" y="${y(t)-6}" text-anchor="middle" class="ds-cd ${d>=0?"up":"dn"}">${sgn1(d)}</text>`;}
    g+=`<text class="cax${k===3?" ds-now":""}" x="${x0+slot/2}" y="${H-6}" text-anchor="middle">${w>=1&&w<=38?"GW"+w:""}</text>`;});
  const lg=`<div class="ds-lg">${ser.map(s=>`<span><i style="background:${s.c}"></i>${esc(s.p.web_name)}</span>`).join("")}<span class="ds-lgr"><i class="a"></i>actual <i class="p"></i>predicted</span></div>`;
  return `<div class="ds-chart">${lg}<svg class="chart" viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Last three actual, next three predicted">${g}</svg></div>`;
}

function pcardHTML(p,bench){
  const g=VG(),next=S.model.next.id,official=_histSquadActive;
  const {captain:capForGw,vice:viceForGw}=effectiveCaptainVice(g);
  const isC=_histCaptain!=null?_histCaptain===p.id:capForGw===p.id;
  const isV=_histSquadActive?_histVice===p.id:(_histCaptain==null&&viceForGw===p.id);
  const fl=S.flagged.includes(p.id),chipNow=chipForWeek(g);
  const capMult=official?((_histMult&&_histMult[p.id]>=2)?_histMult[p.id]:1):(isC?(chipNow==="3xc"?3:2):1);
  /* a finished week: the snapshot taken before its deadline, never hPts()
     (which sums future weeks for a past one) */
  const isPast=g<next,sp=isPast?pastPred(p,g):null,snapPred=sp?sp.v:null;
  const basePred=snapPred!=null?snapPred:(isPast?null:hPts(p,g,S.horizon));
  const hasPred=basePred!=null,shownPts=hasPred?basePred*capMult:null;
  const feed=(S.playerActuals&&(S.playerActuals[p.id]||S.playerActuals[String(p.id)]))||null;
  let actRaw=feed?feed[g]??feed[String(g)]:null;
  const wkSt=isPast&&S.wkLive&&S.wkLive[g]&&S.wkLive[g].players?S.wkLive[g].players[p.id]:null;
  if(actRaw==null&&wkSt)actRaw=wkSt.p;
  const lkS=isPast&&isLiveWk(g)?lkCalc(g):null,lkSt=lkS?lkS.status(p.id):null;
  if(lkS)actRaw=lkSt.s==="tp"||lkSt.s==="bl"?null:lkS.pts(p.id);
  const hasAct=actRaw!=null,actShown=hasAct?actRaw*capMult:null;
  const diff=(hasAct&&hasPred)?actShown-shownPts:null;
  const noData=isPast&&!p.gw[g]&&snapPred==null&&!hasAct||!!(lkSt&&(lkSt.s==="tp"||lkSt.s==="bl"));
  const shownVal=hasAct?actShown:(hasPred?shownPts:0);
  const col=ptsCol(shownVal/Math.max(1,S.horizon)),elite=col[2]==="elite"&&!noData;
  const sub=S.subFrom===p.id,menu=S.pMenu===p.id&&!official;
  const armband=isC?`<span class="pz-cv"${official?` title="Captain (official)"`:` title="Captain"`}>C</span>`
    :isV?`<span class="pz-cv v"${official?` title="Vice-captain (official)"`:` title="Vice-captain"`}>V</span>`:"";
  const inj=p.avail<1?`<span class="pz-inj" style="--fl:${p.avail===0?"var(--red)":p.avail>=.75?"#FFD23F":"#FF9F2E"}" title="${esc(flagTitle(p))}">${lic("triangle-alert",13)}<i>${Math.round(p.avail*100)}%</i></span>`:"";
  const strip=isPast?fxRun(pastFxGW(p,g),"sm"):fxNext(p,g,5,"sm");
  const ptsTip=lkSt&&noData?(lkSt.s==="bl"?"No match this week":"To play"):noData?`No data for GW${g}`:hasAct?`${p.total} pts this season. GW${g}: ${actShown.toFixed(1)}${hasPred?` against ${sp&&sp.src==="backtest"?"backtest":"predicted"} ${shownPts.toFixed(1)}`:""}`:`${p.total} pts this season. Predicted for ${S.horizon>1?wkSpan(g,S.horizon):"GW"+g}`;
  /* past weeks: the prediction against the actual, where the signals sit */
  const under=(hasAct&&hasPred)?`<div class="pz-pv"${sp?` title="${esc(sp.why)}"`:""}>${sp&&sp.src==="backtest"?"backtest":"pred"} ${shownPts.toFixed(1)} <b class="${diff>=0?"up":"dn"}">${diff>=0?"+":""}${diff.toFixed(1)}</b></div>`
    :hasAct?`<div class="pz-pv">no prediction stored</div>`:`<div class="pz-s">${sigHTML(p,g)}</div>`;
  const click=official?`act('card',${p.id})`:`act(S.subFrom!=null?'sub':'card',${p.id})`;
  return `<div class="pz-c${fl?" dim":""}${lkSt&&lkSt.s==="in"?" lp-on":""}${sub?" subsel":""}${menu?" open":""}" data-pid="${p.id}" onclick="${click}"${official?"":` oncontextmenu="event.preventDefault();act('pmenu',${p.id})" draggable="true" ondragstart="pzDrag(event,${p.id})" ondragover="pzOver(event)" ondragleave="this.classList.remove('drop')" ondrop="pzDrop(event,${p.id})"`} title="${esc(p.web_name)}">
    <div class="pz-k">${kitHTML(p,"pz-kit")}
      <span class="pz-l">${official?"":`<button class="pz-xf${fl?" on":""}" onclick="event.stopPropagation();act('flag',${p.id})" title="${fl?"Keep":"Transfer out"} ${esc(p.web_name)}" aria-label="${fl?"Keep":"Transfer out"} ${esc(p.web_name)}">${lic("arrow-right-left",11)}</button>`}${armband}${isPast?(wkSt&&wkSt.dt?`<span class="pz-dt pv-gdt" title="In GW${g}'s Dream Team">${lic("star",10)}</span>`:""):(inDT(p)?dtStar("pz-dt"):"")}</span>
      <span class="pz-r"><span class="pz-ow" title="Selected by ${p.owned}%">${p.owned}%</span>${inj}</span>
      <span class="pz-pt" style="background:${noData?"var(--ink3)":col[0]};color:${noData?"var(--mute)":col[1]}${elite?";box-shadow:0 0 0 2px #EAFFEF,0 0 12px rgba(125,251,158,.85)":""}" title="${esc(ptsTip)}">${noData?"—":(hasAct?(isPast?fmtPts(actShown):actShown.toFixed(1)):(hasPred?shownPts.toFixed(1):"—"))}</span></div>
    <div class="pz-n"><b>${esc(p.web_name)}</b><i>£${p.price.toFixed(1)}${arw(p.priceChange)}</i></div>
    ${isPast?pastRowsHTML(p,g,shownPts,actShown,hasPred,sp):`<div class="pz-x">${strip}</div>${under}`}${menu?pmenuHTML(p,bench):""}</div>`;
}
/* the right-click menu, with the site's icons */
function pmenuHTML(p,bench){
  const {captain,vice}=effectiveCaptainVice(VG()),inXI=!bench;
  const it=(icon,label,on,call)=>`<button role="menuitem" onclick="event.stopPropagation();${call}">${icon}<span>${label}</span>${on?lic("check",14):""}</button>`;
  return `<div class="pz-menu" role="menu" onclick="event.stopPropagation()" oncontextmenu="event.preventDefault();event.stopPropagation()">
    <div class="pz-mh"><b>${esc(p.web_name)}</b><span>${esc(p.teamName)} · ${POSL[p.pos]} · £${p.price.toFixed(1)}</span></div>
    ${it(lic("arrow-right-left",15),"Substitute",S.subFrom===p.id,`act('sub',${p.id})`)}
    ${bench&&bench.cycle?it(lic("refresh-cw",15),"Change bench order",false,`act('benchcycle',${p.id})`):""}
    ${inXI?it(`<span class="pz-mb">C</span>`,"Captain",captain===p.id,`act('cap',${p.id})`):""}
    ${inXI?it(`<span class="pz-mb v">V</span>`,"Vice-captain",vice===p.id,`act('vice',${p.id})`):""}
    ${it(lic("info",15),"Player card",false,`act('card',${p.id})`)}</div>`;
}
/* ---------- a finished week (22 Nov 2026, Andy approved the mock) ----------
   Each card gets the result, the match events (drawn icons) and the
   prediction against the actual as two pills; a summary bar sits under the
   gameweek scroller; a GW Review replaces the Player Pool. The week's own
   figures come from /api/fpl-week/<gw> (FPL's gameweek file and fixtures). */
function weekLive(g,force){
  if(BACKUP)return null;
  S.wkLive=S.wkLive||{};S.wkAt=S.wkAt||{};
  const have=g in S.wkLive;
  /* batch 5: the week being played is fetched again each minute (force) */
  if(!have||(force&&S.wkLive[g]&&!S._wkBusy)){if(!have)S.wkLive[g]=null;S._wkBusy=have;
    const get=have?fetch("/api/fpl-week/"+g,{cache:"no-store"}).then(x=>x.ok?x.text():Promise.reject(new Error("HTTP "+x.status))):dataText("/api/fpl-week/"+g);
    get.then(t=>{S._wkBusy=false;try{S.wkLive[g]=JSON.parse(t);}catch(_){if(!S.wkLive[g])S.wkLive[g]={players:{},fixtures:[]};}S.wkAt[g]=Date.now();render();})
      .catch(()=>{S._wkBusy=false;if(!S.wkLive[g])S.wkLive[g]={players:{},fixtures:[]};});}
  return S.wkLive[g];
}
const fmtPts=v=>v==null?"—":Number.isInteger(+v)?String(+v):(+v).toFixed(1);
const EVSV=(inner,fill)=>`<svg viewBox="0 0 24 24" width="13" height="13" fill="${fill||"none"}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const EV_ICON={
  g:EVSV('<circle cx="12" cy="12" r="9"/><path d="M12 7.5l3.8 2.8-1.5 4.4H9.7L8.2 10.3z" fill="currentColor"/><path d="M12 3v4.5M20.6 9.6l-4.8.7M17.3 19.4l-3-4.7M6.7 19.4l3-4.7M3.4 9.6l4.8.7"/>'),
  a:EVSV('<path d="M4 15.5c2.5 0 4-.6 5.6-2.4l2.6-3 4 1.8c1.6.7 2.3 1.7 2.3 3.1V17H4z"/><path d="M4 17h14.5M9 12l2 1.5M11 10l2 1.5"/>'),
  cs:EVSV('<path d="M12 3l7.5 3v5.4c0 4.4-3.1 7.7-7.5 9.6-4.4-1.9-7.5-5.2-7.5-9.6V6z"/><path d="M8.6 12.2l2.4 2.4 4.6-4.8"/>'),
  sv:EVSV('<path d="M7.5 21v-4.2L4.6 13a1.6 1.6 0 0 1 2.4-2.1l1.8 1.8V5.5a1.4 1.4 0 0 1 2.8 0V11V4.2a1.4 1.4 0 0 1 2.8 0V11V5.3a1.4 1.4 0 0 1 2.8 0V11V8a1.3 1.3 0 0 1 2.6 0v6.4c0 2.5-1.2 4.6-3.2 6.6"/>'),
  b:EVSV('<circle cx="12" cy="9" r="5.5"/><path d="M8.6 13.4L7 21l5-2.6 5 2.6-1.6-7.6"/>'),
  dc:EVSV('<rect x="3.5" y="5" width="7" height="5" rx="1"/><rect x="13.5" y="5" width="7" height="5" rx="1"/><rect x="8.5" y="14" width="7" height="5" rx="1"/><path d="M3.5 16.5h3M17.5 16.5h3"/>'),
  card:c=>`<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><rect x="7" y="3.5" width="10" height="17" rx="2" fill="${c}" transform="rotate(8 12 12)"/></svg>`,
  mins:EVSV('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  og:EVSV('<circle cx="12" cy="12" r="9"/><path d="M8 8l8 8M16 8l-8 8"/>'),
  pen:EVSV('<circle cx="12" cy="12" r="9"/><path d="M12 7v5M12 16h.01"/>')};
const evChip=(icon,tone,title,n)=>`<span class="pv-ev" style="--ec:${tone}" title="${esc(title)}">${icon}${n?`<i>${n}</i>`:""}</span>`;
/* the match events of one player in one week */
function evRowHTML(p,st){
  if(!st)return "";
  const c=[];if(st.m===0)c.push(evChip(EV_ICON.mins,"#FF5A6E","Did not play","0′"));
  if(st.g)c.push(evChip(EV_ICON.g,"#3DDC97",st.g===1?"Goal":st.g+" goals",st.g>1?st.g:""));
  if(st.a)c.push(evChip(EV_ICON.a,"#7AA2FF",st.a===1?"Assist":st.a+" assists",st.a>1?st.a:""));
  if(st.cs&&p.pos<=3&&st.m>=60)c.push(evChip(EV_ICON.cs,"#22D3EE","Clean sheet"));
  if(st.sv&&p.pos===1)c.push(evChip(EV_ICON.sv,"#5EEAD4",st.sv+" save"+(st.sv===1?"":"s"),st.sv));
  if(st.ps)c.push(evChip(EV_ICON.sv,"#3DDC97","Penalty saved","P"));
  if(st.dc)c.push(evChip(EV_ICON.dc,"#A78BFA","Defensive contribution"));
  if(st.b)c.push(evChip(EV_ICON.b,"#FFB020",st.b+" bonus point"+(st.b===1?"":"s"),st.b));
  if(st.pm)c.push(evChip(EV_ICON.pen,"#FF5A6E","Penalty missed"));
  if(st.og)c.push(evChip(EV_ICON.og,"#FF5A6E","Own goal"));
  if(st.yc)c.push(evChip(EV_ICON.card("#FFD23F"),"#FFD23F","Yellow card"));
  if(st.rc)c.push(evChip(EV_ICON.card("#FF5A6E"),"#FF5A6E","Red card"));
  return c.join("");
}
/* result rows for his club that week (two in a double, none in a blank) */
function resHTML(p,W){
  const fx=(W&&W.fixtures||[]).filter(f=>f.h===p.team||f.a===p.team);
  const short=id=>((S.teams||[]).find(t=>t.id===id)||{}).short||"?";
  if(!fx.length)return `<div class="pv-res"><span class="pv-wdl B">–</span><b>No game</b></div>`;
  return fx.slice(0,2).map(f=>{const home=f.h===p.team,us=home?f.hs:f.as,them=home?f.as:f.hs,opp=short(home?f.a:f.h);
    const r=us==null||them==null?"":us>them?"W":us<them?"L":"D";
    return `<div class="pv-res${fx.length>1?" dbl":""}"><span class="pv-wdl ${r||"N"}">${r||"·"}</span><b>${us==null?"–":`${us}–${them}`}</b><span class="pv-opp">${home?esc(opp):esc(opp).toLowerCase()}</span><span class="pv-ha">${home?"H":"A"}</span></div>`;}).join("");
}
/* the card's lower half on a finished week */
function pastRowsHTML(p,g,shownPts,actShown,hasPred,sp){
  if(isLiveWk(g))return lkRowsHTML(p,g,shownPts,hasPred);
  const W=weekLive(g),st=W&&W.players?W.players[p.id]:null;
  const d=hasPred&&actShown!=null?actShown-shownPts:null;
  return `${W?resHTML(p,W):`<div class="pv-res"><b class="mu">…</b></div>`}
    <div class="pv-row"><span class="pv-evs">${evRowHTML(p,st)||`<span class="pv-none">—</span>`}</span></div>
    <div class="pv-pills">${hasPred?`<span class="pv-pred" title="${esc(sp&&sp.why||"Predicted before the deadline")}">${sp&&sp.src==="backtest"?"Backtest":"Pred"} <b>${shownPts.toFixed(1)}</b></span>`:`<span class="pv-pred off">No prediction</span>`}${d!=null?`<span class="pv-diff ${d>=0?"up":"dn"}" title="Actual against predicted">${d>=0?"▲":"▼"} ${Math.abs(d).toFixed(1)}</span>`:""}</div>`;
}
/* the official row for a finished week, and the week before it */
const offRowOf=g=>((S.tracker&&S.tracker.gw)||[]).find(r=>r.event===g&&Array.isArray(r.picks)&&r.picks.length)||null;
const actOf=(id,g)=>{const W=S.wkLive&&S.wkLive[g],st=W&&W.players?W.players[id]:null;if(st)return st.p;
  const f=S.playerActuals&&(S.playerActuals[id]||S.playerActuals[String(id)]);const v=f?f[g]??f[String(g)]:null;return v==null?null:+v;};
/* the summary bar under the scroller */
function pastSummaryHTML(g){
  const row=offRowOf(g);if(!row)return "";
  const tr=((S.tracker&&S.tracker.gw)||[]).slice().sort((a,b)=>a.event-b.event),prev=tr.filter(r=>r.event<g).pop();
  const ev=(S.events||[]).find(e=>e.id===g)||{};
  const P=id=>S.model.players.find(p=>p.id===id);
  let pred=0,have=0;row.picks.slice(0,11).forEach(pk=>{const p=P(pk.id),sp=p&&pastPred(p,g);if(sp){pred+=sp.v*(pk.multiplier||1);have++;}});
  const pts=row.points,dp=have>=9?pts-pred:null;
  const chg=(a,b)=>a&&b?`<i class="${b<a?"up":"dn"}">${b<a?"▲":"▼"} ${Math.abs(a-b).toLocaleString()}</i>`:"";
  const cell=(l,v,x)=>`<div><span>${l}</span><b>${v}</b>${x||""}</div>`;
  return `<div class="pv-sum">
    <div class="pv-big"><span>GW${g} points</span><b>${pts}</b>${dp!=null?`<i class="${dp>=0?"up":"dn"}">${dp>=0?"▲":"▼"} ${Math.abs(dp).toFixed(1)} vs predicted ${pred.toFixed(1)}</i>`:""}</div>
    ${cell("Average",ev.avg??"—",ev.avg?`<i class="${pts>=ev.avg?"up":"dn"}">${pts>=ev.avg?"+":"−"}${Math.abs(pts-ev.avg)}</i>`:"")}
    ${cell("Highest",ev.high??"—")}
    ${cell("GW rank",row.gwRank?row.gwRank.toLocaleString():"—",chg(prev&&prev.gwRank,row.gwRank))}
    ${cell("Overall rank",row.orRank?row.orRank.toLocaleString():"—",chg(prev&&prev.orRank,row.orRank))}
    ${cell("Transfers",row.transfers||0,`<i>${row.transferCost>0?`<span class="dn">−${row.transferCost} hit</span>`:"no hit"}${row.chipLabel?" · "+esc(row.chipLabel):""}</i>`)}</div>`;
}
/* the GW Review, where the Player Pool sits on an editable week */
function pastReviewHTML(g){
  const row=offRowOf(g);if(!row)return "";
  const W=weekLive(g),P=id=>S.model.players.find(p=>p.id===id);
  const tr=((S.tracker&&S.tracker.gw)||[]).slice().sort((a,b)=>a.event-b.event),prev=tr.filter(r=>r.event<g&&Array.isArray(r.picks)&&r.picks.length).pop();
  const xi=row.picks.slice(0,11),bn=row.picks.slice(11);
  const bar=(v,mx,col)=>`<span class="pz-bt"><i style="width:${Math.round(Math.min(1,Math.abs(v)/Math.max(1,mx))*100)}%;background:${col}"></i></span>`;
  const line=(p,label,b,val,cls)=>p?`<span class="pz-bw">${photoHTML(p,"pz-ph")}<span class="pz-bn">${esc(label)}</span>${b}<b class="${cls||""}">${val}</b></span>`:"";
  /* captain against the best he could have had */
  const capPk=xi.find(pk=>pk.multiplier>=2)||xi.find(pk=>pk.isC),mult=capPk?Math.max(2,capPk.multiplier||2):2;
  const best=xi.map(pk=>({pk,v:actOf(pk.id,g)})).filter(x=>x.v!=null).sort((a,b)=>b.v-a.v)[0];
  const capV=capPk?actOf(capPk.id,g):null,cp=capPk&&P(capPk.id),bp=best&&P(best.pk.id);
  const capBlk=cp?`<div class="pv-blk"><em>${lic("crown",13)} Captain</em><div class="pv-cap"><span>${photoHTML(cp,"pz-ph")}<b>${esc(cp.web_name)}</b><i>${fmtPts(capV)} × ${mult} = ${fmtPts(capV==null?null:capV*mult)}</i></span>
      ${bp&&bp!==cp?`<span class="pv-vs">best option</span><span>${photoHTML(bp,"pz-ph")}<b>${esc(bp.web_name)}</b><i class="up">${fmtPts(best.v)} × ${mult} = ${fmtPts(best.v*mult)}</i></span>`:`<span class="pv-vs">the best option</span><span></span>`}</div>
      ${bp&&bp!==cp&&capV!=null&&best.v>capV?`<div class="pv-note dn">Missed ${fmtPts((best.v-capV)*(mult-1))} points on the armband</div>`:capV!=null?`<div class="pv-note up">The right call</div>`:""}</div>`:"";
  /* transfers in and out, and what they scored that week */
  let xfer="";
  if(prev){const was=new Set(prev.picks.map(pk=>pk.id)),now=new Set(row.picks.map(pk=>pk.id));
    const ins=row.picks.filter(pk=>!was.has(pk.id)).map(pk=>P(pk.id)).filter(Boolean),outs=prev.picks.filter(pk=>!now.has(pk.id)).map(pk=>P(pk.id)).filter(Boolean);
    if(ins.length&&!row.chip?.match?.(/freehit|wildcard/)){const si=ins.reduce((a,p)=>a+(actOf(p.id,g)||0),0),so=outs.reduce((a,p)=>a+(actOf(p.id,g)||0),0),net=si-so-(row.transferCost||0);
      const mx=Math.max(1,...ins.concat(outs).map(p=>actOf(p.id,g)||0));
      xfer=`<div class="pv-blk"><em>${lic("arrow-right-left",13)} Transfer${ins.length>1?"s":""}</em>${ins.map(p=>line(p,p.web_name+" in",bar(actOf(p.id,g)||0,mx,"var(--mint)"),fmtPts(actOf(p.id,g)||0),"up")).join("")}${outs.map(p=>line(p,p.web_name+" out",bar(actOf(p.id,g)||0,mx,"#5A5A5A"),fmtPts(actOf(p.id,g)||0))).join("")}
        <div class="pv-note ${net>=0?"up":"dn"}">${net>=0?"+":"−"}${fmtPts(Math.abs(net))} from the transfer${ins.length>1?"s":""}${row.transferCost?` after the −${row.transferCost} hit`:""}</div></div>`;}
    else xfer=`<div class="pv-blk"><em>${lic("arrow-right-left",13)} Transfers</em><div class="pv-kv"><span>${row.chip&&/freehit|wildcard/.test(row.chip)?esc(row.chipLabel||"Chip")+" week":"No transfers"}</span><b>${ins.length?ins.length+" changes":"—"}</b></div></div>`;}
  /* best, and worst against the prediction */
  const scored=xi.map(pk=>{const p=P(pk.id),v=actOf(pk.id,g),sp=p&&pastPred(p,g);return p&&v!=null?{p,pk,v:v*(pk.multiplier||1),d:sp?v*(pk.multiplier||1)-sp.v*(pk.multiplier||1):null}:null;}).filter(Boolean);
  const top=scored.slice().sort((a,b)=>b.v-a.v).slice(0,3),mxv=Math.max(1,...top.map(x=>x.v));
  const worst=scored.filter(x=>x.d!=null).sort((a,b)=>a.d-b.d).slice(0,3),mxd=Math.max(1,...worst.map(x=>Math.abs(x.d)));
  const lab=x=>x.p.web_name+(x.pk.multiplier>=2?" (C)":"");
  const perf=`<div class="pv-blk"><em class="up">Best</em>${top.map(x=>line(x.p,lab(x),bar(x.v,mxv,"var(--mint)"),fmtPts(x.v),"up")).join("")}
    ${worst.length?`<em class="dn">Worst against prediction</em>${worst.map(x=>line(x.p,lab(x),bar(x.d,mxd,x.d<0?"var(--red)":"var(--mint)"),(x.d>=0?"+":"−")+Math.abs(x.d).toFixed(1),x.d<0?"dn":"up")).join("")}`:""}</div>`;
  /* the bench, and who came on */
  const benchPts=bn.reduce((a,pk)=>a+(actOf(pk.id,g)||0),0),mxb=Math.max(1,...bn.map(pk=>actOf(pk.id,g)||0));
  const subs=(row.autoSubs||[]).map(s=>`${esc((P(s.in)||{}).web_name||"?")} on for ${esc((P(s.out)||{}).web_name||"?")}`).join(", ");
  const benchBlk=`<div class="pv-blk"><em>${lic("users",13)} Bench · ${fmtPts(benchPts)} point${benchPts===1?"":"s"} left</em>${bn.map(pk=>{const p=P(pk.id);return line(p,p?p.web_name:"",bar(actOf(pk.id,g)||0,mxb,"#5A7A6A"),fmtPts(actOf(pk.id,g)));}).join("")}
    ${subs?`<div class="pv-kv"><span>Auto-sub${(row.autoSubs||[]).length>1?"s":""}</span><b>${subs}</b></div>`:""}</div>`;
  /* that week's Dream Team */
  let dtBlk="";
  if(W&&W.players){const dts=Object.entries(W.players).filter(([,s])=>s.dt),mine=row.picks.filter(pk=>(W.players[pk.id]||{}).dt).map(pk=>P(pk.id)).filter(Boolean);
    const tot=dts.reduce((a,[,s])=>a+(s.p||0),0),mx=Math.max(1,...mine.map(p=>actOf(p.id,g)||0));
    if(dts.length)dtBlk=`<div class="pv-blk"><em>${lic("star",13)} GW${g} Dream Team · ${mine.length} of yours</em>${mine.map(p=>line(p,p.web_name,bar(actOf(p.id,g)||0,mx,"#FFD23F"),fmtPts(actOf(p.id,g)))).join("")||`<span class="mu">None of yours this week</span>`}<div class="pv-kv"><span>Dream Team total</span><b>${tot}</b></div></div>`;}
  return `<div class="panel pv-rev">${pnlHead("calendar-check",`GW${g} Review`,"How your week went against the prediction.",`<span class="pv-chip">${row.chipLabel?esc(row.chipLabel):"No chip"}</span>`)}${capBlk}${xfer}${perf}${benchBlk}${dtBlk}</div>`;
}
function plannerPitchHTML(){
  const xi=startingXI();
  if(!xi.length)return `<div class="pbody" style="text-align:center"><p class="note">No squad loaded.</p>
    <button class="pri" onclick="act('seed')">Load my squad</button></div>`;
  const bench=orderBench(squadPlayers().filter(p=>!xi.includes(p)));
  const rows=[1,2,3,4].map(pos=>xi.filter(p=>p.pos===pos)).filter(r=>r.length);
  return `<div class="pz-pitch${VG()<S.model.next.id?" past":""}"><svg class="pz-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect x="24" y="0" width="52" height="13"/><rect x="38" y="0" width="24" height="5"/><path d="M42 13 Q50 18 58 13"/><line x1="0" y1="100" x2="100" y2="100"/><path d="M40 100 A10 12 0 0 1 60 100"/></svg>
    ${rows.map(r=>`<div class="pz-row">${r.map(p=>pcardHTML(p)).join("")}</div>`).join("")}
    ${bench.length?`<div class="pz-bench">${bench.map((p,i)=>`<div class="pz-bs"><div class="pz-bl">${p.pos===1?"GKP":`${i}. ${POSL[p.pos]}`}</div>${pcardHTML(p,{slot:i+1,cycle:p.pos!==1})}</div>`).join("")}</div>`:""}</div>`;
}
/* ---------- the gameweek scroller ---------- */
/* predicted team score for each future week, the Planner's own sum for
   that week's plan (weekPtsFor with the week in view); kept until the plan
   changes */
let _wkSer={k:null,v:{}};
function weekPredSeries(weeks){
  const key=JSON.stringify([weeks,S.planByGw,S.chips,S.squad,S.captain,S.vice,S.benchOrder,S.forceXI,S.flagged,S.startGW,
    S.model&&S.model.players.length,S.oddsFetchedAt]);
  if(_wkSer.k===key)return _wkSer.v;
  const keep=S.startGW,out={};
  try{weeks.forEach(e=>{S.startGW=e;try{out[e]=weekPtsFor(e,1);}catch(_){out[e]=null;}});}finally{S.startGW=keep;}
  _wkSer={k:key,v:out};return out;
}
/* the line under the scroller: what the week in view is (the old week
   figure's label) */
function planWeekLine(){
  const g=VG(),first=S.model.next.id;
  const offRow=(g<first&&S.tracker&&Array.isArray(S.tracker.gw))
    ?(S.tracker.gw.find(r=>r.event===g&&Array.isArray(r.picks)&&r.picks.length)||null):null;
  if(offRow&&isLiveWk(g))return `GW${g} official · ${offRow.transfers||0} transfer${(offRow.transfers||0)===1?"":"s"} · ${offRow.transferCost>0?`<span class="dn">-${offRow.transferCost} hit</span>`:"no hit"} · <span class="lp-t">bonus provisional until FPL confirms it</span>`;
  if(offRow)return `<span title="Squad, line-up, formation, captain and points confirmed from the official FPL API.">GW${g} official · ${offRow.transfers||0} transfer${(offRow.transfers||0)===1?"":"s"}${offRow.transferCost>0?`, <span class="dn">-${offRow.transferCost} hit</span>`:""}${offRow.chipLabel?` · <span style="color:var(--amber)">${esc(offRow.chipLabel)}</span>`:""}</span> · <span class="up">Official line-up · final</span>`;
  if(S.actuals&&S.actuals[g]!=null){const d=S.actuals[g]-weekPts();
    return `GW${g} ${weekFinal(g)?"actual":"so far"+LIVE_TAG} · pred ${weekPts().toFixed(1)} <span class="${d>=0?"up":"dn"}">${d>=0?"+":""}${d.toFixed(1)}</span>`;}
  const t=transfersIn(g),h=(t&&!freeWeek(g))?hitCost(g):0;
  return `GW${g} · ${S.horizon>1?`${wkSpan(g,S.horizon)} predicted <b class="up">${weekPts().toFixed(1)}</b> · `:""}${t?`${t} transfer${t>1?"s":""} · ${h?`<span class="dn">-${h} hit</span>`:"free"}`:"no transfers"}${chipForWeek(g)?` · <span style="color:var(--amber)">${CHIP_UI[chipKind(chipForWeek(g))].n}</span>`:""}`;
}
function gwScrollerHTML(){
  const g=VG(),first=S.model.next.id,tr=(S.tracker&&S.tracker.gw)||[];
  const lo=clamp(g-3,1,31),weeks=[];for(let e=lo;e<lo+8&&e<=38;e++)weeks.push(e);
  const pred=weekPredSeries(weeks.filter(e=>e>=first));
  const pill=e=>{const r=tr.find(x=>x.event===e);let v,k,chip=null;
    if(r&&r.points!=null){const fin=weekFinal(e);v=String(!fin&&S.actuals&&S.actuals[e]!=null?S.actuals[e]:r.points);k=fin?"final":"provisional";chip=r.chip||null;if(isLiveWk(e)){const LL=lkCalc(e);if(LL)v=fmtPts(LL.pre);k="live";}}
    else if(e<first&&S.actuals&&S.actuals[e]!=null){v=String(S.actuals[e]);k="live";}
    else if(e>=first&&pred[e]!=null){v=pred[e].toFixed(1);k="pred";chip=chipForWeek(e)||null;}
    else{v="—";k="";}
    const u=chip?CHIP_UI[chipKind(chip)]:null;
    return `<button class="pz-gp ${k==="pred"?"pr":k==="provisional"?"pv":k==="live"?"pv lp-g":""}${e===g?" on":""}" onclick="act('startgw',${e})" aria-pressed="${e===g}" title="GW${e}${k?" · "+k:""}">
      ${u?`<span class="pz-gc" style="--tc:${u.c}">${u.s}</span>`:""}<span>GW${e}</span><b>${v}</b><i>${k==="pred"?"pred":k}</i></button>`;};
  return `<div class="pz-scr"><button class="pz-sa" onclick="act('startgw',${Math.max(1,g-1)})" aria-label="Earlier gameweek"${g<=1?" disabled":""}>${lic("chevron-left",16)}</button>
    ${weeks.map(pill).join("")}
    <button class="pz-sa" onclick="act('startgw',${Math.min(38,g+1)})" aria-label="Later gameweek"${g>=38?" disabled":""}>${lic("chevron-right",16)}</button></div>`;
}
function plannerHeadHTML(){
  return `<div class="phead pz-head"><span class="pseg"><button class="${S.sqView!=="list"?"on":""}" onclick="act('sqview','pitch')">Pitch</button><button class="${S.sqView==="list"?"on":""}" onclick="act('sqview','list')">List</button></span>
    ${gwScrollerHTML()}
    ${offRowOf(VG())&&VG()<S.model.next.id?`<span class="placts">${isLiveWk(VG())?`<span class="pv-lock lp-lk"><span class="lp-dot"></span>Live · ${lkAgo(VG())}</span>`:`<span class="pv-lock">${lic("lock",13)} Official · read-only</span>`}</span></div>
    <div class="pz-wl">${planWeekLine()}</div>${isLiveWk(VG())?lkSumHTML(VG()):pastSummaryHTML(VG())}`:`<span class="placts"><button class="${S.cmp?"on":""}" onclick="act('compare')">Compare</button><button onclick="act('opt')">Optimise</button>
      <button onclick="act('reset')">Reset</button><button class="pri${planBank()<-0.001?" blocked":""}" onclick="act('save')"${planBank()<-0.001?` title="Over budget: Save is off until the bank is back to £0.0" aria-disabled="true"`:""}>Save</button></span></div>
    <div class="pz-wl">${planWeekLine()}${planBank()<-0.001?` · <span class="pz-warn">Over budget £${(-planBank()).toFixed(1)}</span>`:""}${(()=>{const cw=capWarnHTML().replace(/^ · /,"");return cw?` · <span class="pz-warn" role="status">${cw}</span>`:"";})()}</div>`}`;
}
/* ---------- the stats strip ---------- */
function plannerStatsHTML(o){
  const fRows=((S.tracker&&S.tracker.gw)||[]).slice().sort((x,y)=>x.event-y.event);
  const last=fRows[fRows.length-1],prev=fRows[fRows.length-2],rating=o.rating;
  /* the latest week FPL has ranked (a provisional week has none yet) */
  const gR=fRows.filter(r=>r.gwRank),lastG=gR[gR.length-1],prevG=gR[gR.length-2];
  const chg=(d,f,goodUp)=>(d==null||!isFinite(d)||Math.abs(d)<1e-9)?"":`<span class="${(d>0)===goodUp?"up":"dn"}">${d>0?"▲":"▼"} ${f(Math.abs(d))}</span>`;
  const ln=(c,wk)=>`<i>${c}${c&&wk?" · ":""}${wk||""}</i>`;
  const tipB=t=>`<button class="fci" aria-label="About" data-tip="${esc(t)}">i</button>`;
  /* 25 Nov 2026 (Andy: "make it make sense"): one money story. Squad Value is
     today's prices; selling raises less (FPL keeps half of each rise); that
     plus the bank is what the Team Rating's best team may cost. FPL's own
     figure from the last deadline is left out: it was a third number. */
  const sellV=squadPlayers().reduce((a,p)=>a+sellPrice(p),0);
  /* 22 Nov 2026 (batch 4): Overall Rank and GW Rank open Rank, Team Rating its own */
  const st=(label,tip,fig,line,series,tone,extra,pop)=>`<div class="pz-st${pop?" pz-stc":""}"${pop?` role="button" tabindex="0" onclick="act('pop','${pop}')" onkeydown="if(event.key==='Enter')act('pop','${pop}')"`:""}><span class="pz-stl">${label}${tipB(tip)}</span><b>${fig}</b>${line||""}${series&&series.length>1?spark(series,tone||"#3DDC97"):""}${extra||""}</div>`;
  const rateCol=rating?(rating.pct>=85?"var(--mint)":rating.pct>=70?"var(--amber)":"var(--red)"):"var(--cream)";
  return `<section class="panel pz-stats">
    <div class="pz-id"><h1>${esc(IDENTITY.team)}</h1><span>${esc(IDENTITY.manager)} · ${IDENTITY.id}</span></div>
    ${st("Overall Rank",S.entryRankLive?`Your overall rank, live during GW${S.entryRankGw}.`:`Your overall rank after GW${S.entryRankGw||"—"}.`,
      S.entryRank?S.entryRank.toLocaleString():"—",
      ln(S.entryRank&&prev&&last&&prev.orRank&&last.orRank?chg(prev.orRank-last.orRank,x=>Math.round(x).toLocaleString(),true):"",S.entryRank?"GW"+S.entryRankGw+(S.entryRankLive?" live":""):"waiting"),
      fRows.filter(r=>r.orRank).slice(-8).map(r=>-r.orRank),null,null,"rank")}
    ${st("GW Rank",`Your rank for GW${lastG?lastG.event:"—"} alone.`,
      lastG?lastG.gwRank.toLocaleString():"—",
      ln(prevG&&lastG?chg(prevG.gwRank-lastG.gwRank,x=>Math.round(x).toLocaleString(),true):"",lastG?"GW"+lastG.event:""),
      fRows.filter(r=>r.gwRank).slice(-8).map(r=>-r.gwRank),null,null,"rank")}
    ${st("Team Rating",`Your score against the best team £${rating?rating.budget.toFixed(1):"—"} buys: sales £${sellV.toFixed(1)} + bank £${o.bank.toFixed(1)}.`,
      `<span style="color:${rateCol}">${rating?rating.pct:"—"}</span>`,rating?`<i>Best XI ${rating.best.toFixed(1)}</i>`:"",null,null,
      rating?`<span class="pz-ring" style="--v:${rating.pct};--rc:${rateCol}"></span>`:"","rating")}
    ${st("Squad Value",`Your ${o.n} at today's prices. Sold today they raise £${sellV.toFixed(1)}.`,
      `£${o.sv.toFixed(1)}`,o.raised>0?`<i>£${o.raised.toFixed(1)} from sales</i>`:ln(prev&&last&&prev.value!=null?chg((last.value-(last.bank||0))-(prev.value-(prev.bank||0)),x=>x.toFixed(1),true):"",""),
      fRows.filter(r=>r.value!=null).slice(-8).map(r=>+r.value-(+r.bank||0)),"#8A8A8A")}
    ${st("Bank",`Money left after this week's planned transfers. FT: free transfers (max 5).`,
      `<span${o.bank<0?' style="color:var(--red)"':""}>£${o.bank.toFixed(1)}</span>`,`<i>${o.ftTxt} FT</i>`)}
  </section>`;
}
/* ---------- chips: one row, the half of the week in view ---------- */
function plannerChipsHTML(){
  const g=VG(),first=S.model.next.id,half=g>=20?"2":"1",locked=g<first;
  const btn=kind=>{const key=kind+half,u=CHIP_UI[kind],played=chipPlayed(key),active=chipForWeek(g)===kind,planned=S.chips[key];
    const used=played!=null&&!active,team=kind==="freehit"||kind==="wildcard";
    const line=used?`Played GW${played}`:active?`Active GW${g}${team&&!locked?" · Build team":""}`:planned?`Planned GW${planned}`:"Available";
    const call=used||locked?"":active?(team?`act('cmpopen','${kind==="freehit"?"fh":"wc"}')`:`act('achip','none')`):`act('achip','${kind}')`;
    return `<button class="pz-cb${used?" used":""}${active?" active":""}" style="--tc:${u.c}"${call?` onclick="${call}"`:" disabled"} aria-pressed="${active}">
      ${chipTile(kind,28,active)}<span><b>${u.n}</b><i>${line}</i></span>
      ${active&&!locked?`<span class="pz-cx" role="button" tabindex="0" title="Cancel ${u.n}" onclick="event.stopPropagation();act('achip','none')">${lic("x",14)}</span>`:used||locked?"":lic("chevron-right",16)}</button>`;};
  return `<div class="pz-chipbar"><span class="pz-cbl">Chips<button class="fci" aria-label="About" data-tip="Each chip once in GW1–19 and again in GW20–38.">i</button></span>
    <div class="pz-cbs">${["bboost","3xc","wildcard","freehit"].map(btn).join("")}</div>
    <a class="pz-link" href="${routeFor("chips")}" onclick="return go(event,'chips')" title="Chips page">${lic("arrow-right",16)}</a></div>`;
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
    &&(!q||(p.web_name+" "+p.first+" "+p.last+" "+p.teamName).toLowerCase().includes(q.toLowerCase())));
  if(!list&&S.fFit)out=out.filter(p=>p.avail>=1);
  if(list){
    const g=S.model.next.id;
    if(S.starOnly)out=out.filter(p=>S.stars.includes(p.id));
    if(S.iconF.length)out=out.filter(p=>{const ic=signals(p,g).map(x=>x[0]);
      return S.iconF.every(k=>ic.includes(k));});
  }
  return out;
}
const fix3=(p,g)=>fxNext(p,g,3,"sm");
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
  /* H2 (Bundle E): each player's sort value is worked out once, not twice per
     comparison (SORTVAL builds a 50-field object every call) */
  const v=new Map(arr.map(p=>[p,SORTVAL(p,key,g)]));
  return arr.sort((x,y)=>{const a=v.get(x),b=v.get(y);
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
        ${kitSm(m.inn,30)}
        <span style="flex:1;min-width:0">
          <span style="display:flex;align-items:center;gap:5px"><span style="font-size:12.5px;font-weight:600">${esc(m.inn.web_name)}</span>${sigHTML(m.inn,g)}</span>
          <span style="display:block;font-size:10px;color:var(--mute)">${esc(m.inn.teamName)} · £${m.inn.price.toFixed(1)} · ${m.inn.xMins}′ xMins</span></span>
        <span class="mono" style="color:${m.gain>=0?"var(--mint)":"var(--red)"};font-weight:700" title="Change to your XI over ${S.horizon||1} GW">${sgn1(m.gain)}</span></button>`).join("")
        :`<div class="pbody"><p class="note">No affordable option at this position.</p></div>`}</div>`;
  }).join("");
}
const INJ=p=>p.avail===0?`<span title="${esc(flagTitle(p))}" style="color:var(--red);font-size:11px">✚</span>`
  :(p.avail<1?`<span title="${esc(flagTitle(p))}" style="color:var(--amber);font-size:11px">✚</span>`:"");
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
  const cols=[["price","£"],["xmins","xMins"],["total","Pts"],["form","Form"],["pred","xPts"],["pred3","3GW"]];
  /* compact two-line rows (22 Nov 2026): line 1 name, Player Data's XI /
     Bench / C / VC tag, injury, signals; line 2 club, position, next three */
  const head=`<div class="lhead pr2-h"><span data-k="name" class="pr2-hp ${S.lSort==="name"?"act":""}" onclick="act('lsort','name')">Player</span>
    ${cols.map(([k,n])=>`<span class="${S.lSort===k?"act":""}" data-k="${k}" onclick="act('lsort','${k}')">${n}</span>`).join("")}</div>`;
  const xiSet=new Set(startingXI().map(p=>p.id)),cv=effectiveCaptainVice(g);
  const tagOf=p=>!ownIds.includes(p.id)?"":p.id===cv.captain?`<span class="pdrole c" title="Your captain">C</span>`:p.id===cv.vice?`<span class="pdrole v" title="Your vice-captain">VC</span>`
    :xiSet.has(p.id)?`<span class="pdrole xi" title="In your starting XI">XI</span>`:`<span class="pdrole bn" title="On your bench">Bench</span>`;
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
    return `<button class="prow pr2${own?" mine":""}" onclick="act('listpick',${p.id})"
      title="${afford?"":"Over budget by £"+(p.price-budget).toFixed(1)}"
      style="${p.avail===0?"opacity:.35;":""}${!afford?"opacity:.42;":""}">
      ${kitSm(p,30)}
      <span class="pr2-who"><span class="pr2-l1"><b>${esc(p.web_name)}</b>${tagOf(p)}${p.avail<1?`<span class="pz-inj" style="--fl:${p.avail===0?"var(--red)":p.avail>=.75?"#FFD23F":"#FF9F2E"}" title="${esc(flagTitle(p))}">${lic("triangle-alert",11)}<i>${Math.round(p.avail*100)}%</i></span>`:""}<span class="pr2-sig">${sigHTML(p,g)}</span></span>
        <span class="pr2-l2"><i>${esc(p.teamName)} · ${POS[p.pos]}</i>${fix3(p,g)}</span></span>
      <span class="pr2-c pr2-price">£${p.price.toFixed(1)}${arw(p.priceChange)}</span>
      <span class="pr2-c mu">${p.xMins}′</span>
      <span class="pr2-c">${p.total}</span>
      <span class="pr2-c mu">${p.form.toFixed(1)}</span>
      <span class="pr2-c pr2-xp" style="color:${delta==null?"var(--mint)":(delta<0?"var(--red)":"var(--mint)")}">${delta==null?hPts(p,g,S.horizon).toFixed(1):sgn1(delta)}</span>
      <span class="pr2-c cy">${hPts(p,g,3).toFixed(1)}</span>
    </button>`;}).join("")+(plim<150?pmore:"");
}
/* Player Pool filters (21 Nov 2026, Andy approved the mock): search with a
   sort, one row of positions, then chips: price (a slider in £0.1m steps
   with quick picks), club, fit only, and the count. */
function poolFiltersHTML(){
  const pos=S.fPos,team=S.fTeam,q=S.fSearch||"",max=S.fMax,n=filtered("planner").length;
  const flags=S.flagged||[],raised=flags.reduce((t,id)=>{const o=S.model.players.find(p=>p.id===id);return t+(o?sellPrice(o):0);},0);
  const budget=+(planBank()+raised).toFixed(1);
  const sorts=[["pred","xPts"],["pred3","3GW"],["total","Pts"],["form","Form"],["price","Price"],["xmins","xMins"]];
  const tm=(S.model.teams||[]).find(t=>t.id===team);
  const priceOn=max<16-1e-9;
  const quick=[[budget,`Bank £${budget.toFixed(1)}`],[5.5,"≤ £5.5"],[7,"≤ £7.0"],[8,"≤ £8.0"],[10,"≤ £10.0"],[16,"Any"]];
  return `<div class="pf">
    <div class="pf-r1"><label class="pf-s">${lic("search",15)}<input id="srch-p" placeholder="Search players or clubs" value="${esc(q)}" oninput="searchInput('search',this)" aria-label="Search players or clubs"></label>
      <label class="pf-sort">${lic("arrow-right-left",13)}<select onchange="act('lsortset',this.value)" aria-label="Sort by">${sorts.map(([k,l])=>`<option value="${k}"${S.lSort===k?" selected":""}>${l}</option>`).join("")}</select></label></div>
    <div class="pf-pos" role="group" aria-label="Position">${[[0,"All"],[1,"GKP"],[2,"DEF"],[3,"MID"],[4,"FWD"]].map(([v,l])=>`<button class="${pos===v?"on":""}" aria-pressed="${pos===v}" onclick="act('pos',${v})">${l}</button>`).join("")}</div>
    <div class="pf-chips">
      <button class="pf-c${priceOn?" on":""}" onclick="act('poolpop','price')" aria-expanded="${S.poolPop==="price"}">£ ${priceOn?`up to ${max.toFixed(1)}`:"Any price"}${priceOn?`<span role="button" tabindex="0" aria-label="Clear price" onclick="event.stopPropagation();act('fmax',16)">${lic("x",12)}</span>`:lic("chevron-down",12)}</button>
      <label class="pf-c${team?" on":""}">${lic("shield",12)}<select onchange="act('team',this.value)" aria-label="Club"><option value="0">All clubs</option>${(S.model.teams||[]).map(t=>`<option value="${t.id}"${team===t.id?" selected":""}>${esc(t.name)}</option>`).join("")}</select>${team?`<span role="button" tabindex="0" aria-label="Clear club" onclick="event.preventDefault();event.stopPropagation();act('team',0)">${lic("x",12)}</span>`:""}</label>
      <button class="pf-c${S.fFit?" on":""}" aria-pressed="${!!S.fFit}" onclick="act('fitonly')">${lic("check",12)} Fit only</button>
      <span class="pf-n">${n} player${n===1?"":"s"}</span></div>
    ${S.poolPop==="price"?`<div class="pf-pop" role="dialog" aria-label="Max price" onclick="event.stopPropagation()"><div class="pf-ph"><b>Max price</b><span id="pf-pv">£${max.toFixed(1)}</span></div>
      <input class="pf-rng" type="range" min="3.5" max="16" step="0.1" value="${max.toFixed(1)}" aria-label="Max price"
        oninput="document.getElementById('pf-pv').textContent='£'+(+this.value).toFixed(1)" onchange="act('fmax',this.value)">
      <div class="pf-ticks"><span>£3.5</span><span>£6.0</span><span>£8.5</span><span>£11.0</span><span>£13.5</span><span>£16.0</span></div>
      <div class="pf-qk">${quick.map(([v,l])=>`<button class="${Math.abs(max-v)<0.05?"on":""}" onclick="act('fmax',${(+v).toFixed(1)})">${l}</button>`).join("")}</div></div>`:""}
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

  /* Bundle D: the Status page takes the parts it shows as cards; the
     Projection Movers panel never filled and the footnote panel is gone (C16) */
  if(arguments[0]==="parts")return{compare,status,calib,pva};
  return compare+status+calib+pva;
}
function swapCardHTML(m,g){
  return `<div class="tcard"><div class="tline">
    ${kitSm(m.out,32)}
    <span class="tp"><span class="n">${esc(m.out.web_name)}</span>
      <span class="s">${esc(m.out.teamName)} · £${m.out.price.toFixed(1)} · form ${m.out.form.toFixed(1)} · ${(m.out.gw[g]?.pts||0).toFixed(1)} xPts</span></span>
    <span class="arrow">→</span>
    ${kitSm(m.inn,32)}
    <span class="tp"><span class="n">${esc(m.inn.web_name)}</span>
      <span class="s">${esc(m.inn.teamName)} · £${m.inn.price.toFixed(1)} · ${(m.inn.gw[g]?.pts||0).toFixed(1)} xPts</span>
      <span style="display:flex;gap:5px;align-items:center;margin-top:3px">${sigHTML(m.inn,g)}</span></span>
    <span class="gain">+${m.gain.toFixed(1)}${freeLeft(g)>0?"":`<span style="display:block;font-size:10px;color:var(--red)">-${HIT} hit</span>`}</span></div>
    <span style="display:flex;gap:6px;margin-top:8px">
      <button style="flex:1" onclick="act('doswap',${m.out.id},${m.inn.id})">Make this transfer</button>
      <button onclick="act('ignore',${m.inn.id})" title="Stop suggesting this player">Ignore</button></span></div>`;
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
/* M5 (Andy, 22 Nov 2026): a real fixture the bookmakers have priced uses
   their expected goals, as the projections do (D10), so a club's Teams score
   and its players' projections agree; unpriced fixtures and the season-wide
   colour cuts use the ratings. */
function tgOne(t,opp,home,real){const od=real&&S.oddsTeams?S.oddsTeams[(t.short||"")+"|"+(opp.short||"")+(home?"|H":"|A")]:null;
  const gf=od?od.xg:fdrCalc(t,opp,home,"xgf"),gc=od?od.xgc:fdrCalc(t,opp,home,"xgc"),cs=Math.exp(-gc);
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
  const c=tgCuts(),p=tgOne(t,x.opp,x.home,true).pts;
  for(let i=0;i<4;i++)if(p<c[i])return 5-i;
  return 1;
}
const tgFx=(t,e)=>((S.model&&S.model.byEv[e])||[]).filter(f=>f.ht===t||f.at===t).map(f=>({f,opp:f.ht===t?f.at:f.ht,home:f.ht===t}));
function tgScore(t,a,b){let gf=0,cs=0,pts=0;
  for(let e=a;e<=b;e++)tgFx(t,e).forEach(x=>{const v=tgOne(t,x.opp,x.home,true);gf+=v.gf;cs+=v.cs;pts+=v.pts;});
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
  const EO=fieldEO10k(),clubEO=t=>EO?S.model.players.filter(p=>p.team===t.id).reduce((a,p)=>a+(EO[p.id]||0),0):null;
  const rows=T.map(t=>({t,pos:tb[t.id].pos,gf:tb[t.id].gf,ga:tb[t.id].ga,eo:clubEO(t),w:tgScore(t,g,g2),form:tgResults(t,5)}));
  /* sort: the colour lens's score by default; any column header re-sorts */
  const SK={pos:r=>-r.pos,gf:r=>r.gf,ga:r=>r.ga,eo:r=>r.eo||0,att:r=>r.w.gf,def:r=>r.w.cs,all:r=>r.w.pts};
  const sk=SK[S.tSort]?S.tSort:lens,dir=SK[S.tSort]?(S.tDir==="asc"?1:-1):-1;
  rows.sort((a,b)=>dir*(SK[sk](a)-SK[sk](b))||a.pos-b.pos);
  const seg=(cur,list,action)=>`<span class="hz">${list.map(([k,n])=>`<button class="${String(cur)===String(k)?"on":""}" onclick="act('${action}','${k}')">${n}</button>`).join("")}</span>`;
  const key=`<span class="tg-key"><span>Easy</span>${[1,2,3,4,5].map(d=>{const[b,c]=pdFdr(d);return `<i style="background:${b};color:${c}">${d}</i>`;}).join("")}<span>Hard</span></span>`;
  const card=`<div class="pdcard"><div class="pdbar">
    <div class="pdctl"><span class="pdl">Colour fixtures by</span>${seg(lens,[["att","Attack"],["def","Defence"],["all","Overall"]],"tlens")}</div>
    <div class="pdctl"><span class="pdl">Scores for</span>${seg(win,[[1,"1 GW"],[3,"3 GW"],[5,"5 GW"],["ros","ROS"]],"twin")}</div>
    <span class="pdsp"></span><div class="pdctl"><span class="pdl">Fixture rating</span>${key}</div></div></div>`;
  const arrow=k=>sk===k?(dir<0?" ↓":" ↑"):"";
  const sth=(k,n,sub,cls,tip)=>`<th class="${cls||""}${sk===k?" act":""}" onclick="act('tsort','${k}')" title="${esc(tip)}">${n}${arrow(k)}${sub?`<small>${sub}</small>`:""}</th>`;
  let th=`<th class="tg-club">Club</th>${sth("pos","Pos","","r","League position")}${sth("gf","Scored","","r","Goals scored this season")}${sth("ga","Conc.","","r","Goals conceded this season")}${sth("eo","EO","top 10k","r","Top 10k effective ownership of the club's players, captaincy counted")}<th class="tg-gap">Form</th>
    ${sth("att","Attack","xG / GW","tg-s","Expected goals per gameweek over "+winLbl)}${sth("def","Defence","clean sheet","tg-s","Average chance of a clean sheet over "+winLbl)}${sth("all","Overall","pts / GW","tg-s tg-gap","FPL points from goals and clean sheets per gameweek over "+winLbl+" (9 a goal, 31 a clean sheet)")}`;
  for(let e=g;e<=38;e++)th+=`<th class="tg-gw${e<=g2?" in":""}">GW${e}</th>`;
  const ncol=9+(38-g+1);
  const body=rows.map(r=>{
    let cells="";
    for(let e=g;e<=38;e++){const xs=tgFx(r.t,e);
      cells+=`<td class="tg-gw${e<=g2?" in":""}">${xs.length?xs.map(x=>{const d=tgBand(r.t,x,lens),[b,c]=pdFdr(d);
        return fxChip(x.opp.short,x.home,d,{cls:"tg-fx",attr:` onclick="act('tmatch',${e})"`,title:`GW${e}: ${x.opp.name} ${x.home?"(home)":"(away)"} · difficulty ${d}`});}).join("")
        :fxBlank("No match this gameweek","tg-fx")}</td>`;}
    const open=S.tOpen===r.t.short;
    const num=k=>`<td class="tg-n${sk===k?" act":""}${k==="all"?" tg-gap":""}">${tgFmt(TG_KEY[k],r.w[TG_KEY[k]])}</td>`;
    let tr=`<tr class="tg-r${open?" open":""}" data-club="${r.t.short}">
      <td class="tg-club"><button class="tg-cb" onclick="act('topen','${r.t.short}')" aria-expanded="${open}">${badgeOrShirt(r.t,22)}<b>${esc(r.t.name||r.t.short)}</b><span class="tg-car" aria-hidden="true">${open?"▾":"▸"}</span></button></td>
      <td class="r mono">${r.pos}</td><td class="r mono" data-k="gf">${r.gf}</td><td class="r mono" data-k="ga">${r.ga}</td><td class="r mono" data-k="eo">${r.eo==null?"—":Math.round(r.eo)+"%"}</td><td class="tg-gap">${tgForm(r.form)}</td>
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
    for(let e=g;e<=g2;e++)tgFx(t,e).forEach(x=>{const v=tgOne(t,x.opp,x.home,true);gf+=v.gf;gc+=v.gc;cs+=v.cs;fx.push({e,...x});});
    return{t,gf:gf/n,gc:gc/n,cs:cs/n,fx};});
  return{g,g2,win,rows};
}
const tgRanked=(rows,d)=>rows.slice().sort((a,b)=>d.dir*(b[d.k]-a[d.k])||String(a.t.name).localeCompare(b.t.name));
const tgOpps=r=>[...new Set(r.fx.slice(0,3).map(x=>x.opp.short))].join(" · ");
function tgTargetsHTML(){
  const{win,rows}=tgTargetRows(),wl=win===1?"1 GW":win==="ros"?"ROS":win+" GW";
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
    return fxChip(x.opp.short,home,band,{title:`GW${x.e}: ${vs?x.opp.name+(home?" at home to ":" away at ")+r.t.name:(home?"v ":"at ")+x.opp.name}`});}).join("")+(r.fx.length>6?`<em>+${r.fx.length-6}</em>`:"");
  const ctl=`<span class="hz">${[[1,"1 GW"],[3,"3 GW"],[5,"5 GW"],["ros","ROS"]].map(([k,n])=>`<button class="${String(win)===String(k)?"on":""}" onclick="act('twin','${k}')">${n}</button>`).join("")}</span>`;
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
function buildOptimal(kind,gw,budget,full,form,opt,solved){
  if(!solved&&(typeof solver==="undefined"||!solver.Solve))return null;   // library failed to load — fall back
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
  /* solved: "model" asks only for the model (the worker solves it);
     otherwise {result, ms} is the worker's answer to finish here */
  if(solved==="model")return {model,key};
  const t0=Date.now();
  let result;
  if(solved&&solved.result!==undefined)result=solved.result;
  else{try{result=solver.Solve(model);}catch(e){result=null;}}
  const ms=solved&&solved.ms!=null?solved.ms:Date.now()-t0;
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
/* C7 (audit, 22 Nov 2026): counts full optimiser runs, so the chip curves
   (cached on chipSig) refresh once the full Free Hit team replaces the quick one */
let _optDone=0;
/* 26 Nov 2026: the full solve runs in a Web Worker (lp-worker.js), so the
   page stays responsive (the Wildcard one took about 2 seconds on the page's
   thread, freezing every click after opening Chips). Without workers (tests,
   old browsers) it runs as before, on a timer. */
let _lpW=null,_lpSeq=0;const _lpWait={};
function lpWorker(){
  if(_lpW!==null)return _lpW||null;
  try{_lpW=typeof Worker==="function"?new Worker("./lp-worker.js"):false;}catch(e){_lpW=false;}
  if(_lpW){_lpW.onmessage=e=>{const d=e.data||{},f=_lpWait[d.id];if(f){delete _lpWait[d.id];f(d);}};
    _lpW.onerror=()=>{Object.values(_lpWait).forEach(f=>f({result:undefined}));Object.keys(_lpWait).forEach(k=>delete _lpWait[k]);_lpW=false;};}
  return _lpW||null;
}
/* answers from the worker land one by one; redraw once they settle */
let _optRedraw=null;
function optRedraw(){
  clearTimeout(_optRedraw);
  _optRedraw=setTimeout(()=>{_optRedraw=null;if(S.tab==="chips"||S.cmp||S.pop)render();
    /* not on show: refresh Chips quietly so it opens ready */
    else if(typeof requestIdleCallback==="function")requestIdleCallback(()=>{if(S.model&&S.tab!=="chips")try{chipsHTML();}catch(e){}},{timeout:4000});},Object.keys(_optPending).length?400:60);
}
function buildOptimalAsync(kind,gw,budget,form,opt){
  const w=lpWorker();
  if(!w)return new Promise(res=>setTimeout(()=>res(buildOptimal(kind,gw,budget,true,form,opt)),60));
  const m=buildOptimal(kind,gw,budget,true,form,opt,"model");
  if(!m||!m.model)return Promise.resolve(m);                 // cached already, or no pool
  const id=++_lpSeq;
  return new Promise(res=>{_lpWait[id]=d=>{
    /* the worker failed: solve here as before */
    if(d.result===undefined)return res(buildOptimal(kind,gw,budget,true,form,opt));
    res(buildOptimal(kind,gw,budget,true,form,opt,{result:d.result,ms:d.ms}));};
    w.postMessage({id,model:m.model});});
}
function optimalSquad(kind,gw,budget,form,opt){
  const fullKey="opt|"+kind+"|"+gw+"|"+(form||"")+"|"+budget.toFixed(1)+"|full"+optKey(opt);
  if(_sqCache[fullKey])return _sqCache[fullKey];
  const fast=buildOptimal(kind,gw,budget,false,form,opt);
  if(_sqCache[fullKey]===undefined&&!_optPending[fullKey]){
    _optPending[fullKey]=1;
    buildOptimalAsync(kind,gw,budget,form,opt).catch(()=>null).then(()=>{delete _optPending[fullKey];if(_sqCache[fullKey])_optDone++;
      /* only a stored result is worth a redraw: without the solver nothing is
         stored, and redrawing would schedule the same run again */
      if(_sqCache[fullKey])optRedraw();});
  }
  return fast?Object.assign({},fast,{checking:!!_optPending[fullKey]}):null;
}
/* o {val, tag}: score players by another measure (the Chips page's
   hindsight builds the team the app would have picked before a past
   deadline from that week's saved predictions) */
function buildSquad(kind,gw,form,budget,o){
  const key=kind+"|"+gw+"|"+(form||"auto")+"|"+budget.toFixed(1)+"|"+(S.model?S.model.players.length:0)+(o?"|"+o.tag:"");
  if(_sqCache[key])return _sqCache[key];
  const weeks=kind==="wildcard"?5:1;
  /* each player's value worked out once (the sorts below ask for it thousands of times) */
  const val0=o&&o.val?o.val:p=>{let t=0;for(let e=gw;e<gw+weeks&&e<=38;e++)t+=(p.gw[e]?.pts||0);return t/weeks;};
  const _vc=new Map(),val=p=>{let v=_vc.get(p);if(v===undefined){v=val0(p);_vc.set(p,v);}return v;};
  const pool=o?S.model.players.filter(p=>val(p)>0):S.model.players.filter(p=>p.avail>0&&p.gw[gw]&&!p.gw[gw].blank&&val(p)>0);
  if(pool.length<30)return null;
  const by={1:[],2:[],3:[],4:[]};
  pool.forEach(p=>by[p.pos]&&by[p.pos].push(p));
  const rank=(a,b)=>(val(b)-val(a))||(b.owned-a.owned);
  Object.values(by).forEach(a=>a.sort(rank));
  const shapes=form?[form.split("-").map(Number)]:FORMS;
  const need=RULES.squad;
  /* the cheapest first, sorted once rather than for every formation */
  const cheapBy={};[1,2,3,4].forEach(pos=>{cheapBy[pos]=by[pos].slice().sort((a,b)=>a.price-b.price||rank(a,b));});
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
      const cheap=cheapBy[pos];
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
      xi.forEach(out=>{const vo=val(out);for(const q of by[out.pos]){
        /* by[pos] runs best first: past his value no swap can keep the projection */
        if(val(q)<vo-1e-9)break;
        if(xi.includes(q)||bench.includes(q))continue;
        const extra=q.price-out.price;
        if(extra<=0||extra>spare+1e-9)continue;
        if(q.team!==out.team&&(club[q.team]||0)>=3)continue;
        const dd=val(q)-vo;
        if(dd>=-1e-9&&(!pick||dd>pick.dd))pick={out,inn:q,dd};}});
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
const chipTile=(k,sz,solid,ring)=>{const u=CHIP_UI[k];
  return `<span class="cx-ct${solid?" solid":""}${ring?" "+ring:""}" style="--tc:${u.c};width:${sz}px;height:${sz}px;font-size:${Math.max(8,Math.round(sz*.4))}px" aria-hidden="true">${u.s}</span>`;};
const chipKeyName=k=>`${CHIP_UI[chipKind(k)].n} ${k.endsWith("2")?"2":"1"}`;
const sgnPts=v=>(v>=0?"+":"−")+Math.abs(v).toFixed(1);
const sgnInt=v=>(v>=0?"+":"−")+Math.abs(Math.round(v));
let _chipPlanList=[];
/* ============================================================
   CHIPS PAGE v3 (21 Nov 2026, Andy). Header scoreboard per half, season
   roadmap, Chips Left (a slot per gameweek) and Chips Used, Remaining Plans
   (a box per chip, three weeks each, hover for where the points come from)
   and the Best Plan; the Chip Report pop-up holds every season, how well
   each chip was picked and rivals' chips. Chips show as letter tiles (WC,
   FH, BB, TC) everywhere. All gains on the Planner's team score; the plan
   is S.chips, the same schedule the Planner uses.
   ============================================================ */
/* 26 Nov 2026: Chips' heavy work (chip curves, the quick builder, the
   solver queue) runs once the site sits idle after loading, so opening Chips
   is instant. Browsers without requestIdleCallback (the tests) skip it. */
let _warmT=null;
function warmChips(){
  if(typeof requestIdleCallback!=="function")return;
  clearTimeout(_warmT);
  _warmT=setTimeout(()=>requestIdleCallback(()=>{
    if(!S.model||S.loading||S.tab==="chips")return;
    try{chipsHTML();}catch(e){}},{timeout:6000}),3500);
}
function chipsHTML(){
  if(!S.model)return "";
  const g=S.model.next.id,left=chipsLeft(),played=((S.tracker&&S.tracker.gw)||[]).filter(r=>r.chip).sort((a,b)=>a.event-b.event);
  const ups=trkChipUplifts();
  const plans=chipPlans();_chipPlanList=plans;
  const rec=plans[0]?plans[0].pick:{},sel=chipSelectedPlan(),selPick=sel?sel.pick:{};
  const KORD=["wildcard","freehit","bboost","3xc"],RK={wildcard:"WC",freehit:"FH",bboost:"BB","3xc":"TC"};
  const LAB={wildcard:"Wild Card",freehit:"Free Hit",bboost:"Bench Boost","3xc":"Triple Captain"};
  const upOf=k=>{const c=ups[`${LAB[chipKind(k)]} ${k.endsWith("2")?2:1}`];return c&&c.uplift!=null?+c.uplift:null;};
  /* the week shown for a chip still to play: your plan, else its week in
     the selected plan (your planned chips held, the rest at their best),
     else its best week. The roadmap, header, Chips Left, Remaining Plans
     and Best Plan all use this, and the Team Planner shows S.chips */
  const weekOf=k=>S.chips[k]||(selPick[k]||[])[0]||(chipBestWeeks(k)[0]||[])[0]||null;

  /* ---- every season's chip weeks and gains ---- */
  const SEAS=[curSeasonLabel(),...Object.keys(CHIP_WEEKS)],prevS=SEAS[1];
  const TH=TRACKER_HISTORY.chips,LBL={"Wild Card 1":"WC1","Wild Card 2":"WC2","Free Hit 1":"FH1","Free Hit 2":"FH2","Bench Boost 1":"BB1","Bench Boost 2":"BB2","Triple Captain 1":"TC1","Triple Captain 2":"TC2"};
  const seasonOfLabel=l=>`${+l-1}/${String(l).slice(2)}`;
  const GN={};TH.labels.forEach((l,i)=>{const s=seasonOfLabel(l);GN[s]={};Object.entries(TH.rows).forEach(([n,vals])=>{if(vals[i]!=null)GN[s][LBL[n]]=vals[i];});});
  const CW=Object.assign({},CHIP_WEEKS,{[curSeasonLabel()]:{}});GN[curSeasonLabel()]={};
  Object.values(ups).forEach(c=>{const r=LBL[c.label];if(r){CW[curSeasonLabel()][r]=c.event;GN[curSeasonLabel()][r]=c.uplift;}});
  const H=chipHindsight(),KN={wildcard:"wc",freehit:"fh",bboost:"bb","3xc":"tc"};
  const hsArr=k=>H?(H[KN[chipKind(k)]]||[]).filter(x=>k.endsWith("2")?x.e>=20:x.e<=19):[];

  /* ---- one chip's facts: week, gain, last season, best week, average ---- */
  const fact=k=>{const kind=chipKind(k),r=RK[kind]+(k.endsWith("2")?"2":"1"),pe=chipPlayed(k);
    const last=(GN[prevS]||{})[r]??null;
    const past=SEAS.slice(1).flatMap(s=>[RK[kind]+"1",RK[kind]+"2"].map(x=>(GN[s]||{})[x])).filter(x=>x!=null),avg=past.length?past.reduce((a,b)=>a+b,0)/past.length:null;
    if(pe!=null){const v=upOf(k),fin=weekFinal(pe);
      /* the bars, with the week you played showing what you actually got
         (FPL's figure, as Chips Used); not scored until that week is final */
      const arr=hsArr(k).filter(x=>x.e!==pe);if(fin&&v!=null)arr.push({e:pe,v,mine:true});arr.sort((a,b)=>a.e-b.e);
      const best=arr.length?arr.reduce((m,x)=>x.v>m.v?x:m):null;
      const pct=fin&&best&&v!=null&&best.v>0?Math.round(clamp(v/best.v,0,1)*100):null;
      return{k,kind,st:"played",e:pe,v,last,avg,best,pct,arr,fin};}
    if(k.endsWith("1")&&g>19)return{k,kind,st:"expired",e:null,v:null,last,avg};
    const e=weekOf(k);
    return{k,kind,st:S.chips[k]?"planned":"projected",e,v:e?((chipCurve(k)[e]||{}).v??null):null,last,avg};};
  const F={};[1,2].forEach(h=>KORD.forEach(kd=>F[kd+h]=fact(kd+h)));

  /* ---- header: a scoreboard for each half ---- */
  const STL={played:"Played",planned:"Planned",projected:"Suggested",expired:"Expired"};
  const sCell=f=>`<div class="cx-sc ${f.st}" title="${esc(chipKeyName(f.k))}">${chipTile(f.kind,34,f.st==="played",f.st==="planned"?"ring":f.st==="projected"?"dash":"")}
    <div><span class="cx-scl">${STL[f.st]}</span><b>${f.e?"GW"+f.e:"—"}</b><i class="${f.v==null?"mu":f.v>=0?"up":"dn"}${f.st!=="played"?" pj":""}">${f.v==null?"—":f.st==="played"?sgnInt(f.v):sgnPts(f.v)}</i></div></div>`;
  const sHalf=h=>{const fs=KORD.map(kd=>F[kd+h]),pl=fs.filter(f=>f.st==="played"),got=pl.reduce((a,f)=>a+(f.v||0),0);
    const pj=fs.filter(f=>f.st==="planned"||f.st==="projected"),pjv=pj.reduce((a,f)=>a+(f.v||0),0);
    return `<div class="cx-sh"><div class="cx-shh"><b>GW${h===1?"1–19":"20–38"}</b><span>${pl.length?`<em class="up">${sgnInt(got)}</em> gained`:""}${pl.length&&pj.length?" · ":""}${pj.length?`<em>${sgnPts(pjv)}</em> projected`:""}</span></div>
      <div class="cx-shc">${fs.map(sCell).join("")}</div></div>`;};
  const head=`<div class="cx-hdr"><div><div class="cx-kick">GW${g} · ${left.length} of 8 left</div><h1>Chips</h1>
      <div class="cx-hbtn"><button class="cx-rpt" onclick="act('chippop','report')">${lic("chart-column",15)}Chip Report</button></div></div>
    <div class="cx-strip">${sHalf(1)}${sHalf(2)}</div></div>`;

  /* ---- season roadmap ---- */
  const playedAt={};played.forEach(r=>playedAt[r.event]=r);
  const onAt={};left.forEach(k=>{const e=weekOf(k);if(e&&!onAt[e])onAt[e]=k;});
  const pick=left.includes(S.chipPick)?S.chipPick:null;
  const dragA=k=>` draggable="true" ondragstart="chipDrag(event,'${k}')" onclick="event.stopPropagation();act('chippick','${k}')"`;
  const okFor=(k,e)=>e>=g&&(k.endsWith("2")?e>=20:e<=19);
  const cols=[];for(let e=1;e<=38;e++){const m=chipWeekMark(e),pr=playedAt[e],on=onAt[e];
    const pk=pr?pr.chip+(pr.event>=20?"2":"1"):null,pv=pk?upOf(pk):null;
    const tok=pr?chipTile(pr.chip,28,true):on?`<span class="cx-dg${pick===on?" pk":""}"${dragA(on)} title="${esc(chipKeyName(on))}: drag to another week, or click it then a week">${chipTile(chipKind(on),28,false,S.chips[on]?"ring":"dash")}</span>`:"";
    const pts=pr?(pv==null?"":`<span class="cx-rp ${pv>=0?"up":"dn"}">${sgnInt(pv)}</span>`):on?`<span class="cx-rp pj">${sgnInt(((chipCurve(on)[e]||{}).v)||0)}</span>`:"";
    const tip=pr?`GW${e}: ${CHIP_UI[pr.chip].n} played`:on?`GW${e}: ${chipKeyName(on)} ${S.chips[on]?"planned":"suggested"}`:"";
    const drop=e>=g?` ondragover="event.preventDefault()" ondragenter="this.classList.add('dz')" ondragleave="this.classList.remove('dz')" ondrop="this.classList.remove('dz');chipDrop(event,${e})"`+(pick?` onclick="act('chipplace',${e})"`:""):"";
    cols.push(`<div class="cx-rc${e===g?" now":""}${e<g?" past":""}${e===20?" h2":""}${pick&&okFor(pick,e)?" tgt":""}"${tip?` title="${esc(tip)}"`:""}${drop}>
      <span class="cx-rgw">${e}</span><span class="cx-rfx">${m?`<i class="cx-fx ${m.t==="blank"?"bl":m.p>=0.6?"dl":"dp"}" title="${esc((m.t==="blank"?"Blank":"Double")+" · "+m.why+(m.src==="Crellin"?" (Ben Crellin's forecast)":" (FPL fixtures)"))}">${m.t==="blank"?"BGW":"DGW"}</i>`:""}</span>
      <span class="cx-rch">${tok}</span><span class="cx-rpts">${pts}</span></div>`);}
  const legend=`<span class="cx-lg"><span><i class="cx-sw solid"></i>played</span><span><i class="cx-sw ring"></i>planned</span><span><i class="cx-sw dash"></i>suggested</span><span class="cx-sep"></span>
    <span><i class="cx-ld bl"></i>blank</span><span><i class="cx-ld dl"></i>likely double</span><span><i class="cx-ld dp"></i>possible double</span></span>`;
  const roadmap=rep("chroad","calendar-range","Season Chip Roadmap",
    `Every gameweek with the chips you played, planned and could play.`,
    `<div class="cx-rm${pick?" picking":""}"><span class="cx-half" style="grid-column:1/20">First half · GW1–19</span><span class="cx-half h2l" style="grid-column:20/39">Second half · GW20–38</span>${cols.join("")}</div>`,{wide:true,extra:(pick?`<span class="cx-pickh">Click a week for ${esc(chipKeyName(pick))} <button class="cx-ghost sm" onclick="event.stopPropagation();act('chippick','')">Cancel</button></span>`:"")+legend});

  /* ---- each chip's full chart (opens from Chips Left) ---- */
  const READY={bboost:"What your bench adds to the Planner score that week.",
    "3xc":"Your best player's points again, plus the captain cover.",
    freehit:"The best team you can afford that week, minus yours.",
    wildcard:"The best squad over the next five weeks minus the squad one free transfer a week would reach anyway, later weeks × 0.85."};
  const bwRow=k=>{const kind=chipKind(k),cv=chipCurve(k),weeks=Object.keys(cv).map(Number).sort((a,b)=>a-b);
    if(!weeks.length)return "";
    const bests=chipBestWeeks(k),planned=S.chips[k],sel=planned||weekOf(k),top3=bests.slice(0,3).map(x=>x[0]);
    const mx=Math.max(...weeks.map(e=>cv[e].v),0.1);
    const bars=weeks.map(e=>{const o=cv[e],why=chipRuleBreak(k,e),h=Math.max(4,Math.round(Math.max(0,o.v)/mx*72)),f=o.f;
      return `<button class="cx-bw${e===sel?" sel":""}${why&&e!==planned?" no":""}" onclick="act('setchip','${k}',${e})"
        title="${esc(why&&e!==planned?why:`GW${e}: ${sgnPts(o.v)} pts${f?` (${f.t} ${f.why}, weighted for how likely)`:""}. Click to plan.`)}">
        <span class="cx-bv">${top3.includes(e)||e===sel?sgnPts(o.v):""}</span><span class="cx-bb${f?" hx":""}" style="height:${h}px;--tc:${CHIP_UI[kind].c}"></span>
        <span class="cx-bn">${e}</span><span class="cx-bf">${f?`<i class="cx-fx ${f.t==="blank"?"bl":f.p>=0.6?"dl":"dp"}">${f.t==="blank"?"BGW":"DGW"}</i>`:""}</span></button>`;}).join("");
    const b0=bests[0],alts=bests.filter(x=>x[0]!==sel).slice(0,2).map(([e,v])=>`GW${e} ${sgnPts(v)}`).join(" · ");
    const selV=sel?((cv[sel]||{}).v||0):0;
    return `<div class="cx-bwr"><div class="cx-bwi">
        <div class="cx-bwt">${chipTile(kind,30)}<b>${chipKeyName(k)}</b><button class="fci" data-tip="${esc(READY[kind]+(k.endsWith("1")?" First-half chips expire at the GW19 deadline.":""))}" aria-label="About ${esc(chipKeyName(k))}">i</button></div>
        <div class="cx-bwk"><div><div class="cx-bwl">${planned?"Planned":"Roadmap week"}</div><div class="cx-bwv">GW${sel}</div></div><div class="cx-bwg ${selV>=0?"up":"dn"}">${sgnPts(selV)}<span>pts</span></div></div>
        <div class="cx-alts">${b0&&b0[0]!==sel?`Best week: GW${b0[0]} ${sgnPts(b0[1])} · `:""}Next best: ${alts||"—"}</div>
        ${planned?`<div class="cx-btns"><button class="cx-ghost" onclick="act('clearchip','${k}')">Clear plan</button></div>`
          :`<div class="cx-btns"><button class="cx-ghost" onclick="act('setchip','${k}',${sel})">Plan for GW${sel}</button></div>`}
      </div><div class="cx-bwc"><div class="cx-bars">${bars}</div></div></div>`;};

  /* ---- chips left: a slot per gameweek, so every bar is the same width ---- */
  const leftRow=k=>{const kind=chipKind(k),cv=chipCurve(k),h2=k.endsWith("2"),e=weekOf(k),planned=S.chips[k],v=e?((cv[e]||{}).v||0):0;
    const mx=Math.max(...Object.values(cv).map(o=>o.v),0.1);let bars="";
    for(let w=h2?20:1;w<=(h2?38:19);w++){const o=cv[w];
      bars+=o?`<span class="cx-ms${w===planned?" pl":""}" onclick="event.stopPropagation();act('chipset','${k}',${w})" title="GW${w}: ${sgnPts(o.v)}. ${w===planned?"Click to clear the plan.":`Click to plan ${esc(chipKeyName(k))} here.`}"><i class="${w===e?"on":""}${o.f?" hx":""}" style="height:${Math.max(6,Math.round(Math.max(0,o.v)/mx*100))}%;--tc:${CHIP_UI[kind].c}"></i></span>`:`<span class="cx-ms nil"><i></i></span>`;}
    return `<div class="cx-cr" onclick="act('chippop','${k}')" role="button" tabindex="0" title="${esc(chipKeyName(k))}: every week's gain">
      ${chipTile(kind,30,false,planned?"ring":"")}<span class="cx-crn"><b>${chipKeyName(k)}</b><span>${planned?"Planned":"Suggested"}${h2?"":" · expires GW19"}</span></span>
      <span class="cx-mini">${bars}</span><span class="cx-crw"><b>GW${e||"—"}</b><i class="${v>=0?"up":"dn"}">${sgnPts(v)}</i></span>
</div>`;};
  const axisRow=h2=>{let a="";for(let w=h2?20:1;w<=(h2?38:19);w++)a+=`<span>${w%(PHONE()?5:2)===0?w:""}</span>`;return `<div class="cx-cr ax"><span></span><span></span><span class="cx-mini cx-axis">${a}</span><span></span></div>`;};
  const leftH=[1,2].map(h=>left.filter(k=>k.endsWith(String(h)))).filter(a=>a.length);
  const chipsLeftSec=rep("chleft","target","Chips Left",
    "Each chip still to play and its best weeks.",
    leftH.map(a=>a.map(leftRow).join("")+axisRow(a[0].endsWith("2"))).join("")||`<p class="note">No chips left this season.</p>`,{wide:true});

  /* ---- chips used ---- */
  const usedF=Object.values(F).filter(f=>f.st==="played").sort((a,b)=>a.e-b.e);
  const usedRow=f=>{const d=f.v!=null&&f.last!=null?f.v-f.last:null,pc=f.pct;
    const pcol=pc==null?"":pc>=80?"var(--mint)":pc>=50?"var(--amber)":"var(--red)";
    return `<div class="cx-ur">${chipTile(f.kind,30,true)}<span class="cx-crn"><b>${chipKeyName(f.k)}</b><span>GW${f.e}</span></span>
      <b class="cx-ug ${f.v==null?"":f.v>=0?"up":"dn"}">${f.v==null?"—":sgnInt(f.v)}</b>
      <span>${f.last==null?`<b class="mu">—</b>`:`<b>${sgnInt(f.last)}</b>${d==null?"":`<i class="${d>=0?"up":"dn"}">${d>=0?"▲":"▼"} ${Math.abs(Math.round(d))}</i>`}`}</span>
      <span>${f.best?`<b>GW${f.best.e}</b><i class="${f.best.v>=0?"up":"dn"}">${sgnInt(f.best.v)}</i>`:`<b class="mu">—</b>`}</span>
      <b class="cx-uav">${f.avg==null?"—":sgnInt(f.avg)}</b>
      <span class="cx-upk">${pc==null?`<b class="mu">—</b>`:`<b style="color:${pcol}">${pc}%</b><span class="cx-pm"><i style="width:${pc}%;background:${pcol}"></i></span>`}</span></div>`;};
  const chipsUsedSec=rep("chused","circle-check","Chips Used",
    `Each chip you played and what it gained.`,
    usedF.length?`<div class="cx-ur hd"><span></span><span></span><span>Gained</span><span>${esc(seasonShort(prevS))}</span><span>Best week</span><span>Your avg</span><span>Your pick</span></div>${usedF.map(usedRow).join("")}`
      :`<p class="note">No chips played yet this season.</p>`,{wide:true});

  /* ---- remaining plans: a box per chip, its best three weeks ---- */
  const tipFor=(k,e)=>{const kind=chipKind(k),ids=effectiveSquadIds(e).ids,sp=ids.map(chipPlayer).filter(Boolean),pv=p=>p.gw[e]?.pts||0;
    const o=chipCurve(k)[e]||{},v=o.v||0;
    const row=(p,lbl)=>`<span class="cx-tr"><span class="cx-tpos">${lbl||POS[p.pos]}</span><b>${esc(p.web_name)}</b><span class="cx-tfx">${fxGW(p,e)}</span><span class="cx-tv">${pv(p).toFixed(1)}</span></span>`;
    let body="",foot="";
    if(kind==="bboost"){const xi=legalBestXI(sp,pv),bench=sp.filter(p=>!xi.includes(p)),dbl=bench.filter(p=>(p.gw[e]?.fixtures||[]).length>1).length;
      body=`<span class="cx-tl">Your bench that week, every game it plays:</span>${bench.map(p=>row(p)).join("")}`;
      foot=dbl?`${dbl} of your bench play twice.`:"";}
    else if(kind==="3xc"){const xi=legalBestXI(sp,pv),cap=xi.reduce((m,p)=>!m||pv(p)>pv(m)?p:m,null);
      body=cap?`<span class="cx-tl">Your captain's points count a third time:</span>${row(cap,"C")}`:"";}
    else{const T=chipTeam(kind,e,false);
      if(T){const mine=new Set(ids),ins=T.t.xi.concat(T.t.bench).filter(p=>!mine.has(p.id)).sort((a,b)=>pv(b)-pv(a));
        body=`<span class="cx-tl">${kind==="freehit"?`Free Hit team ${teamScore(T.ids,e,null).toFixed(1)} against yours ${teamScore(ids,e,null).toFixed(1)}. The biggest new names:`:`${ins.length} new players. The biggest that week:`}</span>${ins.slice(0,4).map(p=>row(p)).join("")}`;
        if(kind==="wildcard")foot="The gain counts five weeks against the squad one free transfer a week would reach anyway, later weeks a little less.";}}
    if(o.f)foot+=(foot?" ":"")+`Weighted for Ben Crellin's forecast ${o.f.t} (${o.f.why}).`;
    return `<span class="cx-htip" role="tooltip"><span class="cx-thh">${chipTile(kind,18,false,"dash")}<b>${chipKeyName(k)} · GW${e}</b><span class="up">${sgnPts(v)}</span></span>${body}<span class="cx-tf">${foot||"Points are the Planner's projections."}</span></span>`;};
  const rpBox=kind=>{const ks=[kind+"1",kind+"2"],avail=ks.filter(k=>left.includes(k)),usable=ks.filter(k=>left.includes(k)||chipPlayed(k)!=null);
    /* 1 and 2 toggle (22 Nov 2026, Andy): a chip still to play shows its
       best weeks to plan; a played chip shows the week you played it, then
       the two best weeks you could have played it in (GW1-19 for 1, GW20
       on for 2), scored as in How Well You Picked */
    const want=(S.chipRP||{})[kind],sel=usable.includes(want)?want:(avail[0]||usable[usable.length-1]||null);
    const pills=ks.map(k=>{const pe=chipPlayed(k),n=k.slice(-1);
      if(!usable.includes(k))return `<span class="cx-pp off" title="${esc(chipKeyName(k))}: expired">${n} –</span>`;
      const lab=pe!=null?`${n} ✓`:n,tt=pe!=null?`${chipKeyName(k)}: played GW${pe}`:`${chipKeyName(k)}: still to play`;
      return usable.length>1?`<button class="cx-pp${k===sel?" pick":""}" onclick="act('chiprp','${kind}','${k}')" title="${esc(tt)}">${lab}</button>`:`<span class="cx-pp pick" title="${esc(tt)}">${lab}</span>`;}).join("");
    const pe=sel?chipPlayed(sel):null;
    const top=`<div class="cx-rbh">${chipTile(kind,26,pe!=null||!sel,pe==null&&sel?(S.chips[sel]?"ring":"dash"):"")}<b>${CHIP_UI[kind].n}</b><span class="cx-pps">${pills}</span></div>`;
    const fade=avail.length?"":" done";
    if(!sel)return `<div class="cx-rbox done" style="--tc:${CHIP_UI[kind].c}">${top}<div class="cx-rdone">None left</div></div>`;
    if(pe!=null){const f=F[sel]||{},alt=(f.arr||[]).filter(x=>x.e!==pe).sort((a,b)=>b.v-a.v).slice(0,2),tiles=[{e:pe,v:f.v,me:true},...alt];
      const note=!f.fin?`Played GW${pe} · not final yet`:f.pct==null?`Played GW${pe}`:f.best&&f.best.e===pe?"Played in the best week":`Played · ${f.pct}% of the best week`;
      return `<div class="cx-rbox${fade}" style="--tc:${CHIP_UI[kind].c}">${top}
        <div class="cx-ro">${tiles.map(x=>{const mk=chipWeekMark(x.e);
          return `<div class="cx-roo ro${x.me?" pick":""}" title="${esc(x.me?`GW${x.e}: you played it, ${x.v==null?"points not in yet":sgnInt(x.v)} (FPL's figure)`:`GW${x.e}: ${sgnInt(x.v)} if played that week (hindsight)`)}">${mk?`<i class="cx-fx cx-ft ${mk.t==="blank"?"bl":mk.p>=0.6?"dl":"dp"}">${mk.t==="blank"?"BGW":"DGW"}</i>`:""}<b>GW${x.e}</b><i class="cx-rov${x.v!=null&&x.v<0?" dn":""}">${x.v==null?"—":sgnInt(x.v)}</i>${x.me?`<span class="cx-rmk">Played</span>`:""}</div>`;}).join("")}</div>
        <div class="cx-rbf"><span>${note}</span></div></div>`;}
    const cv=chipCurve(sel),bests=chipBestWeeks(sel),road=weekOf(sel),planned=S.chips[sel];
    let opts=bests.slice(0,3).map(x=>x[0]);if(road&&!opts.includes(road))opts=[...opts.slice(0,2),road];
    opts.sort((a,b)=>((cv[b]||{}).v||0)-((cv[a]||{}).v||0));
    const tw=(bests[0]||[])[0],clash=!planned&&tw&&tw!==road?(Object.entries(S.chips).find(([k2,e2])=>k2!==sel&&e2===tw)||Object.entries(selPick).map(([k2,[e2]])=>[k2,e2]).find(([k2,e2])=>k2!==sel&&e2===tw)):null;
    const m=road?chipWeekMark(road):null;
    const note=planned?`Planned${m?` · ${m.t==="blank"?"blank":m.p>=0.6?"likely double":"possible double"} week`:""}`:clash?`GW${tw} goes to ${chipKeyName(clash[0])}`:`Suggested${m?` · ${m.t==="blank"?"blank":m.p>=0.6?"likely double":"possible double"} week`:""}`;
    return `<div class="cx-rbox${fade}" style="--tc:${CHIP_UI[kind].c}">${top}
      <div class="cx-ro">${opts.map(e=>{const v=(cv[e]||{}).v||0,mk=chipWeekMark(e);
        return `<button class="cx-roo${e===road?" pick":""}" onclick="act('chipset','${sel}',${e})" aria-label="${esc(`${chipKeyName(sel)} GW${e} ${sgnPts(v)}. ${e===planned?"Clear the plan.":"Plan it."}`)}">${mk?`<i class="cx-fx cx-ft ${mk.t==="blank"?"bl":mk.p>=0.6?"dl":"dp"}">${mk.t==="blank"?"BGW":"DGW"}</i>`:""}<b>GW${e}</b><i class="cx-rov">${sgnPts(v)}</i>${e===road?`<span class="cx-rmk">${planned?"Planned":"Suggested"}</span>`:""}${tipFor(sel,e)}</button>`;}).join("")}</div>
      <div class="cx-rbf"><span>${note}</span></div></div>`;};
  const remainingSec=rep("chrem","layers","My Plan",
    "Each chip's best three weeks; click a week to plan it.",
    `<div class="cx-rgrid">${KORD.map(rpBox).join("")}</div>`,{wide:true});

  /* ---- best plan: the top three whole plans for the chips left ---- */
  const inUse=p=>Object.entries(p.pick).every(([k,[e]])=>S.chips[k]===e);
  const selD=sel&&plans[0]?sel.tot-plans[0].tot:0;
  const selRow=sel?`<div class="cx-bp mine"><span class="cx-bpr">${lic("circle-check",14)}</span><div class="cx-bpn"><b>Selected Plan</b><button class="fci" data-tip="Your planned chips, the rest at their suggested weeks." aria-label="About Selected Plan">i</button></div>
      <span class="cx-bpt">${sgnPts(sel.tot)}</span><span class="cx-bpd ${selD>=-0.05?"up":"dn"}">${Math.abs(selD)<0.05?"Matches best":sgnPts(selD)+" v best"}</span>
      <div class="cx-bps">${Object.entries(sel.pick).sort((a,b)=>a[1][0]-b[1][0]).map(([k,[e,v]])=>`<span class="cx-bpx" title="${esc(chipKeyName(k)+" GW"+e+" "+sgnPts(v)+(S.chips[k]?" (planned)":" (suggested)"))}">${chipTile(chipKind(k),24,false,S.chips[k]?"ring":"dash")}<b>GW${e}</b><i>${sgnPts(v)}</i></span>`).join("")}</div></div>`:"";
  const bestSec=plans.length?rep("chbest","trophy","Best Plan",
    "Your selected plan against the two best plans.",
    selRow+plans.slice(0,2).map((p,i)=>{const u=inUse(p);return `<div class="cx-bp${i===0?" top":""}">
      <span class="cx-bpr">${i+1}</span><div class="cx-bpn"><b>${esc(p.name)}</b>${i===0?`<span class="cx-tag">Best</span>`:""}<button class="fci" data-tip="${esc(String(p.why).replace(/<[^>]*>/g,""))}" aria-label="About ${esc(p.name)}">i</button></div>
      <span class="cx-bpt up">${sgnPts(p.tot)}</span><button class="cx-ghost" onclick="act('chipplan',${i})"${u?" disabled":""}>${u?"In use":"Use"}</button>
      <div class="cx-bps">${Object.entries(p.pick).sort((a,b)=>a[1][0]-b[1][0]).map(([k,[e,v]])=>`<span class="cx-bpx" title="${esc(chipKeyName(k)+" GW"+e+" "+sgnPts(v))}">${chipTile(chipKind(k),24,false,i===0?"ring":"")}<b>GW${e}</b><i>${sgnPts(v)}</i></span>`).join("")}</div></div>`;}).join(""),{wide:true}):"";

  /* ---- chip report: every season, how well you picked, rivals ---- */
  const report=()=>{
    const ORD=SEAS.slice().reverse(),cur=curSeasonLabel();
    const KEYS=kd=>[RK[kd]+"1",RK[kd]+"2"];
    const chipCol=kind=>{const ent=[];KEYS(kind).forEach(r=>ORD.forEach(s=>{const v=(GN[s]||{})[r],w=(CW[s]||{})[r];if(v!=null&&w!=null)ent.push({r,s,w,v});}));
      const past=ent.filter(x=>x.s!==cur),now=ent.filter(x=>x.s===cur);
      const best=past.length?past.reduce((a,b)=>b.v>a.v?b:a):null,worst=past.length?past.reduce((a,b)=>b.v<a.v?b:a):null,av=past.length?past.reduce((a,b)=>a+b.v,0)/past.length:null;
      const nv=now.length?now.reduce((a,b)=>a+b.v,0):null;
      const lo=Math.min(worst?worst.v:0,nv??0,0),hi=Math.max(best?best.v:0,nv??0,1),pos=v=>((v-lo)/(hi-lo||1)*100).toFixed(1);
      /* each chip on its own scale, so its seasons are easy to compare */
      const mxK=Math.max(...ent.map(x=>Math.abs(x.v)),1),sc=v=>Math.round(Math.abs(v)/mxK*56)+2;
      const bar=(r,s)=>{const v=(GN[s]||{})[r],w=(CW[s]||{})[r],isCur=s===cur,cls=r.endsWith("1")?"h1":"h2";
        if(v==null)return `<span class="cx-mbw"${w!=null?` title="${esc(`${seasonShort(s)} · GW${w} · gain not recorded`)}"`:""}><span class="cx-mnil${w!=null?" nr":""}"></span></span>`;
        const h=sc(v),neg=v<0;
        return `<span class="cx-mbw" title="${esc(`${CHIP_UI[kind].n} ${r.slice(2)} · ${seasonShort(s)} · GW${w} · ${sgnInt(v)}`)}"><span class="cx-mbar ${cls}${neg?" n":""}${isCur?" cur":""}" style="${neg?"top:72px":"bottom:56px"};height:${neg?Math.min(h,12):h}px"></span>${isCur?`<span class="cx-mval" style="${neg?"top:"+(74+Math.min(h,12))+"px":"bottom:"+(58+h)+"px"}">${sgnInt(v)}</span>`:""}</span>`;};
      return `<div class="cx-crc" style="--tc:${CHIP_UI[kind].c}"><div class="cx-crh">${chipTile(kind,26,true)}<b>${CHIP_UI[kind].n}</b></div>
        <div class="cx-crg"><div class="cx-cre"><span>Worst</span><b class="${worst?"dn":"mu"}">${worst?sgnInt(worst.v):"—"}</b><i>${worst?`${seasonShort(worst.s)} · GW${worst.w}`:""}</i></div>
          <div class="cx-crn2"><span>This season</span><b class="${nv==null?"mu":nv>=0?"up":"dn"}">${nv==null?"—":sgnInt(nv)}</b><i>${now.map(x=>`${x.r} · GW${x.w}`).join(", ")||"not played yet"}</i></div>
          <div class="cx-cre r"><span>Best</span><b class="${best?"up":"mu"}">${best?sgnInt(best.v):"—"}</b><i>${best?`${seasonShort(best.s)} · GW${best.w}`:""}</i></div></div>
        ${av!=null?`<div class="cx-crt"><span class="cx-trk"></span><span class="cx-avm" style="left:${pos(av)}%"></span><span class="cx-avt" style="left:${pos(av)}%">Average ${sgnInt(av)}</span>${nv==null?"":`<span class="cx-nowd" style="left:${pos(nv)}%"></span>`}</div>`:""}
        <div class="cx-mchart"><span class="cx-mzero"></span>${ORD.map(s=>`<div class="cx-mgrp${s===cur?" cur":""}">${KEYS(kind).map(r=>bar(r,s)).join("")}<span class="cx-mseas">${seasonShort(s)}</span></div>`).join("")}</div></div>`;};
    const nSeas=ORD.filter(s=>s!==cur&&Object.keys(CW[s]||{}).length).length;
    const seasons=rep("chseas","trophy","Your Chips, Season by Season",
      "Each chip across every season: worst, best and this season.",
      `<div class="cx-crs">${KORD.map(chipCol).join("")}</div>`,{wide:true,extra:`<span class="cx-lg"><span><i class="cx-sw2 h1"></i>GW1–19 chip</span><span><i class="cx-sw2 h2"></i>GW20–38 chip</span><span><i class="cx-sw2 cur"></i>this season</span></span>`});
    const NOTE={"3xc":"Other weeks: your captain's points that week.",bboost:"Other weeks: your bench's points that week.",
      freehit:"Other weeks: what the app's pre-deadline Free Hit team would have scored above the squad you had.",
      wildcard:"Other weeks: what a Wildcard team would have added."};
    const hsMax=Math.max(0,...usedF.flatMap(f=>(f.arr||[]).map(x=>x.e)),...usedF.map(f=>f.e));
    const hsRow=f=>{const arr=f.arr||[],mx=Math.max(...arr.map(x=>Math.abs(x.v)),0.1),pe=f.e,bi=f.best?f.best.e:null;
      const bars=Array.from({length:hsMax},(_,i)=>arr.find(x=>x.e===i+1)||{e:i+1,nil:true}).map(x=>{
        const me=x.e===pe,bs=x.e===bi;
        if(x.nil)return `<div class="cx-hw2${me?" me":""}" title="GW${x.e}${me?": not final yet":""}"><span class="cx-hg2">${x.e}</span></div>`;
        const v=x.v||0,h=Math.round(Math.abs(v)/mx*30)+2,neg=v<0;
        return `<div class="cx-hw2${me?" me":""}${bs?" bst":""}" title="GW${x.e}: ${sgnInt(v)}${me?" (what you got)":bs?" (the best week)":""}"><span class="cx-hb3${neg?" n":""}" style="${neg?"top:38px":"bottom:20px"};height:${neg?Math.min(h,6):h}px;--tc:${CHIP_UI[f.kind].c}"></span>
          ${me||bs?`<span class="cx-hl2" style="bottom:${neg?22:22+h}px">${bs&&!me?"★":""}${sgnInt(v)}</span>`:""}<span class="cx-hg2">${x.e}</span></div>`;}).join("");
      const tip=(!f.fin?`GW${pe} is not final yet, so it is not scored. `:f.pct==null?"":f.best&&f.best.e===pe?"Your week was the best week. ":`You got ${f.pct}% of the best week, GW${f.best.e} at ${sgnInt(f.best.v)}. `)+"Your week shows what you got (FPL's figure). "+NOTE[f.kind];
      const pc=f.pct,pcol=pc==null?"":pc>=80?"up":pc>=50?"am":"dn";
      return `<div class="cx-hr2"><div class="cx-hinfo">${chipTile(f.kind,28,true)}<div><b>${chipKeyName(f.k)}</b><span>Played GW${pe}</span></div></div>
        <b class="${f.v==null?"":f.v>=0?"up":"dn"}">${f.v==null?"—":sgnInt(f.v)}</b>
        <b>${f.best?`GW${f.best.e} <i class="${f.best.v>=0?"up":"dn"}">${sgnInt(f.best.v)}</i>`:"—"}</b>
        <b class="${pcol}">${pc==null?"—":pc+"%"}</b>
        <div class="cx-hchart2" style="grid-template-columns:repeat(${hsMax},minmax(0,1fr))">${bars}</div>
        <button class="fci" data-tip="${esc(tip)}" aria-label="About ${esc(chipKeyName(f.k))}">i</button></div>`;};
    const picked=rep("chpicked","target",`How Well You Picked · ${esc(seasonShort(curSeasonLabel()))}`,
      "Your chip week against every week you could have played it.",
      usedF.length?`<div class="cx-hr2 hd"><span></span><span>You got</span><span>Best week</span><span>Your pick</span><span>Every finished week · you outlined, best ★</span><span></span></div>${usedF.map(hsRow).join("")}`:`<p class="note">No chips played yet.</p>`,{wide:true});
    const half=g>=20?2:1,ents=(S.rivalsFeed&&S.rivalsFeed.entries)||{};
    const others=Object.entries(ents).filter(([id])=>String(id)!==String(TEAM_ID)).map(([,e])=>e.chips||[]);
    const mgrs=others.length+1,inH=e=>half===1?e<=19:e>=20;
    const holdCards=Object.keys(ents).length?`<div class="cx-rvs">${KORD.map(k=>{const n=(chipPlayed(k+half)==null?1:0)+others.filter(cs=>!cs.some(c=>c.name===k&&inH(c.event))).length;
      return `<div class="cx-rvc">${chipTile(k,26,true)}<div><b>${n} of ${mgrs}</b><span>still hold a ${half===1?"first":"second"}-half ${CHIP_UI[k].n}${half===1?" · expires GW19":""}</span></div></div>`;}).join("")}</div>`:"";
    const rivals=rep("chrivals","users","Rivals' Chips",`Which chips each manager in your league has played this half; a dashed tile is still to play.`,holdCards+(chipGridHTML(half)||`<p class="note">The league feed has not loaded.</p>`),{wide:true});
    /* batch 6 (22 Nov 2026): chips played at the last deadline, by rank tier */
    const Fd=S.field&&S.field.gws?S.field.gws[S.field.latest]:null,fe=Fd?(S.events||[]).find(e=>e.id===Fd.gw):null,N=(S.tracker&&S.tracker.totalPlayers)||null;
    const tierCols=[["near","Near you",k=>Fd&&Fd.near&&Fd.near.chips?Fd.near.chips[k]||0:null],["top10k","Top 10k",k=>Fd&&Fd.top10k&&Fd.top10k.chips?Fd.top10k.chips[k]||0:null],
      ["all","Overall",k=>{const c=fe&&(fe.chips||[]).find(x=>x.name===k);return c&&N?c.n/N*100:null;}]];
    const tiers=Fd?rep("chtier","users",`Chips by Rank Tier · GW${Fd.gw}`,"Share of each group that played the chip at the last deadline.",
      `<div class="cx-tier cx-tierh"><span></span>${tierCols.map(([,n])=>`<span>${n}</span>`).join("")}</div>${KORD.map(k=>`<div class="cx-tier">${chipTile(k,24,true)}<b>${CHIP_UI[k].n}</b>${tierCols.map(([,,fn])=>{const v=fn(k);return `<span class="mono">${v==null?"—":v.toFixed(1)+"%"}</span>`;}).join("")}</div>`).join("")}`,{wide:true}):"";
    /* Bundle D (D13): Rivals' Chips moved to Signals › My Season (one home) */
    void rivals;return seasons+(tiers?`<div class="cx-pt2">${picked}${tiers}</div>`:picked);};

  const pop=S.chipPop==="report"?modalHTML("Chip Report",report(),{wide:true,close:"chippopclose",ctl:`<span class="cx-mhs">Every season from ${esc(seasonShort(SEAS[SEAS.length-1]))}</span>`})
    :S.chipPop&&left.includes(S.chipPop)?modalHTML(chipKeyName(S.chipPop),rep("chsel","target","Gain by Week","Points each chip adds each week; hatched bars include forecasts.",bwRow(S.chipPop),{wide:true}),{wide:true,close:"chippopclose"}):"";
  return `<div class="cx">${head}${roadmap}
    <div class="cx-quad">${remainingSec}${bestSec}${chipsLeftSec}${chipsUsedSec}</div>
    ${pop}</div>`;
}
/* the season label for this season, "2026/27" */
function curSeasonLabel(){const y=Number(FEED_SEASON)||2027;return `${y-1}/${String(y).slice(2)}`;}
/* Which chips each league manager has played in a half: shared by Signals
   and Chips */
function chipGridHTML(half){
  const ents=(S.rivalsFeed&&S.rivalsFeed.entries)||{};if(!Object.keys(ents).length)return "";
  const KIND=[["wildcard","Wildcard"],["freehit","Free Hit"],["bboost","Bench Boost"],["3xc","Triple Captain"]],inHalf=e=>half===1?e<=19:e>=20;
  const meChips=[];KIND.forEach(([k])=>{const e=chipPlayed(k+half);if(e!=null)meChips.push({name:k,event:e});});
  const chipRows=[["You",meChips,true],...Object.entries(ents).filter(([id])=>String(id)!==String(TEAM_ID)).map(([id,e])=>[e.name||id,e.chips||[],false])];
  return `<div class="scroll"><table class="cgridt"><thead><tr><th style="text-align:left">Manager</th>${KIND.map(([k,n])=>`<th class="cx-gth">${chipTile(k,20,true)} ${n}</th>`).join("")}<th>Left</th></tr></thead><tbody>
    ${chipRows.map(([n,used,me])=>{const u=used.filter(c=>inHalf(c.event));let left=0;
      return `<tr class="${me?"me":""}"><td style="text-align:left">${esc(n)}</td>${KIND.map(([k])=>{const c=u.find(x=>x.name===k);if(!c)left++;
        return c?`<td class="cx-gtd"><span class="cx-ru">${chipTile(k,20,true)}<i>GW${c.event}</i></span></td>`:`<td class="cx-gtd"><span class="cx-ru off" title="Still to play">${chipTile(k,20,false,"dash")}<i></i></span></td>`;}).join("")}<td><b>${left}</b></td></tr>`;}).join("")}
    </tbody></table></div>`;
}

/* F12/F13 (re-checked 13 Oct 2026): the server cleans the feeds, but the
   page no longer relies on it: only http(s) links, numbers as numbers */
const safeUrl=u=>/^https?:\/\//i.test(String(u||""))?String(u):"#";


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
    <div class="mbox mfull${opts.wide?" wide":""}${opts.cls?" "+opts.cls:""}"><div class="mhead"><h2>${opts.icon?`<span class="mh-ic">${opts.icon}</span>`:""}${title}</h2>${opts.ctl||""}
      <button class="mx" onclick="act('${opts.close||"popclose"}')" aria-label="Close">${lic("x",18)}</button></div>
    <div class="mbody">${body}</div></div></div>`;
}
function hzHTML(cur,action,list){
  return `<span class="hz">${(list||WEEK_H).map(h=>`<button class="${cur===h?"on":""}" onclick="act('${action}',${h})">${h} GW</button>`).join("")}</span>`;
}
/* the five readings behind the strip and its pop-ups */
function weekData(){
  /* This Week is the gameweek in view only (21 Nov 2026) */
  const g=VG(),h=1,mine=new Set(effectiveSquadIds(g).ids);
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
/* This Week (21 Nov 2026): the old five-card strip and the Squad
   Dashboard in eight cards. Top row: Top Move, Captain (with the
   dashboard's captain options), Fitness and Risk (Warnings and Points at
   risk), Squad Strength. Bottom row, one Best/Worst design with player
   photos: Price Watch (rising over falling), Fixture Outlook (best and
   worst run of the next three), Form (best and worst), Rival (threats and
   differentials). The figures are the site's own: FPL form, FPL's
   price-change progress, the fixture-difficulty scale of every fixture
   chip, rival ownership from the league feed, predicted points from hPts.
   Each card opens its pop-up, where the dashboard's detail now lives. */
function thisWeekHTML(){
  if(!S.model||VG()<S.model.next.id)return "";
  const D=weekData(),{g,h}=D;
  /* ---------- Gameweek Brief (v14, 22 Nov 2026, Andy approved mock_brief) ----------
     This Week renamed. One card anatomy: head, one headline figure with its
     label, three rows, one footer figure. Two rows: before the deadline (Your
     Week, Team News, Transfers, Captain), then market and season (Price
     Watch, Fixture Outlook, Performance, Transfer Record). Every card reads
     the Planner's one team total. Classes gb-. */
  const team=weekPtsFor(g,1);
  const gbCard=(k,icon,tone,title,head,rows,foot)=>`<button class="pz-in gb-c" onclick="act('pop','${k}')" aria-haspopup="dialog">
    <span class="pz-ih"><span class="tile" style="--tc:${tone}">${typeof icon==="string"&&icon.startsWith("<")?icon:lic(icon)}</span><span class="pz-it">${title}</span>${lic("chevron-right",16)}</span>
    <span class="gb-hl">${head}</span><span class="gb-rows">${rows.length?rows.join(""):`<span class="gb-none">None</span>`}</span><span class="gb-ft">${foot||""}</span></button>`;
  const gbHead=(fig,label,cls,extra)=>`<b class="gb-fig${cls?" "+cls:""}">${fig}</b><span class="gb-lab">${label}</span>${extra||""}`;
  const gbRow=(left,name,sub,mid,val,cls)=>`<span class="gb-r${mid?"":" nm"}">${left||""}<span class="gb-n"><b>${name}</b>${sub?`<i>${sub}</i>`:""}</span>${mid||""}<b class="gb-v${cls?" "+cls:""}">${val}</b></span>`;
  const gbFace=p=>photoHTML(p,"gb-f");
  const gbBar=(pct,col)=>`<span class="gb-bt"><i style="width:${clamp(Math.round(pct),3,100)}%;background:${col}"></i></span>`;
  /* Your Week */
  let ywCard;{const Sm=ywSim(g),F=ywEO(ywKind()),fm=ywFieldMean(F,g),avg=ywAvgBench();
    const b=[],lo=Sm.sorted[0],hi=Sm.sorted[Sm.N-1],nb=14,bw=Math.max(1e-9,(hi-lo)/nb);for(let i=0;i<nb;i++)b.push(0);
    Sm.sorted.forEach(v=>{b[Math.min(nb-1,Math.floor((v-lo)/bw))]++;});
    const mx=Math.max(1,...b),W=92,H=34,cw=W/nb,mid=(Sm.mean-lo)/bw*cw;
    const hist=`<svg class="gb-hist" viewBox="0 0 ${W} ${H}" aria-hidden="true">${b.map((v,i)=>{const x0=lo+i*bw,inR=x0+bw>Sm.lo&&x0<Sm.hi;return `<rect x="${(i*cw+.5).toFixed(1)}" y="${(H-v/mx*H).toFixed(1)}" width="${(cw-1).toFixed(1)}" height="${(v/mx*H).toFixed(1)}" rx="1" fill="${inR?"#3DDC97":"#245A40"}"/>`;}).join("")}<line x1="${mid.toFixed(1)}" x2="${mid.toFixed(1)}" y1="0" y2="${H}" stroke="#fff" stroke-width="1.2"/></svg>`;
    const pc=v=>v==null?null:v;
    ywCard=gbCard("week","gauge","#3DDC97","Your Week",gbHead(Sm.mean.toFixed(1),`predicted · likely ${Math.round(Sm.lo)}–${Math.round(Sm.hi)}`,"",hist),
      [["Beat the field",pc(fm!=null?Sm.above(fm):null)],["Beat the average",pc(avg!=null?Sm.above(avg):null)],["Top your league",pc(Sm.pTop)]].filter(x=>x[1]!=null)
        .map(([l,v])=>gbRow("",l,"",gbBar(v*100,v>=.5?"var(--mint)":v>=.25?"var(--amber)":"var(--red)"),Math.round(v*100)+"%")),
      fm!=null?`<b class="${Sm.mean-fm>=0?"up":"dn"}">${sgn1(Sm.mean-fm)}</b> against the field · ${esc(F.label)}`:"No field sample yet");}
  /* Team News: your 15 on its pop-up's one risk rule, this week only */
  if(S.pop!=="warn")S.tnOpen=false;
  const tnSt=wpStats(),tnR=tnRiskPts(g,1);
  const tnLab=(p,s)=>s.sev>0?s:(()=>{const q=p.gw[g];return !q||q.blank||!q.fixtures.length?{k:"bk",l:"No fixture",s:"BGW"+g}:(p.roleMins||0)>=60&&(p.xMins||0)<60?{k:"rot",l:Math.round(p.xMins||0)+"′ expected",s:"minutes dropped"}:s;})();
  const tnRows=squadPlayers().map(p=>({p,s:tnStatus(p,g,tnSt),r:tnRisk(p,g,1,tnSt)})).filter(x=>x.s.sev>0||x.r).sort((a,b)=>b.s.sev-a.s.sev);
  const xiIds=new Set(startingXI().map(p=>p.id)),tnXI=tnRows.filter(x=>xiIds.has(x.p.id)).length;
  const tnVal=(p,s)=>s.k==="dbt"?[Math.round((p.avail??1)*100)+"%","am"]:["inj","sus","un"].includes(s.k)?["Out","dn"]:s.k==="yc"?[tnYc(p,tnSt)+"/5","am"]:s.k==="rot"&&s.sev>0?[startChance(p)+"%","am"]:["—",""];
  const warn=gbCard("warn","activity","#FF8A3D","Team News",tnRows.length?gbHead(String(tnRows.length),`to watch · ${tnXI} in your XI`):gbHead("0","to watch · all clear","up"),
    tnRows.slice(0,3).map(({p,s})=>{const t=tnLab(p,s),[v,c]=tnVal(p,t);return gbRow(`<span class="gb-st">${TN_ICON[t.k]||TN_ICON.dbt}</span>${gbFace(p)}`,esc(p.web_name),esc(t.k==="dbt"?t.s:`${t.l} · ${t.s}`),"",v,c);}),
    `Points at risk <b class="${tnR.risk>0?"dn":"up"}">${tnR.risk.toFixed(1)}</b> of ${team.toFixed(1)}`);
  /* Transfers: three different players to bring in */
  const seenIn=new Set(),mv=D.moves.filter(x=>!seenIn.has(x.inn.id)&&seenIn.add(x.inn.id)).slice(0,3);
  const ft=freeWeek(g)?"Unlimited":String(freeTransfers());
  const move=gbCard("move","arrow-right-left","#3DDC97","Transfers",
    mv.length?gbHead(sgn1(mv[0].gain),`pts ${h>1?"over "+wkSpan(g,h):"in GW"+g} · best move`,"up"):gbHead("Hold","no move improves your XI","mu"),
    mv.map((x,k)=>`<span class="gb-r gb-mv${k?"":" top"}"><span class="gb-pair">${gbFace(x.out)}${lic("arrow-right",12)}${gbFace(x.inn)}</span><span class="gb-n"><b>${esc(x.out.web_name)} → ${esc(x.inn.web_name)}</b><i>£${x.inn.price.toFixed(1)} · ${esc(x.inn.teamName)}</i></span><b class="gb-v up">${sgn1(x.gain)}</b></span>`),
    `${ft} free transfer${ft==="1"?"":"s"} · <b>£${planBank().toFixed(1)}</b> in the bank`);
  /* Captain: the top three, doubled, each against the best; the field's armband */
  const cm=chipForWeek(g)==="3xc"?3:2,caps=D.caps.slice(0,3).map(p=>[p,hPts(p,g,h)*cm]);
  const cTop=caps.length?caps[0][1]:0,cLow=caps.length?caps[caps.length-1][1]:0,cFloor=cLow-Math.max(1,(cTop-cLow)*0.6);
  const Ft=twField(),tk=Ft&&Ft.top10k&&Ft.top10k.cap?Ft.top10k.cap:null,tkTop=tk?Object.entries(tk).sort((a,b)=>b[1]-a[1])[0]:null,tkP=tkTop?S.model.players.find(p=>p.id===+tkTop[0]):null;
  const cap=gbCard("cap","crown","#FFB020","Captain",caps.length?gbHead(caps[0][1].toFixed(1),`${esc(caps[0][0].web_name)} · ×${cm} predicted`,"am"):gbHead("—","no starting XI"),
    caps.map(([p,v],i)=>gbRow(gbFace(p),esc(p.web_name),i?`${sgn1(v-cTop)} against ${esc(caps[0][0].web_name)}`:"best option",gbBar((v-cFloor)/Math.max(0.1,cTop-cFloor)*100,i?"#7A5F22":"var(--amber)"),v.toFixed(1),i?"":"am")),
    tkP?`Top 10k captain: <b>${esc(tkP.web_name)} ${Math.round(tkTop[1])}%</b>${caps.length&&caps[0][0].id!==tkP.id?` · ${esc(caps[0][0].web_name)} ${Math.round(tk[caps[0][0].id]||0)}%`:""}`:"Top 10k captaincy not sampled yet");
  /* Price Watch: the three closest to a change, either way */
  const pwL=p=>fplLive(p)||{},pwSq=squadPlayers().filter(p=>pwL(p).pcp!=null),pwTn=p=>pwDue(pwL(p))[0]==="Tonight";
  const nUp=pwSq.filter(p=>pwL(p).pcp>0&&pwTn(p)).length,nDn=pwSq.filter(p=>pwL(p).pcp<0&&pwTn(p)).length;
  const pwTop=pwSq.slice().sort((a,b)=>Math.abs(pwL(b).pcp)-Math.abs(pwL(a).pcp)).slice(0,3);
  const price=gbCard("price",nDn&&!nUp?"trending-down":"trending-up",nDn&&!nUp?"#FF5A6E":"#4ADE80","Price Watch",
    pwSq.length?gbHead(String(nUp),`rising tonight · ${nDn} falling`,nUp?"up":""):gbHead("—","no predictor data"),
    pwTop.map(p=>{const v=pwL(p).pcp,up=v>0;return gbRow(gbFace(p),esc(p.web_name),up?"towards a rise":"towards a fall",gbBar(Math.abs(v),up?"var(--mint)":"var(--red)"),(up?"+":"−")+Math.abs(Math.round(v))+"%",up?"up":"dn");}),
    `Prices change at <b>01:30</b>`);
  /* Fixture Outlook: the easiest two runs and the hardest, next three weeks */
  const foStrip=p=>{let h2="";for(let e=g;e<g+3&&e<=38;e++){const q=p.gw[e];
      h2+=!q||q.blank||!q.fixtures.length?fxBlank(`GW${e}: no fixture`):(c=>c.length>1?`<span class="fxdbl">${c.join("")}</span>`:c[0])(q.fixtures.map(f=>fxChip(f.opp,f.home,foDiff(f,"all"))));}
    return `<span class="gb-fx">${fxRun(h2,"sm")}</span>`;};
  const runs=squadPlayers().map(p=>({p,v:foRun(p,g,3,"all")})).sort((a,b)=>a.v-b.v),sqAvg=runs.length?runs.reduce((a,x)=>a+x.v,0)/runs.length:null;
  const foPick=runs.length>=3?[runs[0],runs[1],runs[runs.length-1]]:runs;
  const outlook=gbCard("out","calendar","#22D3EE","Fixture Outlook",runs.length?gbHead(runs[0].v.toFixed(1),`${esc(runs[0].p.web_name)} · easiest run · avg difficulty, next 3`,"up"):gbHead("—","no fixtures"),
    foPick.map((x,i)=>gbRow(gbFace(x.p),esc(x.p.web_name),"",foStrip(x.p),x.v.toFixed(1),i===2?"dn":"up")),
    sqAvg!=null?`Squad average <b>${sqAvg.toFixed(1)}</b> · lower is easier`:"");
  /* Performance: points against prediction over the last six weeks */
  const pmR=squadPlayers().map(p=>pmRow(p,pmWeeks(6),true)).filter(r=>r.vp!=null).sort((a,b)=>b.vp-a.vp);
  const pmPick=pmR.length>=3?[pmR[0],pmR[1],pmR[pmR.length-1]]:pmR,pmMax=Math.max(1,...pmPick.map(r=>Math.abs(r.vp))),pmSum=pmR.reduce((a,r)=>a+r.vp,0);
  const form=gbCard("form","flame","#FF8A3D","Performance",pmR.length?gbHead(sgn1(pmR[0].vp),`${esc(pmR[0].p.web_name)} · vs predicted, last 6 GW`,pmR[0].vp>=0?"up":"dn"):gbHead("—","no predictions stored"),
    pmPick.map(r=>gbRow(gbFace(r.p),esc(r.p.web_name),"",gbBar(Math.abs(r.vp)/pmMax*100,r.vp>=0?"#FF8A3D":"#7A4A2A"),sgn1(r.vp),r.vp>=0?"up":"dn")),
    pmR.length?`Squad <b class="${pmSum>=0?"up":"dn"}">${sgn1(pmSum)}</b> against prediction, last 6 GW`:"");
  /* Transfer Record: the season's transfers judged on points while held */
  const TLa=transferLog(),TL=TLa.filter(x=>!x.chip&&x.held!=null),tnet=TLa.reduce((a,x)=>a+(x.held||0),0);
  const tbs=TL.slice().sort((a,b)=>b.held-a.held),trPick=tbs.length>=3?[tbs[0],tbs[1],tbs[tbs.length-1]]:tbs;
  const hits=((S.tracker&&S.tracker.gw)||[]).reduce((a,r)=>a+(r.transferCost||0),0);
  const trec=gbCard("trec",`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`,"#7AA2FF","Transfer Record",
    TL.length?gbHead(`${tnet>=0?"+":"−"}${Math.abs(Math.round(tnet))}`,"pts from transfers · season",tnet>=0?"up":"dn"):gbHead("—","no transfers yet"),
    trPick.map(x=>gbRow(gbFace(x.inn),esc(x.inn.web_name),`for ${esc(x.out.web_name)} · GW${x.e}`,"",(x.held>=0?"+":"−")+Math.abs(Math.round(x.held)),x.held>=0?"up":"dn")),
    TL.length?`${TL.length} transfer${TL.length===1?"":"s"} · ${hits?`${hits/4} hit${hits===4?"":"s"} <b class="dn">−${hits}</b>`:"no hits"}${tbs.length&&tbs[tbs.length-1].held>=0?" · no transfer lost points":""}`:"");
  /* the deadline, counted down */
  const ev=(S.events||[]).find(e=>e.id===g),dl=ev&&ev.deadline?new Date(ev.deadline):null,left=dl?dl-Date.now():null;
  const cd=left!=null&&left>0?(left>=864e5?`${Math.floor(left/864e5)}d ${Math.floor(left%864e5/36e5)}h`:`${Math.floor(left/36e5)}h ${Math.floor(left%36e5/6e4)}m`):null;
  const dlTxt=dl&&!isNaN(dl)?`GW${g} · deadline ${dl.toLocaleString("en-GB",{timeZone:"Europe/London",weekday:"short",hour:"2-digit",minute:"2-digit"}).replace(",","")}${cd?` · <b>${cd}</b>`:""}`:`GW${g}`;
  return `<section class="pz-sec gb"><div class="pz-sh"><h2>Gameweek Brief</h2><button class="fci" aria-label="About" data-tip="The gameweek at a glance. Open a card for the detail.">i</button><span class="gb-dl">${lic("calendar",14)} ${dlTxt}</span></div>
    <div class="gb-grp">Before the deadline</div><div class="pz-ins">${ywCard}${warn}${move}${cap}</div>
    <div class="gb-grp">Market and season</div><div class="pz-ins">${price}${outlook}${form}${trec}</div></section>`;
}
/* ============================================================
   THIS WEEK BATCH 3 (22 Nov 2026, Andy approved the mocks): Team News
   (was Fitness and Risk), Price Watch (one view), Fixture Outlook (one
   method) and Performance (was Form). Built from the ds- parts. Classes:
   wp- (shared), tn- Team News, pw- Price Watch, fo- Fixture Outlook,
   pm- Performance (pf- is the pool filters).
   ============================================================ */
/* the Planner's modalHTML with its opts.icon, tinted per pop-up */
function wkPopModal(icon,tone,title,right,body,cls){
  return modalHTML(esc(title),body,{wide:true,cls:"wp"+(cls?" "+cls:""),ctl:right||"",icon:`<span style="display:inline-flex;color:${tone}">${lic(icon,18)}</span>`});
}
const wpNm=(p,sub)=>`<span class="wp-nm"><span class="ds-name">${esc(p.web_name)}</span><span class="ds-sub">${sub!=null?sub:`${esc(p.teamName)} · ${POSL[p.pos]}`}</span></span>`;
const wpTeam=p=>(S.teams||[]).find(t=>t.id===p.team)||null;
const wpStats=()=>{const m=new Map();(S.players||[]).forEach(x=>m.set(x.id,x.stats||{}));return m;};
const wpAgo=ms=>ms?nwAgo(ms):"";

/* ---------- Team News ---------- */
const TN_SVG=b=>`<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">${b}</svg>`;
const TN_ICON={
  fit:TN_SVG('<circle cx="12" cy="12" r="9" fill="#3DDC97"/><path d="M8 12.3l2.7 2.7L16 9.7" fill="none" stroke="#04170E" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'),
  inj:TN_SVG('<rect x="3" y="3" width="18" height="18" rx="5" fill="#FF5A6E"/><path d="M10 7h4v3h3v4h-3v3h-4v-3H7v-4h3z" fill="#2A0008"/>'),
  dbt:TN_SVG('<path d="M12 3l9.5 17h-19z" fill="#FF9F2E" stroke="#FF9F2E" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 9.5v4.5M12 17h.01" stroke="#2A1500" stroke-width="2.2" stroke-linecap="round"/>'),
  yc:TN_SVG('<rect x="6.5" y="3" width="11" height="17" rx="2" fill="#FFD23F" transform="rotate(8 12 12)"/>'),
  sus:TN_SVG('<rect x="6.5" y="3" width="11" height="17" rx="2" fill="#FF3B4E" transform="rotate(8 12 12)"/>'),
  rot:TN_SVG('<circle cx="12" cy="12" r="10" fill="#FFB020"/><path d="M7.5 11a4.6 4.6 0 0 1 8-2.4M16.5 13a4.6 4.6 0 0 1-8 2.4" fill="none" stroke="#2A1A00" stroke-width="2" stroke-linecap="round"/><path d="M15.8 6.3v2.6h-2.6M8.2 17.7v-2.6h2.6" fill="none" stroke="#2A1A00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  bk:TN_SVG('<circle cx="12" cy="12" r="9" fill="none" stroke="#6A6A6A" stroke-width="2"/><path d="M8 12h8" stroke="#6A6A6A" stroke-width="2.2" stroke-linecap="round"/>'),
  un:TN_SVG('<circle cx="12" cy="12" r="9" fill="none" stroke="#FF8095" stroke-width="2.2"/><path d="M6 6l12 12" stroke="#FF8095" stroke-width="2.2" stroke-linecap="round"/>')};
/* yellow cards: five by GW19 or ten by GW32 is a ban */
const tnYc=(p,st)=>num(((st||wpStats()).get(p.id)||{}).yellow_cards);
const tnBanNext=(p,g,st)=>{const y=tnYc(p,st);return (y===4&&g<=19)||(y===9&&g<=32);};
const tnWhy=p=>String(p.news||"").split(/\s+-\s+/)[0].replace(/\s*-\s*\d+% chance of playing/i,"").trim().slice(0,30);
/* FPL's expected return date ("back 29 Nov") and the gameweek it falls in */
function tnBack(p){
  const r=p.back&&p.back!=="unknown"?p.back:parseReturn(p.news);
  const m=/^(\d{2})-([A-Za-z]{3})$/.exec(r||"");if(!m)return null;
  const mon=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(m[2]);if(mon<0)return null;
  const ev=(S.events||[]).filter(e=>e.deadline),y0=ev.length?new Date(ev[0].deadline).getUTCFullYear():new Date().getUTCFullYear();
  const t=Date.UTC(mon>=6?y0:y0+1,mon,+m[1]);
  const e=ev.find(x=>Date.parse(x.deadline)>=t);
  return{txt:`${+m[1]} ${m[2]}`,gw:e?e.id:null};
}
/* his club's last six league matches: starts, and minutes in the last three */
function tnRecent(p){
  const G=S.model.next.id,code=Math.round(num(p.teamCode));
  const ms=Object.entries(S.teamMatch||{}).filter(([,m])=>m.tag==="now"&&m.gw<G&&(m.h===code||m.a===code))
    .sort((a,b)=>b[1].gw-a[1].gw).slice(0,6).map(([id])=>id);
  const rows=((S.hist||{})[String(p.code)]||[]),row=id=>rows.find(r=>r.mid===id);
  return{n:ms.length,starts:ms.filter(id=>{const r=row(id);return r&&r.start===0;}).length,
    last:ms.length?!!(row(ms[0])&&row(ms[0]).start===0):true,mins3:ms.slice(0,3).reverse().map(id=>{const r=row(id);return r?+r.mins||0:0;})};
}
/* one status for each of your players, most serious first */
function tnStatus(p,g,st){
  const av=p.avail==null?1:p.avail,s=p.status,b=tnBack(p),f=flagNow(p),why=tnWhy(p);
  const backTxt=b?`back ${b.txt}${b.gw?" · GW"+b.gw:""}`:"";
  if(s==="s")return{k:"sus",l:"Suspended",s:backTxt||why||"banned",sev:6,b};
  if(s==="u"||s==="n")return{k:"un",l:"Unavailable",s:why||"not with the club",sev:5,b};
  if(av<=0)return{k:"inj",l:"Injured",s:backTxt||why||"no return date",sev:5,b};
  if(av<1)return{k:"dbt",l:Math.round(av*100)+"% to play",s:[f&&f.since?"since "+flagDay(f.since).split(" ")[0]:"",why].filter(Boolean).join(" · ")||"doubtful",sev:4,b};
  if((p.xMins||0)<15&&(p.roleMins==null||p.roleMins<30))return{k:"bk",l:"Back-up",s:"not expected to play",sev:0,bk:true};
  if(tnBanNext(p,g,st))return{k:"yc",l:tnYc(p,st)+" yellows",s:"1 from a ban",sev:3};
  const sc=startChance(p);
  if(sc<60){const r=tnRecent(p);return{k:"rot",l:"Rotation risk",s:r.n&&!r.last?"benched last GW":`started ${r.starts} of the last ${r.n||6}`,sev:2};}
  return{k:"fit",l:"Fit",s:"expected to start",sev:0};
}
/* The one risk rule (Andy approved, 22 Nov 2026): injured or doubtful
   (chance under 100), one yellow from a ban, a starter whose expected
   minutes dropped under 60, or a blank in the window. */
function tnRisk(p,g,n,st){
  if((p.avail==null?1:p.avail)<1)return true;
  if(tnBanNext(p,g,st))return true;
  if((p.roleMins||0)>=60&&(p.xMins||0)<60)return true;
  for(let e=g;e<g+n&&e<=38;e++){const q=p.gw[e];if(!q||q.blank||!q.fixtures.length)return true;}
  return false;
}
function tnRiskPts(g,n){
  const xi=startingXI(),st=wpStats(),risky=xi.filter(p=>tnRisk(p,g,n,st));
  return{n:risky.length,risk:risky.reduce((a,p)=>a+hPts(p,g,n),0),xi:xi.reduce((a,p)=>a+hPts(p,g,n),0),risky};
}
/* "what's changed" counts from when he last opened the pop-up: the time
   and what each player looked like then are kept in this browser */
function tnOpen(){
  const prev=LS.get("tnSeen")||null,sp=squadPlayers(),st=wpStats(),now=Date.now();
  const ev=(S.events||[]).filter(e=>e.deadline&&Date.parse(e.deadline)<=now).pop();
  S.tnSince=prev&&prev.t?prev.t:(ev?Date.parse(ev.deadline):now-7*86400000);S.tnPrev=prev;
  const snap={t:now,sc:{},yc:{},pen:{}};
  sp.forEach(p=>{snap.sc[p.id]=startChance(p);snap.yc[p.id]=tnYc(p,st);const l=fplLive(p)||{};snap.pen[p.id]=l.pen??null;});
  LS.set("tnSeen",snap);S.tnOpen=true;
}
function tnStories(p,since){
  const seen=new Set();
  return [...(S.news||[]),...(S.squadNews||[])].filter(n=>(n.ids||[]).includes(p.id)&&n.time>since)
    .filter(n=>{const k=newsKey(n.title);if(seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>b.time-a.time);
}
function tnFeed(sp,since,prev,st){
  const ev=[],now=Date.now();
  sp.forEach(p=>{
    let was=100;flagRows(p).forEach(r=>{const c=flagChance(r),t=flagT(r);
      if(c!==was&&t>since)ev.push({t,ic:c>was?"check":"triangle-alert",tone:c>was?"#3DDC97":c===0?"#FF5A6E":"#FF9F2E",p,
        a:c>=100?`Flag cleared: ${was}% → 100%`:was>=100?`Flag set: 100% → ${c}%`:`Flag changed: ${was}% → ${c}%`,b:tnWhy({news:r.news})||(c>=100?"Fit again":"FPL flag")});
      was=c;});
    const s=tnStories(p,since).filter(n=>["inj","ret","team","pc"].includes(n.cat))[0];
    if(s)ev.push({t:s.time,ic:"info",tone:"#7AA2FF",p,a:s.title,b:(s.pub&&s.pub!==s.src?s.pub:s.src)||"News",url:s.url});
    if(prev){
      const sc=startChance(p),o=prev.sc&&prev.sc[p.id];
      if(o!=null&&Math.abs(sc-o)>=15){const r=tnRecent(p);ev.push({t:now,ic:"activity",tone:"#FFB020",p,a:`Start chance ${o}% → ${sc}%`,b:`started ${r.starts} of the last ${r.n||6}`,fresh:true});}
      const y=tnYc(p,st),oy=prev.yc&&prev.yc[p.id];
      if(oy!=null&&y>oy)ev.push({t:now,ic:"flag-triangle-right",tone:"#FFD23F",p,a:`Yellow card number ${y}`,b:tnBanNext(p,VG(),st)?"one more is a ban":"booked",fresh:true});
      const pen=(fplLive(p)||{}).pen,op=prev.pen?prev.pen[p.id]:undefined;
      if(op!==undefined&&pen===1&&op!==1)ev.push({t:now,ic:"circle-dot",tone:"#22D3EE",p,a:"Now first on penalties",b:"FPL set-piece order",fresh:true});
    }
  });
  return ev.sort((a,b)=>b.t-a.t);
}
function tnCell(p,e,g,s){
  const q=p.gw[e],blank=!q||q.blank||!q.fixtures.length,dbl=!!(q&&q.fixtures.length>1);
  const c=(k,t,tip)=>`<span class="tn-c ${k}" title="GW${e}: ${esc(tip)}">${t}</span>`;
  const out=(s.k==="inj"||s.k==="sus"||s.k==="un")&&(e===g||(s.b&&s.b.gw&&e<s.b.gw));
  if(out)return c("out","OUT",s.l);
  if(blank)return c("blk","BGW","no fixture");
  if(e===g&&s.k==="dbt")return c("dbt",Math.round(p.avail*100)+"%",s.l);
  if(dbl)return c("dbl","DGW","two fixtures");
  if(e===g&&s.k==="yc")return c("yc",`<i class="tn-yc"></i>${tnYc(p)}`,s.s);
  if(e===g&&s.k==="rot")return c("rot",Math.round(p.xMins||0)+"′","expected minutes");
  return c("ok","","fixture");
}
/* Reputable sources for Team News > Latest (26 Nov 2026): the official game
   and clubs, national and regional newspapers and broadcasters, and the
   established FPL sites. Betting-tips sites, fan blogs, aggregators and
   tabloids are left out. Squad stories arrive through Google News, so the
   publisher (pub, else src) decides. */
const TN_REPUTABLE=["premier league","fantasy premier league","bbc","bbc sport","sky sports","the guardian","the athletic","the new york times","espn",
  "the independent","the times","the telegraph","london evening standard","evening standard","football london","manchester evening news","liverpool echo",
  "bournemouth echo","the argus","birmingham mail","chronicle live","yorkshire evening post","nottingham post","coventry live","hull daily mail","ipswich star",
  "east anglian daily times","sunderland echo","reuters","pa media","tnt sports","fantasy football scout","fantasy football fix","fantasy football hub",
  "all about fpl","rotowire","premier injuries","fourfourtwo"].map(norm);
const TN_CLUBS=["arsenal","aston villa","bournemouth","brentford","brighton","chelsea","coventry city","crystal palace","everton","fulham","hull city",
  "ipswich town","leeds united","liverpool","manchester city","manchester united","newcastle united","nottingham forest","sunderland","tottenham hotspur"].map(norm);
function tnReputable(n){
  const pub=String((n&&(n.pub||n.src))||"").replace(/\s*\|.*$/,""),k=norm(pub);if(!k)return false;
  if(TN_REPUTABLE.includes(k)||/fantasyfootballscout|premierleague/.test(k))return true;
  /* the clubs' own sites: "Liverpool FC", "Arsenal.com", "Chelsea Football Club" */
  return TN_CLUBS.some(c=>k===c||k===c+"fc"||k===c+"footballclub"||k===c+"com"||k===c+"officialwebsite");
}
/* his latest story from a reputable source, any age the feed still holds */
function tnLatest(p){
  const seen=new Set();
  return [...(S.news||[]),...(S.squadNews||[])].filter(n=>(n.ids||[]).includes(p.id)&&tnReputable(n))
    .filter(n=>{const k=newsKey(n.title);if(seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>b.time-a.time)[0]||null;
}
function teamNewsHTML(){
  if(!S.tnOpen)tnOpen();
  const g=VG(),H=S.tnH||5,n=hzWeeks(H,g),cols=Math.min(n,8,39-g),sp=squadPlayers(),xi=startingXI(),st=wpStats();
  const since=S.tnSince||0,prev=S.tnPrev;
  /* 26 Nov 2026: the bookmakers' next-match odds, one column each (next
     gameweek only; that is all the market prices) */
  const oddsOn=g===S.model.next.id&&S.oddsState==="ok";
  const mk=oddsOn?(()=>{try{return oddsPlayers(g)||{};}catch(e){return {};}})():{},mcs=oddsOn?(()=>{try{return marketCS(g)||{};}catch(e){return {};}})():{};
  const od=p=>{const r=mk[p.id]||{};return{goal:p.pos===1?null:r.goal??null,assist:r.assist??null,cs:mcs[p.team]??null,card:r.card??null};};
  let rows=sp.map(p=>({p,s:tnStatus(p,g,st),xi:xi.includes(p),o:od(p)})).sort((a,b)=>b.s.sev-a.s.sev||(b.xi-a.xi)||a.p.pos-b.p.pos);
  const so=S.tnSort,sv=(r,k)=>k==="start"?startChance(r.p):k==="mins"?(r.p.xMins||0):r.o[k];
  if(so)rows=rows.slice().sort((a,b)=>{const x=sv(a,so.k),y=sv(b,so.k);if(x==null&&y==null)return 0;if(x==null)return 1;if(y==null)return -1;return so.dir<0?y-x:x-y;});
  const bans=sp.map(p=>({p,b:banRisk(p,g)})).filter(x=>x.b);
  const flagged=sp.filter(p=>p.avail<1||["s","u","n"].includes(p.status));
  const newFlags=flagged.filter(p=>{const f=flagNow(p);return f&&f.since&&f.since>since;}).length;
  const starters=xi.filter(p=>startChance(p)>=60).length;
  const R=tnRiskPts(g,n);
  const backFit=sp.filter(p=>{const f=flagNow(p);return f&&f.cleared&&f.since>=Date.now()-7*86400000;});
  const day=Date.now()-86400000,stories=new Set();
  [...(S.news||[]),...(S.squadNews||[])].forEach(x=>{if(x.time>=day&&(x.ids||[]).some(id=>sp.some(p=>p.id===id)))stories.add(newsKey(x.title));});
  const tiles=`<div class="ds-tiles tn-t">${dsTile("Flagged",String(flagged.length),newFlags?`+${newFlags} since you last looked`:"none new since you last looked",flagged.length?"dn":"up")}
    ${dsTile("Likely starters",`${starters} of ${xi.length}`,"start chance 60%+")}
    ${dsTile("Points at risk",R.risk.toFixed(1),`of ${R.xi.toFixed(1)} in your XI`,R.risk>0?"dn":"up")}
    ${dsTile("Back fit",String(backFit.length),backFit.length?backFit.slice(0,2).map(p=>esc(p.web_name)).join(" · "):"none this week",backFit.length?"up":"")}
    ${dsTile("Ban Risk",String(bans.length),bans.length?bans.slice(0,2).map(x=>esc(x.p.web_name)+(x.b.bk!=null?" "+Math.round(x.b.bk*100)+"%":"")).join(" · ")+(bans.some(x=>x.b.bk!=null)?" booked":""):"nobody one booking from a ban",bans.length?"dn":"")}
    ${dsTile("Stories",String(stories.size),"on your players · 24h")}</div>`;
  const W=[];for(let e=g;e<g+cols;e++)W.push(e);
  const gc=`style="grid-template-columns:132px 160px 50px 66px 56px 58px 52px 62px repeat(${W.length},minmax(30px,1fr))"`;
  const sh=(t,k,tip)=>{const on=so&&so.k===k;return `<span class="tn-so${on?" on":""}" onclick="act('tnsort','${k}')" title="${esc(tip)}">${t}<i>${on?(so.dir<0?"▼":"▲"):"↕"}</i></span>`;};
  const head=`<div class="tn-row tn-hd ds-th" ${gc}><span class="tn-so" onclick="act('tnsort','none')" title="Default order: most at risk first">Player</span><span>Status</span>${sh("Start","start","Sort by start chance")}${sh("Mins","mins","Sort by expected minutes")}${sh("Goal","goal","Bookmakers: chance he scores, if he plays")}${sh("Assist","assist","Bookmakers: chance he assists, if he plays")}${sh("CS","cs","Bookmakers: his team's clean-sheet chance")}${sh("Booked","card","Bookmakers: chance he is booked")}${W.map(e=>`<span>GW${e}</span>`).join("")}</div>`;
  const ox=(v,hi,cls)=>v==null?'<span class="tn-ox mu">—</span>':`<span class="tn-ox${v>=hi?" hi"+(cls?" "+cls:""):""}">${Math.round(v*100)}%</span>`;
  const row=({p,s,o})=>{const sc=startChance(p),r=tnRecent(p),br=banRisk(p,g);
    const scCol=sc>=75?"var(--mint)":sc>=50?"#FFB020":sc>0?"#FF9F2E":"#FF8095";
    return `<div class="tn-row${s.sev>=5?" out":s.sev>=2||(s.k==="dbt")?" hot":""}" ${gc}>
      <span class="tn-p">${dsFace(p)}${wpNm(p)}</span>
      <span class="tn-fl s-${s.k}" title="${esc(flagTitle(p))}">${TN_ICON[s.k]}<span><b>${esc(s.l)}</b><i>${esc(s.s)}</i></span></span>
      ${s.bk?`<span class="tn-st bk">—</span>`:`<b class="tn-st" style="color:${scCol}">${sc}%</b>`}
      <span class="tn-mn" title="Minutes in his club's last three matches, then expected minutes"><span class="tn-mb">${r.mins3.map(v=>`<i style="height:${Math.max(2,v/90*20)}px;background:${v>=60?"#3DDC97":v>0?"#FFB020":"#3A3A3A"}" title="${v}′"></i>`).join("")}</span><b>${Math.round(p.xMins||0)}′</b></span>
      ${ox(o.goal,.3)}${ox(o.assist,.2)}${ox(o.cs,.35,"cs")}${o.card==null?'<span class="tn-ox mu">—</span>':`<span class="tn-ox${o.card>=.2||br?" bk":""}"${br?` title="${esc(br.tip)}"`:""}>${br?lic("rectangle-vertical",11):""}${Math.round(o.card*100)}%</span>`}
      ${W.map(e=>tnCell(p,e,g,s)).join("")}</div>`;};
  /* Latest: one row per player, his newest story from a reputable source,
     newest first; players with none sit at the bottom */
  const lat=sp.map(p=>({p,n:tnLatest(p)})).sort((a,b)=>(b.n?b.n.time:0)-(a.n?a.n.time:0));
  const feed=`<section class="panel tn-feed">${dsHead("newspaper","Latest",`<span class="ds-sub">reputable sources</span>`)}
    <div class="tn-ev tn-lat">${lat.map(({p,n})=>n?`<a class="tn-e" href="${esc(safeUrl(n.url))}" target="_blank" rel="noopener">${dsFace(p)}
      <span class="tn-et"><b>${esc(p.web_name)} <span>${esc(n.title)}</span></b><i>${nwSrc(n)}</i></span></a>`
      :`<div class="tn-e none">${dsFace(p)}<span class="tn-et"><b>${esc(p.web_name)}</b><i>No recent story from a reputable source</i></span></div>`).join("")}</div>
    <button class="tn-open" onclick="act('tab','news')">Open on News page ${lic("arrow-right",14)}</button></section>`;
  const upd=S.newsFetchedAt?Date.parse(S.newsFetchedAt):(S.flags&&S.flags.updated?Date.parse(S.flags.updated):null);
  const body=`${tiles}<div class="tn-grid"><section class="panel tn-board">${head}<div class="tn-rows">${rows.map(row).join("")}</div></section>${feed}</div>`;
  return wkPopModal("activity","#FF8A3D","Team News",`${upd?`<span class="wp-ft">Updated ${wpAgo(upd)} ago</span>`:""}${hz4HTML(H,"tnh")}`,body,"tn");
}

/* ---------- Price Watch ---------- */
/* FPL changes prices once a night, at about 01:30 UK time */
function pwNextChange(now){
  now=now||Date.now();
  const lon=ms=>{const o={};new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",year:"numeric",month:"numeric",day:"numeric",hour:"numeric",minute:"numeric",hourCycle:"h23"})
    .formatToParts(new Date(ms)).forEach(x=>o[x.type]=+x.value);return o;};
  const d=lon(now),off=Date.UTC(d.year,d.month-1,d.day,d.hour,d.minute)-Math.floor(now/60000)*60000;
  let t=Date.UTC(d.year,d.month-1,d.day,1,30)-off;
  if(t<=now)t+=86400000;
  return t;
}
const pwClock=ms=>{const s=Math.max(0,Math.round(ms/1000));return [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(v=>String(v).padStart(2,"0")).join(":");};
function pwTick(){
  if(typeof document==="undefined"||!document.querySelectorAll||typeof setInterval!=="function"||pwTick.t)return;
  pwTick.t=setInterval(()=>{const els=document.querySelectorAll("[data-pwcd]");if(!els.length){clearInterval(pwTick.t);pwTick.t=null;return;}
    els.forEach(el=>el.textContent=pwClock(+el.dataset.pwcd-Date.now()));},1000);
}
/* tonight's projection: FPL's own, offset 0 */
const pwProj=l=>{const x=(l.pcProj||[]).find(r=>r[0]===0);return x?x[1]:l.pcp;};
const pwLocked=l=>!!(l.pcLock&&Date.parse(l.pcLock)>Date.now());
/* when the change is due: the first night FPL projects 100% */
function pwDue(l){
  if(l.pcp==null)return["—","no"];
  if(pwLocked(l))return["Locked","no"];
  if(Math.abs(l.pcp)>=100)return["Tonight","t"];
  const pr=(l.pcProj||[]).slice().sort((a,b)=>a[0]-b[0]),hit=pr.find(r=>Math.abs(r[1])>=100&&Math.sign(r[1])===Math.sign(l.pcp||r[1]));
  if(hit)return hit[0]===0?["Tonight","t"]:hit[0]===1?["Tomorrow","tm"]:[`${hit[0]} days`,""];
  const last=pr[pr.length-1];
  if(last&&Math.abs(last[1])>=50&&Math.abs(last[1])>Math.abs(l.pcp))return[`> ${last[0]} days`,""];
  return["—","no"];
}
/* progress per hour, from the server's 48-hour log since the last change */
function pwRate(id){
  const L=S.priceLog&&S.priceLog.samples;if(!L||L.length<2)return null;
  const cut=pwNextChange()-86400000,last=L[L.length-1];
  const span=L.filter(s=>s.t>cut&&s.t>=last.t-6*3600000&&s.p&&s.p[id]!=null);
  if(span.length<2)return null;
  const a=span[0],b=span[span.length-1],h=(b.t-a.t)/3600000;
  return h>=0.4?(b.p[id]-a.p[id])/h:null;
}
const pwK=n=>(n>=0?"+":"−")+(Math.abs(n)>=1000?Math.round(Math.abs(n)/1000)+"k":Math.abs(Math.round(n)));
const pwProg=(now,pred)=>{now=now||0;pred=pred==null?now:pred;const w=Math.min(50,Math.abs(now)/2),wp=Math.min(50,Math.abs(pred)/2),up=now>=0;
  return `<span class="pw-pb" title="Now ${now.toFixed(1)}% · FPL projects ${pred.toFixed(1)}% tonight"><i class="pr ${pred>=0?"up":"dn"}" style="width:${wp}%;${pred>=0?"left:50%":"right:50%"}"></i><i class="nw ${up?"up":"dn"}" style="width:${w}%;${up?"left:50%":"right:50%"}"></i></span>`;};
const pwNow=v=>v==null?dsFig("–"):dsFig(`${v>0?"+":v<0?"−":""}${Math.abs(v).toFixed(1)}%`,v>=0?"up":"dn");
const pwWhen=d=>`<span class="pw-w ${d[1]}">${d[0]}</span>`;
function priceWatchHTML(){
  pwTick();
  const L=p=>fplLive(p)||{},sp=squadPlayers(),mine=new Set(sp.map(p=>p.id)),all=S.model.players.filter(p=>L(p).pcp!=null);
  const next=pwNextChange(),nextT=new Date(next).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
  const dueT=p=>pwDue(L(p))[0]==="Tonight";
  const rises=sp.filter(p=>dueT(p)&&L(p).pcp>0).sort((a,b)=>L(b).pcp-L(a).pcp),falls=sp.filter(p=>dueT(p)&&L(p).pcp<0).sort((a,b)=>L(a).pcp-L(b).pcp);
  const closeR=sp.filter(p=>L(p).pcp>0).sort((a,b)=>L(b).pcp-L(a).pcp)[0],closeF=sp.filter(p=>L(p).pcp<0).sort((a,b)=>L(a).pcp-L(b).pcp)[0];
  const bank=planBank(),val=sp.reduce((a,p)=>a+p.price,0)+bank,sell=sp.reduce((a,p)=>a+sellPrice(p),0),paid=sp.reduce((a,p)=>a+purchaseOf(p).paid,0);
  const up=sp.filter(p=>num(L(p).cce)>0),dn=sp.filter(p=>num(L(p).cce)<0);
  const pct=v=>`${v>0?"+":v<0?"−":""}${Math.abs(v).toFixed(1)}%`;
  const tiles=`<div class="ds-tiles pw-t">${dsTile("Next change",`<span data-pwcd="${next}">${pwClock(next-Date.now())}</span>`,`tonight ${nextT}`)}
    ${dsTile("Your rises tonight",String(rises.length),rises.length?`${esc(rises[0].web_name)} ${pct(L(rises[0]).pcp)}`:closeR?`${esc(closeR.web_name)} ${pct(L(closeR).pcp)} closest`:"none close",rises.length?"up":"")}
    ${dsTile("Your falls tonight",String(falls.length),falls.length?`${esc(falls[0].web_name)} ${pct(L(falls[0]).pcp)}`:closeF?`${esc(closeF.web_name)} ${pct(L(closeF).pcp)} closest`:"none close",falls.length?"dn":"")}
    ${dsTile("Team value",`£${val.toFixed(1)}`,`${val>=100?"+":"−"}£${Math.abs(val-100).toFixed(1)} this season`,val>=100?"up":"dn")}
    ${dsTile("Profit if sold",`${sell>=paid?"+":"−"}£${Math.abs(sell-paid).toFixed(1)}`,`sell £${sell.toFixed(1)} · bank £${bank.toFixed(1)}`,sell>=paid?"up":"dn")}
    ${dsTile("Changed this week",`▲ ${up.length} · ▼ ${dn.length}`,[...up.slice(0,1).map(p=>esc(p.web_name)+" ▲"),...dn.slice(0,1).map(p=>esc(p.web_name)+" ▼")].join(" · ")||"no change")}</div>`;
  /* the table: your squad, your watchlist or the market's 15 closest */
  const watch=LS.get("pwWatch")||[],T=["mine","watch","all"].includes(S.pwTab)?S.pwTab:"mine";
  const list=T==="mine"?sp.slice():T==="watch"?S.model.players.filter(p=>watch.includes(p.id)):all.slice().sort((a,b)=>Math.abs(L(b).pcp)-Math.abs(L(a).pcp)).slice(0,15);
  list.sort((a,b)=>(L(b).pcp??-999)-(L(a).pcp??-999));
  const row=p=>{const l=L(p),own=mine.has(p.id),sv=own?sellPrice(p):p.price,pf=own?sv-purchaseOf(p).paid:0,rt=pwRate(p.id),net=num(l.tie)-num(l.toe);
    return `<div class="pw-r">${dsFace(p)}${wpNm(p)}${dsFig("£"+p.price.toFixed(1))}
      <span class="pw-s">${dsFig("£"+sv.toFixed(1))}${own?`<i class="${pf>0.05?"up":pf<-0.05?"dn":""}">${Math.abs(pf)<0.05?"±0":sgn1(pf)}</i>`:`<i>buy</i>`}</span>
      ${pwProg(l.pcp,pwProj(l))}${pwNow(l.pcp)}${pwWhen(pwDue(l))}
      ${rt==null?`<b class="ds-fig mu" title="Needs an hour of the price log">–</b>`:dsFig(`${rt>=0?"+":"−"}${Math.abs(rt).toFixed(2)}`,rt>0.5?"up":rt<-0.5?"dn":"")}
      ${l.tie==null?dsFig("–"):dsFig(pwK(net),net>0?"up":net<0?"dn":"")}</div>`;};
  const tabs=`<span class="hz">${[["mine","My team"],["watch","Watchlist"],["all","All players"]].map(([k,n2])=>`<button class="${T===k?"on":""}" onclick="act('pwtab','${k}')">${n2}</button>`).join("")}</span>`;
  const squad=`<section class="panel pw-col">${dsHead("users","Your squad",tabs)}
    <div class="pw-r pw-h ds-th"><span></span><span>Player</span><span>Price</span><span>Sell · profit</span><span class="c">Progress <i>· ghost = FPL’s projection</i></span><span>Now</span><span>Due</span><span>Per hr</span><span>Net GW</span></div>
    <div class="pw-rows">${list.length?list.map(row).join(""):`<p class="pw-none">${T==="watch"?"Star a player in Market to watch him here.":"FPL’s price predictor did not load."}</p>`}</div></section>`;
  /* Tonight, across the game */
  const P=all.map(p=>({p,l:L(p),pr:pwProj(L(p))})).filter(x=>!pwLocked(x.l));
  const riseP=P.filter(x=>x.l.pcp>=100||x.pr>=100).sort((a,b)=>b.p.owned-a.p.owned),riseM=P.filter(x=>x.l.pcp<100&&x.pr>=95&&x.pr<100).sort((a,b)=>b.pr-a.pr);
  const fallR=P.filter(x=>x.l.pcp<=-100).sort((a,b)=>b.p.owned-a.p.owned),fallP=P.filter(x=>x.l.pcp>-100&&x.pr<=-100).sort((a,b)=>b.p.owned-a.p.owned);
  const tr=x=>`<div class="pw-tr${mine.has(x.p.id)?" me":""}">${dsFace(x.p)}<span class="ds-name">${esc(x.p.web_name)}</span>${mine.has(x.p.id)?`<span class="pw-y">yours</span>`:"<span></span>"}${dsFig("£"+x.p.price.toFixed(1))}${pwNow(x.l.pcp)}</div>`;
  const grp=(t,rows)=>rows.length?`<div class="pw-tg"><span class="pw-gl">${t}</span>${rows.map(tr).join("")}</div>`:"";
  const shown=(a,b)=>[a.slice(0,2),b.slice(0,2)],[rA,rB]=shown(riseP,riseM),[fA,fB]=shown(fallR,fallP);
  const more=(tot,sh)=>tot>sh?`<span class="pw-more">+${tot-sh} more</span>`:"";
  const tonight=`<section class="panel pw-col">${dsHead("clock-alert","Tonight",`<span class="ds-sub">changes at ${nextT}</span>`)}
    <div class="pw-two"><div class="pw-ts up"><div class="pw-tsh">${lic("trending-up",14)} Rising ${dsFig(String(riseP.length),"up")}</div>${grp("Projected",rA)}${grp("Maybe · 95%+",rB)}${!rA.length&&!rB.length?grp("None due · closest",P.filter(x=>x.pr>0).sort((a,b)=>b.pr-a.pr).slice(0,2)):""}${more(riseP.length+riseM.length,rA.length+rB.length)}</div>
      <div class="pw-ts dn"><div class="pw-tsh">${lic("trending-down",14)} Falling ${dsFig(String(fallR.length+fallP.length),"dn")}</div>${grp("Reached",fA)}${grp("Projected",fB)}${!fA.length&&!fB.length?grp("None due · closest",P.filter(x=>x.pr<0).sort((a,b)=>a.pr-b.pr).slice(0,2)):""}${more(fallR.length+fallP.length,fA.length+fB.length)}</div></div></section>`;
  /* Market: closest to a change, not yours, with the watchlist star */
  const MT=S.pwMkt==="fall"?"fall":"rise";
  const mk=all.filter(p=>!mine.has(p.id)&&!pwLocked(L(p))).sort((a,b)=>MT==="rise"?pwProj(L(b))-pwProj(L(a)):pwProj(L(a))-pwProj(L(b))).slice(0,5);
  const mkRow=p=>{const l=L(p),on=watch.includes(p.id);return `<div class="pw-mk">${dsFace(p)}${wpNm(p)}${dsFig("£"+p.price.toFixed(1))}${pwProg(l.pcp,pwProj(l))}${pwNow(l.pcp)}${pwWhen(pwDue(l))}
    <button class="pw-st${on?" on":""}" onclick="act('pwstar',${p.id})" aria-pressed="${on}" title="${on?"Remove from":"Add to"} your watchlist">${lic("star",14)}</button></div>`;};
  const F=S.field&&S.field.gws&&S.field.gws[S.field.latest||Math.max(...Object.keys(S.field.gws).map(Number))];
  const pairs=((F&&F.near&&F.near.pairs)||[]).map(([o,i,c])=>({o:S.model.players.find(x=>x.id===o),i:S.model.players.find(x=>x.id===i),c})).filter(x=>x.o&&x.i).slice(0,2);
  const market=`<section class="panel pw-col pw-mkt">${dsHead("search","Market",`<span class="hz">${[["rise","Risers"],["fall","Fallers"]].map(([k,n2])=>`<button class="${MT===k?"on":""}" onclick="act('pwmkt','${k}')">${n2}</button>`).join("")}</span>`)}
    <div class="pw-mks">${mk.map(mkRow).join("")}</div>
    <div class="pw-pairs"><span class="pw-gl">Most traded near your rank${F?" · GW"+F.gw:""}</span>${pairs.length?pairs.map(x=>`<div class="pw-pair">${dsFace(x.o)}<span class="ds-name dn">${esc(x.o.web_name)}</span>${lic("arrow-right",13)}${dsFace(x.i)}<span class="ds-name">${esc(x.i.web_name)}</span>${dsFig(x.c+"%")}</div>`).join("")
      :`<span class="ds-sub pw-none">The field sample has not run yet.</span>`}</div></section>`;
  const upd=S.fplLive&&S.fplLive.fetchedAt?Date.parse(S.fplLive.fetchedAt):null;
  const body=`${tiles}<div class="pw-g">${squad}<div class="pw-rc">${tonight}${market}</div></div>`;
  return wkPopModal("trending-up","#4ADE80","Price Watch",`<span class="wp-ft">FPL’s own price progress${upd?` · updated ${wpAgo(upd)} ago`:""}</span>`,body,"pw");
}

/* ---------- Fixture Outlook ---------- */
/* One method (Andy, 22 Nov 2026): the fixture chips' difficulty scale
   averaged over the window; a blank counts 5, a double one easier.
   Overall by default; Attack and Defence use the chips' own lenses. */
const foLens=()=>["att","def"].includes(S.foLens)?S.foLens:"all";
const foDiff=(f,lens)=>fdrBand(lens==="att"?(f.diffAtt??f.diff):lens==="def"?(f.diffDef??f.diff):f.diff);
function foRun(p,g,n,lens){let s=0,k=0;
  for(let e=g;e<g+n&&e<=38;e++){const q=p.gw[e];k++;
    if(!q||q.blank||!q.fixtures.length){s+=5;continue;}
    s+=q.fixtures.reduce((a,f)=>a+foDiff(f,lens),0)/q.fixtures.length-(q.fixtures.length>1?1:0);}
  return k?s/k:5;}
/* a club's run on the Teams page's own scale for that lens */
function foClubRun(t,g,n,lens){let s=0,k=0;
  for(let e=g;e<g+n&&e<=38;e++){const fx=tgFx(t,e);k++;
    if(!fx.length){s+=5;continue;}
    s+=fx.reduce((a,x)=>a+tgBand(t,x,lens),0)/fx.length-(fx.length>1?1:0);}
  return k?s/k:5;}
const foRc=v=>v<=2.2?"e":v<=2.8?"m":"h";
function fixtureOutlookHTML(){
  const g=VG(),H=S.foH||5,n=hzWeeks(H,g),lens=foLens(),sp=squadPlayers(),xi=startingXI();
  const cols=Math.min(n,6,39-g),W=[];for(let e=g;e<g+cols;e++)W.push(e);
  const runs=new Map(sp.map(p=>[p.id,foRun(p,g,n,lens)]));
  const pcol=v=>v>=6?"hi":v>=4?"md":"lo";
  const chip=(f,e)=>fxChip(f.opp,f.home,foDiff(f,lens),{title:`GW${e}: ${f.oppName||f.opp} ${f.home?"(home)":"(away)"} · difficulty ${foDiff(f,lens)}`});
  const cell=(p,e)=>{const q=p.gw[e],v=q&&!q.blank?q.pts||0:0;
    if(!q||q.blank||!q.fixtures.length)return `<span class="fo-c"><span class="fo-b">BGW</span><i class="lo">0.0</i></span>`;
    return q.fixtures.length>1?`<span class="fo-c dgw"><span class="fo-2">${q.fixtures.map(f=>chip(f,e)).join("")}</span><i class="${pcol(v)}">${v.toFixed(1)}</i></span>`
      :`<span class="fo-c">${chip(q.fixtures[0],e)}<i class="${pcol(v)}">${v.toFixed(1)}</i></span>`;};
  const cw=cols<=3?84:cols===4?70:62;
  const gc=`style="grid-template-columns:24px minmax(0,1fr) repeat(${W.length},${cw}px) 50px 42px"`;
  let prevPos=0;
  const rows=sp.slice().sort((a,b)=>a.pos-b.pos||hPts(b,g,n)-hPts(a,g,n)).map(p=>{const v=runs.get(p.id),sep=prevPos&&prevPos!==p.pos;prevPos=p.pos;const t=wpTeam(p);
    return `<div class="fo-r${sep?" sep":""}" ${gc}>${dsFace(p)}<span class="wp-nm"><span class="ds-name">${esc(p.web_name)}</span><span class="fo-cb">${t?dsBadge(t,13):""}<span class="ds-sub">${esc(p.teamName)} · ${POSL[p.pos]}</span></span></span>
      ${W.map(e=>cell(p,e)).join("")}<b class="fo-tot">${hPts(p,g,n).toFixed(1)}</b><b class="fo-run ${foRc(+v.toFixed(1))}">${v.toFixed(1)}</b></div>`;}).join("");
  const lensBtns=`<span class="hz">${[["all","Overall"],["att","Attack"],["def","Defence"]].map(([k,n2])=>`<button class="${lens===k?"on":""}" onclick="act('folens','${k}')">${n2}</button>`).join("")}</span>`;
  const grid=`<section class="panel fo-col">${dsHead("calendar","Your squad",lensBtns)}
    <div class="fo-r fo-h ds-th" ${gc}><span></span><span>Player</span>${W.map(e=>`<span>GW${e}</span>`).join("")}<span>xPts${n>cols?" "+(H==="ROS"?"ROS":n+" GW"):""}</span><span>Run</span></div>
    <div class="fo-rows">${rows}</div>
    <div class="fo-leg"><span>Easy</span>${[1,2,3,4,5].map(d=>`<span class="fxc d${d}">${d}</span>`).join("")}<span>Hard</span><button class="fci" aria-label="About" data-tip="Run averages the window: a blank counts 5, a double one easier.">i</button></div></section>`;
  /* clubs to target and avoid, on the Teams page's scores */
  const tl=lens==="all"?"all":lens;
  const clubs=(S.teams||[]).map(t=>({t,v:foClubRun(t,g,n,tl),sc:tgScore(t,g,Math.min(38,g+n-1)),own:sp.filter(p=>p.team===t.id).length})).sort((a,b)=>a.v-b.v||b.sc.pts-a.sc.pts);
  const club=(c,tone)=>{const fx=[];for(let e=g;e<g+n&&e<=38&&fx.length<5;e++)tgFx(c.t,e).forEach(x=>fx.length<5&&fx.push(fxChip(x.opp.short,x.home,tgBand(c.t,x,tl),{title:`GW${e}: ${x.opp.name} ${x.home?"(home)":"(away)"}`})));
    return `<div class="fo-cl ${tone}">${dsBadge(c.t,30)}<span class="wp-nm"><span class="ds-name">${esc(c.t.name)}</span><span class="ds-sub">Attack ${c.sc.gf.toFixed(2)} xG · CS ${Math.round(c.sc.cs*100)}%</span></span>
      <span class="fo-cs">${fx.join("")}</span><span class="fo-o${c.own?"":" no"}">${c.own?`${c.own} of yours`:"none of yours"}</span><b class="fo-run ${foRc(+c.v.toFixed(1))} fo-cr">${c.v.toFixed(1)}</b></div>`;};
  const link=`<a class="fo-lnk" href="${routeFor("fixtures")}" onclick="S.fixMode='grid';return go(event,'fixtures')">Fixture Grid ${lic("arrow-right",12)}</a>`;
  const clubBox=`<section class="panel fo-col fo-cbox">${dsHead("target","Clubs to target",link)}${clubs.slice(0,3).map(c=>club(c,"up")).join("")}
    ${dsHead("ban","Clubs to avoid","")}${clubs.slice(-3).reverse().map(c=>club(c,"dn")).join("")}</section>`;
  /* the XI week by week: projected points and the average difficulty */
  const CW=[];for(let e=g;e<g+Math.min(n,8)&&e<=38;e++)CW.push(e);
  const wk=CW.map(e=>{let d=0,k=0;xi.forEach(p=>{const q=p.gw[e];if(q&&!q.blank)q.fixtures.forEach(f=>{d+=foDiff(f,lens);k++;});});
    return{e,pts:xi.reduce((a,p)=>a+(p.gw[e]?.pts||0),0),dif:k?d/k:3,blank:xi.some(p=>{const q=p.gw[e];return !q||q.blank||!q.fixtures.length;}),dbl:xi.some(p=>p.gw[e]&&p.gw[e].fixtures.length>1)};});
  const Wd=520,Hc=150,pl=30,pr=26,pt=18,pb=24,slot=(Wd-pl-pr)/Math.max(1,wk.length),top=Math.max(50,Math.ceil(Math.max(...wk.map(x=>x.pts),1)/50)*50);
  const y=v=>pt+(Hc-pt-pb)*(1-v/top),yd=d=>pt+(Hc-pt-pb)*((d-1)/4);
  let svg=[0,top/2,top].map(v=>`<line class="cgrid" x1="${pl}" x2="${Wd-pr}" y1="${y(v)}" y2="${y(v)}"/><text class="cax" x="${pl-6}" y="${y(v)+4}" text-anchor="end">${v}</text>`).join("");
  [1,5].forEach(d=>svg+=`<text class="cax" x="${Wd-pr+6}" y="${yd(d)+4}">${d}</text>`);
  wk.forEach((x,k)=>{const cx=pl+slot*k+slot/2,bw=Math.min(40,slot*.6);
    svg+=`<rect x="${cx-bw/2}" y="${y(x.pts)}" width="${bw}" height="${Math.max(0,y(0)-y(x.pts))}" rx="5" fill="${x.blank?"#5A4A26":x.dbl?"#2E7CC0":"#2E9E62"}"><title>GW${x.e}: ${x.pts.toFixed(1)} projected · difficulty ${x.dif.toFixed(1)}</title></rect>
      <text x="${cx}" y="${y(x.pts)-5}" text-anchor="middle" class="fo-cv">${x.pts.toFixed(1)}</text><text class="cax" x="${cx}" y="${Hc-7}" text-anchor="middle">GW${x.e}${wk.length<=6?(x.blank?" · BGW":x.dbl?" · DGW":""):""}</text>`;});
  if(wk.length>1)svg+=`<polyline points="${wk.map((x,k)=>`${pl+slot*k+slot/2},${yd(x.dif)}`).join(" ")}" fill="none" stroke="#FFB020" stroke-width="2" stroke-dasharray="5 4"/>`;
  svg+=wk.map((x,k)=>`<circle cx="${pl+slot*k+slot/2}" cy="${yd(x.dif)}" r="3.5" fill="#FFB020"/>`).join("");
  const weekly=`<section class="panel fo-col fo-wk">${dsHead("activity","Your XI week by week",`<span class="fo-lg"><i style="background:#2E9E62"></i>xPts <i style="background:#FFB020"></i>difficulty</span>`)}<svg class="chart" viewBox="0 0 ${Wd} ${Hc}" role="img" aria-label="Your XI week by week">${svg}</svg></section>`;
  /* tiles */
  const byRun=sp.slice().sort((a,b)=>runs.get(a.id)-runs.get(b.id)),avg=sp.reduce((a,p)=>a+runs.get(p.id),0)/Math.max(1,sp.length);
  const xiPts=xi.reduce((a,p)=>a+hPts(p,g,n),0);
  const weekOf=test=>{for(let e=g;e<g+n&&e<=38;e++){const ps=sp.filter(p=>test(p.gw[e]));if(ps.length)return{e,ps};}return null;};
  const bl=weekOf(q=>!q||q.blank||!q.fixtures.length),db=weekOf(q=>q&&q.fixtures.length>1);
  const who=x=>{const clubs2=[...new Set(x.ps.map(p=>p.teamFull||p.teamName))];return clubs2.length===1&&x.ps.length>1?`${x.ps.length} ${esc(clubs2[0])} players`:x.ps.slice(0,2).map(p=>esc(p.web_name)).join(" · ")+(x.ps.length>2?` +${x.ps.length-2}`:"");};
  const span=H==="ROS"?"ROS":n+" GW";
  const tiles=`<div class="ds-tiles fo-t">${dsTile("Squad run",avg.toFixed(1),`average over ${span}`)}${dsTile(`XI next ${H==="ROS"?"ROS":n}`,xiPts.toFixed(1),"projected points")}
    ${byRun[0]?dsTile("Best run",runs.get(byRun[0].id).toFixed(1),`${esc(byRun[0].web_name)} · ${esc(byRun[0].teamName)}`,"up"):""}
    ${byRun.length?dsTile("Worst run",runs.get(byRun[byRun.length-1].id).toFixed(1),`${esc(byRun[byRun.length-1].web_name)} · ${esc(byRun[byRun.length-1].teamName)}`,"dn"):""}
    ${dsTile("Blank ahead",bl?"GW"+bl.e:"None",bl?who(bl):`no blanks in ${span}`,bl?"dn":"")}${dsTile("Double ahead",db?"GW"+db.e:"None",db?who(db):`no doubles in ${span}`,db?"up":"")}</div>`;
  const body=`${tiles}<div class="fo-g">${grid}<div class="fo-rc">${clubBox}${weekly}</div></div>`;
  return wkPopModal("calendar","#22D3EE","Fixture Outlook",hz4HTML(H,"foh"),body,"fo");
}

/* ---------- Performance ---------- */
const PM_WIN=[[3,"Last 3"],[6,"Last 6"],["season","Season"]];
const pmWin=()=>PM_WIN.some(w=>w[0]===S.pmWin)?S.pmWin:6;
function pmWeeks(win){const G=S.model.next.id,a=win==="season"?1:Math.max(1,G-win),o=[];for(let e=a;e<G;e++)o.push(e);return o;}
const pmAct=(p,e)=>{const A=S.playerActuals||{},a=A[p.id]||A[String(p.id)]||{};const v=a[e]??a[String(e)];return v==null?null:+v;};
/* one player's window: points, against prediction, expected and actual
   goal involvement, minutes, bonus, DefCon, Dream Teams */
function pmRow(p,weeks,lite){
  const rows=((S.hist||{})[String(p.code)]||[]).filter(r=>r.tag==="now"&&weeks.includes(r.gw));
  let pts=0,vp=0,np=0;weeks.forEach(e=>{const a=pmAct(p,e);if(a!=null)pts+=a;const pp=pastPred(p,e);if(a!=null&&pp){vp+=a-pp.v;np++;}});
  const mins=rows.reduce((a,r)=>a+(+r.mins||0),0),ga=rows.reduce((a,r)=>a+(r.g||0)+(r.a||0),0),xga=rows.reduce((a,r)=>a+(r.xg||0)+(r.xa||0),0);
  let bon=0,dc=0,apps=0,dt=0,wk=0;
  if(!lite)weeks.forEach(e=>{const W=weekLive(e),x=W&&W.players&&W.players[p.id];if(W&&W.players)wk++;if(!x)return;bon+=x.b||0;dt+=x.dt||0;if(x.m>0){apps++;dc+=x.dc||0;}});
  const full=wk===weeks.length,season=weeks[0]===1;
  const G=S.model.next.id,l4=[G-4,G-3,G-2,G-1].map(e=>e<1?null:((S.hist||{})[String(p.code)]||[]).filter(r=>r.tag==="now"&&r.gw===e).reduce((a,r)=>a+(+r.mins||0),0));
  return{p,pts,vp:np?vp:null,x90:mins>=90&&p.pos>1?xga*90/mins:null,ga,xga,mins,l4,
    bon:full?bon:season?num(p.bonus):null,dc:p.pos===2||p.pos===3?(full?(apps?dc/apps:null):(p.dcApps?p.dcHits/p.dcApps:null)):null,
    dt:full?dt:(season?num((fplLive(p)||{}).dt):null),last6:[G-6,G-5,G-4,G-3,G-2,G-1].map(e=>e<1?null:pmAct(p,e)),mo:momentum(p)};
}
const pmLuck=r=>{const d=r.ga-r.xga;return Math.abs(d)<0.8?`<span class="pm-l n">as expected</span>`:d>0?`<span class="pm-l lk">lucky ${sgn1(d)}</span>`:`<span class="pm-l ul">unlucky ${sgn1(d)}</span>`;};
function performanceHTML(){
  const win=pmWin(),weeks=pmWeeks(win),sp=squadPlayers(),mine=new Set(sp.map(p=>p.id)),wl=(PM_WIN.find(w=>w[0]===win)||[])[1];
  const R=sp.map(p=>pmRow(p,weeks)).sort((a,b)=>(b.vp??-99)-(a.vp??-99)||b.pts-a.pts);
  const spark=v=>`<span class="pm-sp">${v.map(x=>`<i style="height:${Math.max(2,Math.max(0,x||0)/16*22)}px;background:${x==null?"#262626":x>=8?"#3DDC97":x>=4?"#7FA8C9":"#55606F"}" title="${x==null?"no match":x+" pts"}"></i>`).join("")}</span>`;
  const mn=l=>`<span class="pm-mn">${l.map(v=>`<i class="${v==null?"z":v>=60?"f":v>0?"p":"z"}" title="${v==null?"–":v+"′"}"></i>`).join("")}</span>`;
  const mo=m=>m&&m.heat?`<span class="tile" style="--tc:#4ADE80" title="Heating Up: ${esc(m.why)}">${lic("flame",14)}</span>`:m&&m.cool?`<span class="tile" style="--tc:#FF5A6E" title="Cooling Off: ${esc(m.why)}">${lic("snowflake",14)}</span>`:"";
  const row=r=>{const p=r.p;return `<div class="pm-r">${dsFace(p)}<span class="wp-nm"><span class="ds-name">${esc(p.web_name)}${r.dt?`<span class="pm-dt" title="${r.dt} Dream Team${r.dt>1?"s":""}">${lic("star",9)}${r.dt>1?r.dt:""}</span>`:""}</span><span class="ds-sub">${esc(p.teamName)} · ${POSL[p.pos]}</span></span>
    ${spark(r.last6)}${dsFig(r.pts)}${r.vp==null?dsFig("–"):dsFig(sgn1(r.vp),r.vp>=1?"up":r.vp<=-1?"dn":"")}${dsFig(r.x90==null?"–":r.x90.toFixed(2))}
    <span class="pm-ga">${dsFig(`${r.ga} / ${r.xga.toFixed(1)}`)}${p.pos>1?pmLuck(r):`<span class="pm-l n">keeper</span>`}</span>
    ${mn(r.l4)}${dsFig(r.bon==null?"…":r.bon||"–")}${dsFig(r.dc==null?"–":Math.round(r.dc*100)+"%")}<span class="pm-m">${mo(r.mo)}</span></div>`;};
  const board=`<section class="panel pm-col">${dsHead("flame","Your squad",`<span class="ds-sub">sorted by points vs predicted</span>`)}
    <div class="pm-r pm-h ds-th"><span></span><span>Player</span><span>Last 6</span><span>Pts</span><span>vs pred</span><span>xGI/90</span><span>G+A / expected</span><span>Mins</span><span>Bonus</span><span>DefCon</span><span></span></div>
    <div class="pm-rows">${R.map(row).join("")}</div></section>`;
  /* expected against actual goal involvement */
  const pts=R.filter(r=>r.p.pos>1&&(r.xga>=0.5||r.ga>=1)),mx=Math.max(4,Math.ceil(Math.max(0,...pts.map(r=>Math.max(r.ga,r.xga)))/2)*2);
  const Wd=470,Hc=175,pl=30,pb=26,pt=10,pr=10,X=v=>pl+v/mx*(Wd-pl-pr),Y=v=>pt+(Hc-pt-pb)*(1-v/mx),step=mx<=6?1:2;
  let g="";for(let v=0;v<=mx;v+=step)g+=`<line class="cgrid" x1="${pl}" x2="${Wd-pr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="cax" x="${pl-6}" y="${Y(v)+4}" text-anchor="end">${v}</text><text class="cax" x="${X(v)}" y="${Hc-8}" text-anchor="middle">${v}</text>`;
  g+=`<polygon points="${X(0)},${Y(0)} ${X(mx)},${Y(mx)} ${X(0)},${Y(mx)}" fill="rgba(255,176,32,.05)"/><polygon points="${X(0)},${Y(0)} ${X(mx)},${Y(mx)} ${X(mx)},${Y(0)}" fill="rgba(122,162,255,.05)"/>`;
  g+=`<line x1="${X(0)}" y1="${Y(0)}" x2="${X(mx)}" y2="${Y(mx)}" stroke="#5A5A5A" stroke-dasharray="4 4"/><text x="${X(mx*.12)}" y="${Y(mx*.88)}" class="pm-zl" fill="#FFB020">Overperforming · may cool</text><text x="${X(mx*.96)}" y="${Y(mx*.08)}" text-anchor="end" class="pm-zl" fill="#7AA2FF">Underperforming · due a return</text>`;
  const lab=[],dots=pts.map(r=>[X(r.xga),Y(r.ga),r]);
  /* a name sits right of its dot, else left, else not at all, never over another dot or name */
  const place=(r,x,y)=>{const w=r.p.web_name.length*6.2;for(const [x0,anc] of [[x+9,"start"],[x-9-w,"end"]]){const x1=x0+w;
    if(x0<pl||x1>Wd-pr)continue;if(dots.some(([dx,dy,o])=>o!==r&&Math.abs(dy-y)<9&&dx>x0-6&&dx<x1+6))continue;
    if(lab.some(([a,b,c])=>Math.abs(b-y)<12&&a<x1&&c>x0))continue;lab.push([x0,y,x1]);return `<text x="${anc==="start"?x0:x1}" y="${y+4}" text-anchor="${anc}" class="pm-pl">${esc(r.p.web_name)}</text>`;}return "";};
  pts.slice().sort((a,b)=>Math.abs(b.ga-b.xga)-Math.abs(a.ga-a.xga)).forEach(r=>{const d=r.ga-r.xga,col=Math.abs(d)<0.8?"#BDBDBD":d>0?"#FFB020":"#7AA2FF";
    g+=`<circle cx="${X(r.xga)}" cy="${Y(r.ga)}" r="6" fill="${col}" fill-opacity=".85" stroke="#0B0B0B" stroke-width="1.5" onclick="act('card',${r.p.id})" style="cursor:pointer"><title>${esc(r.p.web_name)}: ${r.ga} G+A from ${r.xga.toFixed(1)} expected</title></circle>${Math.abs(d)>=0.8||r.xga>=mx*.4?place(r,X(r.xga),Y(r.ga)):""}`;});
  g+=`<text x="${(Wd+pl)/2}" y="${Hc}" text-anchor="middle" class="cax">expected goals + assists</text>`;
  const scatter=`<section class="panel pm-col pm-sc">${dsHead("target","Expected vs actual",`<span class="ds-sub">goals + assists, ${win==="season"?"this season":"last "+win+" GW"}</span>`)}<svg class="chart" viewBox="0 0 ${Wd} ${Hc+4}" role="img" aria-label="Expected against actual goals and assists">${g}</svg></section>`;
  /* Hot and cold */
  const heat=R.filter(r=>r.mo&&r.mo.heat).slice(0,2),cool=R.filter(r=>r.mo&&r.mo.cool).slice(0,3);
  const short=w=>esc(String(w||"").replace(/^losing his place: /,"").replace(/ this season$/,"").replace(/ a match over the last 4/,"").slice(0,34));
  const targets=S.model.players.filter(p=>!mine.has(p.id)&&p.avail>=.75&&(p.xMins||0)>=60).sort((a,b)=>b.form-a.form).slice(0,5-heat.length>3?3:5-heat.length);
  const avoid=S.model.players.filter(p=>!mine.has(p.id)&&p.owned>=15&&p.form<=3&&p.minutes>=180).sort((a,b)=>b.owned-a.owned).slice(0,Math.max(2,5-cool.length));
  const hr=(tone,p,why,fig)=>`<div class="pm-hr ${tone}">${dsFace(p)}${wpNm(p,why)}${fig!=null?dsFig(fig,tone):"<span></span>"}</div>`;
  const grp=(cls,icon,t,rows,none)=>`<div class="pm-hh ${cls}">${lic(icon,13)}${t}</div>${rows.length?rows.join(""):`<span class="ds-sub pm-none">${none}</span>`}`;
  const hot=`<section class="panel pm-col pm-hot">${dsHead("activity","Hot and cold","")}<div class="pm-two">
    <div class="pm-hc up"><div class="pm-ht up">Positive</div>${grp("up","flame","Heating up",heat.map(r=>hr("up",r.p,short(r.mo.why),r.vp==null?null:sgn1(r.vp))),"None of yours right now")}
      ${grp("up","target","Targets",targets.map(p=>hr("up tg",p,`${POSL[p.pos]} · £${p.price.toFixed(1)} · not yours`,p.form.toFixed(1))),"No one in form")}</div>
    <div class="pm-hc dn"><div class="pm-ht dn">Negative</div>${grp("dn","snowflake","Cooling off",cool.map(r=>hr("dn",r.p,short(r.mo.why),r.vp==null?null:sgn1(r.vp))),"None of yours right now")}
      ${grp("dn","ban","Avoid",avoid.map(p=>hr("dn",p,`${p.owned.toFixed(0)}% owned · form ${p.form.toFixed(1)}`,p.form.toFixed(1))),"No popular player out of form")}</div></div></section>`;
  /* tiles */
  const tot=R.reduce((a,r)=>a+r.pts,0),vpT=R.reduce((a,r)=>a+(r.vp||0),0),withVp=R.filter(r=>r.vp!=null);
  const best=withVp[0],worst=withVp[withVp.length-1],beat=R.filter(r=>r.p.pos>1&&r.ga-r.xga>=0.8);
  const names=list=>list.slice(0,3).map(p=>esc(p.web_name)).join(" · ")||"none";
  const tiles=`<div class="ds-tiles pm-t">${dsTile(`Squad ${win==="season"?"season":"last "+win}`,String(tot),withVp.length?`${sgn1(vpT)} vs predicted`:"no predictions stored",withVp.length?(vpT>=0?"up":"dn"):"")}
    ${dsTile("Best",best?sgn1(best.vp):"–",best?esc(best.p.web_name):"no predictions stored",best&&best.vp>=0?"up":"")}${dsTile("Worst",worst?sgn1(worst.vp):"–",worst?esc(worst.p.web_name):"no predictions stored",worst&&worst.vp<0?"dn":"")}
    ${dsTile("Heating up",String(R.filter(r=>r.mo&&r.mo.heat).length),names(R.filter(r=>r.mo&&r.mo.heat).map(r=>r.p)),"up")}${dsTile("Cooling off",String(R.filter(r=>r.mo&&r.mo.cool).length),names(R.filter(r=>r.mo&&r.mo.cool).map(r=>r.p)),"dn")}
    ${dsTile("Beating xG",String(beat.length),names(beat.map(r=>r.p)))}</div>`;
  const ctl=`<span class="hz ds-hz" role="group" aria-label="Window">${PM_WIN.map(([k,l])=>`<button class="${win===k?"on":""}" onclick="act('pmwin','${k}')">${l}</button>`).join("")}</span>`;
  const body=`${tiles}<div class="pm-g">${board}<div class="pm-rc">${scatter}${hot}</div></div>`;
  return wkPopModal("flame","#FF8A3D","Performance",ctl,body,"pm");
}
/* what each strip card opens */
function popHTML(){
  const k=S.pop;if(!k||!S.model)return "";
  if(TG_TARGETS[k])return tgTargetPopHTML(k);
  const D=weekData(),{g,h}=D;
  const L=p=>fplLive(p)||{};
  const ctl=hzHTML(h,"weekh");
  /* full-screen pop-ups (20 Nov 2026): long ones split into tabs so each fits */
  const tabs=(list,cur)=>`<span class="hz poptabs" role="group" aria-label="Section">${list.map(([k2,n])=>`<button class="${cur===k2?"on":""}" aria-pressed="${cur===k2}" onclick="act('poptab','${k2}')">${n}</button>`).join("")}</span>`;
  if(k==="move")return transfersPopHTML();
  if(k==="cap")return captainPopHTML();
  if(k==="trec")return transferRecordHTML();
  if(k==="price")return priceWatchHTML();
  /* This Week's new pop-ups: the Squad Dashboard's detail */
  if(k==="h2h")return lkH2hHTML();
  if(k==="rank")return rankPopHTML();
  if(k==="rating"||k==="str")return ratingPopHTML();
  if(k==="week")return yourWeekHTML();
  if(k==="out")return fixtureOutlookHTML();
  if(k==="form")return performanceHTML();
  if(k==="warn")return teamNewsHTML();
  return "";
}
/* ============================================================
   THIS WEEK BATCH 2 (22 Nov 2026, Andy approved the mocks): Transfers
   (Optimal Moves, Plan, Sell & Fund, Rivals), Captain (This Week, Season
   Record) and Transfer Record (in the Rivals card's place). Built from the
   ds- parts. Every action is the Planner's own (doswap, cap, vice,
   ignore, toggleout, docombo, dofund), so a move made here is in the plan.
   ============================================================ */
const twSg=v=>(v>=0?"+":"−")+Math.abs(v).toFixed(1);
function twField(){const F=S.field;return F&&F.gws?F.gws[F.latest]||null:null;}
/* the top 10k's effective ownership at the last deadline (batch 6) */
function fieldEO10k(){const F=twField();return F&&F.top10k&&F.top10k.eo?F.top10k.eo:null;}
const twMap=()=>new Map(S.model.players.map(p=>[p.id,p]));
/* a given swap's gain over the h weeks from the gameweek in view */
function twPairGain(m,h){const g=VG();return xiGain(S.squad||[],m.out.id,m.inn.id,g,Math.min(h,39-g),twMap());}
const twTabs=(list,cur)=>`<span class="hz poptabs" role="group" aria-label="Section">${list.map(([k,n])=>`<button class="${cur===k?"on":""}" aria-pressed="${cur===k}" onclick="act('poptab','${k}')">${n}</button>`).join("")}</span>`;
const twBar=(pct,col)=>`<span class="tw-bt"><i style="width:${clamp(Math.round(pct),0,100)}%;${col?`background:${col}`:""}"></i></span>`;

/* ---------- Transfers ---------- */
function transfersPopHTML(){
  const g=VG(),T=["best","plan","fund","rivals"].includes(S.popTab)?S.popTab:"best";
  const ft=freeWeek(g)?"free week":`${freeLeft(g)} FT`;
  const hz=T==="plan"?hz4HTML(S.planH||5,"planh",[1,"ROS"]):T==="fund"?"":hz4HTML(S.twH||1,"twh");
  const body=T==="plan"?twPlanHTML(g):T==="fund"?twFundHTML(g):T==="rivals"?twRivalsHTML(g):twBestHTML(g);
  return modalHTML("Transfers",body,{wide:true,cls:"tw",icon:lic("arrow-right-left",18),
    ctl:twTabs([["best","Optimal Moves"],["plan","Plan"],["fund","Sell &amp; Fund"],["rivals","Rivals"]],T)+`<span class="tw-sp"></span><span class="tw-ft">${lic("wallet",14)} £${planBank().toFixed(1)} · ${ft}</span>${hz}`});
}
function twSide(p,role,g){const L=fplLive(p)||{},pc=L.pcp,q=p.gw[g]||{};
  return `<div class="tw-side ${role}"><div class="tw-top">${dsFace(p,"xl")}<div class="tw-who"><span class="tw-tag ${role}">${role==="out"?"OUT":"IN"}</span><b>${esc(p.web_name)}</b>
    <i>${esc(p.teamName)} · ${POSL[p.pos]} · ${role==="out"?`sells £${sellPrice(p).toFixed(1)}`:`£${p.price.toFixed(1)}`}</i>
    <span class="tw-xp"><em>GW${g}</em><b>${(q.pts||0).toFixed(1)}</b>${pc!=null?`<span class="tw-pc ${pc>=0?"up":"dn"}" title="FPL's progress to tonight's price change">${pc>=0?"▲":"▼"} ${Math.abs(Math.round(pc))}%</span>`:""}</span></div></div>${fxNext(p,g,5,"sm")}</div>`;}
function twBestHTML(g){
  const H=S.twH||1,h=hzWeeks(H,g),pf=S.twPos||0,all=bestSwaps(40,h),list=all.filter(m=>!pf||m.out.pos===pf).slice(0,10);
  const R=rivalOwn(),F=twField();
  const pos=`<span class="hz tw-pos">${[[0,"All"],[1,"GKP"],[2,"DEF"],[3,"MID"],[4,"FWD"]].map(([v,n])=>`<button class="${pf===v?"on":""}" onclick="act('twpos',${v})">${n}</button>`).join("")}</span>`;
  const ign=(S.ignored||[]).map(id=>S.model.players.find(p=>p.id===id)).filter(Boolean);
  const others=F&&F.top10k&&F.top10k.pairs.length?`<div class="tw-oth">${lic("users",13)}<span>Top 10k this week</span>${F.top10k.pairs.slice(0,3).map(([o,i,c])=>{const po=S.model.players.find(p=>p.id===o),pi=S.model.players.find(p=>p.id===i);
      return po&&pi?`<span class="tw-op">${dsFace(po,"xs")}${lic("arrow-right",11)}${dsFace(pi,"xs")}<b class="ds-fig">${c}%</b></span>`:"";}).join("")}</div>`:"";
  const foot=`${others}${ign.length?`<div class="tw-ign">${lic("ban",13)}<span>Not suggesting</span>${ign.map(p=>`<button onclick="act('unignore',${p.id})">${esc(p.web_name)} ${lic("refresh-cw",12)}</button>`).join("")}<button class="lnk" onclick="act('unignore')">Suggest all again</button></div>`:""}`;
  if(!list.length)return `<div class="tw-grid"><section class="panel tw-hero tw-none">${dsHead("circle-arrow-up","Hold")}<p class="note">No single move improves your XI over ${wkSpan(g,h)}. Roll the transfer.</p></section>
    <section class="panel tw-list"><div class="tw-lh">${pos}</div>${foot}</section></div>`;
  const sel=list.find(m=>m.out.id+"-"+m.inn.id===S.twSel)||list[0],mx=Math.max(.1,...list.map(m=>m.gain));
  const hzs=HZ4.map(x=>{const v=twPairGain(sel,hzWeeks(x,g));return `<span class="${String(x)===String(H)?"on":""}"><em>${x==="ROS"?"ROS":x+" GW"}</em><b class="${v>=0?"up":"dn"}">${twSg(v)}</b></span>`;}).join("");
  const bankAfter=planBank()+sel.sell-sel.inn.price,cost=freeLeft(g)>0?(freeWeek(g)?"free week":"1 FT · no hit"):`−${HIT} hit`;
  const own=p=>R&&R.n?(R.own[p.id]||0):0;
  const bf=[["Form",sel.out.form,sel.inn.form,v=>v.toFixed(1)],["xMins",sel.out.xMins||0,sel.inn.xMins||0,v=>Math.round(v)+"′"],["xGI / 90",(sel.out.xg90||0)+(sel.out.xa90||0),(sel.inn.xg90||0)+(sel.inn.xa90||0),v=>v.toFixed(2)],
    ["Points",sel.out.total||0,sel.inn.total||0,v=>Math.round(v)],["Owned",sel.out.owned||0,sel.inn.owned||0,v=>v+"%"]];
  if(R&&R.n)bf.push(["Rivals own",own(sel.out),own(sel.inn),v=>v+"/"+R.n]);
  const fly=bf.map(([l,a,b,f])=>{const m=Math.max(a,b,1e-9);return `<div class="tw-bf"><b class="${a>b?"hi":""}">${f(a)}</b><span class="tw-bfl"><i style="width:${a/m*100}%"></i></span><em>${l}</em><span class="tw-bfr"><i style="width:${b/m*100}%"></i></span><b class="${b>a?"hi":""}">${f(b)}</b></div>`;}).join("");
  const hero=`<section class="panel tw-hero"><div class="tw-duel">${twSide(sel.out,"out",g)}<div class="tw-mid"><span class="tw-arrow">${lic("arrow-right",22)}</span><b class="${sel.gain>=0?"up":"dn"}">${twSg(sel.gain)}</b><i>${wkSpan(g,h)}</i></div>${twSide(sel.inn,"in",g)}</div>
    <div class="tw-hzs">${hzs}<span class="tw-kv"><em>Bank after</em><b>£${bankAfter.toFixed(1)}</b></span><span class="tw-kv"><em>Cost</em><b>${cost}</b></span></div>
    ${lastNextHTML([sel.out,sel.inn],{h:250})}<div class="tw-bfly">${fly}</div>
    <div class="tw-acts"><button class="pri" onclick="act('doswap',${sel.out.id},${sel.inn.id})">${lic("check",15)} Make this transfer</button><button onclick="act('cmpmove',${sel.out.id},${sel.inn.id})">${lic("arrow-right-left",15)} Compare</button><button onclick="act('ignore',${sel.inn.id})">${lic("ban",15)} Ignore ${esc(sel.inn.web_name)}</button></div></section>`;
  const rows=list.map((m,k)=>`<div class="tw-row${m===sel?" sel":""}" onclick="act('twsel','${m.out.id}-${m.inn.id}')"><span class="tw-rk">${k+1}</span>
    <span class="tw-pair">${dsFace(m.out)}<span class="tw-nm out"><b>${esc(m.out.web_name)}</b><i>${esc(m.out.teamName)} · ${POSL[m.out.pos]}</i></span>${lic("arrow-right",14)}${dsFace(m.inn)}<span class="tw-nm"><b>${esc(m.inn.web_name)}</b><i>${esc(m.inn.teamName)} · £${m.inn.price.toFixed(1)}</i></span></span>
    ${fxNext(m.inn,g,3,"sm")}<span class="tw-sig">${sigHTML(m.inn,g)}</span><span class="tw-gb">${twBar(m.gain/mx*100)}<b class="${m.gain>=0?"up":"dn"}">${twSg(m.gain)}</b></span>
    <button class="tw-go" title="Make this transfer" onclick="event.stopPropagation();act('doswap',${m.out.id},${m.inn.id})">${lic("check",15)}</button></div>`).join("");
  return `<div class="tw-grid">${hero}<section class="panel tw-list"><div class="tw-lh">${pos}<span class="ds-sub">${list.length} moves</span></div><div class="tw-rows">${rows}</div>${foot}</section></div>`;
}
function twPlanHTML(g){
  if(!S.model||g!==S.model.next.id)return `<p class="note">The plan starts from the next deadline (GW${S.model.next.id}).</p>`;
  const H=+(S.planH||5)===3?3:5,P=planWeeks(H);if(!P)return `<p class="note">No plan for this squad.</p>`;
  const moves=P.weeks.filter(w=>!w.roll),hits=moves.reduce((a,w)=>a+(w.hit||0),0),lastBank=moves.length?moves[moves.length-1].bank:planBank(),lastW=P.weeks[P.weeks.length-1];
  const ftAfter=Math.min(FT_MAX,lastW.roll?lastW.ft+1:Math.max(0,lastW.ft-1)+1);
  const tiles=`<div class="ds-tiles tw-pt">${dsTile("Net gain",twSg(P.total),`pts over ${P.weeks.length} GW`,P.total>=0?"up":"dn")}${dsTile("Transfers",moves.length,hits?`−${hits} in hits`:"no hits")}${dsTile("Bank at the end","£"+lastBank.toFixed(1),`from £${planBank().toFixed(1)}`)}${dsTile("Free transfers after",ftAfter,`GW${lastW.w+1}`)}</div>`;
  const card=x=>x.roll?`<div class="tw-wk roll"><div class="tw-wh"><b>GW${x.w}</b><span class="tw-fts">${x.ft} FT</span></div><div class="tw-roll">${lic("save",26)}<b>Roll</b><i>${Math.min(FT_MAX,x.ft+1)} FT next week</i></div>
      <div class="tw-under">${x.best?`${esc(x.best.out.web_name)} → ${esc(x.best.inn.web_name)} ${twSg(x.best.gain)}<br><span>under the ${x.bar.toFixed(2)} bar</span>`:"No move improves the XI"}</div></div>`
    :`<div class="tw-wk${x.w===g?" now":""}"><div class="tw-wh"><b>GW${x.w}</b><span class="tw-fts">${x.ft} FT${x.hit?` · −${x.hit}`:""}</span></div>
      <div class="tw-wv">${dsFace(x.out,"md")}<span class="tw-arr">${lic("arrow-right",16)}</span>${dsFace(x.inn,"md")}</div>
      <div class="tw-wn"><b class="dn">${esc(x.out.web_name)} <i>sells £${(x.sell??sellPrice(x.out)).toFixed(1)}</i></b><b class="up">${esc(x.inn.web_name)} <i>£${x.inn.price.toFixed(1)}</i></b></div>
      <div class="tw-wg"><b class="up">${twSg(x.gain)}</b><i>bank £${x.bank.toFixed(1)}</i></div>
      ${x.w===g?`<button class="pri" onclick="act('doswap',${x.out.id},${x.inn.id})">${lic("check",14)} Make this move</button>`:`<span class="tw-later">Planned</span>`}</div>`;
  const byId=twMap(),base=P.weeks.map(x=>xiTotal(S.squad,x.w,byId)),plan=P.weeks.map(x=>xiTotal(x.squad||S.squad,x.w,byId));
  const lo=Math.floor(Math.min(...base,...plan)/10)*10-5,hi=Math.ceil(Math.max(...base,...plan)/10)*10+5,Wd=1400,Hh=330,pl=40,pb=24,pt=18,slot=(Wd-pl-10)/P.weeks.length,y=v=>pt+(Hh-pt-pb)*(1-(v-lo)/((hi-lo)||1));
  let svg="";for(let v=lo;v<=hi;v+=Math.max(5,Math.round((hi-lo)/4/5)*5))svg+=`<line class="cgrid" x1="${pl}" x2="${Wd-10}" y1="${y(v)}" y2="${y(v)}"/><text class="cax" x="${pl-6}" y="${y(v)+4}" text-anchor="end">${v}</text>`;
  P.weeks.forEach((x,k)=>{const x0=pl+slot*k,bw=Math.min(60,slot/3);svg+=`<rect x="${x0+slot/2-bw-3}" y="${y(base[k])}" width="${bw}" height="${y(lo)-y(base[k])}" rx="5" fill="#3A3A3A"/><rect x="${x0+slot/2+3}" y="${y(plan[k])}" width="${bw}" height="${y(lo)-y(plan[k])}" rx="5" fill="#3DDC97"/>
    <text x="${x0+slot/2+3+bw/2}" y="${y(plan[k])-6}" text-anchor="middle" class="ds-cd ${plan[k]>=base[k]?"up":"dn"}">${twSg(plan[k]-base[k])}</text><text class="cax" x="${x0+slot/2}" y="${Hh-6}" text-anchor="middle">GW${x.w}</text>`;});
  return `<div class="tw-plan">${tiles}<div class="tw-weeks" style="grid-template-columns:repeat(${P.weeks.length},1fr)">${P.weeks.map(card).join("")}</div>
    <section class="panel tw-pc"><div class="ds-lg"><span><i style="background:#3A3A3A"></i>No transfers</span><span><i style="background:#3DDC97"></i>With the plan</span><span class="ds-lgr">XI predicted points</span></div><svg class="chart" viewBox="0 0 ${Wd} ${Hh}" role="img" aria-label="XI points with and without the plan">${svg}</svg></section></div>`;
}
/* funding pairs: a sale that pays for an upgrade the bank alone could not
   cover, scored over h weeks (was fundingHTML's, 22 Nov moved here) */
let _fundCache=null;
function fundMoves(h){
  const key=[h,planBank(),S.squad.join("."),(S.ignored||[]).join(".")].join("|");
  if(_fundCache&&_fundCache.key===key&&_fundCache.model===S.model)return _fundCache;
  const single=(bestSwaps(1,h)[0]||{gain:0}).gain,sq=S.squad,res=[];
  for(let i=0;i<sq.length;i++)for(let j=i+1;j<sq.length;j++){
    const c=bestCombo([sq[i],sq[j]],h,6);
    if(!c||c.picks.length!==2||c.gain<single+0.5)continue;
    const cost=m=>m.inn.price-m.sell,bank=planBank();
    if(c.picks.some(m=>cost(m)<-0.05)&&c.picks.some(m=>cost(m)>bank+0.05))res.push(c);}
  res.sort((a,b)=>b.gain-a.gain);
  return _fundCache={key,model:S.model,res:res.slice(0,3),single};
}
function twLeg(m){const d=m.inn.price-m.sell;
  return `<div class="tw-leg">${dsFace(m.out)}<span class="tw-nm out"><b>${esc(m.out.web_name)}</b><i>${esc(m.out.teamName)}</i></span>${lic("arrow-right",14)}${dsFace(m.inn)}<span class="tw-nm"><b>${esc(m.inn.web_name)}</b><i>${esc(m.inn.teamName)} · £${m.inn.price.toFixed(1)}</i></span>
    <span class="tw-mn ${d<0?"up":"dn"}">${d<0?"saves":"costs"} £${Math.abs(d).toFixed(1)}</span><b class="${m.gain>=0?"up":"dn"}">${twSg(m.gain)}</b></div>`;}
function twFundHTML(g){
  if(!S.model||g!==S.model.next.id)return `<p class="note">Sell &amp; Fund works on the next deadline (GW${S.model.next.id}).</p>`;
  const h=3,sel=S.outList||[],sp=squadPlayers(),spend=planBank()+sel.reduce((a,i)=>{const q=sp.find(p=>p.id===i);return a+(q?sellPrice(q):0);},0);
  const pick=`<section class="panel tw-pick"><div class="tw-ph2"><b>Pick players to sell</b><span class="tw-fund"><em>To spend</em><b>£${spend.toFixed(1)}</b><i>bank £${planBank().toFixed(1)}${sel.length?` + sales £${(spend-planBank()).toFixed(1)}`:""}</i></span></div>
    ${[1,2,3,4].map(pos=>`<div class="tw-prow"><span class="tw-pl">${POSL[pos]}</span>${sp.filter(p=>p.pos===pos).sort((a,b)=>b.price-a.price).map(p=>{const on=sel.includes(p.id);
      return `<button class="tw-pk${on?" on":""}" onclick="act('toggleout',${p.id})" aria-pressed="${on}">${on?`<span class="tw-sell">SELL</span>`:""}${dsFace(p,"md")}<b>${esc(p.web_name)}</b><i>£${sellPrice(p).toFixed(1)}</i></button>`;}).join("")}</div>`).join("")}
    <div class="tw-pf">${sel.length?`<button onclick="act('clearout')">Clear</button><span>${sel.length} selected</span>`:`<span>Tap two or more to see the best combination</span>`}</div></section>`;
  const c=sel.length>1?bestCombo(sel,h):null,hit=c?Math.max(0,c.picks.length-freeLeft(g))*HIT:0;
  const combo=`<section class="panel tw-combo">${dsHead("arrow-right-left","Best combination",sel.length>1?`<span class="ds-sub">selling ${sel.map(i=>esc((sp.find(p=>p.id===i)||{}).web_name||"")).join(" + ")}</span>`:"")}
    ${c&&c.picks.length?`<div class="tw-cb">${c.picks.map(twLeg).join("")}</div><div class="tw-sum"><span><em>Gain</em><b class="up">${twSg(c.gain)}</b></span><span><em>Hit</em><b class="${hit?"dn":""}">${hit?"−"+hit:"none"}</b></span><span><em>Net</em><b class="${c.gain-hit>=0?"up":"dn"}">${twSg(c.gain-hit)}</b></span><span><em>Left</em><b>£${c.left.toFixed(1)}</b></span><button class="pri" onclick="act('docombo')">${lic("check",14)} Make ${c.picks.length===2?"both":"all"}</button></div>`
      :`<p class="note">${sel.length>1?"No combination improves the XI for that money.":"Pick players on the left."}</p>`}</section>`;
  let fund;
  if(!S.fundOn)fund=`<section class="panel tw-fp">${dsHead("wallet","Funding moves")}<button class="pri tw-fon" onclick="act('fundon')">Work out funding moves</button></section>`;
  else{const F=fundMoves(h);
    fund=`<section class="panel tw-fp">${dsHead("wallet","Funding moves",`<span class="ds-sub">a sale that pays for an upgrade · best single move ${twSg(F.single)}</span>`)}
      <div class="tw-fgrid">${F.res.length?F.res.map(c2=>{const hh=freeLeft(g)<2?HIT:0;return `<div class="tw-fc">${c2.picks.map(twLeg).join("")}<div class="tw-sum sm"><span><em>Gain</em><b class="up">${twSg(c2.gain)}</b></span><span><em>Net of hit</em><b class="${c2.gain-hh>=0?"up":"dn"}">${twSg(c2.gain-hh)}</b></span><span><em>Left</em><b>£${c2.left.toFixed(1)}</b></span><button onclick="act('dofund',${c2.picks[0].out.id},${c2.picks[1].out.id})">${lic("check",13)} Make both</button></div></div>`;}).join("")
        :`<p class="note">No downgrade that pays for an upgrade beats the best single move by half a point over ${h} GW.</p>`}</div></section>`;}
  return `<div class="tw-sf">${pick}<div class="tw-sfr">${combo}${fund}</div></div>`;
}
/* Rivals (22 Nov 2026, the Rivals card moved here): players your rivals own
   and you don't, with the best affordable way to cover each, and your
   differentials worth keeping */
function twRivalsHTML(g){
  const R=rivalOwn();if(!R||!R.n)return `<p class="note">The league feed has not loaded.</p>`;
  const h=hzWeeks(S.twH||1,g),byId=twMap(),sq=S.squad||[],mine=new Set(sq),sp=squadPlayers();
  const club={};sp.forEach(p=>club[p.team]=(club[p.team]||0)+1);
  const cover=t=>{let best=null;sp.filter(o=>o.pos===t.pos).forEach(o=>{if(planBank()+sellPrice(o)+1e-9<t.price)return;if(o.team!==t.team&&(club[t.team]||0)>=RULES.clubMax)return;
    const gn=xiGain(sq,o.id,t.id,g,Math.min(h,39-g),byId);if(!best||gn>best.g)best={o,g:gn};});return best;};
  const thr=Object.keys(R.own).map(id=>({p:byId.get(+id),k:R.own[id]})).filter(x=>x.p&&!mine.has(x.p.id)).sort((a,b)=>b.k-a.k||hPts(b.p,g,h)-hPts(a.p,g,h)).slice(0,8);
  const dif=sp.map(p=>({p,k:R.own[p.id]||0})).sort((a,b)=>a.k-b.k||hPts(b.p,g,h)-hPts(a.p,g,h)).slice(0,8);
  const row=(x,kind)=>{const c=kind==="t"?cover(x.p):null;
    return `<div class="tw-rv">${dsFace(x.p)}<span class="tw-nm"><b>${esc(x.p.web_name)}</b><i>${esc(x.p.teamName)} · ${POSL[x.p.pos]} · £${x.p.price.toFixed(1)}</i></span>
      <span class="tw-rb">${twBar(x.k/R.n*100,kind==="t"?"#B388FF":"#5B4A80")}<b class="ds-fig">${x.k}/${R.n}</b></span>${dsFig(hPts(x.p,g,h).toFixed(1))}
      ${kind==="t"?(c?`<span class="tw-cov">${dsFace(c.o,"xs")}<span class="ds-sub">for ${esc(c.o.web_name)}</span><b class="ds-fig ${c.g>=0?"up":"dn"}">${twSg(c.g)}</b><button class="tw-go sm" title="Make this transfer" onclick="act('doswap',${c.o.id},${x.p.id})">${lic("check",13)}</button></span>`:`<span class="ds-sub">can't afford</span>`)
        :`<span class="tw-keep ${x.k===0?"on":""}">${x.k===0?"no rival has him":x.k===1?"1 rival":x.k+" rivals"}</span>`}</div>`;};
  const hd=t=>`<div class="tw-rv tw-rvh ds-th"><span></span><span>Player</span><span>Rivals own</span><span>${wkSpan(g,h)}</span><span>${t}</span></div>`;
  return `<div class="tw-rg"><section class="panel tw-col">${dsHead("triangle-alert","Threats to cover",`<span class="ds-sub">owned by your rivals, not you</span>`)}${hd("Best cover")}${thr.map(x=>row(x,"t")).join("")}</section>
    <section class="panel tw-col">${dsHead("gem","Your differentials",`<span class="ds-sub">fewest rivals own · ${R.n} rivals</span>`)}${hd("")}${dif.map(x=>row(x,"d")).join("")}</section></div>`;
}

/* ---------- Captain ---------- */
function captainPopHTML(){
  const T=S.popTab==="record"?"record":"week",g=VG();
  const tabs=twTabs([["week","This Week"],["record","Season Record"]],T);
  if(T==="record")return modalHTML("Captain",capRecordHTML(),{wide:true,cls:"tw ca",icon:lic("crown",18),ctl:tabs+`<span class="tw-sp"></span><span class="tw-ft">finished weeks</span>`});
  const cv=effectiveCaptainVice(g),cP=S.model.players.find(p=>p.id===cv.captain),vP=S.model.players.find(p=>p.id===cv.vice);
  const right=`<span class="tw-ft">${cP?`<span class="pz-cv">C</span> ${esc(cP.web_name)}`:""}${vP?` · <span class="pz-cv v">V</span> ${esc(vP.web_name)}`:""}</span>`;
  return modalHTML("Captain",capWeekHTML(g),{wide:true,cls:"tw ca",icon:lic("crown",18),ctl:tabs+`<span class="tw-sp"></span>${right}${hz4HTML(S.capH||5,"caph")}`});
}
function capWeekHTML(g){
  const xi=startingXI();if(!xi.length||g<S.model.next.id)return `<p class="note">Captaincy is set for the next deadline.</p>`;
  const mult=chipForWeek(g)==="3xc"?3:2,v=p=>hPts(p,g,1)*mult,opts=xi.slice().sort((a,b)=>v(b)-v(a)).slice(0,8),best=v(opts[0]);
  const cv=effectiveCaptainVice(g),sel=opts.find(p=>p.id===S.capSel)||opts[0],R=rivalOwn(),F=twField();
  const mk={};try{Object.values(oddsPlayers(g)||{}).forEach(r=>{if(r&&r.p)mk[r.p.id]=r;});}catch(e){}
  const rf=S.rivalsFeed||{},rcap={};let nRiv=0;
  Object.entries(rf.entries||{}).forEach(([id,e])=>{if(String(id)===String(TEAM_ID))return;const l=(e.gw||[])[(e.gw||[]).length-1],c=l&&(l.picks||[]).find(x=>x.isC);nRiv++;if(c)rcap[c.id]=(rcap[c.id]||0)+1;});
  const plays=p=>(p.gw[g]||{}).pPlay??1,scores=p=>{const m=mk[p.id];return m&&m.goal!=null?m.goal:modelChance(p,p.xg90||0);};
  const third=p=>p.pos<=2?["Clean sheet",csProbNext(p,g)??0,"#22D3EE"]:["Assists",(mk[p.id]&&mk[p.id].assist!=null)?mk[p.id].assist:modelChance(p,p.xa90||0),"#22D3EE"];
  const ring=(pc,col,label,sub)=>{const r=27,c=2*Math.PI*r;return `<div class="ca-ring"><svg viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r="${r}" fill="none" stroke="#262626" stroke-width="6"/><circle cx="32" cy="32" r="${r}" fill="none" stroke="${col}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(c*pc/100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle" class="ca-rv">${Math.round(pc)}%</text></svg><b>${label}</b><i>${sub}</i></div>`;};
  const top=F&&F.top10k?F.top10k.cap[sel.id]||0:null,near=F&&F.near?F.near.cap[sel.id]||0:null;
  const safe=(top!=null&&top>=30)||(sel.owned||0)>=30;
  const curC=xi.find(p=>p.id===cv.captain),delta=curC&&curC!==sel?v(sel)-v(curC):null,th=third(sel);
  const tags=`<span class="ca-tags">${sel===opts[0]?`<span class="ca-best">${lic("crown",12)} Best option</span>`:""}${sel.id===cv.captain?`<span class="pz-cv">C</span><span class="ds-sub">your captain</span>`:sel.id===cv.vice?`<span class="pz-cv v">V</span><span class="ds-sub">your vice</span>`:""}</span>`;
  const hero=`<section class="panel ca-hero"><div class="ca-top">${dsFace(sel,"xxl")}<div class="ca-who">${tags}<b>${esc(sel.web_name)}</b><i>${esc(sel.teamName)} · ${POSL[sel.pos]} · £${sel.price.toFixed(1)}</i>${fxNext(sel,g,3,"sm")}
      ${delta!=null?`<span class="ca-vs">${lic("arrow-right-left",13)} <b class="${delta>=0?"up":"dn"}">${twSg(delta)}</b> against your captain ${esc(curC.web_name)} (${v(curC).toFixed(1)})</span>`:""}</div>
    <div class="ca-big"><b>${v(sel).toFixed(1)}</b><i>×${mult} · GW${g}</i></div></div>
    <div class="ca-rings">${ring(plays(sel)*100,"#3DDC97","Plays","chance to appear")}${ring(scores(sel)*100,"#7AA2FF","Scores",mk[sel.id]&&mk[sel.id].goal!=null?"bookmakers":"model")}${ring(th[1]*100,th[2],th[0],sel.pos<=2?"model":(mk[sel.id]&&mk[sel.id].assist!=null?"bookmakers":"model"))}${ring(haulChance(sel)*100,"#FFB020","Haul","10+ points")}
      <div class="ca-own"><span><em>Owned</em><b>${sel.owned}%</b></span><span><em>Rivals own</em><b>${R&&R.n?(R.own[sel.id]||0)+"/"+R.n:"—"}</b></span>
        <span><em>Rivals' captain last GW</em><b>${nRiv?(rcap[sel.id]||0)+"/"+nRiv:"—"}</b></span><span><em>Top 10k captain</em><b>${top!=null?top+"%":"—"}</b></span>
        <span class="ca-lab ${safe?"safe":"diff"}">${lic(safe?"shield":"gem",12)} ${safe?"Safe pick":"Differential"}</span>${near!=null?`<span><em>Near you</em><b>${near}%</b></span>`:""}</div></div>
    ${lastNextHTML([sel],{h:300})}
    <div class="tw-acts"><button class="pri" onclick="act('cap',${sel.id})"><span class="pz-cv">C</span> Make captain</button><button onclick="act('vice',${sel.id})"><span class="pz-cv v">V</span> Make vice-captain</button><button onclick="act('card',${sel.id})">${lic("info",15)} Player card</button></div></section>`;
  const rows=opts.map((p,k)=>{const val=v(p),gap=val-best,isC=p.id===cv.captain,isV=p.id===cv.vice;
    return `<div class="ca-row${p===sel?" sel":""}" onclick="act('capsel',${p.id})"><span class="tw-rk">${k+1}</span><span class="ca-pl">${dsFace(p)}<span class="tw-nm"><b>${esc(p.web_name)}${isC?` <span class="pz-cv">C</span>`:isV?` <span class="pz-cv v">V</span>`:""}</b><i>${esc(p.teamName)} · ${POSL[p.pos]}</i></span></span>
      ${fxNext(p,g,1,"sm")}<span class="ca-bar">${twBar(val/Math.max(.1,best)*100,k?"#7A5F22":"var(--amber)")}<b>${val.toFixed(1)}</b></span><b class="ca-gap ${gap<-0.05?"dn":"up"}">${gap<-0.05?twSg(gap):"best"}</b>
      <span class="ca-n">${Math.round(plays(p)*100)}%</span><span class="ca-n">${Math.round(scores(p)*100)}%</span><span class="ca-n">${Math.round(haulChance(p)*100)}%</span><span class="ca-n">${R&&R.n?(R.own[p.id]||0)+"/"+R.n:"—"}</span>
      <span class="ca-act"><button class="ca-cb${isC?" on":""}" title="Captain" onclick="event.stopPropagation();act('cap',${p.id})">C</button><button class="ca-cb v${isV?" on":""}" title="Vice-captain" onclick="event.stopPropagation();act('vice',${p.id})">V</button></span></div>`;}).join("");
  const n=hzWeeks(S.capH||5,g),wk=[];for(let e=g;e<g+Math.min(n,8)&&e<=38;e++){const sp=squadPlayers(),b=sp.slice().sort((a,b2)=>hPts(b2,e,1)-hPts(a,e,1))[0];if(b)wk.push([e,b,hPts(b,e,1)*2]);}
  const strip=n>1?`<div class="ca-wk"><div class="ca-wkh">${lic("calendar",14)} Captain by week</div><div class="ca-wks" style="grid-template-columns:repeat(${wk.length},1fr)">${wk.map(([e,p,val],k)=>`<div class="ca-w${k===0?" now":""}"><em>GW${e}</em>${dsFace(p,"md")}<b>${esc(p.web_name)}</b><span>${fxNext(p,e,1,"sm")}<i>${val.toFixed(1)}</i></span></div>`).join("")}</div></div>`:"";
  return `<div class="ca-grid">${hero}<section class="panel ca-list"><div class="ca-hd ds-th"><span></span><span>Player</span><span>Next</span><span>×${mult} predicted</span><span>Gap</span><span>Plays</span><span>Scores</span><span>Haul</span><span>Rivals</span><span></span></div>
    <div class="ca-rows">${rows}</div>${strip}</section></div>`;
}
/* Season Record: each finished week, your captain against the best captain
   your squad had (all 15), FPL's most captained, its top scorer and the
   app's own pick before the deadline (from when that was first saved) */
function capRecord(){
  const T=S.tracker;if(!T||!T.gw)return [];
  const A=S.playerActuals||{},act=(id,e)=>{const a=A[id]||A[String(id)]||{};const v=a[e]??a[String(e)];return v==null?null:+v;};
  const next=S.model.next.id,evs=S.events||[],pl=S.predLive&&S.predLive.gw||{};
  return T.gw.filter(r=>r.event<next&&r.picks&&r.picks.length).sort((a,b)=>a.event-b.event).map(r=>{const e=r.event,pk=r.picks,c=pk.find(x=>x.isC);if(!c)return null;
    const m=Math.max(2,c.multiplier||2),scored=pk.map(x=>({id:x.id,v:act(x.id,e)})).filter(x=>x.v!=null),bst=scored.reduce((a,b)=>b.v>a.v?b:a,{id:c.id,v:act(c.id,e)||0});
    const xi=pk.slice(0,11).map(x=>({id:x.id,v:act(x.id,e)||0})).sort((a,b)=>b.v-a.v),rank=xi.findIndex(x=>x.id===c.id)+1;
    const ev=evs.find(x=>x.id===e)||{},adv=pl[e]&&pl[e].advice;
    return{e,m,cap:c.id,cp:act(c.id,e)||0,best:bst.id,bp:bst.v||0,rank:rank||null,tm:ev.mostCapt||null,tp:ev.mostCapt?act(ev.mostCapt,e):null,top:ev.topEl||null,topPts:ev.topPts||null,app:adv&&adv.captain||null,ap:adv&&adv.captain?act(adv.captain,e):null};}).filter(Boolean);
}
function capRecordHTML(){
  const W=capRecord();if(!W.length)return `<p class="note">No finished weeks yet.</p>`;
  const P=id=>S.model.players.find(p=>p.id===id),tot=W.reduce((a,w)=>a+w.cp*w.m,0),bestTot=W.reduce((a,w)=>a+w.bp*w.m,0),hits=W.filter(w=>w.cap===w.best).length;
  const tmW=W.filter(w=>w.tp!=null),tmTot=tmW.reduce((a,w)=>a+w.tp*2,0),myTm=tmW.reduce((a,w)=>a+w.cp*w.m,0),won=tmW.filter(w=>w.cp>w.tp).length,lost=tmW.filter(w=>w.cp<w.tp).length;
  const apW=W.filter(w=>w.ap!=null),apTot=apW.reduce((a,w)=>a+w.ap*w.m,0),myAp=apW.reduce((a,w)=>a+w.cp*w.m,0);
  const season=(S.tracker.gw.filter(r=>r.event<S.model.next.id).slice(-1)[0]||{}).totalPoints||0;
  const tiles=`<div class="ds-tiles ca-t">${dsTile("Hit rate",Math.round(hits/W.length*100)+"%",`${hits} of ${W.length} weeks · top managers 23%`)}${dsTile("Captain points",tot,season?`${Math.round(tot/season*100)}% of your ${season}`:"")}
    ${dsTile("Points lost","−"+(bestTot-tot),"against the best in your squad","dn")}${dsTile("Against the template",(myTm-tmTot>=0?"+":"−")+Math.abs(myTm-tmTot),`${won} won · ${lost} lost · ${tmW.length-won-lost} same`,myTm>=tmTot?"up":"dn")}
    ${dsTile("Following the app's pick",apW.length?(apTot-myAp>=0?"+":"−")+Math.abs(apTot-myAp):"–",apW.length?`over ${apW.length} week${apW.length===1?"":"s"} saved`:"saved from this week on",apW.length?(apTot>myAp?"dn":"up"):null)}
    ${dsTile("Average finish",(W.filter(w=>w.rank).reduce((a,w)=>a+w.rank,0)/Math.max(1,W.filter(w=>w.rank).length)).toFixed(1),"your captain's place in your XI")}</div>`;
  const top=Math.max(20,...W.map(w=>w.bp*w.m)),Wd=720,H=380,pl=30,pb=24,pt=16,slot=(Wd-pl-6)/W.length,y=v=>pt+(H-pt-pb)*(1-v/top);
  let svg="";for(let v=0;v<=top;v+=Math.max(5,Math.round(top/4/5)*5))svg+=`<line class="cgrid" x1="${pl}" x2="${Wd-6}" y1="${y(v)}" y2="${y(v)}"/><text class="cax" x="${pl-6}" y="${y(v)+4}" text-anchor="end">${v}</text>`;
  W.forEach((w,k)=>{const x0=pl+slot*k,bw=Math.min(17,slot/3),a=w.cp*w.m,b=w.bp*w.m,hit=w.cap===w.best;
    svg+=`<rect x="${x0+slot/2-bw-1}" y="${y(a)}" width="${bw}" height="${y(0)-y(a)}" rx="3" fill="${hit?"#3DDC97":"#FFB020"}"/><rect x="${x0+slot/2+1}" y="${y(b)}" width="${bw}" height="${y(0)-y(b)}" rx="3" fill="rgba(255,255,255,.08)" stroke="#8A8A8A" stroke-width="1.2" stroke-dasharray="3 2"/>
      <text x="${x0+slot/2}" y="${y(Math.max(a,b))-6}" text-anchor="middle" class="${hit?"ca-hit":"ds-cd dn"}">${hit?"✓":"−"+(b-a)}</text><text class="cax" x="${x0+slot/2}" y="${H-7}" text-anchor="middle">${w.m===3?"TC":"GW"+w.e}</text>`;});
  const chart=`<div class="ds-chart"><div class="ds-lg"><span><i style="background:#3DDC97"></i>Best pick made</span><span><i style="background:#FFB020"></i>Your captain</span><span><i class="p"></i>Best in your squad</span></div><svg class="chart" viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Captain points by week">${svg}</svg></div>`;
  const miss=W.filter(w=>w.cap!==w.best).map(w=>({w,d:(w.bp-w.cp)*w.m})).sort((a,b)=>b.d-a.d).slice(0,3);
  const misses=`<div class="ca-miss"><div class="ca-wkh">${lic("triangle-alert",13)} Costliest calls</div>${miss.map(({w,d})=>`<div class="ca-m"><em>GW${w.e}${w.m===3?" · TC":""}</em>${dsFace(P(w.cap))}<span class="tw-nm"><b>${esc((P(w.cap)||{}).web_name||"")}</b><i>${w.cp*w.m} pts</i></span>${lic("arrow-right",13)}${dsFace(P(w.best))}<span class="tw-nm"><b>${esc((P(w.best)||{}).web_name||"")}</b><i>${w.bp*w.m} pts</i></span><b class="dn">−${d}</b></div>`).join("")}</div>`;
  const nm=id=>{const p=P(id);return p?`${dsFace(p)}<span class="tw-nm"><b>${esc(p.web_name)}</b>`:`<span class="tw-nm"><b>—</b>`;};
  const rows=W.slice().reverse().map(w=>{const hit=w.cap===w.best,d=(w.bp-w.cp)*w.m,ord=n=>n+(n===1?"st":n===2?"nd":n===3?"rd":"th");
    return `<div class="cr-row${hit?" hit":""}"><span class="cr-gw">GW${w.e}${w.m===3?`<i>TC</i>`:""}</span><span class="cr-p">${nm(w.cap)}<i>${w.cp} × ${w.m}</i></span><b class="cr-v">${w.cp*w.m}</b></span>
      <span class="cr-p">${hit?`<span class="cr-same">${lic("check",14)} Best pick</span>`:`${nm(w.best)}<i>${w.bp} × ${w.m}</i></span><b class="cr-v">${w.bp*w.m}</b>`}</span>
      <b class="cr-l ${d?"dn":"up"}">${d?"−"+d:"0"}</b><span class="cr-rk">${w.rank?ord(w.rank):"–"}</span>
      <span class="cr-t">${w.tm?`${nm(w.tm)}<i>${w.tp!=null?w.tp*2+" pts":"–"}</i></span><span class="cr-vs ${w.tp==null?"":w.cp>w.tp?"up":w.cp<w.tp?"dn":""}">${w.tp==null?"":w.cp>w.tp?"won":w.cp<w.tp?"lost":"same"}</span>`:"–"}</span>
      <span class="cr-f">${w.top?`<b>${esc((P(w.top)||{}).web_name||"")}</b><i>${w.topPts||"–"} pts</i>`:"–"}</span></div>`;}).join("");
  return `<div class="ca-rg">${`<section class="panel ca-left">${tiles}${chart}${misses}</section>`}<section class="panel ca-right"><div class="cr-row cr-hd ds-th"><span>Week</span><span>Your captain</span><span>Best in your squad</span><span>Lost</span><span>Finish</span><span>Most captained in FPL</span><span>Top scorer in FPL</span></div><div class="cr-rows">${rows}</div></section></div>`;
}

/* ---------- Transfer Record ---------- */
/* Every transfer from your FPL history (the weekly squads differ): who left
   and who came, judged on actual points that gameweek, over the next 3 and
   5 and while you held him, less hits. A Wildcard is one block (the new
   squad against the old); a Free Hit is judged that week only. */
function transferLog(){
  const T=S.tracker;if(!T||!T.gw)return [];
  const rows=T.gw.filter(r=>r.picks&&r.picks.length).sort((a,b)=>a.event-b.event),next=S.model.next.id,last=Math.min(next-1,rows.length?rows[rows.length-1].event:0);
  const wc=new Set(rows.filter(x=>x.chip==="wildcard").map(x=>x.event)),fh=new Set(rows.filter(x=>x.chip==="freehit").map(x=>x.event));
  const A=S.playerActuals||{},act=(id,e)=>{const a=A[id]||A[String(id)]||{};const v=a[e]??a[String(e)];return v==null?0:+v;};
  const P=id=>S.model.players.find(p=>p.id===id),sum=(id,a,b)=>{let s=0;for(let e=a;e<=Math.min(b,last);e++)s+=act(id,e);return s;};
  const pur=(T.purchase&&T.purchase.players)||{},out=[];
  rows.forEach((r,i)=>{if(!i)return;const e=r.event;let prev=rows[i-1];if(fh.has(prev.event)&&rows[i-2])prev=rows[i-2];
    const was=new Set(prev.picks.map(x=>x.id)),now=new Set(r.picks.map(x=>x.id));
    const ins=[...now].filter(x=>!was.has(x)).map(P).filter(Boolean),outs=[...was].filter(x=>!now.has(x)).map(P).filter(Boolean);
    if(!ins.length&&!outs.length)return;
    if(wc.has(e)||fh.has(e)){const w=fh.has(e)?0:4,d=(a,b)=>ins.reduce((s,p)=>s+sum(p.id,a,b),0)-outs.reduce((s,p)=>s+sum(p.id,a,b),0);
      out.push({e,chip:fh.has(e)?"FH":"WC",n:ins.length,d1:d(e,e),d3:fh.has(e)?null:d(e,e+2),d5:fh.has(e)?null:d(e,e+4),held:fh.has(e)?d(e,e):d(e,e+w),hg:fh.has(e)?1:Math.min(w+1,last-e+1),hit:0});return;}
    const per=(r.transferCost||0)/Math.max(1,ins.length);
    [1,2,3,4].forEach(pos=>{const o=outs.filter(p=>p.pos===pos).sort((a,b)=>b.price-a.price),n=ins.filter(p=>p.pos===pos).sort((a,b)=>b.price-a.price);
      n.forEach((p,k)=>{const q=o[k];if(!q)return;
        let end=last;for(let j=i+1;j<rows.length;j++){if(fh.has(rows[j].event))continue;if(!rows[j].picks.some(x=>x.id===p.id)){end=rows[j].event-1;break;}}
        const held=sum(p.id,e,end)-sum(q.id,e,end),sold=end<last?end+1:null,pp=pur[p.id];
        out.push({e,out:q,inn:p,d1:act(p.id,e)-act(q.id,e),d3:e+2<=last?sum(p.id,e,e+2)-sum(q.id,e,e+2):null,d5:e+4<=last?sum(p.id,e,e+4)-sum(q.id,e,e+4):null,held:held-per,hg:end-e+1,hit:per,sold,
          price:!sold&&pp&&pp.paid!=null?+(p.price-pp.paid).toFixed(1):null});});});});
  return out;
}
function transferRecordHTML(){
  const L=transferLog(),win=["d1","d3","d5","held"].includes(S.trWin)?S.trWin:"held";
  const sw=`<span class="hz ds-hz">${[["d1","That GW"],["d3","3 GW"],["d5","5 GW"],["held","While held"]].map(([k,n])=>`<button class="${win===k?"on":""}" onclick="act('trwin','${k}')">${n}</button>`).join("")}</span>`;
  if(!L.length)return modalHTML("Transfer Record",`<p class="note">No transfers yet this season.</p>`,{wide:true,cls:"tw xr",icon:lic("arrow-right-left",18),ctl:`<span class="tw-sp"></span>${sw}`});
  const val=r=>r[win]==null?null:r[win]-(win==="held"?0:r.hit||0),pairs=L.filter(r=>!r.chip),scored=L.filter(r=>val(r)!=null);
  const net=scored.reduce((a,r)=>a+val(r),0),hits=L.reduce((a,r)=>a+(r.hit||0),0),win2=pairs.filter(r=>val(r)!=null&&val(r)>0).length,judged=pairs.filter(r=>val(r)!=null).length;
  const bst=pairs.filter(r=>val(r)!=null).sort((a,b)=>val(b)-val(a)),best=bst[0],worst=bst[bst.length-1],profit=pairs.reduce((a,r)=>a+(r.price||0),0);
  const filt=S.trFilt||"all",shown=L.filter(r=>filt==="all"||(val(r)!=null&&(filt==="gain"?val(r)>0:val(r)<0))).slice().reverse();
  const nm=r=>r.out?`${esc(r.out.web_name)} → ${esc(r.inn.web_name)}`:"";
  const tiles=`<div class="ds-tiles xr-t">${dsTile("Transfers",pairs.length+L.filter(r=>r.chip).reduce((a,r)=>a+r.n,0),`${pairs.length} moves${L.some(r=>r.chip)?" · "+L.filter(r=>r.chip).map(r=>r.chip).join(" + "):""}${hits?` · ${Math.round(hits/HIT)} hit${hits>HIT?"s":""}`:""}`)}
    ${dsTile("Net points",(net>=0?"+":"−")+Math.abs(Math.round(net)),win==="held"?`while held, after ${hits?"−"+hits:"no"} hits`:"over the window",net>=0?"up":"dn")}${dsTile("Hit rate",judged?Math.round(win2/judged*100)+"%":"–",`${win2} of ${judged} in outscored out`)}
    ${dsTile("Best",best?twSg(val(best)).replace(".0",""):"–",best?nm(best):"","up")}${dsTile("Worst",worst?twSg(val(worst)).replace(".0",""):"–",worst?nm(worst):"",worst&&val(worst)<0?"dn":null)}${dsTile("Price profit",(profit>=0?"+":"−")+"£"+Math.abs(profit).toFixed(1),"on players you still own",profit>=0?"up":"dn")}</div>`;
  const cell=v=>v==null?`<span class="xr-v na">–</span>`:`<span class="xr-v ${v>0?"up":v<0?"dn":"z"}">${v>0?"+":v<0?"−":"±"}${Math.abs(Math.round(v))}</span>`;
  const row=r=>r.chip?`<div class="xr-r chip"><span class="xr-gw">GW${r.e}</span><span class="xr-wc">${dsChips(r.chip==="WC"?["wildcard"]:["freehit"],null).replace(/ds-chip"/g,'ds-chip off"')}<span class="ds-name">${r.chip==="WC"?"Wildcard":"Free Hit"} · ${r.n} changes</span><span class="ds-sub">${r.chip==="WC"?"new squad against the old":"that week only"}</span></span>${cell(r.d1)}${cell(r.d3)}${cell(r.d5)}${cell(r.held)}<span class="ds-sub xr-h">${r.hg} GW</span><span class="xr-p">–</span></div>`
    :`<div class="xr-r"><span class="xr-gw">GW${r.e}</span><span class="xr-mv">${dsFace(r.out)}<span class="ds-name out">${esc(r.out.web_name)}</span>${lic("arrow-right",13)}${dsFace(r.inn)}<span class="ds-name">${esc(r.inn.web_name)}</span>${r.hit?`<span class="xr-hit">−${r.hit} hit</span>`:""}${r.sold?`<span class="xr-sold">sold GW${r.sold}</span>`:""}</span>
      ${cell(r.d1-(r.hit||0))}${cell(r.d3==null?null:r.d3-(r.hit||0))}${cell(r.d5==null?null:r.d5-(r.hit||0))}${cell(r.held)}<span class="ds-sub xr-h">${r.hg} GW</span><span class="xr-p">${r.price==null?"–":`<b class="${r.price>=0?"up":"dn"}">${r.price>=0?"+":"−"}£${Math.abs(r.price).toFixed(1)}</b>`}</span></div>`;
  const list=`<section class="panel xr-col">${dsHead("arrow-right-left","Your transfers",`<span class="hz">${[["all","All"],["gain","Gains"],["loss","Losses"]].map(([k,n])=>`<button class="${filt===k?"on":""}" onclick="act('trfilt','${k}')">${n}</button>`).join("")}</span>`)}
    <div class="xr-r xr-hd ds-th"><span>GW</span><span>Out → In</span><span>That GW</span><span>Next 3</span><span>Next 5</span><span>While held</span><span>Held</span><span>Price</span></div><div class="xr-rows">${shown.map(row).join("")}</div>
    <div class="xr-sum"><span>Net from transfers</span>${dsFig((net>=0?"+":"−")+Math.abs(Math.round(net)),net>=0?"up":"dn")}<span class="ds-sub">${hits?`· hits −${hits} included`:""}</span></div></section>`;
  /* cumulative by gameweek */
  const by={};scored.forEach(r=>{by[r.e]=(by[r.e]||0)+val(r);});const ks=Object.keys(by).map(Number).sort((a,b)=>a-b);let c=0;const cum=ks.map(k=>[k,c+=by[k]]);
  let chart="";if(cum.length){const vs=cum.map(x=>x[1]),lo=Math.min(0,...vs)-5,hi=Math.max(5,...vs)+5,Wd=470,H=180,pl=30,pb=22,pt=14,pr=8,X=i=>pl+(cum.length<2?0.5:i/(cum.length-1))*(Wd-pl-pr),Y=v=>pt+(H-pt-pb)*(1-(v-lo)/(hi-lo));
    let g=[0,hi].map(v=>`<line class="${v===0?"czero":"cgrid"}" x1="${pl}" x2="${Wd-pr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="cax" x="${pl-6}" y="${Y(v)+4}" text-anchor="end">${Math.round(v)}</text>`).join("");
    const pts=cum.map(([,v],i)=>`${X(i)},${Y(v)}`).join(" ");
    g+=`<polygon points="${X(0)},${Y(0)} ${pts} ${X(cum.length-1)},${Y(0)}" fill="rgba(61,220,151,.14)"/><polyline points="${pts}" fill="none" stroke="#3DDC97" stroke-width="2.5" stroke-linejoin="round"/>`+cum.map(([e,v],i)=>`<circle cx="${X(i)}" cy="${Y(v)}" r="3.5" fill="#3DDC97"/><text class="cax" x="${X(i)}" y="${H-5}" text-anchor="middle">GW${e}</text>`).join("");
    chart=`<svg class="chart" viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Cumulative points from transfers">${g}</svg>`;}
  const lesson=(icon,cls,t,r,txt,v)=>`<div class="xr-ls ${cls}"><span class="xr-li">${lic(icon,14)}</span><span class="xr-lt"><b>${t}</b>${r&&r.out?`<span class="xr-lp">${dsFace(r.out,"xs")}<span class="ds-name">${esc(r.out.web_name)}</span>${lic("arrow-right",12)}${dsFace(r.inn,"xs")}<span class="ds-name">${esc(r.inn.web_name)}</span></span>`:""}<span class="ds-sub">${txt}</span></span>${dsFig(v,cls==="z"?"":cls)}</div>`;
  const side=pairs.filter(r=>r.hg>=4&&Math.abs(r.held)<=2)[0];
  const ls=[best?lesson("trophy","up","Best move",best,`GW${best.e} · held ${best.hg} GW`,twSg(val(best)).replace(".0","")):"",
    worst&&val(worst)<0?lesson("triangle-alert","dn","Costliest move",worst,`GW${worst.e} · ${worst.sold?"sold GW"+worst.sold:"still held"}`,twSg(val(worst)).replace(".0","")):"",
    side?lesson("arrow-right-left","z","Sideways",side,`${twSg(side.held).replace(".0","")} over ${side.hg} GW: a transfer that changed little`,twSg(side.held).replace(".0","")):"",
    lesson("sparkles","z","Against the app",null,(S.predLive&&Object.values(S.predLive.gw||{}).some(x=>x.advice))?"the app's saved picks are graded once those weeks finish":"the app's pick is saved before each deadline from now on","–")].join("");
  return modalHTML("Transfer Record",`<div class="ds-tiles-wrap">${tiles}</div><div class="xr-g">${list}<div class="xr-rc"><section class="panel xr-col">${dsHead("activity","Points from transfers, season",`<span class="ds-sub">${win==="held"?"while held, net of hits":"over the window"}</span>`)}${chart}</section><section class="panel xr-col">${dsHead("info","Lessons")}${ls}</section></div></div>`,
    {wide:true,cls:"tw xr",icon:lic("arrow-right-left",18),ctl:`<span class="tw-sp"></span><span class="tw-ft">GW1–${S.model.next.id-1} · finished weeks</span>${sw}`});
}
/* ============================================================
   THIS WEEK BATCH 4 (22 Nov 2026, Andy approved the mocks): the header's
   Rank pop-up (Overall Rank and GW Rank tiles) and Team Rating pop-up
   (Team Rating tile), which takes over Squad Strength.
   ============================================================ */
const rkK=v=>v==null?"—":v>=1e6?(v/1e6).toFixed(v>=1e7?1:2).replace(/\.?0+$/,"")+"M":v>=1000?Math.round(v/1000)+"k":String(v);
function rankRows(){const T=S.tracker;return T&&T.gw?T.gw.filter(r=>r.orRank!=null&&r.event<S.model.next.id).sort((a,b)=>a.event-b.event):[];}
/* the points needed for each band, from the rank-bands job */
function rankMilestones(){
  const B=S.rankBands,rows=rankRows(),me=rows.length?rows[rows.length-1]:null;if(!B||!B.bands||!me)return null;
  const total=(B.me&&B.me.total)||me.totalPoints,rank=(B.me&&B.me.rank)||me.orRank;
  const bands=B.bands.map(b=>({rank:b.rank,need:b.total,d:b.total-total+(b.rank<rank?1:0)}));
  /* ranks a point buys at your rank: the slope between the bands either side */
  const lo=B.bands.filter(b=>b.rank<=rank).slice(-1)[0],hi=B.bands.find(b=>b.rank>rank);
  const perPt=lo&&hi&&lo.total!==hi.total?Math.round((hi.rank-lo.rank)/(lo.total-hi.total)):null;
  return{bands,total,rank,perPt,gw:B.gw};
}
function rankPopHTML(){
  const rows=rankRows();if(!rows.length)return modalHTML("Rank",`<p class="note">No finished gameweeks yet.</p>`,{wide:true,cls:"tw rk",icon:lic("trending-up",18)});
  const last=rows[rows.length-1],tp=S.tracker.totalPlayers||null,evs=S.events||[],avg=e=>(evs.find(x=>x.id===e)||{}).avg||null;
  const seasonAvg=rows.reduce((a,r)=>a+(avg(r.event)||0),0),bestGw=rows.filter(r=>r.gwRank).reduce((a,r)=>!a||r.gwRank<a.gwRank?r:a,null);
  const greens=rows.filter((r,i)=>i&&r.orRank<rows[i-1].orRank).length,M=rankMilestones();
  const next=M?M.bands.filter(b=>b.rank<M.rank).sort((a,b)=>b.rank-a.rank)[0]:null;
  /* career, from the season history the League page already holds */
  const H=typeof TRACKER_HISTORY!=="undefined"?TRACKER_HISTORY.seasons||{}:{},fin=Object.keys(H).sort().map(k=>{const o=H[k].orRank||[];return o.length?o[o.length-1]:null;}).filter(Boolean);
  const bestFin=fin.length?Math.min(...fin):null,last3=fin.slice(-3),avg3=last3.length?Math.round(last3.reduce((a,b)=>a+b,0)/last3.length):null;
  const tiles=`<div class="ds-tiles rk-t">${dsTile("Overall rank",last.orRank.toLocaleString(),tp?`top ${(last.orRank/tp*100).toFixed(1)}% of ${rkK(tp)}`:`after GW${last.event}`,"up")}
    ${dsTile("Points",last.totalPoints,seasonAvg?`${last.totalPoints-seasonAvg>=0?"+":"−"}${Math.abs(last.totalPoints-seasonAvg)} on the average`:"",last.totalPoints>=seasonAvg?"up":null)}
    ${dsTile("Best GW rank",bestGw?rkK(bestGw.gwRank):"—",bestGw?`GW${bestGw.event} · ${bestGw.points} pts`:"")}
    ${dsTile("Green arrows",`${greens} of ${Math.max(0,rows.length-1)}`,rows.filter((r,i)=>i&&r.orRank>rows[i-1].orRank).map(r=>"GW"+r.event).slice(-3).join(", ")?"red "+rows.filter((r,i)=>i&&r.orRank>rows[i-1].orRank).map(r=>"GW"+r.event).slice(-3).join(", "):"")}
    ${dsTile("Next milestone",next?"Top "+rkK(next.rank):"—",next?`${next.d} point${next.d===1?"":"s"} away`:"waiting for rank bands")}
    <button class="ds-tile rk-car" onclick="act('tab','tracker')"><em>Career ${lic("arrow-right",11)}</em><b>${bestFin?rkK(bestFin):"—"}</b><i>best finish${avg3?` · last 3 avg ${rkK(avg3)}`:""}</i></button></div>`;
  /* rank over the season: overall rank line, GW rank bars (log scale) */
  const mode=S.rkMode==="pts"?"pts":"rank";let chart;
  if(mode==="rank"){const vals=rows.flatMap(r=>[r.orRank,r.gwRank].filter(Boolean)),lg=v=>Math.log10(v),lo=lg(Math.max(1,Math.min(...vals)*0.8)),hi=lg(Math.max(...vals)*1.25),Wd=640,Hh=420,pl=46,pr=10,pt=14,pb=24,X=i=>pl+(rows.length<2?0.5:i/(rows.length-1))*(Wd-pl-pr),Y=v=>pt+(Hh-pt-pb)*((lg(v)-lo)/((hi-lo)||1));
    const ticks=[1e3,2.5e3,5e3,1e4,2.5e4,5e4,1e5,2.5e5,5e5,1e6,2.5e6,5e6,1e7].filter(v=>lg(v)>=lo&&lg(v)<=hi);
    let g=ticks.map(v=>`<line class="cgrid" x1="${pl}" x2="${Wd-pr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="cax" x="${pl-6}" y="${Y(v)+4}" text-anchor="end">${rkK(v)}</text>`).join("");
    rows.forEach((r,i)=>{if(r.gwRank)g+=`<rect x="${X(i)-7}" y="${Y(r.gwRank)}" width="14" height="${Math.max(2,Y(Math.pow(10,hi))-Y(r.gwRank))}" rx="3" fill="#2A2A3A"><title>GW${r.event} rank ${r.gwRank.toLocaleString()}</title></rect>`;});
    g+=`<polyline points="${rows.map((r,i)=>`${X(i)},${Y(r.orRank)}`).join(" ")}" fill="none" stroke="#3DDC97" stroke-width="2.5" stroke-linejoin="round"/>`+rows.map((r,i)=>`<circle cx="${X(i)}" cy="${Y(r.orRank)}" r="3.5" fill="#3DDC97"><title>GW${r.event}: ${r.orRank.toLocaleString()}</title></circle><text class="cax" x="${X(i)}" y="${Hh-6}" text-anchor="middle">GW${r.event}</text>`).join("");
    g+=`<text x="${X(rows.length-1)-6}" y="${Y(last.orRank)-10}" text-anchor="end" class="rk-lb">${rkK(last.orRank)}</text>`;
    chart=`<div class="ds-lg"><span><i style="background:#3DDC97"></i>Overall rank</span><span><i style="background:#2A2A3A"></i>GW rank</span><span class="ds-lgr">higher is better</span></div><svg class="chart" viewBox="0 0 ${Wd} ${Hh}" role="img" aria-label="Rank over the season">${g}</svg>`;}
  else chart=colChart(rows.map(r=>"GW"+r.event),[{name:"You",values:rows.map(r=>r.points),color:"#3DDC97"},{name:"FPL average",values:rows.map(r=>avg(r.event)),color:"#4A4A4A"}],[],{h:420,w:640,label:"Points by gameweek",legend:true});
  const ms=M?`<section class="panel tw-col">${dsHead("flag-triangle-right","Milestones",`<span class="ds-sub">points needed after GW${M.gw}${M.perPt?` · <b class="rk-ppr">1 pt ≈ ${rkK(M.perPt)} ranks here</b>`:""}</span>`)}
      <div class="rk-ms">${M.bands.map(b=>{const done=b.rank>=M.rank,isNext=next&&b.rank===next.rank;return `<div class="rk-s${done?" done":""}${isNext?" next":""}"><b>Top ${rkK(b.rank)}</b><span class="ds-fig">${b.need}</span><i class="${b.d<=0?"up":"dn"}">${b.d<=0?"✓ "+Math.abs(b.d)+" clear":b.d+" to go"}</i></div>`;}).join("")}</div>
      <div class="rk-you"><span class="rk-dot"></span><span><b>${rkK(M.rank)}</b> now${next?` · <b class="up">${next.d} point${next.d===1?"":"s"}</b> to top ${rkK(next.rank)}`:""}</span></div></section>`
    :`<section class="panel tw-col">${dsHead("flag-triangle-right","Milestones")}<p class="note">The points needed for each rank band arrive after the next server run.</p></section>`;
  /* the season against the benchmarks, over the weeks the field sample covers */
  const F=S.field&&S.field.gws?S.field.gws:null,fk=F?Object.keys(F).map(Number).sort((a,b)=>a-b):[];
  let bench=`<section class="panel tw-col">${dsHead("users","Season against the benchmarks")}<p class="note">The field sample fills this in from GW${S.model.next.id} on.</p></section>`;
  if(fk.length){const lastF=F[fk[fk.length-1]],mine=fk.map(e=>rows.find(r=>r.event===e)).filter(Boolean),n=mine.length||1;
    const av=(k,s)=>{const v=fk.map(e=>F[e][s]&&F[e][s].avg?F[e][s].avg[k]:null).filter(x=>x!=null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;};
    const meAv=k=>mine.reduce((a,r)=>a+(+r[k]||0),0)/n,f1=v=>v==null?"—":v.toFixed(1),ovTot=rows.reduce((a,r)=>a+(avg(r.event)||0),0);
    const R=[["Season total",String(last.totalPoints),lastF.top10k?String(Math.round(lastF.top10k.avg.total)):"—",lastF.near?String(Math.round(lastF.near.avg.total)):"—",ovTot?String(ovTot):"—"],
      ["Points per GW",f1(meAv("points")),f1(av("pts","top10k")),f1(av("pts","near")),f1(fk.reduce((a,e)=>a+(avg(e)||0),0)/fk.length)],
      ["Bench per GW",f1(meAv("bench")),f1(av("bench","top10k")),f1(av("bench","near")),"—"],
      ["Hits per GW",f1(mine.reduce((a,r)=>a+(r.transferCost||0)/4,0)/n),f1(av("hits","top10k")),f1(av("hits","near")),"—"],
      ["Team value",`£${(+last.value||0).toFixed(1)}`,lastF.top10k?`£${lastF.top10k.avg.value.toFixed(1)}`:"—",lastF.near?`£${lastF.near.avg.value.toFixed(1)}`:"—","—"]];
    const gap=lastF.top10k?Math.round(lastF.top10k.avg.total-last.totalPoints):null;
    bench=`<section class="panel tw-col">${dsHead("users","Season against the benchmarks",gap!=null?`<span class="ds-sub">gap to top 10k <b class="ds-fig ${gap>0?"dn":"up"}">${gap>0?"−"+gap:"+"+(-gap)}</b></span>`:"")}
      <div class="rk-bm rk-bmh ds-th"><span></span><span class="me">You</span><span>Top 10k</span><span>Near you</span><span>Overall</span></div>
      ${R.map(([l,...v])=>`<div class="rk-bm"><span class="ds-sub rk-bml">${l}</span>${v.map((x,i)=>`<span class="${i===0?"me":""}">${dsFig(x,i===0?"up":"")}</span>`).join("")}</div>`).join("")}</section>`;}
  const hist=`<section class="panel tw-col">${dsHead("calendar","Gameweek by gameweek")}<div class="rk-h rk-hh ds-th"><span>GW</span><span>Pts</span><span>Avg</span><span>GW rank</span><span>Overall</span><span>Move</span></div>
    <div class="rk-hs">${rows.slice().reverse().map((r,i,a)=>{const prev=a[i+1],mv=prev?prev.orRank-r.orRank:null;return `<div class="rk-h"><span class="ds-sub">GW${r.event}</span>${dsFig(r.points)}<span class="ds-sub">${avg(r.event)||"—"}</span>${dsFig(rkK(r.gwRank))}${dsFig(rkK(r.orRank))}${mv==null?`<span class="ds-sub">—</span>`:`<b class="ds-fig ${mv>=0?"up":"dn"}">${mv>=0?"▲":"▼"} ${rkK(Math.abs(mv))}</b>`}</div>`;}).join("")}</div></section>`;
  const tog=`<span class="hz">${[["rank","Overall"],["pts","Points"]].map(([k,n])=>`<button class="${mode===k?"on":""}" onclick="act('rkmode','${k}')">${n}</button>`).join("")}</span>`;
  return modalHTML("Rank",`${tiles}<div class="rk-g"><section class="panel tw-col">${dsHead("trending-up","Rank over the season",tog)}${chart}</section><div class="rk-rc">${ms}${bench}${hist}</div></div>`,
    {wide:true,cls:"tw rk",icon:lic("trending-up",18),ctl:`<span class="tw-sp"></span><span class="tw-ft">after GW${last.event}</span>`});
}
/* Team Rating: your team score against the best your budget could field:
   the Free Hit XI this week, the best Wildcard squad over 3 or 5 weeks. It
   takes over Squad Strength (position by position) and adds the team's
   shape against the top 10k. */
function ratingPopHTML(){
  const g=VG(),h=[1,3,5].includes(+S.trH)?+S.trH:1,budget=squadBudget(),mineIds=effectiveSquadIds(g).ids;
  const r=h===1?(chipTeam("freehit",g,true)||{}).t:optimalSquad("wildcard",g,budget,null,{weeks:h});
  const hz=`<span class="hz ds-hz">${[1,3,5].map(x=>`<button class="${x===h?"on":""}" onclick="act('trh',${x})">${x} GW</button>`).join("")}</span>`;
  if(!r)return modalHTML("Team Rating",`<p class="note">No best team for this budget yet.</p>`,{wide:true,cls:"tw rt",icon:lic("gauge",18),ctl:`<span class="tw-sp"></span>${hz}`});
  const bestIds=r.xi.concat(r.bench).map(p=>p.id),span=ids=>{let s=0;for(let e=g;e<g+h&&e<=38;e++)s+=teamScore(ids,e,null);return s;};
  const mine=span(mineIds),best=Math.max(0.1,span(bestIds)),pct=Math.round(clamp(mine/best,0,1)*100);
  const P=id=>S.model.players.find(p=>p.id===id),v=p=>{let s=0;for(let e=g;e<g+h&&e<=38;e++)s+=p.gw[e]?.pts||0;return s;};
  const myXI=legalBestXI(mineIds.map(P).filter(Boolean),v),myBench=mineIds.map(P).filter(p=>p&&!myXI.includes(p)),bXI=r.xi,bBench=r.bench;
  const same=myXI.filter(p=>bXI.some(q=>q.id===p.id)).length,benchPts=myBench.reduce((a,p)=>a+v(p),0);
  const outs=mineIds.filter(i=>!bestIds.includes(i)).length;
  const ring=`<svg viewBox="0 0 130 130" width="110" height="110"><circle cx="65" cy="65" r="52" fill="none" stroke="#262626" stroke-width="12"/><circle cx="65" cy="65" r="52" fill="none" stroke="${pct>=85?"#3DDC97":pct>=70?"#FFB020":"#FF5A6E"}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(2*Math.PI*52*pct/100).toFixed(1)} ${(2*Math.PI*52).toFixed(1)}" transform="rotate(-90 65 65)"/><text x="65" y="76" text-anchor="middle" class="rt-v">${pct}</text></svg>`;
  const hero=`<section class="panel rt-hero">${ring}<div class="rt-h"><span class="ds-sub">Team Rating · ${wkSpan(g,h)}</span><b>${mine.toFixed(1)} <span>of ${best.toFixed(1)} possible</span></b>
    <div class="ds-tiles rt-k">${dsTile("Gap",twSg(mine-best),"points","dn")}${dsTile("Same players",`${same} of 11`,"in both XIs")}${dsTile("Moves to close",outs,outs>freeLeft(g)?`−${(outs-freeLeft(g))*HIT} hit after ${freeLeft(g)} FT`:"within your free transfers")}${dsTile("Bench",benchPts.toFixed(1),"points on the bench")}</div></div>
    <div class="rt-a"><button class="pri" onclick="act('cmpopen','${h===1?"fh":"wc"}')">${lic("arrow-right-left",14)} Open in Compare</button></div></section>`;
  /* the rating for each week ahead (the quick builder past this week) */
  const ahead=[];for(let e=g;e<g+5&&e<=38;e++){const t=e===g?(chipTeam("freehit",e,true)||{}).t:(chipTeam("freehit",e,false)||{}).t;if(!t)continue;const b=teamScore(t.xi.concat(t.bench).map(p=>p.id),e,null);ahead.push([e,b>0?Math.round(clamp(teamScore(effectiveSquadIds(e).ids,e,null)/b,0,1)*100):null]);}
  const trend=colChart(ahead.map(x=>"GW"+x[0]),[{name:"Rating",values:ahead.map(x=>x[1]),color:"#3DDC97"}],[],{h:150,w:420,min:0,label:"Rating by week"});
  /* team shape: how far your XI follows the top 10k, by line */
  const F=twField(),eo=F&&F.top10k?F.top10k.own:null;let shape;
  if(eo){const line=k=>{const mineK=myXI.filter(p=>p.pos===k);if(!mineK.length)return null;const got=mineK.reduce((a,p)=>a+(eo[p.id]||0),0);
      const topK=S.model.players.filter(p=>p.pos===k).map(p=>eo[p.id]||0).sort((a,b)=>b-a).slice(0,mineK.length).reduce((a,b)=>a+b,0);return topK>0?Math.round(got/topK*100):null;};
    const L=[[1,"GK"],[2,"DEF"],[3,"MID"],[4,"FWD"]].map(([k,n])=>[n,line(k)]).filter(x=>x[1]!=null);
    const all=Math.round(myXI.reduce((a,p)=>a+(eo[p.id]||0),0)/Math.max(1,S.model.players.map(p=>eo[p.id]||0).sort((a,b)=>b-a).slice(0,11).reduce((a,b)=>a+b,0))*100);
    const lab=all>=80?"template":all>=60?"moderately differential":"differential",T=F.top10k.avg,last=rankRows().slice(-1)[0]||{};
    shape=`<section class="panel tw-col">${dsHead("shield","Team shape",`<span class="ds-sub">against the top 10k</span>`)}
      <div class="rt-sh"><div class="rt-big"><b>${all}%</b><span>Template rating</span><em>${lab}</em></div><div class="rt-l">${L.map(([n,x])=>`<div class="rt-r"><span class="ds-sub">${n}</span><span class="tw-bt"><i style="width:${clamp(x,0,100)}%"></i></span>${dsFig(x+"%")}</div>`).join("")}</div></div>
      <div class="ds-tiles rt-2">${dsTile("Squad value",`£${(+last.value||0).toFixed(1)}`,`top 10k avg £${T.value.toFixed(1)}`,(+last.value||0)>=T.value?"up":"dn")}${dsTile("In the bank",`£${planBank().toFixed(1)}`,`top 10k avg £${T.bank.toFixed(1)}`)}</div></section>`;}
  else shape=`<section class="panel tw-col">${dsHead("shield","Team shape")}<p class="note">The top-10k sample fills this in after the next deadline.</p></section>`;
  const chip=(list,other,side)=>list.map(p=>{const only=!other.some(o=>o.id===p.id);return `<span class="rt-p${only?" "+side:""}">${dsFace(p)}<span class="ds-name">${esc(p.web_name)}</span>${dsFig(v(p).toFixed(1))}</span>`;}).join("");
  const row=(label,mineL,bestL)=>{const a=mineL.reduce((s,p)=>s+v(p),0),b=bestL.reduce((s,p)=>s+v(p),0),pc=b>0?Math.min(100,Math.round(a/b*100)):100;
    return `<div class="rt-row"><div class="rt-lb"><b>${label}</b><span class="tw-bt"><i style="width:${clamp(pc,0,100)}%;background:${pc>=90?"#3DDC97":pc>=75?"#FFB020":"#FF5A6E"}"></i></span><span class="ds-sub">${a.toFixed(1)} of ${b.toFixed(1)} · <b class="${pc>=90?"up":pc>=75?"am":"dn"}">${pc}%</b></span></div>
      <div class="rt-ps">${chip(mineL,bestL,"out")}</div>${lic("arrow-right",14)}<div class="rt-ps">${chip(bestL,mineL,"in")}</div><b class="ds-fig ${b-a>0.05?"dn":"up"} rt-g">${b-a>0.05?"−"+(b-a).toFixed(1):"best"}</b></div>`;};
  const pos=`<section class="panel tw-col rt-pos">${dsHead("users","Position by position",`<span class="rt-key"><span class="rt-p out"><span class="ds-name">only yours</span></span><span class="rt-p in"><span class="ds-name">in the best XI</span></span></span>`)}
    <div class="rt-row rt-rh ds-th"><span>Position</span><span>Your XI</span><span></span><span>Best ${h===1?"XI":"squad"} for £${budget.toFixed(1)}</span><span>Gap</span></div>
    ${[[1,"Goalkeeper"],[2,"Defenders"],[3,"Midfielders"],[4,"Forwards"]].map(([k,n])=>row(n,myXI.filter(p=>p.pos===k).sort((a,b)=>v(b)-v(a)),bXI.filter(p=>p.pos===k).sort((a,b)=>v(b)-v(a)))).join("")}
    ${row("Bench",myBench,bBench)}</section>`;
  return modalHTML("Team Rating",`<div class="rt-top">${hero}<section class="panel tw-col">${dsHead("activity","Rating by week ahead",`<span class="ds-sub">GW${g}–${g+ahead.length-1}</span>`)}${trend}</section>${shape}</div>${pos}`,
    {wide:true,cls:"tw rt",icon:lic("gauge",18),ctl:`<span class="tw-sp"></span>${hz}`});
}
/* ---------- the live gameweek (22 Nov 2026, batch 5, Andy approved the mocks) ----------
   While a gameweek is being played the Planner opens on it: each card shows
   the match state, live points with provisional bonus (from the match's BPS)
   and DefCon progress, and a pill of the prediction against the field; a
   summary bar under the scroller; the Live panel (league, your edge, threats)
   where the Player Pool sits; Rank and Match Centre below. A league name
   opens head to head. The week's figures come from /api/fpl-week/<gw>,
   refetched every minute. Classes lp-, lv4-, lg5-, ed4-, rk4-, bm4-, tr4-,
   sf4-, m4-/m5-/mx5-, hh-/hl-/hp-. */
LUCIDE["chevron-up"]=LUCIDE["chevron-up"]||"<path d=\"m18 15-6-6-6 6\"/>";
/* the gameweek being played: the last one past its deadline, with official
   picks, not finished by FPL and not every match over */
/* 24 Nov 2026 (Andy): the live view holds until midnight at the end of the
   day of the week's last match, then the Planner moves on to the next week,
   whether or not FPL has finalised it. The last kick-off comes from the live
   week's fixtures, else the season's fixture list; null when neither has it. */
function lkWeekEnd(g){
  const W=S.wkLive&&S.wkLive[g];
  const ko=[...((W&&W.fixtures)||[]).map(f=>f.ko),...((S.model&&S.model.byEv[g])||[]).map(f=>f.kickoff)]
    .map(k=>k?Date.parse(k):NaN).filter(t=>!isNaN(t));
  if(!ko.length)return null;
  const d=new Date(Math.max(...ko));d.setHours(24,0,0,0);
  return d.getTime();
}
function liveGW(){
  if(!S.model||BACKUP)return null;
  const g=S.model.next.id-1;
  if(g<1||!offRowOf(g))return null;
  const end=lkWeekEnd(g);
  if(end!=null)return Date.now()<end?g:null;
  if(weekFinal(g))return null;
  const W=S.wkLive&&S.wkLive[g];
  if(W&&Array.isArray(W.fixtures)&&W.fixtures.length&&W.fixtures.every(f=>f.done))return null;
  return g;
}
const isLiveWk=g=>g!=null&&liveGW()===g;
/* the minute timer (app-main's status tick calls this) */
function lkTick(){
  const g=liveGW();
  /* midnight after the last match: an open Planner on the live week moves on */
  if(!g&&S.liveAuto&&S.startGW){S.startGW=0;S.liveAuto=false;if(S.tab==="squad")render();return;}
  if(!g)return;
  if(S.wkAt&&Date.now()-(S.wkAt[g]||0)<55000)return;
  if(S.tab==="squad"&&VG()===g)lkKeep(()=>weekLive(g,true));
}
/* keep the Live panel's and Match Centre's scroll through a repaint */
function lkKeep(fn){
  const sel=[".lv4-sc",".mc5-s",".hh-side",".lvm-fd .fd-list",".lvm-et .fd-list"],pos=sel.map(s=>[...document.querySelectorAll(s)].map(e=>e.scrollTop));
  fn();
  S._lkRestore=()=>sel.forEach((s,i)=>[...document.querySelectorAll(s)].forEach((e,j)=>{if(pos[i][j])e.scrollTop=pos[i][j];}));
}
const LK_SV=b=>`<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">${b}</svg>`;
const LK_SI={
  dn:LK_SV('<circle cx="12" cy="12" r="9" fill="#3DDC97"/><path d="M8 12.3l2.7 2.7L16 9.7" fill="none" stroke="#04170E" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'),
  in:LK_SV('<circle cx="12" cy="12" r="9" fill="none" stroke="#FF5A6E" stroke-width="2"/><circle cx="12" cy="12" r="4.5" fill="#FF5A6E"/>'),
  tp:LK_SV('<circle cx="12" cy="12" r="9" fill="none" stroke="#7A7A7A" stroke-width="2"/><path d="M12 7.5V12l3 2" fill="none" stroke="#9A9A9A" stroke-width="2" stroke-linecap="round"/>'),
  dnp:LK_SV('<circle cx="12" cy="12" r="9" fill="#3A1219" stroke="#FF5A6E" stroke-width="1.5"/><path d="M9 9l6 6M15 9l-6 6" stroke="#FF8095" stroke-width="2" stroke-linecap="round"/>')};
LK_SI.bl=LK_SI.dnp;
const LK_ST={dn:"Finished",in:"In play",tp:"To play",dnp:"Did not play",bl:"No match"};
const lkSI=s=>`<span class="ld-si" title="${LK_ST[s]||""}">${LK_SI[s]||""}</span>`;
const lkKo=ko=>{if(!ko)return "TBC";const d=new Date(ko);return isNaN(d)?"TBC":d.toLocaleString("en-GB",{timeZone:"Europe/London",weekday:"short",hour:"2-digit",minute:"2-digit"}).replace(",","");};
const lkK=v=>{const a=Math.abs(v);return a>=1e6?(a/1e6).toFixed(1)+"m":a>=1e4?Math.round(a/1e3)+"k":a>=1e3?(a/1e3).toFixed(1)+"k":String(Math.round(a));};
const lkSg=(v,f)=>(v>0?"+":v<0?"−":"")+(f?f(Math.abs(v)):Math.abs(v));
/* DefCon threshold: defenders 10, midfielders and forwards 12 (FPL 2025-26) */
const lkDcT=pos=>pos===2?10:pos>=3?12:null;
/* Rank from a season total and back, through the rank bands the server
   samples each hour: log-linear between bands, the end slopes beyond them */
function lkBands(g){
  const B=S.rankBands;if(!B||!Array.isArray(B.bands))return null;
  let pts=B.bands.filter(b=>b&&b.total!=null&&(b.at||b.rank)>0).map(b=>({r:b.at||b.rank,t:+b.total})).sort((a,b)=>a.r-b.r);
  if(pts.length<2)return null;
  /* bands from before this week kicked off move up by the field's live score */
  if(B.gw!=null&&B.gw<g){const sh=S._lkShift||0;pts=pts.map(x=>({r:x.r,t:x.t+sh}));}
  return pts;
}
function lkRankAt(T,g){
  const b=lkBands(g);if(!b||T==null)return null;
  const N=(S.tracker&&S.tracker.totalPlayers)||1e7,L=Math.log;
  const ext=(a,c)=>{const s=(L(c.r)-L(a.r))/Math.max(1e-9,a.t-c.t);return T>=a.t?Math.exp(L(a.r)-s*(T-a.t)):Math.exp(L(c.r)+s*(c.t-T));};
  let r;
  if(T>=b[0].t)r=ext(b[0],b[1]);
  else if(T<=b[b.length-1].t)r=ext(b[b.length-2],b[b.length-1]);
  else for(let i=0;i<b.length-1;i++){const a=b[i],c=b[i+1];if(T<=a.t&&T>=c.t){r=a.t===c.t?a.r:Math.exp(L(a.r)+(a.t-T)/(a.t-c.t)*(L(c.r)-L(a.r)));break;}}
  return Math.round(clamp(r,1,N));
}
function lkTotalAt(R,g){
  const b=lkBands(g);if(!b||!R)return null;const L=Math.log;
  const seg=(a,c)=>a.t+(L(R)-L(a.r))/(L(c.r)-L(a.r)||1e-9)*(c.t-a.t);
  if(R<=b[0].r)return seg(b[0],b[1]);
  for(let i=0;i<b.length-1;i++)if(R>=b[i].r&&R<=b[i+1].r)return seg(b[i],b[i+1]);
  return seg(b[b.length-2],b[b.length-1]);
}
/* FPL's month for a gameweek: the feed's phases (start..stop), else the
   weeks whose deadline falls in the same London month */
function lkMonth(g){
  const ph=S.rivalsFeed&&S.rivalsFeed.phases;
  if(Array.isArray(ph)&&ph.length){const p=ph.find(x=>g>=x.start&&g<=x.stop);if(p)return p;}
  const mk=e=>{const d=e&&e.deadline?new Date(e.deadline):null;return d&&!isNaN(d)?d.toLocaleString("en-GB",{timeZone:"Europe/London",month:"long",year:"numeric"}):null;};
  const evs=S.events||[],k=mk(evs.find(e=>e.id===g));if(!k)return null;
  const ids=evs.filter(e=>mk(e)===k).map(e=>e.id);
  return{name:k.split(" ")[0],start:Math.min(...ids),stop:Math.max(...ids)};
}
/* every live figure for one gameweek, kept until its inputs change */
let _lk={};
function lkCalc(g){
  const W=weekLive(g),row=offRowOf(g);
  if(!W||!row||!W.players||!S.model)return null;
  const filt=["near","top10k","overall"].includes(S.lkF)?S.lkF:"top10k";
  if(_lk.W===W&&_lk.g===g&&_lk.rf===S.rivalsFeed&&_lk.fd===S.field&&_lk.rb===S.rankBands&&_lk.f===filt&&_lk.tr===S.tracker)return _lk.v;
  const PM=new Map(S.model.players.map(p=>[p.id,p])),P=id=>PM.get(+id);
  const fxT={};W.fixtures.forEach(f=>{(fxT[f.h]=fxT[f.h]||[]).push(f);(fxT[f.a]=fxT[f.a]||[]).push(f);});
  /* provisional bonus: 3, 2, 1 by the match's BPS, ties sharing, until FPL
     adds the confirmed bonus to the match */
  const prov={},provFx={};
  W.fixtures.forEach(f=>{if(!f.started||!f.st)return;const b=f.st.bonus;if(b&&((b.h||[]).length||(b.a||[]).length))return;
    const l=f.st.bps?[...(f.st.bps.h||[]),...(f.st.bps.a||[])]:[];const m={};
    l.forEach(([el,v])=>{const r=1+l.filter(x=>x[1]>v).length,pt=r===1?3:r===2?2:r===3?1:0;if(pt){prov[el]=(prov[el]||0)+pt;m[el]=pt;}});
    provFx[f.id]=m;});
  const pts=id=>((W.players[id]||{}).p||0)+(prov[id]||0);
  const status=id=>{const p=P(id),fx=p?fxT[p.team]||[]:[];
    if(!fx.length)return{s:"bl",fx};
    const on=fx.find(f=>f.started&&!f.done&&!f.fp);if(on)return{s:"in",min:on.min,fx};
    const over=fx.filter(f=>f.done||f.fp).length;
    if(over===fx.length)return{s:((W.players[id]||{}).m||0)>0?"dn":"dnp",fx};
    if(fx.some(f=>f.started))return{s:"in",min:0,fx};
    return{s:"tp",ko:(fx.find(f=>!f.started)||{}).ko,fx};};
  const tr=((S.tracker&&S.tracker.gw)||[]),prevRow=tr.find(r=>r.event===g-1)||null;
  const bb=row.chip==="bboost";
  const picks=row.picks.map((pk,i)=>({id:pk.id,p:P(pk.id),m:pk.multiplier!=null?pk.multiplier:(i<11?1:0),i,isC:!!pk.isC,isVC:!!pk.isVC}));
  const cost=row.transferCost||0;
  const pre=picks.reduce((a,k)=>a+pts(k.id)*k.m,0)-cost;
  /* auto-subs as FPL would make them now: a starter whose matches are all
     over without a minute makes way for the first bench player who played,
     keeping a legal formation; the vice takes the armband */
  function postSubs(pk,bbX,costX){
    if(bbX===undefined)bbX=bb;if(costX===undefined)costX=cost;
    if(bbX)return{pts:pk.reduce((a,k)=>a+pts(k.id)*k.m,0)-costX,subs:[]};
    const xi=pk.slice(0,11).map(k=>({...k})),bn=pk.slice(11).map(k=>({...k})),subs=[];
    const st=k=>status(k.id).s,pos=k=>(k.p||{}).pos||0,cnt=(l,q)=>l.filter(k=>pos(k)===q).length;
    xi.forEach((k,ix)=>{if(st(k)!=="dnp"&&st(k)!=="bl")return;
      for(const b of bn){if(b.used)continue;const s=st(b);if(s!=="dn")continue;
        if((pos(k)===1)!==(pos(b)===1))continue;
        const t=xi.slice();t[ix]=b;if(pos(k)!==1&&(cnt(t,2)<3||cnt(t,3)<2||cnt(t,4)<1))continue;
        b.used=1;subs.push({out:k.p,inn:b.p});xi[ix]={...b,m:1};break;}});
    const c=xi.find(k=>k.isC),v=xi.find(k=>k.isVC);
    if(c&&["dnp","bl"].includes(st(c))&&v&&st(v)==="dn"){const cm=Math.max(2,c.m||2);v.m=cm;c.m=0;}
    return{pts:xi.reduce((a,k)=>a+pts(k.id)*k.m,0)-costX,subs,xi};
  }
  const post=postSubs(picks);
  const prevTotal=prevRow&&prevRow.totalPoints!=null?prevRow.totalPoints:((row.totalPoints||0)-(row.points||0));
  const oldRank=prevRow?prevRow.orRank:null;
  /* the field: the sample around you, the top 10k, or FPL's own ownership */
  const F=S.field&&S.field.gws?(S.field.gws[g]||S.field.gws[S.field.latest])||null:null;
  const fs=f=>F&&F[f]?F[f]:null;
  const eoOf=(f,id)=>f==="overall"?((P(id)||{}).owned||0):(((fs(f)||{}).eo||{})[id]||0);
  const fieldScore=f=>{const x=fs(f);if(!x||!x.eo)return null;let s=0;for(const id in x.eo)s+=x.eo[id]/100*pts(id);return s-((x.avg&&x.avg.hits)||0);};
  S._lkShift=fieldScore("near")||0;
  const total=prevTotal+pre,totalPost=prevTotal+post.pts;
  const liveRank=lkRankAt(total,g),postRank=lkRankAt(totalPost,g);
  const holdT=oldRank?lkTotalAt(oldRank,g):null,safety=holdT!=null?Math.round(holdT-prevTotal):null;
  const rpp=liveRank?Math.max(0,(lkRankAt(total-0.5,g)||liveRank)-(lkRankAt(total+0.5,g)||liveRank)):0;
  /* the league: each manager's picks this week against the same live points */
  const ents=(S.rivalsFeed&&S.rivalsFeed.entries)||{},meId=String(TEAM_ID);
  const starts={};let nLg=0;
  const lgIds=Object.keys(ents);if(lgIds.length&&!lgIds.includes(meId))lgIds.push(meId);
  const league=lgIds.map(id=>{const e=ents[id]||{name:"You",manager:"",gw:(S.tracker&&S.tracker.gw)||[],chips:[]},rows=e.gw||[],r=rows.find(x=>x.event===g),pr=rows.find(x=>x.event===g-1);
    const mine=id===meId,pk=mine?row.picks:(r&&r.picks)||[];
    if(!pk.length)return null;
    nLg++;pk.forEach((k,i)=>{const m=k.multiplier!=null?k.multiplier:(i<11?1:0);if(m>0)starts[k.id]=(starts[k.id]||0)+1;});
    const c=mine?cost:(r&&r.transferCost)||0;
    const live=pk.reduce((a,k,i)=>a+pts(k.id)*(k.multiplier!=null?k.multiplier:(i<11?1:0)),0)-c;
    const before=pr&&pr.totalPoints!=null?pr.totalPoints:(mine?prevTotal:0);
    const chips=(e.chips||[]).filter(x=>x.event<=g);
    /* LiveFPL's columns (27 Nov 2026): the captain and where his match is,
       the counting players playing now and still to start, the month so far */
    const mOf=(k,i)=>k.multiplier!=null?k.multiplier:(i<11?1:0),cnt=pk.filter((k,i)=>mOf(k,i)>0);
    const capK=pk.find(k=>k.isC)||null,capS=capK?status(capK.id).s:null;
    const inPlay=cnt.filter(k=>status(k.id).s==="in").length,toStart=cnt.filter(k=>status(k.id).s==="tp").length;
    const mo=lkMonth(g),month=mo?rows.filter(x=>x.event>=mo.start&&x.event<g).reduce((a,x)=>a+(x.points||0)-(x.transferCost||0),0)+live:null;
    return{id,name:e.name||"",manager:e.manager||"",mine,live,total:before+live,before,oldRank:pr?(pr.overallRank??pr.orRank??null):null,
      cap:capK?P(capK.id):null,capS,inPlay,toStart,month,
      used:chips.map(x=>x.name),chipsEv:chips.map(x=>({name:x.name,event:x.event})),act:(chips.find(x=>x.event===g)||{}).name||"",
      transfers:rows.filter(x=>x.event<=g).reduce((a,x)=>a+(x.transfers||0),0),value:r?r.value:null,picks:pk,cost:c,row:r};}).filter(Boolean);
  league.forEach(x=>x.rank=lkRankAt(x.total,g));
  const lgPct=(id,excl)=>{const n=nLg-(excl?1:0);if(n<=0)return null;return ((starts[id]||0)-(excl&&excl.has(+id)?1:0))/n*100;};
  const myStart=new Set(picks.filter(k=>k.m>0).map(k=>k.id));
  /* against the field: what each player's points did to you */
  const mult=id=>{const k=picks.find(x=>x.id===+id);return k?k.m:0;};
  const vf=(id,f)=>(mult(id)*100-eoOf(f||filt,id))/100*pts(id);
  const ids=new Set([...picks.map(k=>k.id),...Object.keys((fs(filt)||{}).eo||{}).map(Number),...Object.keys(starts).map(Number)]);
  if(filt==="overall")S.model.players.forEach(p=>{if(p.owned>=5)ids.add(p.id);});
  const all=[...ids].map(id=>({id,p:P(id),st:status(id),pts:pts(id),m:mult(id),eo:eoOf(filt,id),vf:vf(id),lg:lgPct(id,myStart)})).filter(x=>x.p);
  all.forEach(x=>{x.lgd=x.lg==null?null:(x.m>0?100:0)-x.lg;x.rk=x.vf*rpp;});
  const edge=all.filter(x=>x.m>0).sort((a,b)=>(b.vf-a.vf)||(a.st.s==="tp")-(b.st.s==="tp"));
  const threats=all.filter(x=>x.vf<-0.05).sort((a,b)=>a.vf-b.vf);
  const vsField=all.reduce((a,x)=>a+x.vf,0);
  const counted=picks.filter(k=>k.m>0),cnt=s=>counted.filter(k=>{const t=status(k.id).s;return s==="dn"?t==="dn"||t==="dnp"||t==="bl":t===s;}).length;
  /* expected final: points so far, plus the prediction for what is left */
  const pr=k=>{const sp=k.p&&pastPred(k.p,g);return sp?sp.v:0;};
  const expected=pre+counted.reduce((a,k)=>{const s=status(k.id);return a+(s.s==="tp"?pr(k)*k.m:s.s==="in"?Math.max(0,pr(k)-2)*Math.max(0,90-(s.min||0))/90*k.m:0);},0);
  const ev=(S.events||[]).find(e=>e.id===g)||{};
  const B=S.rankBands,me=B&&B.me&&B.me.gw===g?B.me:null;
  const v={g,W,row,prevRow,P,pts,prov,provFx,status,picks,pre,post,cost,prevTotal,total,totalPost,oldRank,liveRank,postRank,safety,
    arrow:safety!=null?pre-safety:null,rpp,league,lgPct,starts,nLg,edge,threats,vsField,all,filt,eoOf,fs,fieldScore,expected,
    done:cnt("dn"),playing:cnt("in"),toPlay:cnt("tp"),avg:ev.avg||null,gwRank:me?me.gwRank:null,bb,mult,subsFor:postSubs};
  _lk={W,g,rf:S.rivalsFeed,fd:S.field,rb:S.rankBands,f:filt,tr:S.tracker,v};
  return v;
}
/* ---------- the card's lower half on the live week ---------- */
function lkRowsHTML(p,g,predShown,hasPred){
  const L=lkCalc(g),W=L&&L.W;
  if(!L)return `<div class="pv-res"><b class="mu">…</b></div>`;
  const s=L.status(p.id),st=W.players[p.id],short=id=>((S.teams||[]).find(t=>t.id===id)||{}).short||"?";
  const res=s.fx.length?s.fx.slice(0,2).map(f=>{const home=f.h===p.team,us=home?f.hs:f.as,them=home?f.as:f.hs,opp=short(home?f.a:f.h);
      const on=f.started&&!f.done&&!f.fp,box=!f.started?`<span class="lp-st tp">${lkKo(f.ko)}</span>`:on?`<span class="lp-st live">${f.min||0}′</span>`:`<span class="lp-st ft">FT</span>`;
      return `<div class="pv-res lpv${s.fx.length>1?" dbl":""}">${box}<b>${f.started&&us!=null?`${us}–${them}`:"v"}</b><span class="pv-opp">${home?esc(opp):esc(opp).toLowerCase()}</span></div>`;}).join("")
    :`<div class="pv-res lpv"><span class="lp-st tp">–</span><b>No game</b></div>`;
  let ev=evRowHTML(p,st&&!['dn','dnp'].includes(s.s)?{...st,m:null}:st);
  const pb=L.prov[p.id];
  if(pb)ev+=`<span class="pv-ev pv-prov" style="--ec:#FFB020" title="${pb} provisional bonus point${pb===1?"":"s"}">${EV_ICON.b}<i>${pb}</i></span>`;
  const t=lkDcT(p.pos);
  if(t&&st&&st.dcn&&!st.dc&&s.s==="in")ev+=`<span class="pv-ev" style="--ec:#A78BFA" title="Defensive contribution ${st.dcn} of ${t}">${EV_ICON.dc}<i>${st.dcn}/${t}</i></span>`;
  const m=L.mult(p.id),eo=L.eoOf(L.filt,p.id),pts=L.pts(p.id),vf=(m*100-eo)/100*pts,off=m===0||s.s==="tp"||s.s==="bl";
  const pred=hasPred?predShown.toFixed(1):"–";
  return `${res}<div class="pv-row"><span class="pv-evs">${ev||`<span class="pv-none">—</span>`}</span></div>
    <div class="pv-pills"><span class="lp-pill${off?" nf":vf>=0?" up":" dn"}" title="Predicted ${pred} · field ${Math.round(eo)}%${off?"":` · ${sgn1(vf)} pts against the field`}"><span class="lp-pp">${pred}</span><span class="lp-pf">${lic("swords",10)}${off?`${Math.round(eo)}%`:sgn1(vf)}</span></span></div>`;
}
/* ---------- the summary bar ---------- */
function lkSumHTML(g){
  const L=lkCalc(g);if(!L)return "";
  const N=(S.tracker&&S.tracker.totalPlayers)||null;
  const cell=(l,v,x,cls)=>`<div${cls?` class="${cls}"`:""}><span>${l}</span><b>${v}</b>${x||""}</div>`;
  const ch=L.oldRank&&L.liveRank?L.oldRank-L.liveRank:null;
  return `<div class="pv-sum lp-sum">
    <div class="pv-big"><span><span class="lp-dot"></span> Live points</span><b>${fmtPts(L.pre)}</b><i>expected final ${Math.round(L.expected)}</i></div>
    ${cell("Green arrow",L.arrow==null?"—":`<span class="${L.arrow>=0?"up":"dn"}">${lkSg(Math.round(L.arrow))}</span>`,`<i>safety score ${L.safety??"—"}</i>`,"lp-ga")}
    ${cell("Live rank",L.liveRank?L.liveRank.toLocaleString():"—",ch?`<i class="${ch>0?"up":"dn"}">${ch>0?"▲":"▼"} ${lkK(ch)}</i>`:"")}
    ${cell("GW rank",L.gwRank?L.gwRank.toLocaleString():"—",L.gwRank&&N?`<i>top ${Math.max(1,Math.round(L.gwRank/N*100))}%</i>`:"")}
    ${cell("Average",L.avg??"—",L.avg?`<i class="${L.pre>=L.avg?"up":"dn"}">you ${lkSg(Math.round(L.pre-L.avg))}</i>`:"")}
    ${cell("Players",`${L.done} · ${L.playing} · ${L.toPlay}`,`<i>done · playing · to play</i>`)}</div>`;
}
/* the league in the chosen order (Total by default): positions share on a
   tie, and on Total each row's move since the week began */
function lkLeagueRows(L){
  const key=["gw","month","total"].includes(S.lkS)?S.lkS:"total";
  const v=x=>key==="gw"?x.live:key==="month"?(x.month??-1e9):x.total;
  const lg=L.league.slice().sort((a,b)=>(v(b)-v(a))||(b.total-a.total)||(b.live-a.live));
  lg.forEach((x,i)=>x.pos=i&&v(lg[i-1])===v(x)?lg[i-1].pos:i+1);
  const was=L.league.slice().sort((a,b)=>b.before-a.before);
  lg.forEach(x=>{const p=1+was.filter(y=>y.before>x.before).length;x.move=p-x.pos;});
  return lg;
}
/* ---------- the Live panel, where the Player Pool sits ---------- */
/* ---------- the Live panel, where the Player Pool sits ----------
   28 Nov 2026 (Andy approved the mock): the league in full at the top with
   a Live / Season switch, the Feed below it, then Your Edge / Threats on one
   switch filling the rest down to the bottom of the team. */
const LK_EV={goals_scored:["Goal","G","#3DDC97"],assists:["Assist","A","#60A5FA"],own_goals:["Own goal","OG","#FF5A6E"],
  penalties_saved:["Pen saved","P","#60A5FA"],penalties_missed:["Pen missed","P","#FF5A6E"],yellow_cards:["Yellow card","Y","#FACC15"],
  red_cards:["Red card","R","#FF5A6E"],saves:["Saves","S","#60A5FA"],clean_sheets:["Clean sheet","C","#3DDC97"],
  goals_conceded:["Conceded","GC","#FF8A3D"],bonus:["Bonus","B","#F5B33C"],defensive_contribution:["DefCon","D","#A78BFA"],
  subbed_off:["Subbed off","↓","#9A9A9A"],subbed_on:["Subbed on","↑","#3DDC97"],news:["Flag","!","#FF8A3D"]};
/* 29 Nov 2026: each event's icon, from the Planner's own set */
const LK_ARR=d=>`<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d?"M12 5v14M6 13l6 6 6-6":"M12 19V5M6 11l6-6 6 6"}"/></svg>`;
const lkEvIcon=e=>({goals_scored:EV_ICON.g,assists:EV_ICON.a,own_goals:EV_ICON.og,penalties_saved:EV_ICON.sv,penalties_missed:EV_ICON.pen,
  yellow_cards:EV_ICON.card("#FFD23F"),red_cards:EV_ICON.card("#FF5A6E"),saves:EV_ICON.sv,clean_sheets:EV_ICON.cs,goals_conceded:EV_ICON.cs,
  bonus:EV_ICON.b,defensive_contribution:EV_ICON.dc,subbed_off:LK_ARR(1),subbed_on:LK_ARR(0),news:lic("triangle-alert",13)})[e.k]||EV_ICON.mins;
/* when an untimed event (one there before the server first looked) is placed:
   an hour after its match kicked off, so it sorts among that match's events */
function lkFxTime(L,e){const f=(L.W.fixtures||[]).find(x=>x.id===e.fx),k=f&&f.ko?Date.parse(f.ko):NaN;return isNaN(k)?0:k+3600000;}
/* the Feed's rows and its two totals: impact is the points times your
   multiplier less the rest of the league's average multiplier for him */
function lkFeed(L){
  const g=L.g,rivals=L.league.filter(x=>!x.mine),n=rivals.length||1;
  const mOf=(k,i)=>k.multiplier!=null?k.multiplier:(i<11?1:0);
  const avg={};rivals.forEach(x=>x.picks.forEach((k,i)=>{const m=mOf(k,i);if(m>0)avg[k.id]=(avg[k.id]||0)+m/n;}));
  const owned=new Set([...Object.keys(avg).map(Number),...L.picks.filter(k=>k.m>0).map(k=>k.id)]);
  const diff=id=>L.mult(id)-(avg[id]||0);
  /* like LiveFPL's My Feed: every goal, assist, own goal, penalty and red
     card in the week, and everything for a player anyone in the league owns */
  const big=new Set(["goals_scored","assists","own_goals","penalties_saved","penalties_missed","red_cards"]);
  /* FPL moves provisional bonus as the BPS changes: each player's bonus in a
     match is one row, his current total, at the time of its last change */
  const src=[],bon={};
  ((L.W&&L.W.feed)||[]).forEach(e=>{if(e.k!=="bonus"){src.push(e);return;}const key=e.el+":"+e.fx,b=bon[key];
    if(!b){bon[key]={...e};src.push(bon[key]);}else{b.dp+=e.dp;b.dv+=e.dv;if((e.t??0)>=(b.t??0)){b.t=e.t;b.min=e.min;}}});
  const fxDone=id=>{const f=(L.W.fixtures||[]).find(x=>x.id===id);return !!(f&&(f.done||f.fp));};
  const rows=src.filter(e=>e.k!=="bonus"||e.dp).map(e=>e.k==="bonus"?{...e,prov:!fxDone(e.fx)}:e)
    .filter(e=>L.P(e.el)&&(owned.has(+e.el)||big.has(e.k))).map(e=>({...e,p:L.P(e.el),imp:e.dp*diff(+e.el)}))
    .map(e=>({...e,te:e.t??lkFxTime(L,e)}))
    .sort((a,b)=>(b.te??0)-(a.te??0)||(b.fx||0)-(a.fx||0));
  /* 29 Nov 2026: the two totals as LiveFPL counts them (Andy checked against
     it). Points: your week's net score less the rest of the league's average
     net score, hits included. Players left: your players still to finish
     (playing or to start, the captain counted by his multiplier) less the
     rest of the league's average. */
  const leftOf=x=>x.picks.reduce((a,k,i)=>{const m=mOf(k,i),s=L.status(k.id).s;return a+(m>0&&(s==="tp"||s==="in")?m:0);},0);
  const me=L.league.find(x=>x.mine),avgOf=f=>rivals.length?rivals.reduce((a,x)=>a+f(x),0)/rivals.length:0;
  const sofar=me?me.live-avgOf(x=>x.live):0,left=me?leftOf(me)-avgOf(leftOf):0;
  return{rows,sofar,left};
}
function lkPanelHTML(g){
  const L=lkCalc(g);if(!L)return `<div class="panel pv-rev lv4">${pnlHead("activity","Live","")}<p class="note" style="padding:16px">Loading the live gameweek…</p></div>`;
  const tg=(on,items)=>`<span class="lvm-tg">${items.map(([k,n,a])=>`<button class="${on===k?"on":""}" onclick="act('${a}','${k}')">${n}</button>`).join("")}</span>`;
  const view=S.lkV==="season"?"season":"live";
  const lgName=(S.rivalsFeed&&S.rivalsFeed.leagueName)||"League",mo=lkMonth(g);
  const C=`<span class="lg5-c">C</span>`,num=(v,c)=>`<span class="ds-fig lg5-n${v?"":" z"}">${c?C:""}${v}</span>`;
  const rowAttr=x=>x.mine?"":` role="button" tabindex="0" title="Head to head with ${esc(x.name)}" onclick="act('h2h','${x.id}')" onkeydown="if(event.key==='Enter')act('h2h','${x.id}')"`;
  let table;
  if(view==="live"){
    const lg=lkLeagueRows(L),key=["gw","month","total"].includes(S.lkS)?S.lkS:"total";
    const th=(k,t)=>`<span class="srt${key===k?" on":""}" role="button" tabindex="0" onclick="act('lks','${k}')" onkeydown="if(event.key==='Enter')act('lks','${k}')">${t}${key===k?" ▾":""}</span>`;
    /* 29 Nov 2026: a subtle arrow only when the team has moved since the week began */
    const mv=v=>key!=="total"||!v?"":`<span class="lg5-mv ${v>0?"up":"dn"}" title="${v>0?"Up":"Down"} ${Math.abs(v)} since the week began">${v>0?"▲":"▼"}${Math.abs(v)}</span>`;
    table=lg.length?`<div class="lg5 lg5-h ds-th"><span>#</span><span>Team · Captain</span><span>In<br>Play</span><span>To<br>Start</span>${th("gw","GW<br>Net")}${th("month","Month")}${th("total","Total")}</div>
    ${lg.map(x=>`<div class="lg5 lg5-r${x.mine?" me":""}"${rowAttr(x)}>
      <span class="lg5-pos"><span class="ds-fig">${x.pos}</span>${mv(x.move)}</span>
      <span class="lg5-tm"><span class="lg5-l1"><span class="ds-name">${esc(x.name)}</span><span class="ds-sub">${esc(x.manager)}</span></span>
        <span class="lg5-l2">${x.cap?`${C}<span class="lg5-cn">${esc(x.cap.web_name)}</span>${lkSI(x.capS)}`:`<span class="lg5-cn">No captain</span>`}${x.act?`<span class="lg5-chip" style="--tc:${(CHIP_UI[x.act]||{}).c||"#BDBDBD"}">${esc((DS_CHIPS.find(c=>c[0]===x.act)||[0,x.act])[1])}</span>`:""}</span></span>
      ${num(x.inPlay,x.capS==="in")}${num(x.toStart,x.capS==="tp")}
      <span class="lg5-gw"><span class="ds-fig">${fmtPts(x.live)}</span>${x.cost?`<i>−${x.cost}</i>`:""}</span>
      <span class="ds-fig lg5-mo">${x.month==null?"–":fmtPts(x.month)}</span><span class="ds-fig lg5-tot">${fmtPts(x.total)}</span></div>`).join("")}`:"";
  }else{
    /* Season: chips used (numbered by half), season transfers, overall rank,
       team value, this week's net and the total */
    const lg=L.league.slice().sort((a,b)=>b.total-a.total);
    lg.forEach((x,i)=>x.spos=i&&lg[i-1].total===x.total?lg[i-1].spos:i+1);
    const was=L.league.slice().sort((a,b)=>b.before-a.before);lg.forEach(x=>{x.smv=1+was.filter(y=>y.before>x.before).length-x.spos;});
    const chipTag=c=>{const k=c.name,u=CHIP_UI[k]||{},s=(DS_CHIPS.find(d=>d[0]===k)||[0,k])[1];return `<span style="--tc:${u.c||"#8A8A8A"}" title="${esc(u.n||k)} · GW${c.event}">${esc(s)}${c.event<=19?1:2}</span>`;};
    table=lg.length?`<div class="ls5 ls5-h ds-th"><span>#</span><span>Team · Chips used</span><span>Trans-<br>fers</span><span>Overall<br>rank</span><span>Team<br>value</span><span>GW<br>Net</span><span>Total</span></div>
    ${lg.map(x=>`<div class="ls5 ls5-r${x.mine?" me":""}"${rowAttr(x)}><span class="lg5-pos"><span class="ds-fig">${x.spos}</span>${x.smv?`<span class="lg5-mv ${x.smv>0?"up":"dn"}" title="${x.smv>0?"Up":"Down"} ${Math.abs(x.smv)} since the week began">${x.smv>0?"▲":"▼"}${Math.abs(x.smv)}</span>`:""}</span>
      <span class="ls5-tm"><span class="lg5-l1"><span class="ds-name">${esc(x.name)}</span><span class="ds-sub">${esc(x.manager)}</span></span><span class="ls5-ch">${(x.chipsEv||[]).map(chipTag).join("")||`<span class="ls5-no">No chips used</span>`}</span></span>
      <span class="ds-fig">${x.transfers}</span><span class="ds-fig ls5-m">${x.rank?x.rank.toLocaleString():"—"}</span><span class="ds-fig ls5-m">${x.value?"£"+(+x.value).toFixed(1):"—"}</span>
      <span class="ds-fig">${fmtPts(x.live)}</span><span class="ds-fig lg5-tot">${fmtPts(x.total)}</span></div>`).join("")}`:"";
  }
  const league=`<div class="lv4-blk lvm-lg"><div class="lvm-h">${lic("trophy",15)}<b>${esc(lgName)}</b><span class="ds-sub">GW${g}${mo&&view==="live"?` · ${esc(mo.name)}`:""}</span><span class="sp">${tg(view,[["live","Live","lkv"],["season","Season","lkv"]])}</span></div>
    ${table||`<p class="ds-sub" style="padding:8px 0">The league's picks for GW${g} are not in yet.</p>`}</div>`;
  /* the Feed */
  const Fd=lkFeed(L),sg=v=>`<b class="${v>0.05?"up":v<-0.05?"dn":""}">${v>0.05?"+":v<-0.05?"−":""}${Math.abs(v).toFixed(1)}</b>`;
  const tm=e=>e.t?new Date(e.t).toLocaleTimeString("en-GB",{timeZone:"Europe/London",hour:"2-digit",minute:"2-digit"}):"";
  const fr=e=>{const d=LK_EV[e.k]||[e.k,"·","#8A8A8A"],lost=e.k==="clean_sheets"&&e.dp<0,col=lost?"#FF5A6E":d[2];
    const lab=lost?"Clean sheet lost":e.k==="bonus"&&e.prov?"Bonus (prov.)":e.k==="news"?`<span class="fd-nw" title="${esc(e.txt||"")}">${esc(e.txt||"Flagged")}</span>`:d[0];
    return `<div class="fd-r${L.mult(+e.el)>0?" mine":""}"><span class="fd-t">${tm(e)}<i>${e.min!=null&&e.t?e.min+"′":""}</i></span>${dsFace(e.p)}
      <span class="fd-p"><span class="ds-name">${esc(e.p.web_name)}</span><span class="ds-sub">${esc(e.p.teamFull||e.p.teamName||"")}</span></span>
      <span class="fd-ev" style="--ec:${col}"><span class="ic">${lkEvIcon(e)}</span><span class="fd-lb">${lab}</span>${e.dv>1&&["goals_scored","assists","own_goals","penalties_saved","penalties_missed"].includes(e.k)?" ×"+e.dv:""}${e.dp?`<i>${e.dp>0?"+":"−"}${Math.abs(e.dp)}</i>`:""}</span>
      <span class="fd-i ${e.imp>0.05?"up":e.imp<-0.05?"dn":"eq"}">${e.dp?`${e.imp>0.05?"+":e.imp<-0.05?"−":""}${Math.abs(e.imp).toFixed(1)}`:""}</span></div>`;};
  const feed=`<div class="lv4-blk lvm-fd"><div class="lvm-h">${lic("activity",15)}<b>Feed</b><button class="fci" data-tip="Each event's impact: its points times your share less the league's average share." aria-label="About the Feed">i</button><span class="sp fd-sum" title="You against the rest of the league's average this week">Points ${sg(Fd.sofar)} · Players left ${sg(Fd.left)}</span></div>
    <div class="fd-list">${Fd.rows.map(fr).join("")||`<p class="ds-sub" style="padding:6px 0">Nothing yet: events appear here as they happen.</p>`}</div></div>`;
  /* Your Edge / Threats */
  const ET=S.lkE==="threats"?"threats":"edge";
  const F=[["near","Near you","lkf"],["top10k","Top 10k","lkf"],["overall","Overall","lkf"]];
  const eh=`<div class="ed4 ed4-h ds-th"><span></span><span>Player</span><span></span><span>Pts</span><span>League starts</span><span>vs field</span><span>Ranks</span></div>`;
  const er=x=>`<div class="ed4 ed4-r">${dsFace(x.p)}<span class="ds-name">${esc(x.p.web_name)}</span>${lkSI(x.st.s)}
    ${dsFig(x.st.s==="tp"?"–":fmtPts(x.pts*Math.max(1,x.m)))}${x.lgd==null?`<span class="ds-sub">–</span>`:`<span class="bar4 ${x.lgd>=0?"up":"dn"}"><i style="width:${Math.min(100,Math.abs(Math.round(x.lgd)))}%"></i><em>${lkSg(Math.round(x.lgd))}%</em></span>`}
    ${dsFig(x.st.s==="tp"&&!x.pts?"–":sgn1(x.vf),x.vf>0.05?"up":x.vf<-0.05?"dn":"")}<span class="ds-fig rk4 ${x.rk>0.5?"up":x.rk<-0.5?"dn":""}">${Math.abs(x.rk)<0.5?"–":lkSg(x.rk,lkK)}</span></div>`;
  const ep=L.edge.filter(x=>x.vf>0).reduce((a,x)=>a+x.vf,0),tp=L.threats.reduce((a,x)=>a+x.vf,0),v=ET==="edge"?ep:tp;
  const list=ET==="edge"?L.edge:L.threats;
  const et=`<div class="lv4-blk lvm-et"><div class="lvm-h">${tg(ET,[["edge","Your edge","lke"],["threats","Threats","lke"]])}<b class="ds-fig ${ET==="edge"?"up":"dn"}" title="Points against the field">${sgn1(v)}</b><b class="ds-fig ${ET==="edge"?"up":"dn"}" title="Ranks against the field">${lkSg(v*L.rpp,lkK)}</b><span class="sp">${tg(L.filt,F)}</span></div>
    ${eh}<div class="fd-list">${list.map(er).join("")||`<p class="ds-sub">${ET==="edge"?"No edge yet":"No threats against this field"}</p>`}</div></div>`;
  return `<div class="panel pv-rev lv4">${pnlHead("activity","Live","")}<div class="lv4-sc lvm">${league}${feed}${et}</div></div>`;
}
/* ---------- Rank and Match Centre, under the Planner ---------- */
function lkRankHTML(g){
  const L=lkCalc(g);if(!L)return "";
  const N=(S.tracker&&S.tracker.totalPlayers)||null,ch=L.oldRank&&L.liveRank?L.oldRank-L.liveRank:null;
  const off=r=>{const t=lkTotalAt(r,g);return t==null?"—":String(Math.max(0,Math.round(t-L.total)));};
  const sp=L.post.subs.length?L.post.pts-L.pre:0,bench=L.picks.filter(k=>k.m===0).reduce((a,k)=>a+L.pts(k.id),0);
  const hero=`<div class="rk4-hero"><div><span class="ds-sub">Live rank</span><b class="rk4-big">${L.liveRank?L.liveRank.toLocaleString():"—"}</b></div>
    <span class="rk4-chg${ch!=null&&ch<0?" dn":""}">${lic(ch!=null&&ch<0?"circle-arrow-down":"circle-arrow-up",16)}<b class="ds-fig ${ch!=null&&ch<0?"dn":"up"}">${ch==null?"—":Math.abs(ch).toLocaleString()}</b><span class="ds-sub">${ch!=null&&L.oldRank?`${(Math.abs(ch)/L.oldRank*100).toFixed(1)}% from ${L.oldRank.toLocaleString()}`:""}</span></span>
    <div class="rk4-ga"><span class="ds-sub">Green arrow</span><b class="ds-fig ${L.arrow!=null&&L.arrow<0?"dn":"up"}">${L.arrow==null?"—":lkSg(Math.round(L.arrow))+" pts"}</b><span class="ds-sub">safety ${L.safety??"—"}</span></div></div>`;
  const ptsT=`<div><div class="rk4-gh"><span>Points</span>${dsFig(sgn1(L.vsField),L.vsField>=0?"up":"dn")}<span class="ds-sub">against the field</span></div>
    <div class="ds-tiles c3">${dsTile("GW live",fmtPts(L.pre))}${dsTile("Total",String(Math.round(L.total)))}${dsTile("Bench",fmtPts(bench))}${dsTile("Safety",L.safety??"—")}${dsTile("Off top 10k",off(1e4))}${dsTile("Off 200k",off(2e5))}</div></div>`;
  const rnT=`<div><div class="rk4-gh"><span>Ranks</span>${dsFig(ch==null?"—":lkSg(ch,x=>x.toLocaleString()),ch!=null&&ch<0?"dn":"up")}<span class="ds-sub">this week</span></div>
    <div class="ds-tiles c3">${dsTile("Pre-subs",L.liveRank?L.liveRank.toLocaleString():"—")}${dsTile("Old rank",L.oldRank?L.oldRank.toLocaleString():"—")}${dsTile("Change",ch!=null&&L.oldRank?lkSg(+(ch/L.oldRank*100).toFixed(1))+"%":"—",null,ch!=null&&ch<0?"dn":"up")}
      ${dsTile("Post-subs",L.postRank?L.postRank.toLocaleString():"—",sp?`${sgn1(sp)} from subs`:null)}${dsTile("GW rank",L.gwRank?L.gwRank.toLocaleString():"—")}${dsTile("Rank",L.liveRank&&N?`Top ${(L.liveRank/N*100).toFixed(1)}%`:"—")}</div></div>`;
  /* benchmarks: you against the two field samples, on this week's live points */
  const capPts=k=>k?L.pts(k.id):0,myCap=L.picks.find(k=>k.isC);
  const col=f=>{const x=L.fs(f);if(!x)return null;let cp=0;for(const id in (x.cap||{}))cp+=x.cap[id]/100*L.pts(id);const a=x.avg||{};
    return[L.fieldScore(f),cp,a.value,a.transfers,a.hits];};
  const nr=col("near"),tk=col("top10k"),f1=v=>v==null?"—":(+v).toFixed(1);
  const BM=[["Score",fmtPts(L.pre),nr&&f1(nr[0]),tk&&f1(tk[0])],["Captain points",fmtPts(capPts(myCap)),nr&&f1(nr[1]),tk&&f1(tk[1])],
    ["Team value",L.row.value!=null?"£"+(+L.row.value).toFixed(1)+"m":"—",nr&&nr[2]!=null?"£"+(+nr[2]).toFixed(1)+"m":"—",tk&&tk[2]!=null?"£"+(+tk[2]).toFixed(1)+"m":"—"],
    ["Transfers",String(L.row.transfers||0),nr&&f1(nr[3]),tk&&f1(tk[3])],["Hits",String(L.cost),nr&&f1(nr[4]),tk&&f1(tk[4])]];
  const bm=`<div class="bm4"><div class="bm4-r bm4-h ds-th"><span></span><span class="me">You</span><span>Near you</span><span>Top 10k</span></div>
    ${BM.map(([l,...v])=>`<div class="bm4-r"><span class="ds-sub bm4-l">${l}</span>${v.map((x,i)=>`<span class="${i===0?"me":""}">${dsFig(x||"—",i===0?"up":"")}</span>`).join("")}</div>`).join("")}</div>`;
  /* template rating: how much of your XI the top 10k also owns, line by line */
  const own=(L.fs("top10k")||L.fs("near")||{}).own||{},xi=L.picks.slice(0,11).filter(k=>k.p);
  const lines=[[1,"Goalkeeper"],[2,"Defence"],[3,"Midfield"],[4,"Attack"]].map(([q,n])=>{const l=xi.filter(k=>k.p.pos===q);return[n,l.length?Math.round(l.reduce((a,k)=>a+Math.min(100,own[k.id]||0),0)/l.length):0];});
  const tmpl=xi.length?Math.round(xi.reduce((a,k)=>a+Math.min(100,own[k.id]||0),0)/xi.length):0;
  const tl=tmpl>=70?"template":tmpl>=45?"moderately differential":"differential";
  const tr=`<div class="tr4"><div class="rk4-gh"><span>Template rating</span>${dsFig(tmpl+"%")}<span class="tr4-l">${tl}</span></div>
    ${lines.map(([l,v])=>`<div class="tr4-r"><span class="ds-sub">${l}</span><span class="tr4-b"><i style="width:${v}%"></i></span>${dsFig(v+"%")}</div>`).join("")}</div>`;
  /* star, flop and killer */
  const pl=L.edge.filter(x=>x.st.s!=="tp"&&x.st.s!=="bl");
  const star=pl.slice().sort((a,b)=>b.vf-a.vf)[0];
  const flop=pl.map(x=>{const sp=pastPred(x.p,g);return{...x,d:x.pts*x.m-(sp?sp.v*x.m:0)};}).sort((a,b)=>a.d-b.d)[0];
  const killer=L.threats[0];
  const sfk=(lab,cls,x)=>x?`<div class="sf4 ${cls}"><em>${lab}</em>${dsFace(x.p,"sf4-ph")}<span class="ds-name">${esc(x.p.web_name)}</span><span class="sf4-v"><span class="ds-sub">${fmtPts(x.pts*Math.max(1,x.m))} pts</span>${dsFig(sgn1(x.vf),x.vf>=0?"up":"dn")}</span></div>`:`<div class="sf4 ${cls}"><em>${lab}</em><span class="ds-sub">—</span></div>`;
  return `<section class="panel card4 lk-rank">${dsHead("trending-up","Rank",`<span class="ds-sub">GW${g} · live</span>`)}${hero}
    <div class="rk4-two">${ptsT}${rnT}</div>${bm}<div class="rk4-two">${tr}<div class="sf4s">${sfk("Star","st",star)}${sfk("Flop","fl",flop)}${sfk("Killer","kl",killer)}</div></div></section>`;
}
function lkCentreHTML(g){
  const L=lkCalc(g);if(!L)return "";
  const W=L.W,T=id=>(S.model.teams||[]).find(t=>t.id===id)||{},mode=S.mcM==="table"?"table":"matches";
  const sw=`<span class="hz"><button class="${mode==="matches"?"on":""}" onclick="act('mcm','matches')">Matches</button><button class="${mode==="table"?"on":""}" onclick="act('mcm','table')">Table</button></span>`;
  let body="";
  if(mode==="matches"){
    const rank=f=>f.started&&!f.done&&!f.fp?0:f.started?1:2;
    const fx=W.fixtures.slice().sort((a,b)=>rank(a)-rank(b)||(rank(a)===1?String(b.ko).localeCompare(String(a.ko)):String(a.ko).localeCompare(String(b.ko))));
    const mine=new Map(L.picks.map(k=>[k.id,k]));
    {const f=fx.find(f=>rank(f)===0&&L.picks.some(k=>k.p&&(k.p.team===f.h||k.p.team===f.a)));S._mcAuto=f?f.id:0;}
    const openId=S.mcOpen==null?S._mcAuto:S.mcOpen;
    const nm=id=>{const p=L.P(id);return p?esc(p.web_name):"?";};
    const pr=(el,v,o)=>{const p=L.P(el);o=o||{};return `<span class="pr5${mine.has(+el)?" me":""}">${dsFace(p,"pr5-f")}<span class="ds-name">${nm(el)}</span>${v!=null?`<b class="ds-fig${o.cls?" "+o.cls:""}">${v}</b>`:""}</span>`;};
    const side=l=>l.length?l.join(""):`<span class="pr5-none">–</span>`;
    const evl=(f,k)=>{const out=[];[["goals_scored","g"],["assists","a"],["own_goals","og"]].forEach(([s,ic])=>((f.st&&f.st[s]&&f.st[s][k])||[]).forEach(([el,n])=>out.push(`<span class="${ic==="a"?"a":""}">${EV_ICON[ic]}${nm(el)}${n>1?` <i>×${n}</i>`:""}</span>`)));return `<span class="sc5 ${k}">${out.join("")}</span>`;};
    /* the open match (28 Nov 2026, Andy approved the mock): three bands -
       your players; goals, assists and cards; BPS with the bonus as a badge,
       DefCon and saves - with players as chips side by side */
    const chip=(el,v,o)=>{const p=L.P(el);o=o||{};return `<span class="cp${mine.has(+el)?" me":""}${o.c?" "+o.c:""}">${o.ev?`<span class="ev">${o.ev}</span>`:""}${dsFace(p)}<span>${nm(el)}</span>${v!=null?`<b class="${o.cls||""}">${v}</b>`:""}${o.bn?`<span class="bn" title="Bonus${o.prov?", provisional":""}">+${o.bn}</span>`:""}</span>`;};
    const open=f=>{const st=f.st||{},list=(s,k)=>(st[s]&&st[s][k])||[],team=k=>k==="h"?f.h:f.a;
      const ours=k=>L.picks.filter(x=>x.p&&x.p.team===team(k)).map(x=>`<span class="cp me">${dsFace(x.p)}<span>${esc(x.p.web_name)}</span><b>${fmtPts(L.pts(x.id)*Math.max(1,x.m))}</b></span>`);
      const pv=L.provFx[f.id],bonusOf=k=>{const m={};if(pv)Object.entries(pv).forEach(([el,v])=>{const p=L.P(el);if(p&&p.team===team(k))m[el]=v;});else list("bonus",k).forEach(([el,v])=>m[el]=v);return m;};
      /* 29 Nov 2026: each goal with its assist on one chip. FPL never links
         them; the Feed does when both land in the same minute's check (an
         untimed pair counts only when the team has one goal and one assist) */
      const feedFx=((L.W&&L.W.feed)||[]).filter(e=>e.fx===f.id);
      const scoring=k=>{
        const mineT=el=>{const p=L.P(el);return p&&p.team===team(k);};
        const goals=[],asts=[];
        list("goals_scored",k).forEach(([el,n])=>{for(let i=0;i<n;i++)goals.push({el:+el});});
        list("assists",k).forEach(([el,n])=>{for(let i=0;i<n;i++)asts.push({el:+el});});
        const fe=feedFx.filter(e=>mineT(e.el));
        const take=(arr,el)=>{const i=arr.findIndex(x=>x.el===+el&&!x.used);if(i>=0)arr[i].used=1;return i>=0;};
        const pairs=[];
        fe.filter(e=>e.k==="goals_scored"&&e.dv>0).forEach(g=>{for(let i=0;i<g.dv;i++){if(!take(goals,g.el))return;
          const a=fe.find(x=>x.k==="assists"&&x.dv>0&&x.t===g.t&&!x._u);let ael=null;
          if(a&&g.t!=null&&take(asts,a.el)){ael=a.el;a._u=1;}
          pairs.push({g:g.el,a:ael});}});
        goals.filter(x=>!x.used).forEach(x=>{x.used=1;pairs.push({g:x.el,a:null});});
        const left=asts.filter(x=>!x.used);
        if(pairs.filter(p=>!p.a).length===1&&left.length===1){pairs.find(p=>!p.a).a=left[0].el;left[0].used=1;}
        const gChip=p=>`<span class="cp gp${mine.has(+p.g)||mine.has(+p.a)?" me":""}"><span class="ev">${EV_ICON.g}</span>${dsFace(L.P(p.g))}<span>${nm(p.g)}</span>${p.a!=null?`<span class="ev ast">${EV_ICON.a}</span><span class="as">${nm(p.a)}</span>`:""}</span>`;
        return [...pairs.map(gChip),...list("own_goals",k).map(([el])=>chip(el,"OG",{ev:EV_ICON.og,cls:"dn"})),...asts.filter(x=>!x.used).map(x=>chip(x.el,null,{ev:EV_ICON.a,c:"ast"}))];};
      const cards=k=>[...list("yellow_cards",k).map(([el])=>chip(el,null,{ev:EV_ICON.card("#FFD23F")})),...list("red_cards",k).map(([el])=>chip(el,null,{ev:EV_ICON.card("#FF5A6E")}))];
      const bps=k=>{const bn=bonusOf(k),top=list("bps",k).slice().sort((a,b)=>b[1]-a[1]).slice(0,3),ids=new Set(top.map(x=>String(x[0])));
        Object.keys(bn).forEach(el=>{if(!ids.has(String(el))){const r=list("bps",k).find(x=>String(x[0])===String(el));top.push([+el,r?r[1]:null]);}});
        return top.sort((a,b)=>(bn[b[0]]||0)-(bn[a[0]]||0)||(b[1]||0)-(a[1]||0)).map(([el,v])=>chip(el,v,{bn:bn[el],prov:!!pv}));};
      const dc=k=>list("defensive_contribution",k).map(([el,v])=>({el,v,t:lkDcT((L.P(el)||{}).pos)})).filter(x=>x.t&&x.v>=x.t-4).sort((a,b)=>b.v/b.t-a.v/a.t).slice(0,3).map(x=>chip(x.el,`${x.v}/${x.t}`,{cls:x.v>=x.t?"up":"dc"}));
      const saves=k=>list("saves",k).slice().sort((a,b)=>b[1]-a[1]).slice(0,2).map(([el,v])=>chip(el,v));
      const none=`<span class="cx-none">–</span>`;
      const row=(lbl,ic,fn,tag,always,cls)=>{const h=fn("h"),a=fn("a");return h.length||a.length||always?`<div class="cx-r${cls?" "+cls:""}"><div class="h">${h.join("")||none}</div><span class="cx-l">${ic}${lbl}${tag?`<i>${tag}</i>`:""}</span><div class="a">${a.join("")||none}</div></div>`:"";};
      const oh=ours("h"),oa=ours("a");
      const band=x=>x?`<div class="cx-sec">${x}</div>`:"";
      const b1=oh.length||oa.length?`<div class="cx-sec cx-mine"><div class="cx-r"><div class="h">${oh.join("")||none}</div><span class="cx-l">${lic("shirt",13)}Your players</span><div class="a">${oa.join("")||none}</div></div></div>`:"";
      const b2=band(row("Goals · Assists",EV_ICON.g,scoring,"",false,"stk")+row("Cards",EV_ICON.card("#FFD23F"),cards));
      /* a finished match: only the players who earned the points, each marked */
      const done=f.done||f.fp;
      const bonusOnly=k=>Object.entries(bonusOf(k)).sort((a,b)=>b[1]-a[1]).map(([el,v])=>chip(el,null,{bn:v,prov:!!pv}));
      const dcHit=k=>list("defensive_contribution",k).map(([el,v])=>({el,v,t:lkDcT((L.P(el)||{}).pos)})).filter(x=>x.t&&x.v>=x.t).sort((a,b)=>b.v-a.v).map(x=>chip(x.el,`${x.v}/${x.t}`,{cls:"up",bn:2,c:"dcp"}));
      const svHit=k=>list("saves",k).filter(([,v])=>v>=3).sort((a,b)=>b[1]-a[1]).map(([el,v])=>chip(el,v,{bn:Math.floor(v/3),c:"svp"}));
      const b3=done?band(row("Bonus",EV_ICON.b,bonusOnly,pv?"prov.":"")+row("DefCon",EV_ICON.dc,dcHit)+row("Save points",EV_ICON.sv||EV_ICON.b,svHit))
        :band(row("BPS · Bonus",EV_ICON.b,bps,pv?"prov.":"")+row("DefCon",EV_ICON.dc,dc)+row("Saves",EV_ICON.sv||EV_ICON.b,saves));
      return `<div class="cx">${b1}${b2}${b3}${b2||b3?"":`<p class="ds-sub" style="text-align:center">No match stats yet</p>`}</div>`;};
    body=`<div class="m4s mc5-s">${fx.map(f=>{const lv=rank(f)===0,ft=rank(f)===1,o=openId===f.id,h=T(f.h),a=T(f.a);
      const ev=f.started&&f.st&&((f.st.goals_scored&&((f.st.goals_scored.h||[]).length||(f.st.goals_scored.a||[]).length))||(f.st.own_goals&&((f.st.own_goals.h||[]).length||(f.st.own_goals.a||[]).length)));
      return `<div class="m4${o?" open":""}${lv?" lv":""}"><div class="m5-r" role="button" tabindex="0" aria-expanded="${o}" onclick="act('mco',${f.id})" onkeydown="if(event.key==='Enter')act('mco',${f.id})">
        <span class="m4-t h"><span class="ds-name">${esc(h.name||h.short||"")}</span>${dsBadge(h,30)}</span>
        <span class="m4-sc ${ft?"ft":lv?"lv":"tp"}"><b>${f.started?`${f.hs??0} – ${f.as??0}`:lkKo(f.ko).split(" ")[1]||"TBC"}</b><i>${f.started?(ft?(f.done?"Full time":"Full time · prov."):`${f.min||0}′`):lkKo(f.ko).split(" ")[0]}</i></span>
        <span class="m4-t a">${dsBadge(a,30)}<span class="ds-name">${esc(a.name||a.short||"")}</span></span>${lic(o?"chevron-up":"chevron-down",15)}</div>
        ${ev&&!o?`<div class="m5-ev">${evl(f,"h")}<span></span>${evl(f,"a")}<span></span></div>`:""}${o?open(f):""}</div>`;}).join("")}</div>`;
  }else{
    /* the Premier League table with this week's scores as they stand */
    const tb={};(S.model.teams||[]).forEach(t=>tb[t.id]={t,p:0,gf:0,ga:0,n:0,on:false});
    const add=(h,a,hs,as)=>{const H=tb[h],A=tb[a];if(!H||!A)return;H.n++;A.n++;H.gf+=hs;H.ga+=as;A.gf+=as;A.ga+=hs;if(hs>as)H.p+=3;else if(hs<as)A.p+=3;else{H.p++;A.p++;}};
    tgPlayed().filter(f=>f.event!==g).forEach(f=>add(f.ht.id,f.at.id,f.hs,f.as));
    const before=Object.values(tb).map(x=>({id:x.t.id,p:x.p,gd:x.gf-x.ga,gf:x.gf})).sort((a,b)=>b.p-a.p||b.gd-a.gd||b.gf-a.gf),was={};before.forEach((x,i)=>was[x.id]=i+1);
    W.fixtures.filter(f=>f.started&&f.hs!=null).forEach(f=>{add(f.h,f.a,f.hs,f.as);if(!f.done&&!f.fp){tb[f.h]&&(tb[f.h].on=true);tb[f.a]&&(tb[f.a].on=true);}});
    const list=Object.values(tb).sort((a,b)=>b.p-a.p||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf);
    body=`<div class="mc5-s lk-tb"><div class="lk-tr lk-th ds-th"><span>#</span><span></span><span>Team</span><span>P</span><span>GD</span><span>Pts</span></div>
      ${list.map((x,i)=>{const mv=(was[x.t.id]||i+1)-(i+1);return `<div class="lk-tr${x.on?" on":""}"><span class="ds-fig">${i+1}</span><span class="lk-mv ${mv>0?"up":mv<0?"dn":""}">${mv>0?"▲":mv<0?"▼":""}</span>
        <span class="lk-tn">${dsBadge(x.t,22)}<span class="ds-name">${esc(x.t.name||x.t.short)}</span>${x.on?`<span class="lp-dot" title="Playing now"></span>`:""}</span>${dsFig(x.n)}${dsFig(lkSg(x.gf-x.ga))}${dsFig(x.p)}</div>`;}).join("")}</div>`;
  }
  return `<section class="panel card4 mc5">${dsHead("calendar","Match Centre",sw)}${body}</section>`;
}
const lkLowerHTML=g=>lkCalc(g)?`<section class="lv4-sec">${lkRankHTML(g)}${lkCentreHTML(g)}</section>`:"";
/* ---------- head to head ---------- */
function lkSide(L,x,g){
  const W=L.W,mine=x.mine,pk=x.picks.map((k,i)=>({id:k.id,p:L.P(k.id),m:k.multiplier!=null?k.multiplier:(i<11?1:0),isC:!!k.isC,isVC:!!k.isVC,i}));
  const counted=pk.filter(k=>k.m>0),pr=k=>{const sp=k.p&&pastPred(k.p,g);return sp?sp.v:0;};
  const exp=x.live+counted.reduce((a,k)=>{const s=L.status(k.id);return a+(s.s==="tp"?pr(k)*k.m:s.s==="in"?Math.max(0,pr(k)-2)*Math.max(0,90-(s.min||0))/90*k.m:0);},0);
  const hold=x.oldRank?lkTotalAt(x.oldRank,g):null,safety=hold!=null?Math.round(hold-x.before):null;
  /* transfers: this week's squad against last week's */
  const ents=(S.rivalsFeed&&S.rivalsFeed.entries)||{},e=ents[x.id]||{},prev=mine?(((S.tracker&&S.tracker.gw)||[]).find(r=>r.event===g-1)||{}).picks:((e.gw||[]).find(r=>r.event===g-1)||{}).picks;
  let ins=[],outs=[];
  if(prev&&prev.length){const was=new Set(prev.map(k=>k.id)),now=new Set(pk.map(k=>k.id));ins=pk.filter(k=>!was.has(k.id)).map(k=>L.P(k.id)).filter(Boolean);outs=prev.filter(k=>!now.has(k.id)).map(k=>L.P(k.id)).filter(Boolean);}
  const n=mine?(L.row.transfers||0):((x.row&&x.row.transfers)||0);
  return{...x,pk,exp,safety,ins,outs,n};
}
function lkH2hHTML(){
  const g=liveGW()||VG(),L=lkCalc(g);
  if(!L||!L.league.length)return modalHTML("Head to head",`<p class="note">The league's picks for this week are not in yet.</p>`,{icon:lic("swords",18)});
  const meX=L.league.find(x=>x.mine),rivals=L.league.filter(x=>!x.mine);
  const them=rivals.find(x=>x.id===String(S.h2h))||rivals.slice().sort((a,b)=>Math.abs(a.total-(meX?meX.total:0))-Math.abs(b.total-(meX?meX.total:0)))[0];
  if(!meX||!them)return modalHTML("Head to head",`<p class="note">No rival to compare with.</p>`,{icon:lic("swords",18)});
  const A=lkSide(L,meX,g),B=lkSide(L,them,g),first=s=>esc(String(s||"").split(" ")[0]||"them");
  const idsOf=s=>new Set(s.pk.map(k=>k.id)),aIds=idsOf(A),bIds=idsOf(B);
  const view=S.h2hV==="pitch"?"pitch":"list";
  const pctFor=(s,id)=>{const n=L.nLg-1;if(n<=0)return null;const own=s.pk.some(k=>k.id===id&&k.m>0)?1:0;return ((L.starts[id]||0)-own)/n*100;};
  const ptsOf=k=>L.pts(k.id)*(k.m||1);
  const head=(s,other)=>{const live=s.rank,mv=s.oldRank&&live?(live<s.oldRank?"up":live>s.oldRank?"dn":""):"",open=S.h2hT===s.id;
    const cost=s.mine?L.cost:s.cost,diff=s.ins.reduce((a,p)=>a+L.pts(p.id),0)-s.outs.reduce((a,p)=>a+L.pts(p.id),0);
    return `<div class="hh-h"><div class="hh-id"><b>${esc(s.name)}</b><i>${esc(s.manager)}</i></div></div>
    <div class="ds-tiles hh-tl">${dsTile("GW net",fmtPts(s.live),null,"big")}${dsTile("Expected",String(Math.round(s.exp)))}${dsTile("Safety",s.safety??"—",s.safety!=null?`${lkSg(Math.round(s.live-s.safety))} margin`:null,s.safety!=null?(s.live>=s.safety?"up":"dn"):"")}
      ${dsTile("Live rank",live?live.toLocaleString():"—",mv==="up"?"▲ rising":mv==="dn"?"▼ falling":null,mv)}${dsTile("Total",fmtPts(s.total))}
      <button class="ds-tile hh-tr${open?" on":""}" onclick="act('h2ht','${s.id}')" aria-expanded="${open}"><em>Transfers ${lic(open?"chevron-up":"chevron-down",11)}</em><b>${s.n}</b><i>${cost?`−${cost} hit`:"0 hits"}</i></button></div>
    ${open?`<div class="hh-trx">${s.outs.length?s.outs.map((o,i)=>{const n=s.ins[i];return `<div class="hh-tx">${dsFace(o,"hh-k")}<s>${esc(o.web_name)}</s><b>${fmtPts(L.pts(o.id))}</b>${lic("arrow-right",13)}${n?`${dsFace(n,"hh-k")}<span>${esc(n.web_name)}</span><b>${fmtPts(L.pts(n.id))}</b><b class="${L.pts(n.id)-L.pts(o.id)>=0?"up":"dn"}">${sgn1(L.pts(n.id)-L.pts(o.id)).replace(".0","")}</b>`:"<span></span><span></span><b></b><b></b>"}</div>`;}).join(""):`<span class="ds-sub">No transfers this week</span>`}
      <div class="hh-txs"><span>Cost <b>${cost}</b></span><span>Points difference <b class="${diff-cost>=0?"up":"dn"}">${lkSg(Math.round(diff-cost))}</b></span></div></div>`:""}`;};
  const row=(s,other)=>k=>{const p=k.p;if(!p)return "";const st=L.status(k.id),pc=pctFor(s,k.id),lgd=pc==null?null:(k.m>0?100:0)-pc,only=!other.has(k.id);
    const ws=L.W.players[k.id];let ev=evRowHTML(p,ws&&!['dn','dnp'].includes(st.s)?{...ws,m:null}:ws);const pb=L.prov[k.id];if(pb)ev+=`<span class="pv-ev pv-prov" style="--ec:#FFB020" title="Provisional bonus">${EV_ICON.b}<i>${pb}</i></span>`;
    const mins=st.s==="tp"?lkKo(st.ko):st.s==="bl"?"–":`${(L.W.players[k.id]||{}).m||0}′`;
    return `<div class="hl-r${only?" only":""}${k.i>=11?" b":""}">${dsFace(p,"hl-f")}<span class="hl-n"><b>${esc(p.web_name)}</b>${k.isC?`<span class="pz-cv">C</span>`:k.isVC?`<span class="pz-cv v">V</span>`:""}</span>${pastFxGW(p,g)}${lkSI(st.s)}
      <span class="hl-m${st.s==="in"?" in":""}">${mins}</span><span class="hl-e">${ev}</span><b class="hl-p">${st.s==="tp"?"–":fmtPts(ptsOf(k))}</b>
      ${lgd==null?`<span class="ds-sub">–</span>`:`<span class="ld-ib ${lgd>=0?"up":"dn"}"><i style="width:${Math.min(100,Math.abs(Math.round(lgd)))}%"></i><em>${lkSg(Math.round(lgd))}%</em></span>`}</div>`;};
  const th=`<div class="hl-h"><span></span><span>Player</span><span>Opp</span><span></span><span>Mins</span><span>Events</span><span>Pts</span><span>League</span></div>`;
  const pc=(s,other)=>k=>{const p=k.p;if(!p)return "";const st=L.status(k.id),pcv=pctFor(s,k.id),lgd=pcv==null?null:(k.m>0?100:0)-pcv;
    return `<div class="hp-c${!other.has(k.id)?" only":""}"><div class="hp-k">${kitHTML(p,"hp-kit")}${k.isC?`<span class="pz-cv hp-arm">C</span>`:k.isVC?`<span class="pz-cv v hp-arm">V</span>`:""}<span class="hp-st">${LK_SI[st.s]||""}</span></div>
      <div class="hp-n">${esc(p.web_name)}</div><div class="hp-b"><b>${st.s==="tp"?"–":fmtPts(ptsOf(k))}</b>${lgd==null?"":`<span class="${lgd>=0?"up":"dn"}">${lkSg(Math.round(lgd))}%</span>`}</div>
      <div class="hp-e">${evRowHTML(p,L.W.players[k.id]&&!["dn","dnp"].includes(st.s)?{...L.W.players[k.id],m:null}:L.W.players[k.id])}</div></div>`;};
  const sideHTML=(s,other)=>{const xi=s.pk.slice(0,11),bn=s.pk.slice(11);
    const body=view==="list"?`${th}${xi.map(row(s,other)).join("")}<div class="hh-sep">Bench</div>${bn.map(row(s,other)).join("")}`
      :`<div class="hp-pitch">${[1,2,3,4].map(q=>`<div class="hp-row">${xi.filter(k=>k.p&&k.p.pos===q).map(pc(s,other)).join("")}</div>`).join("")}<div class="hp-bench">${bn.map(pc(s,other)).join("")}</div></div>`;
    return `<section class="panel hh-side${s.mine?" me":""}">${head(s,other)}${body}</section>`;};
  /* the middle panel: the gap, who only one of you has, chips, still to play, season */
  const d=A.live-B.live,nmB=first(B.manager);
  const only=(s,other,sign)=>{const l=s.pk.filter(k=>k.p&&!other.has(k.id)).sort((a,b)=>(b.m>0)-(a.m>0)||ptsOf(b)-ptsOf(a));return l.slice(0,5).map(k=>{const v=k.m>0?ptsOf(k):null;
    return `<span><span class="hh-fc">${dsFace(k.p)}<b>${esc(k.p.web_name)}</b></span><i class="${v==null?"":v>0?(sign>0?"up":"dn"):""}">${v==null?"bench":(v>0?(sign>0?"+":"−"):"")+fmtPts(v)}</i></span>`;}).join("")+(l.length>5?`<span class="ds-sub">and ${l.length-5} more</span>`:"")||`<span class="ds-sub">None</span>`;};
  const left=s=>s.pk.filter(k=>k.m>0&&["tp","in"].includes(L.status(k.id).s)).map(k=>esc(k.p?k.p.web_name:"")).join(", ")||"None";
  const spine=`<section class="panel hh-sp"><div class="hh-big${d<0?" dn":""}"><em>Live</em><b class="${d>=0?"up":"dn"}">${lkSg(Math.round(d))}</b><i>${d>0?`you lead ${nmB} this week`:d<0?`${nmB} leads this week`:"level this week"}</i></div>
    <div class="hh-blk"><em>Only you have</em>${only(A,bIds,1)}</div>
    <div class="hh-blk"><em>Only ${nmB} has</em>${only(B,aIds,-1)}</div>
    <div class="hh-blk"><em>Chips</em><span class="hh-cr"><b>You</b>${dsChips(A.used,A.act)}</span><span class="hh-cr"><b>${nmB}</b>${dsChips(B.used,B.act)}</span></div>
    <div class="hh-blk"><em>Still to play</em><span><b>You</b><span class="hh-nm">${left(A)}</span></span><span><b>${nmB}</b><span class="hh-nm">${left(B)}</span></span></div>
    <div class="hh-blk"><em>Season</em><span><b>Total</b><i>${Math.round(A.total)} – ${Math.round(B.total)}</i></span><span><b>Gap</b><i class="${A.total>=B.total?"up":"dn"}">${lkSg(Math.round(A.total-B.total))}</i></span></div></section>`;
  const tog=`<span class="hz"><button class="${view==="list"?"on":""}" onclick="act('h2hv','list')">List</button><button class="${view==="pitch"?"on":""}" onclick="act('h2hv','pitch')">Pitch</button></span>`;
  const pick=`<label class="hh-pick">Against <select onchange="act('h2h',this.value)">${rivals.map(x=>`<option value="${x.id}"${x===them?" selected":""}>${esc(x.name)} · ${esc(x.manager)}</option>`).join("")}</select></label>`;
  return modalHTML(`Head to head · GW${g}`,`<div class="hh-g">${sideHTML(A,bIds)}${spine}${sideHTML(B,aIds)}</div>`,{icon:lic("swords",18),wide:true,cls:"tm",ctl:`${tog}<span class="tm-sp"></span>${pick}`});
}
const lkAgo=g=>{const t=S.wkAt&&S.wkAt[g];if(!t)return "now";const m=Math.floor((Date.now()-t)/60000);return m<1?"just now":m+" min ago";};
/* ---------- Your Week (22 Nov 2026, batch 6; Andy approved round 2, trimmed) ----------
   This Week: the predicted score with its likely range (a simulation), the
   chances of beating the average, the field and the league, you against
   the field, and the matches that matter. Last Week: what happened and why.
   "The field" is Near you / Top 10k / Overall / Rivals. Classes yw-. */
const YW_F=[["near","Near you"],["top10k","Top 10k"],["overall","Overall"],["rivals","Rivals"]];
const ywKind=()=>YW_F.some(([k])=>k===S.ywF)?S.ywF:"near";
/* effective ownership (captaincy counted) for one field; g picks the
   sample for a finished week, else the latest */
function ywEO(kind,g){
  if(kind==="overall"){const o={};S.model.players.forEach(p=>{if(p.owned>0)o[p.id]=p.owned;});return{eo:o,hits:0,label:"FPL ownership"};}
  if(kind==="rivals"){const ents=(S.rivalsFeed&&S.rivalsFeed.entries)||{},o={};let n=0;
    Object.keys(ents).filter(id=>String(id)!==String(TEAM_ID)).forEach(id=>{const rows=ents[id].gw||[],r=g?rows.find(x=>x.event===g):rows[rows.length-1];if(!r||!(r.picks||[]).length)return;n++;
      r.picks.forEach((k,i)=>{const m=k.multiplier!=null?k.multiplier:(i<11?1:0);if(m)o[k.id]=(o[k.id]||0)+m*100;});});
    Object.keys(o).forEach(id=>o[id]/=Math.max(1,n));return n?{eo:o,hits:0,label:`${n} rivals`}:null;}
  const F=S.field&&S.field.gws?(g!=null?S.field.gws[g]:S.field.gws[S.field.latest]):null,x=F&&F[kind];
  return x&&x.eo?{eo:x.eo,hits:(x.avg&&x.avg.hits)||0,cap:x.cap||{},label:kind==="near"?"near you":"top 10k",n:x.n}:null;
}
/* a seeded random source, so the figures hold still between repaints */
function ywRng(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
/* The score simulation: each player's points are drawn from his own season
   (every gameweek, blanks and benchings included), scaled so their average is
   this week's prediction; one draw per player per run, shared by everyone
   who owns him. A player with under five weeks of history, or none that
   scored, draws from a spread around his prediction instead. */
let _ywSim={k:null,v:null};
function ywSim(g){
  const next=S.model.next.id,xi=startingXI(),sp=squadPlayers(),chip=chipForWeek(g),cv=effectiveCaptainVice(g);
  const ents=(S.rivalsFeed&&S.rivalsFeed.entries)||{};
  const key=JSON.stringify([g,S.squad,S.captain,S.vice,S.benchOrder,S.forceXI,S.chips,S.planByGw&&S.planByGw[g],S.model.players.length,S.oddsFetchedAt,!!S.rivalsFeed]);
  if(_ywSim.k===key)return _ywSim.v;
  const mult=p=>!xi.includes(p)?(chip==="bboost"?1:0):p.id===cv.captain?(chip==="3xc"?3:2):1;
  const me=sp.map(p=>({p,m:mult(p)}));
  const rivals=Object.keys(ents).filter(id=>String(id)!==String(TEAM_ID)).map(id=>{const rows=ents[id].gw||[],r=rows[rows.length-1];
    return r&&(r.picks||[]).length?{id,name:ents[id].name||"",list:r.picks.map((k,i)=>({id:k.id,m:k.multiplier!=null?k.multiplier:(i<11?1:0)})).filter(x=>x.m>0)}:null;}).filter(Boolean);
  const ids=new Set([...me.filter(x=>x.m>0).map(x=>x.p.id),...rivals.flatMap(r=>r.list.map(x=>x.id))]);
  const PM=new Map(S.model.players.map(p=>[p.id,p])),A=S.playerActuals||{},rnd=ywRng(g*7919+(TEAM_ID|0));
  const gauss=()=>{let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
  const draws={};
  ids.forEach(id=>{const p=PM.get(id);if(!p)return;const mu=hPts(p,g,1),h=A[id]||A[String(id)]||{};
    const hist=Object.keys(h).filter(e=>+e<next).map(e=>+h[e]||0),hm=hist.length?hist.reduce((a,b)=>a+b,0)/hist.length:0;
    draws[id]=hist.length>=5&&hm>0.3?()=>hist[Math.floor(rnd()*hist.length)]*mu/hm:()=>Math.max(0,mu+Math.max(1.5,0.9*mu)*gauss());});
  const xiMean=me.reduce((a,x)=>a+hPts(x.p,g,1)*x.m,0),mean=weekPtsFor(g,1),shift=mean-xiMean;
  const N=2000,mine=new Float64Array(N);let top=0;
  const pr=rivals.map(()=>new Float64Array(N));
  for(let s=0;s<N;s++){const d={};ids.forEach(id=>{if(draws[id])d[id]=draws[id]();});
    let t=shift;me.forEach(x=>{if(x.m)t+=(d[x.p.id]||0)*x.m;});mine[s]=t;
    let best=-1;rivals.forEach((r,j)=>{let u=0;r.list.forEach(x=>{u+=(d[x.id]||0)*x.m;});pr[j][s]=u;if(u>best)best=u;});
    if(t>=best)top++;}
  const sorted=Array.from(mine).sort((a,b)=>a-b),q=f=>sorted[Math.min(N-1,Math.floor(f*N))];
  const v={g,N,mine,sorted,mean,lo:q(0.1),hi:q(0.9),pTop:rivals.length?top/N:null,nRiv:rivals.length,me,mult,
    above:t=>{let n=0;for(let s=0;s<N;s++)if(mine[s]>t)n++;return n/N;}};
  _ywSim={k:key,v};return v;
}
/* the field's predicted score for the week */
function ywFieldMean(F,g){if(!F)return null;let s=0;const PM=twMap();for(const id in F.eo){const p=PM.get(+id);if(p)s+=F.eo[id]/100*hPts(p,g,1);}return s-(F.hits||0);}
/* FPL's average over the last five finished weeks */
function ywAvgBench(){const ev=(S.events||[]).filter(e=>e.finished&&e.avg).slice(-5);return ev.length?ev.reduce((a,e)=>a+e.avg,0)/ev.length:null;}
/* one diverging row: you against the field */
function ywRow(p,you,fld,pts,cap,bench){
  const gap=you-fld,vf=gap/100*pts,w=Math.min(50,Math.abs(gap)/4);
  return `<div class="yw-r${bench?" b":""}">${dsFace(p)}<span class="yw-n"><b class="ds-name">${esc(p.web_name)}${cap?` <span class="pz-cv">C</span>`:""}</b><span class="ds-sub">you ${Math.round(you)}% · field ${Math.round(fld)}%</span></span>
    <span class="yw-bar"><i class="${gap>=0?"up":"dn"}" style="width:${w}%;${gap>=0?"left:50%":"right:50%"}"></i></span>${dsFig(fmtPts(+pts.toFixed(1)))}${dsFig(sgn1(vf),vf>=0.05?"up":vf<=-0.05?"dn":"")}</div>`;
}
function ywTabs(T){return twTabs([["week","This Week"],["last","Last Week"]],T);}
function yourWeekHTML(){
  const T=S.popTab==="last"?"last":"week",kind=ywKind();
  const fsw=`<span class="hz ds-hz" role="group" aria-label="Field">${YW_F.map(([k,n])=>`<button class="${kind===k?"on":""}" onclick="act('ywf','${k}')">${n}</button>`).join("")}</span>`;
  const keep=S.startGW,next=S.model.next.id;let body;
  try{if(T!=="last"&&VG()<next)S.startGW=next;body=T==="last"?ywLastHTML(kind):ywThisHTML(kind);}finally{S.startGW=keep;}
  return modalHTML("Your Week",body.html,{wide:true,cls:"tw yw",icon:lic("gauge",18),ctl:ywTabs(T)+`<span class="tw-sp"></span><span class="tw-ft">${body.right}</span>${fsw}`});
}
function ywThisHTML(kind){
  const g=VG(),xi=startingXI();
  if(!xi.length||g<S.model.next.id)return{html:`<p class="note">Your Week covers the next deadline.</p>`,right:""};
  const Sm=ywSim(g),F=ywEO(kind),fm=ywFieldMean(F,g),avg=ywAvgBench(),PM=twMap(),cv=effectiveCaptainVice(g);
  const ev=(S.events||[]).find(e=>e.id===g),dl=ev&&ev.deadline?new Date(ev.deadline):null;
  const right=`GW${g}${dl&&!isNaN(dl)?" · deadline "+dl.toLocaleString("en-GB",{timeZone:"Europe/London",weekday:"short",hour:"2-digit",minute:"2-digit"}).replace(",",""):""}`;
  /* the distribution: bars of 4 points, the likely range bright */
  const lo=Math.floor(Sm.sorted[0]/4)*4,hi=Math.ceil(Sm.sorted[Sm.N-1]/4)*4,bins=[];for(let b=lo;b<hi;b+=4)bins.push([b,0]);
  Sm.sorted.forEach(v=>{const i=Math.min(bins.length-1,Math.floor((v-lo)/4));if(i>=0)bins[i][1]++;});
  const mx=Math.max(1,...bins.map(b=>b[1])),Wd=470,H=300,pl=8,pb=22,pt=50,x=v=>pl+(v-lo)/Math.max(1,hi-lo)*(Wd-2*pl),y=v=>pt+(H-pt-pb)*(1-v/mx);
  let svg=bins.map(([b,n])=>{const inR=b+4>Sm.lo&&b<Sm.hi;return `<rect x="${(x(b)+1).toFixed(1)}" y="${y(n).toFixed(1)}" width="${Math.max(1,x(b+4)-x(b)-2).toFixed(1)}" height="${(y(0)-y(n)).toFixed(1)}" rx="2" fill="${inR?"#3DDC97":"#245A40"}" opacity="${inR?.85:.6}"/>`;}).join("");
  const mark=(v,label,col,row)=>v==null||v<lo||v>hi?"":`<line x1="${x(v).toFixed(1)}" x2="${x(v).toFixed(1)}" y1="${pt-6}" y2="${y(0)}" stroke="${col}" stroke-width="1.5" stroke-dasharray="${col==="#fff"?"":"3 3"}"/><text x="${x(v).toFixed(1)}" y="${pt-10-row*11}" text-anchor="middle" class="yw-mk" fill="${col}">${label} ${Math.round(v)}</text>`;
  svg+=mark(avg,"Average","#9A9A9A",2)+mark(fm,"Field","#B388FF",1)+mark(Sm.mean,"You","#fff",0);
  for(let v=Math.ceil(lo/20)*20;v<=hi;v+=20)svg+=`<text x="${x(v).toFixed(1)}" y="${H-6}" text-anchor="middle" class="cax">${v}</text>`;
  const pct=v=>v==null?"—":Math.round(v*100)+"%";
  const bench=Sm.me.filter(x=>!xi.includes(x.p)).reduce((a,x)=>a+hPts(x.p,g,1),0),bb=chipForWeek(g)==="bboost";
  const own=(ywEO("top10k")||ywEO("near")||{eo:{}}),tmpl=xi.length?Math.round(xi.reduce((a,p)=>a+Math.min(100,(S.field&&S.field.gws&&((S.field.gws[S.field.latest]||{}).top10k||{}).own||{})[p.id]||0),0)/xi.length):null;
  const left=`<section class="panel yw-l"><div class="yw-hero"><span class="ds-sub">Predicted · GW${g}</span><b class="yw-big">${Sm.mean.toFixed(1)}</b><span class="ds-sub">likely ${Math.round(Sm.lo)}–${Math.round(Sm.hi)}</span></div>
    <svg class="yw-dist" viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Simulated scores">${svg}</svg>
    <div class="ds-tiles yw-t">${dsTile("Beat the average",pct(avg!=null?Sm.above(avg):null),avg!=null?`FPL average ${Math.round(avg)}`:"no average yet",avg!=null&&Sm.above(avg)>=.5?"up":"")}
      ${dsTile("Beat the field",pct(fm!=null?Sm.above(fm):null),fm!=null?`${esc(F.label)}: ${Math.round(fm)}`:"no sample yet",fm!=null&&Sm.above(fm)>=.5?"up":"")}
      ${dsTile("Top your league",pct(Sm.pTop),Sm.nRiv?`this week, of ${Sm.nRiv+1}`:"league not loaded")}
      ${dsTile(bb?"Bench Boost":"Bench",bb?"+"+bench.toFixed(1):bench.toFixed(1),bb?"bench predicted":"left unused",bb?"up":"")}</div>
    ${tmpl!=null&&own?`<div class="yw-tm"><span class="ds-sub">Template rating</span>${dsFig(tmpl+"%")}<span class="yw-tl">${tmpl>=70?"template":tmpl>=45?"moderately differential":"differential"}</span></div>`:""}</section>`;
  /* you against the field */
  let mid;
  if(!F)mid=`<section class="panel yw-m">${dsHead("swords","You against the field")}<p class="note">No field sample yet. It is taken after each deadline.</p></section>`;
  else{
    const mineIds=new Set(Sm.me.filter(x=>x.m>0).map(x=>x.p.id));
    const rows=Sm.me.filter(x=>x.m>0).map(x=>({p:x.p,you:x.m*100,fld:F.eo[x.p.id]||0,pts:hPts(x.p,g,1)})).map(r=>({...r,vf:(r.you-r.fld)/100*r.pts})).sort((a,b)=>b.vf-a.vf);
    const thr=Object.keys(F.eo).map(id=>PM.get(+id)).filter(p=>p&&!mineIds.has(p.id)).map(p=>({p,you:0,fld:F.eo[p.id],pts:hPts(p,g,1)})).map(r=>({...r,vf:-r.fld/100*r.pts})).filter(r=>r.vf<-0.3).sort((a,b)=>a.vf-b.vf).slice(0,4);
    const net=rows.reduce((a,r)=>a+r.vf,0)+Object.keys(F.eo).map(id=>PM.get(+id)).filter(p=>p&&!mineIds.has(p.id)).reduce((a,p)=>a-F.eo[p.id]/100*hPts(p,g,1),0);
    const th=`<div class="yw-h ds-th"><span></span><span></span><span></span><span>pred</span><span>vs field</span></div>`;
    mid=`<section class="panel yw-m">${dsHead("swords","You against the field",`<span>net</span>${dsFig(sgn1(net),net>=0?"up":"dn")}<span>pts predicted</span>`)}
      <div class="yw-sub ds-sub">Your edge: their points lift you</div>${th}${rows.slice().sort((a,b)=>Math.abs(b.vf)-Math.abs(a.vf)).slice(0,8).sort((a,b)=>b.vf-a.vf).map(r=>ywRow(r.p,r.you,r.fld,r.pts,r.p.id===cv.captain)).join("")}${rows.length>8?`<span class="ds-sub yw-more">and ${rows.length-8} smaller swings</span>`:""}
      <div class="yw-sub ds-sub">The field's edge: their points cost you</div>${thr.map(r=>ywRow(r.p,r.you,r.fld,r.pts)).join("")||`<span class="ds-sub">None</span>`}</section>`;
  }
  /* matches that matter: points at stake against the field, and what swings them */
  let rt;
  if(!F)rt=`<section class="panel yw-x">${dsHead("target","Matches that matter")}<p class="note">Needs the field sample.</p></section>`;
  else{
    const sq=new Map(Sm.me.map(x=>[x.p.id,x.m])),diff=p=>((sq.get(p.id)||0)*100-(F.eo[p.id]||0))/100;
    const GP={1:6,2:6,3:5,4:4},CS={1:4,2:4,3:1,4:0};
    const fx=((S.model.byEv||{})[g]||[]).filter(f=>f.ht&&f.at).map(f=>{
      const pl=S.model.players.filter(p=>(p.team===f.ht.id||p.team===f.at.id)&&(sq.has(p.id)||(F.eo[p.id]||0)>=5));
      const stake=pl.reduce((a,p)=>a+Math.abs(diff(p))*hPts(p,g,1),0);
      const ch=[];
      pl.forEach(p=>{const d=diff(p);if(Math.abs(d)<0.1)return;if(p.pos>=2&&hPts(p,g,1)>=2.5)ch.push({t:`${p.web_name} goal`,v:GP[p.pos]*d});});
      [f.ht,f.at].forEach(t=>{const v=pl.filter(p=>p.team===t.id).reduce((a,p)=>a+CS[p.pos]*diff(p),0);if(Math.abs(v)>=0.5)ch.push({t:`${t.short} clean sheet`,v});});
      return{f,stake,ch:ch.sort((a,b)=>Math.abs(b.v)-Math.abs(a.v)).slice(0,4)};}).sort((a,b)=>b.stake-a.stake);
    const shown=fx.slice(0,5);
    rt=`<section class="panel yw-x">${dsHead("target","Matches that matter",`<span>pts against the field</span>`)}<div class="yw-ms">${shown.map(({f,stake,ch})=>`<div class="yw-mt"><div class="yw-mh"><span class="ds-sub">${lkKo(f.kickoff)}</span>
        <span class="yw-tm2">${dsBadge(f.ht,18)}<b>${esc(f.ht.short)}</b><span class="ds-sub">v</span><b>${esc(f.at.short)}</b>${dsBadge(f.at,18)}</span><b class="yw-st" title="Predicted points at stake against the field">±${stake.toFixed(1)}</b></div>
        <div class="yw-ch">${ch.map(c=>`<span class="yw-c ${c.v>=0?"up":"dn"}">${esc(c.t)} <b>${sgn1(c.v)}</b></span>`).join("")||`<span class="ds-sub">Little at stake</span>`}</div></div>`).join("")}</div>
      ${fx.length>5?`<span class="yw-more ds-sub">+${fx.length-5} more matches</span>`:""}</section>`;
  }
  return{html:`<div class="yw-g">${left}${mid}${rt}</div>`,right};
}
/* the last finished week with official picks */
function ywLastG(){const next=S.model.next.id,tr=((S.tracker&&S.tracker.gw)||[]).filter(r=>r.event<next&&Array.isArray(r.picks)&&r.picks.length&&!(typeof isLiveWk==="function"&&isLiveWk(r.event))).sort((a,b)=>a.event-b.event);return tr.length?tr[tr.length-1].event:null;}
function ywLastHTML(kind){
  const g=ywLastG();if(!g)return{html:`<p class="note">No finished week yet.</p>`,right:""};
  const row=offRowOf(g),PM=twMap(),F=ywEO(kind,g),W=weekLive(g),ev=(S.events||[]).find(e=>e.id===g)||{};
  const right=`GW${g} · ${weekFinal(g)?"final":"provisional"}`;
  const picks=row.picks.map((k,i)=>({p:PM.get(k.id),m:k.multiplier!=null?k.multiplier:(i<11?1:0),isC:!!k.isC,i})).filter(x=>x.p);
  const act=id=>actOf(id,g)||0;
  const fieldScore=F?Object.keys(F.eo).reduce((a,id)=>a+F.eo[id]/100*act(+id),0)-(F.hits||0):null;
  const mineIds=new Set(picks.filter(x=>x.m>0).map(x=>x.p.id));
  const rows=picks.filter(x=>x.m>0).map(x=>({p:x.p,you:x.m*100,fld:F?F.eo[x.p.id]||0:0,pts:act(x.p.id),c:x.isC})).map(r=>({...r,vf:(r.you-r.fld)/100*r.pts}));
  const thr=F?Object.keys(F.eo).map(id=>PM.get(+id)).filter(p=>p&&!mineIds.has(p.id)).map(p=>({p,you:0,fld:F.eo[p.id],pts:act(p.id)})).map(r=>({...r,vf:-r.fld/100*r.pts})).filter(r=>r.vf<-0.2).sort((a,b)=>a.vf-b.vf):[];
  const gained=rows.filter(r=>r.vf>0).reduce((a,r)=>a+r.vf,0),lost=rows.filter(r=>r.vf<0).reduce((a,r)=>a+r.vf,0)+thr.reduce((a,r)=>a+r.vf,0);
  const pred=row.predicted!=null?row.predicted:null,pts=row.points;
  /* tiles */
  const lgRows=Object.values((S.rivalsFeed&&S.rivalsFeed.entries)||{}).map(e=>((e.gw||[]).find(r=>r.event===g)||{}).points).filter(v=>v!=null);
  const lgPos=lgRows.length?1+lgRows.filter(v=>v>pts).length:null,ord=n=>n+(["th","st","nd","rd"][(n%100>10&&n%100<14)?0:n%10<4?n%10:0]);
  const cap=picks.find(x=>x.isC),capPts=cap?act(cap.p.id)*Math.max(2,cap.m):null;
  const fCap=F&&F.cap?Object.keys(F.cap).reduce((a,id)=>a+F.cap[id]/100*act(+id)*2,0):null;
  const benchPts=picks.filter(x=>x.i>=11).reduce((a,x)=>a+act(x.p.id),0),bb=row.chip==="bboost";
  const tiles=`<div class="ds-tiles yw-t3">${dsTile("FPL average",ev.avg??"—",ev.avg?`you ${lkSg(pts-ev.avg)}`:null)}${dsTile("Field",fieldScore!=null?fieldScore.toFixed(0):"—",F?esc(F.label):"no sample")}
    ${dsTile("League",lgPos?ord(lgPos):"—",lgPos?`of ${lgRows.length} this week`:null)}${dsTile("Captain",capPts!=null?fmtPts(capPts):"—",fCap!=null?`field ${fCap.toFixed(1)}`:null)}
    ${dsTile("Bench",fmtPts(benchPts),bb?"Bench Boost: all 15 scored":"left unused")}${dsTile("Hits",String(row.transferCost||0),`${row.transfers||0} transfer${(row.transfers||0)===1?"":"s"}`)}</div>`;
  /* the last six weeks: you against the field (FPL's average where no sample was taken) */
  const tr=((S.tracker&&S.tracker.gw)||[]).filter(r=>r.event<=g&&r.points!=null).sort((a,b)=>a.event-b.event).slice(-6);
  const ser=tr.map(r=>{const Fx=ywEO(kind,r.event),e=(S.events||[]).find(x=>x.id===r.event)||{};
    const fv=Fx&&kind!=="overall"?Object.keys(Fx.eo).reduce((a,id)=>a+Fx.eo[id]/100*(actOf(+id,r.event)||0),0)-(Fx.hits||0):e.avg;return{e:r.event,y:r.points,f:fv,s:!!(Fx&&kind!=="overall")};});
  const top=Math.max(20,...ser.flatMap(x=>[x.y,x.f||0])),CW=440,CH=170,cy=v=>14+(CH-36)*(1-v/top),slot=(CW-30)/Math.max(1,ser.length);
  let ch="";[0,top/2,top].forEach(v=>ch+=`<line class="cgrid" x1="28" x2="${CW}" y1="${cy(v)}" y2="${cy(v)}"/><text class="cax" x="22" y="${cy(v)+4}" text-anchor="end">${Math.round(v)}</text>`);
  ser.forEach((x,k)=>{const x0=30+slot*k+slot/2,bw=Math.min(22,slot/3),d=x.f!=null?x.y-x.f:null;
    ch+=`<rect x="${x0-bw-1}" y="${cy(x.y)}" width="${bw}" height="${cy(0)-cy(x.y)}" rx="3" fill="${d==null||d>=0?"#3DDC97":"#C0485A"}"/>`;
    if(x.f!=null)ch+=`<rect x="${x0+1}" y="${cy(x.f)}" width="${bw}" height="${cy(0)-cy(x.f)}" rx="3" fill="${x.s?"#8B6FD6":"#5A5A5A"}"/>`;
    if(d!=null)ch+=`<text x="${x0}" y="${cy(Math.max(x.y,x.f))-5}" text-anchor="middle" class="ds-cd ${d>=0?"up":"dn"}">${lkSg(Math.round(d))}</text>`;
    ch+=`<text class="cax" x="${x0}" y="${CH-6}" text-anchor="middle">GW${x.e}</text>`;});
  const chart=`<div class="ds-lg"><span><i style="background:#3DDC97"></i>You</span><span><i style="background:#8B6FD6"></i>The field</span><span><i style="background:#5A5A5A"></i>FPL average (no sample)</span></div><svg class="chart yw-ch2" viewBox="0 0 ${CW} ${CH}" role="img" aria-label="You against the field, last six weeks">${ch}</svg>`;
  const killer=thr[0];
  const predOf=x=>{const sp=pastPred(x.p,g);return sp?sp.v*(x.you/100):null;};
  if(!F)rows.forEach(r=>{const pv=predOf(r);r.pv=pv;r.vf=pv==null?0:r.pts*(r.you/100)-pv;});
  /* star and flop: against the field, or against the prediction with no sample */
  const star=rows.slice().sort((a,b)=>b.vf-a.vf)[0];
  const flop=F?rows.map(r=>({...r,d:r.pts*(r.you/100)-(predOf(r)||0)})).sort((a,b)=>a.d-b.d)[0]:rows.slice().sort((a,b)=>a.vf-b.vf)[0];
  const sfk=(lab,cls,x,sub)=>x?`<div class="sf4 ${cls}"><em>${lab}</em>${dsFace(x.p,"sf4-ph")}<span class="ds-name">${esc(x.p.web_name)}</span><span class="sf4-v"><span class="ds-sub">${fmtPts(x.pts*Math.max(1,x.you/100))} pts</span>${dsFig(sgn1(x.vf),x.vf>=0?"up":"dn")}</span><span class="ds-sub">${F?sub:"against predicted"}</span></div>`:`<div class="sf4 ${cls}"><em>${lab}</em><span class="ds-sub">—</span></div>`;
  const left=`<section class="panel yw-l"><div class="yw-hero"><span class="ds-sub">GW${g} · ${weekFinal(g)?"final":"provisional"}</span><b class="yw-big">${pts}</b>
      <span class="yw-vs">${fieldScore!=null?`<b class="${pts-fieldScore>=0?"up":"dn"}">${sgn1(pts-fieldScore)}</b> against the field`:""}${fieldScore!=null&&pred!=null?" · ":""}${pred!=null?`<b class="${pts-pred>=0?"up":"dn"}">${sgn1(pts-pred)}</b> against predicted`:""}</span></div>
    ${tiles}${chart}<div class="sf4s">${sfk("Star","st",star,star?`owned by ${Math.round(star.fld)}%`:"")}${sfk("Flop","fl",flop,flop?`owned by ${Math.round(flop.fld)}%`:"")}${sfk("Killer","kl",killer,"you didn't own him")}</div></section>`;
  const th=`<div class="yw-h ds-th"><span></span><span></span><span></span><span>pts</span><span>vs field</span></div>`;
  const mid=F?`<section class="panel yw-m">${dsHead("activity","Why it happened")}<div class="yw-sub ds-sub">Your edge</div>${th}
      ${rows.sort((a,b)=>b.vf-a.vf).map(r=>ywRow(r.p,r.you,r.fld,r.pts,r.c)).join("")}<div class="yw-sub ds-sub">The field's edge</div>${thr.slice(0,4).map(r=>ywRow(r.p,0,r.fld,r.pts)).join("")||`<span class="ds-sub">None</span>`}
      <div class="yw-sum"><span>Gained ${dsFig(sgn1(gained),"up")}</span><span>Lost ${dsFig(sgn1(lost),"dn")}</span><span>Net ${dsFig(sgn1(gained+lost),gained+lost>=0?"up":"dn")}</span></div></section>`
    :`<section class="panel yw-m">${dsHead("activity","Why it happened",`<span>against predicted · no field sample for GW${g}</span>`)}<div class="yw-h ds-th"><span></span><span></span><span></span><span>pts</span><span>vs pred</span></div>
      ${rows.slice().sort((a,b)=>b.vf-a.vf).map(r=>{const w=Math.min(50,Math.abs(r.vf)*4);return `<div class="yw-r">${dsFace(r.p)}<span class="yw-n"><b class="ds-name">${esc(r.p.web_name)}${r.c?` <span class="pz-cv">C</span>`:""}</b><span class="ds-sub">predicted ${r.pv==null?"—":r.pv.toFixed(1)}</span></span><span class="yw-bar"><i class="${r.vf>=0?"up":"dn"}" style="width:${w}%;${r.vf>=0?"left:50%":"right:50%"}"></i></span>${dsFig(fmtPts(r.pts*(r.you/100)))}${dsFig(sgn1(r.vf),r.vf>=0.05?"up":r.vf<=-0.05?"dn":"")}</div>`;}).join("")}
      <div class="yw-sum"><span>Above ${dsFig(sgn1(rows.filter(r=>r.vf>0).reduce((a,r)=>a+r.vf,0)),"up")}</span><span>Below ${dsFig(sgn1(rows.filter(r=>r.vf<0).reduce((a,r)=>a+r.vf,0)),"dn")}</span><span>Net ${dsFig(sgn1(rows.reduce((a,r)=>a+r.vf,0)),rows.reduce((a,r)=>a+r.vf,0)>=0?"up":"dn")}</span></div></section>`;
  /* your calls, and club by club against the field */
  const prev=((S.tracker&&S.tracker.gw)||[]).find(r=>r.event===g-1&&Array.isArray(r.picks));
  let ins=[],outs=[];if(prev){const was=new Set(prev.picks.map(k=>k.id)),now=new Set(row.picks.map(k=>k.id));ins=row.picks.filter(k=>!was.has(k.id)).map(k=>PM.get(k.id)).filter(Boolean);outs=prev.picks.filter(k=>!now.has(k.id)).map(k=>PM.get(k.id)).filter(Boolean);}
  const free=/freehit|wildcard/.test(row.chip||"");
  const xNet=ins.reduce((a,p)=>a+act(p.id),0)-outs.reduce((a,p)=>a+act(p.id),0)-(row.transferCost||0);
  const call=(icon,t,sub,v,tone)=>`<div class="yw-call"><span class="yw-ci">${lic(icon,16)}</span><span class="yw-cn"><b>${t}</b><span class="ds-sub">${sub}</span></span>${dsFig(v,tone)}</div>`;
  const capD=capPts!=null&&fCap!=null?capPts-fCap:null;
  const calls=call("crown","Captain",cap?`${esc(cap.p.web_name)} ${fmtPts(act(cap.p.id))} × ${Math.max(2,cap.m)}${fCap!=null?` · field's captains ${fCap.toFixed(1)}`:""}`:"—",capD==null?"—":sgn1(capD),capD==null?"":capD>=0?"up":"dn")
    +call("arrow-right-left","Transfers",free?`${esc(row.chipLabel||"Chip")} week`:ins.length?ins.map((p,i)=>`${esc(p.web_name)} ${fmtPts(act(p.id))}${outs[i]?` for ${esc(outs[i].web_name)} ${fmtPts(act(outs[i].id))}`:""}`).join(" · "):"No transfers",free||!ins.length?"—":lkSg(Math.round(xNet)),xNet>=0?"up":"dn")
    +call("users","Bench",bb?"Bench Boost: all 15 scored":`${fmtPts(benchPts)} left on the bench`,bb?"+"+fmtPts(benchPts):fmtPts(benchPts),bb?"up":"");
  let clubs="";
  if(F){const by={};S.model.players.forEach(p=>{const you=(mineIds.has(p.id)?(picks.find(x=>x.p.id===p.id)||{}).m||0:0)*act(p.id),fl=(F.eo[p.id]||0)/100*act(p.id);if(!you&&!fl)return;const k=p.team;(by[k]=by[k]||{you:0,fl:0});by[k].you+=you;by[k].fl+=fl;});
    const list=Object.entries(by).map(([t,v])=>({t:(S.teams||[]).find(x=>x.id===+t),...v,d:v.you-v.fl})).filter(x=>x.t&&Math.abs(x.d)>=0.05).sort((a,b)=>b.d-a.d).slice(0,8),mx=Math.max(1,...list.map(x=>Math.max(x.you,x.fl)));
    clubs=`${dsHead("shield","Club effect",`<span>your points against the field's</span>`)}<div class="yw-cl">${list.map(x=>`<div class="yw-cr">${dsBadge(x.t,20)}<span class="ds-name">${esc(x.t.name)}</span><span class="yw-cb"><i style="width:${x.you/mx*100}%"></i><em style="left:${x.fl/mx*100}%"></em></span><span class="yw-cv">${dsFig(fmtPts(x.you))}<span class="ds-sub">v ${x.fl.toFixed(1)}</span></span>${dsFig(sgn1(x.d),x.d>=0?"up":"dn")}</div>`).join("")}</div>`;}
  const rt=`<section class="panel yw-x">${dsHead("check","Your calls")}${calls}${clubs}<button class="yw-open" onclick="act('pop',null);act('startgw',${g})">Open GW${g} in the Planner ${lic("arrow-right",14)}</button></section>`;
  return{html:`<div class="yw-g">${left}${mid}${rt}</div>`,right};
}
/* ---------- Compare v3 (21 Nov 2026, Andy approved the mock) ----------
   Two squads side by side, each on the Planner's own pitch (kits, transfer
   button, armbands, Dream Team star, ownership, injury, points, fixture
   strip, right-click menu, drag to substitute). A is the current team by
   default; B is any squad: your plan, the best Free Hit or Wildcard team
   (the optimiser, with locks and rule-outs and Re-run), or a saved squad.
   Edits on a side stay on that side (S.cmp.ed) until saved or applied. */
const CMP_SRC=[["cur","Current team"],["plan","Your plan"],["fh","Best Free Hit"],["wc","Best Wildcard"]];
function cmpNew(a,b){return{a:a||"cur",b:b||"plan",h:1,locks:[],bans:[],pendLocks:[],pendBans:[],ed:{A:null,B:null},menu:null,sub:null,repl:null};}
const cmpBuilder=src=>src==="fh"||src==="wc";
/* one squad source: ids, armbands, bank, label */
function cmpSquad(src){
  const C=S.cmp,g=VG(),P=id=>S.model.players.find(p=>p.id===id);
  if(src==="cur"){const o=latestOfficialPicks();if(!o)return null;
    const c=o.picks.find(pk=>pk.isC)||{},v=o.picks.find(pk=>pk.isV)||{};
    return{ids:o.picks.map(pk=>pk.id),xi:o.picks.slice(0,11).map(pk=>pk.id),cap:c.id,vice:v.id,bank:planBank(),label:"Current team",sub:`GW${o.event} official`};}
  if(src==="plan"){const e=effectiveSquadIds(g),cv=effectiveCaptainVice(g);
    return{ids:e.ids,xi:startingXI().map(p=>p.id),cap:cv.captain,vice:cv.vice,bank:planBank(),label:"Your plan",sub:`GW${g}`};}
  if(cmpBuilder(src)){const kind=src==="wc"?"wildcard":"freehit",budget=squadBudget(),h=src==="fh"?1:C.h;
    let r=optimalSquad(kind,g,budget,null,{weeks:h,locks:C.locks,bans:C.bans});
    if(!r)return{ids:null,label:src==="fh"?"Best Free Hit":"Best Wildcard",sub:"no legal squad",infeasible:true};
    /* the same bench-weighted team as the header's Best XI (25 Nov 2026) */
    if(src==="fh"&&!C.locks.length&&!C.bans.length)r=benchWeighted(r,[...r.xi,...r.bench].map(p=>p.id),g,budget).t;
    return{ids:[...r.xi,...r.bench].map(p=>p.id),xi:r.xi.map(p=>p.id),cap:r.cap&&r.cap.id,vice:null,bank:+(budget-r.value).toFixed(1),
      label:src==="fh"?"Best Free Hit":"Best Wildcard",sub:src==="fh"?`GW${g}`:wkSpan(g,h),how:r.heuristic?"quick builder":r.proven?"proven best":r.checking?"best found · checking":"best found"};}
  const m=/^d(\d+)$/.exec(src||"");if(m){const d=(LS.get("drafts")||[])[+m[1]];if(!d)return null;
    return{ids:d.ids.slice(),xi:d.xi||null,cap:d.cap,vice:d.vice||null,bank:d.bank??planBank(),label:d.label,sub:d.gw?`saved · GW${d.gw}`:"saved"};}
  return null;
}
/* a side as shown: the source with that side's own edits on top */
function cmpSide(side){
  const C=S.cmp,g=VG(),h=C[side==="A"?"a":"b"]==="fh"?1:C.h,base=cmpSquad(C[side==="A"?"a":"b"]);
  if(!base||!base.ids)return base?{...base,players:[],xi:[],bench:[],total:0}:null;
  const ed=C.ed[side]||{},ids=ed.ids||base.ids,P=id=>S.model.players.find(p=>p.id===id);
  const players=ids.map(P).filter(Boolean),val=p=>{let t=0;for(let e=g;e<g+h&&e<=38;e++)t+=p.gw[e]?.pts||0;return t;};
  let xiIds=ed.xi||(!ed.ids&&base.xi)||null;
  if(!xiIds||!legalXI(xiIds)||xiIds.some(i=>!ids.includes(i)))xiIds=legalBestXI(players,val).map(p=>p.id);
  const xi=xiIds.map(P).filter(Boolean),bench=players.filter(p=>!xiIds.includes(p.id)).sort((a,b)=>(a.pos===1?-1:b.pos===1?1:val(b)-val(a)));
  const byV=xi.slice().sort((a,b)=>val(b)-val(a));
  /* armbands and total by the one team rule (teamPts, 25 Nov 2026): a benched
     captain hands the armband to the vice; a built squad with no vice takes
     its second-best starter, as the header's Best XI does */
  const src=C[side==="A"?"a":"b"],rawV=ed.vice??base.vice,A=armbands(xi,P(ed.cap??base.cap),P(rawV));
  const cap=A.cap||byV[0],vice=A.cap?(A.vice||(rawV==null?byV.find(p=>p!==cap):null)):byV.find(p=>p!==cap);
  const plan=src==="plan";
  const total=teamPts(xi,players.filter(p=>!xiIds.includes(p.id)),cap,vice,g,h,plan?chipForWeek:null)-(plan?hitsOver(g,h):0);
  const sellOrPay=p=>(S.squad||[]).includes(p.id)?sellPrice(p):p.price;
  return{...base,ids,players,xi,bench,cap,vice,total,val,h,bank:ed.bank??base.bank,edited:!!ed.ids||ed.cap!=null||!!ed.xi,sellOrPay};
}
/* one card: the Planner's card, on a compare side */
function cmpCardHTML(p,side,T,other,bench){
  const g=VG(),v=T.val(p)*(p===T.cap?2:1),col=ptsCol(v/Math.max(1,T.h));
  const uniq=!!(other&&other.ids&&other.ids.length)&&!other.ids.includes(p.id),C=S.cmp,menu=C.menu&&C.menu.side===side&&C.menu.id===p.id;
  const sub=C.sub&&C.sub.side===side&&C.sub.id===p.id,lock=side==="B"&&(C.pendLocks.includes(p.id)||C.locks.includes(p.id)),ban=side==="B"&&(C.pendBans.includes(p.id)||C.bans.includes(p.id));
  const inj=p.avail<1?`<span class="pz-inj" style="--fl:${p.avail===0?"var(--red)":p.avail>=.75?"#FFD23F":"#FF9F2E"}" title="${esc(flagTitle(p))}">${lic("triangle-alert",13)}<i>${Math.round(p.avail*100)}%</i></span>`:"";
  return `<div class="pz-c${uniq?" cv-"+(side==="A"?"out":"in"):""}${sub?" subsel":""}${menu?" open":""}${ban?" dim":""}" data-pid="${p.id}"
    onclick="act('cmpclick','${side}',${p.id})" oncontextmenu="event.preventDefault();act('cmpmenu','${side}',${p.id})" draggable="true"
    ondragstart="pzDrag(event,${p.id})" ondragover="pzOver(event)" ondragleave="this.classList.remove('drop')" ondrop="pzDrop(event,${p.id},'${side}')" title="${esc(p.web_name)}">
    <div class="pz-k">${kitHTML(p,"pz-kit")}
      <span class="pz-l"><button class="pz-xf" onclick="event.stopPropagation();act('cmprepl','${side}',${p.id})" title="Transfer ${esc(p.web_name)} out" aria-label="Transfer ${esc(p.web_name)} out">${lic("arrow-right-left",11)}</button>${p===T.cap?`<span class="pz-cv">C</span>`:p===T.vice?`<span class="pz-cv v">V</span>`:""}${inDT(p)?dtStar("pz-dt"):""}</span>
      <span class="pz-r"><span class="pz-ow">${p.owned}%</span>${inj}</span>
      ${uniq?`<span class="cv-tag">${side==="A"?"OUT":"IN"}</span>`:lock?`<span class="cv-tag lk">${lic("lock",9)}</span>`:""}
      <span class="pz-pt" style="background:${col[0]};color:${col[1]}">${v.toFixed(1)}</span></div>
    <div class="pz-n"><b>${esc(p.web_name)}</b><i>£${p.price.toFixed(1)}</i></div>
    <div class="pz-x">${fxNext(p,g,5,"sm")}</div>${menu?cmpMenuHTML(p,side,T,bench):""}${C.repl&&C.repl.side===side&&C.repl.id===p.id?cmpReplHTML(p,side,T):""}</div>`;
}
function cmpMenuHTML(p,side,T,bench){
  const C=S.cmp,b=side==="B"&&cmpBuilder(C.b);
  const it=(icon,label,on,call)=>`<button role="menuitem" onclick="event.stopPropagation();${call}">${icon}<span>${label}</span>${on?lic("check",14):""}</button>`;
  return `<div class="pz-menu" role="menu" onclick="event.stopPropagation()" oncontextmenu="event.preventDefault();event.stopPropagation()">
    <div class="pz-mh"><b>${esc(p.web_name)}</b><span>${esc(p.teamName)} · ${POSL[p.pos]} · £${p.price.toFixed(1)}</span></div>
    ${it(lic("arrow-right-left",15),"Substitute",false,`act('cmpsubpick','${side}',${p.id})`)}
    ${!bench?it(`<span class="pz-mb">C</span>`,"Captain",p===T.cap,`act('cmpcap','${side}',${p.id})`):""}
    ${!bench?it(`<span class="pz-mb v">V</span>`,"Vice-captain",p===T.vice,`act('cmpvice','${side}',${p.id})`):""}
    ${b?it(lic("lock",15),"Lock in",C.pendLocks.includes(p.id),`act('cmplock',${p.id})`):""}
    ${b?it(lic("ban",15),"Rule out",C.pendBans.includes(p.id),`act('cmpban',${p.id})`):""}
    ${it(lic("info",15),"Player card",false,`act('card',${p.id})`)}</div>`;
}
/* the transfer: the best affordable players for his place on that side */
function cmpReplHTML(p,side,T){
  const g=VG(),club={};T.players.filter(x=>x!==p).forEach(x=>club[x.team]=(club[x.team]||0)+1);
  const funds=T.bank+T.sellOrPay(p);
  const opts=S.model.players.filter(q=>q.pos===p.pos&&!T.ids.includes(q.id)&&q.avail>0&&q.price<=funds+1e-9&&(club[q.team]||0)<3)
    .sort((a,b)=>T.val(b)-T.val(a)).slice(0,6);
  return `<div class="pz-menu cv-repl" onclick="event.stopPropagation()"><div class="pz-mh"><b>Replace ${esc(p.web_name)}</b><span>£${funds.toFixed(1)} to spend</span></div>
    ${opts.map(q=>`<button onclick="event.stopPropagation();act('cmpswap','${side}',${p.id},${q.id})">${photoHTML(q,"pz-ph")}<span>${esc(q.web_name)} <i class="mu">${esc(q.teamName)} · £${q.price.toFixed(1)}</i></span><b class="up">${T.val(q).toFixed(1)}</b></button>`).join("")||`<p class="note" style="padding:6px 8px">No affordable player fits.</p>`}</div>`;
}
function cmpPitchHTML(side,T,other){
  if(!T||!T.ids||!T.players.length)return `<div class="pz-pitch cv-pz cv-empty"><p class="note">${T&&T.infeasible?"No legal squad fits those locks and rule-outs within your budget. Clear some and Re-run.":"Nothing to show for this squad."}</p></div>`;
  return `<div class="pz-pitch cv-pz"><svg class="pz-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect x="24" y="0" width="52" height="13"/><rect x="38" y="0" width="24" height="5"/><path d="M42 13 Q50 18 58 13"/></svg>
    ${[1,2,3,4].map(k=>`<div class="pz-row">${T.xi.filter(p=>p.pos===k).map(p=>cmpCardHTML(p,side,T,other,false)).join("")}</div>`).join("")}
    <div class="pz-bench">${T.bench.map((p,i)=>`<div class="pz-bs"><div class="pz-bl">${p.pos===1?"GKP":`${i}. ${POSL[p.pos]}`}</div>${cmpCardHTML(p,side,T,other,true)}</div>`).join("")}</div></div>`;
}
function compareModalHTML(){
  const C=S.cmp;if(!C||!S.model)return "";
  const g=VG(),A=cmpSide("A"),B=cmpSide("B"),drafts=LS.get("drafts")||[];
  const srcs=[...CMP_SRC,...drafts.map((d,i)=>["d"+i,d.label])];
  const sel=side=>{const k=side==="A"?"a":"b";return `<label class="cv-sel ${side.toLowerCase()}"><span class="cv-badge ${side.toLowerCase()}">${side}</span>
    <select onchange="act('cmpsrc','${side}',this.value)" aria-label="Squad ${side}">${srcs.map(([v,n])=>`<option value="${v}"${C[k]===v?" selected":""}>${esc(n)}</option>`).join("")}</select></label>`;};
  const chips=srcs.map(([v,n])=>{const sq=v.startsWith("d")?drafts[+v.slice(1)]:null;
    return `<button class="cv-sq${C.a===v?" a":""}${C.b===v?" b":""}" onclick="act('cmpsrc','B','${v}')"><b>${esc(n)}</b><i>${v==="cur"?"official":v==="plan"?"GW"+g:v==="fh"?"built · GW"+g:v==="wc"?"built · 5 GW":sq&&sq.gw?"saved · GW"+sq.gw:"saved"}</i>${C.a===v?"<em>A</em>":C.b===v?"<em>B</em>":""}</button>`;}).join("");
  const hzc=C.b==="fh"&&C.a!=="wc"?`<span class="hz"><button class="on" disabled>1 GW</button></span>`:hzHTML(C.h,"cmph");
  const head=(side,T)=>`<div class="cv-sh"><span class="cv-badge ${side.toLowerCase()}">${side}</span><b>${esc(T?T.label:"—")}</b>${T&&T.edited?`<span class="cv-ed">edited</span>`:""}<span class="cv-tot">${T?T.total.toFixed(1):"—"}</span>
    <span class="cv-meta">${side==="B"&&cmpBuilder(C.b)?`${lic("lock",12)} ${C.locks.length+C.pendLocks.length} locked · ${lic("ban",12)} ${C.bans.length+C.pendBans.length} ruled out`:T?`£${(+T.bank).toFixed(1)} bank`:""}</span></div>`;
  let spine=`<p class="note">Pick two squads.</p>`;
  if(A&&B&&A.ids&&B.ids&&A.players.length&&B.players.length){
    const d=B.total-A.total,outs=A.players.filter(p=>!B.ids.includes(p.id)),ins=B.players.filter(p=>!A.ids.includes(p.id));
    const posS=(T,k)=>T.xi.filter(p=>p.pos===k).reduce((a,p)=>a+T.val(p)*(p===T.cap?2:1),0);
    const chip=cmpBuilder(C.b),hit=chip?0:Math.max(0,ins.length-freeTransfers())*4;
    const bankAfter=A.bank+outs.reduce((a,p)=>a+A.sellOrPay(p),0)-ins.reduce((a,p)=>a+p.price,0);
    spine=`<div class="cv-big"><span>B against A</span><b class="${d>=0?"up":"dn"}">${sgn1(d)}</b><i>${B.total.toFixed(1)} vs ${A.total.toFixed(1)} pts · ${wkSpan(g,B.h)}</i></div>
      <div class="cv-blk"><em>By position</em>${[1,2,3,4].map(k=>{const x=posS(B,k)-posS(A,k);
        return `<div class="cv-pd"><span>${POSL[k]}</span><span class="cv-bar"><i class="${x>=0?"up":"dn"}" style="width:${Math.min(50,Math.abs(x)/20*50)}%;${x>=0?"left:50%":"right:50%"}"></i></span><b class="${x>=0?"up":"dn"}">${sgn1(x)}</b></div>`;}).join("")}</div>
      <div class="cv-blk"><em>To get from A to B</em>
        <div class="cv-kv"><span>Transfers</span><b>${ins.length}</b></div>
        <div class="cv-kv"><span>Hit</span><b class="${hit?"dn":""}">${chip?`None with ${C.b==="fh"?"Free Hit":"Wildcard"}`:hit?`−${hit}`:"None"}</b></div>
        <div class="cv-kv"><span>Squad value</span><b>£${B.players.reduce((a,p)=>a+p.price,0).toFixed(1)}</b></div>
        <div class="cv-kv"><span>Bank after</span><b class="${bankAfter<-0.001?"dn":""}">£${bankAfter.toFixed(1)}</b></div>
        ${B.how?`<div class="cv-kv"><span>Solver</span><b>${esc(B.how)}</b></div>`:""}</div>
      <div class="cv-blk"><em>Biggest swings</em>${ins.sort((a,b)=>B.val(b)-B.val(a)).slice(0,3).map(p=>`<div class="cv-sw">${photoHTML(p,"cv-ph")}<span>${esc(p.web_name)} in</span><b class="up">+${B.val(p).toFixed(1)}</b></div>`).join("")||`<span class="mu">Same players</span>`}</div>`;
  }
  const pend=C.pendLocks.length+C.pendBans.length,applied=C.locks.length+C.bans.length,bName=B?B.label:"B";
  const apply=C.b==="fh"||C.b==="wc"?`Play ${C.b==="fh"?"Free Hit":"Wildcard"} with B in GW${g}`:`Use B for GW${g}`;
  const body=`<div class="cv-src">${chips}<span class="cv-acts">${cmpBuilder(C.b)?`<button class="${pend?"pri":""}" onclick="act('cmprerun')">${lic("refresh-cw",14)} Re-run B${pend?` (${pend})`:""}</button>${applied||pend?`<button onclick="act('cmpclear')">Clear locks</button>`:""}`:""}
      ${C.ed.A||C.ed.B?`<button onclick="act('cmpundo')">Undo edits</button>`:""}<button onclick="act('cmpsave')">${lic("save",14)} Save B</button><button class="pri" onclick="act('cmpapply')" ${B&&B.ids?"":"disabled"}>${apply}</button></span></div>
    <div class="cv-main"><div class="cv-side">${head("A",A)}${cmpPitchHTML("A",A,B)}</div><div class="cv-spine">${spine}</div><div class="cv-side">${head("B",B)}${cmpPitchHTML("B",B,A)}</div></div>`;
  return modalHTML("Compare Squads",body,{wide:true,ctl:`<span class="cv-pick">${sel("A")}<span class="cv-vs">vs</span>${sel("B")}</span>${hzc}`,close:"cmpclose",cls:"cv"});
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
function fixPills(p,g,n){return fxNext(p,g,n);}
/* the old Player Data table, kept whole as the Stats view */
/* tick-to-compare: up to five players side by side as figure cards */
/* Compare pop-up (20 Nov 2026, Andy). Radar view by default: the Scout's
   verdict, a radar of each player's percentile (among regular starters, 60+
   expected minutes, in his position) on his position's stats, with top-10%
   and average rings and the leader under each stat, a card per player, and
   points played and predicted. Stats view (toggle): hero cards with signals,
   percentile bars with the best of the group in green, owned by rivals,
   fixtures and the same line chart. The stats follow the position of the
   players picked; mixed positions share one set. No coloured edge stripes:
   a player's colour is the ring on his photo and the dot by his name. */
const CP_COL=["#3DDC97","#6FB7FF","#F5B841","#FF7A9A","#B58CFF"];
const CP_ST={ /* label, note, format, better (1 high, -1 low), short */
  xgi6:["xGI per 90","Last 6 matches",v=>v.toFixed(2),1,"xGI"],
  retmk:["Goal or Assist, Market","Bookmakers, next match, if he plays",v=>Math.round(v*100)+"%",1,"Return %"],
  npxg:["npxG per 90","Season",v=>v.toFixed(2),1,"npxG"],
  xa:["xA per 90","Season",v=>v.toFixed(2),1,"xA"],
  sot:["Shots on Target per 90","Season",v=>v.toFixed(2),1,"SoT"],
  dchit:["DefCon Hit Rate","Matches reaching the target",v=>Math.round(v*100)+"%",1,"DefCon"],
  bps:["BPS per 90","Season",v=>v.toFixed(1),1,"BPS"],
  bonus:["Bonus Points","Season",v=>v.toFixed(0),1,"Bonus"],
  cs:["Clean Sheet Chance","Model, next match",v=>Math.round(v*100)+"%",1,"CS %"],
  csmk:["Clean Sheet, Market","Bookmakers, next match",v=>Math.round(v*100)+"%",1,"CS mkt"],
  gc90:["Goals Conceded per 90","Season, fewer is better",v=>v.toFixed(2),-1,"GC"],
  sv90:["Saves per 90","Season",v=>v.toFixed(2),1,"Saves"],
  gprev:["Goals Prevented","Season",v=>(v>0?"+":"")+v.toFixed(1),1,"G prev"],
  total:["Total Points","Season",v=>v.toFixed(0),1,"Pts"]};
const CP_SETS={1:["cs","csmk","sv90","gprev","gc90","bonus"],2:["cs","csmk","xgi6","dchit","bps","bonus"],
  3:["xgi6","retmk","npxg","xa","dchit","bonus"],4:["xgi6","retmk","npxg","sot","xa","bonus"],0:["xgi6","cs","dchit","bonus","total"]};
const CP_POS={1:"Goalkeeper",2:"Defender",3:"Midfielder",4:"Forward"};
let _cpC=null;
const mkRet=x=>!x?null:x.ret!=null?x.ret:(x.goal!=null&&x.assist!=null)?1-(1-x.goal)*(1-x.assist):null;
function cpVal(k,p){
  if(!_cpC||_cpC.m!==S.model)_cpC={m:S.model,C:pdCols().C,pool:{}};
  try{const v=_cpC.C[k].val(p);return v==null||!isFinite(v)?null:+v;}catch(e){return null;}
}
/* where he stands among regular starters in his position: pct drives the
   bars and the radar's shape, rank is the number shown (1 = best) */
const cpRk=r=>r?`<span class="cprk" title="${cpOrd(r.rank)} of ${r.of} regular starters in his position">#${r.rank}</span>`:"";
const cpRkT=r=>r?`${cpOrd(r.rank)} of ${r.of}`:"";
/* percentile and rank among regular starters in his position */
function cpPr(k,p){
  const v=cpVal(k,p);if(v==null)return null;
  const key=k+"|"+p.pos;
  if(!_cpC.pool[key])_cpC.pool[key]=S.model.players.filter(q=>q.pos===p.pos&&(q.xMins||0)>=60).map(q=>cpVal(k,q)).filter(x=>x!=null);
  const a=_cpC.pool[key];if(!a.length)return null;
  const b=CP_ST[k][3],better=a.filter(x=>b>0?x>v:x<v).length,worse=a.filter(x=>b>0?x<v:x>v).length;
  return{pct:Math.round(100*(worse+(a.length-better-worse)/2)/a.length),rank:better+1,of:a.length};
}
const cpOrd=n=>n+(n%100>=11&&n%100<=13?"th":n%10===1?"st":n%10===2?"nd":n%10===3?"rd":"th");
const cpKit=p=>(KITS[p.teamName]||KITS._d||{b:"#444"}).b;
const cpPhoto=(p,cls,size)=>`<img class="${cls}" alt="" src="${imgSrc("player",p.code)}" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="${cls} cpfb" style="display:none">${shirtSVG(p.teamName.toUpperCase(),p.pos===1,size)}</span>`;
const cpSet=ps=>{const pos=ps.every(p=>p.pos===ps[0].pos)?ps[0].pos:0;return{pos,keys:CP_SETS[pos],name:pos?CP_POS[pos]+" stats":"Shared stats"};};
const cpRiv=p=>{const R=rivalOwn();return R&&R.n?{k:R.own[p.id]||0,n:R.n}:null;};
const cpBest=(vals,better)=>{const ok=vals.filter(v=>v!=null);if(!better||ok.length<2||ok.every(x=>x===ok[0]))return null;return better>0?Math.max(...ok):Math.min(...ok);};
function cpLast6(p,g){const A=S.playerActuals||{},a=A[p.id]||A[String(p.id)]||{},o=[];for(let e=g-6;e<g;e++){const v=e>=1?(a[e]??a[String(e)]):null;o.push(v==null?0:+v);}return o;}
function cpFix(p,g){const o=[];for(let e=g;e<g+5;e++){const w=p.gw[e];if(w&&!w.blank)w.fixtures.forEach(f=>o.push({e,opp:f.opp,d:posDiff(p,f)}));}return o;}
const cpStrengths=(p,keys)=>keys.map(k=>({k,r:cpPr(k,p)})).filter(x=>x.r).sort((a,b)=>b.r.pct-a.r.pct);
const cpChips=(p,keys)=>{const s=cpStrengths(p,keys),up=s.filter(x=>x.r.pct>=80).slice(0,3),dn=s.filter(x=>x.r.pct<=30).slice(-2);
  return `<div class="cpchips">${up.map(x=>`<span class="up" title="${cpRkT(x.r)}">${CP_ST[x.k][4]} #${x.r.rank}</span>`).join("")}${dn.map(x=>`<span class="dn" title="${cpRkT(x.r)}">${CP_ST[x.k][4]} #${x.r.rank}</span>`).join("")}</div>`;};
/* the Scout's verdict, from the same figures the pop-up shows */
function cpVerdict(ps,g,H,win){
  const S2=cpSet(ps),pos=S2.pos?CP_POS[S2.pos].toLowerCase()+"s":"players";
  const xp=p=>hPts(p,g,H),r=[...ps].sort((a,b)=>xp(b)-xp(a)),pick=r[0],second=r[1],last=r[r.length-1];
  const st=p=>cpStrengths(p,S2.keys),nm=k=>CP_ST[k][0].replace(" per 90","");
  const top2=st(pick).filter(x=>x.r.pct>=75).slice(0,2).map(x=>`${nm(x.k)} (${cpRkT(x.r)})`).join(" and ");
  const pts=[{kind:"good",text:`**${pick.web_name}** projects **${xp(pick).toFixed(1)}** over ${win}, ${(xp(pick)-xp(second)).toFixed(1)} ahead of ${second.web_name}${top2?`, and stands out among ${pos} for ${top2}`:""}.`}];
  const rv=cpRiv(pick),weak=st(pick).filter(x=>x.r.pct<=35).pop();
  if(rv&&rv.k===rv.n)pts.push({kind:"warn",text:`All ${rv.n} of your rivals own him, so he protects your league place rather than gaining ground.`});
  else if(weak)pts.push({kind:"warn",text:`Weak spot: ${nm(weak.k)} (${cpRkT(weak.r)} ${pos}).`});
  const cheap=ps.filter(p=>p!==pick&&pick.price-p.price>=0.5).sort((a,b)=>a.price-b.price)[0];
  if(cheap){const cs=st(cheap)[0],rc=cpRiv(cheap);
    pts.push({kind:"next",text:`**${cheap.web_name}** is the budget route: £${(pick.price-cheap.price).toFixed(1)}m cheaper and ${(xp(pick)-xp(cheap)).toFixed(1)} pts behind${cs?`, ranked ${cpRkT(cs.r)} ${pos} for ${nm(cs.k)}`:""}${rc?`; ${rc.k} of ${rc.n} rivals own him`:""}.`});}
  if(last!==cheap&&last!==pick){const lf=cpFix(last,g).filter(f=>f.d>=4),ls=st(last)[0];
    pts.push({kind:"info",text:`**${last.web_name}** trails on projection (${xp(last).toFixed(1)})${ls?` despite ranking ${cpRkT(ls.r)} for ${nm(ls.k)}`:""}${lf.length?`; tough games: ${lf.map(f=>`${f.opp.toUpperCase()} GW${f.e}`).join(", ")}`:""}.`});}
  return{pick,headline:`Scout pick: ${pick.web_name}`,meta:`From ${win} projections, ${S2.name.toLowerCase()}, fixtures and your league`,pts};
}
const CP_KIND={good:["check","#3DDC97"],warn:["triangle-alert","#F5B841"],next:["arrow-right","#6FB7FF"],info:["info","#9A9A9A"]};
function cpScoutHTML(v){
  const md=t=>esc(t).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>");
  return `<div class="cpscout"><span class="cpav">${window.scoutAvatar||""}</span>
    <div class="cpsb"><div class="cphl">${esc(v.headline)}</div><div class="cpmt">${esc(v.meta)}</div>
      ${v.pts.map(p=>`<div class="cppt"><i style="background:${CP_KIND[p.kind][1]}22;color:${CP_KIND[p.kind][1]}">${lic(CP_KIND[p.kind][0],12)}</i><span>${md(p.text)}</span></div>`).join("")}</div>
    ${typeof askScout==="function"?`<button class="cpask" onclick="act('pcmpscout')">${lic("message-circle",14)} Ask The Scout</button>`:""}</div>`;
}
/* points: last 6 played (solid) and next 5 predicted (dashed) */
function cpLineHTML(ps,g,W,Hh){
  W=W||1160;Hh=Hh||170;const pad=34,top=14,xs=11,act=ps.map(p=>cpLast6(p,g)),pre=ps.map(p=>[0,1,2,3,4].map(i=>hPts(p,g+i,1)));
  const mx=Math.max(...act.flat(),...pre.flat(),4),X=i=>pad+i*(W-pad-34)/(xs-1),Y=v=>top+(Hh-top)*(1-v/mx),xn=(X(5)+X(6))/2;
  let s=`<svg viewBox="0 0 ${W} ${Hh+26}" width="100%" role="img" aria-label="Points played and predicted">`;
  [0,.5,1].forEach(f=>{const v=mx*f;s+=`<line x1="${pad}" x2="${W-24}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(255,255,255,.06)"/><text x="${pad-8}" y="${Y(v)+3}" text-anchor="end" fill="#555" font-size="10" font-family="Geist Mono">${v.toFixed(0)}</text>`;});
  s+=`<rect x="${xn}" y="${top-6}" width="${W-24-xn}" height="${Hh-top+6}" fill="rgba(255,255,255,.025)" rx="6"/><line x1="${xn}" x2="${xn}" y1="${top-6}" y2="${Hh}" stroke="rgba(255,255,255,.18)" stroke-dasharray="3 4"/>
    <text x="${xn-8}" y="${top+4}" text-anchor="end" fill="#6E6E6E" font-size="10.5">Played</text><text x="${xn+8}" y="${top+4}" fill="#6E6E6E" font-size="10.5">Predicted</text>`;
  for(let i=0;i<xs;i++)if(g-6+i>=1)s+=`<text x="${X(i)}" y="${Hh+18}" text-anchor="middle" fill="${i>=6?"#BDBDBD":"#6E6E6E"}" font-size="10.5">GW${g-6+i}</text>`;
  ps.forEach((p,j)=>{const a=act[j].map((v,i)=>[X(i),Y(v)]),b=pre[j].map((v,i)=>[X(i+6),Y(v)]),c=CP_COL[j];
    s+=`<polyline points="${a.map(q=>q.join(",")).join(" ")}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round"/>`;
    s+=`<polyline points="${[a[5],...b].map(q=>q.join(",")).join(" ")}" fill="none" stroke="${c}" stroke-width="2.2" stroke-dasharray="5 4" stroke-linejoin="round"/>`;
    [...a,...b].forEach(([x,y],i)=>{s+=`<circle cx="${x}" cy="${y}" r="${i>=6?3.2:2.6}" fill="${i>=6?"#101010":c}" stroke="${c}" stroke-width="1.8"><title>${esc(p.web_name)} GW${g-6+i}: ${(i>=6?pre[j][i-6]:act[j][i]).toFixed(i>=6?1:0)}</title></circle>`;});});
  return s+`</svg>`;
}
const cpLegend=ps=>`<span class="cpleg">${ps.map((p,i)=>`<span><i style="background:${CP_COL[i]}"></i>${esc(p.web_name)}</span>`).join("")}</span>`;
function cpRadarHTML(ps,keys){
  const W=520,cx=W/2,cy=250,R=175,n=keys.length,ang=i=>-Math.PI/2+i*2*Math.PI/n,pt=(i,r)=>[cx+Math.cos(ang(i))*r,cy+Math.sin(ang(i))*r];
  const poly=f=>keys.map((_,i)=>pt(i,R*f).join(",")).join(" ");
  let s=`<svg viewBox="-60 0 ${W+120} 500" width="100%" role="img" aria-label="Radar: how each player compares with regular starters in his position">`;
  [.25,.5,.75,1].forEach(q=>{s+=`<polygon points="${poly(q)}" fill="${q===1?"rgba(255,255,255,.02)":"none"}" stroke="rgba(255,255,255,${q===1?.14:.06})"/>`;});
  s+=`<polygon points="${poly(.9)}" fill="none" stroke="#3DDC97" stroke-opacity=".45" stroke-dasharray="2 5"/><polygon points="${poly(.5)}" fill="none" stroke="rgba(255,255,255,.28)" stroke-dasharray="4 4"/>`;
  keys.forEach((k,i)=>{const[x,y]=pt(i,R);s+=`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(255,255,255,.06)"/>`;
    const[lx,ly]=pt(i,R+38),anc=Math.abs(lx-cx)<8?"middle":lx>cx?"start":"end";
    const prs=ps.map(p=>cpPr(k,p)),vs=prs.map(r=>r?r.pct:-1),b=Math.max(...vs),j=vs.indexOf(b),tie=vs.filter(v=>v===b).length>1;
    s+=`<text x="${lx}" y="${ly-7}" text-anchor="${anc}" dominant-baseline="middle" fill="#DCDCDC" font-size="16" font-weight="500">${CP_ST[k][4]}</text>
      <text x="${lx}" y="${ly+11}" text-anchor="${anc}" dominant-baseline="middle" font-size="13.5" fill="${tie||b<0?"#6E6E6E":CP_COL[j]}">${tie||b<0?"level":`${esc(ps[j].web_name)} · #${prs[j].rank}`}</text>`;});
  ps.forEach((p,j)=>{const rs=keys.map(k=>cpPr(k,p)),v=rs.map(r=>r?r.pct:0),c=CP_COL[j];
    s+=`<polygon points="${v.map((q,i)=>pt(i,R*Math.max(4,q)/100).join(",")).join(" ")}" fill="${c}" fill-opacity=".12" stroke="${c}" stroke-width="2.2" stroke-linejoin="round"/>`;
    v.forEach((q,i)=>{const[x,y]=pt(i,R*Math.max(4,q)/100);s+=`<circle cx="${x}" cy="${y}" r="3.5" fill="${c}"><title>${esc(p.web_name)} · ${CP_ST[keys[i]][0]}: ${rs[i]?cpRkT(rs[i])+" regular starters":"no figure"}</title></circle>`;});});
  return s+`</svg>`;
}
function playerCompareHTML(){
  const ids=S.pTicks||[];if(!S.pCmp||!ids.length||!S.model)return "";
  const ps=ids.map(i=>S.model.players.find(p=>p.id===i)).filter(Boolean);
  const r=lGwRange(),g=r.from,H=Math.max(1,r.count),win=H>1?`GW${g}–${g+H-1}`:`GW${g}`;
  const S2=cpSet(ps),view=S.pCmpView==="stats"?"stats":"radar",xp=p=>hPts(p,g,H);
  const ctl=`<span class="cpchip">${lic("sparkles",13)} ${S2.name}</span>
    <span class="hz cpseg" role="group" aria-label="View"><button class="${view==="radar"?"on":""}" aria-pressed="${view==="radar"}" onclick="act('pcmpview','radar')">Radar</button><button class="${view==="stats"?"on":""}" aria-pressed="${view==="stats"}" onclick="act('pcmpview','stats')">Stats</button></span>`;
  const lines=(W,Hh)=>`<div class="cppanel cpline"><div class="cpph2"><b>Points: Last 6 Played, Next 5 Predicted</b>${cpLegend(ps)}</div>${cpLineHTML(ps,g,W,Hh)}</div>`;
  let body;
  if(view==="radar"){
    const v=ps.length>1?cpVerdict(ps,g,H,win):null;
    const cards=ps.map((p,i)=>{const rv=cpRiv(p);
      return `<div class="cpins"><span class="cpav2 sm" style="--c:${CP_COL[i]};--k:${cpKit(p)}">${cpPhoto(p,"cpimg",36)}</span>
        <div class="cpinm"><div class="cpnm"><i style="background:${CP_COL[i]}"></i>${pName(p)}${v&&p===v.pick?`<span class="cppick">Scout pick</span>`:""}</div>
          <div class="cpm">${esc(p.teamName)} · £${p.price.toFixed(1)} · ${p.owned.toFixed(1)}%${rv?` · ${rv.k}/${rv.n} rivals`:""}</div>${cpChips(p,S2.keys)}</div>
        <div class="cpfx">${fixPills(p,g,5)}</div>
        <div class="cpxp">${xp(p).toFixed(1)}<small>xPts ${win}</small></div></div>`;}).join("");
    body=`<div class="cprgrid"><div class="cpcol"><div class="cppanel cprad"><div class="cpph2"><b>${S2.pos?CP_POS[S2.pos]:"Player"} Profile</b><span>Against regular starters in his position · <span style="color:#3DDC97">┄ top 10%</span> · - - average · leader and his rank under each stat</span></div>
        <div class="cpradsvg">${cpRadarHTML(ps,S2.keys)}</div></div>${lines(760,140)}</div>
      <div class="cpcol">${v?cpScoutHTML(v):""}<div class="cpinsl">${cards}</div></div></div>`;
  }else{
    const n=ps.length,cols=`grid-template-columns:170px repeat(${n},minmax(0,1fr))`,wins=ps.map(()=>0);
    const row=(label,small,vals,fmt,bar,better)=>{const best=cpBest(vals,better);
      return `<div class="cprl"${small?` title="${esc(small)}"`:""}>${label}</div>`+vals.map((v,i)=>{if(v==null)return `<div class="cprc"><div class="cpval">—</div></div>`;
        const w=best!=null&&v===best;if(w)wins[i]++;const b=bar(v,i);
        return `<div class="cprc${w?" win":""}"><div class="cpval"><span>${fmt(v)}${w?"<b>▲</b>":""}</span><i>${b&&b.cap||""}</i></div>${b?`<div class="cptr"><span style="width:${Math.max(3,b.w)}%"></span></div>`:""}</div>`;}).join("");};
    const OUT=[[`xPts ${win}`,xp,v=>v.toFixed(1),1],["xPts Next GW",p=>hPts(p,g,1),v=>v.toFixed(1),1],["Expected Minutes",p=>p.xMins||0,v=>Math.round(v)+"′",1],
      ["Form",p=>+p.form||0,v=>v.toFixed(1),1]]; /* price and ownership are on the hero cards */
    const outl=OUT.map(([l,f,fm,b])=>{const v=ps.map(f),mx=Math.max(...v.map(x=>Math.abs(x||0)),1e-9);return row(l,"",v,fm,x=>b?{w:100*Math.abs(x)/mx}:null,b);}).join("");
    const rivRow=`<div class="cprl" title="Your league">Owned by Rivals</div>`+ps.map(p=>{const rv=cpRiv(p);
      return `<div class="cprc"><div class="cpval cpdots">${rv?`<span>${Array.from({length:rv.n},(_,i)=>`<i class="${i<rv.k?"on":""}"></i>`).join("")}</span>${rv.k} of ${rv.n}`:"—"}</div></div>`;}).join("");
    const stats=S2.keys.map(k=>row(CP_ST[k][0],CP_ST[k][1],ps.map(p=>cpVal(k,p)),CP_ST[k][2],(x,i)=>{const pr=cpPr(k,ps[i]);return pr?{w:pr.pct,cap:cpRk(pr)}:null;},CP_ST[k][3])).join("");
    const heroes=ps.map((p,i)=>`<div class="cphero" style="--k:${cpKit(p)}">${cpPhoto(p,"cpph",96)}<span class="cpdot" style="background:${CP_COL[i]}"></span>
      <div class="cpht"><div class="cphn">${pName(p,"big")}</div><div class="cphm">${esc(p.teamName)} · ${POS[p.pos]} · £${p.price.toFixed(1)} · ${p.owned.toFixed(1)}%</div><div class="cpsig">${sigHTML(p,g)}</div></div>
      <div class="cpht"><div class="cpbig">${xp(p).toFixed(1)}</div><div class="cpbl">xPts ${win}</div></div></div>`).join("");
    const tot=wins.reduce((a,b)=>a+b,0),lead=wins.indexOf(Math.max(...wins));
    const vbar=tot?`<div class="cpwins"><span><b>${esc(ps[lead].web_name)}</b> wins ${wins[lead]} of ${tot} rows</span><span class="cpwbar">${ps.map((p,i)=>`<span style="flex:${wins[i]||0.0001};background:${CP_COL[i]}"></span>`).join("")}</span><span class="cpleg">${ps.map((p,i)=>`<span><i style="background:${CP_COL[i]}"></i>${esc(p.web_name)} ${wins[i]}</span>`).join("")}</span></div>`:"";
    const fxr=ps.map(p=>`<div class="cprc">${fxNext(p,g,5)}</div>`).join("");
    body=`<div class="cpscroll cpsfill"><div class="cpstats">
      <div class="cprows" style="${cols}"><div class="cpnote"># is his rank among regular starters in his position (1 is best). Green: best of the group.</div>${heroes}</div>
      ${vbar?`<div class="cprows" style="${cols}"><div></div><div style="grid-column:2/-1">${vbar}</div></div>`:""}
      <div class="cpsec">Outlook</div><div class="cprows cpout" style="${cols}">${outl}${rivRow}</div>
      <div class="cpsec">${S2.name}</div><div class="cprows" style="${cols}">${stats}</div>
      <div class="cpsec">Fixtures</div><div class="cprows cpfxrow" style="${cols}"><div class="cprl">Next 5</div>${fxr}</div></div></div>`;
  }
  return modalHTML(`Compare ${ps.length} Player${ps.length>1?"s":""}`,`<div class="cpbody">${body}</div>`,{wide:true,ctl,close:"pcmpclose",cls:"cpfull"});
}
/* compare tray: docked at the bottom of Player Data once a player is ticked */
function cmpTrayHTML(){
  const ps=(S.pTicks||[]).map(i=>S.model.players.find(p=>p.id===i)).filter(Boolean);if(!ps.length)return "";
  const slots=ps.map((p,i)=>`<span class="cpsw"><span class="cpav2 sm" style="--c:${CP_COL[i]};--k:${cpKit(p)}">${cpPhoto(p,"cpimg",34)}</span>
      <button class="cprm" onclick="act('tick',${p.id})" aria-label="Remove ${esc(p.web_name)}">${lic("x",11)}</button><span class="cpsn">${esc(p.web_name)}</span></span>`).join("")
    +Array.from({length:5-ps.length},()=>`<span class="cpem" aria-hidden="true">+</span>`).join("");
  return `<div class="cptrayspace"></div><div class="cptray" role="region" aria-label="Compare tray"><div class="cptl"><b>Compare</b><span>${ps.length} of 5 ticked</span></div>
    <div class="cpslots">${slots}</div><span class="cpdiv"></span><button class="cpclr" onclick="act('tickclear')">Clear</button>
    <button class="cpgo" onclick="act('pcmp')"${ps.length<2?" disabled":""}>${ps.length<2?"Tick one more":`Compare ${ps.length} players ${lic("arrow-right",15)}`}</button></div>`;
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
/* 22 Nov 2026 (Andy): Signals › Transfers removed; the Planner's Transfers
   pop-up holds best moves, the plan, funding and the rest */
const SG_TABS=[["players","Players"],["clubs","Clubs"],["markets","Markets"],["season","My Season"]];
const SG_TONE={mint:"#3DDC97",red:"#FF5A6E",amber:"#FFB020",grey:"#8A8A8A",ice:"#BAE6FD",purple:"#B388FF",cyan:"#22D3EE"};
function rep(key,icon,title,info,body,o){
  o=o||{};const shut=(S.sigFold||[]).includes(key);
  return `<section class="rep sgcard${o.wide?" wide":""}${o.bare?" bare":""}${shut?" shut":""}" id="r-${key}">
    <header class="rh"><span class="rhi">${lic(icon,16)}</span><h3>${title}</h3>${o.badge!=null?`<span class="rbadge">${o.badge}</span>`:""}${o.extra||""}
      ${info?`<button class="fci" data-tip="${esc(info)}" aria-label="About ${esc(title)}">i</button>`:""}
      <button class="rfold sgfold" onclick="act('sigfold','${key}')" aria-expanded="${!shut}" aria-label="${shut?"Open":"Fold"} ${esc(title)}">${lic(shut?"chevron-down":"chevron-up",14)}</button></header>
    ${shut?"":`<div class="rb">${body}</div>`}</section>`;
}
/* the card header for a fixed panel (Planner: Player Pool, GW Review, Live):
   icon, title, controls right, (i); no fold, the panel fills its column */
const pnlHead=(icon,title,info,extra)=>`<header class="rh pnl-h"><span class="rhi">${lic(icon,16)}</span><h3>${title}</h3>${extra||""}${info?`<button class="fci" data-tip="${esc(info)}" aria-label="About ${esc(title)}">i</button>`:""}</header>`;
const sgEmpty=t=>`<p class="sgempty">${t}</p>`;
/* key figures: [{label, value, sub, tone}] */
const rkv=figs=>`<div class="rkv">${figs.map(f=>`<div><span>${f.label}</span><b class="${f.tone||""}">${f.value}</b>${f.sub?`<em>${f.sub}</em>`:""}</div>`).join("")}</div>`;
/* ranked bars: rows [{label, sub, value, show, tone, pid, mine, extra}] */
function hbars(rows,o){
  o=o||{};if(!rows.length)return sgEmpty(o.empty||"Nobody right now.");
  const mx=Math.max(...rows.map(r=>Math.max(Math.abs(r.value),r.tick||0)),1e-9),lo=o.from!=null?o.from:0;
  return `<div class="hb${o.diverge?" dv":""}">${rows.map((r,i)=>{
    const w=o.diverge?Math.abs(r.value)/mx*50:Math.max(2,(r.value-lo)/((mx-lo)||1)*100);
    const tone=r.tone||(o.diverge?(r.value>=0?SG_TONE.mint:SG_TONE.red):SG_TONE.mint);
    return `<div class="hbr${r.mine?" me":""}"${r.pid?` onclick="act('card',${r.pid})"`:""}>
      ${o.rank?`<span class="hbn">${i+1}</span>`:""}<span class="hbl${r.p||r.club?" sx-l":""}">${r.p||r.club?sgWho(r):""}<span class="sx-t"><b>${r.label}</b>${r.sub?`<em>${r.sub}</em>`:""}</span></span>
      <span class="hbt"><i class="${o.diverge?(r.value<0?"neg":"pos"):""}" style="width:${w.toFixed(1)}%;background:${tone}"></i>${r.tick!=null&&!o.diverge?`<b class="hbk" style="left:${Math.min(99,Math.max(0,(r.tick-lo)/((mx-lo)||1)*100)).toFixed(1)}%" title="Model ${r.tickShow||r.tick}"></b>`:""}</span>
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
        g+=`<rect class="cbar" x="${(x0+(slot-bw*n)/2+bw*k).toFixed(1)}" y="${yt.toFixed(1)}" width="${(bw-2).toFixed(1)}" height="${Math.max(.5,yb-yt).toFixed(1)}" rx="4" fill="${typeof b.color==="function"?b.color(v,i):b.color}" data-tip="${esc(c)}|${esc(b.name)} ${fmt(v)}|${esc((b.notes||[])[i]||"")}"/>`;});}
    g+=`<text class="cax" x="${(x0+slot/2).toFixed(1)}" y="${H-6}" text-anchor="middle">${esc(c)}</text>`;
  });
  lines.forEach(l=>{const pts=l.values.map((v,i)=>v==null?null:[pl+slot*i+slot/2,y(v)]);
    const seg=pts.filter(Boolean).map(p=>p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ");
    if(!l.dotsOnly)g+=`<polyline points="${seg}" fill="none" stroke="${l.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${l.dash?' stroke-dasharray="4 4"':""}/>`;
    pts.forEach((p,i)=>{if(p)g+=`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${l.dotsOnly?4:3}" fill="${l.color}" data-tip="${esc(cats[i])}|${esc(l.name)} ${fmt(l.values[i])}|"/>`;});});
  const legend=[...bars.map(b=>[b.name,typeof b.color==="function"?(b.key||"#8A8A8A"):b.color,"sq"]),...lines.map(l=>[l.name,l.color,l.dotsOnly?"dot":"ln"])];
  return `<div class="chartbox"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label||"Chart")}">${g}</svg>
    ${legend.length>1||o.legend?`<div class="clegend">${legend.map(([n,c,k])=>`<span><i class="${k}" style="background:${c}"></i>${esc(n)}</span>`).join("")}</div>`:""}</div>`;
}
/* chance of playing as a ring */
const sgPos=p=>`<span class="sgpos p${p.pos}">${POS[p.pos]}</span>`;

/* ============================================================
   SIGNALS, Bundle C (22 Nov 2026, Andy's approved mocks). What the game is
   doing and how your season is going, at a glance; the Team Planner's This
   Week pop-ups answer "what do I do this week". Three tabs:
     Players    the market: the Signal Board, leaders by position, form,
                Sell Signals, the game's picks and value
     Clubs      the season so far: form table, attack against defence,
                opponents to target, fixture runs on the Teams Overall score
     My Season  you against the game and your league
   Every row has a face (photo, else kit) and a club crest; one 1 / 3 / 5 /
   ROS switch (hz4HTML) on Players and Clubs; explanations sit in (i).
   ============================================================ */
const sgTeamOf=p=>p&&(S.teams||[]).find(t=>t.short===p.teamName);
const sgHn=(G)=>S.sigH==="ros"?Math.max(1,39-G):(+S.sigH||3);
const sgHzL=H=>H>=39-S.model.next.id?"rest of the season":H>1?`next ${H}`:"next GW";
/* the page: header with figure cards, tabs and the window, then the tab */
function signalsHTML(){
  if(!S.model)return "";
  /* Signals looks ahead from the next deadline, not the week the Planner is
     viewing (a week in play has no projections left to rank) */
  const G=S.model.next.id,H=sgHn(G),tab=SG_TABS.some(([k])=>k===S.sgTab)?S.sgTab:"players";
  const body={players:sgPlayers,clubs:sgClubs,markets:sgMarkets,season:sgSeason}[tab](G,H);
  const dl=deadlineInfo();
  const hz=tab==="season"?"":tab==="markets"?`<span class="mk-src">GW${G} · ${esc((S.oddsBooks||[]).filter(b=>!/william/i.test(b)).join(" and ")||"Bookmakers")}${S.oddsFetchedAt?" · updated "+esc(agoText(S.oddsFetchedAt)):""}</span>`:hz4HTML(S.sigH==="ros"?"ROS":(+S.sigH||3),"sigh");
  return `<div class="sgpage" data-tab="${tab}">
    <div class="sx-hdr"><div><div class="cx-kick">GW${G}${dl?` · Deadline ${esc(dl.when)}`:""}</div><h1>Signals</h1>
      <div class="sx-ctl"><span class="pseg sgtabs">${SG_TABS.map(([k,n])=>`<button class="${tab===k?"on":""}" onclick="act('sgtab','${k}')">${n}</button>`).join("")}</span>${hz}</div></div>
      <div class="nw-figs sx-figs">${tab==="markets"?sgMkFigs(G):sgFigs(G,H)}</div></div>
    <div class="repgrid">${body}</div></div>`;
}
/* the four figure cards: Overall Rank, Top Buy, Easiest Run, Price Rises Tonight */
function sgFigs(G,H){
  const T=((S.tracker&&S.tracker.gw)||[]).filter(r=>r.orRank).sort((a,b)=>a.event-b.event);
  const last=T[T.length-1],prev=T[T.length-2];
  const rk=last?figCard("Overall Rank","Your overall rank, after the latest gameweek.",last.orRank.toLocaleString(),
    prev&&prev.orRank!==last.orRank?`<span class="${prev.orRank>=last.orRank?"up":"dn"}">${prev.orRank>=last.orRank?"▲":"▼"} ${Math.abs(prev.orRank-last.orRank).toLocaleString()}</span>`:"",T.slice(-10).map(r=>-r.orRank),"#3DDC97"):figCard("Overall Rank","Your overall rank.","—","",null);
  const mine=new Set(S.squad||[]);
  const buys=S.model.players.filter(p=>!mine.has(p.id)&&signals(p,G,true,H).some(([k])=>k==="buy")).sort((a,b)=>hPts(b,G,H)-hPts(a,G,H));
  const tb=buys[0];
  const buy=figCard("Top Buy",`The best player to bring in over the ${sgHzL(H)}.`,tb?`<span class="sx-fp">${dsFace(tb)}${esc(tb.web_name)}</span>`:"—",
    tb?`${hPts(tb,G,H).toFixed(1)} pts · £${tb.price.toFixed(1)}`:"Nobody right now",null);
  const runs=sgRuns(G,H),er=runs[0];
  const run=figCard("Easiest Run",`The club with the best fixtures over the ${sgHzL(H)}, on the Teams Overall score.`,er?`<span class="sx-fp">${dsBadge(er.t,24)}${esc(er.t.name)}</span>`:"—",
    er?`${er.v.toFixed(1)} pts / GW`:"",null);
  const L=p=>fplLive(p)||{};
  const rise=S.model.players.filter(p=>(L(p).pcp||0)>=100).sort((a,b)=>(L(b).pcp||0)-(L(a).pcp||0));
  const pr=figCard("Price Rises Tonight","Players due to rise tonight on FPL's own progress.",String(rise.length),
    rise[0]?`<span class="sx-fp sm">${dsFace(rise[0])}${esc(rise[0].web_name)}${rise.length>1?` + ${rise.length-1}`:""}</span>`:"None due",null);
  return rk+buy+run+pr;
}
/* a ranked bar row's label: face and crest for a player, crest for a club */
const sgWho=(r)=>r.p?`${dsFace(r.p)}${dsBadge(sgTeamOf(r.p),16)}`:r.club?dsBadge(r.club,24):"";

/* ---------------- Markets (26 Nov 2026, Andy approved mock v2) ----------------
   The bookmakers' view of the next gameweek at a glance, margin removed:
   match odds, clean sheets, team goals, haul chance, anytime goal, assist,
   booking risk, and where the market and the model disagree most. Next
   gameweek only (that is all the market prices); the model's figure is the
   white tick. Player markets come close to kick-off, so early in a week
   some lists are short. */
function sgMk(G){
  if(S._mkC&&S._mkC.m===S.model&&S._mkC.at===S.oddsFetchedAt&&S._mkC.g===G)return S._mkC.d;
  const ok=S.oddsState==="ok";
  const inGw=new Set((S.model.byEv[G]||[]).filter(f=>f.ht&&f.at).map(f=>f.ht.id+"-"+f.at.id));
  let fx=[],op=[];
  try{if(ok)fx=oddsFixtures().filter(f=>f.ht&&f.at&&inGw.has(f.ht.id+"-"+f.at.id)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));}catch(e){}
  try{if(ok)op=Object.values(oddsPlayers(G)||{}).filter(r=>r&&r.p&&((r.p.roleMins||0)>0||(r.p.minutes||0)>0));}catch(e){}
  const mdl=(t,o,home,k)=>{try{return fdrCalc(t,o,home,k);}catch(e){return null;}};
  const teams=[];
  fx.forEach(f=>{const g=f.goals;if(!g)return;
    [[f.ht,f.at,true,g.xgHome,g.csHome,g.haulHome],[f.at,f.ht,false,g.xgAway,g.csAway,g.haulAway]].forEach(([t,o,home,xg,cs,haul])=>{
      const mxg=mdl(t,o,home,"xgf"),mxc=mdl(t,o,home,"xgc");
      const lam=mxg||0,pHaul=1-Math.exp(-lam)*(1+lam+lam*lam/2);
      teams.push({t,o,home,xg,cs,haul,mxg,mcs:mxc!=null?Math.exp(-mxc):null,mhaul:mxg!=null?pHaul:null});});});
  const d={fx,op,teams};
  S._mkC={m:S.model,at:S.oddsFetchedAt,g:G,d};
  return d;
}
Object.assign(LUCIDE,{"scale":'<path d="M12 3v18"/><path d="m19 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"/><path d="m5 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M7 21h10"/>',
  "goal":'<path d="M12 13V2l8 4-8 4"/><path d="M20.561 10.222a9 9 0 1 1-12.55-5.29"/><path d="M8.002 9.997a5 5 0 1 0 8.9 2.02"/>',
  "split":'<path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/>'});
const mkPct=v=>v==null?"—":Math.round(v*100)+"%";
function sgMkFigs(G){
  const{fx,op,teams}=sgMk(G);
  const fest=fx.filter(f=>f.goals).sort((a,b)=>(b.goals.xgHome+b.goals.xgAway)-(a.goals.xgHome+a.goals.xgAway))[0];
  const cs=teams.slice().sort((a,b)=>b.cs-a.cs)[0];
  const sc=op.filter(r=>r.goal!=null).sort((a,b)=>b.goal-a.goal)[0];
  const club=(t,txt)=>`<span class="sx-fp">${dsBadge(t,22)}${esc(txt)}</span>`;
  return [figCard("Goal-Fest Game","The match with the most goals expected.",fest?club(fest.ht,fest.ht.short+" v "+fest.at.short):"—",fest?(fest.goals.xgHome+fest.goals.xgAway).toFixed(1)+" goals expected":"",null),
    figCard("Clean-Sheet Banker","The likeliest clean sheet this gameweek.",cs?club(cs.t,cs.t.name):"—",cs?`${mkPct(cs.cs)} v ${esc(cs.o.short)}`:"",null),
    figCard("Likeliest Scorer","The player most likely to score, if he plays.",sc?`<span class="sx-fp">${dsFace(sc.p)}${esc(sc.p.web_name)}</span>`:"—",sc?mkPct(sc.goal)+" to score":"",null),
    figCard("Players Priced","Players with a goalscorer price this gameweek.",String(op.filter(r=>r.goal!=null).length),`${new Set(op.filter(r=>r.goal!=null).map(r=>r.fx)).size} of ${(S.model.byEv[G]||[]).length} matches`,null)].join("");
}
function sgMarkets(G){
  const{fx,op,teams}=sgMk(G),mine=new Set(S.squad||[]);
  if(!fx.length&&!op.length)return rep("mkt-none","scale","Markets","The bookmakers' prices for the next gameweek.",sgEmpty(S.oddsState==="ok"?`The bookmakers have not priced GW${G} yet.`:"Odds have not loaded."),{wide:1});
  const h2h=f=>{const ls=f.mk["h2h"]||[],ps=ls.map(l=>{const o=n=>(l.outcomes||[]).find(x=>x.name===n);const h=o("home"),dr=o("draw"),a=o("away");return h&&dr&&a?devig([h.price,dr.price,a.price]):null;}).filter(Boolean);
    return ps.length?[0,1,2].map(i=>ps.reduce((s,p)=>s+p[i],0)/ps.length):null;};
  const kick=f=>f.date?ukFmt(new Date(f.date),{weekday:"short",hour:"2-digit",minute:"2-digit"}):"";
  const tile=f=>{const r=h2h(f),g=f.goals;
    return `<div class="mk-m"><div class="mk-mt">${dsBadge(f.ht,20)}<b>${esc(f.ht.short)}</b><span class="mk-v">v</span><b>${esc(f.at.short)}</b>${dsBadge(f.at,20)}<em>${esc(kick(f))}</em></div>
      ${r?`<div class="mk-bar"><span style="flex:${r[0]};background:#3DDC97" title="${esc(f.ht.name)} win">${mkPct(r[0])}</span><span style="flex:${r[1]}" class="d" title="Draw">${mkPct(r[1])}</span><span style="flex:${r[2]};background:#7AA2FF" title="${esc(f.at.name)} win">${mkPct(r[2])}</span></div>`:'<div class="mk-bar none">no result price</div>'}
      <div class="mk-ml"><span>Goals <b>${g?g.xgHome.toFixed(1)+"–"+g.xgAway.toFixed(1):"—"}</b></span><span>CS <b>${g?mkPct(g.csHome)+" · "+mkPct(g.csAway):"—"}</b></span></div></div>`;};
  const match=rep("mkt-match","scale","Match Odds","Win chances, goals and clean sheets for every match.",
    `<div class="mk-mg">${fx.map(tile).join("")}</div><div class="mk-key"><span><i style="background:#3DDC97"></i>Home win</span><span><i style="background:#5A5A5A"></i>Draw</span><span><i style="background:#7AA2FF"></i>Away win</span></div>`,{wide:1});
  const teamBars=(k,mk,fmt,tone,n)=>hbars(teams.filter(x=>x[k]!=null).sort((a,b)=>b[k]-a[k]).slice(0,n||8).map(x=>({club:x.t,label:esc(x.t.short),sub:(x.home?"v ":"@ ")+esc(x.o.short),value:x[k],show:fmt(x[k]),tick:x[mk],tickShow:x[mk]!=null?fmt(x[mk]):null,tone})),{rank:1,empty:"Not priced yet."});
  const pBars=(k,tone,model,n)=>hbars(op.filter(r=>r[k]!=null).sort((a,b)=>b[k]-a[k]).slice(0,n||8).map(r=>{const m=model?model(r.p):null,br=banRisk(r.p,G);
    return{p:r.p,pid:r.p.id,mine:mine.has(r.p.id),label:esc(r.p.web_name),sub:`${esc(r.p.teamName)} · ${POS[r.p.pos]}`,value:r[k],show:mkPct(r[k]),tick:m,tickShow:m!=null?mkPct(m):null,tone,
      extra:br&&k==="card"?`<span class="mk-ban" title="${esc(br.tip)}">${lic("rectangle-vertical",13)}</span>`:""};}),{rank:1,empty:"Not priced yet: player markets open close to kick-off."});
  /* market against model on a goal or assist, the largest gaps either way */
  const gaps=op.map(r=>{const v=mkRet(r);if(v==null)return null;const m=1-(1-modelChance(r.p,r.p.xg90||0))*(1-modelChance(r.p,r.p.xa90||0));return{r,v,m,d:v-m};}).filter(Boolean);
  const dumb=(rows,tone)=>rows.length?`<div class="mk-db">${rows.map(x=>`<div class="mk-d${mine.has(x.r.p.id)?" me":""}" onclick="act('card',${x.r.p.id})"><span class="hbl sx-l">${sgWho({p:x.r.p})}<span class="sx-t"><b>${esc(x.r.p.web_name)}</b><em>${esc(x.r.p.teamName)} · ${POS[x.r.p.pos]}</em></span></span>
      <span class="mk-dt" title="Market ${mkPct(x.v)} · model ${mkPct(x.m)}"><span class="mk-line" style="left:${(Math.min(x.v,x.m)*100).toFixed(1)}%;width:${(Math.abs(x.v-x.m)*100).toFixed(1)}%"></span><span class="mk-dot md" style="left:${(x.m*100).toFixed(1)}%"></span><span class="mk-dot" style="left:${(x.v*100).toFixed(1)}%;background:${tone}"></span></span>
      <b style="color:${tone}">${x.d>0?"+":"−"}${Math.round(Math.abs(x.d)*100)}</b></div>`).join("")}</div>`:sgEmpty("Not priced yet.");
  const hi=gaps.filter(x=>x.d>0).sort((a,b)=>b.d-a.d).slice(0,6),lo=gaps.filter(x=>x.d<0).sort((a,b)=>a.d-b.d).slice(0,6);
  return match
    +rep("mkt-cs","shield","Clean Sheets","Bookmakers' clean-sheet chance; the tick is the model's.",teamBars("cs","mcs",mkPct,SG_TONE.cyan))
    +rep("mkt-goals","goal","Team Goals","Goals each team is expected to score; the tick is the model's.",teamBars("xg","mxg",v=>v.toFixed(1),SG_TONE.mint))
    +rep("mkt-goal","goal","Anytime Goal","Chance he scores, if he plays; the tick is the model's.",pBars("goal",SG_TONE.mint,p=>modelChance(p,p.xg90||0)))
    +rep("mkt-assist","target","Assist","Chance he assists, if he plays; the tick is the model's.",pBars("assist","#7AA2FF",p=>modelChance(p,p.xa90||0)))
    +rep("mkt-card","rectangle-vertical","Booking Risk","Chance he is booked; a card means one more yellow is a ban.",pBars("card","#FACC15",null))
    +rep("mkt-haul","flame","Haul Chance","Chance the team scores 3 or more: where attackers haul.",teamBars("haul","mhaul",mkPct,"#FF8A3D"))
    +rep("mkt-hi","split","Market Higher","Biggest gaps where the market rates him above the model for a goal or assist.",dumb(hi,SG_TONE.mint))
    +rep("mkt-lo","split","Market Lower","Biggest gaps where the market rates him below the model for a goal or assist.",dumb(lo,SG_TONE.red));
}
/* ---------------- Players ---------------- */
function sgBoardHTML(G,H){
  const mine=new Set(S.squad||[]),by={};SIG_ORDER.forEach(k=>by[k]=[]);
  S.model.players.forEach(p=>signals(p,G,false,H).forEach(([k,t])=>by[k].push({p,t})));
  const rank=(a,b)=>(mine.has(b.p.id)-mine.has(a.p.id))||(hPts(b.p,G,H)-hPts(a.p,G,H));
  return `<div class="sbgrid">${SIG_ORDER.map(k=>{const list=by[k].sort(rank);
    const rows=list.slice(0,4).map(({p,t})=>`<div class="sbrow sx-sb" onclick="act('card',${p.id})" title="${esc(t)}">
      <span class="sx-sbf">${dsFace(p)}${dsBadge(sgTeamOf(p),16)}</span>
      <span class="sbn">${esc(p.web_name)}${mine.has(p.id)?' <span class="sgmine">You</span>':""}</span>
      <span class="sbm">${esc(p.teamName)} · ${POS[p.pos]} · £${p.price.toFixed(1)}</span>
      <span class="sbv">${hPts(p,G,H).toFixed(1)}</span></div>`).join("");
    return `<section class="sbcard"><header>${sigTile(k,SIG_RULE[k](H))}<h3>${SIGNAL[k][2]}</h3><span class="sbc">${list.length}</span></header>
      ${rows||'<p class="sgempty">Nobody right now.</p>'}${list.length>4?`<div class="sbmore">+${list.length-4} more · <a href="${routeFor("table")}" onclick="S.iconF=['${k}'];S.pdMore=true;return go(event,'table')">see all</a></div>`:""}</section>`;}).join("")}</div>`;
}
function sgPlayers(G,H){
  const M=S.model,mine=new Set(S.squad||[]);
  const avail=p=>p.status==="a"||p.status==="d";
  const lr=(p,v,show,sub,tone)=>({p,label:esc(p.web_name),sub:sub||`${esc(p.teamName)} · ${POS[p.pos]}`,value:v,show,pid:p.id,tone,mine:mine.has(p.id)});
  /* Leaders by Position: Top Predicted and Top Scorers in one card */
  const scored=S.sgLead==="scored";
  const lead=`<div class="sgcols">${[1,2,3,4].map(pos=>{const ps=M.players.filter(p=>p.minutes>0&&p.pos===pos&&(scored||avail(p)))
      .sort((a,b)=>scored?b.total-a.total:hPts(b,G,H)-hPts(a,G,H)).slice(0,5);
    return `<div class="sgcol hbcol"><div class="sgcolh">${POS[pos]}</div>${hbars(ps.map(p=>scored?lr(p,p.total,String(p.total),`${esc(p.teamName)} · ${p.ppg.toFixed(1)} ppg`):lr(p,hPts(p,G,H),hPts(p,G,H).toFixed(1),`${esc(p.teamName)} · ${Math.round(p.xMins||0)}′`)),{rank:true})}</div>`;}).join("")}</div>`;
  const leadTog=`<span class="sx-tog">${[["pred","Predicted"],["scored","Scored"]].map(([k,l])=>`<button class="${(S.sgLead||"pred")===k?"on":""}" onclick="act('sglead','${k}')">${l}</button>`).join("")}</span>`;
  const form=hbars(M.players.filter(p=>!mine.has(p.id)&&p.minutes>=180&&avail(p)).sort((a,b)=>b.form-a.form).slice(0,8)
    .map(p=>({...lr(p,p.form,p.form.toFixed(1)),sub:`${esc(p.teamName)} · ${sgPos(p)}`})),{rank:true});
  const cold=M.players.filter(p=>p.owned>=10&&p.form<=3).sort((a,b)=>b.owned-a.owned).slice(0,8);
  const sell=hbars(cold.map(p=>({...lr(p,p.owned,p.owned.toFixed(1)+"%",`${esc(p.teamName)} · form ${p.form.toFixed(1)}`,SG_TONE.red)})),{rank:true,empty:"No template player has gone cold."});
  return `${rep("board","sparkles","Signal Board","Every player carrying each signal now, yours first.",sgBoardHTML(G,H),{wide:true})}
    ${rep("pred","trophy","Leaders by Position",scored?"Season points by position.":"Model points over the window by position.",lead,{wide:true,extra:leadTog})}
    ${rep("form","flame","In Form","Best form among players you don't own.",form)}
    ${rep("sell","trending-down","Sell Signals","Highly owned players in poor form.",sell)}
    ${rep("picks","users","The Game's Picks","What the whole game captained, picked and bought each week.",sgPicksHTML())}
    ${rep("pvalue","wallet","Value","Points per £m by position.",sgValueHTML(G,H),{extra:`<span class="sx-tog">${[[1,"GKP"],[2,"DEF"],[3,"MID"],[4,"FWD"]].map(([k,l])=>`<button class="${(S.sgVPos||3)===k?"on":""}" onclick="act('sgvpos',${k})">${l}</button>`).join("")}</span>`})}`;
}
/* The Game's Picks: the chosen week's four leaders as faces, then the
   chosen measure's leader each week with the points he scored that week */
function sgPicksHTML(){
  const M=S.model,evs=(S.events||[]).filter(e=>e.finished).sort((a,b)=>a.id-b.id);
  if(!evs.length)return sgEmpty("No finished gameweeks yet.");
  const pick=S.sgPick||"bought",K={capt:"mostCapt",sel:"mostSel",bought:"mostIn",top:"topEl"};
  const ev=evs.find(e=>e.id===S.sgPickGw)||evs[evs.length-1],i=evs.indexOf(ev);
  const P=id=>M.players.find(p=>p.id===+id),pts=(id,e)=>{const v=actOf(+id,e);return v==null?null:v;};
  const tile=(l,id,v)=>{const p=P(id);return `<div class="sx-pt"><em>${l}</em>${p?dsFace(p,"lg"):""}<b>${p?esc(p.web_name):"—"}</b><i>${v}</i></div>`;};
  const sel=P(ev.mostSel);
  const tiles=`<div class="sx-pts">${tile("Most Captained",ev.mostCapt,pts(ev.mostCapt,ev.id)!=null?pts(ev.mostCapt,ev.id)+" pts":"—")}${tile("Most Selected",ev.mostSel,sel?sel.owned.toFixed(1)+"%":"—")}
    ${tile("Most Bought",ev.mostIn,pts(ev.mostIn,ev.id)!=null?pts(ev.mostIn,ev.id)+" pts":"—")}${tile("Top Scorer",ev.topEl,ev.topPts!=null?ev.topPts+" pts":"—")}</div>`;
  const wk=evs.slice(-8).map(e=>({e:e.id,p:P(e[K[pick]]),v:pick==="top"?e.topPts:pts(e[K[pick]],e.id)}));
  const W=620,Hh=210,mx=Math.max(4,...wk.map(x=>x.v||0)),bw=34,slot=(W-60)/wk.length;
  const svg=`<svg class="chart" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="The game's pick each week and his points"><line class="czero" x1="10" x2="${W-10}" y1="${Hh-54}" y2="${Hh-54}"/>${wk.map((x,j)=>{const cx=40+j*slot+slot/2-10,h=(x.v||0)/mx*(Hh-90);
    return `<rect x="${(cx-bw/2).toFixed(1)}" y="${(Hh-54-h).toFixed(1)}" width="${bw}" height="${Math.max(1.5,h).toFixed(1)}" rx="4" fill="#3DDC97" opacity="${x.e===ev.id?1:.55}"/>
      <text class="ds-cv" x="${cx.toFixed(1)}" y="${(Hh-60-h).toFixed(1)}" text-anchor="middle">${x.v??"—"}</text>
      ${x.p?`<image href="${imgSrc("player",x.p.code,110)}" x="${(cx-11).toFixed(1)}" y="${Hh-48}" width="22" height="28" preserveAspectRatio="xMidYMin slice"><title>${esc(x.p.web_name)}</title></image>`:""}
      <text class="cax${x.e===ev.id?" ds-now":""}" x="${cx.toFixed(1)}" y="${Hh-6}" text-anchor="middle">GW${x.e}</text>`;}).join("")}</svg>`;
  const nav=`<span class="sx-gw"><button ${i<=0?"disabled":""} onclick="act('sgpickgw',${i>0?evs[i-1].id:ev.id})" aria-label="Previous gameweek">‹</button>GW${ev.id}<button ${i>=evs.length-1?"disabled":""} onclick="act('sgpickgw',${i<evs.length-1?evs[i+1].id:ev.id})" aria-label="Next gameweek">›</button></span>`;
  const tog=`<span class="sx-tog sm">${[["capt","Captained"],["sel","Selected"],["bought","Bought"],["top","Top Scorer"]].map(([k,l])=>`<button class="${pick===k?"on":""}" onclick="act('sgpick','${k}')">${l}</button>`).join("")}</span>`;
  return `<div class="sx-ph">${nav}</div>${tiles}<div class="sx-ph"><span class="sx-half">Points each week</span>${tog}</div>${svg}`;
}
/* Value: one position at a time, its three key figures, then its chart */
function sgValueHTML(G,H){
  const pos=S.sgVPos||3,D=valueData(G,H),d=D[pos];
  if(!d)return sgEmpty("No regular starters yet.");
  const b=d.bb,PN={1:"goalkeepers",2:"defenders",3:"midfielders",4:"forwards"};
  const tiles=`<div class="ds-tiles" style="grid-template-columns:repeat(3,1fr);margin-bottom:10px">
    ${dsTile("Per Extra £1m",b?`${b.epm>=0?"+":""}${b.epm.toFixed(1)} pts`:"—",PN[pos],"up")}
    ${dsTile("Sweet Spot",b?esc(b.band):"—","best points per £")}
    ${dsTile("Budget Starter",`${d.base.pts.toFixed(1)} pts`,`at about £${d.base.price.toFixed(1)}`)}</div>`;
  /* the position's own chart from the Value report, without its tiles */
  const full=squadShapeHTML(G,H,pos);
  const chart=(full.match(/<div class="vcs[\s\S]*?(?=<div class="scroll">)/)||[full])[0];
  return tiles+chart;
}

/* ---------------- Clubs ---------------- */
/* fixture runs on the Teams page's Overall score (M6), easiest first */
function sgRuns(G,H){
  const to=Math.min(38,G+H-1);
  return (S.model.teams||[]).map(t=>({t,v:tgScore(t,G,to).pts,fx:(()=>{const out=[];for(let e=G;e<=Math.min(38,G+4);e++){const xs=tgFx(t,e);
      if(!xs.length)out.push(fxBlank("No fixture"));xs.forEach(x=>out.push(fxChip(x.opp.short,x.home,tgBand(t,x,"overall"))));}return fxRun(out.join(""));})()}))
    .sort((a,b)=>b.v-a.v);
}
function sgClubs(G,H){
  const M=S.model,ts=S.curTeamStats||{},tb=tgTable();
  /* Form Table: every club by league position */
  const rows=Object.values(tb).sort((a,b)=>a.pos-b.pos);
  const ftab=`<table class="sx-ft"><thead><tr><th>Pos</th><th>Club</th><th>Last Five</th><th>Form Pts</th><th>Scored</th><th>Conceded</th></tr></thead><tbody>${rows.map(x=>{const l5=tgResults(x.t,5),fp=l5.reduce((s,r)=>s+(r.r==="W"?3:r.r==="D"?1:0),0);
    return `<tr><td>${x.pos}</td><td class="c"><span>${dsBadge(x.t,20)}${esc(x.t.name)}</span></td><td>${tgForm(l5)}</td><td>${fp}</td><td>${x.gf}</td><td>${x.ga}</td></tr>`;}).join("")}</tbody></table>`;
  /* Attack vs Defence: season xG for and against a game, one crest a club */
  const pts=(M.teams||[]).map(t=>{const c=ts[t.short]||{},n=c.n||0;return n?{t,a:c.xg/n,d:c.xga/n}:null;}).filter(Boolean);
  let avd=sgEmpty("Waiting on this season's matches.");
  if(pts.length){
    const W=640,Hh=330,x0=44,y0=18,x1=W-14,y1=Hh-30,ax=pts.map(p=>p.a),dx=pts.map(p=>p.d);
    const aLo=Math.min(...ax)-.1,aHi=Math.max(...ax)+.1,dLo=Math.min(...dx)-.1,dHi=Math.max(...dx)+.1;
    const X=v=>x0+(v-aLo)/(aHi-aLo)*(x1-x0),Y=v=>y0+(v-dLo)/(dHi-dLo)*(y1-y0);
    const am=ax.reduce((s,v)=>s+v,0)/ax.length,dm=dx.reduce((s,v)=>s+v,0)/dx.length;
    avd=`<svg class="chart sx-sc" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Each club's xG for and against a game"><line class="cgrid" x1="${X(am)}" x2="${X(am)}" y1="${y0}" y2="${y1}"/><line class="cgrid" x1="${x0}" x2="${x1}" y1="${Y(dm)}" y2="${Y(dm)}"/>
      <text class="q" x="${x1}" y="${y0+10}" text-anchor="end">STRONG BOTH ENDS</text><text class="q" x="${x0+4}" y="${y1-6}">WEAK BOTH ENDS</text>
      <text x="${(x0+x1)/2}" y="${Hh-6}" text-anchor="middle">xG for a game →</text><text x="12" y="${(y0+y1)/2}" transform="rotate(-90 12 ${(y0+y1)/2})" text-anchor="middle">fewer xG against ↑</text>
      ${pts.map(p=>`<image href="${imgSrc("badge",p.t.code)}" x="${(X(p.a)-12).toFixed(1)}" y="${(Y(p.d)-12).toFixed(1)}" width="24" height="24"><title>${esc(p.t.name)}: ${p.a.toFixed(2)} xG, ${p.d.toFixed(2)} xGA a game</title></image>`).join("")}</svg>`;
    const col=(title,list,k)=>`<div><div class="sx-half">${title}</div>${list.map((p,i)=>`<div class="sx-mini"><span class="hbn">${i+1}</span>${dsBadge(p.t,20)}<b>${esc(p.t.name)}</b><span class="hbv">${p[k].toFixed(2)}</span></div>`).join("")}</div>`;
    avd+=`<div class="sx-minis">${col("Best Attacks · xG a game",pts.slice().sort((a,b)=>b.a-a.a).slice(0,3),"a")}${col("Best Defences · xGA a game",pts.slice().sort((a,b)=>a.d-b.d).slice(0,3),"d")}${col("Leakiest · xGA a game",pts.slice().sort((a,b)=>b.d-a.d).slice(0,3),"d")}</div>`;
  }
  /* Opponents to Target: the defences expected to concede most */
  const opp=(M.teams||[]).map(t=>{let c=0;const by=[];for(let e=G;e<G+H&&e<=38;e++)(M.byEv[e]||[]).filter(f=>f.ht===t||f.at===t).forEach(f=>{const home=f.ht===t,o=home?f.at:f.ht;c+=fdrCalc(o,t,!home,"xgf");by.push(o);});
    return{t,c,by};}).sort((a,b)=>b.c-a.c).slice(0,10);
  const oppB=hbars(opp.map(x=>({club:x.t,label:esc(x.t.name),sub:`<span class="sx-tc">faced by ${x.by.map(o=>dsBadge(o,14)).join("")}</span>`,value:x.c,show:x.c.toFixed(1),tone:SG_TONE.red})),{rank:true});
  /* Fixture Runs on the Teams Overall score */
  const runs=sgRuns(G,H);
  const runList=(list,tone)=>`<div class="hb sx-runs">${list.map((x,i)=>`<div class="hbr" onclick="S.fixMode='grid';S.tOpen='${x.t.short}';go(event,'fixtures')"><span class="hbn">${i+1}</span><span class="hbl sx-l">${dsBadge(x.t,24)}<span class="sx-t"><b>${esc(x.t.name)}</b></span></span>${x.fx}<span class="hbv">${x.v.toFixed(1)}</span></div>`).join("")}</div>`;
  const runBody=`<div class="sx-half">Easiest</div>${runList(runs.slice(0,5))}<div class="sx-half" style="margin-top:12px">Toughest</div>${runList(runs.slice().reverse().slice(0,5))}`;
  return `${rep("ftab","activity","Form Table","Last five results and league position.",ftab)}
    ${rep("avd","target","Attack vs Defence","Season xG for and against a game.",avd)}
    ${rep("opp","target","Opponents to Target","Defences expected to concede most over the window.",oppB)}
    ${rep("runs","calendar","Fixture Runs","The Teams page's Overall score over the window.",runBody)}`;
}

/* ---------------- My Season ---------------- */
function sgSeason(G){
  const M=S.model;
  const T=((S.tracker&&S.tracker.gw)||[]).slice().sort((a,b)=>a.event-b.event);
  const evs=(S.events||[]).filter(e=>e.finished).sort((a,b)=>a.id-b.id);
  const act=(id,e)=>{const v=actOf(id,e);return v==null?null:+v;};
  const vs=T.filter(r=>evs.some(e=>e.id===r.event)).map(r=>({r,e:evs.find(x=>x.id===r.event)}));
  const vsChart=colChart(vs.map(x=>"GW"+x.r.event),[{name:"You",values:vs.map(x=>x.r.points),color:SG_TONE.mint}],
    [{name:"Average",values:vs.map(x=>x.e.avg),color:SG_TONE.grey},{name:"Highest",values:vs.map(x=>x.e.high),color:SG_TONE.amber,dotsOnly:true}],{label:"Your points against the game's average and highest each week"});
  /* captain against the best in the XI, with faces in each week's note */
  const cap=T.filter(r=>Array.isArray(r.picks)&&r.picks.length).map(r=>{
    const c=r.picks.find(p=>p.isC)||r.picks.find(p=>p.multiplier>=2);let best=null;
    r.picks.filter(p=>p.multiplier>0).forEach(p=>{const v=act(p.id,r.event);if(v!=null&&(!best||v>best.v))best={id:p.id,v};});
    return{e:r.event,c:c&&{id:c.id,v:act(c.id,r.event)},best};}).filter(x=>x.c&&x.c.v!=null&&x.best);
  const P=id=>M.players.find(x=>x.id===+id),nm=id=>{const p=P(id);return p?p.web_name:"#"+id;};
  const capChart=colChart(cap.map(x=>"GW"+x.e),[{name:"Captain",values:cap.map(x=>x.c.v),color:SG_TONE.amber,notes:cap.map(x=>nm(x.c.id))},
    {name:"Best in XI",values:cap.map(x=>x.best.v),color:"#5A5A5A",notes:cap.map(x=>nm(x.best.id))}],[],{label:"Captain's points against the best scorer in your XI"});
  const capList=cap.slice().reverse().filter(x=>x.best.v>x.c.v).slice(0,4).map(x=>`<span class="sgchip"><span class="sx-tc">GW${x.e}: ${dsFace(P(x.c.id),"sm")}${esc(nm(x.c.id))} ${x.c.v} vs ${dsFace(P(x.best.id),"sm")}${esc(nm(x.best.id))} ${x.best.v}</span></span>`).join("");
  const vb=T.filter(r=>r.value!=null);
  const valChart=colChart(vb.map(r=>"GW"+r.event),[],[{name:"Team value",values:vb.map(r=>+r.value),color:SG_TONE.mint}],{min:Math.floor(Math.min(...vb.map(r=>+r.value),100)-1),fmt:v=>"£"+v.toFixed(1),w:340,h:190,label:"Team value by week"});
  const bankChart=colChart(vb.map(r=>"GW"+r.event),[{name:"Bank",values:vb.map(r=>+(r.bank||0)),color:SG_TONE.cyan}],[],{fmt:v=>"£"+v.toFixed(1),w:340,h:190,label:"Bank by week"});
  const ge=evs.filter(e=>(e.chips||[]).length);
  const CH=[["wildcard","Wildcard",SG_TONE.purple],["freehit","Free Hit",SG_TONE.cyan],["bboost","Bench Boost",SG_TONE.mint],["3xc","Triple Captain",SG_TONE.amber]];
  const chipPlays=colChart(ge.map(e=>"GW"+e.id),CH.map(([k,n,c])=>({name:n,color:c,values:ge.map(e=>{const x=(e.chips||[]).find(y=>y.name===k);return x?Math.round(x.n/1000):0;})})),[],
    {stacked:true,fmt:v=>v>=1000?(v/1000).toFixed(1)+"m":Math.round(v)+"k",legend:true,label:"Chip plays across the game each week"});
  const st=((S.rivalsFeed&&S.rivalsFeed.standings)||[]).slice().sort((a,b)=>a.rank-b.rank),lead=st[0];
  const ini=s=>String(s||"").trim().split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const gaps=hbars(st.map(s=>({label:`<span class="sx-av">${esc(ini(s.manager||s.entryName))}</span>${esc(s.entryName||"")}`,sub:`${esc(s.manager||"")}${s===lead?" · leader":` · −${lead.totalPoints-s.totalPoints} lead`}`,value:s.totalPoints,show:String(s.totalPoints),mine:String(s.entryId)===String(TEAM_ID),tone:String(s.entryId)===String(TEAM_ID)?SG_TONE.mint:"#5A5A5A"})),
    {rank:true,from:st.length?Math.min(...st.map(s=>s.totalPoints))-25:0,empty:"League feed not loaded."});
  return `${rep("vsgame","gauge","Your Score vs The Game","Your points against the game's average and highest.",vsChart)}
    ${rep("captbest","crown","Captain vs Best Pick","Your captain's points against the best in your XI.",capChart+(capList?`<div class="sgwhy" style="margin-top:8px">${capList}</div>`:""))}
    ${rep("rchips","calendar","Chips","Chips played and left, by half, for you and your league.",sgChipsHTML())}
    ${rep("gaps","users","League Gaps","Points behind the leader.",gaps)}
    ${rep("bankval","wallet","Bank and Team Value","Team value and bank after each week.",`<div class="split2"><div><h4 class="rsub">Team Value</h4>${valChart}</div><div><h4 class="rsub">Bank</h4>${bankChart}</div></div>`)}
    ${rep("chipplays","activity","Chip Plays Across The Game","Chips played across the game each week.",chipPlays)}`;
}
/* Chips by half (C2): every manager's eight chips in the letter tiles, with
   the chips still to play counted over both halves */
function sgChipsHTML(){
  const ents=(S.rivalsFeed&&S.rivalsFeed.entries)||{};
  const KIND=["wildcard","freehit","bboost","3xc"];
  const me=[];[1,2].forEach(h=>KIND.forEach(k=>{const e=chipPlayed(k+h);if(e!=null)me.push({name:k,event:e});}));
  const rowsD=[[IDENTITY.manager||"You",me,true],...Object.entries(ents).filter(([id])=>String(id)!==String(TEAM_ID)).map(([id,e])=>[e.name||id,e.chips||[],false])];
  const g=VG(),cell=(used,k,h)=>{const c=used.find(x=>x.name===k&&(h===1?x.event<=19:x.event>=20));
    if(c)return `<td><span class="cx-ru" title="Played GW${c.event}">${chipTile(k,20,true)}</span></td>`;
    const gone=h===1&&g>19;return `<td><span class="cx-ru${gone?" off":""}" title="${gone?"Expired":"Still to play"}">${chipTile(k,20,false,gone?"":"dash")}</span></td>`;};
  return `<table class="cgridt sx-ch"><thead><tr><th style="text-align:left">Manager</th><th colspan="4"><span class="sx-half">GW1–19</span></th><th colspan="4"><span class="sx-half">GW20–38</span></th><th>Left</th></tr></thead><tbody>
    ${rowsD.map(([n,used,isMe])=>{let left=0;[1,2].forEach(h=>KIND.forEach(k=>{if(!used.some(x=>x.name===k&&(h===1?x.event<=19:x.event>=20))&&!(h===1&&g>19))left++;}));
      return `<tr${isMe?' class="me"':""}><td class="m" style="text-align:left" title="${esc(n)}"><span class="sx-av">${esc(String(n).trim().split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase())}</span><span class="sx-nm">${isMe?"You":esc(n)}</span></td>${[1,2].map(h=>KIND.map(k=>cell(used,k,h)).join("")).join("")}<td><b>${left}</b></td></tr>`;}).join("")}</tbody></table>`;
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
  2:["cs","csmk","xgi6","dchit","dchits","bps","bonus"],3:["xgi6","retmk","npxg","xa","ict","dchit","dchits","bonus"],
  4:["xgi6","retmk","npxg","xa","ict","sot","bonus"]};
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
/* a pale kit (Spurs, Fulham, Leeds: white) under white text is unreadable:
   anything light is mixed into a dark slate for the card's hero */
function pkTone(c){
  const h=/^#?([0-9a-f]{6})$/i.exec(c||"");if(!h)return c;
  const n=parseInt(h[1],16),r=n>>16,g=n>>8&255,b=n&255;
  const L=(0.2126*r+0.7152*g+0.0722*b)/255;if(L<0.62)return c;
  /* white keeps a hint (28%); a light colour such as City's sky blue keeps half */
  const t=L>=0.85?.28:.5,m=(x,y)=>Math.round(x*t+y*(1-t)).toString(16).padStart(2,"0");
  return "#"+m(r,34)+m(g,40)+m(b,54);
}
function pdCols(){
  /* 28 Nov 2026: during a live week VG() is the week being played, which has
     no forecast, so "next match" columns (Clean Sheet Chance) read blank on
     the player card; they look at the next week at the earliest */
  const g=Math.max(VG(),S.model.next.id),r=lGwRange(),W=p=>ws(String(p.code||""),p.pos,dispWin(),p.price,teamMaxPrice(p.team))||{};
  /* Season: FPL's own per-90 where FPL publishes one; Last N: match rows */
  const sv=(p,k)=>{const v=statVal(p,k,W(p));return v==null||!isFinite(v)?null:v;};
  const L6=p=>{const w=ws(String(p.code||""),p.pos,6,p.price,teamMaxPrice(p.team));return w?(w.xg90||0)+(w.xa90||0):null;};
  const mk=S.oddsState==="ok"?(()=>{const m={};try{Object.values(oddsPlayers(g)||{}).forEach(x=>{if(x&&x.p)m[x.p.id]=x;});}catch(e){}return m;})():null;
  const mcs=S.oddsState==="ok"?(()=>{try{return marketCS(g)||{};}catch(e){return {};}})():null;
  const pct=v=>v==null?"—":Math.round(v*100)+"%",f1=v=>v==null?"—":v.toFixed(1),f2=v=>v==null?"—":v.toFixed(2);
  /* Rivals is its own column since 13 Nov 2026 (Andy), so Own % switches
     only between everyone and the managers ranked around you */
  const ownMode=S.pOwn==="rank"?"rank":S.pOwn==="eo"&&fieldEO10k()?"eo":"all";
  const own=p=>{if(ownMode==="all")return p.owned;if(ownMode==="eo")return fieldEO10k()[p.id]||0;const a=aroundOwn(p,ownMode);return a?a.k/a.n:null;};
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
    own:{label:ownMode==="all"?"Own %":ownMode==="eo"?"EO 10k":"Near rank",tip:ownMode==="all"?"Owned by all managers":ownMode==="eo"?"Top 10k effective ownership at the last deadline, captaincy counted":"Owned by the 50 managers ranked around you",
      val:own,cell:p=>{if(ownMode==="all")return p.owned.toFixed(1)+"%";if(ownMode==="eo")return Math.round(fieldEO10k()[p.id]||0)+"%";const a=aroundOwn(p,ownMode);return a?`${a.k}/${a.n}`:"—";},heat:0},
    xmins:{label:"xMins",tip:"Expected minutes next gameweek",val:p=>p.xMins||0,cell:p=>Math.round(p.xMins||0)+"′"+minsTag(p),heat:1},
    xgi6:{label:"xGI/90 L6",tip:"Expected goals plus assists per 90, last 6 matches (the study's best underlying number for midfielders and forwards)",val:L6,cell:p=>f2(L6(p)),heat:1},
    cs:{label:"CS %",tip:"Model chance of a clean sheet next match, as its points use it (bookmakers' odds when priced)",val:p=>csProbNext(p,g),cell:p=>pct(csProbNext(p,g)),heat:1},
    csmk:{label:"CS mkt",tip:"Bookmakers' clean-sheet chance next match (margin removed)",val:p=>mcs?mcs[p.team]??null:null,cell:p=>pct(mcs?mcs[p.team]:null),heat:1,market:1},
    /* 26 Nov 2026: goal or assist, the market's chance of an FPL attacking
       return; when only goal and assist lines are priced, combined. */
    retmk:{label:"Return mkt",tip:"Bookmakers' chance he scores or assists next match, if he plays (goal, assist and the model's figure in the hover)",val:p=>mkRet(mk&&mk[p.id]),
      cell:p=>{const x=mk&&mk[p.id],v=mkRet(x);if(v==null)return "—";
        const mr=1-(1-modelChance(p,p.xg90||0))*(1-modelChance(p,p.xa90||0));
        const t=[x.goal!=null?"Goal "+pct(x.goal):"",x.assist!=null?"Assist "+pct(x.assist):"","Model "+pct(mr)].filter(Boolean).join(" · ");
        return `<span title="${t}">${pct(v)}</span>`;},heat:1,market:1},
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
const pdFdr=d=>FDR5[fdrBand(d)]; /* the one scale (app-core FDR5) */
/* compact next-five fixtures: home in capitals, away in lower case */
function fix5(p,g){return fxNext(p,g,5);}
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
  if(S.iconF.length)a=a.filter(p=>{const ic=signalsC(p,g).map(x=>x[0]);return S.iconF.every(k=>ic.includes(k));});
  return{g,mine,a};
}
/* the projection window as one of the three buttons, or 0 for a custom one */
function pdWin(r){const g=S.model.next.id;if(r.from!==g)return 0;
  if(r.to===38&&r.count>5)return "ros";return r.count===1?1:r.count===3?3:r.count===5?5:0;}
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
  /* H2: values once per player, then sort */
  const svm=new Map(a.map(p=>[p,sv(p)]));
  const rows=a.slice().sort((x,y)=>{const A=svm.get(x),B=svm.get(y);if(typeof A==="string")return dir==="asc"?A.localeCompare(B):B.localeCompare(A);return dir==="asc"?A-B:B-A;});
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
  const body=rows.slice(0,lim).map(p=>{const on=ticks.includes(p.id),own=mine.has(p.id),sg=signalsC(p,g),proj=D.C.proj.val(p)||0;
    return `<tr class="${own?"mine":""}${on?" ticked":""}"${p.avail===0?' style="opacity:.45"':""}>
      <td class="nm"><span class="pcell"><span class="pdshirt">${kitSm(p,34)}<input type="checkbox" class="tick" ${on?"checked":""} ${!on&&ticks.length>=5?"disabled":""} onchange="act('tick',${p.id})" aria-label="Compare ${esc(p.web_name)}"></span>
        <span class="pmeta"><span class="prow1">${pName(p)}${INJ(p)}${role(p)}</span><span class="prow2">${dsBadge(sgTeamOf(p),13)} ${esc(p.teamName)} · ${POS[p.pos]}</span></span></span></td>
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
      <td class="fig${(p.xMins||0)<60?" pdwarn":lvl("xmins",D.C.xmins.val(p))}">${D.C.xmins.cell(p)}</td>
      ${D.extra.map((k,j)=>`<td class="fig${j?"":" gs"}${lvl(k,D.C[k].val(p))}">${D.C[k].cell(p)}</td>`).join("")}
      <td class="acts"><button class="pdstar${S.stars.includes(p.id)?" on":""}" onclick="act('star',${p.id})" title="Shortlist" aria-label="Shortlist ${esc(p.web_name)}" aria-pressed="${S.stars.includes(p.id)}">★</button>${own?"":`<button class="pdadd" onclick="act('addplan',${p.id})" title="Add to the Planner" aria-label="Add ${esc(p.web_name)} to the Planner">+</button>`}</td></tr>`;}).join("");
  const more=rows.length>lim?`<div class="pdmore"><span class="note">Showing ${lim} of ${rows.length} players</span>
    <span><button onclick="act('pdmore')">Show ${Math.min(PD_PAGE,rows.length-lim)} more</button> <button onclick="act('pdall')">Show all ${rows.length}</button></span></div>`:
    (lim>PD_PAGE&&rows.length>PD_PAGE?`<div class="pdmore"><span class="note">Showing all ${rows.length} players</span><button onclick="act('pdless')">Show fewer</button></div>`:"");
  const key5=[1,2,3,4,5].map(d=>`<span class="fxc d${d} key">${d}</span>`).join("");
  return pdHeadHTML(rows,r)+(S.starOnly&&!S.stars.length?`<div class="panel"><div class="pbody"><p class="note" style="margin:0">No shortlisted players yet. Tap ★ on any row to add one.</p></div></div>`:
    `<div class="panel pdpanel"><div class="scroll tallscroll pdt${ticks.length?" ticking":""}"><table><thead>${head}</thead><tbody>${body||`<tr><td colspan="${14+D.extra.length}" class="note" style="padding:14px">No players match these filters.</td></tr>`}</tbody></table></div>${more}</div>`)
    +`<div class="pdkey"><span><i class="kmine"></i>Your squad</span><span><span class="pdrole c">C</span><span class="pdrole v">VC</span><span class="pdrole xi">XI</span><span class="pdrole bn">Bench</span></span><i class="sep"></i>
      <span><b class="t10">4.6</b> top 10% of the column</span><span><b class="t25">4.6</b> top 25%</span><i class="sep"></i>
      <span>Fixture difficulty <span class="fxrun">${key5}</span> · H home, A away</span>${S.oddsState==="ok"?`<i class="sep"></i><span>Market columns: bookmakers' figures, margin removed</span>`:""}</div>`;
}
function pdHeadHTML(rows,r){
  const seg=(cur,list,action,lbl)=>`<span class="hz" role="group" aria-label="${lbl}">${list.map(([k,l,t])=>`<button class="${String(cur)===String(k)?"on":""}" aria-pressed="${String(cur)===String(k)}" onclick="act('${action}','${k}')"${t?` title="${t}"`:""}>${l}</button>`).join("")}</span>`;
  const ticks=S.pTicks||[],g=S.model.next.id,win=pdWin(r);
  const nMine=rows.filter(p=>(S.squad||[]).includes(p.id)).length;
  /* signal counts over every player, whatever the filters */
  const cnt={};S.model.players.forEach(p=>signalsC(p,VG()).forEach(([k])=>{cnt[k]=(cnt[k]||0)+1;}));
  const top=pdPriceTop(),lo=clamp(S.lMin||3.5,3.5,top),hi=clamp(S.lMax||16,lo,top);
  const nMore=[(S.pShow||"all")!=="all",!win,(S.lWin||38)!==38,["rank","eo"].includes(S.pOwn),!!S.pStarters,!!S.starOnly].filter(Boolean).length;
  const any=nMore||S.lSearch||S.lTeam||lo>3.5||hi<top||S.iconF.length||S.lPos;
  const box=(on,label,action)=>`<label class="pdchk"><input type="checkbox" ${on?"checked":""} onchange="act('${action}')"> ${label}</label>`;
  return `<div class="pagetabs"><h1>Player Data <span class="pdcount">${rows.length} players${nMine?` · <b>${nMine}</b> from your squad`:""}</span></h1>
      <span style="display:flex;gap:8px;align-items:center">${ticks.length?"":`<button class="fci" data-tip="Tick up to 5 players to compare them." aria-label="About comparing">i</button>`}</span></div>
    <div class="pdcard${S.pdPh?" phopen":""}">
      <div class="pdbar">
        <label class="pdsearch">${lic("search",15)}<input id="srch-l" placeholder="Search players" value="${esc(S.lSearch||"")}" oninput="searchInput('lsearch',this)" aria-label="Search players"></label>
        <button class="pdphbtn${S.pdPh?" on":""}" onclick="act('pdph')" aria-expanded="${!!S.pdPh}">${lic("sliders-horizontal",15)} Filters${(S.lTeam||lo>3.5||hi<top||S.iconF.length)?` <b>${[S.lTeam,lo>3.5||hi<top,S.iconF.length].filter(Boolean).length}</b>`:""}</button>
        <div class="pdctl"><span class="pdl">Position</span>${seg(S.lPos||0,[[0,"All"],[1,"GKP"],[2,"DEF"],[3,"MID"],[4,"FWD"]],"lpos","Position")}</div>
        <div class="pdctl"><span class="pdl">Projection</span>${seg(win,[[1,"1 GW"],[3,"3 GW"],[5,"5 GW"],["ros","ROS",`Rest of season, GW${g}–38`]],"pwin","Projection window")}</div>
        <div class="pdctl"><span class="pdl">Club</span><select class="pdsel" onchange="act('lteam',this.value)" aria-label="Club"><option value="0">All clubs</option>${S.model.teams.slice().sort((x,y)=>String(x.name).localeCompare(y.name)).map(t=>`<option value="${t.id}" ${S.lTeam===t.id?"selected":""}>${esc(t.name)}</option>`).join("")}</select></div>
        <div class="pdctl pdpricectl"><span class="pdl">Price <b id="pdpricel">£${lo.toFixed(1)} – £${hi.toFixed(1)}</b></span>
          <span class="pdrange"><i class="pdtr"></i><i class="fl" style="left:${((lo-3.5)/(top-3.5)*100).toFixed(1)}%;right:${(100-(hi-3.5)/(top-3.5)*100).toFixed(1)}%"></i>
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
            <div class="pdpr"><span>Own % shows</span>${seg(["rank","eo"].includes(S.pOwn)?S.pOwn:"all",[["all","Everyone"],["rank","Near rank"],["eo","EO 10k"]],"pown","Own % shows")}</div>
            <div class="pdpr"><span>Only</span><span class="pdchks">${box(S.pStarters,"Available starters","pstart")}${box(S.starOnly,`★ Shortlist${S.stars.length?" ("+S.stars.length+")":""}`,"staronly")}</span></div>
            <div class="pdpopf"><button class="pdreset" onclick="act('pdreset')">Reset all</button><button class="pri" onclick="act('pdmorefilters')">Done</button></div>
          </div>`:""}</span></div>
      </div>
      <div class="pdsigs"><span class="pdl">Signals <button class="fci" data-tip="Tap a signal to filter; hover an icon for why." aria-label="About signals">i</button></span>
        <div class="pdchips">${SIG_ORDER.map(k=>{const[ic,tone,label]=SIGNAL[k],on=S.iconF.includes(k);
          return `<button class="pdsigchip${on?" on":""}" style="--tc:${tone==="NAVY"?"#7AA2FF":tone}" onclick="act('iconf','${k}')" aria-pressed="${on}" title="${esc(SIG_RULE[k](sigH()))}"><span class="tile">${lic(ic)}</span>${label}<b>${cnt[k]||0}</b></button>`;}).join("")}</div>
      </div>
    </div>`;
}

/* ============================================================
   THE ONE FLAG MECHANISM (22 Nov 2026, Andy). FPL keeps only a player's
   latest flag; the server writes down every change (/api/flags, the same
   log The Scout reads). Every page draws a flag from these four:
   flagNow (the chance, since when, and the chance before), flagTitle (the
   hover text on every injury badge), flagHistoryHTML (the list of
   changes) and availStripHTML (minutes each gameweek, the bar coloured by
   FPL's chance at that deadline). The chance itself is always p.avail, so
   every page agrees. The log began on 12 Nov 2026: earlier deadlines are
   grey.
   ============================================================ */
const FLAG_LOG_START=Date.parse("2026-11-12T00:00:00Z");
const flagChance=r=>r.st==="a"&&!r.news?100:(r.st==="u"||r.st==="n"||r.st==="s")?0:(r.cn==null||r.cn===""?(r.st==="a"?100:50):+r.cn);
const flagT=r=>Date.parse(r.t||r.seen)||Date.parse(r.seen)||0;
const flagDay=ms=>new Date(ms).toLocaleDateString("en-GB",{timeZone:"Europe/London",weekday:"short",day:"numeric",month:"short"});
const flagWhen=ms=>flagDay(ms)+", "+new Date(ms).toLocaleTimeString("en-GB",{timeZone:"Europe/London",hour:"2-digit",minute:"2-digit"});
const chCol=c=>c==null?"#4A4A4A":c<=0?"var(--red)":c<=50?"#FF9F2E":c<100?"#FFD23F":"var(--mint)";
const chPill=c=>`<span class="fh-pc" style="--fl:${chCol(c)}">${c==null?"–":c+"%"}</span>`;
function flagRows(p){const F=S.flags&&S.flags.players;return (F&&(F[p.id]||F[String(p.id)]))||[];}
function flagNow(p){
  const c=Math.round((p.avail==null?1:p.avail)*100),rows=flagRows(p);
  if(!rows.length)return c<100?{c,since:null,was:null}:null;
  let i=rows.length-1;const cl=flagChance(rows[i]);
  while(i>0&&flagChance(rows[i-1])===cl)i--;
  const since=flagT(rows[i]),was=i>0?flagChance(rows[i-1]):(cl<100?100:null);
  if(c>=100)return cl>=100&&was!=null&&was<100?{c:100,since,was,cleared:true}:null;
  return {c,since,was};
}
/* the chance FPL gave him at a moment (null before the log began) */
function flagAt(p,ms){
  if(!(ms>=FLAG_LOG_START))return null;
  const rows=flagRows(p);let c=100;
  for(const r of rows){if(flagT(r)<=ms)c=flagChance(r);else break;}
  return c;
}
function flagTitle(p){
  const f=flagNow(p),n=p.news||"Fitness doubt";
  if(!f||f.cleared)return p.news||"Fit";
  return `${n} · ${f.c}%${f.since?" since "+flagDay(f.since):""}${f.was!=null&&f.was!==f.c?" · was "+f.was+"%":""}`;
}
function flagHistoryHTML(p,max){
  const rows=flagRows(p);
  if(!rows.length)return sgEmpty(p.avail<1?"Flagged before the log began on 12 Nov.":"No FPL flag since the log began on 12 Nov.");
  const out=[];let prev=100;
  rows.forEach(r=>{const c=flagChance(r);out.push({t:flagT(r),a:prev,b:c,n:r.news||(c>=100?"Flag removed":"")});prev=c;});
  return `<div class="fh-list">${out.reverse().slice(0,max||8).map(x=>`<div class="fh-row"><span class="fh-t">${esc(flagWhen(x.t))}</span>
    <span class="fh-ch">${chPill(x.a)}<span class="fh-ar" style="color:${x.b>x.a?"var(--mint)":x.b<x.a?"var(--red)":"#6A6A6A"}">${lic("arrow-right",12)}</span>${chPill(x.b)}</span><span class="fh-n">${esc(x.n)}</span></div>`).join("")}</div>`;
}
function availStripHTML(p){
  const G=S.model.next.id,rows=((S.hist||{})[String(p.code)]||[]).filter(r=>r.tag==="now");
  const cells=[];
  for(let e=1;e<=G;e++){
    const ev=(S.events||[]).find(x=>x.id===e),dl=ev&&Date.parse(ev.deadline);
    const ms=rows.filter(r=>r.gw===e),mins=e<G?ms.reduce((a,r)=>a+(+r.mins||0),0):null;
    const c=e===G?Math.round((p.avail==null?1:p.avail)*100):flagAt(p,dl);
    cells.push(`<div class="fh-av" style="--fl:${chCol(c)}" title="GW${e}: ${mins==null?"to play":mins+" minutes"}${c==null?" · before the flag log":" · FPL chance "+c+"% at the deadline"}"><i>GW${e}</i><b>${mins==null?"–":mins}</b><span></span></div>`);
  }
  return `<div class="fh-avs" style="grid-template-columns:repeat(${cells.length},minmax(0,1fr))">${cells.join("")}</div>`;
}
/* Start Chance (Andy, 22 Nov 2026): the share of his club's last six league
   matches he started, times FPL's chance of playing. With fewer than three
   matches this season, the model's expected minutes stand in. */
function startChance(p){
  const G=S.model.next.id,code=Math.round(num(p.teamCode)),av=p.avail==null?1:p.avail;
  const ms=Object.entries(S.teamMatch||{}).filter(([,m])=>m.tag==="now"&&m.gw<G&&(m.h===code||m.a===code))
    .sort((a,b)=>b[1].gw-a[1].gw).slice(0,6).map(([id])=>id);
  let v;
  if(ms.length>=3){const rows=((S.hist||{})[String(p.code)]||[]);v=ms.filter(id=>rows.some(r=>r.mid===id&&r.start===0)).length/ms.length;}
  else v=clamp((p.roleMins!=null?p.roleMins:(p.xMins||0))/85,0,1);
  return Math.round(v*av*100);
}
