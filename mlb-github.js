/* Card Vault — MLB career stats (statsapi.mlb.com) + GitHub vault sync */
(function(){
'use strict';
if(typeof window==='undefined')return;

const MLB_API='https://statsapi.mlb.com/api/v1';
const MLB_STATS_TTL=30*864e5; /* re-fetch career lines after 30 days */

function ghCfg(){
  state.meta=state.meta||{};
  state.meta.github=state.meta.github||{token:'',owner:'',repo:'',path:'vault/collection.json'};
  return state.meta.github;
}

window.mlbPickStat=function mlbPickStat(payload, group){
  const blocks=(payload&&payload.stats)||[];
  const hit=blocks.find(s=>String((s.group&&s.group.displayName)||'').toLowerCase()===group)
    ||blocks.find(s=>String((s.type&&s.type.displayName)||'').toLowerCase()==='career');
  const split=(hit&&hit.splits&&hit.splits[0])||null;
  return split&&split.stat?split.stat:null;
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

window.mlbBuildSummary=function mlbBuildSummary(person, hitting, pitching){
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
    hitting:null,
    pitching:null
  };
  if(hitting&&(+hitting.atBats||0)>0){
    out.hitting={
      g:+hitting.gamesPlayed||0,
      ab:+hitting.atBats||0,
      h:+hitting.hits||0,
      hr:+hitting.homeRuns||0,
      rbi:+hitting.rbi||0,
      sb:+hitting.stolenBases||0,
      bb:+hitting.baseOnBalls||0,
      so:+hitting.strikeOuts||0,
      avg:hitting.avg||'',
      obp:hitting.obp||'',
      slg:hitting.slg||'',
      ops:hitting.ops||''
    };
  }
  if(pitching&&(+pitching.gamesPlayed||0)>0){
    out.pitching={
      g:+pitching.gamesPlayed||0,
      gs:+pitching.gamesStarted||0,
      w:+pitching.wins||0,
      l:+pitching.losses||0,
      sv:+pitching.saves||0,
      ip:pitching.inningsPitched||'',
      so:+pitching.strikeOuts||0,
      bb:+pitching.baseOnBalls||0,
      era:pitching.era||'',
      whip:pitching.whip||''
    };
  }
  return out;
};

window.mlbEnrichCard=async function mlbEnrichCard(c,{force=false}={}){
  if(!c||!c.player)return null;
  if(!force&&c.mlbStats&&c.mlbStats.fetched&&(Date.now()-c.mlbStats.fetched)<MLB_STATS_TTL)return c.mlbStats;
  let id=c.mlbId;
  if(!id&&typeof mlbSearch==='function'){
    const hits=await mlbSearch(c.player);
    const hit=hits.find(p=>typeof bbNorm==='function'?bbNorm(p.name)===bbNorm(c.player):p.name===c.player)||hits[0];
    if(hit&&hit.mlbId){c.mlbId=hit.mlbId;id=hit.mlbId;}
  }
  if(!id)return null;
  const [person, hitting, pitching]=await Promise.all([
    mlbFetchPerson(id),
    mlbFetchCareerGroup(id,'hitting').catch(()=>null),
    mlbFetchCareerGroup(id,'pitching').catch(()=>null)
  ]);
  if(!person)return null;
  c.mlbStats=mlbBuildSummary(person, hitting, pitching);
  if(!c.team&&c.mlbStats.team)c.team=c.mlbStats.team;
  if(c.mlbStats.pos){
    const tag='Pos: '+c.mlbStats.pos;
    if(!c.notes)c.notes=tag;
    else if(!String(c.notes).includes('Pos:'))c.notes=String(c.notes).trim()+' · '+tag;
  }
  return c.mlbStats;
};

window.importAllMlbStats=async function importAllMlbStats({max=150,force=false}={}){
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

window.renderMlbPanel=function renderMlbPanel(c){
  const s=c&&c.mlbStats;
  if(!s){
    return `<div class="panel mlbPanel" id="mlbPanel">
      <div class="ct">MLB career</div>
      <div class="teach-hint" style="color:var(--dim);font-size:12px;margin:0 0 8px">Pull free career lines from MLB for this player.</div>
      <button type="button" id="btnMlbLoad" class="bigim">Import MLB stats</button>
    </div>`;
  }
  const bio=[s.pos,s.team,s.bats&&s.throws?('B/T '+s.bats+'/'+s.throws):'',s.debutDate?('Debut '+s.debutDate):''].filter(Boolean).join(' · ');
  const h=s.hitting, p=s.pitching;
  return `<div class="panel mlbPanel" id="mlbPanel">
    <div class="ct">MLB career <span style="font-weight:500;text-transform:none;letter-spacing:0">${esc(s.fullName||c.player||'')}</span></div>
    <div class="mlbBio">${esc(bio||'—')}</div>
    ${h?`<div class="mlbGrid">
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
    </div>`:''}
    ${p?`<div class="ct" style="margin-top:10px">Pitching</div>
    <div class="mlbGrid">
      <div class="mlbCell"><div class="k">W-L</div><div class="v">${p.w}-${p.l}</div></div>
      <div class="mlbCell"><div class="k">ERA</div><div class="v">${esc(p.era)}</div></div>
      <div class="mlbCell"><div class="k">IP</div><div class="v">${esc(String(p.ip))}</div></div>
      <div class="mlbCell"><div class="k">SO</div><div class="v">${p.so}</div></div>
      <div class="mlbCell"><div class="k">BB</div><div class="v">${p.bb}</div></div>
      <div class="mlbCell"><div class="k">SV</div><div class="v">${p.sv}</div></div>
      <div class="mlbCell"><div class="k">WHIP</div><div class="v">${esc(p.whip||'—')}</div></div>
      <div class="mlbCell"><div class="k">G</div><div class="v">${p.g}</div></div>
    </div>`:''}
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

/* ---- GitHub vault sync (Contents API) ---- */
function ghHeaders(token){
  return {
    'Accept':'application/vnd.github+json',
    'Authorization':'Bearer '+token,
    'X-GitHub-Api-Version':'2022-11-28',
    'Content-Type':'application/json'
  };
}

window.ghConfigure=function ghConfigure(){
  const g=ghCfg();
  const token=prompt('GitHub personal access token (repo Contents read/write).\nStored only on this phone — use a private repo for your collection.', g.token||'');
  if(token===null)return;
  const owner=prompt('GitHub user or org', g.owner||'italian1superman');
  if(owner===null)return;
  const repo=prompt('Repository name (prefer private)', g.repo||'card-vault-data');
  if(repo===null)return;
  const path=prompt('File path in that repo', g.path||'vault/collection.json');
  if(path===null)return;
  g.token=String(token).trim();
  g.owner=String(owner).trim();
  g.repo=String(repo).trim();
  g.path=String(path).trim().replace(/^\//,'');
  save();
  showToast(g.token?'GitHub linked ✔':'GitHub token cleared');
};

async function ghGetContent(){
  const g=ghCfg();
  if(!g.token||!g.owner||!g.repo||!g.path)throw new Error('Configure GitHub first (⋯ menu)');
  const url='https://api.github.com/repos/'+encodeURIComponent(g.owner)+'/'+encodeURIComponent(g.repo)+'/contents/'+g.path.split('/').map(encodeURIComponent).join('/');
  const r=await fetch(url+'?ref=main',{headers:ghHeaders(g.token)});
  if(r.status===404){
    const r2=await fetch(url,{headers:ghHeaders(g.token)});
    if(r2.status===404)return {sha:null,json:null};
    if(!r2.ok)throw new Error('GitHub '+r2.status);
    const j=await r2.json();
    return {sha:j.sha,json:JSON.parse(base64ToUtf8(j.content||''))};
  }
  if(!r.ok)throw new Error('GitHub '+r.status+(r.status===401?' — check token':''));
  const j=await r.json();
  return {sha:j.sha,json:JSON.parse(base64ToUtf8(j.content||''))};
}
function base64ToUtf8(b64){
  const bin=atob(String(b64).replace(/\s/g,''));
  const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function utf8ToBase64(str){
  const bytes=new TextEncoder().encode(str);
  let bin='';
  bytes.forEach(b=>bin+=String.fromCharCode(b));
  return btoa(bin);
}

window.ghPushVault=async function ghPushVault({withPhotos=false}={}){
  const g=ghCfg();
  if(!g.token){ghConfigure();if(!ghCfg().token)return;}
  showToast('Pushing vault to GitHub…');
  const out={v:2,cards:state.cards,meta:{...state.meta,lastBackup:Date.now(),github:{...g,token:'***'}},savedAt:new Date().toISOString()};
  /* never write the raw token into the repo file */
  if(out.meta.github)out.meta.github.token='***';
  if(withPhotos){
    out.photos={};
    for(const c of state.cards)if(c.imgId){const d=await getImg(c);if(d)out.photos[c.imgId]=d;}
  }
  const body=JSON.stringify(out,null,2);
  if(body.length>900000&&withPhotos){
    if(!confirm('Backup is large ('+Math.round(body.length/1024)+' KB). GitHub Contents API prefers smaller files. Continue anyway?'))return;
  }
  let sha=null;
  try{const cur=await ghGetContent();sha=cur.sha;}catch(e){/* new file */}
  const url='https://api.github.com/repos/'+encodeURIComponent(g.owner)+'/'+encodeURIComponent(g.repo)+'/contents/'+g.path.split('/').map(encodeURIComponent).join('/');
  const payload={
    message:'Card Vault backup '+today()+' · '+state.cards.length+' cards',
    content:utf8ToBase64(body),
    branch:'main'
  };
  if(sha)payload.sha=sha;
  const r=await fetch(url,{method:'PUT',headers:ghHeaders(g.token),body:JSON.stringify(payload)});
  if(!r.ok){
    const err=await r.text().catch(()=>'');
    throw new Error('Push failed '+r.status+(err?(': '+err.slice(0,120)):'')+'\nCreate a private repo "'+g.repo+'" first if needed.');
  }
  state.meta.lastBackup=Date.now();
  state.meta.githubLastPush=Date.now();
  save();
  if(typeof logActivity==='function')logActivity('github','Pushed '+state.cards.length+' cards to GitHub');
  showToast('Saved to GitHub ✔  '+g.owner+'/'+g.repo);
  render();
};

window.ghPullVault=async function ghPullVault(){
  const g=ghCfg();
  if(!g.token){ghConfigure();if(!ghCfg().token)return;}
  showToast('Loading vault from GitHub…');
  const cur=await ghGetContent();
  if(!cur.json||!Array.isArray(cur.json.cards))throw new Error('No collection.json on GitHub yet — push first');
  const j=cur.json;
  const replace=confirm('GitHub has '+j.cards.length+' cards.\nOK = REPLACE this phone’s '+state.cards.length+'\nCancel = merge new only');
  if(replace)state.cards=j.cards;
  else{
    const ids=new Set(state.cards.map(c=>c.id));
    j.cards.forEach(c=>{if(!ids.has(c.id))state.cards.push(c);});
  }
  if(j.photos)for(const k in j.photos){await idb.put(k,j.photos[k]);imgCache.set(k,j.photos[k]);}
  if(j.meta){
    const keepTok=ghCfg().token, keepOwner=ghCfg().owner, keepRepo=ghCfg().repo, keepPath=ghCfg().path;
    state.meta={...state.meta,...j.meta};
    state.meta.github={token:keepTok,owner:keepOwner,repo:keepRepo,path:keepPath};
  }
  state.meta.lastBackup=Date.now();
  save();
  if(typeof logActivity==='function')logActivity('github','Pulled vault from GitHub');
  showToast('Restored from GitHub ✔');
  render();
};

window.openGitHubPanel=function openGitHubPanel(){
  const g=ghCfg();
  const linked=!!(g.token&&g.owner&&g.repo);
  const bk=document.createElement('div');
  bk.className='showModeBk';
  bk.innerHTML=`<div class="showMode">
    <div class="casHead">
      <div>
        <div class="heroTitle" style="font-size:18px">GitHub vault</div>
        <div class="heroSub" style="margin:0">Store your collection (and MLB stats) in a repo so a phone wipe can’t erase it. Prefer a private repo.</div>
      </div>
      <button type="button" id="ghClose">✕</button>
    </div>
    <div class="mlbBio" style="margin-bottom:10px">${linked?esc(g.owner+'/'+g.repo+' · '+g.path):'Not linked yet'}${state.meta.githubLastPush?(' · last push '+new Date(state.meta.githubLastPush).toLocaleDateString()):''}</div>
    <div class="home-actions">
      <button type="button" class="bigim" id="ghCfg">Configure</button>
      <button type="button" id="ghPush" ${linked?'':'disabled'}>Push to GitHub</button>
      <button type="button" id="ghPull" ${linked?'':'disabled'}>Pull from GitHub</button>
    </div>
    <div class="teach-hint" style="color:var(--dim);font-size:12px;margin-top:12px">Create a fine-grained PAT with Contents read/write on that repo. Token stays in this phone’s storage — it is not written into the backup file.</div>
  </div>`;
  document.body.appendChild(bk);
  const close=()=>bk.remove();
  $('ghClose').onclick=close;
  bk.addEventListener('click',e=>{if(e.target===bk)close();});
  $('ghCfg').onclick=()=>{ghConfigure();close();openGitHubPanel();};
  $('ghPush').onclick=async()=>{try{await ghPushVault();close();}catch(e){alert(e.message);}};
  $('ghPull').onclick=async()=>{try{await ghPullVault();close();}catch(e){alert(e.message);}};
};

})();
