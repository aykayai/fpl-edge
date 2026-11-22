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
/* SETPIECE above is now only the fallback for the model's penalty and
   set-piece points when FPL's live orders did not load (20 Oct 2026, Andy:
   the model and the icons both read FPL's live orders). */
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
  defcon:["shield-check","#E8743B","DefCon Monster"],
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
  heat:()=>"Heating Up. Midfielders: last-4 xGI/90 at least 1.5x his season rate. Keepers and defenders: his team's xG against over the last 4 at most 0.7x its season rate. Forwards: his team's xG over the last 4 at least 1.3x its season rate",
  cool:()=>"Cooling Off. Midfielders: last-4 xGI/90 at most 0.6x his season rate, or his DefCon hit rate down 30 points. Keepers, defenders and forwards: losing his place (his share of the team's minutes over its last 4 at most 0.75x his season share, or 2 or fewer starts in the last 4 after starting 75%+). Keepers also: goals prevented over the last 4 at least 0.3 per 90 below his season rate",
  defcon:()=>`DefCon Monster: reached the DefCon target in at least 2 of every 3 matches this season, with ${DCM_HITS}+ hits. Solid when the next match is strong too: model chance ${Math.round(DCM_CHANCE*100)}%+ against a side whose opponents reach DefCon ${DCM_GIVEN}+ times a match`,
  rival:()=>"Owned by managers around you, not by you",
  diff:()=>"Differential: predicted in the top 10% of his position next gameweek (among players expected to play 60+ minutes) and under 5% owned. Bright when none of your league rivals own him, which also lets in players up to 15% owned",
  pen:()=>"First-choice penalty taker",
  set:()=>"First choice on corners or free kicks"};
function sigTile(k,tip,bright){
  const[ic,tone,label]=SIGNAL[k];
  return `<span class="tile${tone==="NAVY"?" navy":""}${bright?" bright":""}"${tone==="NAVY"?"":` style="--tc:${tone}"`} title="${esc(tip||label)}" data-sig="${k}">${lic(ic)}</span>`;
}
/* Player Data hover card: one short line per signal, from its tip */
function sigShort(k,t){
  t=String(t||"");
  if(k==="buy"){const m=t.match(/([\d.]+) pts$/),h=t.match(/next (\d+) gameweeks/);return `Top pick for his position: ${m?m[1]:"?"} pts ${h?"over "+h[1]+" GW":"next GW"}`;}
  if(k==="sell"){const m=t.match(/: (.+) \+([\d.]+)$/);return m?`Best swap: ${m[1]}, +${m[2]} pts`:t;}
  if(k==="rise"||k==="fall"){const m=t.match(/(\d+)%/);return `${k==="rise"?"Rise":"Fall"} likely tonight (predictor ${m?m[1]:"100"}%)`;}
  if(k==="heat"||k==="cool")return t.replace(/^(Heating Up|Cooling Off):\s*/,"").replace(/last-4 /,"last 4: ").replace(" vs season",", season");
  if(k==="defcon")return t.replace(/^DefCon Monster:\s*/,"Hit the target ").replace(" · strong next match: "," · next: ").replace(/, whose opponents.*$/,"");
  if(k==="set")return t.replace(/^Set pieces:\s*/,"");
  if(k==="diff")return t.replace(", predicted"," · predicted");
  return t;
}
/* FPL's own live fields (server /api/fpl-players): price predictor and
   set-piece orders. Missing on the Pages backup, where the dataset's
   penalty order stands in and set pieces are not shown. */
function fplLive(p){return (S.fplLive&&S.fplLive.players&&S.fplLive.players[p.id])||null;}
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
function sellMap(h){
  if(_sellBusy)return new Map();
  _sellBusy=true;
  try{const m=new Map();bestSwaps(60,h).forEach(x=>{if(x.gain>=2&&!m.has(x.out.id))m.set(x.out.id,x);});return m;}
  finally{_sellBusy=false;}
}
/* Momentum (Heating Up / Cooling Off), every position, 12 Nov 2026
   (Andy). Rules kept only where the 2025-26 backtest held in both halves
   of the season (next-5 points against a fit on season points per game and
   fixtures; scratchpad momentum_all.py):
     GK, DEF  Heating Up: his team's xG against per match over its last 4
              at most 0.7x its season rate and 0.3 lower (+2.1, n=125 DEF;
              +2.2 GK).
     GK, DEF, FWD  Cooling Off, losing his place (12 Nov 2026, Andy: every
              position covered; scratchpad momentum_cool.py): his share of
              the team's minutes over its last 4 matches at most 0.75x his
              season share (season share 60%+), or 2 or fewer starts in the
              last 4 after starting 75%+ of the season. GK -5.6 (n=43), DEF
              -1.7 (n=205), FWD -5.7 (n=27), both halves. Attacking-stat drops
              for forwards (xG, shots, box touches) bounced back instead.
     GK       Cooling Off also: his goals prevented per 90 over the last 4
              at least 0.3 below his season rate (-1.5, n=88).
     MID      Heating Up: xGI/90 last 4 >= 1.5x season and +0.15 (+1.6).
              Cooling Off: xGI/90 last 4 <= 0.6x season and -0.15 (-2.1),
              or his DefCon hit rate in the last 4 at least 0.30 below his
              season rate (-2.2, n=47).
     FWD      Heating Up (12 Nov 2026, scratchpad momentum_heat.py): his
              team's xG per match over its last 4 at least 1.3x its season
              rate and 0.3 higher (+3.5, n=46; GW6-19 +5.3, GW20-33 +2.0).
              His own xG, xGI, shots and box touches rising did not hold.
   This season's matches only; at least 6 appearances and 450 minutes, and
   180 minutes in the last 4. `before` limits the matches to earlier
   gameweeks (the Status page grades past weeks with it). */
const _momCache=new Map();
/* his team's own xG per match, same matches as teamXgaSeries */
function teamXgfSeries(short,before){
  const key={};(S.teams||[]).forEach(t=>{key[Math.round(num(t.code))]=t.short;key["id"+t.id]=t.short;});
  return Object.values(S.teamMatch||{}).filter(m=>m.tag==="now"&&(!before||m.gw<before)&&(key[m.h]===short||key[m.a]===short)
      &&(m.hxg>0||m.axg>0)).sort((a,b)=>a.gw-b.gw).map(m=>key[m.h]===short?m.hxg:m.axg);
}
function teamXgaSeries(short,before){
  const key={};(S.teams||[]).forEach(t=>{key[Math.round(num(t.code))]=t.short;key["id"+t.id]=t.short;});
  return Object.values(S.teamMatch||{}).filter(m=>m.tag==="now"&&(!before||m.gw<before)&&(key[m.h]===short||key[m.a]===short)
      &&(m.hxg>0||m.axg>0)).sort((a,b)=>a.gw-b.gw).map(m=>key[m.h]===short?m.axg:m.hxg);
}
/* losing his place: his league matches against his team's (played, this
   season, before `before`), by match id; null when he is holding it */
function losingPlace(p,rows,before){
  const key={};(S.teams||[]).forEach(t=>{key[Math.round(num(t.code))]=t.short;key["id"+t.id]=t.short;});
  const ids=Object.entries(S.teamMatch||{}).filter(([,m])=>m.tag==="now"&&(!before||m.gw<before)
      &&(key[m.h]===p.teamName||key[m.a]===p.teamName)&&(m.hxg>0||m.axg>0)).sort((a,b)=>a[1].gw-b[1].gw).map(([id])=>id);
  if(ids.length<6)return null;
  const by={};rows.forEach(r=>{by[r.mid]=r;});
  const l4=ids.slice(-4),share=xs=>xs.reduce((a,id)=>a+(by[id]?by[id].mins:0),0)/(90*xs.length);
  const starts=xs=>xs.filter(id=>by[id]&&by[id].start===0).length;
  const sS=share(ids),s4=share(l4),stS=starts(ids)/ids.length,st4=starts(l4);
  if(sS>=0.6&&s4<=0.75*sS)return`losing his place: ${Math.round(s4*100)}% of ${p.teamName}'s minutes over their last 4 vs ${Math.round(sS*100)}% this season`;
  if(stS>=0.75&&st4<=2)return`losing his place: started ${st4} of ${p.teamName}'s last 4 after starting ${Math.round(stS*100)}% this season`;
  return null;
}
function momentum(p,before){
  const ck=p.code+"|"+(before||0);
  const hit=_momCache.get(ck);if(hit&&hit.h===S.hist&&hit.m===S.teamMatch)return hit.v;
  const rows=((S.hist&&S.hist[p.code])||[]).filter(r=>r.tag==="now"&&r.mins>0&&(!before||r.gw<before));
  const l4=rows.slice(-4),mins=rs=>rs.reduce((a,r)=>a+r.mins,0);
  const per=(rs,f)=>{const m=mins(rs);return m>0?rs.reduce((a,r)=>a+f(r),0)*90/m:null;};
  let v=null;
  if(rows.length>=6&&mins(rows)>=450&&mins(l4)>=180){
    v={heat:false,cool:false,why:""};
    if(p.pos===3){
      const sea=per(rows,r=>(r.xg||0)+(r.xa||0)),last=per(l4,r=>(r.xg||0)+(r.xa||0));
      const full=rs=>rs.filter(r=>r.mins>=60),hr=rs=>full(rs).length?full(rs).filter(r=>(r.dc||0)>=12).length/full(rs).length:null;
      const dS=hr(rows),d4=hr(l4);
      if(last>=1.5*sea&&last-sea>=0.15){v.heat=true;v.why=`last-4 xGI/90 ${last.toFixed(2)} vs season ${sea.toFixed(2)}`;}
      else if(last<=0.6*sea&&sea-last>=0.15){v.cool=true;v.why=`last-4 xGI/90 ${last.toFixed(2)} vs season ${sea.toFixed(2)}`;}
      else if(dS!=null&&d4!=null&&dS-d4>=0.30){v.cool=true;v.why=`DefCon in ${Math.round(d4*100)}% of the last 4 vs ${Math.round(dS*100)}% this season`;}
    }else{
      const tx=p.pos<=2?teamXgaSeries(p.teamName,before):[];
      if(tx.length>=6){const s=tx.reduce((a,x)=>a+x,0)/tx.length,l=tx.slice(-4).reduce((a,x)=>a+x,0)/4;
        if(l<=0.7*s&&s-l>=0.3){v.heat=true;v.why=`${p.teamName} xG against ${l.toFixed(2)} a match over the last 4 vs ${s.toFixed(2)} this season`;}}
      if(p.pos===4){const tf=teamXgfSeries(p.teamName,before);
        if(tf.length>=6){const s=tf.reduce((a,x)=>a+x,0)/tf.length,l=tf.slice(-4).reduce((a,x)=>a+x,0)/4;
          if(l>=1.3*s&&l-s>=0.3){v.heat=true;v.why=`${p.teamName} xG ${l.toFixed(2)} a match over the last 4 vs ${s.toFixed(2)} this season`;}}}
      if(!v.heat){const lp=losingPlace(p,rows,before);if(lp){v.cool=true;v.why=lp;}}
      if(p.pos===1&&!v.heat&&!v.cool){const gs=per(rows,r=>r.gp||0),g4=per(l4,r=>r.gp||0);
        if(gs!=null&&g4!=null&&gs-g4>=0.3){v.cool=true;v.why=`goals prevented ${sgn1(g4)} per 90 over the last 4 vs ${sgn1(gs)} this season`;}}
    }
  }
  _momCache.set(ck,{h:S.hist,m:S.teamMatch,v});return v;
}
/* DefCon Monster (12 Nov 2026, Andy: options 1 and 2, kept exclusive).
   This season's DefCon hits out of matches played, at least 2 in 3 and 5+
   hits: 9 players after GW10 (Richards, Muharemovic, Murillo, Silva 7/10,
   Mainoo 6/8, Pinnock, Palacios 6/9, Botman, Mendy 5/7). A share above 50%
   predicted the next match no better than 50% did (hit 54-56% in GW6-10),
   so this marks the proven elite rather than a sharper forecast. Solid
   (strong next match): the model's per-match chance (p.dcChance) at least
   45% and the opponent's DefCon given (Teams page) at least 1.9 a match,
   the top quarter of clubs. */
const DCM_HITS=5,DCM_CHANCE=0.45,DCM_GIVEN=1.9;
function defconMonster(p,g){
  if(!(p.pos>=2)||!(p.dcHits>=DCM_HITS)||!p.dcApps||p.dcHits*3<p.dcApps*2)return null;
  const q=p.gw&&p.gw[g],DG=typeof dcGiven==="function"?dcGiven():{};
  const opp=((q&&q.fixtures)||[]).map(f=>f.oppT||{}).find(o=>o.short&&(DG[o.short]||{}).per>=DCM_GIVEN);
  const strong=!!opp&&(p.dcChance||0)>=DCM_CHANCE;
  return{strong,tip:`DefCon Monster: ${p.dcHits}/${p.dcApps} this season`+(strong
    ?` · strong next match: ${Math.round(p.dcChance*100)}% chance v ${opp.short}, whose opponents reach DefCon ${DG[opp.short].per.toFixed(1)} times a match`:"")};
}
/* Differential (12 Nov 2026, Andy). Was "under 8% owned and 3.4+ pts", a
   fixed bar that flagged 82 players once the D5 re-fit lifted every
   prediction. Now relative to his position, so later re-fits cannot inflate
   it: predicted next GW in the top 10% of his position among players
   expected to play 60+ minutes, AND either under 5% owned overall, or owned
   by none of his league rivals and under 15% overall. Bright (filled gem)
   when none of the rivals own him. */
let _diffCut=null;
function differential(p,g){
  const pts=x=>(x.gw[g]&&!x.gw[g].blank)?x.gw[g].pts:0;
  if(!_diffCut||_diffCut.m!==S.model||_diffCut.g!==g){const c={};
    [1,2,3,4].forEach(k=>{const v=S.model.players.filter(x=>x.pos===k&&x.xMins>=60).map(pts).sort((a,b)=>a-b);c[k]=v.length?v[Math.floor(0.9*(v.length-1))]:Infinity;});
    _diffCut={m:S.model,g,c};}
  const v=pts(p);if(!(p.owned>0)||v<_diffCut.c[p.pos])return null;
  const R=rivalOwn(),k=R&&R.n?(R.own[p.id]||0):null,none=k===0;
  if(!(p.owned<5||(none&&p.owned<15)))return null;
  return{bright:none,tip:`${p.owned}% owned, ${k==null?"league not loaded":none?"no rival owns him":`${k} of ${R.n} rivals own him`}, predicted ${v.toFixed(1)} pts`};
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
/* The window Buy and Sell are judged over (audit C1, 22 Nov 2026): the page's
   own 1/3/5/ROS switch, so Player Data's icons and counts match its xPts
   column and the Signal Board. S.horizon was stuck at 1 GW everywhere else. */
function sigH(){
  if(S.tab==="table"&&typeof lGwRange==="function"){const r=lGwRange();return Math.max(1,r.count||1);}
  if(S.tab==="signals")return S.sigH||3;
  return S.horizon||1;
}
function signals(p,g,noSell,hh){
  const out=[],h=hh||sigH(),mine=(S.squad||[]).includes(p.id);
  if(!S.model)return out;
  if(buySet(g,h).has(p.id)&&!mine)out.push(["buy",SIG_RULE.buy(h)+`: ${hPts(p,g,h).toFixed(1)} pts`]);
  if(mine&&!noSell){const m=sellMap(h).get(p.id);
    if(m)out.push(["sell",SIG_RULE.sell(h)+`: ${m.inn.web_name} +${m.gain.toFixed(1)}`]);}
  const L=fplLive(p);
  if(L&&L.pcp!=null&&!(L.pcLock&&Date.parse(L.pcLock)>Date.now())){
    if(L.pcp>=100)out.push(["rise",`FPL's predictor: ${Math.round(L.pcp)}% progress to a rise tonight`]);
    else if(L.pcp<=-100)out.push(["fall",`FPL's predictor: ${Math.round(-L.pcp)}% progress to a fall tonight`]);}
  if(p.status!=="u"&&((p.avail<1&&(mine||(p.roleMins||0)>=60))||((p.roleMins||0)>=60&&(p.xMins||0)<60)))
    out.push(["mins",p.avail<1?`${p.avail>0?Math.round(p.avail*100)+"% chance":"Out"}${p.news?" · "+p.news:""}`:`${Math.round(p.xMins||0)} expected minutes`]);
  const mo=momentum(p);
  if(mo&&mo.heat)out.push(["heat",`Heating Up: ${mo.why}`]);
  if(mo&&mo.cool)out.push(["cool",`Cooling Off: ${mo.why}`]);
  const dm=defconMonster(p,g);
  if(dm)out.push(["defcon",dm.tip,dm.strong]);
  const R=rivalOwn();
  if(R&&R.n&&!mine){const k=R.own[p.id]||0;
    if(k>=Math.max(2,Math.ceil(R.n*0.3)))out.push(["rival",`Owned by ${k} of ${R.n} rivals, not you`]);}
  const dv=differential(p,g);
  if(dv)out.push(["diff",dv.tip,dv.bright]);
  const sp=setPieces(p);
  if(sp.pen)out.push(["pen","First-choice penalty taker"]);
  if(sp.cor===1||sp.dfk===1)out.push(["set","Set pieces: "+[sp.cor&&sp.cor<=2?"Corners "+ORD(sp.cor):"",sp.dfk&&sp.dfk<=2?"Free kicks "+ORD(sp.dfk):""].filter(Boolean).join(" · ")]);
  return out;
}
function legendHTML(){
  const h=S.horizon||1;
  return `<div class="legend">${SIG_ORDER.map(k=>`<span class="lgi">${sigTile(k,SIG_RULE[k](h))}<span>${SIGNAL[k][2]}</span></span>`).join("")}</div>`;
}
const sigHTML=(p,g)=>{const s=signals(p,g);return s.length?`<span class="sigs">${s.map(([k,t,b])=>sigTile(k,t,b)).join("")}</span>`:"";};
/* the set-piece line on the player card */
function setPieceText(p){
  const sp=setPieces(p),bits=[];
  if(sp.pen)bits.push("Penalties 1st");
  if(sp.cor&&sp.cor<=3)bits.push("Corners "+ORD(sp.cor));
  if(sp.dfk&&sp.dfk<=3)bits.push("Free kicks "+ORD(sp.dfk));
  return bits.join(" · ");
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
  /* plans were drafted against the old squad, so the weeks still to come go
     with the old draft. Finished weeks are a record and stay: wiping them all
     here (until 20 Nov 2026) took every past week's stored prediction with
     them each time FPL published a new official squad. */
  const nextGw=S.model?S.model.next.id:off.event+1,kept={};
  Object.entries(S.planByGw||{}).forEach(([e,v])=>{if(+e<nextGw)kept[e]=v;});
  S.planByGw=kept;S.replacedBy={};
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
  const cap=S.model.players.find(p=>p.id===S.captain),capIn=cap&&xi.includes(cap)?cap:null;
  const bench=squadPlayers().filter(p=>!xi.includes(p)),ob=orderBench(bench),vice=S.model.players.find(p=>p.id===S.vice);
  /* Week by week, each with its own planned chip (audit C6, 22 Nov 2026):
     a Bench Boost in the viewed week used to be added to every week of the
     horizon (+33.2 at 3 GW for a +9.2 chip), and later chips were ignored. */
  let s=0;
  for(let e=g;e<g+h&&e<=38;e++){
    const chip=chipForWeek(e),w=p=>p.gw[e]?.pts||0;
    s+=xi.reduce((a,p)=>a+w(p),0);
    if(capIn)s+=w(capIn)*(chip==="3xc"?2:1);
    /* M4 (Andy, 22 Nov 2026): a Bench Boost week keeps the vice-captain
       cover; only the bench cover goes, as the bench already scores */
    if(chip==="bboost")s+=bench.reduce((a,p)=>a+w(p),0)+coverPts(xi,[],capIn,vice,e,2);
    else s+=coverPts(xi,ob,capIn,vice,e,chip==="3xc"?3:2);
  }
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
/* ONE TRANSFER ENGINE (redesign wave 4, 20 Oct 2026). Every move the app
   suggests comes from here: Top Move and Sell, the five-week plan, the
   flagged-player replacements, the multi-player combo and the Signals
   page's replacements. A move is worth what it adds to the best legal XI
   plus captain, week by week over the horizon (later weeks x DECAY^k).
   Candidates: same position, not already owned, available, affordable from
   the bank plus the selling price, within the club limit, not ignored;
   twelve per outgoing player are short-listed by player-against-player gain,
   then each is scored on the XI.
   o: {squad, bank, g, h, outs (ids, default all), exclude (ids), per (12)} */
function engineMoves(o){
  if(!S.model||!o.squad||!o.squad.length)return[];
  const byId=o.byId||new Map(S.model.players.map(p=>[p.id,p]));
  const g=o.g,h=o.h||1,squad=o.squad,ex=new Set([...(o.exclude||[]),...(S.ignored||[])]);
  const base=[];for(let k=0;k<h&&g+k<=38;k++)base.push(xiTotal(squad,g+k,byId));
  const out=[];
  (o.outs||squad).forEach(oid=>{
    const ou=byId.get(oid);if(!ou)return;
    const cc={};squad.filter(i=>i!==oid).forEach(i=>{const p=byId.get(i);if(p)cc[p.team]=(cc[p.team]||0)+1;});
    const cands=[];
    S.model.players.forEach(p=>{
      if(p.pos!==ou.pos||squad.includes(p.id)||p.avail<=0||ex.has(p.id))return;
      if(p.price>o.bank+sellPrice(ou)+.001)return;
      if((cc[p.team]||0)>=RULES.clubMax)return;
      cands.push({p,pg:dGain(p,ou,g,h)});});
    cands.sort((a,b)=>b.pg-a.pg).slice(0,o.per||12).forEach(({p,pg})=>{
      out.push({out:ou,inn:p,gain:xiGain(squad,oid,p.id,g,h,byId,base),pg,sell:sellPrice(ou)});});
  });
  out.sort((a,b)=>(b.gain-a.gain)||(b.pg-a.pg));
  return out;
}
let _bsCache={};
function bestSwaps(limit,hh){
  if(!S.model||!S.squad)return[];
  const g=VG(),h=hh||S.horizon||1,bank=planBank();
  const key=[g,h,bank,S.squad.join("."),(S.ignored||[]).join("."),S.model.players.length].join("|");
  const hit=_bsCache[key];
  if(hit&&hit.model===S.model)return hit.res.slice(0,limit||10);
  /* wave 4: the one engine; a move must add something to the XI */
  const seen=new Set(),uniq=[];
  engineMoves({squad:S.squad,bank,g,h}).forEach(m=>{const k=m.out.id+"-"+m.inn.id;
    if(m.gain>0.05&&!seen.has(k)){seen.add(k);uniq.push(m);}});
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
  /* 22 Nov 2026 (Andy): a player the plan buys is kept to its end, and one it
     sells is not bought back, so the plan does not churn */
  const bought=new Set(),sold=new Set();
  for(let k=0;k<H&&g0+k<=38;k++){
    const w=g0+k,rem=Math.min(H-k,39-w);
    const top=engineMoves({squad,bank,g:w,h:rem,byId,outs:squad.filter(i=>!bought.has(i)),exclude:[...sold]})[0];
    const best=top?{o:top.out,p:top.inn,gain:top.gain,sell:top.sell}:null;
    const bar=ft>0?FT_VALUE:FT_VALUE+HIT;
    if(best&&best.gain>bar){
      const hit=ft>0?0:HIT;
      bank=+(bank+best.sell-best.p.price).toFixed(1);
      weeks.push({w,ft,out:best.o,inn:best.p,gain:best.gain,hit,bank,sell:best.sell,squad:squad.map(i=>i===best.o.id?best.p.id:i)});
      total+=best.gain-hit;
      squad=squad.map(i=>i===best.o.id?best.p.id:i);bought.add(best.p.id);sold.add(best.o.id);
      ft=Math.min(FT_MAX,Math.max(0,ft-1)+1);
    }else{
      weeks.push({w,ft,roll:true,best:best?{out:best.o,inn:best.p,gain:best.gain}:null,bar,squad:squad.slice()});
      ft=Math.min(FT_MAX,ft+1);
    }
  }
  const res={weeks,total,H};
  Object.assign(_planCache,{key,model:S.model,res});
  return res;
}
/* wave 4: several outs at once, filled one by one through the engine (the
   dearest slot first, keeping enough back for the cheapest replacement of
   each slot still to fill), each scored on the XI over the horizon. */
function bestCombo(outIds,hh,per){
  if(!S.model||!outIds.length)return null;
  const g=S.model.next.id,h=hh||S.horizon||1;
  const byId=new Map(S.model.players.map(p=>[p.id,p]));
  const outs=outIds.map(i=>byId.get(i)).filter(Boolean);
  const freed=planBank()+outs.reduce((a,p)=>a+sellPrice(p),0);
  let squad=(S.squad||[]).slice(),bank=planBank();
  const picks=[];
  const order=[...outs].sort((a,b)=>b.price-a.price);
  order.forEach((o,ix)=>{
    const minFor=pos=>{let m=99;S.model.players.forEach(q=>{
      if(q.pos===pos&&!squad.includes(q.id)&&!outIds.includes(q.id)&&q.avail>0&&q.price<m)m=q.price;});return m===99?3.9:m;};
    const rest=order.slice(ix+1);
    const reserve=rest.reduce((a,x)=>a+minFor(x.pos)-sellPrice(x),0);
    /* F60: the players being sold are not candidates for their own slots */
    const best=engineMoves({squad,bank:bank-Math.max(0,reserve),g,h,outs:[o.id],exclude:outIds,byId,per})[0];
    /* F60: a move that gains nothing is not a move; that player stays */
    if(best&&best.gain>0.05){picks.push(best);squad=squad.map(i=>i===o.id?best.inn.id:i);bank=+(bank+best.sell-best.inn.price).toFixed(1);}
  });
  const spent=picks.reduce((a,m)=>a+m.inn.price,0);
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
     rise, rounded down), not the current price. F46, changed 22 Nov 2026
     (Andy): a swap the bank cannot cover is allowed into the plan with a
     warning; Save is what refuses an overspent squad. */
  const bank=+((planBank())+sellPrice(o)-i.price).toFixed(1);
  if(bank<-0.001)toast(`Over budget by £${(-bank).toFixed(1)} for ${i.web_name}. Plan it, but Save stays off until the bank is back to £0.0`,{warn:true});
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
     planned edits this week that move it (those write their own bank).
     An edit undone (sell a player, buy him back) leaves the official squad
     with a bank short by the sell/buy gap; FPL charges nothing for a
     transfer never made, so the official squad always has the official bank
     (12 Nov 2026: £0.6 shown, and quoted by The Scout, against FPL's £1.1). */
  if(g===next){
    const pb=S.planByGw&&S.planByGw[g];
    if(!(pb&&pb.bank!=null)||isOfficialSquad(pb.squad||S.squad)){
      const f=bankFromFeed();if(f!=null)return f;
    }
  }
  return S.bank;
}
/* Whether a squad is the latest official one, the same fifteen players. */
function isOfficialSquad(ids){
  const off=latestOfficialPicks();
  if(!off||!Array.isArray(ids)||ids.length!==15)return false;
  const have=new Set(off.picks.map(pk=>pk.id));
  return ids.every(i=>have.has(i));
}
/* Historical returns for this manager, shown alongside each projection */
const TRANSFER_MIN=1.0;   // a suggestion has to be worth the transfer
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

/* ---------- news ---------- */
/* News (rebuilt 22 Nov 2026). The server reads every source every 15
   minutes, tags each story with a category and the players it names, and
   keeps the one flag log. The page makes three same-origin calls: /api/news
   (stories and social media), /api/flags (every FPL flag change) and
   /api/player-news for the squad's own searches (the page knows the
   squad; the server does not). The flag log loads even when the news does
   not: the player card, the Planner's badges and Fitness and Risk use it. */
async function loadNews(){
  if(!S.model)return;
  if(BACKUP){S.newsState="backup";render();return;}
  S.newsState="loading";render();
  fetch("/api/flags").then(r=>r.ok?r.json():null).then(d=>{if(d&&d.players){S.flags=d;render();}}).catch(()=>{});
  try{
    const r=await fetch("/api/news");
    if(!r.ok)throw new Error("HTTP "+r.status);
    const d=await r.json();
    const arr=a=>Array.isArray(a)?a.filter(n=>n&&n.title&&Number.isFinite(+n.time)):[];
    S.news=arr(d.news);S.social=arr(d.social);S.newsSources=d.perSource||{};S.newsFetchedAt=d.fetchedAt||null;
    let squad=[];
    try{
      const r2=await fetch("/api/player-news?ids="+(S.squad||[]).join(","));
      if(r2.ok){const d2=await r2.json();squad=Object.values(d2.items||{}).flat();}
    }catch(e){/* the squad's own searches are additive */}
    const seen=new Set(S.news.map(n=>newsKey(n.title)));
    S.squadNews=arr(squad).filter(n=>{const k=newsKey(n.title);if(seen.has(k))return false;seen.add(k);return true;});
    S.newsState=(S.news.length||S.social.length||S.squadNews.length)?"ok":"fail";
  }catch(e){S.newsState="fail";}
  render();
}
const newsKey=t=>String(t||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim().slice(0,70);
/* one player's stories for his card: the feeds plus his own search, fetched
   once when his News tab first opens */
async function loadPlayerNews(id){
  S.pNews=S.pNews||{};if(S.pNews[id]||BACKUP)return;
  S.pNews[id]=[];
  try{const r=await fetch("/api/player-news?ids="+id);if(r.ok){const d=await r.json();S.pNews[id]=(d.items&&d.items[id])||[];render();}}catch(e){}
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

/* A finished week's prediction for one player (20 Nov 2026). First the
   server's snapshot taken before that deadline (/data/feeds/predictions.json,
   the same record the Status page grades), then the copy this browser saved
   while the week was live, then the labelled backtest (today's model on that
   week's pre-deadline data) for weeks before snapshots began. Past weeks no
   longer depend on what one browser happened to keep. */
function pastPred(p,g){
  const L=S.predLive&&S.predLive.gw&&S.predLive.gw[g];
  const lv=L&&L.players&&(L.players[p.id]??L.players[String(p.id)]);
  if(lv!=null){const t=L.taken?new Date(L.taken):null;
    return{v:+lv,src:"live",why:`Model's prediction saved before the GW${g} deadline${t?" ("+t.toLocaleString("en-GB",{timeZone:"Europe/London",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})+")":""}`};}
  const pb=S.planByGw&&S.planByGw[g]&&S.planByGw[g].predByPlayer;
  const lc=pb&&(pb[p.id]??pb[String(p.id)]);
  if(lc!=null)return{v:+lc,src:"local",why:`Model's prediction saved in this browser while GW${g} was live`};
  const B=S.predBack&&S.predBack.gw&&S.predBack.gw[g];
  const bk=B&&B.players&&(B.players[p.id]??B.players[String(p.id)]);
  if(bk!=null)return{v:+bk,src:"backtest",why:`Backtest: what the model projects from the data as it stood before the GW${g} deadline (no live snapshot that week)`};
  return null;
}
/* A finished week's fixture for one player, from the season's calendar:
   the opponent, home or away, and the score. Difficulty is the opponent's
   FPL strength rating for the venue. */
function pastFxGW(p,g){
  const fx=((S.model&&S.model.byEv&&S.model.byEv[g])||[]).filter(f=>f.ht&&f.at&&(f.ht.id===p.team||f.at.id===p.team));
  if(!fx.length)return fxBlank(`GW${g}: no fixture`);
  const ch=fx.map(f=>{const home=f.ht.id===p.team,o=home?f.at:f.ht;
    const d=fdrBand(home?(o.soa||3):(o.soh||3));
    const sc=f.hs!=null&&f.as!=null&&f.finished?` · ${home?f.hs:f.as}–${home?f.as:f.hs}`:"";
    return fxChip(o.short,home,d,{title:`GW${g}: ${o.name||o.short} ${home?"(home)":"(away)"}${sc}`});});
  return ch.length>1?`<span class="fxdbl">${ch.join("")}</span>`:ch[0];
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
/* Kind and hard fixture runs for the next five weeks (Attack and Defence
   outlook): This Week's Fixture Outlook card and its pop-up */
function dashRuns(){
  const g=VG(), sp=squadPlayers();
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
  return{att:bestOf(attP),attBad:worstOf(attP),def:bestOf(defP),defBad:worstOf(defP)};
}
/* The Squad Dashboard's detail, now shown in This Week's pop-ups (21 Nov
   2026): pick lists the parts to show (str, caps, risk, form, aout, dout). */
function dashHTML(pick){
  pick=pick||["str","caps","risk","form","aout","dout"];
  const g=VG(), d=dashData();
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
  const cell=(k,title,head,body,colour)=>!pick.includes(k)?"":`
    <div class="dashpart"><div class="dashph"><span class="dkey">${title}</span>
        <span class="dval" style="${colour||""}">${head}</span></div>
      <div class="dashbody">${body}</div></div>`;

  /* strength is keyed by position: {got, best, pct, n} for each */
  const st=d.strength||{};
  const totGot=[1,2,3,4].reduce((a,k)=>a+(st[k]?st[k].got:0),0);
  const totBest=[1,2,3,4].reduce((a,k)=>a+(st[k]?st[k].best:0),0);
  const barPct=Math.round(100*totGot/Math.max(1,totBest));
  return `<div class="dashparts">
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

/* The Planner's List view (21 Nov 2026, Andy's columns): Player, Sells (paid
   under it), Pts, Form, xMins, xPts (the pitch's own pill), 3GW, Owned,
   Rivals, Next 3, then the transfer button and the menu. Every header
   sorts (again to reverse); sorted by Player it groups by position with the
   bench last, any other sort is one list with the bench marked SUB. */
function cardPts(p){
  const g=VG(),next=S.model.next.id,official=_histSquadActive;
  const {captain:capForGw}=effectiveCaptainVice(g);
  const isC=_histCaptain!=null?_histCaptain===p.id:capForGw===p.id;
  const capMult=official?((_histMult&&_histMult[p.id]>=2)?_histMult[p.id]:1):(isC?(chipForWeek(g)==="3xc"?3:2):1);
  const isPast=g<next,sp=isPast?pastPred(p,g):null,snap=sp?sp.v:null;
  const base=snap!=null?snap:(isPast?null:hPts(p,g,S.horizon));
  const feed=(S.playerActuals&&(S.playerActuals[p.id]||S.playerActuals[String(p.id)]))||null;
  const act1=feed?feed[g]??feed[String(g)]:null;
  const v=act1!=null?act1*capMult:(base!=null?base*capMult:null);
  const col=ptsCol((v||0)/Math.max(1,S.horizon));
  return{v,col,elite:col[2]==="elite"&&v!=null,actual:act1!=null};
}
/* the next three gameweeks on the fixture chips' difficulty scale (as This
   Week's Fixture Outlook: a blank counts 5, a double one easier) */
function runOf3(p,g){let s=0,n=0;for(let e=g;e<g+3&&e<=38;e++){const q=p.gw[e];
  if(!q||q.blank||!q.fixtures.length){s+=5;n++;continue;}
  s+=q.fixtures.reduce((a,f)=>a+fdrBand(posDiff(p,f)),0)/q.fixtures.length-(q.fixtures.length>1?1:0);n++;}
  return n?s/n:5;}
function squadListHTML(){
  const g=VG(),xi=startingXI(),sp=squadPlayers(),official=_histSquadActive;
  const cv=effectiveCaptainVice(g),capId=official?_histCaptain:cv.captain,viceId=official?_histVice:cv.vice;
  const R=rivalOwn(),pts=new Map(sp.map(p=>[p.id,cardPts(p)]));
  const key=S.sqSort||"pos",dir=S.sqDir||"asc";
  const val={pos:p=>p.pos,sell:p=>sellPrice(p),total:p=>p.total,form:p=>p.form,xmins:p=>p.xMins,
    pred:p=>pts.get(p.id).v??-1,p3:p=>hPts(p,g,3),own:p=>p.owned,riv:p=>R&&R.n?(R.own[p.id]||0):0,next:p=>runOf3(p,g)}[key]||(p=>p.pos);
  const cols=[["pos","Player"],["sell","Sells"],["total","Pts"],["form","Form"],["xmins","xMins"],["pred","xPts"],["p3","3GW"],["own","Owned"],["riv","Rivals"],["next","Next 3"]];
  const arrow=k=>key===k?(dir==="asc"?" ↑":" ↓"):"";
  const head=`<div class="lv-h">${cols.map(([k,n])=>`<button class="lv-hc lv-${k}${key===k?" act":""}" onclick="act('sqsort','${k}')" aria-sort="${key===k?(dir==="asc"?"ascending":"descending"):"none"}">${n}${arrow(k)}</button>`).join("")}<span class="lv-act"></span></div>`;
  const row=p=>{const on=xi.includes(p),buy=purchaseOf(p).paid,sell=sellPrice(p),c=pts.get(p.id),menu=S.pMenu===p.id&&!official,fl=S.flagged.includes(p.id);
    return `<div class="lv-r${on?"":" sub"}${fl?" dim":""}${menu?" open":""}" data-pid="${p.id}"${official?"":` oncontextmenu="event.preventDefault();act('pmenu',${p.id})"`}>
      <span class="lv-pos"><button class="lv-pl" onclick="act('card',${p.id})">${photoHTML(p,"lv-ph")}<span class="lv-nm"><b>${esc(p.web_name)}</b>${capId===p.id?`<span class="pz-cv"${official?' title="Captain (official)"':""}>C</span>`:viceId===p.id?`<span class="pz-cv v"${official?' title="Vice-captain (official)"':""}>V</span>`:""}${inDT(p)?dtStar("pz-dts",9):""}${p.avail<1?`<span class="pz-inj" style="--fl:${p.avail===0?"var(--red)":p.avail>=.75?"#FFD23F":"#FF9F2E"}" title="${esc(flagTitle(p))}">${lic("triangle-alert",12)}<i>${Math.round(p.avail*100)}%</i></span>`:""}${on||key==="pos"?"":`<span class="lv-sub">SUB</span>`}<i>${esc(p.teamName)} · ${POSL[p.pos]}</i></span></button></span>
      <span class="lv-sell"><b>£${sell.toFixed(1)}${arw(p.priceChange)}</b><i class="${sell>buy?"up":sell<buy?"dn":""}">paid £${buy.toFixed(1)}</i></span>
      <span class="lv-total">${p.total}</span><span class="lv-form">${p.form.toFixed(1)}</span><span class="lv-xmins mu">${Math.round(p.xMins)}′</span>
      <span class="lv-pred"><span class="lv-pt" style="background:${c.v==null?"var(--ink3)":c.col[0]};color:${c.v==null?"var(--mute)":c.col[1]}${c.elite?";box-shadow:0 0 0 2px #EAFFEF,0 0 10px rgba(125,251,158,.7)":""}" title="${c.actual?"Actual":"Predicted"} GW${g}${capId===p.id?", captain":""}">${c.v==null?"—":c.v.toFixed(1)}</span></span>
      <span class="lv-p3 cy">${hPts(p,g,3).toFixed(1)}</span><span class="lv-own">${p.owned}%</span>
      <span class="lv-riv">${R&&R.n?`${R.own[p.id]||0}/${R.n}`:"—"}</span>
      <span class="lv-next">${g<S.model.next.id?fxRun(pastFxGW(p,g),"sm"):fxNext(p,g,3,"sm")}</span>
      <span class="lv-act">${official?"":`<button class="pz-xf${fl?" on":""}" onclick="act('flag',${p.id})" title="${fl?"Keep":"Transfer out"} ${esc(p.web_name)}" aria-label="${fl?"Keep":"Transfer out"} ${esc(p.web_name)}">${lic("arrow-right-left",12)}</button>
        <button class="lv-more" onclick="event.stopPropagation();act('pmenu',${p.id})" aria-label="More for ${esc(p.web_name)}">···</button>`}${menu?pmenuHTML(p,on?null:{cycle:p.pos!==1}):""}</span></div>`;};
  const sorted=list=>list.slice().sort((a,b)=>{const x=val(a),y=val(b);return dir==="asc"?x-y:y-x;});
  let body;
  if(key==="pos"){
    const grp=(label,list)=>list.length?`<div class="lv-g"><span>${label}</span><i>${list.reduce((a,p)=>a+(pts.get(p.id).v||0),0).toFixed(1)} pts</i></div>${list.map(row).join("")}`:"";
    const byV=list=>list.slice().sort((a,b)=>(pts.get(b.id).v||0)-(pts.get(a.id).v||0));
    const groups=[[1,"Goalkeeper"],[2,"Defenders"],[3,"Midfielders"],[4,"Forwards"]];
    const order=dir==="asc"?groups:groups.slice().reverse();
    body=order.map(([k,n])=>grp(n,byV(xi.filter(p=>p.pos===k)))).join("")+grp("Bench",orderBench(sp.filter(p=>!xi.includes(p))));
  }else body=sorted(sp).map(row).join("");
  return `<div class="lv">${head}${body}</div>`;
}
/* icons for the Chips page (Lucide 1.52.0, ISC) */
/* News redesign icons (22 Nov 2026) */
Object.assign(LUCIDE,{"shirt": "<path d=\"M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z\" />", "newspaper": "<path d=\"M15 18h-5\" /> <path d=\"M18 14h-8\" /> <path d=\"M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2\" /> <rect width=\"8\" height=\"4\" x=\"10\" y=\"6\" rx=\"1\" />", "heart-pulse": "<path d=\"M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5\" /> <path d=\"M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27\" />", "pin": "<path d=\"M12 17v5\" /> <path d=\"M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z\" />", "calendar-days": "<path d=\"M8 2v3\" /> <path d=\"M16 2v3\" /> <rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" /> <path d=\"M3 9h18\" /> <path d=\"M8 13h.01\" /> <path d=\"M12 13h.01\" /> <path d=\"M16 13h.01\" /> <path d=\"M8 17h.01\" /> <path d=\"M12 17h.01\" /> <path d=\"M16 17h.01\" />", "play": "<path d=\"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z\" />", "cloud": "<path d=\"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z\" />"});
Object.assign(LUCIDE,{"chart-column":"<path d=\"M3 3v16a2 2 0 0 0 2 2h16\" /><path d=\"M18 17V9\" /><path d=\"M13 17V5\" /><path d=\"M8 17v-3\" />","wand-sparkles":"<path d=\"m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72\" /><path d=\"m14 7 3 3\" /><path d=\"M5 6v4\" /><path d=\"M19 14v4\" /><path d=\"M10 2v2\" /><path d=\"M7 8H3\" /><path d=\"M21 16h-4\" /><path d=\"M11 3H9\" />","zap":"<path d=\"M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z\" />","armchair":"<path d=\"M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3\" /><path d=\"M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z\" /><path d=\"M5 18v2\" /><path d=\"M19 18v2\" />","layers":"<path d=\"M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z\" /><path d=\"M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12\" /><path d=\"M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17\" />","calendar-range":"<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" /><path d=\"M16 2v3\" /><path d=\"M3 9h18\" /><path d=\"M8 2v3\" /><path d=\"M17 13h-6\" /><path d=\"M13 17H7\" /><path d=\"M7 13h.01\" /><path d=\"M17 17h.01\" />","circle-check":"<circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"m16 9-5.5 5.5L8 12\" />"});
/* ============================================================
   CHIPS (20 Nov 2026, Andy): one team score for every chip.
   A chip's gain is the Planner's own team score (weekPtsFor's rules: best
   legal XI, captain, vice and bench cover, the chip) with the chip minus
   without it, so planning a chip moves the Planner's total by exactly the
   gain shown here. Free Hit and Wildcard teams come from the same optimiser
   as Compare and the Team Rating. Blanks and doubles FPL has not yet put in
   its fixtures come from Ben Crellin's forecast, weighted by how sure it is.
   ============================================================ */
/* Ben Crellin's 2026/27 forecast (his calendar, fantasyfootballhub.co.uk/
   articles/crellin-calendar, read 20 Nov 2026). He is the source of truth:
   update this by hand when he posts changes. A week FPL has already
   rearranged uses FPL's own fixtures instead. p = how sure (likely .75,
   possible .4, cup blanks .9). */
/* Ben Crellin's forecast. Add teams:["ARS","CHE"] (FPL short names) to a
   week once he names the clubs, and the weighting uses your own players
   from those clubs (chipWeighted) */
const CRELLIN={read:"20 Nov 2026",weeks:{
  30:{t:"blank",p:0.9,why:"Carabao Cup final"},
  32:{t:"double",p:0.75,why:"likely double"},
  33:{t:"blank",p:0.9,why:"FA Cup semi-finals"},
  35:{t:"double",p:0.4,why:"possible double"},
  36:{t:"double",p:0.4,why:"possible double"}}};
/* The week each chip was played in past seasons, from Andy's season
   workbooks (Planner sheet, chip row). Gains come from League's chip
   performance (TRACKER_HISTORY.chips); this season from FPL. */
const CHIP_WEEKS={
  "2025/26":{WC1:4,FH1:3,TC1:6,BB1:8,TC2:26,WC2:32,BB2:33,FH2:34},
  "2024/25":{WC1:7,BB1:24,TC1:25,WC2:30,FH1:36},
  "2023/24":{WC1:8,TC1:25,WC2:27,FH1:29,BB1:34},
  "2022/23":{WC1:9,TC1:22,FH1:28,BB1:29,WC2:33},
  "2021/22":{WC1:4,FH1:18,TC1:26,WC2:28,BB1:29,FH2:37},
  "2020/21":{WC1:5,FH1:18,BB1:19,TC1:24,WC2:30}};
const CHIP_UI={wildcard:{n:"Wildcard",s:"WC",c:"#A78BFA",i:"wand-sparkles"},freehit:{n:"Free Hit",s:"FH",c:"#22D3EE",i:"zap"},
  bboost:{n:"Bench Boost",s:"BB",c:"#3DDC97",i:"armchair"},"3xc":{n:"Triple Captain",s:"TC",c:"#FFB020",i:"crown"}};
let _chipCid=0;
const _chipModelId=()=>S.model?(S.model._cid||(S.model._cid=++_chipCid)):0;
let _chipById=null;
function chipPlayer(id){
  if(!_chipById||_chipById.m!==_chipModelId())_chipById={m:_chipModelId(),map:new Map(S.model.players.map(p=>[p.id,p]))};
  return _chipById.map.get(id);
}
/* the Planner's team score for any 15 in any week (weekPtsFor's rules with
   the best legal XI and its top scorer as captain) */
function teamScore(ids,e,chip,adj){
  /* adj: optional Map of player id → factor on his points (a forecast
     blank or double for named clubs) */
  const sp=(ids||[]).map(chipPlayer).filter(Boolean),v=p=>(p.gw[e]?.pts||0)*(adj?(adj.get(p.id)??1):1);
  if(!sp.length)return 0;
  const xi=legalBestXI(sp,v);if(!xi.length)return 0;
  const cap=xi.reduce((m,p)=>(!m||v(p)>v(m))?p:m,null);
  const vice=xi.filter(p=>p!==cap).reduce((m,p)=>(!m||v(p)>v(m))?p:m,null);
  const bench=sp.filter(p=>!xi.includes(p));
  let s=xi.reduce((a,p)=>a+v(p),0)+(cap?v(cap):0);
  if(chip==="bboost")s+=bench.reduce((a,p)=>a+v(p),0);
  if(chip==="3xc"&&cap)s+=v(cap);
  /* M4 (Andy, 22 Nov 2026): a Bench Boost keeps the vice-captain cover;
     only the bench cover goes, as the bench already scores */
  s+=chip==="bboost"?coverPts(xi,[],cap,vice,e,2):coverPts(xi,orderBench(bench),cap,vice,e,chip==="3xc"?3:2);
  return s;
}
/* FPL's own doubles and blanks for a week */
function weekShape(e){
  const n={};(S.model.byEv[e]||[]).forEach(f=>{if(f.ht)n[f.ht.id]=(n[f.ht.id]||0)+1;if(f.at)n[f.at.id]=(n[f.at.id]||0)+1;});
  return{dbl:S.model.teams.filter(t=>(n[t.id]||0)>=2),blank:S.model.teams.filter(t=>!n[t.id])};
}
/* Crellin's forecast for a week, unless FPL has already rearranged it */
function chipForecast(e){
  const sh=weekShape(e);if(sh.dbl.length||sh.blank.length)return null;
  return CRELLIN.weeks[e]||null;
}
/* the week's shape for the roadmap: FPL's when known, else the forecast */
function chipWeekMark(e){
  const sh=weekShape(e);
  if(sh.dbl.length)return{t:"double",p:1,why:sh.dbl.map(t=>t.short).join(" "),src:"FPL"};
  if(sh.blank.length&&sh.blank.length<S.model.teams.length)return{t:"blank",p:1,why:sh.blank.map(t=>t.short).join(" "),src:"FPL"};
  const f=CRELLIN.weeks[e];return f?Object.assign({src:"Crellin"},f):null;
}
/* the best Free Hit or Wildcard 15 for a week: the optimiser (as Compare
   and Team Rating use) when best is asked for, else the quick builder */
function chipTeam(kind,e,best){
  const b=squadBudget();
  const t=(best?optimalSquad(kind,e,b):null)||buildSquad(kind,e,null,b);
  if(!t)return null;
  const ids=t.xi.concat(t.bench).map(p=>p.id);
  return kind==="freehit"?benchWeighted(t,ids,e,b):{t,ids};
}
/* M1 (Andy, 22 Nov 2026): the optimiser picks the Free Hit XI and treats the
   bench as filler, but the gain is scored with bench cover, so one bench swap
   often beat the "best" team by 1.5 to 4 points. Each bench slot is offered
   the best twenty same-position players the budget and the three-per-club
   rule allow, and a swap is kept when it raises the team score. */
function benchWeighted(t,ids,e,budget){
  const v=p=>p.gw[e]?.pts||0;
  const pool={};S.model.players.forEach(p=>(pool[p.pos]=pool[p.pos]||[]).push(p));
  Object.keys(pool).forEach(k=>pool[k].sort((a,b)=>v(b)-v(a)));
  let cur=ids.slice(),score=teamScore(cur,e,null);
  for(let pass=0;pass<2;pass++){
    const sp=cur.map(chipPlayer).filter(Boolean),xi=new Set(legalBestXI(sp,v).map(p=>p.id));
    let moved=false;
    for(const out of sp.filter(p=>!xi.has(p.id))){
      const now=cur.map(chipPlayer).filter(Boolean),cost=now.reduce((a,p)=>a+(p.price||0),0)-(out.price||0),club={};
      now.forEach(p=>{if(p.id!==out.id)club[p.team]=(club[p.team]||0)+1;});
      let bestIds=null,bestS=score+0.05;
      for(const c of (pool[out.pos]||[]).filter(p=>!cur.includes(p.id)&&cost+(p.price||0)<=budget+1e-9&&(club[p.team]||0)<3).slice(0,20)){
        const tryIds=cur.map(i=>i===out.id?c.id:i),s=teamScore(tryIds,e,null);
        if(s>bestS){bestS=s;bestIds=tryIds;}
      }
      if(bestIds){cur=bestIds;score=bestS;moved=true;}
    }
    if(!moved)break;
  }
  if(cur.join(".")===ids.join("."))return{t,ids};
  const sp=cur.map(chipPlayer).filter(Boolean),xi=legalBestXI(sp,v);
  return{t:{...t,xi,bench:sp.filter(p=>!xi.includes(p))},ids:cur};
}
/* The squad your free transfers would reach anyway over a Wildcard's five
   weeks (21 Nov 2026, Andy): one transfer a week from the Wildcard week,
   each the swap (same position, within budget, at most three per club)
   that adds most to the team score over the rest of the window. Swaps are
   shortlisted on the players' own points, then the best ten are tried on
   the team score. path[k] is the squad in week e+k. */
let _ftPaths=null;
function ftPath(ids,e,to){
  const sg=chipSig();if(!_ftPaths||_ftPaths.sig!==sg)_ftPaths={sig:sg,m:new Map()};
  const last=Math.min(38,to||e+4);
  const key=e+"|"+last+"|"+ids.join(".");if(_ftPaths.m.has(key))return _ftPaths.m.get(key);
  const budget=squadBudget(),out=[];
  const span=(p,a)=>{let s=0;for(let w=a;w<=last;w++)s+=p.gw[w]?.pts||0;return s;};
  const sumScore=(sq,a)=>{let s=0;for(let w=a;w<=last;w++)s+=teamScore(sq,w,null);return s;};
  const pool={};S.model.players.forEach(p=>(pool[p.pos]=pool[p.pos]||[]).push(p));
  Object.keys(pool).forEach(k=>{pool[k]=pool[k].map(p=>[p,span(p,e)]).sort((a,b)=>b[1]-a[1]).slice(0,30).map(x=>x[0]);});
  let cur=ids.slice();
  for(let w=e;w<=last;w++){
    const sp=cur.map(chipPlayer).filter(Boolean),cost=sp.reduce((a,p)=>a+(p.price||0),0),club={};
    sp.forEach(p=>club[p.team]=(club[p.team]||0)+1);
    const cand=[];
    sp.forEach(o=>{const room=budget-cost+(o.price||0),vo=span(o,w);
      (pool[o.pos]||[]).forEach(p=>{if(cur.includes(p.id)||(p.price||0)>room+1e-9)return;
        if(p.team!==o.team&&(club[p.team]||0)>=RULES.clubMax)return;
        const d=span(p,w)-vo;if(d>0)cand.push({o:o.id,i:p.id,d});});});
    cand.sort((a,b)=>b.d-a.d);
    const now=sumScore(cur,w);let best=null;
    cand.slice(0,10).forEach(c=>{const sq=cur.map(x=>x===c.o?c.i:x),g=sumScore(sq,w)-now;if(g>0&&(!best||g>best.g))best={sq,g};});
    if(best)cur=best.sq;
    out.push(cur.slice());}
  _ftPaths.m.set(key,out);return out;
}
/* gain from a chip in week e, on the team score. A Wildcard counts five
   weeks with the transfer engine's decay, and both sides keep making one
   free transfer a week: your squad from the Wildcard week, the Wildcard
   squad from the week after (ftPath). It is worth what it adds beyond the
   transfers you would make anyway. */
function chipGainAt(kind,e,best,ids){
  ids=ids||effectiveSquadIds(e).ids;
  const base=teamScore(ids,e,null);
  if(kind==="bboost"||kind==="3xc")return teamScore(ids,e,kind)-base;
  const T=chipTeam(kind,e,best);if(!T)return null;
  if(kind==="freehit")return Math.max(0,teamScore(T.ids,e,null)-base);
  const last=Math.min(38,e+4),mine=ftPath(ids,e,last),theirs=e<last?ftPath(T.ids,e+1,last):[];
  let g=0;for(let k=0;k<5&&e+k<=38;k++)g+=Math.pow(DECAY,k)*(teamScore(k?theirs[k-1]||T.ids:T.ids,e+k,null)-teamScore(mine[k]||ids,e+k,null));
  return g;
}
/* forecast weighting. When the forecast names the clubs (CRELLIN.weeks[e]
   .teams, FPL short names), it is applied to your own players from those
   clubs: a blank scales their points by (1 - how sure), a double by
   (1 + how sure); a Free Hit gains what the blank would cost your team,
   a Bench Boost or Triple Captain is scored with the adjusted points.
   Without named clubs: a blank adds to a Free Hit about a fifth of your
   team score, a double adds about 30% to Bench Boost and Triple Captain,
   each times how sure it is. */
function chipWeighted(kind,e,v,ids){
  const f=chipForecast(e);if(!f||v==null)return{v,f:null};
  /* a possible double counts only once FPL confirms it, so the plans lean
     on likely doubles until then (21 Nov 2026, Andy) */
  if(f.t==="double"&&f.p<0.6)return{v,f:null};
  if(Array.isArray(f.teams)&&f.teams.length){
    const named=new Set(S.model.teams.filter(t=>f.teams.includes(t.short)).map(t=>t.id));
    const adj=new Map(ids.map(chipPlayer).filter(p=>p&&named.has(p.team)).map(p=>[p.id,f.t==="blank"?1-f.p:1+f.p]));
    if(kind==="freehit"&&f.t==="blank")return{v:v+(teamScore(ids,e,null)-teamScore(ids,e,null,adj)),f};
    if(kind==="bboost"||kind==="3xc")return{v:teamScore(ids,e,kind,adj)-teamScore(ids,e,null,adj),f};
    return{v,f:null};
  }
  /* M2 (Andy, 22 Nov 2026): a forecast blank counts only the clubs it names.
     Without named clubs there is no way to know which of yours blank, so the
     Free Hit is not lifted (it used to add a fifth of your whole team score,
     more than a confirmed blank of two of your clubs was worth). */
  if(kind==="freehit"&&f.t==="blank")return{v,f};
  if((kind==="bboost"||kind==="3xc")&&f.t==="double")return{v:v*(1+f.p*0.3),f};
  return{v,f:null};
}
let _chipCurves=null;
function chipSig(){return[_chipModelId(),(S.squad||[]).join("."),JSON.stringify(S.planByGw||{}),squadBudget().toFixed(1),S.bank,typeof _optDone!=="undefined"?_optDone:0].join("|");}
/* gain for every legal week of a chip key ("bboost1", "wildcard2"...):
   {e:{v (weighted), raw, f (forecast), proven}} */
function chipCurve(key){
  if(!S.model)return{};
  const sig=chipSig();
  if(!_chipCurves||_chipCurves.sig!==sig)_chipCurves={sig,c:{}};
  if(_chipCurves.c[key])return _chipCurves.c[key];
  const kind=chipKind(key),half2=key.endsWith("2"),g=S.model.next.id;
  const from=half2?Math.max(20,g):g,to=half2?38:19,out={};
  for(let e=from;e<=to;e++){
    const ids=effectiveSquadIds(e).ids;if(!ids.length)continue;
    const raw=chipGainAt(kind,e,false,ids);if(raw==null)continue;
    const w=chipWeighted(kind,e,raw,ids);
    out[e]={v:+w.v.toFixed(1),raw:+raw.toFixed(1),f:w.f};
  }
  /* the weeks people look at come from the optimiser, so they match the
     Team Builder and Compare */
  if(kind==="freehit"||kind==="wildcard"){
    const top=Object.entries(out).sort((a,b)=>b[1].v-a[1].v).slice(0,3).map(([e])=>+e);
    [...new Set([...top,g])].forEach(e=>{if(!out[e])return;
      const ids=effectiveSquadIds(e).ids,raw=chipGainAt(kind,e,true,ids);if(raw==null)return;
      const w=chipWeighted(kind,e,raw,ids);out[e]={v:+w.v.toFixed(1),raw:+raw.toFixed(1),f:w.f,proven:true};});
  }
  return _chipCurves.c[key]=out;
}
const chipBestWeeks=key=>Object.entries(chipCurve(key)).filter(([e])=>!chipRuleBreak(key,+e)||S.chips[key]===+e)
  .map(([e,o])=>[+e,o.v]).sort((a,b)=>b[1]-a[1]);
/* chips still to play, in the order they come up */
function chipsLeft(){
  const g=S.model?S.model.next.id:1,out=[];
  [1,2].forEach(h=>{if(h===1&&g>19)return;["wildcard","freehit","bboost","3xc"].forEach(k=>{if(chipPlayed(k+h)==null)out.push(k+h);});});
  return out;
}
/* Second-half plans: one chip per week, a Bench Boost or Triple Captain
   inside a Wildcard's first five weeks scored on the Wildcard squad */
let _chipPlans=null;
function chipPlans(){
  if(!S.model)return[];
  const sig=chipSig();if(_chipPlans&&_chipPlans.sig===sig)return _chipPlans.p;
  const keys=chipsLeft().filter(k=>k.endsWith("2"));
  if(keys.length<2){_chipPlans={sig,p:[],search:null,keys};return[];}
  const cv={};keys.forEach(k=>cv[k]=chipCurve(k));
  const top={};keys.forEach(k=>top[k]=chipBestWeeks(k).slice(0,6));
  const wcKey=keys.find(k=>chipKind(k)==="wildcard");
  /* a Bench Boost or Triple Captain inside a Wildcard's first five weeks is
     scored on the Wildcard squad, so those weeks are searched as well as the
     chip's own six best (21 Nov 2026: Most Points had missed them and a
     named plan beat it) */
  if(wcKey)keys.filter(k=>["bboost","3xc"].includes(chipKind(k))).forEach(k=>{const all=chipBestWeeks(k),have=new Set(top[k].map(x=>x[0]));
    top[wcKey].forEach(([w])=>{for(let e=w+1;e<w+5;e++){const x=all.find(y=>y[0]===e);if(x&&!have.has(e)){have.add(e);top[k].push(x);}}});});
  const after={};
  const synergy=(pick,k,e,v)=>{
    if(!wcKey||!pick[wcKey]||!["bboost","3xc"].includes(chipKind(k)))return v;
    const w=pick[wcKey][0];if(!(e>w&&e<w+5))return v;
    const id=w+"|"+e+"|"+k;
    if(after[id]==null){const T=chipTeam("wildcard",w,false);
      after[id]=T?chipWeighted(chipKind(k),e,teamScore(T.ids,e,chipKind(k))-teamScore(T.ids,e,null),T.ids).v:v;}
    return Math.max(v,after[id]);
  };
  const score=pick=>{let tot=0;const out={};
    keys.forEach(k=>{if(!pick[k])return;const [e]=pick[k];const base=(cv[k][e]||{}).v||0;const v=synergy(pick,k,e,base);out[k]=[e,+v.toFixed(1)];tot+=v;});
    return{pick:out,tot};};
  const order=wcKey?[wcKey,...keys.filter(k=>k!==wcKey)]:keys;
  /* the best total with some chips held at a week (fixed: key → week) */
  const search=fixed=>{let best=null;
    const rec=(i,used,pick)=>{
      if(i===order.length){const s=score(pick);if(!best||s.tot>best.tot)best=s;return;}
      const k=order[i];(fixed[k]?[[fixed[k]]]:top[k]).forEach(([e])=>{if(used.has(e))return;
        if(chipKind(k)==="freehit"&&chipPlayed("freehit1")===19&&e===20)return;
        used.add(e);pick[k]=[e];rec(i+1,used,pick);used.delete(e);delete pick[k];});};
    rec(0,new Set(),{});return best;};
  let best=search({});
  const fill=fixed=>{const used=new Set(Object.values(fixed).map(x=>x[0])),pick={...fixed};
    keys.forEach(k=>{if(pick[k])return;const b=chipBestWeeks(k).find(([e])=>!used.has(e));if(b){pick[k]=[b[0]];used.add(b[0]);}});
    return score(pick);};
  const plans=[];
  if(best)plans.push(Object.assign(best,{name:"Most Points",tag:"Recommended",why:"The highest total with one chip per week."}));
  const marks=[];for(let e=Math.max(20,S.model.next.id);e<=38;e++){const m=chipWeekMark(e);if(m)marks.push(Object.assign({e},m));}
  const dbl=marks.find(m=>m.t==="double"&&m.p>=0.6),blank=marks.find(m=>m.t==="blank");
  const has=k=>keys.includes(k);
  if(dbl&&has("wildcard2")&&has("bboost2")&&dbl.e-1>=20){
    const fx={wildcard2:[dbl.e-1],bboost2:[dbl.e]};
    const bl2=marks.find(m=>m.t==="blank"&&m.e>dbl.e);if(bl2&&has("freehit2"))fx.freehit2=[bl2.e];
    plans.push(Object.assign(fill(fx),{name:"Set Up the Double",tag:"",why:`Wildcard in GW${dbl.e-1}, straight before the ${dbl.src==="FPL"?"":dbl.p>=0.6?"likely ":"possible "}double, so the Bench Boost has doublers on the bench.`}));
  }
  if(blank&&has("freehit2"))plans.push(Object.assign(fill({freehit2:[blank.e]}),{name:"Free Hit the First Blank",tag:"",why:`Covers the GW${blank.e} blank (${esc(blank.why)}); transfers or the Wildcard handle the rest.`}));
  /* Most Points is the best of everything found, named plans included;
     every plan is listed highest total first */
  const topP=plans.reduce((m,p)=>!m||p.tot>m.tot?p:m,null);
  if(topP&&plans[0]&&topP!==plans[0]&&plans[0].name==="Most Points"){plans[0].pick=topP.pick;plans[0].tot=topP.tot;}
  const seen=new Set();const uniq=plans.filter(p=>{const k=JSON.stringify(p.pick);if(seen.has(k))return false;seen.add(k);return true;});
  uniq.sort((a,b)=>b.tot-a.tot);
  _chipPlans={sig,p:uniq,search,keys};return uniq;
}
/* The selected plan (21 Nov 2026, Andy): the chips you have planned stay in
   their weeks and the rest go to their best weeks on the same rules as the
   plans. The roadmap, header, Chips Left and Remaining Plans all show it,
   and Best Plan compares it with the best available. */
let _chipSel=null;
function chipSelectedPlan(){
  chipPlans();const P=_chipPlans;if(!P||!P.search)return null;
  const fx={};P.keys.forEach(k=>{if(S.chips[k])fx[k]=S.chips[k];});
  const key=P.sig+"|"+JSON.stringify(fx);if(_chipSel&&_chipSel.key===key)return _chipSel.p;
  const p=P.search(fx);
  _chipSel={key,p:p?Object.assign(p,{name:"Selected Plan"}):null};return _chipSel.p;
}
/* Hindsight for this season: every finished week each chip could have been
   played in, scored on what happened. Triple Captain: your captain's points.
   Bench Boost: your bench's points. Free Hit and Wildcard: the team the app
   would have built before that deadline (its saved prediction), against the
   squad you had. Prices are today's, so those two are estimates. */
function chipHindsight(){
  const tr=((S.tracker&&S.tracker.gw)||[]).filter(r=>weekFinal(r.event)).slice().sort((a,b)=>a.event-b.event);
  if(!tr.length||!S.model)return null;
  const A=S.playerActuals||{};
  const act=(id,e)=>{const f=A[id]||A[String(id)];const v=f?(f[e]??f[String(e)]):null;return v==null?0:+v;};
  const picksOf=e=>{const r=tr.find(x=>x.event===e);return r&&r.picks?r.picks.map(p=>p.id):null;};
  const predOf=e=>{const sn=(S.predLive&&S.predLive.gw&&S.predLive.gw[e])||(S.predBack&&S.predBack.gw&&S.predBack.gw[e]);return sn&&sn.players||null;};
  const bestOn=(ids,val)=>{const sp=ids.map(chipPlayer).filter(Boolean);const xi=legalBestXI(sp,val);
    return xi.reduce((a,p)=>a+val(p),0)+(xi.length?Math.max(...xi.map(val)):0);};
  const preTeam=(e,bud)=>{const pr=predOf(e);if(!pr)return null;
    const pv=p=>+(pr[p.id]??pr[String(p.id)]??0);
    const t=buildSquad("freehit",e,null,bud,{val:pv,tag:"pre"+e});return t?t.xi.concat(t.bench).map(p=>p.id):null;};
  const last=tr[tr.length-1].event,out={tc:[],bb:[],fh:[],wc:[]};
  tr.forEach(r=>{const e=r.event,pk=r.picks||[],cap=pk.find(x=>x.isC);
    out.tc.push({e,v:cap?act(cap.id,e):0});
    out.bb.push({e,v:r.bench||0});
    if(e<2)return;
    const pre=picksOf(e-1)||pk.map(x=>x.id),bud=(+r.value||100)+(+r.bank||0);
    const T=preTeam(e,bud);
    /* Wildcard on the Wildcard week alone, the same basis as FPL's figure
       for it (21 Nov 2026), so the week you played reads like the rest */
    if(T){const v1=p=>act(p.id,e),d=+(bestOn(T,v1)-bestOn(pre,v1)).toFixed(1);out.fh.push({e,v:d});out.wc.push({e,v:d});}
  });
  return out;
}
/* the Team Rating: your team score against the best Free Hit team's, the
   same team the Chips page and Compare show */
function teamRating(){
  if(!S.model)return null;
  /* batch 5: a finished or live week in view rates the team for the next deadline */
  const g=Math.max(VG(),S.model.next.id),T=chipTeam("freehit",g,true);if(!T)return null;
  const mine=teamScore(effectiveSquadIds(g).ids,g,null),best=teamScore(T.ids,g,null);
  if(!(best>0))return null;
  return{pct:Math.round(clamp(mine/best,0,1)*100),mine,best,totw:T.t,budget:squadBudget()};
}
