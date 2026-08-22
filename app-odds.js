/* FPL Edge — app-odds.js
   bookmaker odds: fetching, de-vigging, the Odds page

   Part of a single script split across files so each stays small enough to
   fetch whole. Loaded in order as classic scripts, sharing one global scope,
   so the order in index.html matters: app-main.js must come last. */
/* ---------- Odds ----------
   Bookmaker prices are a live consensus model — they price form, team news,
   penalties and venue in one number. Needs a free key from odds-api.io. */
/* ---------- reading the market ----------
   Both available bookmakers are soft books, so their prices carry a wider
   margin than a sharp book's. Everything below is de-vigged before use. */
function devig(prices){
  const inv=prices.map(p=>p>0?1/p:0);
  const sum=inv.reduce((a,x)=>a+x,0);
  return sum>0?inv.map(x=>x/sum):inv.map(()=>0);
}
/* one price on its own still carries roughly half the book's margin */
const devig1=(price,margin)=>price>0?clamp((1/price)/(1+(margin||0.06)),0,0.99):0;

/* The feed uses full club names while FPL uses abbreviations — "Manchester
   City" against "Man City", "Tottenham Hotspur" against "Spurs" — so a
   substring test fails on exactly the clubs that matter. Mapped explicitly. */
const CLUB_ALIAS={
  arsenal:"ARS", astonvilla:"AVL", afcbournemouth:"BOU", bournemouth:"BOU",
  brentford:"BRE", brentfordfc:"BRE", brightonhovealbion:"BHA", brightonandhovealbion:"BHA",
  brighton:"BHA", chelsea:"CHE", chelseafc:"CHE", coventrycity:"COV", coventry:"COV",
  crystalpalace:"CRY", everton:"EVE", evertonfc:"EVE", fulham:"FUL", fulhamfc:"FUL",
  hullcity:"HUL", hull:"HUL", ipswichtown:"IPS", ipswich:"IPS",
  leedsunited:"LEE", leeds:"LEE", liverpool:"LIV", liverpoolfc:"LIV",
  manchestercity:"MCI", mancity:"MCI", manchesterunited:"MUN", manutd:"MUN",
  manchesterutd:"MUN", newcastleunited:"NEW", newcastle:"NEW",
  nottinghamforest:"NFO", nottmforest:"NFO", forest:"NFO",
  tottenhamhotspur:"TOT", tottenham:"TOT", spurs:"TOT",
  sunderland:"SUN", sunderlandafc:"SUN", wolverhamptonwanderers:"WOL", wolves:"WOL",
  westhamunited:"WHU", westham:"WHU", burnley:"BUR", burnleyfc:"BUR"
};
function clubFromName(n){
  const teams=S.model?S.model.teams:[];
  const q=norm(n||"");if(!q)return null;
  const code=CLUB_ALIAS[q]
    ||CLUB_ALIAS[q.replace(/^(afc|fc)/,"").replace(/(afc|fc)$/,"")];
  if(code){const t=teams.find(x=>x.short===code);if(t)return t;}
  return teams.find(x=>norm(x.name)===q)
    ||teams.find(x=>q.includes(norm(x.name))||norm(x.name).includes(q))
    ||teams.find(x=>norm(x.short)===q)||null;
}
function marketsFor(ev){
  const out={};
  (ev.bookmakers||[]).forEach(b=>{
    (b.markets||[]).forEach(m=>{
      const k=String(m.key||"").toLowerCase();
      (out[k]=out[k]||[]).push({...m,book:b.key});
    });
  });
  return out;
}
/* Correct Score gives the joint distribution, so a clean sheet is an exact sum
   rather than a Poisson guess: add every scoreline where they concede nothing. */
function fromCorrectScore(mk){
  const cs=(mk["correct score"]||[]);
  if(!cs.length)return null;
  const line=cs[0];
  const raw=[],labels=[];
  (line.outcomes||[]).forEach(o=>{
    const m=/(\d+)\s*[-–:]\s*(\d+)/.exec(String(o.name));
    if(!m||!o.price)return;
    labels.push([+m[1],+m[2]]);raw.push(o.price);
  });
  if(raw.length<6)return null;
  const p=devig(raw);
  let csHome=0,csAway=0,xgHome=0,xgAway=0;
  labels.forEach(([h,a],i)=>{
    if(a===0)csHome+=p[i];
    if(h===0)csAway+=p[i];
    xgHome+=h*p[i];xgAway+=a*p[i];
  });
  return{csHome,csAway,xgHome,xgAway,n:raw.length};
}
/* fall back to the totals and both-teams markets where Correct Score is absent */
function fromTotals(mk){
  const btts=(mk["btts"]||mk["both teams to score"]||[])[0];
  const tot=(mk["totals"]||[]).filter(m=>m.hdp===2.5)[0]||(mk["totals"]||[])[0];
  const ml=(mk["h2h"]||[])[0];
  if(!ml)return null;
  const pick=(m,n)=>(m&&m.outcomes||[]).find(o=>String(o.name).toLowerCase()===n);
  const oH=pick(ml,"home"),oD=pick(ml,"draw"),oA=pick(ml,"away");
  if(!oH||!oD||!oA)return null;
  const [pH,,pA]=devig([oH.price,oD.price,oA.price]);
  let total=2.7;
  if(tot){const ov=pick(tot,"over"),un=pick(tot,"under");
    if(ov&&un){const q=devig([ov.price,un.price]);
      total=(tot.hdp||2.5)+(q[0]-0.5)*2.4;}}
  const tilt=clamp(0.5+(pH-pA)*0.55,0.2,0.8);
  const xgHome=total*tilt,xgAway=total*(1-tilt);
  let csHome=Math.exp(-xgAway),csAway=Math.exp(-xgHome);
  if(btts){const y=pick(btts,"yes"),n=pick(btts,"no");
    if(y&&n){const q=devig([y.price,n.price]);
      /* scale both to agree with the priced probability of a shut-out */
      const f=q[1]/Math.max(0.05,csHome+csAway-csHome*csAway);
      csHome*=clamp(f,0.6,1.6);csAway*=clamp(f,0.6,1.6);}}
  return{csHome:clamp(csHome,0,0.8),csAway:clamp(csAway,0,0.8),xgHome,xgAway,n:0};
}
/* every priced fixture, reduced to what matters for FPL */
function oddsFixtures(){
  const findTeam=clubFromName;
  return (S.odds||[]).map(ev=>{
    const mk=marketsFor(ev);
    const goals=fromCorrectScore(mk)||fromTotals(mk);
    if(!goals)return null;
    return{ev,mk,goals,ht:findTeam(ev.home),at:findTeam(ev.away),
      home:ev.home,away:ev.away,date:ev.commence||ev.date};
  }).filter(Boolean);
}
/* player prices, keyed to our own player records */
function oddsPlayers(){
  const out={};
  const P=S.model?S.model.players:[];
  const byTeam={};P.forEach(p=>{(byTeam[p.team]=byTeam[p.team]||[]).push(p);});
  /* Score every candidate rather than taking the first loose hit: a plain
     substring test matched "Rayan Cherki" to a Bournemouth player called Rayan.
     Surname agreement is what actually identifies a footballer. */
  const match=(name,teamIds)=>{
    const q=norm(name);if(!q)return null;
    const pool=teamIds.flatMap(id=>byTeam[id]||[]);
    let best=null,bestScore=0;
    pool.forEach(p=>{
      const web=norm(p.web_name), full=norm((p.first||"")+" "+(p.last||"")), last=norm(p.last||"");
      let sc=0;
      if(full&&full===q)sc=100;
      else if(web===q)sc=90;
      else if(last&&last.length>=4&&q.endsWith(last))sc=70+last.length;
      else if(last&&last.length>=4&&q.includes(last))sc=55+last.length;
      else if(web.length>=5&&q.includes(web))sc=40+web.length;
      if(sc>bestScore){bestScore=sc;best=p;}
    });
    return bestScore>=40?best:null;};
  const MK={"player to score or assist":"ret","anytime goalscorer":"goal",
    "player to assist":"assist","player shots on target":"sot",
    "player shots":"shots","player to be booked":"card"};
  oddsFixtures().forEach(fx=>{
    const ids=[fx.ht&&fx.ht.id,fx.at&&fx.at.id].filter(Boolean);
    Object.entries(MK).forEach(([raw,key])=>{
      (fx.mk[raw]||[]).forEach(m=>{
        /* one-sided markets: strip roughly half the book's margin */
        const margin=Math.max(0,(m.outcomes||[]).reduce((a,o)=>a+1/o.price,0)/
          Math.max(1,(m.outcomes||[]).length)*0-0)+0.06;
        (m.outcomes||[]).forEach(o=>{
          if(!o.price)return;
          const pl=match(o.name,ids);if(!pl)return;
          const rec=out[pl.id]=out[pl.id]||{p:pl,fx};
          const prob=devig1(o.price,margin);
          if(key==="sot"||key==="shots"){
            if(!rec[key]||prob>rec[key])rec[key]=prob;
          }else if(!rec[key]||prob>rec[key])rec[key]=prob;
        });
      });
    });
  });
  return out;
}
/* the market's own view of a player's FPL score */
function marketPoints(p,rec,fx){
  if(!rec&&!fx)return null;
  const GOAL={1:10,2:6,3:5,4:4}[p.pos]||4, CS={1:4,2:4,3:1,4:0}[p.pos]||0;
  const mins=clamp(p.xMins/90,0,1);
  const app=p.xMins>=60?2:(p.xMins>0?1:0);
  let pts=app;
  if(rec){
    if(rec.goal)pts+=rec.goal*GOAL;
    if(rec.assist)pts+=rec.assist*3;
    else if(rec.ret&&rec.goal)pts+=Math.max(0,rec.ret-rec.goal)*3;
    if(rec.card)pts-=rec.card*1;
  }
  if(fx&&p.pos<=3){
    const mine=fx.ht&&fx.ht.id===p.team, theirs=mine?fx.goals.csHome:fx.goals.csAway;
    const cs=mine?fx.goals.csHome:(fx.at&&fx.at.id===p.team?fx.goals.csAway:0);
    pts+=cs*CS;
    if(p.pos<=2){
      const conceded=mine?fx.goals.xgAway:fx.goals.xgHome;
      pts-=Math.floor(conceded/2)*0.5;
    }
  }
  if(p.pos===1&&fx){
    const shots=(fx.ht&&fx.ht.id===p.team?fx.goals.xgAway:fx.goals.xgHome)*3.4;
    pts+=shots/3*0.6;
  }
  return pts*clamp(p.avail,0,1)*(0.55+0.45*mins);
}
/* Turn match prices into expected goals per side, margin removed. */
function buildOddsTeams(){
  const M={};
  (S.odds||[]).forEach(ev=>{
    const h=ev.home||ev.home_team||ev.homeTeam,a=ev.away||ev.away_team||ev.awayTeam;
    if(!h||!a)return;
    const bm=(ev.bookmakers||[])[0];if(!bm)return;
    const h2h=(bm.markets||[]).find(m=>m.key==="h2h");
    const tot=(bm.markets||[]).find(m=>/^totals$/i.test(m.key||"")&&m.hdp===2.5)
      ||(bm.markets||[]).find(m=>/goals? totals|^totals$/i.test(m.key||""));
    if(!h2h)return;
    const pick=n=>(h2h.outcomes||[]).find(o=>String(o.name).toLowerCase()===n);
    const oH=pick("home"),oD=pick("draw"),oA=pick("away");
    if(!oH||!oD||!oA)return;
    const inv=[oH,oD,oA].map(o=>1/o.price),sum=inv.reduce((s2,x)=>s2+x,0);
    const pH=inv[0]/sum,pA=inv[2]/sum;
    let total=2.7;
    if(tot){const ov=(tot.outcomes||[]).find(x=>/over/i.test(x.name));
      const un=(tot.outcomes||[]).find(x=>/under/i.test(x.name));
      if(ov&&un){const i2=[1/ov.price,1/un.price],s3=i2[0]+i2[1];
        total=(tot.hdp||2.5)+(i2[0]/s3-0.5)*2.2;}}
    const tilt=clamp(0.5+(pH-pA)*0.55,0.2,0.8);
    const teams=S.model?S.model.teams:S.teams;
    /* the feed gives full club names ("Brentford FC", "Tottenham Hotspur"),
       so match on the longest overlapping token rather than an exact string */
    const find=clubFromName;
    const th=find(h),ta=find(a);
    if(!th||!ta)return;
    M[th.short+"|"+ta.short+"|H"]={xg:total*tilt,xgc:total*(1-tilt)};
    M[ta.short+"|"+th.short+"|A"]={xg:total*(1-tilt),xgc:total*tilt};
  });
  S.oddsTeams=Object.keys(M).length?M:null;
  return S.oddsTeams;
}
async function loadOdds(){
  if(!S.oddsKey){S.oddsState="nokey";render();return;}
  S.oddsState="loading";S.oddsErr="";S._sampled=false;S._markets={};S.oddsLog=["v"+APP_VERSION+" · started "+new Date().toLocaleTimeString("en-GB")];render();
  const key=encodeURIComponent(S.oddsKey);
  const base="https://api.odds-api.io/v3";
  const log=m=>{S.oddsLog.push(m);};
  const readErr=async r=>{try{const e=await r.json();return e.message||e.error||"";}catch(_){return "";}};
  const get=async(path,label)=>{
    const r=await fetch(base+path);
    if(!r.ok){
      const why=await readErr(r);
      log(`${label}: HTTP ${r.status}${why?" — "+why:""}`);
      if(r.status===401||/invalid[_ ]?key/i.test(why))S.oddsErr="Key rejected by odds-api.io";
      else if(r.status===429)S.oddsErr="Rate limit reached";
      return null;
    }
    const j=await r.json();
    return j;
  };
  try{
    /* The league slug is looked up rather than guessed — the previous build
       assumed "england-premier-league" and silently got back nothing. */
    let slug=LS.get("oddsLeague");
    if(!slug){
      const lj=await get(`/leagues?sport=football&apiKey=${key}`,"leagues");
      if(lj===null){S.oddsState="fail";render();return;}
      const leagues=Array.isArray(lj)?lj:(lj.data||lj.leagues||[]);
      log(`leagues: ${leagues.length} returned`);
      /* 892 leagues come back and dozens contain "Premier League" — the loose
         match landed on an amateur northern division. Score candidates instead,
         rejecting anything amateur, regional or age-group, and require the name
         to be the Premier League rather than merely contain it. */
      const BAD=/amateur|women|u1[6-9]|u2[0-3]|youth|reserve|northern|southern|isthmian|county|regional|division\s*[a-z0-9]|cup|friendly|qualif/i;
      const score=l=>{
        const name=String(l.name||l.title||"");
        const slug=String(l.slug||l.id||l.key||"");
        const hay=`${name} ${slug} ${l.country||""}`;
        if(BAD.test(hay))return -1;
        let sc=0;
        if(/^(england[- ])?premier league$/i.test(name.trim()))sc+=10;
        if(/^england-premier-league$|^epl$/i.test(slug))sc+=10;
        if(/premier league/i.test(name))sc+=3;
        if(/england|english/i.test(hay))sc+=3;
        if(/^premier league$/i.test(name.trim()))sc+=4;
        return sc;
      };
      const ranked=leagues.map(l=>({l,sc:score(l)})).filter(x=>x.sc>=6)
        .sort((a,b)=>b.sc-a.sc);
      const hit=ranked.length?ranked[0].l:null;
      if(!hit){
        S.oddsErr="Couldn't find a Premier League entry among "+leagues.length+" football leagues";
        S.oddsState="fail";render();return;
      }
      slug=hit.slug||hit.id||hit.key;
      LS.set("oddsLeague",slug);
      log(`league matched: ${hit.name||hit.title||slug} → ${slug}`+(ranked.length>1?` (from ${ranked.length} candidates)`:""));
    }

    /* /odds rejects a call with no bookmakers, so establish the account's own
       selection first and fall back to a couple of mainstream UK books. */
    let books=LS.get("oddsBooks");
    if(!books){
      const bj=await get(`/bookmakers/selected?apiKey=${key}`,"bookmakers");
      const list=bj?(Array.isArray(bj)?bj:(bj.data||bj.bookmakers||[])):[];
      books=list.map(b=>(typeof b==="string"?b:(b.name||b.key||b.id))).filter(Boolean);
      if(!books.length)books=["Bet365","PaddyPower"];
      LS.set("oddsBooks",books);
      log(`bookmakers: ${books.join(", ")}`);
    }
    const bParam="&bookmakers="+encodeURIComponent(books.join(","));

    const ej=await get(`/events?sport=football&league=${encodeURIComponent(slug)}&apiKey=${key}`,"events");
    if(ej===null){S.oddsState="fail";render();return;}
    const events=(Array.isArray(ej)?ej:(ej.data||ej.events||[])).slice(0,10);
    log(`events: ${events.length} for ${slug}`);
    if(!events.length){S.oddsState="empty";render();return;}

    /* /odds/multi takes up to ten event ids at a time */
    const out=[];
    for(let i2=0;i2<events.length;i2+=10){
      const chunk=events.slice(i2,i2+10);
      const ids=chunk.map(e=>e.id||e.eventId).filter(Boolean);
      if(!ids.length)continue;
      const oj=await get(`/odds/multi?eventIds=${encodeURIComponent(ids.join(","))}${bParam}&apiKey=${key}`,"odds");
      if(oj===null)break;
      const rows=Array.isArray(oj)?oj:(oj.data||Object.values(oj||{}));
      log(`odds: ${rows.length} rows for ${ids.length} events`);
      /* Catalogue every market the feed actually returns. Player-level markets
         are often gated behind paid tiers, and the design of the Odds tab
         depends on whether they come through, so this is worth knowing exactly
         rather than assuming from the bookmaker's own website. */
      rows.forEach(rw=>{
        Object.entries(rw&&rw.bookmakers||{}).forEach(([bk,ms])=>{
          (Array.isArray(ms)?ms:[]).forEach(m=>{
            const n=String(m&&m.name||"").trim();if(!n)return;
            S._markets=S._markets||{};
            (S._markets[n]=S._markets[n]||new Set()).add(bk);
          });});});
      if(rows.length&&!S._sampled){S._sampled=true;
        log("keys on row: "+Object.keys(rows[0]||{}).join(", "));}
      rows.forEach(rw=>{
        const id=rw.eventId||rw.id;
        const ev=chunk.find(e=>String(e.id||e.eventId)===String(id))||{};
        const books=normaliseBooks(rw);
        if(!books.length)return;
        out.push({home:rw.home||ev.home,away:rw.away||ev.away,
          commence:rw.date||ev.date,bookmakers:books});
      });
    }
    /* report the catalogue, flagging anything player-level */
    const mk=S._markets||{};
    const names=Object.keys(mk).sort();
    log(`markets available (${names.length}):`);
    const PLAYER=/scorer|to score|assist|player|shots|card|anytime|first goal|goalscorer/i;
    const players=names.filter(n=>PLAYER.test(n));
    names.forEach(n=>log(`   ${PLAYER.test(n)?"★ ":"  "}${n}  [${[...mk[n]].join(", ")}]`));
    log(players.length?`player-level markets: ${players.length} — ${players.join(" | ")}`
      :"player-level markets: NONE returned by this tier");
    log(`usable fixtures with prices: ${out.length}`);
    if(out.length){
      S.oddsMarkets=Object.fromEntries(Object.entries(S._markets||{})
        .map(([k,v])=>[k,[...v]]));
      S.odds=out;S.oddsState="ok";
      LS.set("oddsCache",{t:Date.now(),odds:out});
      buildOddsTeams();buildModel();render();return;
    }
    S.oddsState=S.oddsErr?"fail":"empty";render();
  }catch(e){
    S.oddsErr=String(e.message||e)+" — this looks like a network or CORS failure";
    S.oddsState="fail";render();
  }
}
/* The v3 odds payload has been nested differently in every example I could
   find, so rather than assume a shape this walks the response looking for what
   a price actually is: a number between 1.01 and 100 sitting under a key that
   names a match outcome. That survives the payload being reorganised. */
/* Written against a real odds-api.io response rather than inferred:
     bookmakers: { "Paddy Power": [ { name:"ML", odds:[ {home:"2.40",draw:"3.50",away:"2.75"} ] }, … ] }
   Prices arrive as strings, and each market is an array of odds lines — a
   handicap market has one line per line value. */
function normaliseBooks(row){
  const num=v=>{const n=parseFloat(v);return isFinite(n)&&n>1.005&&n<200?n:0;};
  const MARKET={ml:"h2h","1x2":"h2h","match odds":"h2h","moneyline":"h2h",
    "both teams to score":"btts","totals":"totals","over/under":"totals",
    "draw no bet":"dnb","double chance":"dc"};
  const books=[];
  const src=row&&row.bookmakers;
  if(!src||typeof src!=="object")return books;
  Object.entries(src).forEach(([bookName,markets])=>{
    if(!Array.isArray(markets))return;
    const out=[];
    markets.forEach(m=>{
      const raw=String(m&&m.name||"").trim();
      const key=MARKET[raw.toLowerCase()]||raw.toLowerCase();
      const lines=Array.isArray(m&&m.odds)?m.odds:[];
      /* A market arrives as an array of lines. Two-sided markets put both
         prices on one line; Correct Score and the player markets put one
         selection per line, so those are merged into a single market rather
         than discarded for having a lone outcome. */
      const merged=[];
      lines.forEach(line=>{
        if(!line||typeof line!=="object")return;
        const outcomes=[];
        Object.entries(line).forEach(([k,v])=>{
          if(k==="hdp")return;                 // the handicap or total, not a price
          const price=num(v);
          if(price)outcomes.push({name:k,price});
        });
        if(!outcomes.length)return;
        if(line.hdp!==undefined&&outcomes.length>=2)
          out.push({key,hdp:line.hdp,outcomes,updated:m.updatedAt});
        else if(outcomes.length>=2&&merged.length===0)
          out.push({key,hdp:line.hdp,outcomes,updated:m.updatedAt});
        else merged.push(...outcomes);
      });
      if(merged.length)out.push({key,outcomes:merged,updated:m.updatedAt});
    });
    if(out.length)books.push({key:bookName,markets:out});
  });
  return books;
}
/* keep a trimmed sample of the raw response so an unfamiliar shape can be
   inspected rather than guessed at */
function sampleJSON(o){
  try{
    const t=JSON.stringify(o);
    return t.length>1400?t.slice(0,1400)+" …":t;
  }catch(e){return "(not serialisable)";}
}

function oddsHTML(){
  const g=VG();
  const head=`<div class="panel"><div class="phead"><h2>Odds</h2>
     <span style="display:flex;gap:6px"><button onclick="act('odds')">${S.oddsState==="loading"?"…":"↻ Fetch"}</button>
       <button onclick="act('oddsreset')" title="Clear the cached league and refetch">Reset</button></span></div>
    <div class="pbody">
      <p class="note" style="margin:0 0 8px">Uses <a href="https://odds-api.io" target="_blank" style="color:var(--cyan)">odds-api.io</a>. Your key stays in this browser. Prices are cached for four hours and shown with the bookmaker's margin removed — both available books are recreational, so treat these as a second opinion rather than truth.</p>
      <span class="pricebox"><input type="password" placeholder="Paste your odds API key" value="${esc(S.oddsKey||"")}"
        onchange="act('oddskey',this.value)" style="flex:1"></span></div></div>`;
  if(S.oddsState==="idle")
    return head+`<div class="panel"><div class="pbody"><p class="note">Fetching current prices…</p></div></div>`;
  if(S.oddsState==="nokey"||!S.oddsKey)
    return head+`<div class="panel"><div class="pbody"><p class="note">No key set — everything else in the app works without one.</p></div></div>`;
  if(S.oddsState==="loading")
    return head+`<div class="panel"><div class="pbody"><p class="note">Fetching prices…</p></div></div>`;
  if(S.oddsState!=="ok")
    return head+`<div class="panel"><div class="pbody"><div class="warn">${S.oddsErr
      ? `<b>${esc(S.oddsErr)}</b>` : "The feed responded but returned nothing usable."}
      ${(S.oddsLog||[]).length?`<div class="mono" style="font-size:10.5px;margin-top:10px;opacity:.9;line-height:1.6">
        ${S.oddsLog.map(x=>esc(x)).join("<br>")}</div>`:""}</div>
      <span style="display:flex;gap:6px;margin-top:10px">
        <button class="pri" onclick="act('odds')">↻ Fetch now</button>
        <button onclick="act('oddsreset')">Reset league cache</button></span></div></div>`;

  const fixtures=oddsFixtures();
  const players=oddsPlayers();
  const pct=v=>Math.round(v*100)+"%";
  const owned=id=>(S.squad||[]).includes(id);

  /* ---- squad: what the market makes of your fifteen ---- */
  const sp=squadPlayers(), xi=startingXI();
  const teamFx={};fixtures.forEach(f=>{
    if(f.ht)teamFx[f.ht.id]=f;if(f.at)teamFx[f.at.id]=f;});
  const rows=sp.map(p=>{
    const fx=teamFx[p.team]||null;
    const rec=players[p.id]||null;
    const mkt=(fx||rec)?marketPoints(p,rec,fx):null;
    return{p,fx,rec,model:p.gw[g]?.pts||0,mkt,start:xi.includes(p)};
  });
  const capId=S.captain;
  const sum=k=>rows.filter(r=>r.start).reduce((a,r)=>a+(k==="model"?r.model:(r.mkt||0)),0)
    +(()=>{const c=rows.find(r=>r.p.id===capId&&r.start);
      return c?(k==="model"?c.model:(c.mkt||0)):0;})();
  const mdl=sum("model"), mkt=sum("mkt");
  const priced=rows.filter(r=>r.mkt!=null).length;
  const big=(v,c)=>`<span style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:30px;line-height:1;color:${c}">${v}</span>`;
  const delta=mkt-mdl;
  const squadPanel=`<div class="panel">
    <div class="phead"><h2>Your squad · market vs model</h2>
      <span class="note">GW${g} · ${priced} of 15 priced · captain doubled</span></div>
    <div class="pbody" style="display:flex;gap:22px;flex-wrap:wrap;align-items:flex-end;border-bottom:1px solid var(--ink3)">
      <span><span class="note" style="display:block">Model</span>${big(mdl.toFixed(1),"var(--mint)")}</span>
      <span><span class="note" style="display:block">Market</span>${big(mkt.toFixed(1),"var(--cyan)")}</span>
      <span><span class="note" style="display:block">Difference</span>
        ${big((delta>0?"+":"")+delta.toFixed(1),delta>0.5?"var(--mint)":delta<-0.5?"var(--red)":"var(--cream)")}</span>
      <span class="note" style="flex:1;min-width:180px">Sorted by disagreement — where the two views differ most is where a second look pays.</span>
    </div>
    <div class="scroll"><table class="sqtable"><thead><tr>
      <th style="text-align:left">Player</th><th style="text-align:right">Model</th>
      <th style="text-align:right">Market</th><th style="text-align:right">Diff</th>
      <th style="text-align:right">Score</th><th style="text-align:right">Assist</th>
      <th style="text-align:right">CS</th><th style="text-align:center">Fixture</th></tr></thead><tbody>
      ${rows.slice().sort((a,b)=>Math.abs((b.mkt??b.model)-b.model)-Math.abs((a.mkt??a.model)-a.model))
        .map(r=>{
        const d=r.mkt==null?null:r.mkt-r.model;
        const cs=r.fx&&r.p.pos<=3
          ? (r.fx.ht&&r.fx.ht.id===r.p.team?r.fx.goals.csHome:r.fx.goals.csAway) : null;
        const f0=r.p.gw[g]?.fixtures?.[0];
        return `<tr class="${r.start?"":"sub"}">
          <td class="nm"><span style="display:flex;align-items:center;gap:7px">
            ${shirtSVG(r.p.teamName.toUpperCase(),r.p.pos===1,20)}
            <span><b>${esc(r.p.web_name)}</b>${r.p.id===capId?'<span class="tag c">C</span>':""}
            <span style="display:block;font-size:9.5px;color:var(--mute)">${esc(r.p.teamName)} · ${POS[r.p.pos]}</span></span></span></td>
          <td class="mono" style="text-align:right;color:var(--mint)">${r.model.toFixed(1)}</td>
          <td class="mono" style="text-align:right;color:${r.mkt==null?"var(--mute)":"var(--cyan)"}">${r.mkt==null?"—":r.mkt.toFixed(1)}</td>
          <td class="mono" style="text-align:right;font-weight:700;color:${d==null?"var(--mute)":d>0.4?"var(--mint)":d<-0.4?"var(--red)":"var(--cream)"}">${d==null?"—":(d>0?"+":"")+d.toFixed(1)}</td>
          <td class="mono" style="text-align:right">${r.rec&&r.rec.goal?pct(r.rec.goal):"—"}</td>
          <td class="mono" style="text-align:right">${r.rec&&r.rec.assist?pct(r.rec.assist):"—"}</td>
          <td class="mono" style="text-align:right">${cs!=null?pct(cs):"—"}</td>
          <td style="text-align:center;white-space:nowrap">${f0?fdrPill(f0.opp,f0.home,posDiff(r.p,f0),{short:true}):"—"}</td></tr>`;}).join("")}
    </tbody></table></div></div>`;

  /* ---- attack ---- */
  const teamAtt=[];
  fixtures.forEach(f=>{
    if(f.ht)teamAtt.push({t:f.ht,xg:f.goals.xgHome,opp:f.at,home:true,f});
    if(f.at)teamAtt.push({t:f.at,xg:f.goals.xgAway,opp:f.ht,home:false,f});});
  teamAtt.sort((a,b)=>b.xg-a.xg);
  const plist=Object.values(players).filter(r=>r.ret||r.goal||r.assist)
    .sort((a,b)=>(b.ret||b.goal||0)-(a.ret||a.goal||0));
  const attCol=`<div class="panel"><div class="phead"><h2 style="color:var(--amber)">Attack</h2>
      <span class="note">${teamAtt.length} teams · ${plist.length} players priced</span></div>
    <div class="dashrow" onclick="act('dash','oxg')"><span class="dkey">Team goals</span>
      <span class="dval">${teamAtt.length?esc(teamAtt[0].t.short)+" "+teamAtt[0].xg.toFixed(2):"—"}</span>
      <span class="dchev">${S.dash.oxg?"▲":"▼"}</span></div>
    ${S.dash.oxg?`<div class="dashbody">${teamAtt.map(x=>`<div class="dline">
      <span>${shirtSVG(x.t.short.toUpperCase(),false,18)} <b>${esc(x.t.short)}</b>
        <span class="note">${x.home?"v":"at"} ${esc(x.opp?x.opp.short:"?")}</span></span>
      <span class="mono" style="color:var(--amber);font-weight:700">${x.xg.toFixed(2)}</span></div>`).join("")}</div>`:""}
    <div class="dashrow" onclick="act('dash','oret')"><span class="dkey">Score or assist</span>
      <span class="dval">${plist.length?esc(plist[0].p.web_name)+" "+pct(plist[0].ret||plist[0].goal):"—"}</span>
      <span class="dchev">${S.dash.oret?"▲":"▼"}</span></div>
    ${S.dash.oret!==false?`<div class="dashbody">
      <table class="sqtable"><thead><tr><th style="text-align:left">Player</th>
        <th style="text-align:right">Ret</th><th style="text-align:right">Goal</th>
        <th style="text-align:right">Asst</th><th style="text-align:right">SoT</th></tr></thead><tbody>
      ${plist.slice(0,40).map(r=>`<tr class="${owned(r.p.id)?"":""}" style="${owned(r.p.id)?"background:rgba(45,220,135,.08)":""}">
        <td class="nm"><span style="display:flex;align-items:center;gap:6px">
          ${shirtSVG(r.p.teamName.toUpperCase(),r.p.pos===1,18)}
          <span><b>${esc(r.p.web_name)}</b>${owned(r.p.id)?' <span class="tag c">✓</span>':""}
          <span style="display:block;font-size:9px;color:var(--mute)">${esc(r.p.teamName)} · ${POS[r.p.pos]} · £${r.p.price.toFixed(1)}</span></span></span></td>
        <td class="mono" style="text-align:right;color:var(--amber);font-weight:700">${r.ret?pct(r.ret):"—"}</td>
        <td class="mono" style="text-align:right">${r.goal?pct(r.goal):"—"}</td>
        <td class="mono" style="text-align:right">${r.assist?pct(r.assist):"—"}</td>
        <td class="mono" style="text-align:right;color:var(--mute)">${r.sot?pct(r.sot):"—"}</td></tr>`).join("")}
      </tbody></table></div>`:""}</div>`;

  /* ---- defence ---- */
  const cs=[];
  fixtures.forEach(f=>{
    if(f.ht)cs.push({t:f.ht,p:f.goals.csHome,conc:f.goals.xgAway,opp:f.at,home:true});
    if(f.at)cs.push({t:f.at,p:f.goals.csAway,conc:f.goals.xgHome,opp:f.ht,home:false});});
  cs.sort((a,b)=>b.p-a.p);
  const keepers=cs.map(x=>{
    const gk=(S.model.players||[]).filter(p=>p.pos===1&&p.team===x.t.id&&p.xMins>50)[0];
    return gk?{...x,gk}:null;}).filter(Boolean);
  const cards=Object.values(players).filter(r=>r.card).sort((a,b)=>b.card-a.card);
  const defCol=`<div class="panel"><div class="phead"><h2 style="color:var(--sky)">Defence</h2>
      <span class="note">${cs.length} teams priced</span></div>
    <div class="dashrow" onclick="act('dash','ocs')"><span class="dkey">Clean sheet</span>
      <span class="dval">${cs.length?esc(cs[0].t.short)+" "+pct(cs[0].p):"—"}</span>
      <span class="dchev">${S.dash.ocs!==false?"▲":"▼"}</span></div>
    ${S.dash.ocs!==false?`<div class="dashbody">${cs.map(x=>`<div class="dline">
      <span>${shirtSVG(x.t.short.toUpperCase(),false,18)} <b>${esc(x.t.short)}</b>
        <span class="note">${x.home?"v":"at"} ${esc(x.opp?x.opp.short:"?")} · concede ${x.conc.toFixed(2)}</span></span>
      <span class="mono" style="color:var(--sky);font-weight:700">${pct(x.p)}</span></div>`).join("")}</div>`:""}
    <div class="dashrow" onclick="act('dash','ogk')"><span class="dkey">Goalkeepers</span>
      <span class="dval">${keepers.length?esc(keepers[0].gk.web_name)+" "+pct(keepers[0].p):"—"}</span>
      <span class="dchev">${S.dash.ogk?"▲":"▼"}</span></div>
    ${S.dash.ogk?`<div class="dashbody">${keepers.map(x=>`<div class="dline">
      <span><b>${esc(x.gk.web_name)}</b>${owned(x.gk.id)?' <span class="tag c">✓</span>':""}
        <span class="note">${esc(x.t.short)} · £${x.gk.price.toFixed(1)} · faces ${x.conc.toFixed(2)} xG</span></span>
      <span class="mono" style="color:var(--sky);font-weight:700">${pct(x.p)}</span></div>`).join("")}</div>`:""}
    <div class="dashrow" onclick="act('dash','ocard')"><span class="dkey">Booking risk</span>
      <span class="dval">${cards.length?esc(cards[0].p.web_name)+" "+pct(cards[0].card):"none priced"}</span>
      <span class="dchev">${S.dash.ocard?"▲":"▼"}</span></div>
    ${S.dash.ocard?`<div class="dashbody">${cards.slice(0,20).map(r=>`<div class="dline">
      <span><b>${esc(r.p.web_name)}</b>${owned(r.p.id)?' <span class="tag c">✓</span>':""}
        <span class="note">${esc(r.p.teamName)} · ${POS[r.p.pos]}</span></span>
      <span class="mono" style="color:var(--red)">${pct(r.card)}</span></div>`).join("")
        ||`<p class="note" style="margin:0">Not priced by your bookmakers.</p>`}</div>`:""}</div>`;

  const cat=S.oddsMarkets&&Object.keys(S.oddsMarkets).length
    ? `<div class="panel"><div class="phead" style="cursor:pointer" onclick="act('dash','omk')">
        <h2>Markets returned</h2><span class="note">${Object.keys(S.oddsMarkets).length} ${S.dash.omk?"▲":"▼"}</span></div>
      ${S.dash.omk?`<div class="pbody"><div style="display:flex;gap:6px;flex-wrap:wrap">
        ${Object.entries(S.oddsMarkets).sort().map(([n,bks])=>{
          const pl=/scorer|to score|assist|player|shots|card|anytime/i.test(n);
          return `<span class="chipbtn" style="${pl?"border-color:var(--mint);color:var(--mint)":""}"
            title="${esc(bks.join(", "))}">${esc(n)}</span>`;}).join("")}</div></div>`:""}</div>` : "";

  return head+squadPanel
    +`<div class="sqgrid">
        <div class="${S.oddsView==="def"?"hideSm":""}">${attCol}</div>
        <div class="${S.oddsView==="att"||!S.oddsView?"hideSm":""}">${defCol}</div>
      </div>
      <div class="sqtoggle">
        <button class="${(S.oddsView||"att")==="att"?"on":""}" onclick="act('oddsview','att')">Attack</button>
        <button class="${S.oddsView==="def"?"on":""}" onclick="act('oddsview','def')">Defence</button>
      </div>`+cat;
}

function rivalsHTML(){
  const g=S.model.next.id;
  const list=(S.rivals||[]);
  const mine=squadPlayers();
  const myIds=new Set(S.squad||[]);
  const panel=`<div class="panel"><div class="phead"><h2>Leagues &amp; rivals</h2></div>
    <div class="pbody">
      <p class="note" style="margin:0 0 9px">League <b style="color:var(--cream)">${esc(S.leagueId||"391690")}</b> — live standings need the official API, which the browser can't reach. Add rivals by team ID and paste their squad once — everything below then updates from the same projections your own squad uses.</p>
      <span class="pricebox">
        <input placeholder="Rival name" id="rvName" style="flex:1">
        <input placeholder="Team ID" id="rvId" style="width:110px">
        <button onclick="act('addrival')">Add</button></span>
      ${list.length?`<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:9px">
        ${list.map((r,i)=>`<button class="chipbtn ${S.rivalSel===i?"on":""}" onclick="act('selrival',${i})">${esc(r.name)}</button>`).join("")}
        </div>`:""}
    </div></div>`;
  const sel=list[S.rivalSel];
  if(!sel){
    const mine2=squadPlayers();
    if(!mine2.length)return panel;
    const demo=S.model.players.filter(p=>!(S.squad||[]).includes(p.id)&&p.avail>0)
      .sort((a,b)=>(b.gw[g]?.pts||0)-(a.gw[g]?.pts||0)).slice(0,6);
    return panel+`<div class="panel"><div class="phead"><h2>Sample rival</h2>
        <span class="note">layout preview · add a real rival above</span></div>
      <div class="stats" style="padding-top:12px">
        <div class="stat"><div class="k">You</div><div class="v" style="color:var(--mint)">${weekPts().toFixed(1)}</div></div>
        <div class="stat"><div class="k">Sample rival</div><div class="v">${(weekPts()*0.94).toFixed(1)}</div></div>
        <div class="stat"><div class="k">Swing</div><div class="v" style="color:var(--mint)">+${(weekPts()*0.06).toFixed(1)}</div></div>
      </div></div>
      <div class="panel"><div class="phead"><h2 style="color:var(--amber)">Players they'd own that you don't</h2></div>
      ${demo.map(p=>`<div class="prow" style="cursor:default">${shirtSVG(p.teamName.toUpperCase(),p.pos===1,24)}
        <span style="flex:1;min-width:0"><span style="display:flex;gap:5px;align-items:center">
          <span style="font-size:12.5px;font-weight:600">${esc(p.web_name)}</span>${sigHTML(p,g)}</span>
          <span style="display:block;font-size:9.5px;color:var(--mute)">${esc(p.teamName)} · £${p.price.toFixed(1)} · ${p.owned.toFixed(1)}% owned</span></span>
        <span class="mono" style="color:var(--mint);font-weight:700">${(p.gw[g]?.pts||0).toFixed(1)}</span></div>`).join("")}</div>`;
  }
  const theirs=(sel.squad||[]).map(id=>S.model.players.find(p=>p.id===id)).filter(Boolean);
  if(!theirs.length)
    return panel+`<div class="panel"><div class="phead"><h2>${esc(sel.name)}</h2></div>
      <div class="pbody"><p class="note">No squad stored. Paste their 15 player names, comma separated.</p>
        <span class="pricebox" style="margin-top:8px">
          <input placeholder="Raya, Calafiori, …" id="rvSquad" style="flex:1">
          <button onclick="act('rivalsquad')">Save</button></span></div></div>`;
  const theirIds=new Set(theirs.map(p=>p.id));
  const myDiff=mine.filter(p=>!theirIds.has(p.id));
  const theirDiff=theirs.filter(p=>!myIds.has(p.id));
  const score=a=>{const xi=[...a].sort((x,y)=>(y.gw[g]?.pts||0)-(x.gw[g]?.pts||0)).slice(0,11);
    return xi.reduce((s,p)=>s+(p.gw[g]?.pts||0),0)+(xi[0]?.gw[g]?.pts||0);};
  const row=p=>`<div class="prow" style="cursor:default">${shirtSVG(p.teamName.toUpperCase(),p.pos===1,24)}
    <span style="flex:1;min-width:0"><span style="display:flex;gap:5px;align-items:center">
      <span style="font-size:12.5px;font-weight:600">${esc(p.web_name)}</span>${sigHTML(p,g)}</span>
      <span style="display:block;font-size:9.5px;color:var(--mute)">${esc(p.teamName)} · £${p.price.toFixed(1)} · ${p.owned.toFixed(1)}% owned</span></span>
    <span class="mono" style="color:var(--mint);font-weight:700">${(p.gw[g]?.pts||0).toFixed(1)}</span></div>`;
  return panel+`<div class="panel"><div class="phead"><h2>${esc(sel.name)}</h2>
      <span class="note">GW${g} projection</span></div>
    <div class="stats" style="padding-top:12px">
      <div class="stat"><div class="k">You</div><div class="v" style="color:var(--mint)">${score(mine).toFixed(1)}</div></div>
      <div class="stat"><div class="k">${esc(sel.name)}</div><div class="v">${score(theirs).toFixed(1)}</div></div>
      <div class="stat"><div class="k">Swing</div>
        <div class="v" style="color:${score(mine)>=score(theirs)?"var(--mint)":"var(--red)"}">${(score(mine)-score(theirs)>=0?"+":"")}${(score(mine)-score(theirs)).toFixed(1)}</div></div>
    </div></div>
    <div class="panel"><div class="phead"><h2 style="color:var(--mint)">Your differentials</h2><span class="note">${myDiff.length}</span></div>
      ${myDiff.map(row).join("")||`<div class="pbody"><p class="note">Identical squads.</p></div>`}</div>
    <div class="panel"><div class="phead"><h2 style="color:var(--amber)">Theirs you don't own</h2><span class="note">${theirDiff.length}</span></div>
      ${theirDiff.map(row).join("")||`<div class="pbody"><p class="note">Nothing they own that you don't.</p></div>`}</div>`;
}

function newsHTML(){
  const cut=Date.now()-S.newsWindow*3600*1000;
  const sf=S.srcFilter, pf=S.playerFilter;
  const match=n=>(!sf||n.src===sf)&&(!pf||hits(n.title).includes(pf));
  const all=[...S.news,...S.reddit,...(S.squadNews||[])];
  const playerNames=new Set(squadPlayers().map(p=>p.web_name));
  const srcCount={};
  [...S.news,...S.reddit].forEach(n=>{if(!playerNames.has(n.src))srcCount[n.src]=(srcCount[n.src]||0)+1;});

  /* My team: newest mentions of the fifteen, from every source */
  const week=Date.now()-7*24*3600*1000;
  const mine=all.filter(n=>hits(n.title).length&&n.time>=week)
    .sort((a,b)=>b.time-a.time)
    .filter(n=>!pf||hits(n.title).includes(pf)).slice(0,S.expand.mine?40:10);
  /* Latest news: one item per source, newest first, no repeats */
  /* newest first, one per source until we run out of sources, then fill to ten */
  const seenSrc=new Set(),spread=[],overflow=[];
  S.news.filter(match).sort((a,b)=>b.time-a.time).forEach(n=>{
    if(seenSrc.has(n.src)){overflow.push(n);return;}
    seenSrc.add(n.src);spread.push(n);});
  while(spread.length<10&&overflow.length)spread.push(overflow.shift());
  spread.sort((a,b)=>b.time-a.time);
  if(!S.expand.news)spread.length=Math.min(spread.length,10);
  const red=S.reddit.filter(match).slice(0,10);
  const creators=CREATORS.slice(0,S.expand.creators?CREATORS.length:5);

  const ctrl=`<div class="panel"><div class="phead"><h2>News feed</h2>
     <span style="display:flex;gap:6px;align-items:center">
      ${[24,72,168].map(w=>`<button class="${S.newsWindow===w?"on":""}" onclick="act('nwin',${w})">${w===24?"24h":w===72?"3d":"7d"}</button>`).join("")}
      <button onclick="act('news')">${S.newsState==="loading"?"…":"↻"}</button></span></div>
     ${S.newsState==="idle"?`<div class="pbody"><button class="pri" onclick="act('news')">Load the feed</button></div>`:""}
     ${S.newsState==="loading"?`<div class="pbody"><p class="note">Reading the feeds…</p></div>`:""}
     ${S.newsState==="fail"?`<div class="pbody"><div class="warn">
       ${Object.keys(S.srcLog||{}).length?`<div class="mono" style="font-size:10px;margin-bottom:8px">${Object.entries(S.srcLog).map(([k,v])=>esc(k)+": "+v).join("<br>")}</div>`:""}No feed came back — the public CORS proxies are refusing right now. Squad data is unaffected.</div></div>`:""}
     ${S.newsState==="ok"?`<div class="pbody" style="border-top:1px solid var(--ink3);display:flex;flex-direction:column;gap:8px">
       <span style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
         <span style="font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--mute);font-weight:700;width:46px">Source</span>
         <button class="chipbtn ${sf?"":"on"}" onclick="act('srcf','')">All</button>
         ${Object.entries(srcCount).sort((a,b)=>b[1]-a[1]).slice(0,14)
           .map(([k,v])=>`<button class="chipbtn ${sf===k?"on":""}" onclick="act('srcf','${esc(k).replace(/'/g,"")}')">${esc(k)} ${v}</button>`).join("")}</span>
       <span style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
         <span style="font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--mute);font-weight:700;width:46px">Player</span>
         <button class="chipbtn ${pf?"":"on"}" onclick="act('plf','')">All</button>
         ${squadPlayers().map(p=>`<button class="chipbtn ${pf===p.web_name?"on":""}" onclick="act('plf','${esc(p.web_name).replace(/'/g,"")}')">${esc(p.web_name)}</button>`).join("")}</span>
       </div>`:""}</div>`;

  const creatorPanel=`<div class="panel"><div class="phead"><h2>Creators</h2></div>
     ${creators.map(([n,d,u])=>`<a class="item" href="${u}" target="_blank" rel="noopener">
       <div class="ttl">${n} <span style="color:var(--cyan)">↗</span></div><div class="meta">${d}</div></a>`).join("")}
     <button style="margin:10px 13px 13px" onclick="act('expand','creators')">${S.expand.creators?"Show fewer":"View more · "+(CREATORS.length-5)+" others"}</button></div>`;
  if(S.newsState!=="ok")return ctrl+creatorPanel;

  const myPanel=`<div class="panel" style="border-color:var(--mint);background:#10321F">
    <div class="phead" style="border-color:#1B5133"><h2 style="color:var(--mint)">My team</h2>
      <span class="note">${mine.length} mentioning your squad</span></div>
    ${mine.length?mine.map(n=>itemHTML(n,false)).join("")
      :`<div class="pbody"><p class="note">Nothing naming your fifteen yet.</p></div>`}
    ${mine.length>=10?`<button style="margin:10px 13px 13px" onclick="act('expand','mine')">${S.expand.mine?"Show fewer":"View more"}</button>`:""}</div>`;

  const newsPanel=`<div class="panel"><div class="phead"><h2>Latest FPL news</h2>
      <span class="note">${spread.length} sources</span></div>
    ${spread.length?spread.map(n=>itemHTML(n,false)).join(""):`<div class="pbody"><p class="note">Nothing in this window.</p></div>`}
    <button style="margin:10px 13px 13px" onclick="act('expand','news')">${S.expand.news?"One per source":"View more"}</button></div>`;

  const redPanel=`<div class="panel"><div class="phead"><h2>Hot on r/FantasyPL</h2>
      <span class="note">top ${red.length}</span></div>
    ${red.length?red.map(n=>itemHTML(n,true)).join(""):`<div class="pbody"><p class="note">Nothing loaded.</p></div>`}
    <a class="item" href="https://www.reddit.com/r/FantasyPL/hot/" target="_blank" rel="noopener"
       style="text-align:center;color:var(--cyan)">View more on Reddit ↗</a></div>`;

  return ctrl+myPanel+newsPanel+redPanel+creatorPanel;
}
function navHTML(){
  const cur=NAV.flatMap(g=>g.items).find(([k])=>k===S.tab);
  const label=cur?cur[1]:"Menu";
  return `
  <nav class="nav">
    <div class="navbar navwrap">
      ${NAV.map(gp=>`<div class="navgroup" style="border:none;background:none;padding:0">
        <span class="navlabel">${gp.group}</span>
        <span class="navitems">${gp.items.map(([k,n])=>
          `<a class="navlink ${S.tab===k?"on":""}" href="${routeFor(k)}" onclick="return go(event,'${k}')">${n}</a>`
        ).join("")}</span></div>`).join("")}
    </div>
    <div class="navmob">
      <span style="display:flex;gap:8px;align-items:center">
        <button class="navtoggle" onclick="act('menu')" style="flex:1">
          <span>${esc(label)}</span><span style="color:var(--mute)">${S.menuOpen?"▲":"▼"}</span></button>
</span>
      ${S.menuOpen?`<div class="navsheet">
        ${NAV.map(gp=>`<div class="navlabel" style="padding:8px 12px 4px">${gp.group}</div>
          ${gp.items.map(([k,n])=>`<a class="navlink ${S.tab===k?"on":""}" href="${routeFor(k)}"
             onclick="return go(event,'${k}')">${n}</a>`).join("")}`).join("")}
      </div>`:""}
    </div>
  </nav>`;
}
/* left-click routes in place; ctrl/cmd-click and long-press use the real href */
function go(ev,tab){
  if(ev.metaKey||ev.ctrlKey||ev.shiftKey||ev.button===1)return true;
  ev.preventDefault();
  S.menuOpen=false;
  history.pushState({},"",routeFor(tab));
  act('tab',tab);
  return false;
}
function render(){
  const app=document.getElementById("app");
  if(!S.model){
    app.innerHTML=`<div style="max-width:460px;margin:0 auto;padding:28px 4px">
      <h1 style="font-size:44px;line-height:.95;font-weight:800">FPL<br><span style="color:var(--mint)">Assistant</span></h1>
      <p class="note" style="margin-top:12px">Armitage Shanks · team 301830</p>
      <div class="panel" style="border-color:var(--mint);margin-top:18px"><div class="pbody">
        <p class="note" style="margin:0 0 10px">Loads players, prices, fixtures and last season's underlying stats straight from the FPL Core Insights dataset. No proxy, no downloads.</p>
        <button class="pri" style="width:100%" onclick="act('load')">${S.loading?esc(S.progress||"Loading…"):"Load data"}</button>
      </div></div>
      ${S.err?`<div class="warn" style="margin-top:12px">${esc(S.err)}</div>`:""}
      <p class="note" style="margin-top:14px">Data: <a href="https://github.com/olbauday/FPL-Core-Insights" target="_blank" style="color:var(--cyan)">FPL Core Insights</a>, refreshed twice daily.</p></div>`;
    return;
  }
  const g=VG();
  /* a flagged player counts as sold: value drops, bank rises by his selling price */
  const flaggedP=squadPlayers().filter(p=>S.flagged.includes(p.id));
  const raised=+flaggedP.reduce((a,p)=>a+sellPrice(p),0).toFixed(1);
  const sv=squadPlayers().filter(p=>!S.flagged.includes(p.id)).reduce((a,p)=>a+p.price,0);
  const bank=+(S.bank+raised).toFixed(1);
  const rating=teamRating();
  const tabs=NAV.flatMap(gp=>gp.items);
  let main="";
  if(S.tab==="squad"){
    const first=S.model.next.id;
    const hSlider=`<div class="chipbar" style="align-items:center;justify-content:space-between">
      <button onclick="act('vgw',${Math.max(first,g-1)})" ${g<=first?"disabled style=\"opacity:.35\"":""}>←</button>
      <span style="text-align:center">
        <span style="display:block;font-family:'Barlow Condensed';font-weight:700;font-size:18px;letter-spacing:.05em">
          GAMEWEEK ${g}${S.horizon>1?`–${g+S.horizon-1}`:""}</span>
        <span style="display:block;font-size:9.5px;color:var(--mute)">${g===first?"next deadline":`${g-first} week${g-first>1?"s":""} ahead`}${S.horizon>1?` · ${S.horizon}-week total`:""}</span></span>
      <button onclick="act('vgw',${Math.min(38,g+1)})" ${g>=38?"disabled style=\"opacity:.35\"":""}>→</button></div>`;
    const chipBarUnused=`<div class="chipzone">
      <span style="font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:#9E86C6;font-weight:700;width:100%;text-align:center">Play a chip</span>
      ${[["none","None"],["bboost","Bench Boost"],["3xc","Triple Captain"],["freehit","Free Hit"],["wildcard","Wildcard"]]
        .map(([k,n])=>{
          /* a chip is only lit on the gameweek it is actually assigned to */
          const on=k==="none" ? !chipForWeek(VG()) : chipForWeek(VG())===k;
          return `<button class="${on?"on":""}" onclick="act('achip','${k}')">${n}</button>`;}).join("")}</div>`;
    const flag="";
    const conf=S.pendingOpt?`<div class="panel" id="advice" style="border-color:var(--mint)">
      <div class="phead"><h2 style="color:var(--mint)">Transfer Advice</h2></div>
      <div class="pbody"><p class="note">Top ${S.pendingOpt.length} by predicted gain. Nothing changes until you confirm.</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;margin-top:8px">
          ${S.pendingOpt.map(m=>`<div><div style="font-size:9px;letter-spacing:.13em;text-transform:uppercase;
            color:var(--cyan);font-weight:700;margin-bottom:4px">${POS[m.out.pos]}</div>${swapCardHTML(m,g)}</div>`).join("")}</div>
        <button style="margin-top:10px" onclick="act('cancelopt')">Cancel</button></div></div>`:"";
    main=`<div class="grid2"><div>
      <div class="panel"><div class="phead"><h2>Planner</h2>

        <span style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="${S.compare?"on":""}" onclick="act('compare')">Compare</button>
          <button onclick="act('opt')">Optimise</button>
          <button onclick="act('reset')" style="background:var(--amber);color:#20130A;border-color:var(--amber);font-weight:800">Reset</button><button onclick="act('save')" style="background:var(--mint);color:var(--ink);border-color:var(--mint);font-weight:800">Save</button></span></div>
        <div class="gwbar">
          <button onclick="act('startgw',${Math.max(S.model.next.id,VG()-1)})" title="Earlier gameweek">←</button>
          <span style="text-align:center;min-width:112px">
            <span style="display:block;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);font-weight:700">GW${VG()} predicted</span>
            <span style="display:block;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:26px;line-height:1.05;color:var(--mint)">${weekPts().toFixed(1)}</span></span>
          <button onclick="act('startgw',${Math.min(38,VG()+1)})" title="Later gameweek">→</button>
        </div>

        <div style="position:relative">
          <span class="pitchctl"><span class="pseg">
            <button class="${S.sqView!=="list"?"on":""}" onclick="act('sqview','pitch')">Pitch</button>
            <button class="${S.sqView==="list"?"on":""}" onclick="act('sqview','list')">List</button></span></span>
          ${S.sqView==="list"?`<div style="padding-top:34px">${squadListHTML()}</div>`:pitchHTML()}
        </div>
        </div>
      <div class="panel chippanel">
        <div class="chiprow">
          <span class="chipinline">
            <span class="chiplbl">Chips</span>
            ${[["none","None"],["bboost","Bench Boost"],["3xc","Triple Capt"],["freehit","Free Hit"],["wildcard","Wildcard"]]
              .map(([k,n])=>{const on=k==="none"?!chipForWeek(VG()):chipForWeek(VG())===k;
                return `<button class="${on?"on":""}" onclick="act('achip','${k}')">${n}</button>`;}).join("")}
          </span></div></div>
      <div class="panel">${legendHTML()}</div>
      <div class="panel"><div class="phead"><h2>Squad dashboard</h2>
        <span class="note">GW${VG()}</span></div>${dashHTML()}</div>${conf}${flag}</div>
      <div class="poolcol">
        <div class="panel poolpanel"><div class="phead"><h2>Player Pool</h2>
        <button onclick="act('tab','table')">Full Player Data →</button></div>
        ${replHTML()}${filtersHTML(true)}<div class="plist">${listHTML()}</div>
        ${S.selected?`<div class="pbody" style="border-top:1px solid var(--ink3)">
          <span class="note" style="color:var(--mint)">Pick a replacement for ${esc(S.selected.web_name)}</span>
          <button style="margin-top:8px" onclick="act('cancel')">Cancel</button></div>`:""}</div></div></div>${S.compare?compareHTML():""}`;
  }
  else if(S.tab==="table")main=`<div class="panel"><div class="phead"><h2>Player Data</h2>
      <span class="note">${filtered("list").length} players · tap any column to sort</span></div>
    ${filtersHTML(false,'list')}
    <div class="pbody" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;border-bottom:1px solid var(--ink3)">
      <span style="font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--mute);font-weight:700">Show only</span>
      ${SIGDEF.map(([l,c,t],ix)=>`<button class="fbtn ${S.iconF.includes(ix)?"on":""}"
        onclick="act('iconf',${ix})" title="${t==="Stats caution"?"Hide players whose stats may be unreliable":esc(t)}" style="--fc:${c}">
        <span class="sig">${l}</span><span>${t==="Stats caution"?"Hide caution":esc(t)}</span></button>`).join("")}
      ${[["P","Penalties"],["F","Free kicks"],["C","Corners"]].map(([k,t])=>{const[b,c]=SPCOL[k];
        return `<button class="fbtn ${S.spF===k?"on":""}" onclick="act('spf','${k}')" style="--fc:${b}">
          <span class="sig">${badge(G(k,11),b,c)}</span><span>${t}</span></button>`;}).join("")}
      <button class="fbtn ${S.starOnly?"on":""}" onclick="act('staronly')" style="--fc:#FFB020">
        <span class="sig" style="color:#FFB020;font-size:14px">★</span>
        <span>Shortlist${S.stars.length?" ("+S.stars.length+")":""}</span></button>
    </div>
    <div class="pbody" style="display:flex;gap:16px;flex-wrap:wrap;border-bottom:1px solid var(--ink3)">
      <span style="flex:1;min-width:200px">
        <span style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--mute)">
          <span>Budget</span></span>
        <span class="pricebox" style="margin:4px 0">
          <input type="number" min="3.5" max="16" step="0.1" value="${S.lMax.toFixed(1)}" onchange="act('lmax',this.value)">
          <input type="range" min="3.5" max="16" step="0.1" value="${S.lMax}" oninput="act('lmax',this.value)" style="flex:1"></span>
      </span>
      <span style="flex:1;min-width:230px">
        <span style="font-size:10.5px;color:var(--mute)">Past stats — window</span>
        <span style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">
          ${[1,3,5,10,38].map(n=>`<button class="chipbtn ${(S.lWin||38)===n?"on":""}" onclick="act('lwin',${n})">${n===38?"Season":"Last "+n}</button>`).join("")}
        </span></span>
      <span style="flex:1;min-width:200px">
        <span style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--mute)">
          <span>Projected — gameweeks ahead</span></span>
        <span class="pricebox" style="margin:4px 0">
          <input type="number" min="1" max="8" step="1" value="${S.lHorizon}" onchange="act('lhorizon',this.value)">
          <input type="range" min="1" max="8" step="1" value="${S.lHorizon}" oninput="act('lhorizon',this.value)" style="flex:1"></span>
      </span></div>
    ${tableHTML()}</div>`;
  else if(S.tab==="xfpl")main=xfplHTML();
  else if(S.tab==="chips")main=chipsHTML();
  else if(S.tab==="transfers")main=transfersHTML();
  else if(S.tab==="fixtures")main=fixturesHTML();
  else if(S.tab==="odds")main=oddsHTML();
  else if(S.tab==="rivals")main=rivalsHTML();
  else if(S.tab==="news")main=newsHTML();

  app.innerHTML=`
   <div class="panel" style="background:linear-gradient(135deg,#161C26 0%,#10161E 55%,#0C0E12 100%);border-color:#2B3442">
    <div class="phead bare">
      <div style="display:flex;gap:11px;align-items:center">
        ${LOGO}
        <div><div style="font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--mint);font-weight:700">FPL Edge · Gameweek ${g}</div>
        <h1 style="font-size:29px">Armitage Shanks</h1>
        <div style="font-size:11px;color:var(--mute)">Andrew Kenny · team ${TEAM_ID}</div></div></div>
      <button class="pri" onclick="act('load')">${S.loading?esc(S.progress||"…"):"↻ Refresh"}</button></div>
    <div class="stats">
      <div class="stat"><div class="k">${S.horizon===1?`Predicted GW${VG()}`:`Predicted GW${VG()}–${Math.min(38,VG()+S.horizon-1)}`}</div>
        <div class="v" style="color:var(--mint)">${weekPts().toFixed(1)}</div>
        <div class="s">XI + captain${chipForWeek(VG())?" + "+chipForWeek(VG()):""}</div></div>
      <div class="stat"><div class="k">Team rating</div>
        <div class="v" style="color:${rating?(rating.pct>=85?"var(--mint)":rating.pct>=70?"var(--amber)":"var(--red)"):"var(--cream)"}">${rating?rating.pct:"—"}</div>
        <div class="s">${rating?`best legal XI ${rating.best.toFixed(1)}`:"out of 100"}</div></div>
      <div class="stat"><div class="k">Free transfers</div><div class="v">${S.ft}</div><div class="s">max 5 banked</div></div>
      <div class="stat"><div class="k">Overall rank</div>
        <div class="v">${S.entryRank?S.entryRank.toLocaleString():"—"}</div>
        <div class="s">${S.entryRank?"live":"from GW1"}</div></div>
      <div class="stat"><div class="k">Squad value</div><div class="v">£${sv.toFixed(1)}</div><div class="s">of £100.0</div></div>
      <div class="stat"><div class="k">In the bank</div><div class="v" style="color:${bank<0?"var(--red)":raised>0?"var(--mint)":"var(--cream)"}">£${bank.toFixed(1)}</div><div class="s">${raised>0?`incl. £${raised.toFixed(1)} from sales`:"to spend"}</div></div></div>
   </div>
   ${S.cardId?playerCardHTML():""}
   <div class="stick">
     <div class="ministats">
       ${LOGO}
       <span class="msrow">
         ${[["Predicted",weekPts().toFixed(1),"var(--mint)"],
            ["Rating",rating?rating.pct:"—",rating?(rating.pct>=85?"var(--mint)":rating.pct>=70?"var(--amber)":"var(--red)"):"var(--cream)"],
            ["Transfers",S.ft,"var(--cream)"],
            ["Rank",S.entryRank?S.entryRank.toLocaleString():"—","var(--cream)"],
            ["Value","£"+sv.toFixed(1),"var(--cream)"],
            ["Bank","£"+bank.toFixed(1),bank<0?"var(--red)":"var(--cream)"]]
           .map(([k,v,c])=>`<span class="mspill"><span class="msk">${k}</span>
             <span class="msv" style="color:${c}">${v}</span></span>`).join("")}
       </span>
       <span class="gwpill">
         <button onclick="act('startgw',${Math.max(S.model.next.id,VG()-1)})" aria-label="Earlier">←</button>
         <span class="gwv">GW${VG()}</span>
         <button onclick="act('startgw',${Math.min(38,VG()+1)})" aria-label="Later">→</button>
       </span>
     </div>
     ${navHTML()}</div>
   ${main}
   <p class="note" style="text-align:center;padding:14px 0">FPL Edge v${APP_VERSION} · data refreshed ${S.stamp?new Date(S.stamp).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"—"}</p>`;
}

