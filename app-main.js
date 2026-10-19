/* FPL Signals - app-main.js
   actions and init — must load last

   Part of a single script split across files so each stays small enough to
   fetch whole. Loaded in order as classic scripts, sharing one global scope,
   so the order in index.html matters: app-main.js must come last. */
/* ---------- actions ---------- */
/* Typing must not trigger a full re-render — that destroys the input and steals
   focus after one character. Debounce, then restore the caret. */
let _srchT=null;
function searchInput(action,el,extra){
  const v=el.value, pos=el.selectionStart, id=el.id;
  clearTimeout(_srchT);
  _srchT=setTimeout(()=>{
    if(extra!=null)act(action,extra,v);else act(action,v);
    const again=document.getElementById(id);
    if(again){again.focus();try{again.setSelectionRange(pos,pos);}catch(e){}}
  },220);
}
function act(k,a,b){
  const P=id=>S.model?.players.find(p=>p.id===id);
  switch(k){
    case"load":loadAll().then(()=>loadNews());return;
    case"tab":S.tab=a;S.menuOpen=false;break;
    case"menu":S.menuOpen=!S.menuOpen;break;
    case"dash":S.dash={...S.dash,[a]:!S.dash[a]};break;
    case"chipview":S.chipView=a;break;
    case"chiphalf":S.chipHalf=a;break;
    case"fhForm":S.fhForm=a||null;break;
    case"wcForm":S.wcForm=a||null;break;
    /* wave 2: This Week strip and the Compare pop-up */
    case"weekh":S.weekH=[1,3,5].includes(+a)?+a:1;LS.set("weekh",S.weekH);break;
    case"pop":S.pop=a||null;break;
    case"popclose":S.pop=null;break;
    /* wave 3: Players hub */
    /* wave 5: Teams > Clubs */
    case"tview":S.tView=["att","def","opp"].includes(a)?a:"att";S.tSort=null;break;
    case"tsort":if(S.tSort===a)S.tDir=S.tDir==="asc"?"desc":"asc";else{S.tSort=a;S.tDir="desc";}break;
    case"th":S.tH=[1,3,5].includes(+a)?+a:3;break;
    /* wave 7: Status options */
    case"cleardrafts":LS.set("drafts",[]);toast("Drafts deleted");break;
    case"clearstars":S.stars=[];LS.set("stars",[]);break;
    /* research list: funding pairs */
    case"fundon":S.fundOn=true;break;
    case"dofund":{const c=bestCombo([a,b],Math.max(3,S.weekH||1),6);if(!c||c.picks.length<2)break;
      let ok=true;c.picks.forEach(m=>{if(ok&&!applySwap(m.out.id,m.inn.id))ok=false;});
      if(ok)toast("Both transfers made");break;}
    case"pview":S.pView=a;S.pdLimit=PD_PAGE;LS.set("hub",{v:S.pView,h:S.pH,ar:S.pAround});break;
    case"ph":S.pH=[1,3,5].includes(+a)?+a:1;LS.set("hub",{v:S.pView,h:S.pH,ar:S.pAround});break;
    case"paround":S.pAround=a==="rank"?"rank":"league";LS.set("hub",{v:S.pView,h:S.pH,ar:S.pAround});break;
    case"hubsort":if((S.hubSort||"pts")===a)S.hubDir=(S.hubDir||"desc")==="desc"?"asc":"desc";else{S.hubSort=a;S.hubDir=a==="name"?"asc":"desc";}break;
    case"tick":{const t=S.pTicks||[];S.pTicks=t.includes(a)?t.filter(x=>x!==a):(t.length>=5?t:[...t,a]);
      if(t.length>=5&&!t.includes(a))toast("Up to five players at a time");if(!S.pTicks.length)S.pCmp=false;break;}
    case"tickclear":S.pTicks=[];S.pCmp=false;break;
    case"pcmp":S.pCmp=!!(S.pTicks||[]).length;break;
    case"pcmpclose":S.pCmp=false;break;
    case"compare":S.cmp=S.cmp?null:{mode:"edits",h:1,locks:[],bans:[],pendLocks:[],pendBans:[]};break;
    case"cmpclose":S.cmp=null;break;
    case"cmpmode":{const C=S.cmp;if(!C)break;Object.assign(C,{mode:a,locks:[],bans:[],pendLocks:[],pendBans:[]});
      if(a==="wc"&&C.h===1)C.h=5;break;}
    case"cmph":if(S.cmp)S.cmp.h=[1,3,5].includes(+a)?+a:1;break;
    case"cmplock":{const C=S.cmp;if(!C)break;C.pendLocks=C.pendLocks.includes(a)?C.pendLocks.filter(x=>x!==a):[...C.pendLocks,a];break;}
    case"cmpban":{const C=S.cmp;if(!C)break;C.pendBans=C.pendBans.includes(a)?C.pendBans.filter(x=>x!==a):[...C.pendBans,a];break;}
    case"cmprerun":{const C=S.cmp;if(!C)break;C.locks=C.pendLocks.slice();C.bans=C.pendBans.filter(x=>!C.locks.includes(x));break;}
    case"cmpclear":{const C=S.cmp;if(!C)break;Object.assign(C,{locks:[],bans:[],pendLocks:[],pendBans:[]});break;}
    case"cmpdraft":{const C=S.cmp;if(!C||!(+a>=0))break;C.mode="draft";C.draft=+a;break;}
    case"cmpsave":{const C=S.cmp;if(!C)break;const T=cmpTeams();if(!T.prop)break;
      const name={edits:"Your edits",wc:"Wildcard",fh:"Free Hit",draft:"Draft"}[C.mode];
      const ds=[{label:name+" GW"+T.g+" · "+ukFmt(Date.now(),{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}),
        ids:T.prop.slice(),cap:T.meta.cap,bank:T.meta.bank,gw:T.g,mode:C.mode},...(LS.get("drafts")||[])].slice(0,10);
      LS.set("drafts",ds);toast("Saved as a draft");break;}
    case"cmpapply":{const C=S.cmp;if(!C)break;const T=cmpTeams();if(!T.prop)break;
      const gw=editableGw();if(gw==null)break;
      if(C.mode==="wc"||C.mode==="fh"){const kind=C.mode==="wc"?"wildcard":"freehit";
        if(chipForWeek(gw)!==kind){const half=gw>=20?"2":"1",next={...S.chips};
          ["bboost","3xc","freehit","wildcard"].forEach(k=>{if(next[k+half]===gw)delete next[k+half];});
          const keep=S.chips;S.chips=next;const why=chipRuleBreak(kind+half,gw);S.chips=keep;
          if(why){toast(why,{warn:true});break;}
          next[kind+half]=gw;S.chips=next;}}
      const cur=effectiveSquadIds(gw).ids,byId=id=>S.model.players.find(p=>p.id===id);
      const bank=+(planBank()+cur.filter(i=>!T.prop.includes(i)).reduce((s,i)=>s+sellPrice(byId(i)),0)
        -T.prop.filter(i=>!cur.includes(i)).reduce((s,i)=>s+byId(i).price,0)).toFixed(1);
      if(bank<-0.001){toast("Over budget by £"+(-bank).toFixed(1),{warn:true});break;}
      const v=p=>p.gw[gw]?.pts||0,xi=legalBestXI(T.prop.map(byId),v).sort((x,y)=>v(y)-v(x));
      writePlan(gw,T.prop,{bank,captain:xi[0]?xi[0].id:T.meta.cap,vice:xi[1]?xi[1].id:null});
      S.flagged=[];S.forceXI=null;S.benchOrder=null;saveState();S.cmp=null;
      toast((C.mode==="wc"?"Wildcard":C.mode==="fh"?"Free Hit":"Draft")+" team applied to GW"+gw+". Save when you are happy.");break;}
    case"sqview":S.sqView=a;break;
    case"sqsort":if((S.sqSort||"pos")===a)S.sqDir=(S.sqDir||"asc")==="asc"?"desc":"asc";
      else{S.sqSort=a;S.sqDir=a==="name"?"asc":"desc";}break;
    case"card":S.cardId=a||null;break;
    case"pdmore":S.pdLimit=(S.pdLimit||PD_PAGE)+PD_PAGE;break;
    case"pdall":S.pdLimit=1000;break;
    case"fixread":S.fixRead=a;break;
    case"poolmore":S.poolLimit=Math.min(150,(S.poolLimit||50)+50);break;
    case"pdless":S.pdLimit=PD_PAGE;break;
    case"sigpos":S.sigPos=+a||0;LS.set("sig",{pos:S.sigPos,h:S.sigH||3,fold:S.sigFold||[]});break;
    case"sigh":S.sigH=+a||3;LS.set("sig",{pos:S.sigPos||0,h:S.sigH,fold:S.sigFold||[]});break;
    case"sigfold":{const f=new Set(S.sigFold||[]);f.has(a)?f.delete(a):f.add(a);S.sigFold=[...f];
      LS.set("sig",{pos:S.sigPos||0,h:S.sigH||3,fold:S.sigFold});break;}
    case"xfplgw":{const cur=clamp(S.xfplGW||(S.model.gwPlayed>=1?S.model.gwPlayed:S.model.next.id),1,38);
      S.xfplGW=clamp(cur+(a==="next"?1:-1),1,38);break;}
    case"trkstat":S.trkStat=a;break;
    case"trkgw":
      if(a==="next")S.trkGwStart=Math.min((S.trkGwStart||0)+10,30),S.trkGwAll=false;
      else if(a==="prev")S.trkGwStart=Math.max((S.trkGwStart||0)-10,0),S.trkGwAll=false;
      else if(a==="all")S.trkGwAll=!S.trkGwAll;
      break;
    case"benchcycle":{
      /* Tapping ⇄ on an outfield sub cycles its order (2nd→3rd→…→2nd). The keeper
         stays at bench position 1 and is never part of the cycle. */
      const xi=startingXI();
      const notXI=squadPlayers().filter(p=>!xi.includes(p));
      const out=orderBench(notXI.filter(p=>p.pos!==1)).map(p=>p.id);
      const i=out.indexOf(a);if(i<0||out.length<2)break;
      const L=out.length;out.splice(i,1);out.splice((i+1)%L,0,a);
      const gk=notXI.filter(p=>p.pos===1).map(p=>p.id);
      S.benchOrder=[...gk,...out];saveState();toast("Bench order updated");break;}
    case"benchmove":{
      const xi=startingXI();
      const bench=orderBench(squadPlayers().filter(p=>!xi.includes(p)));
      const ids=bench.map(p=>p.id);
      const i0=ids.indexOf(a), j0=i0+(b==="up"?-1:1);
      if(i0<0||j0<0||j0>=ids.length)break;
      [ids[i0],ids[j0]]=[ids[j0],ids[i0]];
      S.benchOrder=ids;saveState();break;}
    case"horizon":S.horizon=clamp(+a||1,1,8);break;
    case"vgw":
    case"startgw":S.startGW=clamp(Math.round(+a)||S.model.next.id,1,38);break;
    case"pos":S.fPos=+a;break;
    case"team":S.fTeam=+a;break;
    case"lpos":S.lPos=+a;break;
    case"lteam":S.lTeam=+a;break;
    case"lsearch":S.lSearch=a;break;
    case"lmax":S.lMax=clamp(+a||16,3.5,16);break;
    case"lhorizon":S.lHorizon=clamp(Math.round(+a)||1,1,8);break;
    case"lgwfrom":{const v=clamp(Math.round(+a)||1,1,38);S.lGwFrom=v;
      if(S.lGwTo&&S.lGwTo<v)S.lGwTo=v;break;}
    case"lgwto":{const from=S.lGwFrom||(S.model?S.model.next.id:1);
      S.lGwTo=clamp(Math.round(+a)||from,from,38);break;}
    case"lwin":S.lWin=+a;break;
    case"iconf":S.iconF=S.iconF.includes(a)?S.iconF.filter(x=>x!==a):[...S.iconF,a];break;
    case"staronly":S.starOnly=!S.starOnly;break;
    case"addplan":{const p=P(a);if(!p)break;
      if((S.squad||[]).includes(p.id)){toast(p.web_name+" is already in your squad");break;}
      const target=(S.flagged||[]).map(x=>P(x)).find(o=>o&&o.pos===p.pos);
      if(target){
        if(p.price>planBank()+sellPrice(target)+.001)
          toast("Over budget by £"+(p.price-planBank()-sellPrice(target)).toFixed(1));
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
    /* Stats always sort high→low on a header tap; only the name column toggles.
       Previously a same-column tap flipped to ascending, which read as "the sort
       broke" once other filters were applied. */
    case"sort":{if(a==="name")S.sortDir=(S.sortKey==="name"&&S.sortDir==="asc")?"desc":"asc";
      else S.sortDir="desc";S.sortKey=a;break;}
    case"lsort":{if(a==="name")S.lDir=(S.lSort==="name"&&S.lDir==="asc")?"desc":"asc";
      else S.lDir="desc";S.lSort=a;break;}
    case"cap":{const gw=editableGw();if(gw==null)break;S.captain=a;if(S.vice===a)S.vice=null;
      writePlan(gw,null,{captain:a,vice:S.vice});saveState();break;}
    case"vice":{const gw=editableGw();if(gw==null)break;S.vice=a;if(S.captain===a)S.captain=null;
      writePlan(gw,null,{vice:a,captain:S.captain});saveState();break;}
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
    case"sub":
      if(S.subFrom===a){S.subFrom=null;break;}
      if(S.subFrom==null){S.subFrom=a;toast("Now tap who to swap with");break;}
      trySub(S.subFrom,a);break;
    case"listpick":{const p=P(a);
      /* A flagged (✕) player is the one being sold, so a list tap is a swap,
         not an addition — that is what was tripping the position and budget checks */
      /* with several players flagged, sell the one that matches the position
         of whoever was just tapped — that is what "like for like" means here */
      const target=S.selected?S.selected.id
        :(S.flagged.find(id=>P(id)?.pos===p.pos) ?? null);
      if(target){const o=P(target);
        if(o.pos!==p.pos){toast("Swap must be like for like — "+POS[o.pos]+" for "+POS[o.pos]);break;}
        const clubs=(squadPlayers().map(x=>x.id)).filter(i=>i!==target).filter(i=>P(i)?.team===p.team).length;
        if(clubs>=3){toast("Max 3 per club",{warn:true});break;}
        if(applySwap(target,p.id)){S.selected=null;toast(o.web_name+" → "+p.web_name);}break;}
      /* players marked for transfer are treated as already gone, so they don't
         block a replacement at the same club or in the same position */
      const cur=(squadPlayers().map(p=>p.id)||[]).filter(i=>!S.flagged.includes(i));
      if(cur.includes(p.id)){toast("Already in your squad");break;}
      if(cur.filter(i=>P(i)?.pos===p.pos).length>=SHAPE[p.pos]){toast("Already have "+SHAPE[p.pos]+" "+POS[p.pos]);break;}
      if(cur.filter(i=>P(i)?.team===p.team).length>=3){toast("Max 3 per club");break;}
      {const gw=editableGw();if(gw==null)break;
       const nb=+(planBank()-p.price).toFixed(1);
       if(nb<-0.001){toast(`Not enough in the bank: £${(-nb).toFixed(1)} short for ${p.web_name}`,{warn:true});break;}
       writePlan(gw,[...cur,p.id],{bank:nb});saveState();}break;}
    case"doswap":if(applySwap(a,b)){S.pendingOpt=null;toast("Transfer made");}break;
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
      /* Assign or clear the chip for the gameweek being viewed. Only the schedule
         (S.chips) is written — "which chip is live" is derived from the schedule
         plus the viewed gameweek via chipForWeek(), so the Planner and the Chips
         page can never disagree, and browsing to another week can't leave a stale
         chip applied. */
      const w=VG(), half=w>=20?"2":"1", next={...S.chips};
      ["bboost","3xc","freehit","wildcard"].forEach(k=>{if(next[k+half]===w)delete next[k+half];});
      if(a!=="none"){
        const keep=S.chips;S.chips=Object.fromEntries(Object.entries(next));   /* the rule sees the week cleared */
        const why=chipRuleBreak(a+half,w);S.chips=keep;
        if(why){toast(why,{warn:true});break;}
        next[a+half]=w;}
      S.chips=next;saveState();break;}
    case"save":{if(S.bank<-0.001){toast("You're £"+Math.abs(S.bank).toFixed(1)+" over budget — sell someone first");break;}
      S.original=S.squad;saveState();toast("Squad saved");break;}
    case"reset":{
      /* Scope the reset: wipe planned changes for the live week and everything
         ahead of it, but leave finished gameweeks alone. A past week is a
         record of what actually happened and must not be rewritten by a reset. */
      const next=S.model?S.model.next.id:1;
      if(S.planByGw)Object.keys(S.planByGw).map(Number).forEach(e=>{
        if(e>=next)delete S.planByGw[e];});
      const src=resolveSeed(true);S.flagged=[];S.pendingOpt=null;
      const bf=(typeof bankFromFeed==="function")?bankFromFeed():null;
      if(bf!=null)S.bank=bf;                     // prefer the official bank when published
      saveState();
      /* Say what actually happened: the seed is a fallback, never "official". */
      toast(src==="official"?"Reset to your official squad (this week onward)"
        :"Reset to the GW1 seed squad (no official history available yet)");break;}
    case"resetOld":{if(!S.original)break;
      const cur=(S.squad||[]).reduce((s,i)=>s+(P(i)?.price||0),0);
      const org=S.original.reduce((s,i)=>s+(P(i)?.price||0),0);
      S.bank=+(S.bank+cur-org).toFixed(1);S.squad=S.original;S.flagged=[];S.forceXI=null;
      S.pendingOpt=null;saveState();toast("Reverted to saved squad");break;}
    case"seed":resolveSeed();break;
    case"setchip":{const why=chipRuleBreak(a,b);if(why){toast(why,{warn:true});break;}
      S.chips={...S.chips,[a]:b};saveState();toast("Chip set for GW"+b);break;}
    case"clearchip":{const c={...S.chips};delete c[a];S.chips=c;saveState();break;}
    case"expand":S.expand={...S.expand,[a]:!S.expand[a]};break;
    case"fixgw":S.fixGW=clamp(+a,1,38);break;
    case"fixsort":if((S.fixSort||"d5")===a)S.fixDir=(S.fixDir||"asc")==="asc"?"desc":"asc";
      else{S.fixSort=a;S.fixDir="asc";}break;
    case"fixmode":S.fixMode=a;break;
    case"lens":S.fdrLens=a==="all"?null:a;break;
    case"toggleout":S.outList=S.outList.includes(a)?S.outList.filter(x=>x!==a):[...S.outList,a];break;
    case"clearout":S.outList=[];break;
    case"ignore":S.ignored=[...(S.ignored||[]),a];LS.set("ignored",S.ignored);
      toast("Won't suggest "+(P(a)?.web_name||"that player")+" again");break;
    case"unignore":{
      /* F95: one player back, or everyone when no player is given */
      const id=a==null?null:+a;
      S.ignored=id?(S.ignored||[]).filter(x=>x!==id):[];LS.set("ignored",S.ignored);
      toast(id?"Will suggest "+(P(id)?.web_name||"that player")+" again":"Suggesting everyone again");break;}
    case"docombo":{const c=bestCombo(S.outList);if(!c){break;}
      c.picks.forEach(m=>applySwap(m.out.id,m.inn.id));S.outList=[];
      toast("Transfers made · +"+c.gain.toFixed(1)+" pts");break;}
    case"news":loadNews();return;
    case"nwin":S.newsWindow=a;break;
    case"srcf":S.srcFilter=a||null;break;
    case"plf":S.playerFilter=a||null;break;
    case"odds":loadOdds();return;
    case"oddsdemo":S.oddsDemo=!S.oddsDemo;break;
    case"oddspv":S.oddsPv=a;break;
    case"addrival":{const n=document.getElementById("rvName")?.value?.trim();
      const id=document.getElementById("rvId")?.value?.trim();
      if(!n){toast("Give the rival a name");break;}
      S.rivals=[...(S.rivals||[]),{name:n,id,squad:[]}];S.rivalSel=S.rivals.length-1;
      LS.set("rivals",S.rivals);break;}
    case"rivalpick":S.rivalPick=a;break;
    case"rivalgw":S.rivalGwView=a;break;
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
/* F10: Enter and Space press anything given a button role by a11yPass();
   F108: Escape closes the player card. */
document.addEventListener("keydown",e=>{
  const el=e.target;
  if((e.key==="Enter"||e.key===" ")&&el&&el.getAttribute&&el.getAttribute("role")==="button"
     &&!/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)){e.preventDefault();el.click();return;}
  if(e.key==="Escape"&&S.cardId){S.cardId=null;render();return;}
  if(e.key==="Escape"&&(S.pop||S.cmp||S.pCmp)){S.pop=null;S.cmp=null;S.pCmp=false;render();}
});
window.addEventListener("popstate",()=>{if(applyHash())render();});
/* wave 1: Predicted, Bank and FT join the sticky bar once the hero is gone */
window.addEventListener("scroll",()=>{const on=window.scrollY>170;
  if(document.body.classList.contains("scrolled")!==on)document.body.classList.toggle("scrolled",on);},{passive:true});
(function(){
  const st=LS.get("state");
  if(st&&(st.v===STATE_VERSION||st.v===3)){Object.assign(S,{squad:st.squad,original:st.original,captain:st.captain,
    vice:st.vice,chips:st.chips||{},bank:st.bank??0,ft:st.ft??1,forceXI:st.forceXI||null,
    planByGw:st.planByGw||{},ftLastGw:st.ftLastGw||0,baseGw:st.baseGw??null
    });S.seeded=!!(st.squad&&st.squad.length);}
  applyLearning();
  S.ignored=LS.get("ignored")||[];
  S.stars=LS.get("stars")||[];
  S.rivals=LS.get("rivals")||[];
  S.leagueId=LS.get("leagueId")||"391690";
  S.weekH=LS.get("weekh")||1;
  {const hb=LS.get("hub")||{};S.pView=hb.v||"all";S.pH=hb.h||1;S.pAround=hb.ar||"league";S.pTicks=[];}
  {const sg=LS.get("sig")||{};S.sigPos=sg.pos||0;S.sigH=sg.h||3;S.sigFold=sg.fold||[];}
  /* Retired keys from the GitHub Pages era: the 7.8 MB dataset copy (over
     quota on some browsers; the server is close now) and everything odds,
     which lives on the server. Every key that is Andy's own work (state,
     learn, stars, rivals, leagueId, ignored) keeps its name and survives. */
  ["data","oddsKey","oddsLeague","oddsBooks","oddsCache"].forEach(k=>{
    try{localStorage.removeItem("fpl3:"+k);}catch(e){}});
  applyHash();
  if(!location.hash)history.replaceState({},"",routeFor(S.tab));
  /* Instant start: paint the last page straight away, build the model from
     the saved data with no network wait, then run the normal load, which
     checks the server and refreshes only what changed. With nothing saved
     (first visit on a device, or no IndexedDB) this is the plain load. */
  /* Bundle 9: every club's shirts go into the sprite before a saved page is
     repainted, so its <use> references have something to point at */
  Object.keys(KITS).forEach(k=>{shirtSVG(k,false,20);shirtSVG(k,true,20);});
  (async()=>{
    const [snap,paint]=await Promise.all([IDB.get("snap"),IDB.get("paint")]);
    const app=document.getElementById("app");
    if(snap&&snap.files&&snap.v===SNAP_V){
      _snap=snap;
      if(paint&&paint.html&&paint.tab===S.tab){
        app.innerHTML=paint.html;app.classList.add("booting");S.booting=true;}
      else render();
      await loadAll(false,{fromSnap:true});
    }else render();
    /* Always load. Render whatever exists, then fetch the dataset, feeds and
       status in the background and re-render when they land. */
    await loadAll();
    loadNews();
  })();
  /* Save the current page as the next instant start when the tab is hidden
     or closed. */
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")savePaint();});
  /* Keep an open page honest: refetch /api/status every minute and repaint
     only the chip and the footer. During a live gameweek this is also what
     moves the chip to Live. A full load still only happens on open, on
     Check now, or when the server reports a new dataset commit. */
  if(!BACKUP)setInterval(()=>{if(S.loading)return;
    loadStatus().then(s=>{if(s)refreshStatusUI();});},60000);
})();
