/* Tracker — season performance for the actual FPL entry (Armitage Shanks).
   Two data sources:
     • history  — static, committed here (past seasons). Overall/Best/Worst are
                  computed across every season present, so adding a season widens
                  them automatically.
     • current  — this season, published by the FPL-API GitHub Action into
                  S.tracker (same Action as the xFPL page). Empty until wired;
                  the current-season views show a clean waiting state till then.
   Contract the Action fills:
     S.tracker = { season, totalPlayers,
       gw:[{event,points,gwRank,orRank,bank,value,transfers,transferCost,
            bench,captain,off1m,off500k,off100k,transferDiff}] } */

const TRACKER_HISTORY={"totalPlayers":{"2026":11000000,"2025":11500000,"2024":11000000,"2023":10500000,"2022":9000000},"seasons":{"2026":{"points":[49,46,59,72,46,77,69,71,30,73,40,50,39,66,43,64,91,44,38,58,42,39,33,63,73,75,34,69,57,41,65,58,128,61,54,66,62,68],"gwRank":[6072139,6780851,1816329,2931949,4245335,478173,3680658,1989324,11455946,2516679,5307799,2211550,4322114,4571241,8557501,5049214,772801,6427107,7572950,1515900,8545731,7067167,10930426,3391591,1726924,1600438,11513315,2424920,5792366,7404315,771671,2553534,115292,834897,4949151,6873547,3923475,687263],"orRank":[6072139,6501807,4150981,3070570,2843040,1203804,1207617,996367,1799880,1750301,1769341,1398906,1387707,1451273,1776189,1947542,1448193,1737481,1814359,1493032,1881148,1878671,2197844,2036949,1925211,1618644,1944044,1787230,1993467,2168479,1900936,1808953,1056039,894383,923209,1100704,1113546,975373],"captain":[16,12,18,18,10,48,16,26,4,6,8,4,4,28,4,22,32,4,4,4,14,2,2,20,20,21,4,26,14,2,26,8,26,2,10,10,2,28],"value":[100.0,100.0,99.7,99.7,100.3,100.8,101.0,101.2,101.2,101.2,101.5,101.7,102.0,102.1,102.6,102.4,102.7,102.4,102.4,102.4,102.2,102.1,101.9,102.0,102.0,102.3,102.3,102.5,101.9,102.1,102.0,101.4,101.4,101.4,101.7,102.0,102.3,102.0],"transferDiff":[7,26,-14,5,-3,15,3,14,12,3,2,11,10,-9,2,-12,9,-1,9,3,4,-4,-4,-4,10,10,48,-4,8,14]},"2025":{"points":[59,78,85,51,58,43,54,36,54,54,64,65,82,64,50,54,83,56,80,63,82,41,72,119,93,63,66,59,66,52,51,76,75,83,49,41,40,53],"gwRank":[3866410,2873424,745230,5357280,5550284,6535996,2532384,5111205,5696357,1070546,1653201,1653048,1206720,3895677,5692540,3146102,1835949,4685629,2310908,4695353,817724,7420895,1546406,2140704,2216669,6223025,1379225,4146130,996888,2932116,1065858,1955676,1407452,589338,2972382,6081498,5459395,3529566],"orRank":[3866410,2807283,1323339,1905055,2339028,3337564,2952067,3057800,3312834,2507015,1939670,1523539,1120116,1147489,1480935,1393264,1298406,1410604,1313525,1477069,1132659,1234733,1117602,1085929,1036742,1270258,1109601,1142439,888388,862038,754802,743635,665259,602933,578558,657147,767701,792468],"captain":[28,34,34,20,12,4,4,4,12,18,28,26,28,14,4,10,42,18,32,14,32,6,16,58,60,28,12,30,34,6,4,22,8,16,10,3,10,2],"value":[null,100.1,100.3,100.3,100.6,101.1,101.2,101.5,101.9,102.1,102.3,102.1,102.2,102.2,102.2,102.4,102.5,103.1,103.4,103.7,104,104.5,104.9,104.8,104.5,104.4,104.3,104.4,104.3,102.9,103.8,104.2,104.6,104.9,104.8,105.2,105.2,105.3],"transferDiff":[0,1,1,-9,1,-6,1,-5,8,8,10,5,-4,-6,2,11,1,6,-4,1,8,12,5,2,-8,4,25,18,-7,29,9,-6,-4,-2]},"2024":{"points":[76,44,50,73,51,70,43,53,83,70,25,88,51,74,30,45,71,54,27,95,56,49,56,81,90,58,93,61,19,65,72,74,58,114,61,87,93,58],"gwRank":[1415084,4684189,2491672,5112531,2124361,4542065,6357599,2164173,1797054,4094391,7947705,438386,3116802,403352,7654396,4013761,300349,1094069,9082954,269437,2978206,5358347,5450665,1082475,1334219,2350947,147382,1291309,1992081,1244145,1090899,814282,5521072,839222,3156671,2277073,3725986,4167689],"orRank":[1415084,2340668,1789767,2529133,1821704,2090217,2672510,2048557,1559119,1460755,1751263,1132835,1020198,605634,860434,958224,631711,484988,741188,531097,665459,789637,1019340,813428,718645,667081,473069,405459,395410,379213,305203,242890,329314,280140,335943,365415,511317,564629],"captain":[26,10,8,40,12,12,4,6,16,16,2,32,14,10,6,26,6,4,6,32,4,14,10,14,30,10,12,16,2,14,2,10,20,6,16,4,28,4],"value":[100,100.3,100.5,101,101,101,101.1,101.1,101.8,102,102.6,102.7,103,103.1,103,103.4,103.7,104.1,104.2,104.5,104.3,104.5,104.5,105.1,104.7,104.8,104.7,105.2,105.2,105.6,105.6,106.1,105.9,105.4,105.6,105.4,105.4,105.4],"transferDiff":[-1,-1,10,9,13,4,-7,0,10,-2,-1,-7,-9,17,1,-3,-5,1,0,-2,1,13,8,14,-1,7,-4,25,10,-16,-18,6]},"2023":{"points":[63,65,43,59,79,54,61,53,52,81,48,63,65,61,59,49,98,48,46,73,89,104,87,56,86,57,89,51,111,70,58,67,58,112,36,130,76,53],"gwRank":[2753183,2828110,6683633,5711859,1540205,2149489,3611080,4333618,8396805,292479,4418430,264708,1570393,5082977,3659490,3286020,461880,5842562,6204616,2125660,314612,72895,1096604,1784753,3360676,2136791,1312698,1782030,1074056,1180025,4530454,826042,5002773,880435,7041119,96694,595119,2218353],"orRank":[2753181,2158110,2964941,4284123,3005639,2495895,2362608,2304662,3655476,2745145,2624550,1687210,1397635,1684047,1738471,1618197,1169988,1341597,1582654,1543291,1213295,646744,584066,544426,568494,486784,457779,439703,486706,397777,421520,392504,408871,367720,376898,223610,206177,184398],"captain":[24,10,16,6,34,18,18,12,10,12,4,6,26,2,10,2,26,12,4,16,34,60,20,4,30,4,26,12,24,24,24,14,28,32,4,48,12,10],"value":[100,100.2,100.7,101.3,101.5,101.4,101.4,101.6,101.7,102,102.1,102.5,102.9,103.5,103.6,103.6,103.1,103.4,103.6,103.6,103.8,103.6,103.4,103.7,103.3,103.1,103.2,103.1,103.2,103.4,103.9,103.7,102.5,103.1,103.1,103.3,103.7,103.4],"transferDiff":[-3,-3,-12,-1,12,-1,8,-6,2,0,6,1,-5,-2,1,10,-2,4,0,9,0,13,4,0,19,3,10,16,-20,0,6,15,16]},"2022":{"points":[91,55,70,71,72,32,50,61,79,48,51,62,41,72,49,80,46,71,23,37,89,69,31,59,89,147,49,89,101,58,49,58,86,50,37,118,73,59],"gwRank":[1085375,3863670,771815,1103054,767645,7061526,1195908,1425512,2589611,2617729,2162213,3334163,5225169,1430646,2713033,279055,4383658,201707,7150936,4338111,124671,1322269,5878282,2862274,35515,188744,1608794,1724519,500078,1091500,2993556,2470895,791329,4801667,6405639,774776,941609,2937279],"orRank":[1085372,1522780,1207067,782251,483236,885172,798113,762044,913844,828227,795793,912448,1132796,1013020,1048272,787517,902388,636391,850090,859255,605977,579645,614814,670108,447656,342994,341330,329041,292668,283588,295829,307246,255354,286941,326622,310200,293413,329446],"value":[100,100.3,100.5,100.7,100.7,101.4,101.5,101.7,101.8,102.4,102.5,102.8,102.9,102.8,102.9,103.3,103.9,103.7,103.7,103.7,103.9,103.8,104.4,105,104.9,104.9,104.6,103.6,103.9,104,104.2,104.4,104.4,104.5,104.3,103.5,103.6,103.5],"transferDiff":[2,2,6,5,1,8,-5,-5,0,12,-1,-7,0,-6,12,6,0,0,-1,24,11,1,0,13,37,8,11,3,-7,0,12,0,-2,1,0,12]}},"chips":{"labels":["2026","2025","2024","2023","2022"],"rows":{"Wild Card 1":[26,1,13,-6,6],"Wild Card 2":[10,18,13,-20,67],"Bench Boost 1":[23,19,null,null,null],"Bench Boost 2":[29,null,null,null,null],"Free Hit 1":[7,-6,14,19,0],"Free Hit 2":[48,null,null,null,0],"Triple Captain 1":[16,20,10,20,28],"Triple Captain 2":[7,null,null,null,null]}}};

/* ---------- helpers ---------- */
const trkClean=a=>(a||[]).filter(x=>x!=null&&!Number.isNaN(x));
const trkAvg=a=>{const v=trkClean(a);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null;};
const trkMax=a=>{const v=trkClean(a);return v.length?Math.max(...v):null;};
const trkMin=a=>{const v=trkClean(a);return v.length?Math.min(...v):null;};
const trkChange=or=>(or||[]).map((r,i)=>i===0?null:or[i-1]-r);   // + = climbed ranks
const trkRank=n=>n==null?"—":Math.round(n).toLocaleString("en-GB");
const trkNum=(n,d=0)=>n==null?"—":(+n).toFixed(d);
const trkSigned=n=>n==null?"—":(n>0?"+":"")+Math.round(n).toLocaleString("en-GB");
/* Compact forms for the historical stat cards specifically — GW Rank/OR Rank/Rank
   Change run up to 8-10 digits, far wider than every other stat in the set, which
   is why row 2 of the card grid used to look stretched next to rows 1 and 3 (each
   card's table sizes its own columns from its own content). Compacting these three
   to "6.8M"/"975k" keeps every card's numbers a similar width. */
const trkCompact=n=>n==null?"—":(Math.abs(n)>=1e6?(n/1e6).toFixed(2)+"M":Math.abs(n)>=1000?Math.round(n/1000)+"k":Math.round(n).toLocaleString("en-GB"));
const trkCompactSigned=n=>n==null?"—":(n>0?"+":"")+trkCompact(n);

/* series for a stat within one season (rankChange derived) */
function trkSeries(season,key){
  const s=TRACKER_HISTORY.seasons[season];if(!s)return[];
  if(key==="rankChange")return trkChange(s.orRank);
  return s[key]||[];
}
/* every season's values for a stat, flattened (for the all-time column) */
function trkAll(key){
  return Object.keys(TRACKER_HISTORY.seasons).reduce((a,ssn)=>a.concat(trkSeries(ssn,key)),[]);
}

const TSTATS=[
  {key:"points",     name:"GW Pts",      dir:"hi", fmt:n=>trkNum(n,1)},
  {key:"gwRank",     name:"GW Rank",     dir:"lo", fmt:trkCompact},
  {key:"orRank",     name:"OR Rank",     dir:"lo", fmt:trkCompact},
  {key:"rankChange", name:"Rank Change", dir:"hi", fmt:trkCompactSigned},
  {key:"transferDiff",name:"Transfer Pts",dir:"hi",fmt:trkSigned,noChart:true},
  {key:"captain",    name:"Captain Pts", dir:"hi", fmt:n=>trkNum(n,1)}
];

/* pick the value for a band given the stat direction */
function trkBandVal(arr,band,dir){
  if(band==="avg")return trkAvg(arr);
  const hi=dir==="hi";
  if(band==="best")return hi?trkMax(arr):trkMin(arr);
  return hi?trkMin(arr):trkMax(arr);   // worst
}

/* ---------- historical performance — grouped by stat ---------- */
function trkHistoryHTML(){
  const cur=(S.tracker&&S.tracker.gw)||null;   // this-season series once wired
  const curSeries=key=>{
    if(!cur)return[];
    if(key==="rankChange")return trkChange(cur.map(r=>r.orRank));
    return cur.map(r=>r[key]).filter(x=>x!=null);
  };
  const accents={points:"var(--mint)",gwRank:"var(--cyan)",orRank:"var(--amber)",
    rankChange:"#c9a0ff",transferDiff:"#ff9db0",captain:"#ffd76b"};
  const bands=[["avg","Avg"],["best","Best"],["worst","Worst"]];
  const card=st=>{
    const acc=accents[st.key]||"var(--cyan)";
    const now=curSeries(st.key),last=trkSeries("2026",st.key),all=trkAll(st.key);
    const allBest=trkBandVal(all,"best",st.dir);              // the single best-ever value
    return `<div class="tcard2" style="--acc:${acc}">
      <div class="tcard2-h">${st.name}</div>
      <table class="tmini"><colgroup><col style="width:22%"><col style="width:26%"><col style="width:26%"><col style="width:26%"></colgroup>
        <thead><tr><th></th>
        <th class="tnow">This yr</th><th>Last</th><th>All-time</th></tr></thead><tbody>
      ${bands.map(([b,lbl])=>{
        const av=trkBandVal(all,b,st.dir);
        const isBest=b==="best"&&av!=null&&av===allBest;
        return `<tr><td class="tmet">${lbl}</td>
          <td class="tv2 tnow">${st.fmt(trkBandVal(now,b,st.dir))}</td>
          <td class="tv2">${st.fmt(trkBandVal(last,b,st.dir))}</td>
          <td class="tv2${isBest?" tbest":""}">${st.fmt(av)}${isBest?' <span class="tstar">★</span>':''}</td></tr>`;
      }).join("")}
      </tbody></table></div>`;
  };
  return `<div class="tgrid2">${TSTATS.map(card).join("")}</div>`;
}

/* ---------- comparison — grouped bars per gameweek, 10 at a time ---------- */
function trkChartHTML(){
  let key=S.trkStat||"points";
  if((TSTATS.find(s=>s.key===key)||{}).noChart)key="points";
  const st=TSTATS.find(s=>s.key===key)||TSTATS[0];
  const seasons=Object.keys(TRACKER_HISTORY.seasons);
  const PAL=["var(--cream)","var(--cyan)","var(--amber)","#c9a0ff","#ff9db0"];
  const series=seasons.map((ssn,i)=>({label:ssn,data:trkSeries(ssn,key),color:PAL[i%PAL.length]}))
    .filter(s=>trkClean(s.data).length);
  const cur=(S.tracker&&S.tracker.gw)||null;
  if(cur){const cs=key==="rankChange"?trkChange(cur.map(r=>r.orRank)):cur.map(r=>r[key]);
    series.push({label:S.tracker.season||"2027",data:cs,color:"var(--mint)"});}

  const all=!!S.trkGwAll;
  const start=all?0:Math.min(Math.max(S.trkGwStart||0,0),30);
  const to=all?38:Math.min(start+10,38);
  const gws=[];for(let g=start;g<to;g++)gws.push(g);

  const vals=series.flatMap(s=>gws.map(g=>s.data[g]).filter(v=>v!=null));
  const hi=Math.max(...vals,0),lo=Math.min(...vals,0),base0=Math.min(0,lo);
  const groupW=all?66:Math.max(60,600/gws.length);
  const barW=Math.max(5,(groupW-8)/series.length);
  const padL=8,H=250,pt=26,pb=24;
  const W=Math.round(padL+gws.length*groupW+6);
  const baseY=H-pb,topY=pt,span=baseY-topY;
  const scaleH=v=>hi===base0?0:Math.abs(v-Math.max(base0,0))/(hi-base0)*span;
  const zeroY=baseY-(0-base0)/(hi-base0||1)*span;
  const compact=n=>n==null?"":(Math.abs(n)>=1e6?(n/1e6).toFixed(1)+"M":Math.abs(n)>=1000?Math.round(n/1000)+"k":(Number.isInteger(n)?""+n:n.toFixed(1)));
  let bars="";
  gws.forEach((g,gi)=>{
    const gx=padL+gi*groupW+4;
    series.forEach((s,si)=>{
      const v=s.data[g];if(v==null)return;
      const bx=gx+si*barW, h=scaleH(v);
      const by=v>=0?zeroY-h:zeroY;
      bars+=`<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${(barW-1).toFixed(1)}" height="${Math.max(1,h).toFixed(1)}" fill="${s.color}" rx="1"><title>${esc(s.label)} · GW${g+1}: ${v}</title></rect>`;
      const ly=(v>=0?by:by+h)-3, cx=bx+barW/2;
      bars+=`<text x="${cx.toFixed(1)}" y="${ly.toFixed(1)}" font-size="7" fill="var(--mute)" text-anchor="start" transform="rotate(-90 ${cx.toFixed(1)} ${ly.toFixed(1)})">${compact(v)}</text>`;
    });
    bars+=`<text x="${(gx+ (groupW-8)/2).toFixed(1)}" y="${(baseY+14).toFixed(1)}" text-anchor="middle" font-size="9" fill="var(--mute)">${g+1}</text>`;
  });
  const svg=`<svg viewBox="0 0 ${W} ${H}" style="width:${all?W+"px":"100%"};height:auto;display:block">
    <line x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${W-4}" y2="${zeroY.toFixed(1)}" stroke="var(--ink3)" stroke-width="1"/>${bars}</svg>`;

  const legend=series.map(l=>`<span class="tlegend"><span class="tdot" style="background:${l.color}"></span>${esc(l.label)}</span>`).join("");
  const picker=TSTATS.filter(s=>!s.noChart).map(s=>`<button class="${key===s.key?"on":""}" onclick="act('trkstat','${s.key}')">${s.name}</button>`).join("");
  const rangeLbl=all?"All 38 GWs":`GW ${start+1}–${to}`;
  const controls=`<span class="pseg">
      <button ${all||start<=0?"disabled":""} onclick="act('trkgw','prev')">←</button>
      <button ${all||to>=38?"disabled":""} onclick="act('trkgw','next')">→</button></span>
    <span class="note" style="min-width:74px;text-align:center">${rangeLbl}</span>
    <button class="${all?"on":""}" onclick="act('trkgw','all')">${all?"Show 10":"Show all"}</button>`;
  return `<div class="panel"><div class="phead"><h2>Gameweek comparison</h2>
      <span class="pseg" style="flex-wrap:wrap">${picker}</span></div>
    <div class="pbody">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-right:auto">${legend}</div>${controls}</div>
      <div style="overflow-x:auto">${svg}</div>
      ${st.dir==="lo"?`<p class="note" style="margin:6px 0 0">Ranks — lower is better, so a taller bar is a worse (higher) rank.</p>`:""}
    </div></div>`;
}

/* ---------- current-season summary + weekly table (await the feed) ---------- */
function trkSummaryHTML(){
  const t=S.tracker;
  const ls=TRACKER_HISTORY.seasons["2026"];
  const recap=`Last season: finished #${trkRank(ls.orRank[ls.orRank.length-1])} · best GW ${trkMax(ls.points)} · avg ${trkNum(trkAvg(ls.points),1)}`;
  if(!t||!t.gw||!t.gw.length){
    return `<div class="panel"><div class="phead"><h2>This season</h2><span class="note">${S.model?`GW${VG()}`:""}</span></div>
      <div class="pbody"><p class="note" style="margin:0 0 8px;color:var(--amber)">Current-season stats appear here once the FPL-API feed is connected (the same GitHub Action as the xFPL page).</p>
      <p class="note" style="margin:0">${recap}</p></div></div>`;
  }
  const last=t.gw[t.gw.length-1],tp=t.totalPlayers||TRACKER_HISTORY.totalPlayers["2026"];
  const pct=r=>r&&tp?trkNum(r/tp*100,2)+"%":"—";
  const tile=(v,l,c)=>`<span class="tsum"><b style="${c?`color:${c}`:""}">${v}</b><span>${l}</span></span>`;
  return `<div class="panel"><div class="phead"><h2>This season</h2><span class="note">GW${last.event}</span></div>
    <div class="pbody"><div class="tsumrow">
      ${tile("#"+trkRank(last.orRank),"Overall rank","var(--mint)")}
      ${tile(pct(last.orRank),"Top %",null)}
      ${tile(last.points,"Last GW",null)}
      ${tile(trkMax(t.gw.map(r=>r.points)),"Best GW","var(--mint)")}
      ${tile(trkMin(t.gw.map(r=>r.points)),"Worst GW","var(--red)")}
      ${tile("£"+trkNum(last.value,1),"Team value",null)}
    </div></div></div>`;
}

function trkTableHTML(){
  const t=S.tracker;
  const cols=["GW","Pts","GW Rank","GW %","OR Rank","OR %","Rank Δ","Rank Δ%","Off 1m","Off 500k","Off 100k","Capt","Bench","Trans","Trans Δ","Value"];
  const head=cols.map((c,i)=>`<th style="text-align:${i===0?"center":"right"}">${c}</th>`).join("");
  if(!t||!t.gw||!t.gw.length){
    return `<div class="panel"><div class="phead"><h2>Weekly breakdown</h2></div>
      <div class="scroll"><table><thead><tr>${head}</tr></thead>
      <tbody><tr><td colspan="${cols.length}" class="note" style="text-align:center;padding:18px">Weekly rows appear here once the current-season feed is connected.</td></tr></tbody></table></div></div>`;
  }
  const tp=t.totalPlayers||1,pct=r=>r?trkNum(r/tp*100,2):"—";
  const rows=t.gw.map((r,i)=>{const prev=i?t.gw[i-1].orRank:null;const rc=prev?prev-r.orRank:null;
    const rcp=prev?trkNum((prev-r.orRank)/prev*100,1):"—";
    return `<tr><td style="text-align:center">${r.event}</td>
      <td style="text-align:right">${r.points}</td>
      <td style="text-align:right">${trkRank(r.gwRank)}</td><td style="text-align:right">${pct(r.gwRank)}</td>
      <td style="text-align:right">${trkRank(r.orRank)}</td><td style="text-align:right">${pct(r.orRank)}</td>
      <td style="text-align:right;color:${rc>0?"var(--mint)":rc<0?"var(--red)":""}">${trkSigned(rc)}</td>
      <td style="text-align:right">${rcp==="—"?"—":rcp+"%"}</td>
      <td style="text-align:right">${r.off1m??"—"}</td><td style="text-align:right">${r.off500k??"—"}</td><td style="text-align:right">${r.off100k??"—"}</td>
      <td style="text-align:right">${r.captain??"—"}</td><td style="text-align:right">${r.bench??"—"}</td>
      <td style="text-align:right">${r.transfers??"—"}</td><td style="text-align:right">${r.transferDiff??"—"}</td>
      <td style="text-align:right">£${trkNum(r.value,1)}</td></tr>`;}).join("");
  return `<div class="panel"><div class="phead"><h2>Weekly breakdown</h2></div>
    <div class="scroll tallscroll"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

/* ---------- chips ---------- */
function trkChipHTML(){
  const c=TRACKER_HISTORY.chips,cur=(S.tracker&&S.tracker.chips)||{};
  const cell=v=>v==null?`<td style="color:var(--ink3)">—</td>`
    :`<td style="color:${v>0?"var(--mint)":v<0?"var(--red)":"var(--cream)"}">${v>0?"+":""}${v}</td>`;
  const head=`<th>Chip</th><th style="color:var(--mint)">2027</th>${c.labels.map(l=>`<th>${l}</th>`).join("")}`;
  const rows=Object.keys(c.rows).map(name=>
    `<tr><td>${name}</td>${cell(cur[name]??null)}${c.rows[name].map(cell).join("")}</tr>`).join("");
  return `<div class="panel"><div class="phead"><h2>Chip performance</h2>
      <span class="note">points gained vs an average week</span></div>
    <div class="scroll"><table class="trktable"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>
    <div class="pbody"><p class="note" style="margin:0">2027 column fills in as each chip gets used this season.</p></div></div>`;
}

/* ---------- career finishes (official FPL season data) ---------- */
const TRACKER_FINISHES=[
  ["2025/26",2193,975373,8],["2024/25",2371,792468,7],["2023/24",2362,564629,5],
  ["2022/23",2496,184398,2],["2021/22",2392,331851,4],["2020/21",2363,160062,2],
  ["2019/20",2150,553017,7],["2018/19",2114,736967,12],["2017/18",1971,1417858,24],
  ["2016/17",1749,2173755,48],["2015/16",1816,1704946,46],["2014/15",1765,1293596,37],
  ["2013/14",2380,16301,0.5],["2012/13",2089,76413,3],["2011/12",2100,41520,2],
  ["2010/11",1975,121520,5],["2009/10",2217,61847,3],["2008/09",1928,69247,4],
  ["2007/08",2034,126732,8],["2006/07",1746,187513,15]
];
function trkFinishesHTML(){
  const rows0=TRACKER_FINISHES.map(([s,pts,rank,pct])=>({
    s,pts,rank,pct,
    avgWk:pts/38,
    /* Total Players derived from rank and finish % — pct = rank/totalPlayers*100 */
    totalPlayers:Math.round(rank/(pct/100))
  }));
  const bestPct=Math.min(...rows0.map(r=>r.pct));
  const bestPts=Math.max(...rows0.map(r=>r.pts));
  const avg=(k)=>rows0.reduce((s,r)=>s+r[k],0)/rows0.length;

  const rows=rows0.map(r=>
    `<tr><td>${r.s}</td>
      <td${r.pts===bestPts?' class="tbest"':""}>${r.pts.toLocaleString("en-GB")}</td>
      <td>${r.avgWk.toFixed(1)}</td>
      <td>${r.rank.toLocaleString("en-GB")}</td>
      <td>${r.totalPlayers.toLocaleString("en-GB")}</td>
      <td${r.pct===bestPct?' class="tbest"':""}>${r.pct}%${r.pct===bestPct?' <span class="tstar">★</span>':""}</td></tr>`).join("");

  const avgRow=`<tr class="trkavg"><td>Average</td>
      <td>${avg("pts").toFixed(0)}</td>
      <td>${avg("avgWk").toFixed(1)}</td>
      <td>${Math.round(avg("rank")).toLocaleString("en-GB")}</td>
      <td>${Math.round(avg("totalPlayers")).toLocaleString("en-GB")}</td>
      <td>${avg("pct").toFixed(1)}%</td></tr>`;

  return `<div class="panel"><div class="phead"><h2>Career finishes</h2>
      <span class="note">official FPL · net of hits</span></div>
    <div class="scroll tallscroll"><table class="trktable"><thead><tr>
      <th>Season</th><th>Points</th><th>Avg/wk</th><th>Overall rank</th><th>Total players</th><th>Finish</th></tr></thead>
      <tbody>${avgRow}${rows}</tbody></table></div></div>`;
}

function trackerHTML(){
  if(!S.model)return `<div class="panel"><div class="pbody"><p class="note">Load data first.</p></div></div>`;
  return trkSummaryHTML()+trkTableHTML()+
    `<div class="trkband-title">Historical performance · ★ = best ever · shaded column = this season</div>`+
    trkHistoryHTML()+trkChartHTML()+
    `<div class="trkrow2">${trkFinishesHTML()}${trkChipHTML()}</div>`;
}
