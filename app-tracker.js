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

const TRACKER_HISTORY={
  totalPlayers:{"25/26":11000000},
  seasons:{
    "25/26":{
      points:[49,46,59,72,46,77,69,71,30,73,40,50,39,66,43,64,91,44,38,58,42,39,33,63,73,75,34,69,57,41,65,58,128,61,54,66,62,68],
      gwRank:[6072139,6780851,1816329,2931949,4245335,478173,3680658,1989324,11455946,2516679,5307799,2211550,4322114,4571241,8557501,5049214,772801,6427107,7572950,1515900,8545731,7067167,10930426,3391591,1726924,1600438,11513315,2424920,5792366,7404315,771671,2553534,115292,834897,4949151,6873547,3923475,687263],
      orRank:[6072139,6501807,4150981,3070570,2843040,1203804,1207617,996367,1799880,1750301,1769341,1398906,1387707,1451273,1776189,1947542,1448193,1737481,1814359,1493032,1881148,1878671,2197844,2036949,1925211,1618644,1944044,1787230,1993467,2168479,1900936,1808953,1056039,894383,923209,1100704,1113546,975373],
      captain:[16,12,18,18,10,48,16,26,4,6,8,4,4,28,4,22,32,4,4,4,14,2,2,20,20,21,4,26,14,2,26,8,26,2,10,10,2,28],
      value:[100.0,100.0,99.7,99.7,100.3,100.8,101.0,101.2,101.2,101.2,101.5,101.7,102.0,102.1,102.6,102.4,102.7,102.4,102.4,102.4,102.2,102.1,101.9,102.0,102.0,102.3,102.3,102.5,101.9,102.1,102.0,101.4,101.4,101.4,101.7,102.0,102.3,102.0]
      /* transferDiff + transfers pending clean data; rankChange derived from orRank */
    }
  }
};

/* ---------- helpers ---------- */
const trkClean=a=>(a||[]).filter(x=>x!=null&&!Number.isNaN(x));
const trkAvg=a=>{const v=trkClean(a);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null;};
const trkMax=a=>{const v=trkClean(a);return v.length?Math.max(...v):null;};
const trkMin=a=>{const v=trkClean(a);return v.length?Math.min(...v):null;};
const trkChange=or=>(or||[]).map((r,i)=>i===0?null:or[i-1]-r);   // + = climbed ranks
const trkRank=n=>n==null?"—":Math.round(n).toLocaleString("en-GB");
const trkNum=(n,d=0)=>n==null?"—":(+n).toFixed(d);
const trkSigned=n=>n==null?"—":(n>0?"+":"")+Math.round(n).toLocaleString("en-GB");

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
  {key:"gwRank",     name:"GW Rank",     dir:"lo", fmt:trkRank},
  {key:"orRank",     name:"OR Rank",     dir:"lo", fmt:trkRank},
  {key:"rankChange", name:"Rank Change", dir:"hi", fmt:trkSigned},
  {key:"transferDiff",name:"Transfer Pts",dir:"hi",fmt:trkSigned,pending:true},
  {key:"captain",    name:"Captain Pts", dir:"hi", fmt:n=>trkNum(n,1)}
];

/* pick the value for a band given the stat direction */
function trkBandVal(arr,band,dir){
  if(band==="avg")return trkAvg(arr);
  const hi=dir==="hi";
  if(band==="best")return hi?trkMax(arr):trkMin(arr);
  return hi?trkMin(arr):trkMax(arr);   // worst
}

/* ---------- historical AVERAGE / BEST / WORST ---------- */
function trkHistoryHTML(){
  const cur=(S.tracker&&S.tracker.gw)||null;   // this-season series once wired
  const curSeries=key=>{
    if(!cur)return[];
    if(key==="rankChange")return trkChange(cur.map(r=>r.orRank));
    return cur.map(r=>r[key]).filter(x=>x!=null);
  };
  const bands=[
    {id:"avg", label:"Average", accent:"var(--cyan)", tint:"rgba(93,214,255,.10)"},
    {id:"best",label:"Best",    accent:"var(--mint)", tint:"rgba(125,251,158,.10)"},
    {id:"worst",label:"Worst",  accent:"var(--red)",  tint:"rgba(255,107,107,.10)"}
  ];
  return bands.map(b=>`
    <div class="panel trkband" style="--acc:${b.accent}">
      <div class="trkband-h" style="background:${b.tint};color:${b.accent}">${b.label}</div>
      <div class="tgrid">
        ${TSTATS.map(st=>{
          const last=trkBandVal(trkSeries("25/26",st.key),b.id,st.dir);
          const all =trkBandVal(trkAll(st.key),b.id,st.dir);
          const now =st.pending?null:trkBandVal(curSeries(st.key),b.id,st.dir);
          const row=(lbl,v,strong)=>`<div class="trow"><span class="tlbl">${lbl}</span>
            <span class="tval" ${strong?`style="color:${b.accent}"`:""}>${st.pending&&lbl!=="This season"?"provide data":st.fmt(v)}</span></div>`;
          return `<div class="tcard">
            <div class="tcard-h">${st.name}</div>
            ${row("This season",now,false)}
            ${row("Last season",last,true)}
            ${row("All-time",all,false)}
          </div>`;}).join("")}
      </div>
    </div>`).join("");
}

/* ---------- comparison chart (GW-by-GW, one line per season) ---------- */
function trkChartHTML(){
  const key=S.trkStat||"points";
  const st=TSTATS.find(s=>s.key===key)||TSTATS[0];
  const seasons=Object.keys(TRACKER_HISTORY.seasons);
  const lines=[];
  seasons.forEach((ssn,i)=>{const ser=trkSeries(ssn,key);if(trkClean(ser).length)lines.push({label:ssn,data:ser,color:["var(--cream)","var(--cyan)","var(--amber)","var(--mint)"][i%4]});});
  const cur=(S.tracker&&S.tracker.gw)||null;
  if(cur){const cs=key==="rankChange"?trkChange(cur.map(r=>r.orRank)):cur.map(r=>r[key]);
    lines.push({label:S.tracker.season||"This season",data:cs,color:"var(--mint)"});}
  const W=680,H=230,pl=44,pr=12,pt=14,pb=22;
  const all=lines.flatMap(l=>trkClean(l.data));
  let lo=Math.min(...all),hi=Math.max(...all);if(lo===hi){lo-=1;hi+=1;}
  const invert=st.dir==="lo";                       // ranks: better at the top
  const x=g=>pl+(g/37)*(W-pl-pr);
  const y=v=>{const t=(v-lo)/(hi-lo);return pt+(invert?t:1-t)*(H-pt-pb);};
  const path=data=>data.map((v,i)=>v==null?null:`${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .filter(Boolean).map((p,i)=>(i?"L":"M")+p).join(" ");
  const yTicks=[lo,(lo+hi)/2,hi].map(v=>{const yy=y(v);
    return `<line x1="${pl}" y1="${yy}" x2="${W-pr}" y2="${yy}" stroke="var(--ink3)" stroke-width="1" opacity=".5"/>
      <text x="${pl-6}" y="${yy+3}" text-anchor="end" font-size="9" fill="var(--mute)">${st.dir==="lo"?trkRank(v):trkNum(v,0)}</text>`;}).join("");
  const svg=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">
    ${yTicks}
    ${[1,10,20,30,38].map(g=>`<text x="${x(g-1)}" y="${H-6}" text-anchor="middle" font-size="9" fill="var(--mute)">${g}</text>`).join("")}
    ${lines.map(l=>`<path d="${path(l.data)}" fill="none" stroke="${l.color}" stroke-width="2" stroke-linejoin="round"/>`).join("")}
  </svg>`;
  const legend=lines.map(l=>`<span class="tlegend"><span class="tdot" style="background:${l.color}"></span>${esc(l.label)}</span>`).join("");
  const picker=TSTATS.filter(s=>!s.pending).map(s=>`<button class="${key===s.key?"on":""}" onclick="act('trkstat','${s.key}')">${s.name}</button>`).join("");
  return `<div class="panel"><div class="phead"><h2>Gameweek comparison</h2>
      <span class="pseg" style="flex-wrap:wrap">${picker}</span></div>
    <div class="pbody">
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:6px">${legend}</div>
      ${svg}
      ${st.dir==="lo"?`<p class="note" style="margin:6px 0 0">Lower is better — the line is flipped so up = a better rank.</p>`:""}
    </div></div>`;
}

/* ---------- current-season summary + weekly table (await the feed) ---------- */
function trkSummaryHTML(){
  const t=S.tracker;
  const ls=TRACKER_HISTORY.seasons["25/26"];
  const recap=`Last season: finished #${trkRank(ls.orRank[ls.orRank.length-1])} · best GW ${trkMax(ls.points)} · avg ${trkNum(trkAvg(ls.points),1)}`;
  if(!t||!t.gw||!t.gw.length){
    return `<div class="panel"><div class="phead"><h2>This season</h2><span class="note">${S.model?`GW${VG()}`:""}</span></div>
      <div class="pbody"><p class="note" style="margin:0 0 8px;color:var(--amber)">Current-season stats appear here once the FPL-API feed is connected (the same GitHub Action as the xFPL page).</p>
      <p class="note" style="margin:0">${recap}</p></div></div>`;
  }
  const last=t.gw[t.gw.length-1],tp=t.totalPlayers||TRACKER_HISTORY.totalPlayers["25/26"];
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

/* ---------- chips (await season-labelled data) ---------- */
function trkChipHTML(){
  return `<div class="panel"><div class="phead"><h2>Chip performance</h2></div>
    <div class="pbody"><p class="note" style="margin:0">Chip-by-chip points vs previous seasons appear here once the chip table arrives with clear season labels (the pasted headers were ambiguous).</p></div></div>`;
}

function trackerHTML(){
  if(!S.model)return `<div class="panel"><div class="pbody"><p class="note">Load data first.</p></div></div>`;
  return trkSummaryHTML()+trkTableHTML()+
    `<div class="trkband-title">Historical performance · this season vs last vs all-time</div>`+
    trkHistoryHTML()+trkChartHTML()+trkChipHTML();
}
