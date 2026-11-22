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
function act(k,a,b,c){
  const P=id=>S.model?.players.find(p=>p.id===id);
  /* any action closes the player menu (21 Nov 2026) */
  if(k!=="pmenu"&&S.pMenu!=null)S.pMenu=null;
  switch(k){
    case"load":loadAll().then(()=>loadNews());return;
    case"tab":if(a!==S.tab){savePaint();closePops();}S.tab=a;S.menuOpen=false;break;
    case"menu":S.menuOpen=!S.menuOpen;break;
    case"chipview":S.chipView=a;break;
    case"chiphalf":S.chipHalf=a;break;
    case"fhForm":S.fhForm=a||null;break;
    case"wcForm":S.wcForm=a||null;break;
    /* wave 2: This Week strip and the Compare pop-up */
    case"weekh":S.weekH=[1,3,5].includes(+a)?+a:1;LS.set("weekh",S.weekH);break;
    case"pop":S.pop=a||null;S.popTab=null;break;
    case"poptab":S.popTab=a;break;
    case"popclose":S.pop=null;break;
    /* This Week batch 2: Transfers, Captain, Transfer Record controls */
    case"twh":S.twH=a==="ROS"?"ROS":+a;break;
    case"planh":S.planH=+a===3?3:5;break;
    case"twpos":S.twPos=+a||0;S.twSel=null;break;
    case"twsel":S.twSel=a;break;
    case"capsel":S.capSel=+a;break;
    case"caph":S.capH=a==="ROS"?"ROS":+a;break;
    case"trwin":S.trWin=a;break;
    case"trfilt":S.trFilt=a;break;
    case"rkmode":S.rkMode=a==="pts"?"pts":"rank";break;
    case"trh":S.trH=[1,3,5].includes(+a)?+a:1;break;
    case"cmpmove":{S.pop=null;S.cmp=cmpNew("cur","plan");const ids=effectiveSquadIds(VG()).ids.map(i=>i===a?b:i);S.cmp.ed.B={ids};break;}
    /* wave 3: Players hub */
    /* Teams (redesign 12 Nov 2026): Fixture Grid and Matches */
    case"tsort":if(S.tSort===a)S.tDir=S.tDir==="asc"?"desc":"asc";else{S.tSort=a;S.tDir="desc";}break;
    case"tlens":S.tLens=["att","def","all"].includes(a)?a:"all";S.tSort=null;break;
    case"twin":S.tWin=a==="ros"?"ros":[3,5].includes(+a)?+a:1;break;
    case"topen":S.tOpen=S.tOpen===a?null:a;break;
    case"mgw":S.mGw=clamp(+a||1,1,38);break;
    /* This Week batch 3 (22 Nov 2026): Team News, Price Watch, Fixture Outlook, Performance */
    case"tnh":S.tnH=a==="ROS"?"ROS":[1,3,5].includes(+a)?+a:5;break;
    case"foh":S.foH=a==="ROS"?"ROS":[1,3,5].includes(+a)?+a:5;break;
    case"folens":S.foLens=["att","def"].includes(a)?a:"all";break;
    case"pwtab":S.pwTab=["mine","watch","all"].includes(a)?a:"mine";break;
    case"pwmkt":S.pwMkt=a==="fall"?"fall":"rise";break;
    case"pwstar":{const w=LS.get("pwWatch")||[],i=w.indexOf(+a);if(i>=0)w.splice(i,1);else w.push(+a);LS.set("pwWatch",w);break;}
    case"pmwin":S.pmWin=a==="season"?"season":[3,6].includes(+a)?+a:6;break;
    case"tmatch":S.fixMode="matches";S.mGw=clamp(+a||1,1,38);window.scrollTo(0,0);break;
    /* wave 7: Status options */
    case"cleardrafts":LS.set("drafts",[]);toast("Drafts deleted");break;
    case"clearstars":S.stars=[];LS.set("stars",[]);break;
    /* research list: funding pairs */
    case"fundon":S.fundOn=true;break;
    case"dofund":{const c=bestCombo([a,b],Math.max(3,S.weekH||1),6);if(!c||c.picks.length<2)break;
      let ok=true;c.picks.forEach(m=>{if(ok&&!applySwap(m.out.id,m.inn.id))ok=false;});
      if(ok)toast("Both transfers made");break;}
    /* Player Data (12 Nov 2026) */
    case"pshow":S.pShow=["all","out","mine"].includes(a)?a:"all";S.pdLimit=PD_PAGE;LS.set("pd",{show:S.pShow,own:S.pOwn,more:S.pdMore});break;
    case"pown":S.pOwn=a==="rank"?"rank":"all";LS.set("pd",{show:S.pShow,own:S.pOwn,more:S.pdMore});break;
    case"pstart":S.pStarters=!S.pStarters;break;
    case"pdmorefilters":S.pdMore=!S.pdMore;LS.set("pd",{show:S.pShow,own:S.pOwn,more:S.pdMore});break;
    case"pwin":{const g0=S.model?S.model.next.id:1;S.lGwFrom=g0;S.lGwTo=a==="ros"?38:Math.min(38,g0+([3,5].includes(+a)?+a:5)-1);break;}
    case"pdreset":S.lSearch="";S.lTeam=0;S.lMax=16;S.lMin=0;S.lPos=0;S.pShow="all";S.pOwn="all";S.pStarters=false;S.starOnly=false;S.iconF=[];S.lWin=38;
      {const g0=S.model?S.model.next.id:1;S.lGwFrom=g0;S.lGwTo=Math.min(38,g0+4);}break;
    case"tick":{const t=S.pTicks||[];S.pTicks=t.includes(a)?t.filter(x=>x!==a):(t.length>=5?t:[...t,a]);
      if(t.length>=5&&!t.includes(a))toast("Up to five players at a time");if(!S.pTicks.length)S.pCmp=false;break;}
    case"tickclear":S.pTicks=[];S.pCmp=false;break;
    case"pcmp":S.pCmp=!!(S.pTicks||[]).length;break;
    case"pcmpclose":S.pCmp=false;break;
    case"pcmpview":S.pCmpView=a==="stats"?"stats":"radar";break;
    case"pcmpscout":{const ps=(S.pTicks||[]).map(i=>S.model.players.find(p=>p.id===i)).filter(Boolean),r=lGwRange();
      const names=ps.map(p=>p.web_name),list=names.length>1?names.slice(0,-1).join(", ")+" and "+names[names.length-1]:names[0]||"";
      S.pCmp=false;render();
      if(typeof askScout==="function")askScout("Compare: "+names.join(", "),"",`Compare ${list} for GW${r.from}–${r.to}. Who should I pick, and why?`);
      return;}
    /* Compare v3 (21 Nov 2026): A and B are squads; edits stay on their side */
    case"compare":S.cmp=S.cmp?null:cmpNew("cur","plan");break;
    case"cmpclose":S.cmp=null;break;
    case"cmpopen":S.cmp=cmpNew("cur",a==="wc"?"wc":"fh");if(a==="wc")S.cmp.h=5;break;
    case"cmpsrc":{const C=S.cmp;if(!C)break;C[a==="A"?"a":"b"]=b;C.ed[a]=null;C.menu=C.repl=C.sub=null;if(b==="wc"&&C.h===1)C.h=5;break;}
    case"cmph":if(S.cmp)S.cmp.h=[1,3,5].includes(+a)?+a:1;break;
    case"cmplock":{const C=S.cmp;if(!C)break;C.pendLocks=C.pendLocks.includes(a)?C.pendLocks.filter(x=>x!==a):[...C.pendLocks,a];C.pendBans=C.pendBans.filter(x=>x!==a);C.menu=null;break;}
    case"cmpban":{const C=S.cmp;if(!C)break;C.pendBans=C.pendBans.includes(a)?C.pendBans.filter(x=>x!==a):[...C.pendBans,a];C.pendLocks=C.pendLocks.filter(x=>x!==a);C.menu=null;break;}
    case"cmprerun":{const C=S.cmp;if(!C)break;C.locks=C.pendLocks.slice();C.bans=C.pendBans.filter(x=>!C.locks.includes(x));C.ed.B=null;break;}
    case"cmpclear":{const C=S.cmp;if(!C)break;Object.assign(C,{locks:[],bans:[],pendLocks:[],pendBans:[]});C.ed.B=null;break;}
    case"cmpmenu":{const C=S.cmp;if(!C)break;C.repl=null;C.menu=(C.menu&&C.menu.side===a&&C.menu.id===b)?null:{side:a,id:b};break;}
    case"cmprepl":{const C=S.cmp;if(!C)break;C.menu=null;C.repl=(C.repl&&C.repl.side===a&&C.repl.id===b)?null:{side:a,id:b};break;}
    case"cmpsubpick":{const C=S.cmp;if(!C)break;C.menu=null;C.sub={side:a,id:b};toast("Now tap who to swap with");break;}
    case"cmpclick":{const C=S.cmp;if(!C)break;
      if(C.sub&&C.sub.side===a){const from=C.sub.id;C.sub=null;if(from!==b)cmpDoSub(a,from,b);break;}
      C.menu=C.repl=null;S.cardId=b;break;}
    case"cmpsub":if(S.cmp){S.cmp.sub=null;if(b!==c)cmpDoSub(a,b,c);}break;
    case"cmpcap":cmpEdit(a,e=>{e.cap=b;if(e.vice===b)e.vice=null;});if(S.cmp)S.cmp.menu=null;break;
    case"cmpvice":cmpEdit(a,e=>{e.vice=b;if(e.cap===b)e.cap=null;});if(S.cmp)S.cmp.menu=null;break;
    case"cmpswap":{const C=S.cmp;if(!C)break;const T=cmpSide(a),o=S.model.players.find(p=>p.id===b),n=S.model.players.find(p=>p.id===c);if(!T||!o||!n)break;
      cmpEdit(a,e=>{e.ids=e.ids.map(i=>i===b?c:i);e.xi=e.xi.map(i=>i===b?c:i);if(e.cap===b)e.cap=c;if(e.vice===b)e.vice=c;e.bank=+(e.bank+T.sellOrPay(o)-n.price).toFixed(1);});
      C.repl=null;toast(o.web_name+" → "+n.web_name);break;}
    case"cmpundo":if(S.cmp)S.cmp.ed={A:null,B:null};break;
    case"cmpsave":{const C=S.cmp;if(!C)break;const T=cmpSide("B");if(!T||!T.ids)break;
      const def=T.label+" GW"+VG();let nm=def;
      try{if(typeof prompt==="function"){const r=prompt("Name this squad",def);if(r===null)break;nm=String(r).trim()||def;}}catch(_){}
      const ds=[{label:nm.slice(0,40),ids:T.ids.slice(),xi:T.xi.map(p=>p.id),cap:T.cap&&T.cap.id,vice:T.vice&&T.vice.id,bank:T.bank,gw:VG(),mode:C.b},...(LS.get("drafts")||[])].slice(0,10);
      LS.set("drafts",ds);toast("Saved: "+nm);break;}
    case"cmpapply":{const C=S.cmp;if(!C)break;const T=cmpSide("B");if(!T||!T.ids)break;
      const gw=editableGw();if(gw==null)break;
      if(C.b==="wc"||C.b==="fh"){const kind=C.b==="wc"?"wildcard":"freehit";
        if(chipForWeek(gw)!==kind){const half=gw>=20?"2":"1",next={...S.chips};
          ["bboost","3xc","freehit","wildcard"].forEach(k=>{if(next[k+half]===gw)delete next[k+half];});
          const keep=S.chips;S.chips=next;const why=chipRuleBreak(kind+half,gw);S.chips=keep;
          if(why){toast(why,{warn:true});break;}
          next[kind+half]=gw;S.chips=next;}}
      const cur=effectiveSquadIds(gw).ids,byId=id=>S.model.players.find(p=>p.id===id);
      const bank=+(planBank()+cur.filter(i=>!T.ids.includes(i)).reduce((s,i)=>s+sellPrice(byId(i)),0)
        -T.ids.filter(i=>!cur.includes(i)).reduce((s,i)=>s+byId(i).price,0)).toFixed(1);
      if(bank<-0.001){toast("Over budget by £"+(-bank).toFixed(1),{warn:true});break;}
      writePlan(gw,T.ids,{bank,captain:T.cap?T.cap.id:null,vice:T.vice?T.vice.id:null});
      S.flagged=[];S.forceXI=T.xi.map(p=>p.id);S.benchOrder=T.bench.map(p=>p.id);saveState();S.cmp=null;
      toast((C.b==="wc"?"Wildcard":C.b==="fh"?"Free Hit":T.label)+" team applied to GW"+gw+". Save when you are happy.");break;}
    case"sqview":S.sqView=a;break;
    case"sqsort":if((S.sqSort||"pos")===a)S.sqDir=(S.sqDir||"asc")==="asc"?"desc":"asc";
      else{S.sqSort=a;S.sqDir=a==="pos"||a==="next"?"asc":"desc";}break;
    case"card":S.cardId=a||null;S.cardTab="overview";break;
    case"pmenu":S.pMenu=a==null?null:+a;break;
    case"lsortset":S.lSort=a;S.lDir="desc";break;
    case"poolpop":S.poolPop=S.poolPop===a?null:a;break;
    case"fitonly":S.fFit=!S.fFit;break;
    case"dragsub":S.subFrom=null;if(a!==b)trySub(a,b);break;
    case"pdmore":S.pdLimit=(S.pdLimit||PD_PAGE)+PD_PAGE;break;
    case"pdall":S.pdLimit=1000;break;
    case"poolmore":S.poolLimit=Math.min(150,(S.poolLimit||50)+50);break;
    case"pdless":S.pdLimit=PD_PAGE;break;
    case"sigpos":S.sigPos=+a||0;LS.set("sig",{pos:S.sigPos,h:S.sigH||3,fold:S.sigFold||[],tab:S.sgTab});break;
    case"sigh":S.sigH=+a||3;LS.set("sig",{pos:S.sigPos||0,h:S.sigH,fold:S.sigFold||[],tab:S.sgTab});break;
    /* Signals tabs (25 Oct 2026) */
    case"sgtab":closePops();S.sgTab=["squad","teams","players"].includes(a)?a:"squad";
      LS.set("sig",{pos:S.sigPos||0,h:S.sigH||3,fold:S.sigFold||[],tab:S.sgTab});
      try{history.replaceState({},"","#/signals/"+S.sgTab);}catch(e){}break;
    case"sigfold":{const f=new Set(S.sigFold||[]);f.has(a)?f.delete(a):f.add(a);S.sigFold=[...f];
      LS.set("sig",{pos:S.sigPos||0,h:S.sigH||3,fold:S.sigFold,tab:S.sgTab});break;}
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
    case"lmax":S.lMax=clamp(+a||16,Math.max(3.5,S.lMin||0),16);break;
    case"lmin":S.lMin=clamp(+a||0,0,S.lMax||16);if(S.lMin<=3.5)S.lMin=0;break;
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
       if(nb<-0.001)toast(`Over budget by £${(-nb).toFixed(1)} for ${p.web_name}. Plan it, but Save stays off until the bank is back to £0.0`,{warn:true});
       writePlan(gw,[...cur,p.id],{bank:nb});saveState();}break;}
    case"doswap":if(applySwap(a,b)){S.pendingOpt=null;toast("Transfer made");}break;
    case"opt":{S.forceXI=null;
      const g2=S.model.next.id;const xi=startingXI();
      const rank=xi.slice().sort((x,y)=>(y.gw[g2]?.pts||0)-(x.gw[g2]?.pts||0));
      if(rank[0]){S.captain=rank[0].id;if(rank[1])S.vice=rank[1].id;
        /* C10 (audit, 22 Nov 2026): a captain picked by hand is saved in the
           week's plan, which the pitch reads first, so the armband stayed put
           while the toast said it moved. Write the plan as the cap action does. */
        const gwE=editableGw();if(gwE!=null)writePlan(gwE,null,{captain:S.captain,vice:S.vice});}
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
    case"save":{const bk=planBank();if(bk<-0.001){toast("Over budget by £"+Math.abs(bk).toFixed(1)+": sell someone or pick cheaper players before saving",{warn:true});break;}
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
    /* Chips page (20 Nov 2026): set a whole plan, Team Builder toggle and week, open Compare in a mode */
    case"chipplan":{const p=_chipPlanList[+a];if(!p)break;const c={...S.chips};Object.keys(p.pick).forEach(k=>delete c[k]);S.chips=c;
      const bad=[];Object.entries(p.pick).sort((x,y)=>x[1][0]-y[1][0]).forEach(([k,[e]])=>{const why=chipRuleBreak(k,e);if(why)bad.push(why);else S.chips={...S.chips,[k]:e};});
      saveState();if(bad.length)toast(bad[0],{warn:true});else toast("Plan set: "+Object.entries(p.pick).sort((x,y)=>x[1][0]-y[1][0]).map(([k,[e]])=>CHIP_UI[chipKind(k)].s+" GW"+e).join(", "));break;}
    case"chiprp":S.chipRP={...(S.chipRP||{}),[a]:b};break;
    /* place a chip on the roadmap (21 Nov 2026): click a chip then a week,
       or drag it; the plan is S.chips, so the Planner shows it too */
    case"chippick":S.chipPick=a&&S.chipPick!==a?a:null;break;
    /* click a week for a chip: plans it there, or clears it if it is
       already there (21 Nov 2026: no Plan buttons) */
    case"chipset":{const e=+b;
      if(S.chips[a]===e){const c={...S.chips};delete c[a];S.chips=c;saveState();toast(`${CHIP_UI[chipKind(a)].n} ${a.slice(-1)} cleared from GW${e}`);break;}
      const why=chipRuleBreak(a,e);if(why){toast(why,{warn:true});break;}
      S.chips={...S.chips,[a]:e};saveState();toast(`${CHIP_UI[chipKind(a)].n} ${a.slice(-1)} planned for GW${e}`);break;}
    case"chipplace":{const k=S.chipPick,e=+a;if(!k)break;
      if(S.model&&e<S.model.next.id){toast("GW"+e+" has already started",{warn:true});break;}
      const why=chipRuleBreak(k,e);if(why){toast(why,{warn:true});break;}
      S.chips={...S.chips,[k]:e};S.chipPick=null;saveState();toast(`${CHIP_UI[chipKind(k)].n} ${k.slice(-1)} planned for GW${e}`);break;}
    case"chippop":S.chipPop=a||null;break;
    case"chippopclose":S.chipPop=null;break;
    case"expand":S.expand={...S.expand,[a]:!S.expand[a]};break;
    case"fixmode":S.fixMode=a==="matches"?"matches":"grid";if(a==="matches")S.mGw=null;break;
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
    /* News (22 Nov 2026): story category, Injury Room tab, Social Media filter */
    case"nwcat":S.nwCat=a||"all";break;
    case"nwir":S.nwIr=a||"chg";break;
    case"nwso":S.nwSo=a||"all";break;
    case"pkcat":S.pkCat=a||"all";break;
    /* a player's card on its News tab, and switching the card's tabs */
    case"cardnews":S.cardId=a||null;S.cardTab="news";S.pkCat="all";if(a)loadPlayerNews(a);break;
    case"cardtab":S.cardTab=a==="news"?"news":"overview";if(S.cardTab==="news"&&S.cardId)loadPlayerNews(S.cardId);break;
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
window.addEventListener("hashchange",()=>{savePaint();if(applyHash())render();});
/* F10: Enter and Space press anything given a button role by a11yPass();
   F108: Escape closes the player card. */
document.addEventListener("keydown",e=>{
  const el=e.target;
  if((e.key==="Enter"||e.key===" ")&&el&&el.getAttribute&&el.getAttribute("role")==="button"
     &&!/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)){e.preventDefault();el.click();return;}
  if(e.key==="Escape"&&S.cardId){S.cardId=null;render();return;}
  if(e.key==="Escape"&&S.pMenu!=null){S.pMenu=null;render();return;}
  if(e.key==="Escape"&&(S.pop||S.cmp||S.pCmp||S.chipPop||S.chipPick)){S.pop=null;S.cmp=null;S.pCmp=false;S.chipPop=null;S.chipPick=null;render();}
});
window.addEventListener("popstate",()=>{savePaint();if(applyHash())render();});
/* Signals charts: the hover card reads data-tip "title|figure|note" */
/* Player Data signal tiles: a card above the tile with the signal's name
   and one short line (data-tt), on hover or keyboard focus */
function sigTipShow(tip,el){const k=el.getAttribute("data-sig"),S9=SIGNAL[k];if(!S9)return false;
  const tone=S9[1]==="NAVY"?"#7AA2FF":S9[1];
  tip.className="ctip sigtip";tip.innerHTML=`<span class="tile" style="--tc:${tone}">${lic(S9[0])}</span><span><b>${esc(S9[2])}</b><em>${esc(el.getAttribute("data-tt")||"")}</em></span>`;
  tip.hidden=false;const r=el.getBoundingClientRect();
  tip.style.left=Math.max(8,Math.min(window.innerWidth-tip.offsetWidth-8,r.left-10))+"px";
  tip.style.top=Math.max(8,r.top-tip.offsetHeight-10)+"px";return true;}
document.addEventListener("focusin",e=>{const tip=document.getElementById("ctip"),s=e.target&&e.target.closest&&e.target.closest("[data-sig][data-tt]");
  if(tip&&s)sigTipShow(tip,s);});
document.addEventListener("focusout",e=>{const tip=document.getElementById("ctip");if(tip&&tip.classList.contains("sigtip"))tip.hidden=true;});
/* Teams grid: a click anywhere on a club's row (not on a fixture, a result
   tile or a button) opens its detail, like the club name does */
document.addEventListener("click",e=>{const t=e.target;if(!t||!t.closest)return;const r=t.closest("tr.tg-r");
  if(!r||t.closest("button,a,.tg-fx,.tg-form"))return;act("topen",r.getAttribute("data-club"));});
document.addEventListener("mouseover",e=>{const tip=document.getElementById("ctip");if(!tip)return;
  const s=e.target&&e.target.closest?e.target.closest("[data-sig][data-tt]"):null;
  if(s){sigTipShow(tip,s);return;}
  const t=e.target&&e.target.closest?e.target.closest("svg.chart [data-tip]"):null;
  if(!t){tip.hidden=true;return;}
  const [a,b,c]=String(t.getAttribute("data-tip")).split("|");
  tip.className="ctip";tip.innerHTML=`<span>${esc(a||"")}</span><b>${esc(b||"")}</b>${c?`<em>${esc(c)}</em>`:""}`;tip.hidden=false;});
document.addEventListener("mousemove",e=>{const tip=document.getElementById("ctip");
  if(tip&&!tip.hidden&&!tip.classList.contains("sigtip")){tip.style.left=Math.min(window.innerWidth-190,e.clientX+14)+"px";tip.style.top=(e.clientY+16)+"px";}});
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
  {const pd=LS.get("pd")||{};S.pShow=pd.show||"all";S.pOwn=pd.own||"all";S.pdMore=false;}
  S.pTicks=[];
  {const sg=LS.get("sig")||{};S.sigPos=sg.pos||0;S.sigH=sg.h||3;S.sigFold=sg.fold||[];S.sgTab=["squad","teams","players"].includes(sg.tab)?sg.tab:"squad";}
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
    /* this page's own picture; the single picture kept before 20 Nov 2026
       serves only if it is of this page */
    const [snap,own,old]=await Promise.all([IDB.get("snap"),IDB.get("paint:"+S.tab),IDB.get("paint")]);
    const paint=own||(old&&old.tab===S.tab?old:null);
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
/* drag a chip onto a roadmap week (21 Nov 2026) */
function chipDrag(ev,k){try{ev.dataTransfer.setData("text/plain",k);ev.dataTransfer.effectAllowed="move";}catch(_){}}
function chipDrop(ev,e){ev.preventDefault();const k=ev.dataTransfer&&ev.dataTransfer.getData("text/plain");if(!k)return;S.chipPick=k;act("chipplace",e);}
/* Planner player menu (21 Nov 2026): right-click opens it, a long press on
   a touch screen too; a click anywhere else closes it. */
let _lpT=null,_lpFired=false;
document.addEventListener("pointerdown",e=>{
  const c=e.target&&e.target.closest?e.target.closest(".pz-c[data-pid]"):null;
  if(!c||e.pointerType==="mouse"||e.target.closest(".pz-menu,button"))return;
  _lpFired=false;clearTimeout(_lpT);
  _lpT=setTimeout(()=>{_lpFired=true;act("pmenu",+c.dataset.pid);},500);});
["pointerup","pointercancel","pointerleave"].forEach(t=>document.addEventListener(t,()=>clearTimeout(_lpT)));
document.addEventListener("click",e=>{
  if(_lpFired){_lpFired=false;e.preventDefault();e.stopPropagation();return;}
  if(S.pMenu!=null&&!(e.target.closest&&e.target.closest(".pz-menu,.pz-c,.lv-act"))){S.pMenu=null;render();}
  if(S.cmp&&(S.cmp.menu||S.cmp.repl)&&!(e.target.closest&&e.target.closest(".pz-menu,.pz-c"))){S.cmp.menu=null;S.cmp.repl=null;render();}
  if(S.poolPop&&!(e.target.closest&&e.target.closest(".pf-pop,.pf-c"))){S.poolPop=null;render();}},true);
/* drag a player onto another to substitute them (21 Nov 2026); the
   formation follows as long as it stays legal (trySub checks) */
function pzDrag(e,id){try{e.dataTransfer.setData("text/plain",String(id));e.dataTransfer.effectAllowed="move";}catch(_){}S.pMenu=null;}
function pzOver(e){e.preventDefault();try{e.dataTransfer.dropEffect="move";}catch(_){}e.currentTarget.classList.add("drop");}
function pzDrop(e,id,side){e.preventDefault();e.currentTarget.classList.remove("drop");
  let from=NaN;try{from=+e.dataTransfer.getData("text/plain");}catch(_){}
  if(from&&from!==id){if(side)act("cmpsub",side,from,id);else act("dragsub",from,id);}}
/* Compare: a substitution or an edit on one side (21 Nov 2026) */
function cmpEdit(side,fn){const C=S.cmp;if(!C)return;const T=cmpSide(side);if(!T||!T.ids)return;
  C.ed[side]=C.ed[side]||{ids:T.ids.slice(),xi:T.xi.map(p=>p.id),cap:T.cap?T.cap.id:null,vice:T.vice?T.vice.id:null,bank:T.bank};fn(C.ed[side]);}
function cmpDoSub(side,a,b){const T=cmpSide(side);if(!T)return;const xi=T.xi.map(p=>p.id),aIn=xi.includes(a),bIn=xi.includes(b);
  if(aIn===bIn){toast(aIn?"Pick one from the pitch and one from the bench":"Bench order follows the predictions here");return;}
  const next=xi.map(i=>i===(aIn?a:b)?(aIn?b:a):i);
  if(!legalXI(next)){toast("That would break the formation");return;}
  cmpEdit(side,e=>{e.xi=next;});toast("Substitution made");}
