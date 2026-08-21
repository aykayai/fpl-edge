/* FPL Edge — app-main.js
   actions and init — must load last

   Part of a single script split across files so each stays small enough to
   fetch whole. Loaded in order as classic scripts, sharing one global scope,
   so the order in index.html matters: app-main.js must come last. */
/* ---------- actions ---------- */
/* Typing must not trigger a full re-render — that destroys the input and steals
   focus after one character. Debounce, then restore the caret. */
let _srchT=null;
function searchInput(action,el){
  const v=el.value, pos=el.selectionStart, id=el.id;
  clearTimeout(_srchT);
  _srchT=setTimeout(()=>{
    act(action,v);
    const again=document.getElementById(id);
    if(again){again.focus();try{again.setSelectionRange(pos,pos);}catch(e){}}
  },220);
}
function act(k,a,b){
  const P=id=>S.model?.players.find(p=>p.id===id);
  switch(k){
    case"load":loadAll(true).then(()=>loadNews());return;
    case"tab":S.tab=a;S.menuOpen=false;break;
    case"menu":S.menuOpen=!S.menuOpen;break;
    case"dash":S.dash={...S.dash,[a]:!S.dash[a]};break;
    case"chipview":S.chipView=a;break;
    case"chiphalf":S.chipHalf=a;break;
    case"fhForm":S.fhForm=a||null;break;
    case"wcForm":S.wcForm=a||null;break;
    case"compare":S.compare=S.compare?null:{squad:[...(S.squad||[])],captain:S.captain,
      vice:S.vice,bank:S.bank,flagged:[],forceXI:null,subFrom:null};break;
    case"cclose":S.compare=null;break;
    case"ccap":{const C=S.compare;if(!C)break;C.captain=a;break;}
    case"sqview":S.sqView=a;break;
    case"sqsort":if((S.sqSort||"pos")===a)S.sqDir=(S.sqDir||"asc")==="asc"?"desc":"asc";
      else{S.sqSort=a;S.sqDir=a==="name"?"asc":"desc";}break;
    case"card":S.cardId=a||null;break;
    case"benchmove":{
      const xi=startingXI();
      const bench=orderBench(squadPlayers().filter(p=>!xi.includes(p)));
      const ids=bench.map(p=>p.id);
      const i0=ids.indexOf(a), j0=i0+(b==="up"?-1:1);
      if(i0<0||j0<0||j0>=ids.length)break;
      [ids[i0],ids[j0]]=[ids[j0],ids[i0]];
      S.benchOrder=ids;saveState();break;}
    case"csub":{const C=S.compare;if(!C)break;
      if(C.subFrom===a){C.subFrom=null;break;}
      if(C.subFrom==null){C.subFrom=a;toast("Now tap who to swap with");break;}
      const xi=compXI().map(p=>p.id);
      const aIn=xi.includes(C.subFrom), bIn=xi.includes(a);
      if(aIn===bIn){toast("Pick one from the pitch and one from the bench");C.subFrom=null;break;}
      const next=xi.map(i=>i===(aIn?C.subFrom:a)?(aIn?a:C.subFrom):i);
      const ps=next.map(i=>P(i)).filter(Boolean);
      const cnt=n=>ps.filter(x=>x.pos===n).length;
      if(ps.length!==11||cnt(1)!==1||cnt(2)<3||cnt(4)<1){toast("That would break the formation");C.subFrom=null;break;}
      C.forceXI=next;C.subFrom=null;toast("Substitution made");break;}
    case"cflag":{const C=S.compare;if(!C)break;
      C.flagged=C.flagged.includes(a)?C.flagged.filter(x=>x!==a):[...C.flagged,a];break;}
    case"capply":{const C=S.compare;if(!C)break;
      S.squad=[...C.squad];S.captain=C.captain;S.vice=C.vice;S.bank=C.bank;
      S.compare=null;S.flagged=[];S.forceXI=null;saveState();
      toast("Comparison applied — remember to Save");break;}
    case"horizon":S.horizon=clamp(+a||1,1,8);break;
    case"vgw":
    case"startgw":S.startGW=clamp(Math.round(+a)||S.model.next.id,S.model.next.id,38);break;
    case"pos":S.fPos=+a;break;
    case"team":S.fTeam=+a;break;
    case"lpos":S.lPos=+a;break;
    case"lteam":S.lTeam=+a;break;
    case"lsearch":S.lSearch=a;break;
    case"lmax":S.lMax=clamp(+a||16,3.5,16);break;
    case"lhorizon":S.lHorizon=clamp(Math.round(+a)||1,1,8);break;
    case"lwin":S.lWin=+a;break;
    case"iconf":S.iconF=S.iconF.includes(a)?S.iconF.filter(x=>x!==a):[...S.iconF,a];break;
    case"spf":S.spF=S.spF===a?null:a;break;
    case"staronly":S.starOnly=!S.starOnly;break;
    case"addplan":{const p=P(a);if(!p)break;
      if((S.squad||[]).includes(p.id)){toast(p.web_name+" is already in your squad");break;}
      const target=(S.flagged||[]).map(x=>P(x)).find(o=>o&&o.pos===p.pos);
      if(target){
        if(p.price>S.bank+sellPrice(target)+.001)
          toast("Over budget by £"+(p.price-S.bank-sellPrice(target)).toFixed(1));
        applySwap(target.id,p.id);toast(target.web_name+" → "+p.web_name);break;}
      const cur=(S.squad||[]).filter(i=>!S.flagged.includes(i));
      if(cur.filter(i=>P(i)?.pos===p.pos).length>=SHAPE[p.pos]){
        toast("Mark a "+POS[p.pos]+" for transfer first");break;}
      if(cur.filter(i=>P(i)?.team===p.team).length>=3){toast("Max 3 per club");break;}
      S.squad=[...(S.squad||[]),p.id];S.bank=+(S.bank-p.price).toFixed(1);saveState();
      toast(p.web_name+" added to your squad");break;}
    case"star":S.stars=S.stars.includes(a)?S.stars.filter(x=>x!==a):[...S.stars,a];
      LS.set("stars",S.stars);break;
    case"fmin":S.fMin=Math.min(Math.max(3.5,+a||3.5),S.fMax);break;
    case"fmax":S.fMax=Math.max(Math.min(16,+a||16),S.fMin);break;
    case"search":S.fSearch=a;break;
    case"sort":if(S.sortKey===a)S.sortDir=S.sortDir==="desc"?"asc":"desc";else{S.sortKey=a;S.sortDir="desc";}break;
    case"lsort":if(S.lSort===a)S.lDir=S.lDir==="desc"?"asc":"desc";else{S.lSort=a;S.lDir="desc";}break;
    case"cap":S.captain=a;if(S.vice===a)S.vice=null;saveState();break;
    case"vice":S.vice=a;if(S.captain===a)S.captain=null;saveState();break;
    case"flag":{
      /* Un-flagging a player brought in as a replacement puts the original
         back, rather than leaving the squad a man short with a stale flag. */
      const rep=(S.replacedBy||{})[a];
      if(rep&&(S.squad||[]).includes(a)){
        S.squad=S.squad.map(x=>x===a?rep:x);
        S.flagged=(S.flagged||[]).filter(x=>x!==rep&&x!==a);
        delete S.replacedBy[a];
        if(S.captain===a)S.captain=rep;
        if(S.vice===a)S.vice=rep;
        S.forceXI=null;saveState();toast("Reverted to "+(P(rep)?.web_name||"the original"));break;
      }const was=S.flagged.includes(a);
      S.flagged=was?S.flagged.filter(x=>x!==a):[...S.flagged,a];
      /* filter to the position, but leave the price filter alone — the pool
         dims what you can't afford rather than hiding it */
      if(!was){const o=P(a);if(o)S.fPos=o.pos;}
      else if(!S.flagged.length){S.fPos=0;}
      break;}
    case"pick":S.selected=P(a);break;
    case"cancel":S.selected=null;break;
    case"sub":if(S.subFrom===a){S.subFrom=null;break;}
      if(S.subFrom==null){S.subFrom=a;toast("Now tap who to swap with");break;}
      trySub(S.subFrom,a);break;
    case"listpick":{const p=P(a);
      /* when the comparison is open and has a player marked, the pick goes there */
      if(S.compare&&(S.compare.flagged||[]).length){
        const C=S.compare;
        const t=C.flagged.map(x=>P(x)).find(o=>o&&o.pos===p.pos);
        if(t){
          if(C.squad.includes(p.id)){toast("Already in the comparison squad");break;}
          C.squad=C.squad.map(i=>i===t.id?p.id:i);
          C.bank=+(C.bank+sellPrice(t)-p.price).toFixed(1);
          C.flagged=C.flagged.filter(x=>x!==t.id);
          if(C.captain===t.id)C.captain=p.id;
          toast("Comparison: "+t.web_name+" → "+p.web_name);break;}
      }
      /* A flagged (✕) player is the one being sold, so a list tap is a swap,
         not an addition — that is what was tripping the position and budget checks */
      /* with several players flagged, sell the one that matches the position
         of whoever was just tapped — that is what "like for like" means here */
      const target=S.selected?S.selected.id
        :(S.flagged.find(id=>P(id)?.pos===p.pos) ?? null);
      if(target){const o=P(target);
        if(o.pos!==p.pos){toast("Swap must be like for like — "+POS[o.pos]+" for "+POS[o.pos]);break;}
        if(p.price>S.bank+sellPrice(o)+.001)
        toast("Over budget by £"+(p.price-S.bank-sellPrice(o)).toFixed(1)+" — you can plan it, but not save it");
        const clubs=(S.squad||[]).filter(i=>i!==target).filter(i=>P(i)?.team===p.team).length;
        if(clubs>=3){toast("Max 3 per club");break;}
        applySwap(target,p.id);S.selected=null;toast(o.web_name+" → "+p.web_name);break;}
      /* players marked for transfer are treated as already gone, so they don't
         block a replacement at the same club or in the same position */
      const cur=(S.squad||[]).filter(i=>!S.flagged.includes(i));
      if(cur.includes(p.id)){toast("Already in your squad");break;}
      if(cur.filter(i=>P(i)?.pos===p.pos).length>=SHAPE[p.pos]){toast("Already have "+SHAPE[p.pos]+" "+POS[p.pos]);break;}
      if(cur.filter(i=>P(i)?.team===p.team).length>=3){toast("Max 3 per club");break;}
      S.squad=[...cur,p.id];S.bank=+(S.bank-p.price).toFixed(1);saveState();break;}
    case"doswap":applySwap(a,b);S.pendingOpt=null;toast("Transfer made");break;
    case"opt":{S.forceXI=null;
      const g2=S.model.next.id;const xi=startingXI();
      const rank=xi.slice().sort((x,y)=>(y.gw[g2]?.pts||0)-(x.gw[g2]?.pts||0));
      if(rank[0]){S.captain=rank[0].id;if(rank[1])S.vice=rank[1].id;}
      /* bench in descending order too, so the first substitute is the best one */
      S.benchOrder=squadPlayers().filter(p=>!xi.includes(p))
        .sort((x,y)=>(y.gw[g2]?.pts||0)-(x.gw[g2]?.pts||0)).map(p=>p.id);
      S.pendingOpt=null;saveState();
      toast("Line-up, captain and vice optimised — "+weekPts().toFixed(1)+" pts");break;}
    case"cancelopt":S.pendingOpt=null;break;
    case"achip":{
      /* assign or clear the chip for the gameweek being viewed */
      const w=VG(), half=w>=20?"2":"1", next={...S.chips};
      ["bboost","3xc","freehit","wildcard"].forEach(k=>{if(next[k+half]===w)delete next[k+half];});
      if(a!=="none")next[a+half]=w;
      S.chips=next;S.activeChip=a==="none"?null:a;saveState();break;}
    case"save":{if(S.bank<-0.001){toast("You're £"+Math.abs(S.bank).toFixed(1)+" over budget — sell someone first");break;}
      S.original=S.squad;saveState();toast("Squad saved");break;}
    case"reset":{resolveSeed(true);S.flagged=[];S.pendingOpt=null;
      toast("Reset to your official squad");break;}
    case"resetOld":{if(!S.original)break;
      const cur=(S.squad||[]).reduce((s,i)=>s+(P(i)?.price||0),0);
      const org=S.original.reduce((s,i)=>s+(P(i)?.price||0),0);
      S.bank=+(S.bank+cur-org).toFixed(1);S.squad=S.original;S.flagged=[];S.forceXI=null;
      S.pendingOpt=null;saveState();toast("Reverted to saved squad");break;}
    case"seed":resolveSeed();break;
    case"setchip":S.chips={...S.chips,[a]:b};saveState();toast("Chip set for GW"+b);break;
    case"clearchip":{const c={...S.chips};delete c[a];S.chips=c;saveState();break;}
    case"expand":S.expand={...S.expand,[a]:!S.expand[a]};break;
    case"fixgw":S.fixGW=clamp(+a,S.model.next.id,38);break;
    case"fixsort":if((S.fixSort||"d5")===a)S.fixDir=(S.fixDir||"asc")==="asc"?"desc":"asc";
      else{S.fixSort=a;S.fixDir="asc";}break;
    case"fixmode":S.fixMode=a;break;
    case"lens":S.fdrLens=a==="all"?null:a;break;
    case"toggleout":S.outList=S.outList.includes(a)?S.outList.filter(x=>x!==a):[...S.outList,a];break;
    case"clearout":S.outList=[];break;
    case"ignore":S.ignored=[...(S.ignored||[]),a];LS.set("ignored",S.ignored);
      toast("Won't suggest "+(P(a)?.web_name||"that player")+" again");break;
    case"unignore":S.ignored=[];LS.set("ignored",[]);toast("Ignore list cleared");break;
    case"docombo":{const c=bestCombo(S.outList);if(!c){break;}
      c.picks.forEach(m=>applySwap(m.out.id,m.inn.id));S.outList=[];
      toast("Transfers made · +"+c.gain.toFixed(1)+" pts");break;}
    case"news":loadNews();return;
    case"nwin":S.newsWindow=a;break;
    case"srcf":S.srcFilter=a||null;break;
    case"plf":S.playerFilter=a||null;break;
    case"odds":loadOdds();return;
    case"oddsdemo":S.oddsDemo=!S.oddsDemo;break;
    case"oddsview":S.oddsView=a;break;
    case"oddsreset":LS.set("oddsLeague","");LS.set("oddsBooks",null);LS.set("oddsCache",null);loadOdds();return;
    case"oddskey":S.oddsKey=a.trim();LS.set("oddsKey",S.oddsKey);if(S.oddsKey)loadOdds();return;
    case"addrival":{const n=document.getElementById("rvName")?.value?.trim();
      const id=document.getElementById("rvId")?.value?.trim();
      if(!n){toast("Give the rival a name");break;}
      S.rivals=[...(S.rivals||[]),{name:n,id,squad:[]}];S.rivalSel=S.rivals.length-1;
      LS.set("rivals",S.rivals);break;}
    case"selrival":S.rivalSel=a;break;
    case"rivalsquad":{const raw=document.getElementById("rvSquad")?.value||"";
      const names=raw.split(",").map(x=>x.trim()).filter(Boolean);
      const ids=[];const used=new Set();
      names.forEach(nm=>{const t=norm(nm);
        const c=S.model.players.filter(p=>!used.has(p.id)&&(norm(p.web_name)===t||norm(p.web_name).includes(t)||norm(p.first+" "+p.last).includes(t)));
        if(c[0]){used.add(c[0].id);ids.push(c[0].id);}});
      if(!ids.length){toast("Couldn't match any of those names");break;}
      S.rivals[S.rivalSel].squad=ids;LS.set("rivals",S.rivals);
      toast(`Matched ${ids.length} of ${names.length}`);break;}
  }
  render();
}
/* ---------- init ---------- */
window.addEventListener("hashchange",()=>{if(applyHash())render();});
window.addEventListener("popstate",()=>{if(applyHash())render();});
(function(){
  const st=LS.get("state");
  if(st&&st.v===STATE_VERSION){Object.assign(S,{squad:st.squad,original:st.original,captain:st.captain,
    vice:st.vice,chips:st.chips||{},bank:st.bank??0,ft:st.ft??1,forceXI:st.forceXI||null,
    activeChip:st.activeChip||null});S.seeded=!!(st.squad&&st.squad.length);}
  applyLearning();
  /* Not defaulted to a key: this file is public on GitHub Pages, and a free-tier
     key committed to a public repo gets scraped and its quota drained. Entered
     once in the Odds tab and kept in this browser only. */
  S.oddsKey=LS.get("oddsKey")||"";
  S.ignored=LS.get("ignored")||[];
  if(S.oddsKey)S.oddsState="idle";
  S.stars=LS.get("stars")||[];
  S.rivals=LS.get("rivals")||[];
  S.leagueId=LS.get("leagueId")||"391690";
  const c=LS.get("data");
  if(c&&c.players){Object.assign(S,{players:c.players,teams:c.teams,fixtures:c.fixtures,
    events:c.events,last:c.last,pre:c.pre||{},preMax:c.preMax||1,lastTeams:c.lastTeams||{},lastTeamStats:c.lastTeamStats||{},lastTeamRecent:c.lastTeamRecent||{},hist:c.hist||{},teamMatch:c.teamMatch||{},stamp:c.t});buildModel();}
  applyHash();
  if(!location.hash)history.replaceState({},"",routeFor(S.tab));
  else render();
})();
