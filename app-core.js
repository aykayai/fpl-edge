/* FPL Edge — app-core.js
   data loading, team ratings, FDR, the prediction model

   Part of a single script split across files so each stays small enough to
   fetch whole. Loaded in order as classic scripts, sharing one global scope,
   so the order in index.html matters: app-main.js must come last. */

/* ============================================================
   FPL ASSISTANT v3
   Data: FPL Core Insights (github.com/olbauday/FPL-Core-Insights)
   served from raw.githubusercontent.com with open CORS, so the
   browser can fetch it directly — no proxy, no file juggling.
   ============================================================ */
const REPO="https://raw.githubusercontent.com/olbauday/FPL-Core-Insights/main/data";
const SEASON="2026-2027", LAST="2025-2026";
/* Live "actuals" feed — team GW history, per-player actual points, chips — published
   by a scheduled GitHub Action into the app's own repo (not the insights dataset,
   since this is Andy's own entry data). One file feeds the planner header, every
   pitch card, the xFPL predicted-vs-actual panel, and the whole Tracker page.
   Contract: { season, team:{totalPlayers, gw:[{event,points,gwRank,orRank,bank,
   value,transfers,transferCost,bench,captain,off1m,off500k,off100k,transferDiff}],
   chips:{name:points}}, players:{ "<id>": {"<gw>":points} } }
   Absent or unreachable until the Action exists — every consumer already renders a
   clean waiting state, so this fails silently rather than blocking the main load. */
const ACTUALS_URL="https://raw.githubusercontent.com/aykayai/fpl-edge/main/data/actuals.json";
const RIVALS_URL="https://raw.githubusercontent.com/aykayai/fpl-edge/main/data/rivals.json";
async function loadRivals(){
  try{
    const r=await fetch(RIVALS_URL);
    if(!r.ok)return;
    const d=await r.json();
    if(d&&Array.isArray(d.standings))S.rivalsFeed=d;
  }catch(e){ /* feed not published yet — the page shows its waiting state */ }
}
async function loadActuals(){
  try{
    const r=await fetch(ACTUALS_URL);
    if(!r.ok)return;
    const d=await r.json();
    if(d.team&&Array.isArray(d.team.gw)){
      S.tracker={season:d.season,totalPlayers:d.team.totalPlayers,gw:d.team.gw,chips:d.team.chips||null};
      const am={};d.team.gw.forEach(row=>{if(row.event!=null&&row.points!=null)am[row.event]=row.points;});
      S.actuals=am;
    }
    if(d.players)S.playerActuals=d.players;
  }catch(e){ /* feed not published yet — leave the waiting states in place */ }
}
const TEAM_ID="301830", STATE_VERSION=3;
/* Tabs are real routes, so they can be bookmarked and opened in a new tab. */
const NAV=[
  {group:"Plan", items:[["squad","Team Planner"],["transfers","Transfers"],["chips","Chips"],["rivals","Rivals"],["tracker","Tracker"]]},
  {group:"Tools",items:[["table","Player Data"],["odds","Odds"],["fixtures","Fixtures"],["news","News Feed"]]},
  {group:"Models",items:[["xfpl","xFPL Model"]]}
];
const TABPATH={squad:"team-planner",transfers:"transfers",rivals:"rivals",chips:"chips",tracker:"tracker",
  table:"player-data",xfpl:"xfpl-model",odds:"odds",fixtures:"fixtures",news:"news"};
const FROM_ROUTE=Object.fromEntries(Object.entries(TABPATH).map(([k,v])=>[v,k]));
function routeFor(tab){return "#/"+(TABPATH[tab]||"team-planner");}
function applyHash(){
  const h=(location.hash||"").replace(/^#\/?/,"").replace(/\/$/,"");
  const t=FROM_ROUTE[h];
  if(t&&t!==S.tab){S.tab=t;return true;}
  return false;
}
const APP_VERSION="10.5.0";
const LOGO=`<svg width="40" height="44" viewBox="0 0 200 220" style="flex:none" aria-label="FPL Edge">
 <defs><linearGradient id="lgS" x1="0" y1="0" x2="1" y2="1">
   <stop offset="0" stop-color="#232B38"/><stop offset="1" stop-color="#11161D"/></linearGradient>
  <linearGradient id="lgG" x1="0" y1="1" x2="1" y2="0">
   <stop offset="0" stop-color="#21C97A"/><stop offset="1" stop-color="#5BE8C0"/></linearGradient></defs>
 <path d="M100 8 L184 38 v78c0 46-38 76-84 96-46-20-84-50-84-96V38Z" fill="url(#lgS)" stroke="url(#lgG)" stroke-width="7"/>
 <text x="100" y="104" font-family="Arial Black,Arial,sans-serif" font-size="52" font-weight="900"
   fill="#3DE38C" text-anchor="middle">FPL</text>
 <path d="M44 168 L84 130 L108 152 L152 104" fill="none" stroke="#5BE8C0" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
 <path d="M124 96 L160 96 L160 132" fill="none" stroke="#FF8A3D" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const POS={1:"GKP",2:"DEF",3:"MID",4:"FWD"};
const POSNAME={Goalkeeper:1,Defender:2,Midfielder:3,Forward:4,
 GKP:1,DEF:2,MID:3,FWD:4,GK:1,Goalkeepers:1,Defenders:2,Midfielders:3,Forwards:4};
const posOf=v=>POSNAME[String(v||"").trim()]||POSNAME[String(v||"").trim().replace(/s$/,"")]||0;
const SHAPE={1:2,2:5,3:5,4:3};

/* Squad exactly as picked for GW1 */
/* purchase prices, so the list can show what each player cost against what he
   would now sell for */
const SEED=[["Raya","ARS",1,6.0],["Dubravka","TOT",1,4.0],
 ["Calafiori","ARS",2,5.5],["Maguire","MUN",2,5.0],["De Cuyper","BHA",2,4.5],
 ["O'Shea","IPS",2,4.0],["O'Nien","SUN",2,4.0],
 ["B.Fernandes","MUN",3,12.0],["Mbeumo","MUN",3,8.0],["Szoboszlai","LIV",3,7.0],
 ["Tzolis","ARS",3,6.5],["Slater","HUL",3,4.5],
 ["Haaland","MCI",4,15.5],["João Pedro","CHE",4,7.5],["Calvert-Lewin","LEE",4,6.0]];
const REAL_PRICE={};SEED.forEach(([n,,,pr])=>{REAL_PRICE[n]=pr;});
const norm=s=>(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z]/g,"");

/* Community chip consensus, gathered Aug 2026 */
const CHIP_CONSENSUS={
 bboost1:{weeks:"GW1–2, or straight after a Wildcard",
  text:"Everyone starts with 15 fit players and clean fixtures, so an early Bench Boost needs no build-up. First-half doubles are rare and the chip expires at GW19 — don't hold it for a double that may never come."},
 freehit1:{weeks:"GW3–4 in the popular chip chain",
  text:"A one-week rescue rather than a squad upgrade. Worth holding unless an early blank or a brutal fixture week hits your XI."},
 wildcard1:{weeks:"Around the international break before GW6 (GW5–10 range)",
  text:"Wildcarding on the break before GW6 gives you real form data and sets up a GW7 Bench Boost. Scout flag Fulham, Bournemouth and Brighton home fixtures that week."},
 "3xc1":{weeks:"GW3, or GW7/16",
  text:"Haaland at home to promoted sides is the consensus target — Coventry at home in GW3 is the first. Bruno Fernandes is the main alternative given United's run against promoted opposition."},
 wildcard2:{weeks:"Before the second-half double gameweek run",
  text:"Rebuild for the doubles and blanks once the calendar is published, usually December."},
 freehit2:{weeks:"The major blank, historically GW29–32",
  text:"Timing matters more than squad quality — target the week where half your squad has no fixture."},
 "3xc2":{weeks:"First big double gameweek, historically GW19–22",
  text:"A premium with two fixtures is the textbook target. Remember only one chip per gameweek, so it competes with Bench Boost."},
 bboost2:{weeks:"A double gameweek where all 15 have two fixtures",
  text:"Pair it with a Wildcard the week before so every bench slot is a starter rather than fodder."}
};

/* ---------- kits ---------- */
const KITS={ARS:{b:"#EF0107",s:"#FFFFFF"},MCI:{b:"#6CABDD",s:"#6CABDD"},LIV:{b:"#C8102E",s:"#C8102E"},
 MUN:{b:"#DA291C",s:"#DA291C"},CHE:{b:"#034694",s:"#034694"},TOT:{b:"#FFFFFF",s:"#FFFFFF"},
 AVL:{b:"#670E36",s:"#95BFE5"},NEW:{b:"#FFFFFF",s:"#241F20",p:1,t:"#241F20"},
 BHA:{b:"#FFFFFF",s:"#0057B8",p:1,t:"#0057B8"},BOU:{b:"#DA291C",s:"#000000",p:1,t:"#000000"},
 BRE:{b:"#FFFFFF",s:"#E30613",p:1,t:"#E30613"},CRY:{b:"#1B458F",s:"#1B458F",p:1,t:"#C4122E",w:5},
 EVE:{b:"#003399",s:"#003399"},FUL:{b:"#FFFFFF",s:"#000000"},NFO:{b:"#DD0000",s:"#DD0000"},
 WHU:{b:"#7A263A",s:"#1BB1E7"},WOL:{b:"#FDB913",s:"#231F20"},LEE:{b:"#FFFFFF",s:"#FFFFFF"},
 COV:{b:"#78D0F3",s:"#78D0F3"},HUL:{b:"#F5A12D",s:"#000000",p:1,t:"#000000"},
 IPS:{b:"#3A64A3",s:"#FFFFFF"},SUN:{b:"#FFFFFF",s:"#EB172B",p:1,t:"#EB172B"},
 BUR:{b:"#6C1D45",s:"#99D6EA"},LEI:{b:"#003090",s:"#003090"},SOU:{b:"#FFFFFF",s:"#D71920",p:1,t:"#D71920"},
 _d:{b:"#8A7FA8",s:"#6E6489"}};
const GK_KIT={b:"#2ED47A",s:"#1B9E56"};
const BODY="M13.5 6 L11 7.2 L11 34 L29 34 L29 7.2 L26.5 6 L24.5 8.4 Q20 11.6 15.5 8.4 Z";
function shirtSVG(short,isGK,size){
  const k=isGK?GK_KIT:(KITS[short]||KITS._d);
  const light=["#FFFFFF","#FFF200","#F5A12D","#FDB913","#78D0F3"].includes(k.b);
  const st=light?"#4A4458":"rgba(0,0,0,.4)";const id="c"+(short||"d")+(isGK?"g":"o");
  let str="";if(k.p){const w=k.w||3;for(let x=11;x<29;x+=w*2)str+=`<rect x="${x}" y="5" width="${w}" height="30" fill="${k.t}"/>`;}
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true" style="display:block;flex:none">
   <defs><clipPath id="${id}"><path d="${BODY}"/></clipPath></defs>
   <path d="M13.5 6 L5.5 10.5 L8.5 17.5 L11.6 15.4 L11 7.2 Z" fill="${k.s}" stroke="${st}" stroke-width=".9" stroke-linejoin="round"/>
   <path d="M26.5 6 L34.5 10.5 L31.5 17.5 L28.4 15.4 L29 7.2 Z" fill="${k.s}" stroke="${st}" stroke-width=".9" stroke-linejoin="round"/>
   <path d="${BODY}" fill="${k.b}"/><g clip-path="url(#${id})">${str}</g>
   <path d="${BODY}" fill="none" stroke="${st}" stroke-width=".9" stroke-linejoin="round"/>
   <path d="M15.5 8.4 Q20 11.6 24.5 8.4" fill="none" stroke="${st}" stroke-width="1.1"/></svg>`;
}
/* Absolute bands on points per gameweek */
function ptsCol(v){
  if(v>=7)return[...PBAND[7],"elite"];
  return PBAND[clamp(Math.floor(v),0,6)];
}
/* Eight steps, dark red through to bright green — one band per whole point */
const PBAND=[["#4A0010","#FFD9DF"],["#96122A","#FFE3E8"],["#D4545E","#3A0009"],
  ["#E0631E","#2A1000"],["#2E9E52","#EAFFF1"],["#3FBF63","#06240F"],
  ["#5FE083","#04250D"],["#7DFB9E","#042A0E"]];
/* One seven-step ramp, dark red through to bright green, used for both
   projected points and fixture difficulty so the two read consistently. */
const RAMP=[["#5C0011","#FFD9DF"],["#96122A","#FFE3E8"],["#C0392B","#FFF0F2"],
  ["#E0631E","#2A1000"],["#F0A02A","#2A1000"],["#2E9E52","#EAFFF1"],
  ["#3FBF63","#06240F"],["#7DFB9E","#042A0E"]];
const fdrCol=d=>({5:["#4A0010","#FFD9DF"],4:["#C0182F","#FFF0F2"],3:["#F0A02A","#2A1000"],
  2:["#2E9E52","#EAFFF1"],1:["#7DFB9E","#042A0E"]}[d]||["#F0A02A","#2A1000"]);
/* One pill renderer so every fixture looks the same wherever it appears.
   Away games are italic. */
/* THE fixture pill. Every tab uses this so colour, italics and abbreviation
   behave identically: away games are italic, home games upright. */
/* Which difficulty applies to this player: keepers and defenders are judged on
   the opponent's attack, midfielders and forwards on their defence. */
function posDiff(p,f){return p.pos<=2?(f.diffDef??f.diff):(f.diffAtt??f.diff);}
function fdrPill(opp,home,diff,opts){
  const o=opts||{};
  const[b,c]=fdrCol(diff);
  const label=o.short?String(opp).slice(0,3):String(opp);
  const sz=o.tiny?"font-size:8px;padding:1px 4px;":"";
  return `<span class="fdrpill" style="background:${b};color:${c};${sz}${home?"":"font-style:italic;"}${o.style||""}"
    title="${esc(opp)} ${home?"(home)":"(away)"} · difficulty ${diff}">${esc(label)}</span>`;
}

/* ---------- CSV ---------- */
function parseCSV(text){
  const rows=[];let f="",row=[],q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
    else if(c==='"')q=true;
    else if(c===","){row.push(f);f="";}
    else if(c==="\n"){row.push(f);rows.push(row);row=[];f="";}
    else if(c!=="\r")f+=c;}
  if(f.length||row.length){row.push(f);rows.push(row);}
  if(!rows.length)return[];
  const head=rows[0].map(h=>h.trim());
  return rows.slice(1).filter(r=>r.length>1).map(r=>{
    const o={};head.forEach((h,i)=>o[h]=r[i]);return o;});
}
const num=v=>{const n=parseFloat(v);return isNaN(n)?0:n;};

/* ---------- state ---------- */
const S={players:null,teams:null,fixtures:null,events:null,model:null,last:null,
 squad:null,original:null,captain:null,vice:null,forceXI:null,subFrom:null,
 flagged:[],benchOrder:null,bank:0,ft:1,chips:{},horizon:1,tab:"squad",
 loading:false,progress:"",err:null,stamp:null,seeded:false,
 news:[],reddit:[],squadNews:[],srcLog:{},srcFilter:null,playerFilter:null,entryRank:null,ignored:[],odds:[],oddsDemo:false,oddsLog:[],oddsState:'nokey',oddsKey:'',oddsErr:'',oddsTeams:null,oddsView:'att',oddsMarkets:null,rivals:[],rivalSel:0,rivalsFeed:null,rivalPick:null,rivalGwView:"next",newsState:"idle",newsWindow:24,expand:{},pendingOpt:null,tracker:null,trkStat:"points",trkGwStart:0,trkGwAll:false,radarIds:[null,null,null],radarSearch:["","",""],radarHorizon:5,actuals:null,playerActuals:{},xfplGW:0,
 fPos:0,fTeam:0,fMin:3.5,fMax:16,startGW:0,lPos:0,lTeam:0,lSearch:"",lMax:16,lHorizon:1,lWin:38,iconF:[],spF:null,starOnly:false,stars:[],fSearch:"",sortKey:"pred",sortDir:"desc",
 lSort:"pred",lDir:"desc",fixGW:null,fixSort:"d5",fixDir:"asc",fdrLens:null,fixMode:"team",
 outList:[],selected:null,menuOpen:false,compare:null,replacedBy:{},dash:{},sqView:'pitch',sqSort:'pos',sqDir:'asc',cardId:null,chipView:'fh',chipHalf:null,fhForm:null,wcForm:null};
const LS={get(k){try{return JSON.parse(localStorage.getItem("fpl3:"+k));}catch(e){return null;}},
 set(k,v){try{localStorage.setItem("fpl3:"+k,JSON.stringify(v));}catch(e){}}};

/* ============================================================
   LOADING
   ============================================================ */
async function getCSV(path){
  const r=await fetch(`${REPO}/${path}`);
  if(!r.ok)throw new Error(path+" → HTTP "+r.status);
  return parseCSV(await r.text());
}
async function loadAll(force){
  S.loading=true;S.err=null;render();
  try{
    const cached=LS.get("data");
    if(cached&&!force&&Date.now()-cached.t<1000*60*60*6){
      Object.assign(S,{players:cached.players,teams:cached.teams,fixtures:cached.fixtures,
        events:cached.events,last:cached.last,pre:cached.pre||{},preMax:cached.preMax||1,lastTeams:cached.lastTeams||{},lastTeamStats:cached.lastTeamStats||{},lastTeamRecent:cached.lastTeamRecent||{},hist:cached.hist||{},teamMatch:cached.teamMatch||{},stamp:cached.t});
      buildModel();Promise.all([loadActuals(),loadRivals()]).then(render);S.loading=false;return;
    }
    S.progress="players and prices…";render();
    const [players,pstats,teams]=await Promise.all([
      getCSV(`${SEASON}/players.csv`),
      getCSV(`${SEASON}/playerstats.csv`),
      getCSV(`${SEASON}/teams.csv`)]);

    S.progress="last season…";render();
    let lastStats=[];
    try{lastStats=await getCSV(`${LAST}/playerstats.csv`);}catch(e){}

    S.progress="fixtures…";render();
    const fixtures=[];
    for(let batch=1;batch<=38;batch+=8){
      const jobs=[];
      for(let gw=batch;gw<batch+8&&gw<=38;gw++){
        jobs.push(getCSV(`${SEASON}/By%20Gameweek/GW${gw}/fixtures.csv`).catch(()=>[]));
      }
      (await Promise.all(jobs)).forEach(rows=>rows.forEach(f=>{
        /* the gameweek folders also carry EFL Cup ties — those are not FPL
           fixtures and were producing duplicate/incorrect opponents */
        const mid=String(f.match_id||"");
        if(mid&&!/-prem-/.test(mid))return;
        if(f.home_team&&f.away_team)fixtures.push({
          event:Math.round(num(f.gameweek)),h:Math.round(num(f.home_team)),a:Math.round(num(f.away_team)),
          hElo:num(f.home_team_elo),aElo:num(f.away_team_elo),
          kickoff:f.kickoff_time||"",finished:String(f.finished).toLowerCase()==="true",
          hs:f.home_score===""?null:num(f.home_score),as:f.away_score===""?null:num(f.away_score)});
      }));
      S.progress=`fixtures… ${Math.min(38,batch+7)}/38`;render();
    }
    /* Pre-season friendlies carry the only real signal on who is starting
       before a ball is kicked in the league */
    S.progress="pre-season minutes…";render();
    const pre={};
    try{
      const rows=await getCSV(`${SEASON}/By%20Tournament/Friendlies/GW0/playermatchstats.csv`);
      rows.forEach(r=>{const id=Math.round(num(r.player_id));if(!id)return;
        const o=pre[id]=pre[id]||{mins:0,apps:0,starts:0,g:0,a:0,cs:0,conc:0,sv:0,dc:0,dcHits:0,pm:0};
        const m=num(r.minutes_played);
        o.mins+=m;o.apps++;
        if(num(r.start_min)===0&&m>0)o.starts++;
        o.g+=num(r.goals);o.a+=num(r.assists);
        o.conc+=num(r.team_goals_conceded);
        if(m>=60&&num(r.team_goals_conceded)===0)o.cs++;
        o.sv+=num(r.saves);o.pm+=num(r.penalties_missed);
        const dcv=num(r.defensive_contributions);o.dc+=dcv;o.dcRows=(o.dcRows||0)+1;
        o.dcList=(o.dcList||[]);o.dcList.push(dcv);
      });
      S.preMax=Math.max(1,...Object.values(pre).map(v=>v.apps));
    }catch(e){}
    S.pre=pre;
    let events=[];
    try{events=(await getCSV(`${SEASON}/gameweek_summaries.csv`)).map(e=>({
      id:Math.round(num(e.id)),name:e.name,deadline:e.deadline_time,
      finished:String(e.finished).toLowerCase()==="true"}));}catch(e){}

    /* merge players + stats */
    const byId={};players.forEach(p=>byId[p.player_id]={
      id:Math.round(num(p.player_id)),code:p.player_code,first:p.first_name,last:p.second_name,
      web_name:p.web_name,teamCode:p.team_code,pos:posOf(p.position)||3});
    pstats.forEach(s=>{const p=byId[s.id];if(p)Object.assign(p,{stats:s});});
    const lastByCode={};lastStats.forEach(s=>{if(s.id)lastByCode[s.id]=s;});
    /* Keyed by player_code: web_name is not unique — 17 names are shared this
       season, and keying by name gave 29 players another player's history
       (Reece James's record landing on a Leeds midfielder, and so on). */
    /* playerstats carries only last season's id, so map it to the stable code
       through that season's players.csv */
    const lastIdToCode={};
    try{
      const lp=await getCSV(`${LAST}/players.csv`);
      lp.forEach(r=>{lastIdToCode[String(Math.round(num(r.player_id)))]=String(r.player_code);});
    }catch(e){}
    const lastByCode2={};
    lastStats.forEach(s=>{const code=lastIdToCode[String(Math.round(num(s.id)))];
      if(code)lastByCode2[code]=s;});
    const lastByName={};lastStats.forEach(s=>{
      const k=norm(s.web_name);
      if(!lastByName[k])lastByName[k]=s; else lastByName[k]="__AMBIGUOUS__";});

    /* last season's team goals for and against — the base for the ratings */
    const lt={};const tstat={};
    try{
      const lteams=await getCSV(`${LAST}/teams.csv`);
      const codeToShort={};lteams.forEach(t=>codeToShort[t.code]=t.short_name);
      const lfix=[];
      for(let batch=1;batch<=38;batch+=10){
        const jobs2=[];
        for(let gw=batch;gw<batch+10&&gw<=38;gw++)
          jobs2.push(getCSV(`${LAST}/By%20Gameweek/GW${gw}/fixtures.csv`).catch(()=>[]));
        (await Promise.all(jobs2)).forEach(rows=>rows.forEach(f=>{
          if(!/-prem-/.test(String(f.match_id||"")))return;
          const hs=f.home_score,as=f.away_score;
          if(hs===""||as===""||hs==null||as==null)return;
          const H=codeToShort[Math.round(num(f.home_team))],A=codeToShort[Math.round(num(f.away_team))];
          lfix.push({h:H,a:A,hs:num(hs),as:num(as)});
          /* richer team signals than goals alone */
          [[H,A,"home"],[A,H,"away"]].forEach(([me,opp,side])=>{
            if(!me)return;
            const t=tstat[me]=tstat[me]||{n:0,xg:0,xga:0,npxg:0,sp:0,spA:0,bc:0,bcA:0,box:0,boxA:0,xgot:0,xgotA:0,seq:[]};
            t.n++;
            t.seq.push({gw:Math.round(num(f.gameweek)),
              xg:num(side==="home"?f.home_expected_goals_xg:f.away_expected_goals_xg),
              xga:num(side==="home"?f.away_expected_goals_xg:f.home_expected_goals_xg)});
            t.xg+=num(side==="home"?f.home_expected_goals_xg:f.away_expected_goals_xg);
            t.xga+=num(side==="home"?f.away_expected_goals_xg:f.home_expected_goals_xg);
            t.npxg+=num(side==="home"?f.home_non_penalty_xg:f.away_non_penalty_xg);
            t.sp+=num(side==="home"?f.home_xg_set_play:f.away_xg_set_play);
            t.spA+=num(side==="home"?f.away_xg_set_play:f.home_xg_set_play);
            t.bc+=num(side==="home"?f.home_big_chances:f.away_big_chances);
            t.bcA+=num(side==="home"?f.away_big_chances:f.home_big_chances);
            t.box+=num(side==="home"?f.home_touches_in_opposition_box:f.away_touches_in_opposition_box);
            t.boxA+=num(side==="home"?f.away_touches_in_opposition_box:f.home_touches_in_opposition_box);
            t.xgot+=num(side==="home"?f.home_xg_on_target_xgot:f.away_xg_on_target_xgot);
            t.xgotA+=num(side==="home"?f.away_xg_on_target_xgot:f.home_xg_on_target_xgot);
          });}));
      }
      lfix.forEach(f=>{
        if(!f.h||!f.a)return;
        (lt[f.h]=lt[f.h]||{gf:0,ga:0,games:0});(lt[f.a]=lt[f.a]||{gf:0,ga:0,games:0});
        lt[f.h].gf+=f.hs;lt[f.h].ga+=f.as;lt[f.h].games++;
        lt[f.a].gf+=f.as;lt[f.a].ga+=f.hs;lt[f.a].games++;});
    }catch(e){}
    S.lastTeams=lt;S.lastTeamStats=tstat;
    /* the closing eight matches of the season, as a recent-form window */
    const recent={};
    Object.entries(tstat).forEach(([sh,t])=>{
      const seq=(t.seq||[]).sort((a,b)=>a.gw-b.gw).slice(-8);
      if(seq.length)recent[sh]={n:seq.length,
        xg:seq.reduce((a,x)=>a+x.xg,0),xga:seq.reduce((a,x)=>a+x.xga,0)};
    });
    S.lastTeamRecent=recent;

    /* ---- per-match player history ----
       63 columns per player per match, which is what makes real rolling windows,
       venue splits and a proper minutes model possible. ~3MB a season, cached. */
    S.progress="match history…";render();
    /* player_id is re-issued every season — only player_code is stable, so the
       history is keyed by code and joined to this season's ids at the end. */
    const idToCode={};
    try{
      const lastPlayers=await getCSV(`${LAST}/players.csv`);
      lastPlayers.forEach(r=>{idToCode["last|"+Math.round(num(r.player_id))]=String(r.player_code);});
    }catch(e){}
    players.forEach(r=>{idToCode["now|"+Math.round(num(r.player_id))]=String(r.player_code);});
    const hist={};                       // player_code -> [match rows, oldest first]
    const teamMatch={};                  // match_id -> {h,a,gw}
    try{
      for(const[season,tag] of [[LAST,"last"],[SEASON,"now"]]){
        for(let batch=1;batch<=38;batch+=10){
          const jobs3=[];
          for(let gw=batch;gw<batch+10&&gw<=38;gw++)
            jobs3.push(Promise.all([
              getCSV(`${season}/By%20Gameweek/GW${gw}/playermatchstats.csv`).catch(()=>[]),
              getCSV(`${season}/By%20Gameweek/GW${gw}/matches.csv`).catch(()=>[])
            ]).then(([pm,mm])=>({gw,pm,mm,tag})));
          (await Promise.all(jobs3)).forEach(({gw,pm,mm,tag})=>{
            mm.forEach(m=>{const id=String(m.match_id||"");
              if(!id||!/-prem-/.test(id))return;
              teamMatch[id]={h:Math.round(num(m.home_team)),a:Math.round(num(m.away_team)),gw,tag,
                hxg:num(m.home_expected_goals_xg),axg:num(m.away_expected_goals_xg),
                hnp:num(m.home_non_penalty_xg),anp:num(m.away_non_penalty_xg),
                hsp:num(m.home_xg_set_play),asp:num(m.away_xg_set_play),
                hbox:num(m.home_touches_in_opposition_box),abox:num(m.away_touches_in_opposition_box),
                hpos:num(m.home_possession),apos:num(m.away_possession)};});
            pm.forEach(r=>{
              const mid=String(r.match_id||"");
              const meta=teamMatch[mid];
              if(!meta)return;                       // cup ties and non-league matches
              const pid=Math.round(num(r.player_id));if(!pid)return;
              const code=idToCode[tag+"|"+pid];if(!code)return;
              (hist[code]=hist[code]||[]).push({
                gw,tag,mid,
                mins:num(r.minutes_played),start:r.start_min===""?null:num(r.start_min),
                g:num(r.goals),a:num(r.assists),xg:num(r.xg),xa:num(r.xa),
                sh:num(r.total_shots),sot:num(r.shots_on_target),
                cc:num(r.chances_created),box:num(r.touches_opposition_box),
                f3:num(r.final_third_passes),drb:num(r.successful_dribbles),
                bcm:num(r.big_chances_missed),
                dc:num(r.defensive_contributions),
                cbit:num(r.clearances)+num(r.blocks)+num(r.interceptions)+num(r.tackles),
                aer:num(r.aerial_duels_won),
                sv:num(r.saves),gc:num(r.goals_conceded),
                xgot:num(r.xgot_faced),gp:num(r.goals_prevented),
                pens:num(r.penalties_scored),penm:num(r.penalties_missed),
                tgc:num(r.team_goals_conceded)});
            });
          });
        }
      }
    }catch(e){}
    /* stamp each appearance with venue and opponent */
    Object.values(hist).forEach(rows=>rows.forEach(r=>{
      const m=teamMatch[r.mid];if(!m)return;r.mgw=m.gw;}));
    Object.keys(hist).forEach(k=>hist[k].sort((x,y)=>(x.tag===y.tag? x.gw-y.gw : (x.tag==="last"?-1:1))));
    S.hist=hist;S.teamMatch=teamMatch;

    /* ---- cold start ----
       168 players have no Premier League history, 91 of them at the three
       promoted clubs. Rather than leave them blank or lean on a price guess,
       build per-position profiles from the clubs promoted a year earlier
       (Burnley, Leeds, Sunderland in 2025/26) — the closest available analogue
       for how a promoted side's players actually perform in this division. */
    try{
      const lteams=await getCSV(`${LAST}/teams.csv`);
      const promotedLast=["BUR","LEE","SUN"];
      const codesOf={};lteams.forEach(t=>{if(promotedLast.includes(t.short_name))codesOf[t.code]=t.short_name;});
      const lastPl=await getCSV(`${LAST}/players.csv`);
      const profile={};                       // pos -> array of per-90 profiles
      lastPl.forEach(r=>{
        if(!codesOf[r.team_code])return;
        const code=String(r.player_code), ps=posOf(r.position);
        const rows=(hist[code]||[]).filter(x=>x.tag==="last");
        const mins=rows.reduce((a,x)=>a+x.mins,0);
        if(mins<400)return;
        const per90=k=>rows.reduce((a,x)=>a+(x[k]||0),0)*90/mins;
        /* the share of matches in which he actually cleared the DefCon
           threshold — not his average expressed as a fraction of it, which is
           what the cold-start path used to derive and which put promoted
           defenders above the best in the league */
        const thr=ps===2?10:12;
        const elig=rows.filter(x=>x.mins>=60);
        const dcHitReal=elig.length?elig.filter(x=>x.dc>=thr).length/elig.length:0;
        (profile[ps]=profile[ps]||[]).push({dcHitReal,
          mins,xg90:per90("xg"),xa90:per90("xa"),dc90:per90("dc"),cbit90:per90("cbit"),
          cc90:per90("cc"),box90:per90("box"),sh90:per90("sh"),sot90:per90("sot"),
          aer90:per90("aer"),sv90:per90("sv"),
          gc90:(()=>{const q=rows.filter(x=>x.mins>=60);return q.length?q.reduce((a,x)=>a+x.tgc,0)/q.length:1.7;})(),
          minsPerApp:mins/rows.length,
          startPct:rows.filter(x=>x.start===0).length/rows.length});
      });
      /* median profile per position, plus a scaling by price rank within club */
      const med=(a,k)=>{const v=a.map(x=>x[k]).sort((x,y)=>x-y);return v.length?v[Math.floor(v.length/2)]:0;};
      S.coldStart={};
      Object.entries(profile).forEach(([ps,a])=>{
        S.coldStart[ps]={};
        ["xg90","xa90","dc90","cbit90","cc90","box90","sh90","sot90","aer90","sv90","gc90","minsPerApp","startPct","dcHitReal"]
          .forEach(k=>S.coldStart[ps][k]=med(a,k));
        S.coldStart[ps].n=a.length;
      });
    }catch(e){S.coldStart=null;}
    /* venue and opponent for every appearance, so home/away splits work */
    const shortByCode={};S.teams&&S.teams.forEach(t=>shortByCode[t.code]=t.short);
    Object.values(hist).forEach(rows=>rows.forEach(r=>{
      const m=teamMatch[r.mid];if(!m)return;
      r.opp=null;r.home=null;}));
    S.players=Object.values(byId).filter(p=>p.stats);
    S.teams=teams.map(t=>({id:Math.round(num(t.id)),code:t.code,name:t.name,short:t.short_name,
      strength:num(t.strength),elo:num(t.elo),
      sah:num(t.strength_attack_home),saa:num(t.strength_attack_away),
      sdh:num(t.strength_defence_home),sda:num(t.strength_defence_away),
      soh:num(t.strength_overall_home),soa:num(t.strength_overall_away),
      fdrHome:num(t.strength_overall_home),fdrAway:num(t.strength_overall_away)}));
    /* one fixture per club pair per gameweek, whatever the source sends */
    const fseen=new Set();
    S.fixtures=fixtures.filter(f=>{
      const k=f.event+"|"+Math.min(f.h,f.a)+"|"+Math.max(f.h,f.a);
      if(fseen.has(k))return false;fseen.add(k);return true;});
    S.events=events;S.last={byName:lastByName,byCode:lastByCode2};
    S.stamp=Date.now();
    LS.set("data",{t:S.stamp,players:S.players,teams:S.teams,fixtures:S.fixtures,events,last:S.last,pre:S.pre,preMax:S.preMax,lastTeams:S.lastTeams,lastTeamStats:S.lastTeamStats,lastTeamRecent:S.lastTeamRecent,hist:S.hist,teamMatch:S.teamMatch});
    buildModel();await Promise.all([loadActuals(),loadRivals()]);toast("Live data loaded");
  }catch(e){
    S.err="Couldn't load the dataset: "+e.message+". Check your connection and try again.";
  }
  S.loading=false;S.progress="";render();
}

/* ============================================================
   MODEL
   ============================================================ */
const GOAL_PTS={1:10,2:6,3:5,4:4}, CS_PTS={1:4,2:4,3:1,4:0}, DC_THRESH={1:99,2:10,3:12,4:12};
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

/* Elo spread → 1-5 difficulty, adjusted for venue */
/* Difficulty 1-5 from the opponent's Elo, ranked against the league rather than
   stretched between two extremes — one runaway team was skewing every band.
   Home advantage is applied as an Elo shift (~65 pts), which is the accepted
   figure, before the band is assigned. */
function eloDiff(){return 3;}   /* superseded by fdrOf() */

/* Fixture difficulty from FPL's own team strength ratings, banded into league
   quintiles. Elo alone put Newcastle near the top while they faced Liverpool. */
/* ============================================================
   FIXTURE DIFFICULTY
   Separate attack and defence ratings per club, split home and away, built
   from expected goals rather than results. Difficulty is then contextual:
   a keeper faces the opponent's ATTACK, a striker faces their DEFENCE — the
   single opponent-strength number every public FDR uses conflates the two.
   Output stays on the familiar 1-5 scale but is computed continuously and
   only rounded at the end, so the spread is far wider than the source data.
   ============================================================ */

/* Championship form for the promoted sides, from their 2025/26 campaigns.
   Second-tier output does not translate one-for-one, so it is discounted:
   attack x0.62, defence x0.70 against Premier League baselines. */
const PROMOTED={
  COV:{gf:97/46, ga:48/46, note:"champions by 11 pts, 97 goals"},
  IPS:{gf:80/46, ga:47/46, note:"best xGA in the division, 1.01 per 90"},
  HUL:{gf:62/46, ga:58/46, note:"6th, promoted via play-offs, overperformed xG"}
};
const CHAMP_ATT=0.62, CHAMP_DEF=0.70, PL_GF=1.42;

function buildRatings(){
  const T=S.teams;
  const last=S.lastTeams||{};
  T.forEach(t=>{
    const L=last[t.short];
    const TS=(S.lastTeamStats||{})[t.short];
    const pm=PROMOTED[t.short];
    let gf,ga;
    /* Recent form matters more than a season-long average: a side that finished
       badly should be rated as it finished, not as its May-to-May mean. */
    const RC=(S.lastTeamRecent||{})[t.short];
    if(TS&&TS.n>=10){
      /* expected goals rather than goals: less noisy and it stabilises faster.
         Set-play xG and big chances are kept alongside for the position lenses. */
      /* Expected goals alone miss persistent finishing and goalkeeping quality.
         Man City conceded 0.92 goals a game against an xGA of 1.18 — a keeper
         effect that recurs season to season — so rating them purely on xGA made
         them look a softer fixture than Everton, which is plainly wrong. FPL
         Form blend actual goals with xGA for the same reason. */
      const seasonGf0=TS.npxg/TS.n*0.75+TS.xg/TS.n*0.25, seasonGa0=TS.xga/TS.n;
      const realGf=L&&L.games>=10?L.gf/L.games:seasonGf0;
      const realGa=L&&L.games>=10?L.ga/L.games:seasonGa0;
      const seasonGf=seasonGf0*0.62+realGf*0.38;
      const seasonGa=seasonGa0*0.62+realGa*0.38;
      if(RC&&RC.n>=6){
        const w=0.40;                                   // 40% last eight, 60% season
        gf=seasonGf*(1-w)+(RC.xg/RC.n)*w;
        ga=seasonGa*(1-w)+(RC.xga/RC.n)*w;
        t.formGf=RC.xg/RC.n; t.formGa=RC.xga/RC.n;
      }else{gf=seasonGf;ga=seasonGa;}
      t.spFor=TS.sp/TS.n; t.spAgainst=TS.spA/TS.n;
      t.bcFor=TS.bc/TS.n; t.bcAgainst=TS.bcA/TS.n;
      t.boxFor=TS.box/TS.n; t.boxAgainst=TS.boxA/TS.n;
      /* gap between shots faced and goals allowed isolates the keeper */
      t.keeper=TS.xgotA>0?clamp((TS.xgotA-(L?L.ga:TS.xga))/TS.n,-0.6,0.6):0;
      t.ratingSrc="xG, last season";
    }
    else if(L&&L.games>=10){ gf=L.gf/L.games; ga=L.ga/L.games; t.ratingSrc="goals, last season"; }
    else if(pm){
      /* Championship goals, discounted to Premier League terms */
      /* Championship output, translated. Attack is discounted hard; defence is
         anchored well above the league average because promoted sides concede
         far more against top-flight attacks than their second-tier record
         suggests — the historical shift is roughly +0.45 goals a game. */
      /* Championship output translated, then pulled back toward the league
         average. An inference from second-tier goals should not be more extreme
         than anything we actually measured in the Premier League. */
      const rawGf=pm.gf*CHAMP_ATT, rawGa=PL_GF*1.18+(pm.ga-1.15)*0.55;
      gf=rawGf*0.80+PL_GF*0.20;
      ga=rawGa*0.80+PL_GF*0.20;
      t.ratingSrc="Championship, discounted";
    } else {
      /* fall back to FPL's own 1-5 rating */
      const o=(num(t.fdrHome)+num(t.fdrAway))/2||3;
      gf=PL_GF*(0.72+(o-1)*0.16); ga=PL_GF*(1.30-(o-1)*0.16);
      t.ratingSrc="FPL strength";
    }
    /* pre-season friendlies nudge it, lightly — they are weak evidence */
    t.attRaw=clamp(gf,0.55,2.55);
    t.defRaw=clamp(ga,0.55,2.55);
  });
  /* normalise so the league averages 1.42 goals a side */
  const mA=T.reduce((a,t)=>a+t.attRaw,0)/T.length;
  const mD=T.reduce((a,t)=>a+t.defRaw,0)/T.length;
  T.forEach(t=>{
    t.att=t.attRaw*(PL_GF/mA);
    t.def=t.defRaw*(PL_GF/mD);
    /* Home advantage is club-specific — stronger sides travel better — but it
       is applied ONCE per fixture, not to both clubs. Splitting it in half here
       means a home side and its visiting opponent together produce the intended
       swing rather than double it. Sized so venue moves a fixture roughly 0.5-1.0
       of a band, which is what the published models report. */
    const rel=clamp((t.att-t.def)/1.2,-1,1);
    const ha=(0.11+0.05*(1-Math.abs(rel)))/2;
    t.ha=ha;
    t.attH=t.att*(1+ha); t.attA=t.att*(1-ha);
    t.defH=t.def*(1-ha); t.defA=t.def*(1+ha);
    t.ovr=1150+((t.att-t.def)*185);
  });
  S.ratingsReady=true;
}

/* Continuous difficulty, 1 (easiest) to 5 (hardest).
   kind: "att" = how hard for OUR attackers (opponent's defence)
         "def" = how hard to keep a clean sheet (opponent's attack) */
/* Cut points fitted so the mix of bands matches how the established tickers
   present: most fixtures 2 or 3, red reserved for genuinely hard trips. */
/* Attack and defence need different distributions, not one shared mix. Clean
   sheets are rarer than goals, so the published tickers rate defensive fixtures
   harder on average (mean 3.36) than attacking ones (2.72). Using one mix for
   both had our levels inverted — attacking fixtures reading harder than
   defensive ones, the opposite of every reference. */
/* Both arrays run from the lowest expected-goals fixtures upward. For defence
   that means easiest first; for attack the mapping inverts, so the same
   ordering runs hardest first. Written out per lens to avoid the confusion. */
const BAND_MIX_ATT=[0.06,0.18,0.32,0.29,0.15];   // low xGF = hard for attackers
const BAND_MIX_DEF=[0.05,0.16,0.32,0.30,0.17];   // low xGC = easy for defenders
function buildBands(){
  const g=S.model?S.model.next.id:1;
  const att=[],def=[];
  for(let e=g;e<=38;e++)(S.model.byEv[e]||[]).forEach(f=>{
    if(!f.ht||!f.at)return;
    [[f.ht,f.at,true],[f.at,f.ht,false]].forEach(([t,o,home])=>{
      att.push(fdrCalc(t,o,home,"xgf"));
      def.push(fdrCalc(t,o,home,"xgc"));});});
  const cuts=(arr,mix)=>{const v=arr.slice().sort((a,b)=>a-b);
    const out=[];let acc=0;
    for(let i=0;i<4;i++){acc+=mix[i];out.push(v[Math.min(v.length-1,Math.floor(acc*v.length))]);}
    return out;};
  S.bandCuts={att:cuts(att,BAND_MIX_ATT),def:cuts(def,BAND_MIX_DEF)};
}
function bandOf(v,kind){
  const c=S.bandCuts&&S.bandCuts[kind];
  if(!c)return 3;
  if(kind==="def"){                       // more expected goals against = harder
    for(let i=0;i<4;i++)if(v<c[i])return i+1;
    return 5;
  }
  for(let i=0;i<4;i++)if(v<c[i])return 5-i;   // more expected goals for = easier
  return 1;
}
function fdrCalc(team,opp,home,kind){
  if(!opp||!S.ratingsReady)return 3;
  const oppAtt=home?opp.attA:opp.attH;      // their attack, at this venue
  const oppDef=home?opp.defA:opp.defH;      // their defence, at this venue
  const ourAtt=team?(home?team.attH:team.attA):PL_GF;
  const ourDef=team?(home?team.defH:team.defA):PL_GF;
  /* standard multiplicative goal model, normalised to the league average */
  const xGF=(ourAtt*oppDef)/PL_GF;          // goals we expect to score
  const xGC=(oppAtt*ourDef)/PL_GF;          // goals we expect to concede

  /* The 1-5 band is for display. Clamping it loses real signal at the extremes —
     every Man City home game pinned to 1 — so callers that feed the projection
     ask for the raw expected goals instead. */
  if(kind==="xgf")return xGF;
  if(kind==="xgc")return xGC;
  /* Bands come from where this fixture sits in the season's own distribution,
     not a fixed goals-per-band step. A linear step cannot be both skewed toward
     2-3, as the published tickers are, and still reach 5 at the extremes — the
     spread of expected goals is simply too narrow. Percentiles give both. */
  return kind==="def" ? bandOf(xGC,"def") : bandOf(xGF,"att");
}
/* Backwards-compatible single number, used for the tickers and colours */
function fdrOf(opp,home,team,kind){
  if(!opp)return 3;
  if(S.ratingsReady){
    const a=fdrCalc(team,opp,home,"att");
    const d=fdrCalc(team,opp,home,"def");
    const v=kind==="att"?a:(kind==="def"?d:(a+d)/2);
    return clamp(Math.round(v),1,5);
  }
  const direct=home?num(opp.fdrAway):num(opp.fdrHome);
  if(direct>=1&&direct<=5)return clamp(Math.round(direct+(home?-0.35:0.35)),1,5);
  return 3;
}
const fdrExact=(opp,home,team,kind)=>S.ratingsReady
  ? clamp(kind==="att"?fdrCalc(team,opp,home,"att")
        :kind==="def"?fdrCalc(team,opp,home,"def")
        :(fdrCalc(team,opp,home,"att")+fdrCalc(team,opp,home,"def"))/2,1,5)
  : 3;

/* ============================================================
   ROLLING WINDOWS
   Any stat over the last N appearances. This replaces the single blended
   form number with the multi-horizon view the published models use.
   ============================================================ */
function windowStats(code,n,pos,price,teamMax){
  const rows=(S.hist&&S.hist[code])||[];
  if(!rows.length){
    /* no Premier League history: use the promoted-club profile for the position,
       scaled by how the player is priced relative to his club's most expensive.
       Flagged so the table can show it as an estimate. */
    const cs=S.coldStart&&S.coldStart[pos];
    if(!cs)return null;
    const rel=teamMax>0?clamp(price/teamMax,0.45,1.35):1;
    const k=0.55+0.55*rel;
    return{estimated:true,apps:0,mins:0,starts:0,
      startPct:clamp(cs.startPct*rel,0.05,0.92),
      minsPerApp:clamp(cs.minsPerApp*rel,8,88),
      g:0,a:0,
      xg90:cs.xg90*k,xa90:cs.xa90*k,npxg90:cs.xg90*k*0.82,
      sh90:cs.sh90*k,sot90:cs.sot90*k,cc90:cs.cc90*k,box90:cs.box90*k,
      f390:0,drb90:0,aer90:cs.aer90,bcm:0,
      dc90:cs.dc90,cbit90:cs.cbit90,
      /* measured from the analogue squads rather than derived from an average */
      dcHit:clamp(cs.dcHitReal!=null?cs.dcHitReal*rel:0.18,0,0.70),
      sv90:cs.sv90,gc90:cs.gc90,xgot90:0,gp:0,cs:0,
      csRate:Math.exp(-clamp(cs.gc90,0.3,3.2))};
  }
  const take=n>=38?rows:rows.slice(-n);
  if(!take.length)return null;
  /* ---- recency and season weighting ----
     A window that treats a match from August 2025 as equal evidence to one
     played last Saturday is the wrong shape once results start arriving. Each
     appearance therefore carries a weight:

       this season  SEASON_W x 0.5^(appsAgo / HALF_LIFE)
       last season  1, faded down as this season accrues

     Two deliberate constraints. The decay runs over THIS SEASON'S appearances
     only, and last season's rows stay flat: fading a last-season-only history
     would move every pre-season projection, and the published GW1-8 reference
     set is a pre-GW1 snapshot that must not shift. And the last-season fade is
     a function of how many matches this season actually has, so at zero it is
     exactly 1. Together these make the whole block inert until a ball is
     kicked -- identical numbers, by construction, not by luck.

     Counts (apps, mins, starts, goals) stay raw: they are used as evidence
     gates -- wd.apps>=8, wq.mins>600 -- and weighting them would silently move
     the thresholds. Only rates are weighted. */
  const SEASON_W=2.0, HALF_LIFE=6, LAST_FLOOR=0.35, FADE_OVER=12;
  const nowRows=take.filter(r=>r.tag==="now");
  const nowApps=nowRows.filter(r=>r.mins>0).length;
  const lastW=1-(1-LAST_FLOOR)*clamp(nowApps/FADE_OVER,0,1);
  const nowIdx=new Map();
  nowRows.forEach((r,i)=>nowIdx.set(r,nowRows.length-1-i));   // 0 = most recent
  const wt=r=>r.tag==="now"
    ? SEASON_W*Math.pow(0.5,(nowIdx.get(r)||0)/HALF_LIFE)
    : lastW;

  const sum=k=>take.reduce((a,r)=>a+(r[k]||0),0);
  const wsum=(k,rs)=>(rs||take).reduce((a,r)=>a+wt(r)*(r[k]||0),0);
  const mins=sum("mins");
  const wMins=wsum("mins");
  /* weighted per 90: weighted total over weighted minutes, so a heavily
     weighted match raises the numerator and denominator together */
  const per90=k=>wMins>0?wsum(k)*90/wMins:0;
  const apps=take.length;
  /* start_min is 0 both for a player who kicked off and for one who never came
     on, so a start only counts when he actually played. */
  const played=take.filter(r=>r.mins>0);
  const starts=played.filter(r=>r.start===0).length;
  /* weighted share of a filtered subset, e.g. how often the DefCon threshold
     was cleared, counting recent matches for more */
  const wShare=(rs,ok)=>{const tot=rs.reduce((a,r)=>a+wt(r),0);
    return tot>0?rs.filter(ok).reduce((a,r)=>a+wt(r),0)/tot:0;};
  const played60=take.filter(r=>r.mins>=60);
  const wPlayed=played.reduce((a,r)=>a+wt(r),0);
  const wAll=take.reduce((a,r)=>a+wt(r),0);
  return{
    apps:played.length,mins,starts,
    startPct:wPlayed>0?wShare(played,r=>r.start===0):0,
    minsPerApp:wAll>0?wMins/wAll:0,
    g:sum("g"),a:sum("a"),
    xg90:per90("xg"),xa90:per90("xa"),
    npxg90:wMins>0?(wsum("xg")-wsum("pens")*0.79)*90/wMins:0,
    sh90:per90("sh"),sot90:per90("sot"),
    cc90:per90("cc"),box90:per90("box"),f390:per90("f3"),drb90:per90("drb"),
    aer90:per90("aer"),bcm:sum("bcm"),
    dc90:per90("dc"),cbit90:per90("cbit"),
    /* how often he actually clears the DefCon threshold, not his average */
    dcHit:wShare(played60,r=>r.dc>=(S._dcThresh||10)),
    sv90:per90("sv"),gc90:per90("gc"),xgot90:per90("xgot"),
    gp:sum("gp"),gp90:per90("gp"),
    cs:take.filter(r=>r.mins>=60&&r.tgc===0).length,
    csRate:wShare(played60,r=>r.tgc===0)
  };
}
/* cache, because the table recomputes on every render */
const _wsCache={};
function ws(code,pos,n,price,teamMax){
  const k=code+"|"+pos+"|"+n;
  if(_wsCache[k]!==undefined)return _wsCache[k];
  S._dcThresh=pos===2?10:12;
  return _wsCache[k]=windowStats(code,n,pos,price,teamMax);
}
/* most expensive player at each club, for scaling the cold-start profile */
function teamMaxPrice(teamId){
  if(!S._tmax){S._tmax={};(S.model?S.model.players:[]).forEach(p=>{
    S._tmax[p.team]=Math.max(S._tmax[p.team]||0,p.price);});}
  return S._tmax[teamId]||10;
}

/* ---- expected minutes ----
   Fitted per position against Fantasy Football Hub's published xMins
   (n=289). Keepers are role-based: one plays, the understudy does not. */
const XM={
  2:{a:77.1,last:0.16,pre:0.04,price:-1.41},
  3:{a:56.0,last:0.23,pre:0.06,price:0.94},
  4:{a:14.0,last:0.44,pre:0.22,price:3.60}
};
const GK_START=89, GK_BACKUP=15;
/* How far a fixture moves a player's score around his own average. Retuned
   after the xG engine took over the fixture view: 1.26 against the published
   projections' own 1.28 across 55 players and 8 gameweeks. */
/* Stretching each player around his own season average was reordering players:
   a weak player in a relatively good week outranked a strong player in a
   relatively poor one, because the stretch is blind to how good he is. With the
   xG engine now supplying genuine fixture swing this only needs to be a light
   touch, not the heavy correction it was before that engine existed. */
const FIXTURE_AMP=1.45;
/* how much of the fixture view comes from the new xG ratings */
/* The fixture view now comes wholly from the xG engine. The older
   strength-difference calculation was blended in at 35% as a hedge while the
   ratings were unproven; refitting across 440 per-gameweek observations shows
   it no longer adds anything (MAE 0.467 blended vs 0.455 pure), so it is gone. */
const FDR_MIX=1.00;
/* Pecking order isn't derivable from minutes alone (a settled keeper is rested
   in pre-season). Taken from the published projections — one per club. */
const GK_FIRST=["Raya","Donnarumma","A.Becker","Lammens","Pope","Sánchez","Kelleher","Leno",
 "Sels","Martinez","Verbruggen","Pickford","Kinsky","Henderson","Perri","Roefs","Petrović",
 "Butland","Rushworth","Scherpen"].map(norm);
/* Points-per-minute correction, also fitted against the same reference */
/* Refitted so each position's mean matches the published projections.
   learn() nudges these once real gameweeks exist. */
/* ---- calibration ----
   Fitted by least squares against 72 published GW1 projections plus 289
   eight-gameweek ones. Two terms per position: A is a per-appearance floor
   (bonus, defensive contribution and the appearance points our components
   under-count) scaled by expected minutes so cameo players don't inherit it,
   and B rescales the spread. Applied as: points = A x minutesFactor + B x raw. */
/* Fitted against 440 published per-gameweek projections (55 players x 8 GWs)
   rather than a single week — the earlier single-week fit was leaving defenders
   more than a point per game high. */
/* Fitted per position against 440 published per-gameweek projections.
   Keepers and defenders are fitted for lowest error; midfielders and forwards
   are fitted to match how far apart the published projections put players,
   because minimising error alone pulls every attacker toward the mean and the
   premiums stop separating from the crowd. */
/* Refitted after the expected-minutes rebuild, against 440 published
   per-gameweek projections. Midfielders and forwards carry a 30% wider slope
   than least squares alone would give: minimising error pulls every attacker
   toward the mean and the premiums stop separating from the crowd. */
/* Refitted after the expected-minutes rebuild. Validated against two
   independent reference sets — 292 players over 8 gameweeks, and 55 players
   week by week — which pull in opposite directions, so these sit between them
   rather than fitting either alone. Midfielders and forwards keep a wider
   slope than least squares gives, or the premiums stop separating. */
const CAL_BASE={1:{A:0.51,B:0.77},2:{A:1.92,B:0.33},3:{A:2.45,B:0.39},4:{A:1.18,B:0.55}};
let CAL={1:{...CAL_BASE[1]},2:{...CAL_BASE[2]},3:{...CAL_BASE[3]},4:{...CAL_BASE[4]}};

/* Once real gameweeks exist, compare what each position actually returns per
   appearance with what we project and nudge B toward the truth. Needs 25+
   players and is capped at +/-30% so one freak week can't distort the model. */
function applyLearning(){
  CAL={1:{...CAL_BASE[1]},2:{...CAL_BASE[2]},3:{...CAL_BASE[3]},4:{...CAL_BASE[4]}};
  const L=LS.get("learn");if(!L)return;
  [1,2,3,4].forEach(k=>{
    if(!L[k]||L[k].n<25)return;
    /* spread widens or narrows the gap between players; scale lifts the level */
    if(L[k].spread)CAL[k].B=clamp(CAL_BASE[k].B*L[k].spread,CAL_BASE[k].B*0.7,CAL_BASE[k].B*1.5);
    if(L[k].scale) CAL[k].A=clamp(CAL_BASE[k].A*L[k].scale, CAL_BASE[k].A*0.7,CAL_BASE[k].A*1.4);
  });
}
function learnFromResults(){
  if(!S.model||S.model.gwPlayed<1)return;
  const g=S.model.next.id;
  /* Two things are learned separately once results exist:
     - scale: does this position score more or less than we project overall
     - spread: are we too flat or too spiky across players in the position
     Both need real evidence, so nothing moves until 25+ regular starters and
     4+ gameweeks are in, and both are capped. */
  const acc={1:[],2:[],3:[],4:[]};
  S.model.players.forEach(pl=>{
    if(!pl.minutes||pl.xMins<45)return;
    const proj=pl.gw[g]?.pts||0;if(proj<=0)return;
    const actual=pl.total/Math.max(1,S.model.gwPlayed);
    (acc[pl.pos]||[]).push({a:actual,p:proj});});
  const out=LS.get("learn")||{};
  [1,2,3,4].forEach(k=>{
    const a=acc[k];if(!a||a.n<0||a.length<25||S.model.gwPlayed<4)return;
    const ma=a.reduce((s2,x)=>s2+x.a,0)/a.length;
    const mp=a.reduce((s2,x)=>s2+x.p,0)/a.length;
    const sa=Math.sqrt(a.reduce((s2,x)=>s2+(x.a-ma)**2,0)/a.length);
    const sp=Math.sqrt(a.reduce((s2,x)=>s2+(x.p-mp)**2,0)/a.length);
    out[k]={scale:clamp(mp>0?ma/mp:1,0.7,1.4),
            spread:clamp(sp>0.05?sa/sp:1,0.7,1.5),
            n:a.length,gw:S.model.gwPlayed};});
  if(Object.keys(out).length){LS.set("learn",out);applyLearning();}
}
function buildModel(){
  const teams={};S.teams.forEach(t=>teams[t.id]=t);
  const byCode={};S.teams.forEach(t=>byCode[t.code]=t);
  const refs=new Set();S.fixtures.forEach(f=>{refs.add(f.h);refs.add(f.a);});
  let hc=0,hi2=0;refs.forEach(r=>{if(byCode[r])hc++;if(teams[r])hi2++;});
  const anyTeam=hc>=hi2?(k=>byCode[k]||teams[k]||null):(k=>teams[k]||byCode[k]||null);
  buildRatings();
  /* Which strength fields carry data has changed upstream more than once — Elo
     was populated, now it is blank and strength_overall_* hold FPL's 1-5 ratings.
     Take whichever is present, normalise to one scale, and fall back to price-
     weighted squad value if a club has neither. */
  const hasFdr=S.teams.some(t=>num(t.soh)>0&&num(t.soh)<=5);
  const hasElo=S.teams.some(t=>num(t.elo)>1000);
  let vals=[];
  S.teams.forEach(t=>{
    let v;
    if(S.ratingsReady&&t.ovr) v=t.ovr;                          // xG-based rating
    else if(hasFdr) v=1150+((num(t.soh)+num(t.soa))/2-3)*95;   // 1-5 -> ~960-1340
    else if(hasElo) v=1150+(num(t.elo)-1800)*0.42;
    else{const sq=S.players.filter(p=>p.teamCode===t.code);
      const val=sq.reduce((a,p)=>a+num(p.stats?.now_cost),0)/Math.max(1,sq.length);
      v=1150+(val-50)*3.2;}
    t.ovr=v;vals.push(v);
    if(!num(t.sah)||num(t.sah)<100){t.sah=v+45;t.saa=v-45;}
    if(!num(t.sdh)||num(t.sdh)<100){t.sdh=v+45;t.sda=v-45;}
  });
  /* if every club came out identical the source is unusable — spread by squad value */
  if(Math.max(...vals)-Math.min(...vals)<1){
    S.teams.forEach(t=>{const sq=S.players.filter(p=>p.teamCode===t.code);
      const val=sq.reduce((a,p)=>a+num(p.stats?.now_cost),0)/Math.max(1,sq.length);
      t.ovr=1150+(val-50)*3.2;t.sah=t.ovr+45;t.saa=t.ovr-45;t.sdh=t.ovr+45;t.sda=t.ovr-45;});
  }
  const strSorted=S.teams.map(t=>t.ovr).filter(v=>v&&isFinite(v)).sort((a,b)=>a-b);
  S.strSorted=strSorted;

  const evs=(S.events||[]).slice().sort((a,b)=>a.id-b.id);
  const gwPlayed=evs.filter(e=>e.finished).length;
  const nextEv=evs.find(e=>!e.finished)||{id:1,name:"Gameweek 1"};

  const byEv={};S.fixtures.forEach(f=>{f.ht=anyTeam(f.h);f.at=anyTeam(f.a);
    (byEv[f.event]=byEv[f.event]||[]).push(f);});
  S.model={teams:S.teams,byEv,strSorted,next:nextEv,gwPlayed};
  const teamFix=(team,e)=>(byEv[e]||[]).filter(f=>f.ht===team||f.at===team).map(f=>{
    const home=f.ht===team,opp=home?f.at:f.ht;
    return{opp:opp?.short||"?",oppName:opp?.name||"",home,oppId:opp?.id,oppT:opp,
      diff:fdrOf(opp,home,team),
      diffAtt:fdrOf(opp,home,team,"att"),diffDef:fdrOf(opp,home,team,"def"),
      xAtt:fdrExact(opp,home,team,"att"),xDef:fdrExact(opp,home,team,"def"),
      xgf:fdrCalc(team,opp,home,"xgf"),xgc:fdrCalc(team,opp,home,"xgc")};});

  /* Odds-derived team expectations, when the Odds tab has fetched them.
     Bookmakers price team news faster than any stats feed. */
  const oddsFor=(team,opp,home)=>{
    const M=S.oddsTeams;if(!M)return null;
    const k=(team.short||"")+"|"+(opp.short||"")+(home?"|H":"|A");
    return M[k]||null;
  };
  /* club price ceilings, needed before the player loop for cold-start scaling */
  /* keyed by both club id and code — the player record carries teamCode, but a
     mismatch here silently returned 0 and made every fringe player look like
     his club's most expensive */
  S._tmaxRaw={};
  S.players.forEach(p=>{
    const v=num(p.stats?.now_cost);if(!v)return;
    const t=S.teams.find(x=>x.code===p.teamCode||x.id===p.teamCode);
    [p.teamCode,t&&t.code,t&&t.id].forEach(k=>{if(k!=null)S._tmaxRaw[k]=Math.max(S._tmaxRaw[k]||0,v);});
  });
  S.bandCuts=null;buildBands();
  const players=S.players.map(p=>{
    const s=p.stats, team=byCode[p.teamCode]||{};
    const price=num(s.now_cost), mins=num(s.minutes), starts=num(s.starts);
    /* code first; fall back to name only when it is unambiguous */
    let L=S.last?.byCode?.[String(p.code||"")];
    if(!L){const cand=S.last?.byName?.[norm(p.web_name)];
      if(cand&&cand!=="__AMBIGUOUS__")L=cand;}
    const lastMins=L?num(L.minutes):0, lastPPG=L?num(L.points_per_game):0;
    const lastStarts=L?num(L.starts):0, lastApps=L?Math.max(num(L.starts),Math.round(num(L.minutes)/60)):0;
    const pr=S.pre?S.pre[p.id]:null;
    /* Friendlies are a weak minutes signal: managers rotate heavily and hand
       fringe players full matches, so a raw per-friendly average badly overrates
       squad players. Discount it, and only trust it where the player actually
       featured in most of the friendlies. */
    const preApp=pr?pr.apps:0, preTot=pr?pr.mins:0;
    const preShare=S.preMax?clamp(preApp/S.preMax,0,1):0;
    const preMinPerApp=(pr&&preApp&&preTot>=100)
      ? (preTot/preApp)*(0.35+0.45*preShare)     // max ~80% of face value
      : 0;

    /* pre-season friendly form, scored under this season's rules */
    let preForm=0,preApps=0;
    if(pr&&pr.apps>0){
      preApps=pr.apps;
      const gp={1:10,2:6,3:5,4:4}[p.pos]||4, cp={1:4,2:4,3:1,4:0}[p.pos]||0;
      let pts=pr.g*gp+pr.a*3+pr.cs*cp-pr.pm*2;
      if(p.pos<=2)pts-=Math.floor(pr.conc/2);
      if(p.pos===1)pts+=Math.floor(pr.sv/3);
      if(DC_THRESH[p.pos]<50&&pr.dcList)pts+=2*pr.dcList.filter(v=>v>=DC_THRESH[p.pos]).length;
      pts+=Math.min(pr.apps,Math.round(pr.mins/60))*2+Math.max(0,pr.apps-Math.round(pr.mins/60));
      preForm=+(pts/pr.apps).toFixed(1);
    }
    const liveForm=num(s.form);
    const pricePrior=clamp((price-4.0)*0.62+1.8,0.8,7.2);
    /* Pre-season counts once a player has 90+ minutes of it — exposure, not
       appearance count. Between 90 and 270 we blend toward last season so one
       good friendly can't dominate. */
    const preMins=pr?pr.mins:0;
    /* Friendlies are played at reduced intensity against mixed opposition, and
       testing showed they inflate form against last season's league output.
       They now act only as a small adjustment, never as the base. */
    const usePre=preForm>0&&preMins>=100;
    const preTrust=usePre?clamp((preMins-100)/300,0,1)*0.22:0;
    /* base is last season; for players without one, the promoted-club analogue
       scaled by price rather than a bare price curve */
    let baseForm;
    if(lastPPG>0)baseForm=lastPPG;
    else{
      const cs=S.coldStart&&S.coldStart[p.pos];
      const rel=clamp(price/Math.max(4,(S._tmaxRaw&&S._tmaxRaw[p.teamCode])||100)*10,0.4,1.4);
      baseForm=cs?clamp(1.6*rel+(p.pos>=3?cs.xg90*2.2:cs.dc90*0.16),0.6,5.5):pricePrior;
    }
    const form=liveForm>0?liveForm
      :(usePre?+(preForm*preTrust+baseForm*(1-preTrust)).toFixed(2):baseForm);
    const formSrc=liveForm>0?"this season":(usePre?`25/26 + pre-season`
      :(lastPPG>0?"2025/26":"price prior"));

    /* availability, and a parsed return date where the game gives one */
    const st=s.status||"a";
    let av=1;
    if(st==="u"||st==="n"||st==="s")av=0;
    else if(st==="i"||st==="d"){const c=s.chance_of_playing_next_round;
      av=(c===""||c==null)?0.5:num(c)/100;}
    const back=parseReturn(s.news||"");

    /* expected minutes */
    /* ---- expected minutes ----
       Validated against 292 published projections: minutes error correlates
       0.92 with points error, so this is the single thing worth getting right.
       Start rate is the strongest predictor; how long he lasts when he starts
       is the second. A player with no Premier League history is placed by his
       price relative to his club's most expensive player, which is the only
       squad-status signal available before a ball is kicked. */
    let xMins, minsSrc="regression";
    const hist=(S.hist&&S.hist[String(p.code||"")])||[];
    const lastRows=hist.filter(r=>r.tag==="last");
    const liveRows=hist.filter(r=>r.tag==="now");
    const rows=liveRows.length>=3?liveRows:lastRows;
    /* price relative to the most expensive player at the same club — both in
       the same units, or the term saturates and every player gets the same lift */
    const clubMax=(S._tmaxRaw&&S._tmaxRaw[p.teamCode])||price||10;
    const rel=clamp(price/Math.max(4,clubMax),0.25,1.0);
    if(rows.filter(r=>r.mins>0).length>=10){
      const recent=rows.filter(r=>r.mins>0).slice(-12);
      const startRate=recent.filter(r=>r.start===0).length/recent.length;
      const startedMins=recent.filter(r=>r.start===0&&r.mins>0).map(r=>r.mins);
      const whenStarts=startedMins.length
        ? clamp(startedMins.reduce((a,x)=>a+x,0)/startedMins.length,55,90) : 78;
      const benchMins=recent.filter(r=>r.start!==0&&r.mins>0).map(r=>r.mins);
      const offBench=benchMins.length?benchMins.reduce((a,x)=>a+x,0)/benchMins.length:16;
      /* 0.80 rather than a full 88: a regular starter still misses matches for
         knocks, suspensions and rotation that last season's record cannot show */
      /* Fitted per position against 215 published expected-minutes figures.
         The exponent on start rate matters: below 1 for outfield defenders and
         midfielders, because an occasional starter still starts more often than
         his raw rate suggests; above 1 for forwards, where rotation is harsher
         and last season's starts overstate this season's role. */
      const MP={1:{pw:0.60,fl:55,sc:1.15},2:{pw:0.60,fl:80,sc:1.05},
                3:{pw:0.60,fl:80,sc:1.05},4:{pw:1.25,fl:55,sc:1.05}}[p.pos]
                ||{pw:1,fl:70,sc:1};
      const srP=Math.pow(clamp(startRate,0,1),MP.pw);
      const ws2=Math.max(MP.fl,whenStarts);
      xMins=clamp((srP*ws2+(1-srP)*offBench)*MP.sc,0,90);
      minsSrc="appearances";
    }
    else if(gwPlayed>2&&mins>0){xMins=clamp(mins/gwPlayed,0,90);minsSrc="this season";}
    else{
      /* No Premier League history. For a player signed from abroad, pre-season
         is the only evidence of his role and is worth using once he has 180+
         minutes of it. Promoted clubs are excluded: their whole squad lacks
         history, so pre-season minutes there reflect a second-tier pecking
         order rather than a Premier League one. */
      const preMinsRaw=pr?pr.mins:0, preAppsRaw=pr?pr.apps:0;
      const promotedClub=!!PROMOTED[(team&&team.short)||""];
      if(!promotedClub&&preMinsRaw>=180&&preAppsRaw>=3){
        const perApp=clamp(preMinsRaw/preAppsRaw,0,90);
        const trust=clamp((preMinsRaw-180)/240,0,1)*0.45+0.45;
        xMins=clamp(perApp*trust+rel*66*(1-trust),8,88);
        minsSrc="pre-season";
      }else{
        const preSignal=preAppsRaw>=2?clamp(preMinsRaw/preAppsRaw,0,90):0;
        xMins=clamp(rel*66+preSignal*0.22, 6, 86);
        minsSrc="no history";
      }
    }
    if(av===0)xMins=0; else xMins*=clamp(av,0,1);

    /* 30% last season, 30% season to date, 40% last six gameweeks — the
       weighting the public component models converge on. `form` already is
       FPL's own ~30-day rolling average, so it stands in for the recent window. */
    const recentW=gwPlayed>0?clamp(gwPlayed/6,0,1)*0.40:0;
    /* Shrink a rate toward the prior in proportion to how much evidence backs
       it, rather than switching abruptly at 900 minutes. A player with 450
       minutes keeps roughly two-thirds of his own rate instead of half. */
    /* This season's rate takes over smoothly rather than at a cliff. The old
       rule ignored this season entirely below 270 minutes whenever a player
       had last-season data, then switched to this-season-only in one step --
       so a striker three games into a hot run was still being projected off
       last May until his fourth start. NOW_FULL is where this season carries
       the rate outright; below it the two blend.
       At mins=0 the ramp is 0 and cur is 0, so this returns the prior exactly
       as before: pre-season projections, and the published GW1-8 reference
       set, are untouched. */
    const NOW_FULL=250;
    const pick=(a,b,fb,lim)=>{const cur=num(a);
      const rel=clamp(lastMins/(lastMins+420),0,0.95);
      const y=L?num(b):0;
      const prior=y>0?(y*rel+fb*(1-rel)):fb;
      const nowTrust=cur>0?clamp(mins/NOW_FULL,0,1):0;
      const v=cur>0?cur*nowTrust+prior*(1-nowTrust):prior;
      return lim?clamp(v,0,lim):v;};
    const posPrior={1:0,2:.06,3:.16,4:.34}[p.pos]||.15;
    const xg90=pick(s.expected_goals_per_90,L&&L.expected_goals_per_90,posPrior*(price/8),{1:.05,2:.35,3:.9,4:1.3}[p.pos]);
    const xa90=pick(s.expected_assists_per_90,L&&L.expected_assists_per_90,posPrior*.55*(price/8),{1:.05,2:.35,3:.7,4:.6}[p.pos]);
    const dc90=pick(s.defensive_contribution_per_90,L&&L.defensive_contribution_per_90,{1:0,2:7.5,3:5.5,4:2.5}[p.pos],22);
    const gc90=clamp(pick(s.expected_goals_conceded_per_90,L&&L.expected_goals_conceded_per_90,1.35),.3,3.5);
    const sv90=p.pos===1?clamp(pick(s.saves_per_90,L&&L.saves_per_90,2.6),0,7):0;
    /* shot-stopping above expectation, per 90 — separates the keeper from
       the defence in front of him */
    /* share of matches in which he actually cleared the DefCon threshold */
    let dcHitRate=null;
    if(p.pos>1){const wd=ws(String(p.code||""),p.pos,38,price,(S._tmaxRaw&&S._tmaxRaw[p.teamCode])||100);
      if(wd&&!wd.estimated&&wd.apps>=8)dcHitRate=clamp(wd.dcHit,0,0.85);}
    let gpRate=0;
    if(p.pos===1){const wq=ws(String(p.code||""),1,38,price,(S._tmaxRaw&&S._tmaxRaw[p.teamCode])||100);
      if(wq&&wq.mins>600)gpRate=clamp(wq.gp90*0.35,-0.3,0.3);}
    const bonus90=mins>180?num(s.bonus)*90/mins:(L&&num(L.minutes)>500?num(L.bonus)*90/num(L.minutes):.15);
    const penOrder=num(s.penalties_order)||99;
    const setOrder=Math.min(num(s.corners_and_indirect_freekicks_order)||99,num(s.direct_freekicks_order)||99);
    /* A side wins roughly 0.15 penalties a game, converted about 79% of the
       time. For a forward that is worth ~0.47 points, not the flat 1.0 this
       carried — which was handing Hull's taker almost as much as his entire
       attacking output. Scaled by the club's attacking strength, since a weak
       team wins far fewer penalties, and trimmed because a player's xG per 90
       already contains the penalties he took. */
    /* published duties override the dataset's order, which lags transfers */
    const duty=SETPIECE[(team.short||"").toUpperCase()];
    const isNamed=(k)=>{const me=norm(p.web_name);
      return !!(duty&&(duty[k]||[]).some(nm=>{const t=norm(nm);
        return t&&(me===t||me.includes(t)||t.includes(me));}));};
    const penRate=isNamed("P")?0.45:(penOrder===1?0.30:(penOrder===2?0.08:0));
    const setBoost=(isNamed("F")||isNamed("C"))?0.30:(setOrder===1?0.22:(setOrder===2?0.08:0));
    const epNext=num(s.ep_next);

    return{id:p.id,code:String(p.code||""),web_name:p.web_name,first:p.first,last:p.last,pos:p.pos,
      team:team.id,teamName:team.short||"",teamFull:team.name||"",price,
      form,formSrc,preForm,preApps,lastForm:+lastPPG.toFixed(1),lastMins,lastStarts,preMinPerApp,
      priceChange:num(s.cost_change_event)/10,seasonChange:num(s.cost_change_start)/10,ppg:num(s.points_per_game),total:num(s.total_points),
      owned:num(s.selected_by_percent),minutes:mins,status:st,news:s.news||"",back,
      minsSrc,xg90,xa90,dc90,dcHitRate,gc90,sv90,gpRate,bonus90,penBoost:penRate,setBoost,epNext,avail:av,xMins,
      bonus:num(s.bonus),bps:num(s.bps),ict:num(s.ict_index),
      pensSaved:num(s.penalties_saved),ownGoals:num(s.own_goals),
      spThreat:num(s.set_piece_threat),penOrder:penOrder,tIn:num(s.transfers_in_event),gw:{},_team:team};
  });

  /* keepers: exactly one starts */
  const gkClub={};
  players.filter(p=>p.pos===1).forEach(p=>{(gkClub[p.team]=gkClub[p.team]||[]).push(p);});
  Object.values(gkClub).forEach(list=>{
    /* An unavailable first choice does not keep the shirt — the deputy starts.
       Hull's pinned keeper was injured and the club ended up with nobody
       projected to play at all. */
    const rank=p=>(p.avail>0?1e9:0)
      +(GK_FIRST.includes(norm(p.web_name))?1e7:0)
      +p.lastMins*3+p.price*400+(p.preMinPerApp||0)*4;
    list.sort((a,b)=>rank(b)-rank(a));
    list.forEach((p,i)=>{if(p.avail<=0){p.xMins=0;return;}
      /* only one keeper plays: the understudy is projected at zero, not a fraction */
      p.xMins=(i===0?GK_START*clamp(p.avail,0,1):0);
      if(i>0)p.backup=true;});
  });
  /* an absent team-mate frees minutes for whoever is fit behind him */
  const cp={};players.forEach(p=>{(cp[p.team+"|"+p.pos]=cp[p.team+"|"+p.pos]||[]).push(p);});
  Object.values(cp).forEach(list=>{
    const out=list.filter(p=>p.avail<=0), fit=list.filter(p=>p.avail>0);
    if(!out.length||!fit.length)return;
    const lift=clamp(1+out.reduce((a,p)=>a+clamp(p.price/8,.25,1.2),0)*0.12,1,1.3);
    fit.forEach(p=>{if(p.xMins>=84||p.pos===1)return;p.xMins=Math.round(clamp(p.xMins*lift,0,89));p.lifted=true;});
  });

  /* per-gameweek projection */
  players.forEach(p=>{
    const team=p._team;
    /* Appearance behaviour is what gives cameo players their floor: a 15-minute
       average means he features most weeks, just briefly. */
    /* These used to saturate at 75 and 80 minutes, so two-thirds of the active
       pool were treated identically however many minutes they were expected to
       play — a player on 81 scored exactly like one on 90. Extended so the
       75-90 band still separates, which is where most regulars sit. */
    const pPlay=clamp(p.xMins/17,0,.985);
    const p60=clamp((p.xMins-22)/62,0,.985);
    const share=clamp(p.xMins/90,0,1);
    /* An injury suppresses the next few weeks, not the whole season. A player
       with a known return date misses until then and resumes his normal role
       after; without one, he is assumed out about four gameweeks then eased in. */
    const outUntil=(()=>{
      if(p.avail>0)return 0;
      if(p.back&&p.back!=="unknown"){
        const m=/^(\d{2})-([A-Za-z]{3})$/.exec(p.back);
        if(m){
          const mi=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(m[2]);
          if(mi>=0){
            const now=new Date();
            let yr=now.getFullYear();
            if(mi<now.getMonth()-3)yr++;
            const back=new Date(yr,mi,+m[1]);
            const ev=(S.events||[]).filter(x=>x.deadline).sort((a,b)=>a.id-b.id);
            const first=ev.find(x=>new Date(x.deadline)>=back);
            return first?first.id:S.model.next.id+4;
          }
        }
        return S.model.next.id+8;
      }
      return S.model.next.id+4;
    })();
    for(let e=S.model.next.id;e<=38;e++){
      const fx=teamFix(team,e);
      if(!fx.length){p.gw[e]={pts:0,fixtures:[],blank:true};continue;}
      let tot=0;
      fx.forEach(f=>{
        const opp=f.oppT||{};
        /* Fixture swing. The +/-30% used by most public component models is
           too tight — it is the main reason projections look flat week to week.
           Widened to +/-60% on attack and +/-55% on defence, which is what the
           spread between the best and worst matchups actually justifies. */
        /* difficulty is now position-aware: attackers are judged against the
           opponent's defence, keepers and defenders against their attack */
        const rawA=(((f.home?team.sah:team.saa)||1150)-((f.home?opp.sda:opp.sdh)||1150))/1000;
        const rawD=(((f.home?team.sdh:team.sda)||1150)-((f.home?opp.saa:opp.sah)||1150))/1000;
        let atk=clamp(1+rawA*2.0,.40,1.60);
        let def=clamp(1+rawD*1.85,.45,1.55);
        /* Blend the strength-rating view with the xG-based, position-aware one.
           The new ratings carry the extra spread; the old view keeps us anchored
           to the published projections we calibrated against. */
        if(S.ratingsReady&&f.xgf!=null){
          /* straight from expected goals, so elite sides still separate a weak
             opponent from a merely average one */
          /* Raised to a power so a kind fixture separates properly from a hard
             one. Multiplying scales every player by the same factor, so unlike
             the old stretch it cannot reorder two players in the same match. */
          const nA=clamp(Math.pow(f.xgf/PL_GF,1.9),.30,2.40);
          const nD=clamp(Math.pow(PL_GF/Math.max(.35,f.xgc),1.9),.35,2.30);
          atk=atk*(1-FDR_MIX)+nA*FDR_MIX;
          def=def*(1-FDR_MIX)+nD*FDR_MIX;
        }
        const od=oddsFor(team,opp,f.home);
        if(od){                       // odds override the ratings when available
          atk=clamp(od.xg/1.42,.40,1.75);
          def=clamp(1.42/Math.max(.35,od.xgc),.45,1.70);
        }
        const xGC=clamp(p.gc90/def,.25,3.2);
        const app=p60*2+(pPlay-p60);
        /* Keepers score almost entirely from clean sheets and concessions;
           saves pay only one point per three, and a busy keeper behind a poor
           defence loses more to goals than he gains in saves. Validated against
           the published projections, where the best-rated keepers sit behind the
           best defences rather than making the most saves. */
        const attack=p.pos===1
          ? (p.sv90*(xGC/1.35))/3*share*0.55
          : (p.xg90*(GOAL_PTS[p.pos]||4)+p.xa90*3)*share*atk;
        /* Poisson clean-sheet probability. For keepers this is the dominant
           term, so it carries a shot-quality adjustment: a defence that concedes
           few high-quality chances keeps more clean sheets than raw xGC implies. */
        let csP=Math.exp(-xGC);
        if(p.pos===1&&p.gpRate)csP=clamp(csP*(1+clamp(p.gpRate,-0.25,0.25)),0.02,0.75);
        const cs=(CS_PTS[p.pos]||0)*csP*p60;
        const conc=p.pos<=2?-0.5*clamp(xGC/2,0,1.6)*p60:0;
        /* DefCon pays only when a player clears the threshold in that match.
           Modelling it from his average badly overstates it — Tielemans averages
           9.8 actions, which the old curve scored as 1.29 points a game, when he
           actually clears 12 in one match in ten. The per-match hit rate from
           last season's records is the honest number. */
        const defcon=p.dcHitRate!=null
          ? 2*p.dcHitRate*p60*clamp(1/Math.max(.6,def),0.75,1.3)
          : Math.min(2,2*Math.pow(clamp(p.dc90/(DC_THRESH[p.pos]||99),0,1.15),2.6))*p60*0.55;
        const bon=p.bonus90*share*clamp(atk,.8,1.2);
        /* penalties earned scale with how often the side attacks */
        const teamAtk=clamp((team.att||PL_GF)/PL_GF,0.55,1.45);
        const extras=(p.penBoost*teamAtk*atk+p.setBoost)*share;
        /* availability for THIS gameweek rather than for the season */
        let availE=p.avail;
        if(outUntil){
          if(e<outUntil)availE=0;
          else if(e<outUntil+2)availE=0.55+0.25*(e-outUntil);   // easing back in
          else availE=1;
        }
        tot+=(app+attack+cs+conc+defcon+bon+extras)*clamp(availE,0,1);
      });
      const c=CAL[p.pos]||{A:0,B:1};
      const rawTot=tot;
      /* the flat term scales with minutes too, and capping it at 80 meant every
         regular shared an identical floor regardless of expected minutes */
      tot=c.A*clamp(p.xMins/88,0,1.02)+c.B*tot;
      if(e===S.model.next.id)p.rawPts=rawTot;
      /* FPL's own ep_next only exists for the next gameweek. Blending it into
         GW1 alone made that week sit ~0.45 below every later week — a step that
         is an artefact of the data, not the fixtures. Left out entirely. */
      p.gw[e]={pts:Math.max(0,tot),fixtures:fx,blank:false};
    }
    /* --- fixture sensitivity ---
       Applied per player: hold his average across the horizon fixed and stretch
       the deviations around it. Cross-player calibration is unaffected, so the
       accuracy fit holds, but a kind fixture now reads clearly above a hard one. */
    const ws=Object.keys(p.gw).map(Number).filter(w=>p.gw[w]&&!p.gw[w].blank);
    if(ws.length>1){
      const mean=ws.reduce((a,w)=>a+p.gw[w].pts,0)/ws.length;
      if(mean>0.3)ws.forEach(w=>{
        p.gw[w].pre=p.gw[w].pts;
        p.gw[w].pts=Math.max(0,mean+(p.gw[w].pts-mean)*FIXTURE_AMP);});
    }
    p.xMins=Math.round(p.xMins);
    delete p._team;
  });

  /* Stretching each player around his own mean shifts the whole population in
     any given week. Restore each gameweek's mean so the calibration — fitted on
     GW1 — still holds, while the spread between fixtures stays widened. */
  for(let w=nextEv.id;w<=38;w++){
    let a=0,b=0,n=0;
    players.forEach(p=>{const q=p.gw[w];if(!q||q.blank||q.pre==null)return;a+=q.pre;b+=q.pts;n++;});
    if(n>20&&b>0){const f=a/b;players.forEach(p=>{const q=p.gw[w];
      if(q&&!q.blank)q.pts=Math.max(0,q.pts*f);});}
  }
  /* A club can only field so many players in a position. Where the projected
     minutes across a club's midfield or defence add up to far more than the
     eleven shirts allow, somebody is going to be rotated — and last season's
     record cannot say who. Flag the ones most at risk rather than silently
     adjusting them, because nothing in the data says by how much. */
  const SLOTS={1:1,2:4.3,3:4.3,4:2.0};
  const byClubPos={};
  players.forEach(p=>{(byClubPos[p.team+"|"+p.pos]=byClubPos[p.team+"|"+p.pos]||[]).push(p);});
  Object.entries(byClubPos).forEach(([k,list])=>{
    const pos=+k.split("|")[1];
    const capacity=(SLOTS[pos]||3)*90;
    const claimed=list.reduce((a,p)=>a+(p.avail>0?p.xMins:0),0);
    if(claimed<=capacity*1.18)return;                 // squad fits, no risk
    /* the surplus falls on whoever the club has invested least in */
    const contenders=list.filter(p=>p.avail>0&&p.xMins>=70)
      .sort((a,b)=>b.price-a.price);
    const keep=Math.max(1,Math.round(capacity/88));
    contenders.slice(keep).forEach(p=>{p.staleRole=true;});
  });
  const bestByPos={};[1,2,3,4].forEach(k=>{bestByPos[k]=Math.max(0.1,
    ...players.filter(p=>p.pos===k).map(p=>p.gw[S.model.next.id]?.pts||0));});
  S.model.bestByPos=bestByPos;
  S.model.players=players;
  S.model.teamById=teams;
  learnFromResults();
  /* Prices change through the week, so refresh on load rather than waiting for
     the tab to be opened — the projections use them, not just the display. */
  if(S.oddsKey&&(S.oddsState==="idle"||S.oddsState==="nokey")&&!S._oddsTried){
    S._oddsTried=true;
    /* free tiers are capped at a few hundred calls a month, so reuse a recent
       response rather than refetching on every visit */
    const c=LS.get("oddsCache");
    if(c&&c.t&&Date.now()-c.t<4*3600*1000&&(c.odds||[]).length){
      S.odds=c.odds;S.oddsState="ok";buildOddsTeams();
    }else setTimeout(()=>loadOdds(),400);
  }
  if(!S.seeded&&(!S.squad||!S.squad.length)){S.seeded=true;resolveSeed(true);}
  render();
}
/* "Expected back 30 Aug" → 30-Aug */
function parseReturn(news){
  const m=/expected back\s+(\d{1,2})\s+([A-Za-z]{3})/i.exec(news||"");
  if(m)return `${m[1].padStart(2,"0")}-${m[2][0].toUpperCase()+m[2].slice(1,3).toLowerCase()}`;
  if(/unknown return/i.test(news||""))return "unknown";
  return "";
}

const VG=()=>clamp(S.startGW||(S.model?S.model.next.id:1),1,38);
/* FPL sells at purchase price plus half the rise, rounded down to 0.1 */
function sellPrice(p){
  const bought=+(p.price-(p.seasonChange||0)).toFixed(1);
  const rise=+(p.price-bought).toFixed(1);
  return rise<=0?p.price:+(bought+Math.floor(rise*10/2)/10).toFixed(1);
}
const hPts=(p,from,w)=>{let s=0;for(let e=from;e<from+w;e++)s+=p.gw[e]?.pts||0;return s;};
const avgFP=(p,g,h)=>(p.form+hPts(p,g,h))/2;

