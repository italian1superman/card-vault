/* Card Vault — MLB career stats + public data/mlb-career.json (not private collection) */
(function(){
'use strict';
if(typeof window==='undefined')return;

const MLB_API='https://statsapi.mlb.com/api/v1';
const MLB_STATS_TTL=30*864e5;
const MLB_JSON_URL='./data/mlb-career.json';

window.MLB_CAREER={v:1,byId:{},byName:{},loaded:false};

window.mlbPickStat=function mlbPickStat(payload, group){
  const blocks=(payload&&payload.stats)||[];
  const hit=blocks.find(s=>String((s.group&&s.group.displayName)||'').toLowerCase()===group)
    ||blocks.find(s=>String((s.type&&s.type.displayName)||'').toLowerCase()==='career');
  const split=(hit&&hit.splits&&hit.splits[0])||null;
  return split&&split.stat?split.stat:null;
};

function mlbNameKey(n){
  return String(n||'').toLowerCase().replace(/\./g,'').replace(/\s+/g,' ').trim();
}
window.mergeMlbCareerFile=function mergeMlbCareerFile(j){
  if(!j||typeof j!=='object')return;
  MLB_CAREER.byId=Object.assign(MLB_CAREER.byId||{}, j.byId||{});
  const names=Object.assign({}, j.byName||{});
  /* alias keys without punctuation so "Ken Griffey Jr" hits "Ken Griffey Jr." */
  for(const [k,id] of Object.entries(names)){
    const nk=mlbNameKey(k);
    if(nk&&!names[nk])names[nk]=id;
  }
  MLB_CAREER.byName=Object.assign(MLB_CAREER.byName||{}, names);
  MLB_CAREER.v=j.v||1;
  MLB_CAREER.updated=j.updated||MLB_CAREER.updated;
  MLB_CAREER.count=Object.keys(MLB_CAREER.byId).length;
  MLB_CAREER.loaded=true;
};

window.loadMlbCareerJson=async function loadMlbCareerJson(){
  try{
    const r=await fetch(MLB_JSON_URL,{cache:'no-cache'});
    if(!r.ok)return false;
    mergeMlbCareerFile(await r.json());
    return true;
  }catch(e){return false;}
};

window.mlbLookupCached=function mlbLookupCached(c){
  if(!c)return null;
  if(c.mlbId&&MLB_CAREER.byId[String(c.mlbId)])return MLB_CAREER.byId[String(c.mlbId)];
  const n=mlbNameKey(c.player);
  const id=n&&(MLB_CAREER.byName[n]||MLB_CAREER.byName[String(c.player||'').trim().toLowerCase()]);
  if(id&&MLB_CAREER.byId[id])return MLB_CAREER.byId[id];
  return null;
};

window.mlbCachePut=function mlbCachePut(summary){
  if(!summary||!summary.mlbId)return;
  const id=String(summary.mlbId);
  MLB_CAREER.byId[id]={
    mlbId:summary.mlbId,
    fullName:summary.fullName||'',
    pos:summary.pos||'',
    team:summary.team||'',
    bats:summary.bats||'',
    throws:summary.throws||'',
    birthDate:summary.birthDate||'',
    debutDate:summary.debutDate||'',
    hitting:summary.hitting||null,
    pitching:summary.pitching||null,
    seasonYear:summary.seasonYear||'',
    seasonHitting:summary.seasonHitting||null,
    seasonPitching:summary.seasonPitching||null
  };
  if(summary.fullName)MLB_CAREER.byName[String(summary.fullName).toLowerCase()]=id;
  MLB_CAREER.count=Object.keys(MLB_CAREER.byId).length;
};

window.mlbFetchPerson=async function mlbFetchPerson(mlbId){
  const id=String(mlbId||'').trim();
  if(!id)return null;
  const ck='mlb:person:'+id;
  try{
    const hit=await idb.netGet(ck);
    if(hit&&hit.j!=null&&(Date.now()-hit.t)<MLB_STATS_TTL)return hit.j;
  }catch(e){}
  const r=await fetch(MLB_API+'/people/'+encodeURIComponent(id)+'?hydrate=currentTeam');
  if(!r.ok)throw new Error('MLB person '+r.status);
  const j=await r.json();
  const p=(j.people&&j.people[0])||null;
  if(p)try{await idb.netPut(ck,{t:Date.now(),j:p});}catch(e){}
  return p;
};

window.mlbFetchCareerGroup=async function mlbFetchCareerGroup(mlbId, group){
  const id=String(mlbId||'').trim();
  if(!id)return null;
  const ck='mlb:career:'+group+':'+id;
  try{
    const hit=await idb.netGet(ck);
    if(hit&&hit.j!=null&&(Date.now()-hit.t)<MLB_STATS_TTL)return mlbPickStat(hit.j, group);
  }catch(e){}
  const r=await fetch(MLB_API+'/people/'+encodeURIComponent(id)+'/stats?stats=career&group='+encodeURIComponent(group));
  if(!r.ok)throw new Error('MLB stats '+r.status);
  const j=await r.json();
  try{await idb.netPut(ck,{t:Date.now(),j});}catch(e){}
  return mlbPickStat(j, group);
};

/** Season line for the card year (free MLB Stats API). */
window.mlbFetchSeasonGroup=async function mlbFetchSeasonGroup(mlbId, group, season){
  const id=String(mlbId||'').trim();
  const yr=String(season||'').replace(/\D/g,'').slice(0,4);
  if(!id||yr.length!==4)return null;
  const ck='mlb:season:'+group+':'+id+':'+yr;
  try{
    const hit=await idb.netGet(ck);
    if(hit&&hit.j!=null&&(Date.now()-hit.t)<MLB_STATS_TTL)return mlbPickStat(hit.j, group);
  }catch(e){}
  const r=await fetch(MLB_API+'/people/'+encodeURIComponent(id)+'/stats?stats=season&season='+encodeURIComponent(yr)+'&group='+encodeURIComponent(group));
  if(!r.ok)return null;
  const j=await r.json();
  try{await idb.netPut(ck,{t:Date.now(),j});}catch(e){}
  return mlbPickStat(j, group);
};

function mlbNormHit(hitting){
  if(!hitting||!(+hitting.atBats||0))return null;
  return {
    g:+hitting.gamesPlayed||0, ab:+hitting.atBats||0, h:+hitting.hits||0,
    hr:+hitting.homeRuns||0, rbi:+hitting.rbi||0, sb:+hitting.stolenBases||0,
    bb:+hitting.baseOnBalls||0, so:+hitting.strikeOuts||0,
    avg:hitting.avg||'', obp:hitting.obp||'', slg:hitting.slg||'', ops:hitting.ops||''
  };
}
function mlbNormPit(pitching){
  if(!pitching||!(+pitching.gamesPlayed||0))return null;
  return {
    g:+pitching.gamesPlayed||0, gs:+pitching.gamesStarted||0,
    w:+pitching.wins||0, l:+pitching.losses||0, sv:+pitching.saves||0,
    ip:pitching.inningsPitched||'', so:+pitching.strikeOuts||0, bb:+pitching.baseOnBalls||0,
    era:pitching.era||'', whip:pitching.whip||''
  };
}

window.mlbBuildSummary=function mlbBuildSummary(person, hitting, pitching, seasonHit, seasonPit, seasonYear){
  const pos=(person&&person.primaryPosition&&person.primaryPosition.abbreviation)||'';
  const team=(person&&person.currentTeam&&person.currentTeam.name)||'';
  const bats=person&&person.batSide&&person.batSide.code||'';
  const throws=person&&person.pitchHand&&person.pitchHand.code||'';
  const out={
    fetched:Date.now(),
    mlbId:person&&person.id,
    fullName:person&&person.fullName||'',
    pos, team, bats, throws,
    birthDate:person&&person.birthDate||'',
    debutDate:person&&person.mlbDebutDate||'',
    hitting:mlbNormHit(hitting),
    pitching:mlbNormPit(pitching),
    seasonYear:seasonYear||'',
    seasonHitting:mlbNormHit(seasonHit),
    seasonPitching:mlbNormPit(seasonPit)
  };
  return out;
};

function summaryFromCache(row){
  if(!row)return null;
  return {
    fetched:Date.now(),
    mlbId:row.mlbId,
    fullName:row.fullName||'',
    pos:row.pos||'', team:row.team||'', bats:row.bats||'', throws:row.throws||'',
    birthDate:row.birthDate||'', debutDate:row.debutDate||'',
    hitting:row.hitting||null, pitching:row.pitching||null,
    seasonYear:row.seasonYear||'', seasonHitting:row.seasonHitting||null, seasonPitching:row.seasonPitching||null
  };
}

window.mlbEnsureHeadshot=function mlbEnsureHeadshot(c){
  if(!c||!c.mlbId||c.imgId||c.imgUrl)return;
  c._pPhoto='https://img.mlbstatic.com/mlb-photos/image/upload/w_240,q_auto:best/v1/people/'+
    encodeURIComponent(c.mlbId)+'/headshot/67/current';
};

/** Compact chips for sheet / list — prefers card-year season, else career. */
window.mlbChipsHtml=function mlbChipsHtml(c){
  const s=c&&c.mlbStats; if(!s)return '';
  const yr=String(c.year||'').slice(0,4);
  const useSea=yr&&s.seasonYear===yr&&(s.seasonHitting||s.seasonPitching);
  const h=useSea?s.seasonHitting:s.hitting;
  const p=useSea?s.seasonPitching:s.pitching;
  const label=useSea?yr:'Career';
  const bits=[];
  if(h) bits.push(esc(h.avg||'—')+' AVG', (h.hr||0)+' HR', (h.rbi||0)+' RBI');
  else if(p) bits.push((p.w||0)+'-'+(p.l||0), esc(p.era||'—')+' ERA', (p.so||0)+' SO');
  if(!bits.length)return '';
  return `<div class="mlbChips" title="Free MLB Stats API"><span class="mlbChipLab">${esc(label)}</span>${bits.map(b=>`<span class="mlbChip">${b}</span>`).join('')}</div>`;
};

window.mlbEnrichCard=async function mlbEnrichCard(c,{force=false}={}){
  if(!c||!c.player)return null;
  const yr=String(c.year||'').replace(/\D/g,'').slice(0,4);
  const fresh=c.mlbStats&&c.mlbStats.fetched&&(Date.now()-c.mlbStats.fetched)<MLB_STATS_TTL;
  const seasonOk=!yr||(c.mlbStats&&c.mlbStats.seasonYear===yr);
  if(!force&&fresh&&seasonOk){
    mlbEnsureHeadshot(c);
    return c.mlbStats;
  }
  if(!force&&!c.mlbStats){
    const cached=mlbLookupCached(c);
    if(cached){
      c.mlbStats=summaryFromCache(cached);
      if(cached.mlbId)c.mlbId=cached.mlbId;
      if(!c.team&&cached.team)c.team=cached.team;
      mlbEnsureHeadshot(c);
      if(!yr||c.mlbStats.seasonYear===yr)return c.mlbStats;
    }
  }
  let id=c.mlbId;
  if(!id&&typeof mlbSearch==='function'){
    const hits=await mlbSearch(c.player);
    const hit=hits.find(p=>typeof bbNorm==='function'?bbNorm(p.name)===bbNorm(c.player):p.name===c.player)||hits[0];
    if(hit&&hit.mlbId){c.mlbId=hit.mlbId;id=hit.mlbId;}
  }
  if(!id)return c.mlbStats||null;
  const needCareer=force||!c.mlbStats||!fresh;
  const [person, hitting, pitching, seasonHit, seasonPit]=await Promise.all([
    needCareer?mlbFetchPerson(id):Promise.resolve(null),
    needCareer?mlbFetchCareerGroup(id,'hitting').catch(()=>null):Promise.resolve(null),
    needCareer?mlbFetchCareerGroup(id,'pitching').catch(()=>null):Promise.resolve(null),
    yr?mlbFetchSeasonGroup(id,'hitting',yr).catch(()=>null):Promise.resolve(null),
    yr?mlbFetchSeasonGroup(id,'pitching',yr).catch(()=>null):Promise.resolve(null)
  ]);
  if(person){
    c.mlbStats=mlbBuildSummary(person, hitting, pitching, seasonHit, seasonPit, yr);
  }else if(c.mlbStats){
    c.mlbStats.seasonYear=yr;
    c.mlbStats.seasonHitting=mlbNormHit(seasonHit);
    c.mlbStats.seasonPitching=mlbNormPit(seasonPit);
    c.mlbStats.fetched=Date.now();
  }else return null;
  mlbCachePut(c.mlbStats);
  if(!c.team&&c.mlbStats.team)c.team=c.mlbStats.team;
  if(c.mlbStats.pos){
    const tag='Pos: '+c.mlbStats.pos;
    if(!c.notes)c.notes=tag;
    else if(!String(c.notes).includes('Pos:'))c.notes=String(c.notes).trim()+' · '+tag;
  }
  mlbEnsureHeadshot(c);
  return c.mlbStats;
};

window.importAllMlbStats=async function importAllMlbStats({max=150,force=false}={}){
  if(!MLB_CAREER.loaded)await loadMlbCareerJson();
  const need=state.cards.filter(c=>{
    if(!c.player||String(c.player).trim().length<2)return false;
    if(force)return true;
    if(!c.mlbStats||!c.mlbStats.fetched)return true;
    return (Date.now()-c.mlbStats.fetched)>=MLB_STATS_TTL;
  }).slice(0,max);
  if(!need.length){showToast('MLB stats already loaded ✔');return 0;}
  showToast('Importing MLB career stats for '+need.length+'…');
  let done=0, fail=0, i=0;
  async function worker(){
    while(i<need.length){
      const c=need[i++];
      try{
        const s=await mlbEnrichCard(c,{force});
        if(s)done++; else fail++;
      }catch(e){fail++;}
    }
  }
  await Promise.all(Array.from({length:Math.min(4,need.length)},()=>worker()));
  save();
  if(typeof logActivity==='function')logActivity('mlb','Imported MLB stats ×'+done);
  showToast('MLB stats: '+done+' loaded'+(fail?(' · '+fail+' skipped'):'')+(need.length>=max?' — run again for more':''));
  if(sel&&typeof openSheet==='function')openSheet();
  else if(typeof render==='function')render();
  return done;
};

window.downloadMlbCareerJson=function downloadMlbCareerJson(){
  const out={
    v:1,
    source:'statsapi.mlb.com',
    updated:new Date().toISOString(),
    count:Object.keys(MLB_CAREER.byId||{}).length,
    byId:MLB_CAREER.byId||{},
    byName:MLB_CAREER.byName||{}
  };
  download('mlb-career.json', JSON.stringify(out), 'application/json');
  showToast('Downloaded mlb-career.json ('+out.count+' players)');
};

function mlbGridHitting(h){
  if(!h)return '';
  return `<div class="mlbGrid">
    <div class="mlbCell"><div class="k">G</div><div class="v">${h.g}</div></div>
    <div class="mlbCell"><div class="k">AB</div><div class="v">${h.ab}</div></div>
    <div class="mlbCell"><div class="k">H</div><div class="v">${h.h}</div></div>
    <div class="mlbCell"><div class="k">HR</div><div class="v">${h.hr}</div></div>
    <div class="mlbCell"><div class="k">RBI</div><div class="v">${h.rbi}</div></div>
    <div class="mlbCell"><div class="k">SB</div><div class="v">${h.sb}</div></div>
    <div class="mlbCell"><div class="k">AVG</div><div class="v">${esc(h.avg)}</div></div>
    <div class="mlbCell"><div class="k">OBP</div><div class="v">${esc(h.obp)}</div></div>
    <div class="mlbCell"><div class="k">SLG</div><div class="v">${esc(h.slg)}</div></div>
    <div class="mlbCell"><div class="k">OPS</div><div class="v">${esc(h.ops)}</div></div>
  </div>`;
}
function mlbGridPitching(p){
  if(!p)return '';
  return `<div class="mlbGrid">
    <div class="mlbCell"><div class="k">W-L</div><div class="v">${p.w}-${p.l}</div></div>
    <div class="mlbCell"><div class="k">ERA</div><div class="v">${esc(p.era)}</div></div>
    <div class="mlbCell"><div class="k">IP</div><div class="v">${esc(String(p.ip))}</div></div>
    <div class="mlbCell"><div class="k">SO</div><div class="v">${p.so}</div></div>
    <div class="mlbCell"><div class="k">BB</div><div class="v">${p.bb}</div></div>
    <div class="mlbCell"><div class="k">SV</div><div class="v">${p.sv}</div></div>
    <div class="mlbCell"><div class="k">WHIP</div><div class="v">${esc(p.whip||'—')}</div></div>
    <div class="mlbCell"><div class="k">G</div><div class="v">${p.g}</div></div>
  </div>`;
}

window.renderMlbPanel=function renderMlbPanel(c){
  const s=c&&c.mlbStats;
  if(!s){
    return `<div class="panel mlbPanel" id="mlbPanel">
      <div class="ct">MLB stats (free)</div>
      <div class="teach-hint" style="color:var(--dim);font-size:12px;margin:0 0 8px">Season + career from the public MLB Stats API — no CardSight calls.</div>
      <button type="button" id="btnMlbLoad" class="bigim">Load MLB stats</button>
    </div>`;
  }
  const bio=[s.pos,s.team,s.bats&&s.throws?('B/T '+s.bats+'/'+s.throws):'',s.debutDate?('Debut '+s.debutDate):''].filter(Boolean).join(' · ');
  const h=s.hitting, p=s.pitching;
  const sh=s.seasonHitting, sp=s.seasonPitching;
  const yr=s.seasonYear||String(c.year||'').slice(0,4);
  return `<div class="panel mlbPanel" id="mlbPanel">
    <div class="ct">MLB stats <span style="font-weight:500;text-transform:none;letter-spacing:0">${esc(s.fullName||c.player||'')}</span></div>
    <div class="mlbBio">${esc(bio||'—')}</div>
    ${typeof mlbChipsHtml==='function'?mlbChipsHtml(c):''}
    ${(sh||sp)?`<div class="ct" style="margin-top:10px">${esc(yr)} season</div>
      ${mlbGridHitting(sh)}${sp&&!sh?mlbGridPitching(sp):(sp?`<div class="ct" style="margin-top:8px">${esc(yr)} pitching</div>`+mlbGridPitching(sp):'')}`:''}
    ${h?`<div class="ct" style="margin-top:10px">Career hitting</div>${mlbGridHitting(h)}`:''}
    ${p?`<div class="ct" style="margin-top:10px">Career pitching</div>${mlbGridPitching(p)}`:''}
    <div class="home-actions" style="margin-top:8px">
      <button type="button" id="btnMlbLoad">Refresh stats</button>
      ${s.mlbId?`<a class="mlbLink" href="https://www.mlb.com/player/${s.mlbId}" target="_blank" rel="noopener">MLB.com</a>`:''}
    </div>
  </div>`;
};

window.wireMlbPanel=function wireMlbPanel(c){
  const b=$('btnMlbLoad');
  if(b)b.onclick=async()=>{
    try{
      showToast('Loading MLB stats…');
      await mlbEnrichCard(c,{force:true});
      save();
      openSheet();
      showToast('MLB stats loaded ✔');
    }catch(e){showToast(e.message||'MLB lookup failed');}
  };
};

/* Public stats JSON only — collection stays on this phone */
window.openMlbJsonPanel=function openMlbJsonPanel(){
  const n=Object.keys(MLB_CAREER.byId||{}).length;
  const bk=document.createElement('div');
  bk.className='showModeBk';
  bk.innerHTML=`<div class="showMode">
    <div class="casHead">
      <div>
        <div class="heroTitle" style="font-size:18px">MLB stats JSON</div>
        <div class="heroSub" style="margin:0">Public file on GitHub: data/mlb-career.json. Your card collection stays on this phone (⋯ → Backup).</div>
      </div>
      <button type="button" id="ghClose">✕</button>
    </div>
    <div class="mlbBio" style="margin-bottom:10px">${n? (n+' players loaded'):'Loading…'}${MLB_CAREER.updated?(' · updated '+esc(String(MLB_CAREER.updated).slice(0,10))):''}</div>
    <div class="home-actions">
      <button type="button" class="bigim" id="mlbReload">Reload JSON</button>
      <button type="button" id="mlbDl">Download JSON</button>
      <button type="button" id="mlbImport">Import onto cards</button>
    </div>
  </div>`;
  document.body.appendChild(bk);
  const close=()=>bk.remove();
  $('ghClose').onclick=close;
  bk.addEventListener('click',e=>{if(e.target===bk)close();});
  $('mlbReload').onclick=async()=>{
    await loadMlbCareerJson();
    showToast((Object.keys(MLB_CAREER.byId).length)+' players in JSON');
    close(); openMlbJsonPanel();
  };
  $('mlbDl').onclick=()=>downloadMlbCareerJson();
  $('mlbImport').onclick=async()=>{close(); await importAllMlbStats();};
};

/* Back-compat aliases so old buttons keep working */
window.openGitHubPanel=window.openMlbJsonPanel;

/* Prefetch public JSON once app is up */
setTimeout(()=>{ loadMlbCareerJson().catch(()=>{}); }, 400);

})();
