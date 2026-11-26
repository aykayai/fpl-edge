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
  let csHome=0,csAway=0,xgHome=0,xgAway=0,haulHome=0,haulAway=0;
  labels.forEach(([h,a],i)=>{
    if(a===0)csHome+=p[i];
    if(h===0)csAway+=p[i];
    /* 26 Nov 2026: three or more, where attackers haul (Markets tab) */
    if(h>=3)haulHome+=p[i];
    if(a>=3)haulAway+=p[i];
    xgHome+=h*p[i];xgAway+=a*p[i];
  });
  return{csHome,csAway,xgHome,xgAway,haulHome,haulAway,n:raw.length};
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
  const out={},cards={};
  Object.values(oddsPlayers()).forEach(r=>{
    const e=gwOf(r.fx);if(!e||(r.goal==null&&r.assist==null&&r.card==null))return;
    const lam=p=>p>0&&p<0.99?-Math.log(1-p):null;
    (out[r.p.id]=out[r.p.id]||{})[e]={g:lam(r.goal),a:lam(r.assist),c:r.card??null};
    if(r.card!=null)(cards[e]=cards[e]||[]).push(r.card);
  });
  S.propMarket=out;
  /* the week's average priced booking chance: the card term is relative to it */
  S.cardMean={};Object.entries(cards).forEach(([e,a])=>{if(a.length>=20)S.cardMean[e]=a.reduce((x,y)=>x+y,0)/a.length;});
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
/* the market's chance each team scores 3 or more in gameweek g (from the
   correct-score grid; 26 Nov 2026, the card's and the Markets tab's Haul Chance) */
function marketHaul(g){
  const inGw=new Set((S.model.byEv[g]||[]).filter(f=>f.ht&&f.at).map(f=>f.ht.id+"-"+f.at.id)),m={};
  oddsFixtures().forEach(f=>{if(!f.goals||f.goals.haulHome==null||!f.ht||!f.at||!inGw.has(f.ht.id+"-"+f.at.id))return;
    m[f.ht.id]=f.goals.haulHome;m[f.at.id]=f.goals.haulAway;});
  return m;
}
/* the market's clean-sheet chance for each team in gameweek g */
function marketCS(g){
  const inGw=new Set((S.model.byEv[g]||[]).filter(f=>f.ht&&f.at).map(f=>f.ht.id+"-"+f.at.id)),m={};
  oddsFixtures().forEach(f=>{if(!f.goals||!f.ht||!f.at||!inGw.has(f.ht.id+"-"+f.at.id))return;
    m[f.ht.id]=f.goals.csHome;m[f.at.id]=f.goals.csAway;});
  return m;
}
/* ============================================================
   LEAGUE › your mini-league (22 Nov 2026, Andy's mock m14): the Rivals tab
   folds into League as two cards side by side. The table (this gameweek,
   or season totals) holds what Transfer Activity showed; clicking a rival
   picks them for Head to Head: their snapshot, then the players only one
   of you owns, projected for next week or as scored last week. Threats and
   Your Differentials live in the Planner's Transfers pop-up (Rivals tab).
   ============================================================ */
function lgRivalsHTML(){
  if(BACKUP)return "";
  const feed=S.rivalsFeed;
  if(!feed||!feed.standings||!feed.standings.length)
    return rep("lgtable","list-ordered","Mini-League","Your league table and Head to Head.",sgEmpty("The league table appears once the rivals feed is published."),{wide:true});
  const gNext=S.model.next.id,gLast=gNext-1,me=String(TEAM_ID);
  const mine=squadPlayers(),myIds=new Set(S.squad||[]);
  const pOf=id=>S.model.players.find(p=>p.id===id);
  const ents=feed.entries||{};
  const rowsOf=id=>((ents[id]&&ents[id].gw)||[]);
  const lastOf=id=>{const a=rowsOf(id);return a.length?a[a.length-1]:null;};
  const st=[...feed.standings].sort((a,b)=>(a.rank||99)-(b.rank||99));
  const lead=st.length?st[0].totalPoints||0:0;
  const selId=S.rivalPick!=null&&st.some(r=>String(r.entryId)===String(S.rivalPick))?String(S.rivalPick)
    :String((st.find(r=>String(r.entryId)!==me)||{}).entryId||"");
  const ini=n=>esc(String(n||"?").trim().split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase());
  const mu=`<span class="mu">–</span>`;
  const mv=r=>{if(r.lastRank==null||r.rank==null||r.lastRank===0)return "";const d=r.lastRank-r.rank;
    return d?`<span class="${d>0?"up":"dn"}">${d>0?"▲":"▼"}${Math.abs(d)}</span>`:"";};
  const gap=r=>r.totalPoints==null||r.totalPoints>=lead?mu:`<span class="dn">−${lead-r.totalPoints}</span>`;
  const sgn=v=>v==null?mu:`<span class="${v>0?"up":v<0?"dn":""}">${v>0?"+":v<0?"−":""}${Math.abs(v)}</span>`;
  const KIND=["wildcard","freehit","bboost","3xc"];
  const chipsOf=id=>(ents[id]&&ents[id].chips)||[];
  const team=r=>{const isMe=String(r.entryId)===me;
    return `<td class="m"><span class="lg-tm"><span class="sx-av">${ini(r.manager||r.entryName)}</span><span class="lg-nm"><b>${esc(r.entryName||"—")}</b><em>${isMe?"You":esc(r.manager||"")}</em></span></span></td>`;};
  const trOpen=r=>{const isMe=String(r.entryId)===me,isSel=String(r.entryId)===selId;
    return `<tr class="${isMe?"me":isSel?"lg-sel":""}"${isMe?"":` onclick="act('rivalpick','${r.entryId}')" title="Head to Head with ${esc(r.entryName||"")}"`}>`;};
  const rk=r=>`<td class="lg-rk"><b>${r.rank??"—"}</b><span class="lg-mv">${mv(r)}</span></td>`;
  const season=S.lgView==="season";
  let table;
  if(!season){
    table=`<table class="ax-t lg-t"><thead><tr><th>#</th><th class="m">Team</th><th>GW</th><th>Total</th><th>Gap</th><th>Capt</th><th>Chip</th><th>Moves</th><th>Gain</th><th>Shared</th></tr></thead><tbody>
      ${st.map(r=>{const isMe=String(r.entryId)===me,L=lastOf(r.entryId)||{},pk=L.picks||[],c=pk.find(x=>x.isC),cp=c&&pOf(c.id);
        const ch=chipsOf(r.entryId).find(x=>x.event===L.event),shared=pk.filter(x=>x.multiplier>0&&myIds.has(x.id)).length;
        return trOpen(r)+rk(r)+team(r)+`<td>${r.gwPoints??"—"}</td><td><b>${r.totalPoints??"—"}</b></td><td>${gap(r)}</td>
          <td>${cp?`<span class="lg-cap" title="${esc(cp.web_name)}">${dsFace(cp,"sm")}</span>`:mu}</td>
          <td>${ch&&CHIP_UI[ch.name]?`<span title="${esc(ch.label||CHIP_UI[ch.name].n)}">${chipTile(ch.name,20,true)}</span>`:mu}</td>
          <td>${L.transfers??"—"}${L.transferCost?` <span class="dn">−${L.transferCost}</span>`:""}</td>
          <td>${L.transfers?sgn(L.transferDiff??null):mu}</td><td>${isMe?mu:(pk.length?shared+"/11":"—")}</td></tr>`;}).join("")}</tbody></table>`;
  }else{
    table=`<table class="ax-t lg-t"><thead><tr><th>#</th><th class="m">Team</th><th>Total</th><th>Gap</th><th>Best GW</th><th>Chips</th><th>Moves</th><th>Hits</th><th>Gain</th><th>Bench</th></tr></thead><tbody>
      ${st.map(r=>{const rows=rowsOf(r.entryId),sum=k=>rows.reduce((a,x)=>a+(+x[k]||0),0);
        const best=rows.length?Math.max(...rows.map(x=>+x.points||0)):null,used=chipsOf(r.entryId).filter(x=>CHIP_UI[x.name]).sort((a,b)=>(a.event||0)-(b.event||0));
        return trOpen(r)+rk(r)+team(r)+`<td><b>${r.totalPoints??"—"}</b></td><td>${gap(r)}</td><td>${best??"—"}</td>
          <td><span class="lg-chips">${used.length?used.map(x=>`<span title="${esc(x.label||CHIP_UI[x.name].n)} · GW${x.event}">${chipTile(x.name,16,true)}</span>`).join(""):mu}</span></td>
          <td>${rows.length?sum("transfers"):"—"}</td><td>${sum("transferCost")?`<span class="dn">−${sum("transferCost")}</span>`:mu}</td>
          <td>${rows.length?sgn(sum("transferDiff")):mu}</td><td>${rows.length?sum("bench"):"—"}</td></tr>`;}).join("")}</tbody></table>`;
  }
  const lgTog=`<span class="sx-tog">${[["gw","GW"+(feed.lastEvent||gLast)],["season","Season"]].map(([k,l])=>`<button class="${(season?"season":"gw")===k?"on":""}" onclick="act('lgview','${k}')">${l}</button>`).join("")}</span>`;
  const tableCard=rep("lgtable","list-ordered",esc(feed.leagueName||"Mini-League"),"Your league this gameweek; click a rival for Head to Head.",table,{extra:lgTog});

  /* ---------- Head to Head with the picked rival ---------- */
  const ent=ents[selId],sr=st.find(r=>String(r.entryId)===selId);
  if(!ent||!sr)return tableCard+rep("lgh2h","swords","Head to Head","Players only one of you owns, and what they score.",sgEmpty("Pick a rival in the table."));
  const last=lastOf(selId);
  const theirIds=((last&&last.picks)||[]).map(pk=>pk.id??pk),theirSet=new Set(theirIds),theirs=theirIds.map(pOf).filter(Boolean);
  const upcoming=S.rivalGwView!=="last",gShow=upcoming?gNext:(last?last.event:gLast);
  const actOf=(id,gw)=>{const f=S.playerActuals&&(S.playerActuals[id]||S.playerActuals[String(id)]);const v=f?(f[gw]??f[String(gw)]):null;return v==null?null:+v;};
  const val=p=>upcoming?hPts(p,gNext,S.horizon):(actOf(p.id,gShow)??0);
  const myDiff=mine.filter(p=>!theirSet.has(p.id)).sort((a,b)=>val(b)-val(a));
  const theirDiff=theirs.filter(p=>!myIds.has(p.id)).sort((a,b)=>val(b)-val(a));
  const sum=a=>a.reduce((s,p)=>s+val(p),0),ys=sum(myDiff),ts=sum(theirDiff),edge=ys-ts;
  const meRow=st.find(r=>String(r.entryId)===me),d=meRow&&meRow.totalPoints!=null&&sr.totalPoints!=null?meRow.totalPoints-sr.totalPoints:null;
  const ord=n=>n+(n%100>=11&&n%100<=13?"th":["th","st","nd","rd"][n%10]||"th");
  const cap=last&&last.captainId?pOf(last.captainId):null;
  const half=gNext>=20?2:1,played=chipsOf(selId).filter(x=>half===1?x.event<=19:x.event>=20).map(x=>x.name);
  const left=KIND.filter(k=>!played.includes(k));
  const snap=`<div class="lg-snap"><span class="sx-av">${ini(sr.manager||sr.entryName)}</span><span class="lg-nm"><b>${esc(sr.entryName||"")}</b><em>${esc(sr.manager||"")}${sr.rank?` · ${ord(sr.rank)}`:""}${d==null?"":d===0?" · level with you":` · ${Math.abs(d)} ${d>0?"behind":"ahead of"} you`}</em></span>
    <div class="lg-mini"><span><em>GW${last?last.event:gLast}</em><b>${last&&last.points!=null?last.points:"—"}</b></span>
      <span><em>Captain</em><b>${cap?dsFace(cap,"sm"):""}${last&&last.captainPts!=null?last.captainPts:"—"}</b></span>
      <span><em>Free Transfers</em><b class="am">${last&&last.ftAvailable!=null?last.ftAvailable:"—"}</b></span>
      <span><em>Chips Left</em><b class="lg-cl">${left.length?left.map(k=>`<span title="${CHIP_UI[k].n}">${chipTile(k,18,false,"dash")}</span>`).join(""):mu}</b></span></div></div>`;
  const f1=v=>v.toFixed(1);
  const bar=`<div class="lg-edge"><div class="lg-es"><em>Yours</em><b class="up">${f1(ys)}</b></div>
    <div class="lg-bar">${ys+ts>0?`<i class="y" style="flex:${ys.toFixed(2)}"></i><i class="t" style="flex:${ts.toFixed(2)}"></i>`:""}</div>
    <div class="lg-es r"><em>Theirs</em><b class="am">${f1(ts)}</b></div>
    <div class="lg-es e"><em>Edge</em><b class="${edge>=0?"up":"dn"}">${edge>=0?"+":"−"}${f1(Math.abs(edge))}</b></div></div>`;
  const prow=(p,tone)=>`<div class="lg-pr" onclick="act('card',${p.id})">${dsFace(p)}${dsBadge(sgTeamOf(p),16)}<span class="lg-pn"><b>${esc(p.web_name)}</b><em>${esc(p.teamName)} · £${p.price.toFixed(1)}</em></span><b class="lg-pf ${tone}">${f1(val(p))}</b></div>`;
  const col=(t,a,tone,none)=>`<div><div class="lg-lh"><span>${t}</span><span>${upcoming?"xPts":"Pts"}</span></div>${a.length?a.slice(0,5).map(p=>prow(p,tone)).join(""):sgEmpty(none)}</div>`;
  const noAct=!upcoming&&!theirDiff.concat(myDiff).some(p=>actOf(p.id,gShow)!=null);
  const h2hTog=`<span class="sx-tog lg-h2t"><button class="${upcoming?"on":""}" onclick="act('rivalgw','next')">GW${gNext} Projected</button><button class="${!upcoming?"on":""}" onclick="act('rivalgw','last')">GW${gShow} Actual</button></span>`;
  const h2h=rep("lgh2h","swords","Head to Head","Players only one of you owns, and what they score.",
    snap+(noAct?sgEmpty(`No points stored for GW${gShow} yet.`):bar+`<div class="lg-cols">${col("Yours They Don't Own",myDiff,"up","Identical squads.")}${col("Theirs You Don't Own",theirDiff,"am","Nothing they own that you don't.")}</div>`),
    {extra:h2hTog});
  return tableCard+h2h;
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
const nwFace=(p,cls)=>`<span class="nw-face ${cls||""}" style="--cc:${nwKit(p)}"><img alt="" src="${imgSrc("player",p.code,110)}" onerror="this.style.visibility='hidden'"></span>`;
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
/* Pixel 7a pass (25 Nov 2026): on a phone the page list moves to a bottom bar
   within thumb reach, Android style. Four pages and More; More opens a sheet
   with the rest. Hidden above 620px, where the top bar carries every page. */
const MNAV=[["squad","Planner","shirt"],["signals","Signals","radar"],["table","Players","users"],["fixtures","Teams","shield"]];
const MMORE=[["tracker","League","trophy"],["chips","Chips","zap"],["news","News","newspaper"],["xfpl","Status","activity"]];
function mnavHTML(){
  const home=NAV_HOME[S.tab]||S.tab, inMore=MMORE.some(([k])=>k===home);
  const it=([k,n,ic])=>`<a class="${home===k?"on":""}" href="${routeFor(k)}" onclick="return go(event,'${k}')"${home===k?' aria-current="page"':""}><span class="mi">${lic(ic,21)}</span><span>${n}</span></a>`;
  return `<nav class="mnav" aria-label="Pages">${MNAV.map(it).join("")}
    <button class="${inMore||S.moreOpen?"on":""}" onclick="act('more')" aria-expanded="${!!S.moreOpen}"><span class="mi">${lic("ellipsis",21)}</span><span>More</span></button></nav>
    ${S.moreOpen?`<div class="msheet-bg" onclick="act('more')"></div><div class="msheet" role="dialog" aria-label="More pages">${MMORE.map(([k,n,ic])=>
      `<a class="${home===k?"on":""}" href="${routeFor(k)}" onclick="return go(event,'${k}')"><span class="mi">${lic(ic,20)}</span>${n}</a>`).join("")}</div>`:""}`;
}
function navHTML(){
  return `<header class="tb"><div class="tbin"><a class="brand" href="${routeFor("squad")}" onclick="return go(event,'squad')"><span class="bl">${LOGO}</span><span class="bw">FPL Signals</span></a>${navLinksHTML()}</div></header>${mnavHTML()}`;
}
/* left-click routes in place; ctrl/cmd-click and long-press use the real href */
function go(ev,tab){
  if(ev.metaKey||ev.ctrlKey||ev.shiftKey||ev.button===1)return true;
  ev.preventDefault();
  S.menuOpen=false;S.moreOpen=false;
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
/* Phone pass (Pixel 7a, 25 Nov 2026). After every render on a phone:
   a sticky row of section tabs for long pages (built from the page's own
   cards, so a new card gets a tab without any change here), and a fade on
   anything that scrolls sideways until its end is reached. */
const SEC_LABEL={plpanel:"Pitch",poolpanel:"Player Pool",gb:"Brief"};
function mobilePass(){
  const main=document.getElementById("main");if(!main)return;
  const old=document.querySelector(".sectabs");if(old)old.remove();
  if(!PHONE())return;
  sheetPass();
  const secs=[...main.querySelectorAll(".rep,.panel,.pz-sec")].filter(e=>!e.parentElement.closest(".rep,.panel,.pz-sec,.modal")&&e.offsetHeight>60);
  const items=secs.map((e,i)=>{const h=e.querySelector("h2,h3");let t=h?h.textContent.trim().replace(/\s+/g," "):"";
    const k=Object.keys(SEC_LABEL).find(c=>e.classList.contains(c));if(k)t=SEC_LABEL[k];
    if(!t)return null;e.id=e.id||("sec-"+i);e.classList.add("secanchor");return [e.id,t.length>22?t.slice(0,21)+"…":t];}).filter(Boolean);
  if(items.length>=3){
    secs[0].insertAdjacentHTML("beforebegin",`<nav class="sectabs" aria-label="Sections">${items.map(([id,t],i)=>`<a href="#${id}" data-sec="${id}" class="${i?"":"on"}" onclick="event.preventDefault();secGo('${id}')">${esc(t)}</a>`).join("")}</nav>`);
    secSpy();
  }
  main.querySelectorAll(".scroll,.tg-scroll,.wkrow,.rb,.pz-scr").forEach(el=>{
    if(el.scrollWidth<=el.clientWidth+4){el.classList.remove("sxh");return;}
    el.classList.add("sxh");
    const end=()=>el.classList.toggle("sxend",el.scrollLeft+el.clientWidth>=el.scrollWidth-4);end();
    if(!el._sx){el._sx=1;el.addEventListener("scroll",end,{passive:true});}
  });
}
/* Sheets behave like Android's own: the back gesture closes the open sheet
   (it gets a history step of its own while it is up) and so does a firm
   swipe down from its top edge. */
function sheetClose(){const m=document.querySelector("#app .modal");if(m)m.dispatchEvent(new MouseEvent("click",{bubbles:true}));}
function sheetPass(){
  const m=document.querySelector("#app .modal"),st=history.state||{};
  if(m&&!st.sheet)history.pushState({...st,sheet:1},"",location.href);
  else if(!m&&st.sheet)history.back();
  const box=m&&m.querySelector(".mbox");if(!box||box._sw)return;box._sw=1;
  let y0=null,dy=0;
  box.addEventListener("touchstart",e=>{const t=e.touches[0];y0=(t.clientY-box.getBoundingClientRect().top<64)?t.clientY:null;dy=0;},{passive:true});
  box.addEventListener("touchmove",e=>{if(y0==null)return;dy=Math.max(0,e.touches[0].clientY-y0);box.style.transition="none";box.style.transform="translateY("+dy+"px)";},{passive:true});
  box.addEventListener("touchend",()=>{if(y0==null)return;box.style.transition="transform .2s ease";
    if(dy>110)sheetClose();else box.style.transform="";y0=null;});
}
function secGo(id){const e=document.getElementById(id);if(e)e.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});}
/* the tab of the section under the bar lights up and slides into view */
function secSpy(){
  const nav=document.querySelector(".sectabs");if(!nav)return;
  const links=[...nav.querySelectorAll("a")];let cur=links[0];
  links.forEach(a=>{const e=document.getElementById(a.dataset.sec);if(e&&e.getBoundingClientRect().top<150)cur=a;});
  if(cur&&!cur.classList.contains("on")){links.forEach(a=>a.classList.toggle("on",a===cur));
    nav.scrollTo({left:cur.offsetLeft-nav.clientWidth/2+cur.offsetWidth/2,behavior:"smooth"});}
}
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
  try{popFit();}catch(_){}
  try{mobilePass();}catch(_){}
}
/* Pop-ups fill the window with no scroll (designed at 1536x864). On a shorter
   window their panels were squeezed and cut off (Andy, 25 Nov 2026). After
   every render, any pop-up with a clipped panel lets its parts take their
   natural height and scrolls instead; one that fits keeps the filled layout. */
function popClipped(body){
  return [...body.querySelectorAll("*")].some(el=>{
    if(el.clientHeight<=20||el.scrollHeight<=el.clientHeight+3)return false;
    const o=getComputedStyle(el).overflowY;return o==="hidden"||o==="clip";});
}
function popFit(){
  document.querySelectorAll("#app .mbox.mfull").forEach(box=>{
    const body=box.querySelector(".mbody");
    if(!body||!popClipped(body))return;
    box.classList.add("mscroll");
    body.querySelectorAll("*").forEach(el=>{
      const p=el.parentElement&&getComputedStyle(el.parentElement).display;
      if(!/flex|grid/.test(p||""))return;
      /* min-content, not auto: a panel that hides its overflow may still shrink to 0 under auto */
      const cs=getComputedStyle(el);
      if(cs.minHeight==="0px"||(cs.minHeight==="auto"&&cs.overflowY!=="visible"))el.style.minHeight="min-content";});
  });
}
let popFitT=0;
window.addEventListener("resize",()=>{clearTimeout(popFitT);popFitT=setTimeout(()=>{
  /* phones already scroll their pop-ups; never redraw under a field being typed in */
  if(innerWidth<=760||/INPUT|TEXTAREA|SELECT/.test((document.activeElement||{}).tagName||""))return;
  if(document.querySelector("#app .mbox.mfull"))render();},150);});
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
  /* before anything is drawn: the armbands follow the week's projections */
  if(S.model)try{armbandsAuto();}catch(_){}
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
  /* 24 Nov 2026: past midnight after the week's last match, a Planner that
     opened on the live week moves on to the next one by itself */
  if(S.liveAuto&&S.startGW&&liveGW()!==S.startGW){S.startGW=0;S.liveAuto=false;}
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
      ${pnlHead("sparkles","Transfer Advice","The best moves by predicted gain; nothing changes until you confirm.",`<span class="rbadge">${S.pendingOpt.length}</span>`)}
      <div class="pbody" style="padding-top:0">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px">
          ${S.pendingOpt.map(m=>`<div><div style="font-size:10px;
            color:var(--cyan);font-weight:700;margin-bottom:4px">${POS[m.out.pos]}</div>${swapCardHTML(m,g)}</div>`).join("")}</div>
        <button style="margin-top:10px" onclick="act('cancelopt')">Cancel</button></div></div>`:"";
    /* Team Planner (21 Nov 2026, round 4): the Planner and the Player Pool
       side by side, then Chips and This Week full width */
    main=`<div class="grid2 pz-grid${isLiveWk(g)?" lk":""}"><div>
      <div class="panel plpanel">${plannerHeadHTML()}${S.sqView==="list"?squadListHTML():plannerPitchHTML()}${plannerChipsHTML()}</div>${conf}${flag}</div>
      ${offRowOf(g)&&g<S.model.next.id?`<div class="poolcol pv-col"><div class="pv-wrap">${isLiveWk(g)?lkPanelHTML(g):pastReviewHTML(g)}`:`      <div class="poolcol">
        <div class="panel poolpanel">${pnlHead("users","Player Pool","Every player you can bring in.",`<a class="pnl-lnk" href="${routeFor("table")}" onclick="return go(event,'table')">Player Data →</a>`)}
        ${replHTML()}${poolFiltersHTML()}<div class="plist">${listHTML()}</div>
        ${S.selected?`<div class="pbody" style="border-top:1px solid var(--ink3)">
          <span class="note" style="color:var(--mint)">Pick a replacement for ${esc(S.selected.web_name)}</span>
          <button style="margin-top:8px" onclick="act('cancel')">Cancel</button></div>`:""}`}</div></div></div>
      ${isLiveWk(g)?lkLowerHTML(g):thisWeekHTML()}`;
  }
  else if(S.tab==="table")main=playerDataHTML();
  else if(S.tab==="tracker")main=trackerHTML();   /* Bundle D: the Tracker draws its own header */
  else if(S.tab==="xfpl")main=statusPageHTML();
  else if(S.tab==="chips")main=chipsHTML();
  else if(S.tab==="fixtures")main=fixturesHTML();
  else if(S.tab==="rivals")main=trackerHTML();   /* 22 Nov 2026: Rivals folded into League */
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
    </div></div></header>${mnavHTML()}`;
}


/* Status (wave 1): data freshness (moved from the footer), the signal key,
   then the xFPL model page. Wave 7 adds model vs FPL, fixture accuracy,
   odds status and options. */
/* Status, Bundle D (22 Nov 2026, Andy's approved mock 6): a header of figure
   cards, then paired cards in the Signals style. The old full-width panels'
   explanatory notes moved into (i); the dead Projection Movers panel and the
   footnote panel are gone (C16). */
function stMvf(){
  const A=S.playerActuals,rows=[];let tm=0,tf=0,tn=0,tb=0;
  for(let g=1;g<=38;g++){
    if(!weekFinal(g))continue;
    const live=S.predLive&&S.predLive.gw&&S.predLive.gw[g],back=S.predBack&&S.predBack.gw&&S.predBack.gw[g];
    const snap=live||back;if(!snap||!snap.players||!A)continue;
    const ep=snap.fplEp||null;let n=0,em=0,ef=0,b=0;const both=[];
    Object.entries(snap.players).forEach(([id,pred])=>{const a=A[id]||A[+id];const pts=a?(a[g]??a[String(g)]):null;if(pts==null)return;
      const f=ep?ep[id]:null;if(ep&&f==null)return;n++;em+=Math.abs(pred-pts);b+=pred-pts;if(ep){ef+=Math.abs(f-pts);both.push({pred,f,pts});}});
    if(!n)continue;
    const t10=k=>both.slice().sort((x,y)=>y[k]-x[k]).slice(0,10).reduce((s,x)=>s+x.pts,0)/Math.min(10,both.length||1);
    rows.push({g,n,mae:em/n,bias:b/n,fpl:ep?ef/n:null,tM:both.length?t10("pred"):null,tF:both.length?t10("f"):null});
    if(ep){tm+=em;tf+=ef;tn+=n;tb+=b;}
  }
  return{rows,tm,tf,tn,tb};
}
function stFix(){
  if(!S.model||!S.ratingsReady)return null;
  const done=(S.fixtures||[]).filter(f=>f.finished&&f.hs!=null&&f.as!=null&&f.ht&&f.at);if(!done.length)return null;
  let n=0,e=0,eB=0,hit=0,games=0,tot=0;done.forEach(f=>{tot+=f.hs+f.as;});const base=tot/(2*done.length);
  done.forEach(f=>{const ph=fdrCalc(f.ht,f.at,true,"xgf"),pa=fdrCalc(f.at,f.ht,false,"xgf");e+=Math.abs(ph-f.hs)+Math.abs(pa-f.as);eB+=Math.abs(base-f.hs)+Math.abs(base-f.as);n+=2;
    const pr=ph-pa>0.25?1:pa-ph>0.25?-1:0,ac=f.hs>f.as?1:f.as>f.hs?-1:0;if(pr!==0){games++;if(pr===ac)hit++;}});
  return{err:e/n,base:eB/n,avg:base,skill:1-e/eB,hit,games,n:done.length};
}
/* every source the server reports, with its age and state */
function stSources(){
  const st=S.status||{},ds=st.dataset||{},fpl=st.fpl||{},feeds=st.feeds||{},odds=st.odds||{},news=st.news||{};
  const per=Object.values(news.perSource||{}),nOk=per.filter(s=>s.ok!==false).length,nDown=newsDown().length;
  const st1=(ok,warn)=>ok?(warn?"amb":"ok"):"bad";
  return [
    ["FPL Core Insights",ds.committedAt,st1(!ds.lastError,ds.stale)],
    ["FPL prices and flags",fpl.fetchedAt,st1(!fpl.error,agoMin(fpl.fetchedAt)>45)],
    ["FPL live",fpl.liveFetchedAt,"ok"],
    ["Your team and rivals",feeds.lastOk,st1(!feeds.error,!!feeds.warning||agoMin(feeds.lastOk)>45)],
    [`News · ${per.length||"—"} sources`,news.fetchedAt,st1(true,nDown>0)],
    [`Odds${odds.state==="nokey"?" · no key":""}`,odds.fetchedAt,st1(odds.state!=="fail",!!odds.error)],
    ["TV channels",st.tv&&st.tv.fetchedAt,st1(true,agoMin(st.tv&&st.tv.fetchedAt)>8*1440)],
    ["Price predictor",S.fplLive&&S.fplLive.fetchedAt,"ok"],
    ["Snapshots",st.snapshots&&st.snapshots.result&&st.snapshots.result.at,st1(!(st.snapshots&&st.snapshots.result&&st.snapshots.result.ok===false))],
    ["Field sample",st.field&&(st.field.builtAt||st.field.at||st.field.lastOk),"ok"]
  ].map(([n,at,c])=>({n,at,c,okN:nOk}));
}
/* a panel's body without its own header, for use inside a card */
const stBody=h=>String(h||"").replace(/^\s*<div class="panel">/,"<div>").replace(/<div class="phead">[\s\S]*?<\/div>/,"");
/* News sources as a compact grid (the per-source list the News work agreed),
   live first; the hover gives kind, items, last good copy and any error */
function stNewsHTML(){
  const ps=((S.status||{}).news||{}).perSource||{},rows=Object.entries(ps);
  if(!rows.length)return sgEmpty(BACKUP?"News runs on the FPL Signals server only.":"No news check reported yet.");
  const down=new Set(newsDown());
  rows.sort((a,b)=>(down.has(b[0])-down.has(a[0]))||((a[1].kind==="social")-(b[1].kind==="social"))||a[0].localeCompare(b[0]));
  return `<div class="ax-src4">${rows.map(([k,v])=>{const c=v.ok?"ok":down.has(k)?"bad":"amb";
    const tip=`${k}: ${v.kind==="social"?"social media":"news"}, ${+v.count||0} items, last good copy ${v.fetchedAt?agoText(v.fetchedAt):"never"}${v.error?". "+v.error:""}`;
    return `<div class="ax-s" title="${esc(tip)}"><i class="sdot ${c}"></i><span class="ax-nm">${esc(k)}</span><em>${+v.count||0}</em></div>`;}).join("")}</div>`;
}
/* Options as three tiles, each with its one action (Bundle D) */
function stOptionsHTML(){
  const drafts=LS.get("drafts")||[],ign=(S.ignored||[]).map(id=>S.model&&S.model.players.find(p=>p.id===id)).filter(Boolean),st=S.stars||[];
  const t=(l,n,sub,btn)=>`<div class="ds-tile st-opt"><em>${l}</em><b>${n}</b><i>${sub}</i>${btn||""}</div>`;
  return `<div class="ds-tiles" style="grid-template-columns:repeat(3,1fr)">
    ${t("Compare Drafts",drafts.length,drafts.length?"saved":"none saved",drafts.length?`<button onclick="act(cleardrafts)">Delete All</button>`:"")}
    ${t("Not Suggesting",ign.length,ign.length?esc(ign.slice(0,2).map(p=>p.web_name).join(", "))+(ign.length>2?" …":""):"every player can be suggested",ign.length?`<button onclick="act(unignore,${ign[0].id})">Restore ${esc(ign[0].web_name)}</button>`:"")}
    ${t("Shortlist",st.length,st.length?"players":"tap ★ on Player Data",st.length?`<button onclick="act(clearstars)">Clear</button>`:"")}</div>`;
}
function statusPageHTML(){
  const M=stMvf(),cmp=M.rows.filter(r=>r.fpl!=null),fx=stFix(),src=stSources();
  const down=src.filter(s=>s.c!=="ok").length;
  const figs=[
    figCard("Model Error","Average points the model missed by, per player.",M.tn?(M.tm/M.tn).toFixed(2):"—",cmp.length>1?`<span class="${cmp[cmp.length-1].mae<=cmp[cmp.length-2].mae?"up":"dn"}">${cmp[cmp.length-1].mae<=cmp[cmp.length-2].mae?"▼":"▲"} ${Math.abs(cmp[cmp.length-1].mae-cmp[cmp.length-2].mae).toFixed(2)}</span>`:"",cmp.map(r=>-r.mae),"#3DDC97"),
    figCard("Model vs FPL","How much closer the model was than FPL's own.",M.tn?`<span class="${M.tf>M.tm?"up":"dn"}">${sgn1((M.tf-M.tm)/M.tn)}</span>`:"—",`${cmp.filter(r=>r.mae<r.fpl).length} of ${cmp.length} weeks better`,null),
    figCard("Goals Error","Average goals the fixture ratings missed by.",fx?fx.err.toFixed(2):"—","goals per side",null),
    figCard("Sources","Data sources answering now.",`${src.length-down} of ${src.length}`,down?`<span style="color:#FFB020">${down} need a look</span>`:"All live",null)];
  /* Model vs FPL: error each week, model against FPL */
  const mvf=cmp.length?colChart(cmp.map(r=>"GW"+r.g),[],[{name:"Model",values:cmp.map(r=>+r.mae.toFixed(2)),color:SG_TONE.mint},{name:"FPL",values:cmp.map(r=>+r.fpl.toFixed(2)),color:SG_TONE.grey,dash:true}],{fmt:v=>v.toFixed(1),min:0,label:"Prediction error each week, lower is better",legend:true})
    +`<div class="ds-tiles" style="grid-template-columns:repeat(3,1fr);margin-top:8px">${dsTile("Model Bias",sgn1(M.tb/(M.tn||1)),"points per player")}${dsTile("Top 10 Picks",(cmp.reduce((s,r)=>s+(r.tM||0),0)/cmp.length).toFixed(1),`FPL's top 10: ${(cmp.reduce((s,r)=>s+(r.tF||0),0)/cmp.length).toFixed(1)}`)}${dsTile("Weeks Better",`${cmp.filter(r=>r.mae<r.fpl).length} of ${cmp.length}`,"than FPL","up")}</div>`
    :sgEmpty("No finished gameweek with a saved prediction yet.");
  /* Predicted vs Actual: your squad's predicted score (saved before each deadline) against what it scored */
  const T=((S.tracker&&S.tracker.gw)||[]).filter(r=>weekFinal(r.event)&&r.predicted!=null);
  const pva=T.length?colChart(T.map(r=>"GW"+r.event),[{name:"Predicted",values:T.map(r=>+(+r.predicted).toFixed(1)),color:"rgba(154,154,154,.4)"},{name:"Actual",values:T.map(r=>r.points),color:SG_TONE.mint}],[],{label:"Your predicted and actual points each week",legend:true})
    +`<div class="ds-tiles" style="grid-template-columns:repeat(3,1fr);margin-top:8px">${dsTile("Avg Predicted",(T.reduce((s,r)=>s+(+r.predicted),0)/T.length).toFixed(1),"per week")}${dsTile("Avg Actual",(T.reduce((s,r)=>s+r.points,0)/T.length).toFixed(1),"per week","up")}${dsTile("Beat Prediction",`${T.filter(r=>r.points>r.predicted).length} of ${T.length}`,"weeks")}</div>`
    :sgEmpty("Your weekly predictions appear once the feed has saved them.");
  const srcList=`<div class="ax-src2">`+src.map(s=>`<div class="ax-s" title="${s.at?esc(s.n+": "+ukWhen(s.at)):esc(s.n+": no time reported")}"><i class="sdot ${s.c}"></i>${esc(s.n)}<em>${s.at?esc(agoText(s.at)):"—"}</em></div>`).join("")+`</div>`;
  const fxBody=fx?`<div class="ds-tiles" style="grid-template-columns:repeat(3,1fr)">${dsTile("Goals Error",fx.err.toFixed(2),"goals per side","up")}${dsTile("Baseline Error",fx.base.toFixed(2),`average ${fx.avg.toFixed(2)} goals`)}${dsTile("Skill",Math.round(fx.skill*100)+"%","vs the average",fx.skill>0?"up":"dn")}${dsTile("Favourite Won",fx.games?Math.round(fx.hit/fx.games*100)+"%":"—",`${fx.hit} of ${fx.games} matches`)}${dsTile("Matches",fx.n,"rated")}${dsTile("Odds Used",`${(S.odds||[]).length}`,"fixtures priced")}</div>`:sgEmpty("Ratings not ready.");
  const P=xfplHTML("parts")||{};
  return `<div class="sgpage stpage"><div class="sx-hdr"><div><div class="cx-kick">Data and model health</div><h1>Status</h1><div class="sx-ctl">${statusChipHTML()}</div></div><div class="nw-figs sx-figs">${figs.join("")}</div></div>
    <div class="repgrid">
      ${rep("stmvf","gauge","Model vs FPL","Prediction error each finished week; backtest for GW1-6.",mvf)}
      ${rep("stpva","crown","Predicted vs Actual","Your squad's predicted and actual points.",pva)}
      ${rep("stsrc","clock-alert","Data Sources","Each source and when it last answered.",srcList)}
      ${rep("sthit","sparkles","Signal Hit Rates","How far flagged players beat their prediction; three signals are graded.",(signalHitsHTML()?stBody(`<div class="panel"><div class="phead"></div>${signalHitsHTML()}</div>`):sgEmpty("Graded once pre-deadline predictions have been saved.")))}
      ${rep("stnews","newspaper","News Sources","Each news source, its items now, and whether it answers.",stNewsHTML(),{wide:true})}
      ${rep("stfix","target","Fixture Ratings","How well the ratings predicted goals.",fxBody)}
      ${rep("stodds","activity","Odds","The bookmakers' markets the model reads.",oddsStatusHTML()+`<p style="margin:10px 0 0"><a class="btnlink" href="${routeFor("odds")}" onclick="return go(event,'odds')">Bookmaker markets →</a></p>`)}
      ${rep("stmodel","sparkles","xFPL Model","The model's state, accuracy by position and calibration; learning is off.",`<div class="split2"><div>${stBody(P.status)}${stBody(P.pva)}</div><div id="r-stcal"><h4 class="rsub">Calibration</h4>${stBody(P.calib)}</div></div>`,{wide:true})}
      ${rep("stkey","sparkles","Signal Key","What each signal icon means.",legendHTML())}
      ${rep("stopt","calendar","Options","Your saved drafts and lists.",stOptionsHTML())}
    </div></div>`;
}
