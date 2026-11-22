/* FPL Signals - app-odds.js
   bookmaker odds: fetching, de-vigging, the Odds page

   Part of a single script split across files so each stays small enough to
   fetch whole. Loaded in order as classic scripts, sharing one global scope,
   so the order in index.html matters: app-main.js must come last. */
/* ---------- Odds ----------
   Bookmaker prices are a live consensus model: they price form, team news,
   penalties and venue in one number. The odds-api.io key lives on the FPL
   Signals server (ODDS_API_KEY); the page only talks to /api/odds. */
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
  /* Player-prop markets (goalscorer, assists, cards) live on the fixture
     independently of whether Correct Score or the Match Winner market happened
     to parse — they used to be dropped together, silently discarding real player
     data whenever the goal-expectancy side failed. Only fixtures where NEITHER
     team could be identified are truly useless and dropped; everything else is
     kept with goals:null, and callers that specifically need expected-goals data
     (Attack, Defence, the clean-sheet/keeper panels) check for that themselves. */
  return (S.odds||[]).map(ev=>{
    const mk=marketsFor(ev);
    const ht=findTeam(ev.home), at=findTeam(ev.away);
    if(!ht&&!at)return null;
    const goals=fromCorrectScore(mk)||fromTotals(mk)||null;
    return{ev,mk,goals,ht,at,home:ev.home,away:ev.away,date:ev.commence||ev.date};
  }).filter(Boolean);
}
/* player prices, keyed to our own player records */
/* name words, accents and punctuation removed: "Gabriel dos Santos Magalhães" -> [gabriel,dos,santos,magalhaes] */
const nameWords=s=>foldName(s).split(/[^a-z]+/).filter(w=>w.length>1);
function wordMatch(label,p){
  const q=nameWords(label);if(q.length<2)return false;
  const first=nameWords(p.first),last=nameWords(p.last);
  if(!last.includes(q[q.length-1]))return false;
  return first.includes(q[0])||last.includes(q[0]);
}
function oddsPlayers(gw){
  const out={};
  /* gw given: that gameweek's fixtures only (the Odds page). Without it each
     player keeps his soonest priced fixture, so next week's prices never fold
     into this week's. */
  const inGw=gw&&S.model&&S.model.byEv?new Set((S.model.byEv[gw]||[]).filter(f=>f.ht&&f.at).map(f=>f.ht.id+"-"+f.at.id)):null;
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
      /* 19 Oct 2026: FPL carries long legal surnames ("Borges Fernandes",
         "dos Santos Magalhaes") that bookmakers shorten, so 12% of goalscorer
         names matched nobody (Bruno Fernandes, Gabriel, Zubimendi, Merino).
         Word by word: the bookmaker's last word must be one of his surname
         words, and the first word his first name or another surname word. */
      else if(wordMatch(name,p))sc=80;
      else if(last&&last.length>=4&&q.endsWith(last))sc=70+last.length;
      else if(last&&last.length>=4&&q.includes(last))sc=55+last.length;
      else if(web.length>=5&&q.includes(web))sc=40+web.length;
      if(sc>bestScore){bestScore=sc;best=p;}
    });
    return bestScore>=40?best:null;};
  const MK={"player to score or assist":"ret","anytime goalscorer":"goal",
    "player to assist":"assist","player shots on target":"sot",
    "player shots":"shots","player to be booked":"card"};
  oddsFixtures().slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).forEach(fx=>{
    if(inGw&&!(fx.ht&&fx.at&&inGw.has(fx.ht.id+"-"+fx.at.id)))return;
    const ids=[fx.ht&&fx.ht.id,fx.at&&fx.at.id].filter(Boolean);
    Object.entries(MK).forEach(([raw,key])=>{
      (fx.mk[raw]||[]).forEach(m=>{
        /* one-sided markets: strip roughly half the book's margin */
        const margin=Math.max(0,(m.outcomes||[]).reduce((a,o)=>a+1/o.price,0)/
          Math.max(1,(m.outcomes||[]).length)*0-0)+0.06;
        (m.outcomes||[]).forEach(o=>{
          if(!o.price)return;
          if(/\((first|last)\)/i.test(o.name))return;     // first / last scorer, not anytime
          /* Bet365 lists three lines per player in this market:
             "Name (Score) (2)", "Name (Assist) (2)", "Name (Score or Assist) (2)" */
          let k=key;
          const sub=raw==="player to score or assist"&&/\((score or assist|score|assist)\)/i.exec(o.name);
          if(sub)k={"score or assist":"ret",score:"goal",assist:"assist"}[sub[1].toLowerCase()];
          const pl=match(o.name.replace(/\s*\([^)]*\)/g,"").trim(),ids);if(!pl)return;
          if(out[pl.id]&&out[pl.id].fx!==fx)return;          // his soonest fixture only
          const rec=out[pl.id]=out[pl.id]||{p:pl,fx};
          const prob=devig1(o.price,margin);
          /* shots: several thresholds (1+, 2+), the likeliest is 1+. Otherwise
             two lines for the same thing agree within 2 points for 818 of 839
             players; where they do not (Bet365's Man City academy prices,
             19 Oct 2026) the lower is kept. */
          if(k==="sot"||k==="shots"){
            if(!rec[k]||prob>rec[k])rec[k]=prob;
          }else rec[k]=rec[k]==null?prob:Math.min(rec[k],prob);
        });
      });
    });
  });
  return out;
}
/* S10 (Stage 1, 19 Oct 2026): captain options from the XI. Gap is the cost
   against the best option (the armband doubles it); Plays is the chance he
   appears; League C is how many of the league captained him last week. */
function captaincyHTML(){
  const g=VG();if(!S.model||g<S.model.next.id)return "";
  const xi=startingXI();if(!xi.length)return "";
  const v=p=>p.gw[g]?.pts||0;
  const opts=xi.slice().sort((a,b)=>v(b)-v(a)).slice(0,6);
  const top=v(opts[0]);
  const rf=S.rivalsFeed||{},caps={};let nRiv=0;
  Object.entries(rf.entries||{}).forEach(([id,e])=>{if(id===TEAM_ID)return;
    const last=(e.gw||[])[(e.gw||[]).length-1];const c=last&&(last.picks||[]).find(x=>x.isC);
    nRiv++;if(c)caps[c.id]=(caps[c.id]||0)+1;});
  const {captain}=effectiveCaptainVice(g);
  /* research list (20 Oct 2026): scoring odds and haul chance beside each option */
  const mk={};try{Object.values(oddsPlayers(g)||{}).forEach(r=>{if(r&&r.p)mk[r.p.id]=r;});}catch(e){}
  return `<div class="panel"><div class="phead"><h2>Captaincy</h2><span class="note">GW${g} · your XI</span></div>
    <div class="pbody" style="padding-top:6px"><div class="scroll"><table class="mkt"><thead><tr><th>Option</th><th>Predicted</th><th>Gap</th><th>Plays</th><th>Scores</th><th>Haul</th>
      <th class="hide-ph">xGI/90</th><th class="hide-ph">Owned</th>${nRiv?"<th>League C</th>":""}<th></th></tr></thead><tbody>
    ${opts.map(p=>{const q=p.gw[g]||{},f=(q.fixtures||[])[0],gap=v(p)-top,isC=p.id===captain;
      return `<tr${isC?' class="me"':""}><td>${esc(p.web_name)}<span class="mu" style="display:block;font-size:11.5px">${f?esc(f.opp)+(f.home?" (H)":" (A)"):""}</span></td>
        <td><b>${v(p).toFixed(1)}</b></td><td>${Math.abs(gap)<0.05?'<span class="up">best</span>':`<span class="dn">${sgn1(gap*2)}</span>`}</td>
        <td>${Math.round((q.pPlay??1)*100)}%</td>
        <td>${(()=>{const m=mk[p.id],md=modelChance(p,p.xg90||0);return m&&m.goal!=null?`<span title="Bookmakers (model ${Math.round(md*100)}%)">${Math.round(m.goal*100)}%</span>`:`<span class="mu" title="Model: no price yet">${Math.round(md*100)}%</span>`;})()}</td>
        <td>${Math.round(haulChance(p)*100)}%</td><td class="hide-ph">${(p.xg90+p.xa90).toFixed(2)}</td><td class="hide-ph">${p.owned}%</td>
        ${nRiv?`<td>${caps[p.id]||0}/${nRiv}</td>`:""}
        <td>${isC?'<span class="tagy">C</span>':`<button class="mini" onclick="act('cap',${p.id})" aria-label="Make ${esc(p.web_name)} captain">C</button>`}</td></tr>`;}).join("")}
    </tbody></table></div>
    <details class="infotip"><summary><span class="infoi" aria-hidden="true">i</span>Reading this</summary><div class="infobox">
      <p style="margin:0">Gap is what each option costs against the best one with the armband on (the difference doubled). Plays is the chance he appears at all. Scores is the bookmakers' anytime-scorer chance where priced (grey: the model's own figure), if he plays. Haul is the model's chance of a 10-point week if he plays: two or more goals or assists for a midfielder or forward, a clean sheet plus a goal or assist for a defender or keeper. ${nRiv?"League C is how many of your league captained him last week: a popular pick protects your place, an unpopular one is the differential. ":""}Tap C to make him captain for this week.</p></div></details>
    </div></div>`;
}
/* D17: say so when the captain will not score as the armband suggests */
function capWarnHTML(){
  const g=VG();if(!S.model||g<S.model.next.id)return "";
  const xi=startingXI(),cap=S.model.players.find(p=>p.id===S.captain);
  if(!cap)return "";
  if(!xi.includes(cap))return ` · <span style="color:var(--red);font-weight:700">captain benched</span>`;
  const q=cap.gw[g];
  if(cap.avail<1||(q&&q.pPlay!=null&&q.pPlay<0.7))
    return ` · <span style="color:var(--amber);font-weight:700">captain ${cap.avail<1?Math.round(cap.avail*100)+"%":"may not start"}</span>`;
  return "";
}
/* Player odds per gameweek, for the PROP_W hook: {playerId:{gw:{g,a}}},
   g and a the expected goals and assists implied by P(score) and P(assist)
   (-ln(1-p)). A fixture is placed in its gameweek by matching both clubs. */
function buildPropMarket(){
  S.propMarket=null;
  if(!S.model||!S.model.byEv)return;
  const gwOf=fx=>{if(!fx.ht||!fx.at)return null;
    for(const [e,list] of Object.entries(S.model.byEv)){
      if(list.some(f=>f.ht&&f.at&&f.ht.id===fx.ht.id&&f.at.id===fx.at.id))return +e;}
    return null;};
  const out={};
  Object.values(oddsPlayers()).forEach(r=>{
    const e=gwOf(r.fx);if(!e||(r.goal==null&&r.assist==null))return;
    const lam=p=>p>0&&p<0.99?-Math.log(1-p):null;
    (out[r.p.id]=out[r.p.id]||{})[e]={g:lam(r.goal),a:lam(r.assist)};
  });
  S.propMarket=out;
}
/* Turn match prices into expected goals per side, margin removed. D10
   (13 Oct 2026): the same conversion the Odds page shows (Correct Score when
   priced, else match result + totals), so the page and the model agree. */
function buildOddsTeams(){
  const M={},rej=[];
  oddsFixtures().forEach(fx=>{
    const g=fx.goals,th=fx.ht,ta=fx.at;
    if(!g||!th||!ta||!(g.xgHome>0)||!(g.xgAway>0))return;
    /* A side priced under 1.10 is a stale or in-play line, not a pre-match
       market (13 Oct 2026 the feed had Coventry 1.03 v Newcastle 151). Such a
       fixture is left to the ratings and listed in S.oddsRejected. */
    const ml=fx.mk&&fx.mk.h2h&&fx.mk.h2h[0];
    const fav=ml?Math.min(...(ml.outcomes||[]).map(o=>+o.price||99)):99;
    if(fav<1.10){rej.push(fx.home+" v "+fx.away);return;}
    M[th.short+"|"+ta.short+"|H"]={xg:g.xgHome,xgc:g.xgAway};
    M[ta.short+"|"+th.short+"|A"]={xg:g.xgAway,xgc:g.xgHome};
  });
  S.oddsRejected=rej;
  S.oddsTeams=Object.keys(M).length?M:null;
  return S.oddsTeams;
}
/* The odds now come from this app's own server (/api/odds), which holds the
   odds-api.io key, looks the league slug up, reads the account's bookmaker
   selection and caches for four hours. Its rows carry the raw per-book
   object, so normaliseBooks runs on each row exactly as it did against the
   upstream API. Server states map one-to-one onto S.oddsState. */
async function loadOdds(){
  S.oddsState="loading";S.oddsErr="";S.oddsLog=[];render();
  try{
    if(BACKUP){S.oddsState="backup";render();return;}
    const r=await fetch("/api/odds");
    if(!r.ok)throw new Error("HTTP "+r.status);
    const d=await r.json();
    const state=d&&d.state;
    if(state==="nokey"){S.oddsState="nokey";render();return;}
    if(state==="loading"){
      S.oddsState="loading";
      S.oddsLog=["The server has not finished its first odds fetch yet. Try again in a minute."];
      render();return;
    }
    if(d.error)S.oddsErr=String(d.error);
    S.oddsFetchedAt=d.fetchedAt||null;
    const rows=Array.isArray(d.rows)?d.rows:[];
    /* the bookmakers behind the prices, for the coverage line */
    S.oddsBooks=[...new Set(rows.flatMap(r=>Object.keys((r&&r.bookmakers)||{})))].filter(n=>!/no latency/i.test(n));
    /* Catalogue every market the feed returns, as before. Player-level
       markets are often gated behind paid tiers, and the design of the Odds
       tab depends on whether they come through; one raw player-market line
       is kept so an unfamiliar shape can be inspected rather than guessed. */
    S._markets={};S._plSample=null;
    rows.forEach(rw=>{
      Object.entries(rw&&rw.bookmakers||{}).forEach(([bk,ms])=>{
        (Array.isArray(ms)?ms:[]).forEach(m=>{
          const n=String(m&&m.name||"").trim();if(!n)return;
          (S._markets[n]=S._markets[n]||new Set()).add(bk);
          if(!S._plSample&&/scorer|to score|assist|player|shots|card|anytime|goalscorer/i.test(n)){
            const arr=m.odds||m.outcomes||m.prices||m.selections||m.runners||m.lines;
            if(Array.isArray(arr)&&arr.length)
              S._plSample=`"${n}" line 1: ${JSON.stringify(arr[0]).slice(0,200)}`;
          }
        });});});
    const out=[];
    rows.forEach(rw=>{
      const books=normaliseBooks(rw);
      if(!books.length)return;
      out.push({home:rw.home,away:rw.away,commence:rw.commence,bookmakers:books});
    });
    if(state==="ok"&&out.length){
      S.oddsMarkets=Object.fromEntries(Object.entries(S._markets)
        .map(([k,v])=>[k,[...v]]));
      S.oddsPlSample=S._plSample||null;
      S.odds=out;S.oddsState="ok";
      buildOddsTeams();buildPropMarket();buildModel();render();return;
    }
    if(state==="fail"){
      if(!S.oddsErr)S.oddsErr="The server's last odds fetch failed.";
      S.oddsState="fail";
    }else S.oddsState="empty";
    render();
  }catch(e){
    S.oddsErr="Couldn't reach the server: "+String(e.message||e);
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
      /* Where a market's individual price lines live isn't consistent across
         providers — try every plausible field name rather than assume .odds. */
      const LINES_FIELDS=["odds","outcomes","prices","selections","runners","lines"];
      const linesField=LINES_FIELDS.find(f=>Array.isArray(m&&m[f]));
      const lines=linesField?m[linesField]:[];
      /* A market arrives as an array of lines. Two-sided markets put both
         prices on one line; Correct Score and the player markets put one
         selection per line, so those are merged into a single market rather
         than discarded for having a lone outcome. Each line's own shape also
         isn't consistent: sometimes the selection name IS the object key
         (e.g. {"Bukayo Saka":3.5}), sometimes it's an explicit field next to
         a separate price field (e.g. {name:"Bukayo Saka",price:3.5}) — both
         are handled so a naming-convention mismatch can't silently mislabel
         every outcome as the literal word "price". */
      const NAME_FIELDS=["name","player","selection","runner","outcome","label","participant"];
      const PRICE_FIELDS=["price","odds","value","decimal","dec"];
      const merged=[];
      lines.forEach(line=>{
        if(!line||typeof line!=="object")return;
        const outcomes=[];
        const nameField=NAME_FIELDS.find(f=>line[f]!=null);
        const priceField=PRICE_FIELDS.find(f=>num(line[f]));
        if(nameField&&priceField){
          outcomes.push({name:String(line[nameField]),price:num(line[priceField])});
        }else if(nameField&&num(line.over)){
          /* Player markets (19 Oct 2026): {label:"Dominic Solanke", hdp:0.5,
             over:"2.20"}. The price sits under "over" (the yes side), so the
             old reader named every player "over" and none ever matched. */
          outcomes.push({name:String(line[nameField]),price:num(line.over)});
        }else{
          Object.entries(line).forEach(([k,v])=>{
            if(k==="hdp"||k==="updatedAt"||NAME_FIELDS.includes(k)||PRICE_FIELDS.includes(k))return;
            const price=num(v);
            if(price)outcomes.push({name:k,price});
          });
        }
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
/* ---- Odds page panels (19 Oct 2026, built from the approved mock) ----
   Prices are shown for reference; they do not change the predictions (the
   GW1-6 backtest found no gain; re-test after GW11). Score and assist chances
   are "if he plays" (the bets are void if he does not); the model's figure
   beside each is worked out the same way: 1 - e^-(rate x normal minutes/90 x
   this fixture against his team's average). */
function modelChance(p,rate){
  const g=S.model.next.id,q=p.gw[g]||{},f=(q.fixtures||[])[0];
  const team=S.model.teams.find(t=>t.id===p.team)||{};
  const fr=f&&f.xgf>0&&team.att>0?f.xgf/team.att:1;
  return 1-Math.exp(-rate*Math.min(1,(p.roleMins||0)/90)*fr);
}
/* research list (20 Oct 2026): the chance of a haul (10+ points) if he plays.
   Goal involvements are Poisson with the same rate as modelChance; a
   midfielder or forward needs two, a defender or keeper a clean sheet plus
   one (or two on their own). */
function haulChance(p){
  const lam=-Math.log(Math.max(1e-9,1-modelChance(p,(p.xg90||0)+(p.xa90||0))));
  const p0=Math.exp(-lam),p1=lam*p0,two=1-p0-p1,one=1-p0;
  if(p.pos>=3)return two;
  const cs=modelCS(p)??0;
  return cs*one+(1-cs)*two;
}
/* the model's own clean-sheet chance, from the stats alone (the predictions
   also fold in the team odds, which would make this agree with the market by
   construction): fixture goals against, scaled by his on-pitch record */
function modelCS(p){
  const g=S.model.next.id,f=((p.gw[g]||{}).fixtures||[])[0];if(!f||f.xgc==null)return null;
  const team=S.model.teams.find(t=>t.id===p.team)||{},teamGA=((team.defH||0)+(team.defA||0))/2;
  const xGC=teamGA>0&&p.gc90>0?clamp(f.xgc*clamp(p.gc90/teamGA,0.75,1.33),.25,3.2):f.xgc;
  let cs=Math.exp(-xGC);
  if(p.pos===1&&p.gpRate)cs=clamp(cs*(1+clamp(p.gpRate,-0.25,0.25)),0.02,0.75);
  return cs;
}
/* the market's clean-sheet chance for each team in gameweek g */
function marketCS(g){
  const inGw=new Set((S.model.byEv[g]||[]).filter(f=>f.ht&&f.at).map(f=>f.ht.id+"-"+f.at.id)),m={};
  oddsFixtures().forEach(f=>{if(!f.goals||!f.ht||!f.at||!inGw.has(f.ht.id+"-"+f.at.id))return;
    m[f.ht.id]=f.goals.csHome;m[f.at.id]=f.goals.csAway;});
  return m;
}
function rivalsHTML(){
  const feed=S.rivalsFeed;
  const gNext=S.model.next.id, gLast=gNext-1;
  const mine=squadPlayers(), myIds=new Set(S.squad||[]);
  const pOf=id=>S.model.players.find(p=>p.id===id);
  const actOf=(id,gw)=>{const f=S.playerActuals&&(S.playerActuals[id]||S.playerActuals[String(id)]);
    const v=f?(f[gw]??f[String(gw)]):null;return v==null?null:+v;};

  if(BACKUP)return backupNote("Leagues and rivals");
  if(!feed||!feed.standings||!feed.standings.length){
    return `<div class="panel"><div class="phead"><h2>Leagues &amp; rivals</h2>
        <span class="note">league ${esc(S.leagueId||"391690")}</span></div>
      <div class="pbody"><p class="note" style="margin:0;color:var(--amber)">
        The league table and rival squads appear here once the rivals feed is published
        (same scheduled job as the actuals feed — it reads the official FPL API, which
        the browser can't reach directly).</p></div></div>`;
  }

  /* ---------- league table ---------- */
  const rows=[...feed.standings].sort((a,b)=>(a.rank||99)-(b.rank||99));
  const selId=S.rivalPick!=null?String(S.rivalPick)
    :String((rows.find(r=>String(r.entryId)!==String(TEAM_ID))||{}).entryId||"");
  const mv=r=>{if(r.lastRank==null||r.rank==null||r.lastRank===0)return "";
    const d=r.lastRank-r.rank;
    if(!d)return `<span style="color:var(--mute)">–</span>`;
    return `<span style="color:${d>0?"var(--mint)":"var(--red)"}">${d>0?"▲":"▼"}${Math.abs(d)}</span>`;};
  /* S9 (Stage 1, 19 Oct 2026): LiveFPL-style rows. Captain, chip, transfers
     and hits, bench points and how many of their XI you also own, all from
     the latest week in the rivals feed. */
  const lastOf=id=>{const e=(feed.entries||{})[id];const a=(e&&e.gw)||[];return a.length?a[a.length-1]:null;};
  const chipOf=(id,ev)=>{const e=(feed.entries||{})[id];const c=((e&&e.chips)||[]).find(x=>x.event===ev);return c?(c.label||c.name):null;};
  const table=`<div class="panel"><div class="phead"><h2>${esc(feed.leagueName||"League")}</h2>
      <span class="note">${esc(feed.leagueId||S.leagueId||"391690")} · GW${feed.lastEvent||gLast}</span></div>
    <div class="scroll"><table class="trktable"><thead><tr>
      <th>#</th><th></th><th>Team</th><th>GW</th><th>Total</th><th>Captain</th><th class="hide-ph">Chip</th><th class="hide-ph">Transfers</th><th class="hide-ph">Bench</th><th>Shared</th></tr></thead><tbody>
      ${rows.map(r=>{const isMe=String(r.entryId)===String(TEAM_ID);
        const isSel=String(r.entryId)===selId;
        return `<tr class="rvrow${isSel?" on":""}" ${isMe?"":`onclick="act('rivalpick','${r.entryId}')"`}
          style="${isMe?"":"cursor:pointer"}">
          <td style="text-align:left">${r.rank??"—"}</td>
          <td style="text-align:left">${mv(r)}</td>
          <td style="text-align:left">
            <span style="font-weight:700;color:${isMe?"var(--mint)":isSel?"var(--amber)":"var(--cream)"}">${esc(r.entryName||"—")}</span>
            <span style="display:block;font-size:10px;color:var(--mute)">${esc(r.manager||"")}${isMe?" · you":""}</span></td>
          <td>${r.gwPoints??"—"}</td><td><b>${r.totalPoints??"—"}</b></td>
          ${(()=>{const L=lastOf(r.entryId)||{},pk=L.picks||[],c=pk.find(x=>x.isC),cp=c&&pOf(c.id);
            const chip=chipOf(r.entryId,L.event);
            const shared=pk.filter(x=>x.multiplier>0&&myIds.has(x.id)).length;
            return `<td>${cp?esc(cp.web_name):"—"}</td>
              <td class="hide-ph">${chip?`<span class="tagy">${esc(chip)}</span>`:'<span class="mu">—</span>'}</td>
              <td class="hide-ph">${L.transfers??"—"}${L.transferCost?` <span class="dn">−${L.transferCost}</span>`:""}</td>
              <td class="hide-ph">${L.bench??"—"}</td>
              <td>${isMe?"—":(pk.length?shared+"/11":"—")}</td>`;})()}</tr>`;}).join("")}
    </tbody></table></div>
    <div class="pbody"><p class="note" style="margin:0">Tap a rival for their squad, chips, transfers and differentials. Shared is how many of their starting XI you also own.</p></div></div>`;

  /* ---------- league-wide summary ---------- */
  const entries=feed.entries||{};
  const latestGw=e=>{const a=(e&&e.gw)||[];return a.length?a[a.length-1]:null;};
  const picksOf=e=>{const r=latestGw(e);return (r&&r.picks)||[];};
  const others=Object.keys(entries).filter(k=>String(k)!==String(TEAM_ID));
  /* how many rivals own each player, to find threats and true differentials */
  const own={};
  others.forEach(k=>{picksOf(entries[k]).forEach(pk=>{const id=pk.id??pk;own[id]=(own[id]||0)+1;});});
  const threats=Object.keys(own).map(id=>({p:pOf(+id),n:own[id]}))
    .filter(x=>x.p&&!myIds.has(x.p.id))
    .sort((a,b)=>b.n-a.n||hPts(b.p,gNext,S.horizon)-hPts(a.p,gNext,S.horizon)).slice(0,8);
  const myUnique=mine.filter(p=>!own[p.id])
    .sort((a,b)=>hPts(b,gNext,S.horizon)-hPts(a,gNext,S.horizon));
  const moves=[];
  others.forEach(k=>{const r=latestGw(entries[k]);
    if(r&&r.transfers)moves.push({name:entries[k].name||k,n:r.transfers,cost:r.transferCost||0,diff:r.transferDiff});});
  moves.sort((a,b)=>b.n-a.n);

  const miniRow=(p,right,sub)=>`<div class="prow" style="cursor:pointer" onclick="act('card',${p.id})">
    ${shirtSVG(p.teamName.toUpperCase(),p.pos===1,22)}
    <span style="flex:1;min-width:0">
      <span style="font-size:12.5px;font-weight:600">${esc(p.web_name)}</span>
      <span style="display:block;font-size:10px;color:var(--mute)">${esc(p.teamName)} · £${p.price.toFixed(1)}${sub?" · "+sub:""}</span></span>
    <span class="mono" style="font-weight:700;color:var(--mint)">${right}</span></div>`;

  const summary=`<div class="rvsum">
    <div class="panel"><div class="phead"><h2 style="color:var(--amber)">Threats</h2>
        <span class="note">owned by rivals, not you</span></div>
      ${threats.length?threats.map(x=>miniRow(x.p,hPts(x.p,gNext,S.horizon).toFixed(1),
        `${x.n} of ${others.length} rivals`)).join(""):
        `<div class="pbody"><p class="note" style="margin:0">Nothing they own that you don't.</p></div>`}</div>
    <div class="panel"><div class="phead"><h2 style="color:var(--mint)">Your differentials</h2>
        <span class="note">no rival owns these</span></div>
      ${myUnique.length?myUnique.slice(0,8).map(p=>miniRow(p,hPts(p,gNext,S.horizon).toFixed(1),"unique to you")).join(""):
        `<div class="pbody"><p class="note" style="margin:0">Every player you own is owned by someone else too.</p></div>`}</div>
    <div class="panel"><div class="phead"><h2>Transfer activity</h2>
        <span class="note">GW${feed.lastEvent||gLast}</span></div>
      ${moves.length?`<div class="scroll"><table class="trktable"><thead><tr>
        <th>Team</th><th>Moves</th><th>Hit</th><th>Gain</th></tr></thead><tbody>
        ${moves.map(m=>`<tr><td>${esc(m.name)}</td><td>${m.n}</td>
          <td style="color:${m.cost?"var(--red)":"var(--mute)"}">${m.cost?"-"+m.cost:"0"}</td>
          <td style="color:${m.diff>0?"var(--mint)":m.diff<0?"var(--red)":"var(--mute)"}">${m.diff==null?"—":(m.diff>0?"+":"")+m.diff}</td></tr>`).join("")}
        </tbody></table></div>`:`<div class="pbody"><p class="note" style="margin:0">No transfers made in the league this week.</p></div>`}</div>
  </div>`;

  /* ---------- selected rival ---------- */
  const ent=entries[selId];
  if(!ent)return table+summary;
  const rowsGw=(ent.gw||[]);
  const lastRow=rowsGw.length?rowsGw[rowsGw.length-1]:null;
  const theirIds=picksOf(ent).map(pk=>pk.id??pk);
  const theirSet=new Set(theirIds);
  const theirs=theirIds.map(pOf).filter(Boolean);

  const upcoming=S.rivalGwView!=="last";
  const gShow=upcoming?gNext:(lastRow?lastRow.event:gLast);
  const val=p=>upcoming?hPts(p,gNext,S.horizon):(actOf(p.id,gShow)??0);
  const myDiff=mine.filter(p=>!theirSet.has(p.id)).sort((a,b)=>val(b)-val(a));
  const theirDiff=theirs.filter(p=>!myIds.has(p.id)).sort((a,b)=>val(b)-val(a));
  const sum=a=>a.reduce((s,p)=>s+val(p),0);
  const edge=sum(myDiff)-sum(theirDiff);

  const chips=(ent.chips||[]).slice().sort((a,b)=>(a.event||0)-(b.event||0));
  const stat=(k,v,c)=>`<div class="stat"><div class="k">${k}</div>
    <div class="v"${c?` style="color:${c}"`:""}>${v}</div></div>`;
  const capName=lastRow&&lastRow.captainId?(pOf(lastRow.captainId)||{}).web_name:null;

  const detail=`<div class="panel"><div class="phead"><h2>${esc(ent.name||selId)}</h2>
      <span class="note">${esc(ent.manager||"")} · GW${lastRow?lastRow.event:gLast}</span></div>
    <div class="stats" style="padding-top:12px">
      ${stat("GW points",lastRow?lastRow.points:"—","var(--mint)")}
      ${stat("Captain",capName?esc(capName):"—")}
      ${stat("Captain pts",lastRow&&lastRow.captainPts!=null?lastRow.captainPts:"—")}
      ${stat("Transfers",lastRow?`${lastRow.transfers??0}${lastRow.transferCost?` (-${lastRow.transferCost})`:""}`:"—")}
      ${stat("Transfer pts",lastRow&&lastRow.transferDiff!=null?(lastRow.transferDiff>0?"+":"")+lastRow.transferDiff:"—",
        lastRow&&lastRow.transferDiff>0?"var(--mint)":lastRow&&lastRow.transferDiff<0?"var(--red)":null)}
      ${stat("Free transfers",lastRow&&lastRow.ftAvailable!=null?lastRow.ftAvailable:"—","var(--amber)")}
    </div>
    <div class="pbody" style="border-top:1px solid var(--ink3)">
      <span class="note" style="display:block;margin-bottom:6px">Chips used</span>
      ${chips.length?`<div style="display:flex;gap:6px;flex-wrap:wrap">
        ${chips.map(c=>`<span class="rvchip">${esc(c.label||c.name)} · GW${c.event}${
          c.uplift!=null?` · <b style="color:${c.uplift>=0?"var(--mint)":"var(--red)"}">${c.uplift>=0?"+":""}${(+c.uplift).toFixed(1)}</b>`:""}</span>`).join("")}
        </div>`:`<p class="note" style="margin:0">No chips played yet.</p>`}
    </div></div>

    <div class="panel"><div class="phead"><h2>Head to head</h2>
        <span class="pseg">
          <button class="${upcoming?"on":""}" onclick="act('rivalgw','next')">GW${gNext} projected</button>
          <button class="${!upcoming?"on":""}" onclick="act('rivalgw','last')">GW${gShow} actual</button></span></div>
      <div class="stats" style="padding-top:12px">
        ${stat("Your differentials",sum(myDiff).toFixed(1),"var(--mint)")}
        ${stat("Their differentials",sum(theirDiff).toFixed(1),"var(--amber)")}
        ${stat("Edge",(edge>=0?"+":"")+edge.toFixed(1),edge>=0?"var(--mint)":"var(--red)")}
      </div>
      ${!upcoming&&!theirDiff.concat(myDiff).some(p=>actOf(p.id,gShow)!=null)?
        `<div class="pbody"><p class="note" style="margin:0">No actual points stored for GW${gShow} yet.</p></div>`:""}
    </div>

    <div class="rvsum">
      <div class="panel"><div class="phead"><h2 style="color:var(--mint)">Yours they don't own</h2>
          <span class="note">${myDiff.length}</span></div>
        ${myDiff.length?myDiff.slice(0,10).map(p=>miniRow(p,val(p).toFixed(1))).join(""):
          `<div class="pbody"><p class="note" style="margin:0">Identical squads.</p></div>`}</div>
      <div class="panel"><div class="phead"><h2 style="color:var(--amber)">Theirs you don't own</h2>
          <span class="note">${theirDiff.length}</span></div>
        ${theirDiff.length?theirDiff.slice(0,10).map(p=>miniRow(p,val(p).toFixed(1))).join(""):
          `<div class="pbody"><p class="note" style="margin:0">Nothing they own that you don't.</p></div>`}</div>
    </div>`;

  return table+summary+detail;
}

/* ============================================================
   NEWS (22 Nov 2026, Andy's v4 mock-up). A news page that leads with
   availability: Squad Watch (the fifteen at a glance: FPL's flag or the
   chance of starting, and how many stories name each), Top Stories
   (injury, return, transfer and team news first, then blanks and doubles
   and chip strategy, FPL articles last; the article's own picture, else
   the player on his club colour), the Injury Room (every FPL flag change
   in the league, from the one flag log) and Social Media (Ben Crellin
   pinned, the Creators' YouTube videos and Bluesky posts). Classes nw-.
   ============================================================ */
const NW_CAT={inj:["Injury","#FFB020",0],ret:["Return","#2DDC87",1],trf:["Transfer","#A78BFA",2],team:["Team News","#22D3EE",3],
  pc:["Press Conference","#7AA2FF",4],bgw:["Blanks & Doubles","#FF6B9A",5],chip:["Chip Strategy","#5EEAD4",6],fpl:["FPL","#9A9A9A",7],news:["News","#9A9A9A",8]};
const NW_FILTERS=[["all","All"],["inj","Injuries"],["ret","Returns"],["trf","Transfers"],["team","Team News"],["bgw","BGW/DGW"],["chip","Chips"],["fpl","FPL"]];
const nwTag=k=>{const c=NW_CAT[k]||NW_CAT.news;return `<span class="nw-tg" style="--tc:${c[1]}">${c[0]}</span>`;};
const nwAgo=t=>{const h=(Date.now()-t)/3600000;return h<1?Math.max(1,Math.round(h*60))+"m":h<24?Math.round(h)+"h":Math.round(h/24)+"d";};
const nwById=id=>(S.model.players||[]).find(p=>p.id===id);
const nwKit=p=>((KITS[p.teamName]||KITS._d||{b:"#444"}).b);
const nwFace=(p,cls)=>`<span class="nw-face ${cls||""}" style="--cc:${nwKit(p)}"><img alt="" src="${imgSrc("player",p.code)}" onerror="this.style.visibility='hidden'"></span>`;
const nwSquad=()=>new Set(S.squad||[]);
/* the player a story is mostly about: one of yours first */
function nwLead(n){const mine=nwSquad(),ids=n.ids||[];const id=ids.find(i=>mine.has(i))||ids[0];return id?nwById(id):null;}
/* every story in the window, one copy each, yours first, availability first */
function nwStories(){
  const cut=Date.now()-S.newsWindow*3600000,mine=nwSquad();
  const all=[...(S.news||[]),...(S.squadNews||[])].filter(n=>n.time>=cut);
  const rank=n=>((n.ids||[]).some(i=>mine.has(i))?0:10)+((NW_CAT[n.cat]||NW_CAT.news)[2]);
  return all.sort((a,b)=>rank(a)-rank(b)||b.time-a.time);
}
function nwThumb(n,big){
  const p=nwLead(n);
  if(n.img)return `<span class="nw-th img${big?" big":""}"><img alt="" src="${esc(safeUrl(n.img))}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('none')"></span>`;
  if(p)return `<span class="nw-th${big?" big":""}" style="--cc:${nwKit(p)}"><img class="pl" alt="" src="${imgSrc("player",p.code)}" onerror="this.style.visibility='hidden'"></span>`;
  return `<span class="nw-th none${big?" big":""}">${lic("newspaper",big?40:22)}</span>`;
}
const nwSrc=n=>`${esc(n.pub&&n.pub!==n.src?n.pub:n.src)} · ${nwAgo(n.time)}`;
function nwLeadHTML(n){
  const p=nwLead(n),mine=p&&nwSquad().has(p.id);
  const bg=n.img?`<img class="nw-lbg" alt="" src="${esc(safeUrl(n.img))}" referrerpolicy="no-referrer" onerror="this.remove()">`
    :p?`<img class="nw-lph" alt="" src="${imgSrc("player",p.code)}" onerror="this.remove()">`:"";
  return `<a class="nw-lead${n.img?" photo":""}" style="--cc:${p?nwKit(p):"#2A2A2A"}" href="${esc(safeUrl(n.url))}" target="_blank" rel="noopener">${bg}
    <div class="nw-lc">${nwTag(n.cat)}<h2>${esc(n.title)}</h2>${n.sum?`<p>${esc(n.sum)}</p>`:""}<span class="nw-src">${nwSrc(n)}${mine?` · <b>In your squad</b>`:""}</span></div></a>`;
}
function nwCardHTML(n){
  const p=nwLead(n),mine=p&&nwSquad().has(p.id);
  return `<a class="nw-card" href="${esc(safeUrl(n.url))}" target="_blank" rel="noopener">${nwThumb(n)}
    <div class="nw-cc">${nwTag(n.cat)}<h4>${esc(n.title)}</h4><span class="nw-src">${nwSrc(n)}${mine?`<i class="nw-own" title="In your squad"></i>`:""}</span></div></a>`;
}
/* Injury Room: every change in the flag log, newest first */
function nwChanges(){
  const F=(S.flags&&S.flags.players)||{},out=[];
  Object.entries(F).forEach(([id,rows])=>{const p=nwById(+id);if(!p)return;let prev=100;
    rows.forEach(r=>{const c=flagChance(r);if(c!==prev)out.push({p,a:prev,b:c,t:flagT(r),n:r.news||""});prev=c;});});
  return out.sort((a,b)=>b.t-a.t);
}
const nwBack=s=>{const m=/^(\d{2})-([A-Za-z]{3})$/.exec(s||"");return m?`Back ${+m[1]} ${m[2]}`:"";};
function nwIrRow(x){
  const mine=nwSquad().has(x.p.id),note=String(x.n||"").split(/\s+-\s+/)[0]||(x.b>=100?"Fit again":"");
  const back=nwBack(parseReturn(x.n));
  return `<button class="nw-ir" onclick="act('cardnews',${x.p.id})">${nwFace(x.p,"sm")}<span class="nw-who"><b>${esc(x.p.web_name)}${mine?`<i class="nw-own" title="In your squad"></i>`:""}</b><i>${esc(x.p.teamName)} · ${esc(note)}</i></span>
    <span class="nw-ch">${chPill(x.a)}<span class="fh-ar" style="color:${x.b>x.a?"var(--mint)":"var(--red)"}">${lic("arrow-right",12)}</span>${chPill(x.b)}</span>
    <span class="nw-bk">${back?`<b>${back}</b>`:""}<i>${nwAgo(x.t)}</i></span></button>`;
}
/* Social Media: one row shape for every kind */
function nwSoRow(n){
  const ini=s=>esc(String(s).split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase());
  const icon=n.kind==="pin"?`<span class="nw-av" style="--ac:#1D9BF0">BC</span>`
    :n.kind==="yt"?`<span class="nw-av" style="--ac:#FF0000">${lic("play",15)}</span>`
    :`<span class="nw-av" style="--ac:#0A7AFF">${ini(n.src)}</span>`;
  const meta=n.kind==="pin"?`${lic("calendar-days",12)}${esc(n.pub||"Fantasy Football Hub")}`:n.kind==="yt"?`${lic("play",12)}YouTube`:`${lic("cloud",12)}Bluesky`;
  return `<a class="nw-so${n.kind==="pin"?" pin":""}" href="${esc(safeUrl(n.url))}" target="_blank" rel="noopener">${icon}<div class="nw-sb"><span class="nw-sh"><b>${esc(n.kind==="pin"?"Ben Crellin":n.src)}</b><i>${nwAgo(n.time)}</i>${n.kind==="pin"?`<span class="nw-pin">${lic("pin",11)}Pinned</span>`:""}</span><p>${esc(n.title)}</p><span class="nw-se">${meta}</span></div></a>`;
}
const nwSeg=(opts,cur,action)=>`<span class="hz nw-seg">${opts.map(([k,l])=>`<button class="${cur===k?"on":""}" onclick="act('${action}','${k}')">${l}</button>`).join("")}</span>`;
function newsHTML(){
  const G=S.model.next.id,mine=nwSquad(),cut=Date.now()-S.newsWindow*3600000,day=Date.now()-86400000;
  const sq=squadPlayers();
  const stories=nwStories();
  const countFor=id=>stories.filter(n=>(n.ids||[]).includes(id)).length;
  /* ---- header ---- */
  const flagged=sq.filter(p=>p.avail<1),newToday=flagged.filter(p=>{const f=flagNow(p);return f&&f.since&&f.since>=day;}).length;
  const daysAgo=d=>Date.now()-d*86400000;
  const sqSeries=[6,5,4,3,2,1,0].map(d=>sq.filter(p=>{const c=flagAt(p,daysAgo(d));return c!=null&&c<100;}).length);
  const ch=nwChanges(),wk=daysAgo(7);
  /* C14 (audit, 22 Nov 2026): the 24h / 3d / 7d switch now sets every
     windowed part of the page (it only half-applied before) */
  const winLbl={24:"Today",72:"Last 3 Days",168:"This Week"}[S.newsWindow]||"This Week";
  const backList=ch.filter(x=>x.b>x.a&&x.t>=cut);void wk;
  const backSeries=[6,5,4,3,2,1,0].map(d=>backList.filter(x=>x.t>=daysAgo(d+1)&&x.t<daysAgo(d)).length);
  const trf=stories.filter(n=>n.cat==="trf"&&(n.ids||[]).some(i=>mine.has(i)));
  const trfBy={};trf.forEach(n=>n.ids.filter(i=>mine.has(i)).forEach(i=>{const p=nwById(i);if(p)trfBy[p.web_name]=(trfBy[p.web_name]||0)+1;}));
  const trfSeries=[6,5,4,3,2,1,0].map(d=>[...(S.news||[]),...(S.squadNews||[])].filter(n=>n.cat==="trf"&&(n.ids||[]).some(i=>mine.has(i))&&n.time>=daysAgo(d+1)&&n.time<daysAgo(d)).length);
  const src=Object.values(S.newsSources||{}),srcOk=src.filter(s=>s.ok).length;
  const head=`<div class="nw-hdr"><div><div class="cx-kick">GW${G}${S.newsFetchedAt?` · Updated ${esc(agoText(S.newsFetchedAt))}`:""}</div><h1>News</h1>
      <div class="nw-hbtn"><span class="hz">${[[24,"24h"],[72,"3d"],[168,"7d"]].map(([w,l])=>`<button class="${S.newsWindow===w?"on":""}" onclick="act('nwin',${w})">${l}</button>`).join("")}</span>
        <button class="cx-rpt" onclick="act('news')">${lic("refresh-cw",14)}${S.newsState==="loading"?"Loading…":"Refresh"}</button></div></div>
    <div class="nw-figs">
      ${figCard("Squad Flags","Your players with an FPL flag.",String(flagged.length),newToday?`<span class="dn">+${newToday}</span> today`:"None new today",sqSeries,"#FFB020")}
      ${figCard("Back "+winLbl,"Players whose FPL chance rose in this window.",String(backList.length),backSeries[6]?`<span class="up">+${backSeries[6]}</span> today`:"None today",backSeries,"#2DDC87")}
      ${figCard("Transfer Talk","Transfer stories naming your players.",String(trf.length),Object.entries(trfBy).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k,v])=>`${esc(k)} ${v}`).join(" · ")||"None",trfSeries,"#A78BFA")}
      ${figCard("Sources","Sources answering now; Status lists each one.",src.length?`${srcOk} of ${src.length}`:"–",src.length?(srcOk===src.length?"All live":`<span class="dn">${src.length-srcOk} down</span>`):"Not loaded",null)}
    </div></div>`;
  if(S.newsState==="backup")return head+backupNote("The news feed");
  /* ---- Squad Watch ---- */
  const sw=sq.map(p=>{const sc=startChance(p),k=countFor(p.id);
    const st=p.avail<1?"flag":(p.pos===1&&sc<15)?"bench":sc<60?"rot":"ok";
    return {p,sc,k,st};}).sort((a,b)=>({flag:0,rot:1,ok:2,bench:3}[a.st]-{flag:0,rot:1,ok:2,bench:3}[b.st])||b.k-a.k);
  const swTile=({p,sc,k,st})=>{const c=Math.round(p.avail*100);
    const lab=st==="flag"?`${lic("triangle-alert",11)}${c}%`:st==="bench"?"Back-up":`Start ${sc}%`;
    return `<button class="nw-sw ${st}" onclick="act('cardnews',${p.id})" title="${esc(st==="flag"?flagTitle(p):`${p.web_name}: ${sc}% chance of starting`)}">${nwFace(p,"sw")}<span class="nw-swn">${esc(p.web_name)}</span><span class="nw-swl ${st}">${lab}</span>${k?`<i class="nw-swk" title="${k} stories">${k}</i>`:""}</button>`;};
  const watch=`<section class="nw-watch"><div class="nw-wh"><span class="rhi">${lic("shirt",16)}</span><h3>Squad Watch</h3><button class="fci" data-tip="FPL's chance if flagged, else his chance of starting.">i</button>
    <span class="nw-wk"><i class="k1"></i>Flagged<i class="k2"></i>Rotation risk<i class="k3"></i>Stories</span></div>
    <div class="nw-sws">${sw.map(swTile).join("")}</div></section>`;
  /* ---- Top Stories ---- */
  const cat=S.nwCat||"all",inCat=n=>cat==="all"||n.cat===cat||(cat==="team"&&n.cat==="pc");
  const list=stories.filter(inCat);
  const leadI=Math.max(0,list.findIndex(n=>n.img||nwLead(n)));
  const lead=list[leadI],rest=list.filter((n,i)=>i!==leadI).slice(0,4);
  const top=rep("nwtop","newspaper","Top Stories","Availability news first; your players' stories lead.",
    S.newsState==="loading"&&!list.length?sgEmpty("Reading the feeds…"):S.newsState==="fail"?sgEmpty("The server returned no news. It checks every 15 minutes; the rest of the app is unaffected."):
    !lead?sgEmpty("No stories in this window."):`<div class="nw-top">${nwLeadHTML(lead)}<div class="nw-cards">${rest.map(nwCardHTML).join("")}</div></div>`,
    {extra:`<span class="nw-cat">${NW_FILTERS.map(([k,l])=>`<button class="${cat===k?"on":""}" onclick="act('nwcat','${k}')">${l}</button>`).join("")}</span>`});
  /* ---- Injury Room ---- */
  const irTab=S.nwIr||"chg";
  let irRows;
  if(irTab==="chg")irRows=ch.filter(x=>x.t>=cut).slice(0,40);
  else irRows=S.model.players.filter(p=>p.avail<1&&p.back&&p.back!=="unknown").map(p=>{const f=flagNow(p)||{};return {p,a:f.was!=null?f.was:100,b:Math.round(p.avail*100),t:f.since||Date.now(),n:p.news||""};})
    .sort((a,b)=>{const d=x=>{const m=/^(\d{2})-([A-Za-z]{3})$/.exec(x.p.back);return m?Date.parse(`${+m[1]} ${m[2]} ${new Date().getFullYear()}`):0;};return d(a)-d(b);}).slice(0,40);
  const injury=rep("nwir","heart-pulse","Injury Room","Every FPL flag change, newest first. Green dot: your player.",
    S.flags?(irRows.length?`<div class="nw-list nw-scroll">${irRows.map(nwIrRow).join("")}</div>`:sgEmpty(irTab==="chg"?"No flag changes in this window.":"No return dates from FPL right now.")):sgEmpty("Reading the flag log…"),
    {extra:nwSeg([["chg","Changes"],["back","Back Soon"]],irTab,"nwir")});
  /* ---- Social Media ---- */
  const so=S.nwSo||"all",soc=(S.social||[]);
  const pin=soc.filter(n=>n.kind==="pin").sort((a,b)=>b.time-a.time)[0];
  const others=soc.filter(n=>n.kind!=="pin"&&n.time>=cut&&(so==="all"||(so==="yt"?n.kind==="yt":n.kind==="bs")));
  const social=rep("nwso","users","Social Media","Ben Crellin pinned, then Creators' YouTube and Bluesky posts.",
    (pin||others.length)?`<div class="nw-list nw-scroll">${pin&&so==="all"?nwSoRow(pin):""}${(c=>others.filter(n=>(c[n.src]=(c[n.src]||0)+1)<=4))({}).slice(0,30).map(nwSoRow).join("")}</div>`:sgEmpty(S.newsState==="loading"?"Reading the feeds…":"Nothing posted yet."),
    {extra:nwSeg([["all","All"],["yt","Videos"],["bs","Posts"]],so,"nwso")});
  return `<div class="nw">${head}${watch}<div class="nw-body">${top}${injury}${social}</div></div>`;
}
/* the page links (the full bar is topbarHTML, drawn with the page) */
function navLinksHTML(){
  const home=NAV_HOME[S.tab]||S.tab;
  return `<nav class="tn" aria-label="Pages">${NAV.map(([k,n])=>`<a class="navlink ${home===k?"on":""}" href="${routeFor(k)}" onclick="return go(event,'${k}')">${n}</a>`).join("")}</nav>`;
}
function navHTML(){
  return `<header class="tb"><div class="tbin"><a class="brand" href="${routeFor("squad")}" onclick="return go(event,'squad')"><span class="bl">${LOGO}</span><span class="bw">FPL Signals</span></a>${navLinksHTML()}</div></header>`;
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
/* ---------- status chip and provenance footer ---------- */
/* The header chip replaces the old Refresh button: it reports the server's
   own /api/status and carries the Check now button, which runs the same
   loadAll the old button did. Green: everything fresh. Green pulsing: a
   fixture is in play and live points are flowing. Amber: a source is late or
   the server itself cannot be reached, with the last good copy's time. */
/* Cutover: what a server-only page says on the Pages backup */
function backupNote(what){
  return `<div class="panel"><div class="pbody"><p class="note" style="margin:0">${what} runs on the FPL Signals server only. This is the backup copy on GitHub Pages: the model, planner, chips, fixtures and signals work here from the public dataset.</p></div></div>`;
}
function statusState(){
  const st=S.status;
  let cls="",txt;
  if(BACKUP)return{cls:"wait",txt:`Backup copy on GitHub Pages · <b>loaded ${ukHHMM(S.stamp||Date.now())}</b>`,plain:"Backup copy on GitHub Pages"};
  if(S.statusPending&&!S.statusErr)txt=`Checking for updates · <b>last copy ${ukHHMM(S.statusAt||Date.now())}</b>`;
  else if(!st||S.statusErr){cls="wait";txt=`Server unreachable · <b>showing last copy</b>`;}
  else{
    const ds=st.dataset||{},fpl=st.fpl||{},feeds=st.feeds||{};
    const liveAge=agoMin(fpl.liveFetchedAt);
    if(ds.stale)txt=`Waiting on FPL Core Insights · <b>last good copy ${ukHHMM(ds.committedAt||ds.fetchedAt||Date.now())}</b>`,cls="wait";
    else if(fpl.error)txt=`Waiting on FPL · <b>last good copy ${ukHHMM(fpl.fetchedAt||Date.now())}</b>`,cls="wait";
    else if(feeds.error)txt=`Waiting on the feed builder · <b>last good copy ${ukHHMM(feeds.lastOk||Date.now())}</b>`,cls="wait";
    /* S4 (audit, 22 Nov 2026): age, not only errors. A job that hangs or a
       download that stalls never sets an error, so the dot stayed green while
       the data aged. FPL refreshes every 15 minutes, the feeds every 15, and
       the dataset lands about three times a day. */
    else if(agoMin(fpl.fetchedAt)!=null&&agoMin(fpl.fetchedAt)>45)txt=`FPL not refreshed · <b>last ${agoText(fpl.fetchedAt)}</b>`,cls="wait";
    else if(agoMin(feeds.lastOk)!=null&&agoMin(feeds.lastOk)>45)txt=`Feed builder not refreshed · <b>last ${agoText(feeds.lastOk)}</b>`,cls="wait";
    else if(agoMin(ds.committedAt)!=null&&agoMin(ds.committedAt)>26*60)txt=`FPL Core Insights not updated · <b>last ${agoText(ds.committedAt)}</b>`,cls="wait";
    else if(liveAge!=null&&liveAge<=10){cls="live";txt=`Live · <b>updated ${agoText(fpl.liveFetchedAt)}</b>`;}
    else txt=`Up to date · <b>checked ${S.statusAt?agoText(S.statusAt):"just now"}</b>`;
    /* S5: a feed build that finished with parts missing */
    if(feeds.warning&&!feeds.error){if(cls!=="wait")cls="wait";txt+=` · feed built with gaps`;}
    /* S3: an odds refresh that failed keeps the last prices but says so */
    if(st.odds&&st.odds.error){if(cls!=="wait")cls="wait";txt+=` · odds not refreshing`;}
  }
  /* a news source failing for over an hour turns the dot amber (Andy, 22 Nov 2026) */
  const nDown=newsDown();
  if(nDown.length&&!BACKUP&&st&&!S.statusErr){if(cls!=="wait")cls="wait";txt+=` · ${nDown.length} news source${nDown.length>1?"s":""} down`;}
  /* a part of the load that failed turns the dot amber too */
  if(!cls&&((S.loadWarnings||[]).length||(S.fixFail||[]).length))cls="wait",txt+=" · some data did not load";
  return{cls,txt,plain:txt.replace(/<[^>]+>/g,"")};
}
/* news sources failing for more than an hour, from the server's status */
function newsDown(){
  const ps=((S.status||{}).news||{}).perSource||{};
  return Object.entries(ps).filter(([,v])=>v&&!v.ok&&v.failingSince&&Date.now()-Date.parse(v.failingSince)>3600000).map(([k])=>k);
}
function newsSourcesHTML(){
  const ps=((S.status||{}).news||{}).perSource||{},rows=Object.entries(ps);
  if(!rows.length)return `<div class="pbody"><p class="note" style="margin:0">${BACKUP?"News runs on the FPL Signals server only.":"No news check reported yet."}</p></div>`;
  const down=new Set(newsDown());
  rows.sort((a,b)=>(down.has(b[0])-down.has(a[0]))||(!a[1].ok-!b[1].ok)*-1||((a[1].kind==="social")-(b[1].kind==="social"))||a[0].localeCompare(b[0]));
  return `<table class="mkt nw-srcs"><thead><tr><th>Source</th><th>Kind</th><th>Items</th><th>Last good copy</th><th>State</th></tr></thead><tbody>${rows.map(([k,v])=>{
    const st=v.ok?`<span class="up">Live</span>`:down.has(k)?`<span class="dn">Down since ${esc(ukWhen(v.failingSince))}</span>`:`<span style="color:var(--amber)">Retrying</span>`;
    return `<tr><td>${esc(k)}</td><td>${v.kind==="social"?"Social media":"News"}</td><td>${+v.count||0}</td><td>${v.fetchedAt?esc(agoText(v.fetchedAt)):"never"}</td><td title="${esc(v.error||"")}">${st}</td></tr>`;}).join("")}</tbody></table>`;
}
function statusChipHTML(){
  const{cls,txt}=statusState();
  return `<span class="sigchip"><span class="sigdot ${cls}"></span><span>${txt}</span>
    <button onclick="act('load')">${S.loading?esc(S.progress||"…"):"Check now"}</button></span>`;
}
/* Repaint only the chip and the footer in place. The minute timer uses this
   so an open page's ages stay honest without a full re-render, which would
   wipe scroll position and open menus. */
function refreshStatusUI(){
  const c=document.querySelector(".sigchip");if(c)c.outerHTML=statusChipHTML();
  const p=document.querySelector(".prov");if(p)p.outerHTML=provHTML();
  const l=document.querySelector(".tb .live");
  if(l){const ss=statusState();l.className="live "+ss.cls;l.title=ss.plain+". Opens Status.";}
  const d=document.querySelector(".tb .dl"),dl=deadlineInfo();
  if(d&&dl){const k=d.querySelectorAll(".dlk");if(k[1]){k[1].textContent=dl.left;k[1].classList.toggle("soon",dl.soon);}}
}
/* Real per-source ages from /api/status. If the last status check failed the
   last known values keep showing (S.status is only replaced on success). */
function provHTML(){
  const st=S.status||{};
  const ds=st.dataset||{},fpl=st.fpl||{},news=st.news||{},odds=st.odds||{},feeds=st.feeds||{};
  return `<div class="prov"><span>FPL Signals <b>v${APP_VERSION}</b></span>
    <span>Stats: <b>FPL Core Insights, ${esc(ukWhen(ds.committedAt))}</b>${ds.committedAt?` (${esc(agoText(ds.committedAt))})`:""}</span>
    <span>Prices, flags and deadlines: <b>FPL, ${esc(agoText(fpl.fetchedAt))}</b></span>
    <span>News: <b>${esc(agoText(news.fetchedAt))}</b></span>
    <span>Odds: <b>${esc(ukWhen(odds.fetchedAt))}</b></span>
    <span>TV channels: <b>${st.tv&&st.tv.fetchedAt?esc(agoText(st.tv.fetchedAt)):"not pushed yet"}</b></span>
    <span>FPL price predictor and set pieces: <b>${S.fplLive&&Object.keys(S.fplLive.players||{}).length?(S.fplLive.fetchedAt?esc(agoText(S.fplLive.fetchedAt)):"loaded"):"not loaded"}</b></span>
    <span>Your team and rivals: <b style="${feeds.error?"color:var(--red)":""}">${feeds.error?"last build failed, showing "+esc(agoText(feeds.lastOk))+" copy":esc(agoText(feeds.lastOk))}</b></span>
    ${(S.loadWarnings||[]).length||(S.fixFail||[]).length?`<span style="color:var(--amber);flex-basis:100%">Did not load: ${esc([...(S.loadWarnings||[]),...((S.fixFail||[]).length?["fixtures for GW"+S.fixFail.join(", GW")+" (those weeks show no projection)"]:[])].join("; "))}. Figures that use them are less reliable; Check now retries.</span>`:""}</div>`;
}
/* The outer guard (F7): if even the header cannot be drawn, show the menu and
   a plain message rather than a frozen page. The pass after it makes every
   clickable element reachable by keyboard and named for screen readers. */
function render(){
  try{renderPage();}
  catch(e){
    try{console.error("render failed",e);}catch(_){}
    const app=document.getElementById("app");
    let nav="";try{nav=navHTML();}catch(_){}
    app.innerHTML=`${nav}<div class="panel"><div class="pbody"><div class="warn" role="alert">
      <b>This page hit a problem and could not be drawn.</b> Try another page or Check now. <span class="mono" style="font-size:11px">${esc(String(e&&e.message||e))}</span></div></div></div>`;
  }
  try{a11yPass();}catch(_){}
}
/* F10, F11, F89: after every render. Elements that act on click but are not
   buttons or links get a tab stop and a button role (Enter and Space press
   them, see the key handler in app-main.js); inputs without a label take
   their placeholder or title as their name; the document title names the
   page. */
function a11yPass(){
  const app=document.getElementById("app");if(!app)return;
  app.querySelectorAll("[onclick]:not(button):not(a):not(input):not(select):not(textarea)").forEach(el=>{
    if(!el.hasAttribute("tabindex"))el.setAttribute("tabindex","0");
    if(!el.hasAttribute("role"))el.setAttribute("role","button");});
  app.querySelectorAll("input:not([aria-label]),select:not([aria-label]),textarea:not([aria-label])").forEach(el=>{
    const id=el.id&&app.querySelector(`label[for="${el.id}"]`);if(id)return;
    const name=el.getAttribute("placeholder")||el.getAttribute("title")||el.name||(el.closest("label")?"":"Value");
    if(name)el.setAttribute("aria-label",name);});
  app.querySelectorAll("button:not([aria-label])").forEach(b=>{
    if(!b.textContent.trim()){const t=b.getAttribute("title");b.setAttribute("aria-label",t||"Button");}});
  const t=document.getElementById("toast");if(t&&!t.hasAttribute("role")){t.setAttribute("role","status");t.setAttribute("aria-live","polite");}
  document.title=(TAB_LABEL[S.tab]?TAB_LABEL[S.tab]+" · ":"")+"FPL Signals";
}
function renderPage(){
  const app=document.getElementById("app");
  /* Instant start: while the saved picture of the last page is showing and the
     model is still being built from the saved data, leave the picture alone
     instead of flashing the loading screen. The first real render clears it. */
  if(!S.model&&S.booting)return;
  if(S.booting){S.booting=false;app.classList.remove("booting");}
  if(!S.model){
    /* No splash (Andy, 20 Nov 2026): the data loads by itself, so while it
       does there is one quiet line saying what it is fetching; only a failed
       load shows anything more (the error and Try again). */
    app.innerHTML=(S.err&&!S.loading)
      ?`<div style="max-width:460px;margin:0 auto;padding:28vh 4px 0"><div class="warn">${esc(S.err)}</div>
         <button class="pri" style="width:100%;margin-top:12px" onclick="act('load')">Try again</button></div>`
      :`<p class="note" role="status" aria-live="polite" style="text-align:center;padding:38vh 4px 0;margin:0">Loading ${esc(S.progress||"")}</p>`;
    return;
  }
  /* wave 8: the Odds and Transfers pages are retired; their old links land
     on the new homes (Teams > Odds, the Planner's Top Move pop-up) */
  if(S.tab==="transfers"){S.tab="squad";S.pop="move";S.popTab="all";try{history.replaceState({},"",routeFor("squad"));}catch(e){}}
  if(S.tab==="odds"){S.tab="fixtures";S.fixMode="matches";try{history.replaceState({},"",routeFor("fixtures"));}catch(e){}}
  /* batch 5: while a gameweek is being played the Planner opens on it */
  if(S.tab==="squad"&&!S.startGW&&!S.liveOff){const lg0=liveGW();if(lg0){S.startGW=lg0;S.liveAuto=true;}}
  const g=VG();
  /* a flagged player counts as sold: value drops, bank rises by his selling price */
  const flaggedP=squadPlayers().filter(p=>S.flagged.includes(p.id));
  const raised=+flaggedP.reduce((a,p)=>a+sellPrice(p),0).toFixed(1);
  const sv=squadPlayers().filter(p=>!S.flagged.includes(p.id)).reduce((a,p)=>a+p.price,0);
  const bank=+(planBank()+raised).toFixed(1);
  const rating=teamRating();
  let main="";
  /* F7: a throw in one page builder used to freeze the whole app. It is caught
     here, so the header, the menu and every other page keep working, and the
     page says what went wrong instead of going blank. */
  try{
  if(S.tab==="squad"){
    const first=S.model.next.id;
    const hSlider=`<div class="chipbar" style="align-items:center;justify-content:space-between">
      <button onclick="act('vgw',${Math.max(1,g-1)})" ${g<=1?"disabled style=\"opacity:.35\"":""}>←</button>
      <span style="text-align:center">
        <span style="display:block;font-family:'Geist';font-weight:700;font-size:18px;">
          GAMEWEEK ${g}${S.horizon>1?`–${g+S.horizon-1}`:""}</span>
        <span style="display:block;font-size:10px;color:var(--mute)">${g===first?"next deadline":`${g-first} week${g-first>1?"s":""} ahead`}${S.horizon>1?` · ${S.horizon}-week total`:""}</span>
        ${(g<first&&S.tracker&&(S.tracker.gw||[]).find(r=>r.event===g&&r.picks&&r.picks.length))
          ?`<span style="display:block;font-size:10px;color:var(--mint)" title="Squad, line-up, formation, captain and points confirmed from the official FPL API.">Official line-up · final</span>`:""}</span>
      <button onclick="act('vgw',${Math.min(38,g+1)})" ${g>=38?"disabled style=\"opacity:.35\"":""}>→</button></div>`;
    const chipBarUnused=`<div class="chipzone">
      <span style="font-size:10px;color:#9E86C6;font-weight:700;width:100%;text-align:center">Play a chip</span>
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
          ${S.pendingOpt.map(m=>`<div><div style="font-size:10px;
            color:var(--cyan);font-weight:700;margin-bottom:4px">${POS[m.out.pos]}</div>${swapCardHTML(m,g)}</div>`).join("")}</div>
        <button style="margin-top:10px" onclick="act('cancelopt')">Cancel</button></div></div>`:"";
    /* Team Planner (21 Nov 2026, round 4): the Planner and the Player Pool
       side by side, then Chips and This Week full width */
    main=`<div class="grid2 pz-grid${isLiveWk(g)?" lk":""}"><div>
      <div class="panel plpanel">${plannerHeadHTML()}${S.sqView==="list"?squadListHTML():plannerPitchHTML()}${plannerChipsHTML()}</div>${conf}${flag}</div>
      ${offRowOf(g)&&g<S.model.next.id?`<div class="poolcol pv-col"><div class="pv-wrap">${isLiveWk(g)?lkPanelHTML(g):pastReviewHTML(g)}`:`      <div class="poolcol">
        <div class="panel poolpanel"><div class="phead"><h2>Player Pool</h2>
        <a class="btnlink" href="${routeFor("table")}" onclick="return go(event,'table')">Player Data →</a></div>
        ${replHTML()}${poolFiltersHTML()}<div class="plist">${listHTML()}</div>
        ${S.selected?`<div class="pbody" style="border-top:1px solid var(--ink3)">
          <span class="note" style="color:var(--mint)">Pick a replacement for ${esc(S.selected.web_name)}</span>
          <button style="margin-top:8px" onclick="act('cancel')">Cancel</button></div>`:""}`}</div></div></div>
      ${isLiveWk(g)?lkLowerHTML(g):thisWeekHTML()}`;
  }
  else if(S.tab==="table")main=playerDataHTML();
  else if(S.tab==="tracker")main=leagueTabsHTML()+trackerHTML();
  else if(S.tab==="xfpl")main=statusPageHTML();
  else if(S.tab==="chips")main=chipsHTML();
  else if(S.tab==="fixtures")main=fixturesHTML();
  else if(S.tab==="rivals")main=leagueTabsHTML()+rivalsHTML();
  else if(S.tab==="news")main=newsHTML();
  else if(S.tab==="signals")main=signalsHTML();
  }catch(e){
    try{console.error("page failed",S.tab,e);}catch(_){}
    main=`<div class="panel"><div class="pbody"><div class="warn" role="alert"><b>This page hit a problem and could not be drawn.</b>
      Every other page still works. <span class="mono" style="font-size:11px;opacity:.85">${esc(String(e&&e.message||e))}</span></div></div></div>`;
  }

  /* Redesign wave 1 (19 Oct 2026, mock 2): one sticky bar (logo, the eight
     pages, gameweek switcher, deadline, live dot that opens Status; Predicted,
     Bank and FT join it on scroll), and on the Planner a hero of the team name
     and four figure cards with sparklines. The six-card header, the
     duplicate sticky strip and the grouped menu are gone; data freshness
     moved to the Status page. */
  const gv=VG(), freeSq=["freehit","wildcard"].includes(chipForWeek(gv));
  const pred=weekPts();
  const ftTxt=freeSq?"Unlimited":String(freeTransfers());
  const topbar=topbarHTML({gv,pred,bank,ftTxt});
  let hero="";
  if(S.tab==="squad"){
    hero=plannerStatsHTML({rating,bank,sv,raised,ftTxt,n:squadPlayers().filter(p=>!S.flagged.includes(p.id)).length});
  }
  app.innerHTML=`${topbar}
   ${hero}
   ${S.pop?popHTML():""}${S.cmp?compareModalHTML():""}${S.pCmp?playerCompareHTML():""}
   ${S.cardId?playerCardHTML():""}
   <main id="main" style="display:block;max-width:100%">${main}</main>
   ${S.tab==="table"&&!S.pCmp&&(S.pTicks||[]).length?cmpTrayHTML():""}
   <div class="foot">FPL Signals v${APP_VERSION}</div>`;
  if(S._lkRestore){const f=S._lkRestore;S._lkRestore=null;try{f();}catch(_){}}
}
/* Figure card (Fintel style): title with (i), figure, change line and a
   sparkline. No commentary: explanations live in the (i). */
function figCard(title,tip,v,change,series,tone,cls,vstyle){
  return `<div class="fc${cls?" "+cls:""}">
    <div class="fct">${title}<button class="fci" aria-label="About ${title}" data-tip="${esc(tip)}">i</button></div>
    <div class="fcv"${vstyle?` style="${vstyle}"`:""}>${v}</div>
    <div class="fcb"><span class="fcc">${change||"&nbsp;"}</span>${series&&series.length>1?spark(series,tone):""}</div></div>`;
}
function spark(vals,tone,W,H){
  W=W||96;H=H||28;const mx=Math.max(...vals),mn=Math.min(...vals);
  const pts=vals.map((v,i)=>`${(i/(vals.length-1)*W).toFixed(1)},${(H-3-(v-mn)/((mx-mn)||1)*(H-6)).toFixed(1)}`).join(" ");
  return `<svg class="spk" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${tone||"#8A8A8A"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
/* the sticky bar */
function deadlineInfo(){
  const st=S.status&&S.status.fpl;let d=st&&st.nextDeadline;
  if(!d&&S.model){const ev=(S.events||[]).find(e=>e.id===S.model.next.id);d=ev&&ev.deadline_time;}
  if(!d)return null;
  const t=Date.parse(d);if(!isFinite(t))return null;
  const ms=t-Date.now();
  const left=ms<=0?"passed":ms>=86400000?`${Math.floor(ms/86400000)}d ${Math.floor(ms%86400000/3600000)}h`
    :`${Math.floor(ms/3600000)}h ${Math.floor(ms%3600000/60000)}m`;
  return{when:ukFmt(t,{weekday:"short",hour:"2-digit",minute:"2-digit"}),left,soon:ms>0&&ms<86400000,full:ukDeadline(t)};
}
function topbarHTML(o){
  const dl=deadlineInfo(), ss=statusState();
  return `<header class="tb"><div class="tbin">
    <a class="brand" href="${routeFor("squad")}" onclick="return go(event,'squad')"><span class="bl">${LOGO}</span><span class="bw">FPL Signals</span></a>
    ${navLinksHTML()}
    <div class="tr">
      <span class="tbfig"><span>Predicted <b class="mint">${o.pred.toFixed(1)}</b></span><span>Bank <b${o.bank<0?' style="color:var(--red)"':""}>£${o.bank.toFixed(1)}</b></span><span>FT <b>${o.ftTxt}</b></span></span>
      ${/* C15 (audit, 22 Nov 2026): the arrows only move the pages that read the
         viewed week; elsewhere they changed nothing but their own label */
        ["fixtures","chips","news","tracker","rivals","xfpl","odds"].includes(S.tab)?`<span class="gwsw"><b>GW${o.gv}</b></span>`
        :`<span class="gwsw"><button onclick="act('startgw',${Math.max(1,o.gv-1)})" aria-label="Previous gameweek">‹</button><b>GW${o.gv}</b><button onclick="act('startgw',${Math.min(38,o.gv+1)})" aria-label="Next gameweek">›</button></span>`}
      ${dl?`<span class="dl" title="Deadline ${esc(dl.full)}"><span class="dlk">Deadline</span><b>${esc(dl.when)}</b><span class="dlk${dl.soon?" soon":""}">${dl.left}</span></span>`:""}
      <a class="live ${ss.cls}" href="${routeFor("xfpl")}" onclick="return go(event,'xfpl')" title="${esc(ss.plain)}. Opens Status." aria-label="Data status: ${esc(ss.plain)}"><i></i></a>
    </div></div></header>`;
}


/* League (wave 1): Tracker is the default tab, Rivals the second */
function leagueTabsHTML(){
  return `<div class="pagetabs"><h1>League</h1><span class="pseg">${[["tracker","Tracker"],["rivals","Rivals"]].map(([k,n])=>
    `<a class="${S.tab===k?"on":""}" href="${routeFor(k)}" onclick="return go(event,'${k}')">${n}</a>`).join("")}</span></div>`;
}
/* Status (wave 1): data freshness (moved from the footer), the signal key,
   then the xFPL model page. Wave 7 adds model vs FPL, fixture accuracy,
   odds status and options. */
function statusPageHTML(){
  return `<div class="pagetabs"><h1>Status</h1>${statusChipHTML()}</div>
    <div class="panel"><div class="phead"><h2>Data Freshness</h2></div>${provHTML()}</div>
    <div class="panel"><div class="phead"><h2>News Sources</h2>${(n=>n?`<span class="note" style="color:var(--amber)">${n} down for over an hour</span>`:"")(newsDown().length)}</div>${newsSourcesHTML()}</div>
    <div class="panel"><div class="phead"><h2>Model vs FPL</h2><span class="note">each finished gameweek, prediction against points scored</span></div>${modelVsFplHTML()}</div>
    <div class="panel"><div class="phead"><h2>Signal Hit Rates</h2><span class="note">did the flagged players beat their prediction?</span></div>${signalHitsHTML()}</div>
    <div class="panel"><div class="phead"><h2>Fixture Ratings</h2><span class="note">projected goals against this season's results</span></div>${fixtureAccuracyHTML()}</div>
    <div class="panel"><div class="phead"><h2>Odds</h2><a class="btnlink" href="${routeFor("odds")}" onclick="return go(event,'odds')">Bookmaker markets →</a></div>${oddsStatusHTML()}</div>
    <div class="panel"><div class="phead"><h2>Options</h2></div>${optionsHTML()}</div>
    <div class="panel"><div class="phead"><h2>Signal Key</h2><span class="note">hover a tile for its rule</span></div>${legendHTML()}</div>
    ${xfplHTML()}`;
}
