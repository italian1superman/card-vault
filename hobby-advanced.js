/* Card Vault — advanced hobbyist layer (prefetch, parallels, Sets, booth, pop, filters)
   Friendlier UX pass: soft dupes, richer parallel sheet, celebrations. */
(function(){
'use strict';
if(typeof window==='undefined')return;

const QUICK_PLAYERS=['Ken Griffey Jr','Shohei Ohtani','Mike Trout','Aaron Judge','Ronald Acuña Jr','Juan Soto','Elly De La Cruz','Paul Skenes'];

window.csPrefetchImages=async function csPrefetchImages(ids,{concurrency=6,toast=true}={}){
  const list=[...new Set((ids||[]).filter(Boolean))];
  if(!list.length)return 0;
  let i=0, done=0;
  async function worker(){
    while(i<list.length){
      const id=list[i++];
      try{await csImageData(id);done++;}catch(e){}
    }
  }
  await Promise.all(Array.from({length:Math.min(concurrency,list.length)},()=>worker()));
  if(toast)showToast('🖼 '+done+' photos ready · free');
  return done;
};

window.ownKey=function ownKey(csId,parallelId){
  return String(csId||'')+'|'+(parallelId||'');
};
window.findOwned=function findOwned(csId,parallelId){
  if(!csId)return null;
  const pid=parallelId||'';
  return state.cards.find(c=>c.csId===csId&&(c.csParallelId||'')===pid&&c.status!=='sold')||null;
};
window.ownCountInSet=function ownCountInSet(setId){
  const have=new Set();
  for(const c of state.cards){
    if(c.status==='have'&&c.csSetId===setId&&c.csId)have.add(c.csId);
  }
  return have.size;
};
window.ownParallelCountInSet=function ownParallelCountInSet(setId){
  let n=0;
  for(const c of state.cards){
    if(c.status==='have'&&c.csSetId===setId&&c.csId)n++;
  }
  return n;
};

const MLB_TEAMS={
  ARI:'Diamondbacks',ATL:'Braves',BAL:'Orioles',BOS:'Red Sox',CHC:'Cubs',CIN:'Reds',CLE:'Guardians',
  COL:'Rockies',CWS:'White Sox',CHW:'White Sox',DET:'Tigers',HOU:'Astros',KC:'Royals',KCR:'Royals',
  LAA:'Angels',LAD:'Dodgers',MIA:'Marlins',MIL:'Brewers',MIN:'Twins',NYM:'Mets',NYY:'Yankees',
  OAK:'Athletics',ATH:'Athletics',PHI:'Phillies',PIT:'Pirates',SD:'Padres',SDP:'Padres',SEA:'Mariners',
  SF:'Giants',SFG:'Giants',STL:'Cardinals',TB:'Rays',TBR:'Rays',TEX:'Rangers',TOR:'Blue Jays',
  WSH:'Nationals',WAS:'Nationals',WSN:'Nationals'
};
const BRAND_HINT=/^(Topps|Bowman|Upper Deck|Panini|Donruss|Fleer|Leaf|Score|Sage|Stadium Club|Heritage|Gypsy Queen|Allen\s*&\s*Ginter|Chrome|Prizm|Select|Mosaic|Optic)/i;

window.csSplitCardName=function csSplitCardName(name){
  const n=String(name||'').trim();
  const m=n.match(/^(.+?)\s+[—\-–]\s+(.+)$/);
  if(m&&m[2].trim().split(/\s+/).length>=2)return{player:m[2].trim(),subtitle:m[1].trim()};
  return{player:n,subtitle:''};
};
window.csInferBrand=function csInferBrand(x){
  if(x.manufacturerName)return x.manufacturerName;
  if(x.brand)return x.brand;
  if(x.manufacturer)return x.manufacturer;
  const blob=[x.releaseName,x.setName].filter(Boolean).join(' ');
  const m=blob.match(BRAND_HINT);
  return m?m[1].replace(/\s+/g,' ').trim():'';
};
window.csParseAttributes=function csParseAttributes(attrs){
  const out={team:'',rookie:false,flags:[],raw:[]};
  for(const a of (attrs||[])){
    const s=String(a||'').trim(); if(!s)continue;
    out.raw.push(s);
    if(/^rc$|rookie/i.test(s)){out.rookie=true;continue;}
    const mlb=s.match(/^MLB-([A-Z]{2,3})$/i);
    if(mlb){
      const code=mlb[1].toUpperCase();
      out.team=MLB_TEAMS[code]||code;
      continue;
    }
    if(/^(AU|AUTO|AUTOGRAPH)/i.test(s)){out.flags.push('Autograph');continue;}
    if(/^(MEM|RELIC|PATCH|JSY|JERSEY)/i.test(s)){out.flags.push('Memorabilia');continue;}
    if(/^(SSP|SP|SHORT\s*PRINT)/i.test(s)){out.flags.push(/^SSP/i.test(s)?'SSP':'SP');continue;}
    if(/^(1st|FIRST)\b/i.test(s)){out.flags.push('1st Bowman');continue;}
    if(/^[A-Z]{2,3}$/.test(s)&&MLB_TEAMS[s]){out.team=MLB_TEAMS[s];continue;}
    if(!/^(MLB|NBA|NFL|NHL)/i.test(s))out.flags.push(s);
  }
  return out;
};

/** Pull every field CardSight actually has for this card ID (detail + release brand). */
window.csEnrichCatalogCard=async function csEnrichCatalogCard(x){
  if(!x)return x;
  const id=x.id||x.cardId;
  let full=Object.assign({},x);
  if(id){
    try{
      const d=await csFetchCached('/v1/catalog/cards/'+id,{},{ttlMs:CS_TTL_CARD});
      if(d&&typeof d==='object')full=Object.assign({},full,d,{id:d.id||id});
    }catch(e){}
  }
  if(!full.manufacturerName&&full.releaseId){
    try{
      const rel=await csFetchCached('/v1/catalog/releases/'+full.releaseId,{},{ttlMs:CS_TTL_CAT});
      if(rel){
        if(rel.name&&!full.releaseName)full.releaseName=rel.name;
        if(rel.year&&!full.releaseYear)full.releaseYear=rel.year;
        /* manufacturer endpoint often 404 — brand inferred from release name */
      }
    }catch(e){}
  }
  if(!full.manufacturerName)full.manufacturerName=csInferBrand(full);
  const split=csSplitCardName(full.name||full.player||'');
  full._playerClean=split.player;
  full._subtitle=split.subtitle;
  full._attr=csParseAttributes(full.attributes||x.attributes||[]);
  if(full.parallelName&&!full.parallels){
    /* search hits sometimes include parallelName only */
    full._searchParallel=full.parallelName;
  }
  return full;
};

window.csHydrateCard=function csHydrateCard(nc,x,par){
  FIELDS.forEach(f=>{if(!(f in nc))nc[f]=f==='qty'?1:'';});
  const attr=x._attr||csParseAttributes(x.attributes||[]);
  const split=x._playerClean?{player:x._playerClean,subtitle:x._subtitle||''}:csSplitCardName(x.name||x.player||'');
  nc.sport=BB_SPORT;
  nc.player=split.player||x.name||x.player||nc.player||'';
  nc.year=String(x.releaseYear||x.year||nc.year||'').slice(0,4);
  const setBits=[x.releaseName,x.setName&&!/^base\b/i.test(String(x.setName||''))?x.setName:''].filter(Boolean);
  nc.setName=setBits.join(' ').trim()||nc.setName||'';
  nc.num=x.number||x.num||nc.num||'';
  nc.csId=x.id||x.cardId||nc.csId||'';
  nc.brand=csInferBrand(x)||nc.brand||'';
  if(x.releaseId)nc.csReleaseId=x.releaseId;
  if(x.setId)nc.csSetId=x.setId;
  nc.rookie=!!(nc.rookie||attr.rookie||(x.attributes||[]).some(a=>/^rc$|rookie/i.test(a)));
  if(attr.team)nc.team=attr.team;
  else if(!nc.team){
    const teamish=(x.attributes||[]).find(a=>/^MLB-/i.test(a)||(MLB_TEAMS[String(a||'').toUpperCase()]));
    if(teamish){
      const code=String(teamish).replace(/^MLB-/i,'').toUpperCase();
      nc.team=MLB_TEAMS[code]||code;
    }
  }
  if(par&&par.id){
    nc.variant=par.name||nc.variant||'';
    nc.csParallelId=par.id;
    if(par.numberedTo!=null&&par.numberedTo!=='')nc.serial='/'+par.numberedTo;
  }else if(x._searchParallel&&!nc.variant){
    nc.variant=x._searchParallel;
    nc.csParallelId='';
  }else{
    nc.csParallelId=nc.csParallelId||'';
    if(!nc.variant)nc.variant='';
  }
  /* notes: only add facts we know — never invent */
  const noteBits=[];
  if(split.subtitle)noteBits.push(split.subtitle);
  if(attr.flags.length)noteBits.push(attr.flags.join(' · '));
  if(par&&par.numberedTo)noteBits.push('Print run /'+par.numberedTo);
  else if(x.numberedTo)noteBits.push('Print run /'+x.numberedTo);
  if(noteBits.length){
    const add=noteBits.join(' · ');
    if(!nc.notes)nc.notes=add;
    else if(!String(nc.notes).includes(noteBits[0]))nc.notes=String(nc.notes).trim()+(String(nc.notes).trim()?' · ':'')+add;
  }
  return nc;
};

window.csEnsureParallels=async function csEnsureParallels(x){
  const full=await csEnrichCatalogCard(x);
  Object.assign(x,full);
  return x.parallels||[];
};

window.openParallelPicker=function openParallelPicker(x,status){
  return new Promise(async(resolve)=>{
    const pars=await csEnsureParallels(x);
    if(!pars.length){resolve(null);return;}
    const bk=document.createElement('div');
    bk.className='parPickBk';
    const verb=status==='want'?'Want':'Have';
    bk.innerHTML=`<div class="parPick">
      <div class="parHero">
        <div class="parThumb" id="parThumb">⚾</div>
        <div>
          <div class="parTitle">${esc(x.name||'Card')}</div>
          <div class="parSub">${esc([x.releaseYear||x.year,x.releaseName,x.setName,x.number?'#'+x.number:''].filter(Boolean).join(' · '))}</div>
          <div class="parSub">Pick Base or a parallel — fields fill in for you</div>
        </div>
      </div>
      <div class="parChips">
        <button type="button" data-p="base" class="parChip on">✨ Base</button>
        ${pars.map((p,i)=>`<button type="button" data-p="${i}" class="parChip">${esc(p.name||'Parallel')}${p.numberedTo?' <span>/'+esc(String(p.numberedTo))+'</span>':''}</button>`).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button type="button" class="bigxl" id="parGo" style="flex:1;box-shadow:none">Add to ${verb}</button>
        <button type="button" id="parCancel">Not now</button>
      </div>
    </div>`;
    document.body.appendChild(bk);
    let chosen=null;
    csImageData(x.id).then(d=>{
      const url=csImgSrc(d); const el=$('parThumb');
      if(url&&el)el.innerHTML=`<img src="${esc(url)}" alt="">`;
    }).catch(()=>{});
    bk.querySelectorAll('.parChip').forEach(b=>b.onclick=()=>{
      bk.querySelectorAll('.parChip').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      chosen=b.dataset.p==='base'?null:pars[+b.dataset.p];
    });
    const done=(par)=>{bk.remove();resolve(par);};
    $('parCancel').onclick=()=>{bk.remove();resolve(undefined);};
    $('parGo').onclick=()=>done(chosen);
    bk.addEventListener('click',e=>{if(e.target===bk){bk.remove();resolve(undefined);}});
  });
};

window.addFromCatalogAdvanced=async function addFromCatalogAdvanced(x,status,{parallel,skipPicker,skipDup,quiet}={}){
  if(!x)return null;
  /* Always hydrate from full catalog detail so empty list rows still populate everything available */
  if(!quiet)showToast('Filling card details…');
  x=await csEnrichCatalogCard(x);
  let par=parallel;
  if(par===undefined&&!skipPicker){
    const pick=await openParallelPicker(x,status);
    if(pick===undefined)return null;
    par=pick;
  }
  const existing=findOwned(x.id,par&&par.id);
  if(existing&&!skipDup){
    existing.qty=(+existing.qty||1)+1;save();
    if(typeof confettiBurst==='function')confettiBurst();
    showToast('＋ Qty now '+existing.qty+' · '+ (existing.player||'card')+(existing.variant?' · '+existing.variant:''), ()=>{
      existing.qty=Math.max(1,(+existing.qty||1)-1);save();render();
    });
    render();
    return existing;
  }
  const nc={id:uid(),created:Date.now(),status,qty:1,prices:[],rookie:false};
  csHydrateCard(nc,x,par||null);
  const v=(typeof EX!=='undefined'&&EX.prices)?EX.prices[x.id]:null;
  if(v!=null)nc.prices.push({d:today(),v:+(+v).toFixed(2),src:'cardsight'});
  state.cards.push(nc);save();
  /* photo + MLB team/id + market price — whatever is available, in parallel */
  const jobs=[];
  jobs.push((async()=>{
    try{
      const url=csImgSrc(await csImageData(x.id));
      if(url){
        if(url.startsWith('data:')){nc.imgId=nc.id;imgCache.set(nc.id,url);await idb.put(nc.id,url);}
        else nc.imgUrl=url;
        save();
      }
    }catch(e){}
  })());
  if(typeof enrichPlayerFields==='function'&&nc.player){
    jobs.push(enrichPlayerFields(nc,nc.player).catch(()=>{}));
  }
  if(nc.csId&&!nc.prices.length){
    jobs.push(csBulkPriceByIds([nc.csId]).then(map=>{
      if(map[nc.csId]!=null&&applyCsPrice(nc,map[nc.csId],'cardsight'))save();
    }).catch(()=>{}));
  }
  await Promise.all(jobs);
  if(!quiet){
    if(typeof confettiBurst==='function')confettiBurst();
    const bits=[nc.player,nc.year,nc.brand||nc.setName,nc.num?'#'+nc.num:'',nc.variant,nc.team,nc.rookie?'RC':''].filter(Boolean);
    showToast((status==='want'?'⭐ Wanted: ':'✔ Added: ')+bits.slice(0,4).join(' · '));
  }
  return nc;
};

window.psaPopUrl=function psaPopUrl(c){
  if(c&&c.gradeCert)return psaCertUrl(c.gradeCert);
  const q=(typeof cardSearchBits==='function'?cardSearchBits(c,{mode:'tcdb'}):[c.year,c.setName,c.player,c.num].filter(Boolean).join(' '));
  return 'https://www.psacard.com/pop/search?q='+encodeURIComponent(q||'');
};
window.psaCertUrl=function psaCertUrl(cert){
  const n=String(cert||'').replace(/\D/g,'');
  if(!n)return 'https://www.psacard.com/cert';
  return 'https://www.psacard.com/cert/'+encodeURIComponent(n);
};
window.tcdbSetUrl=function tcdbSetUrl(year,name){
  return 'https://www.tcdb.com/Search.cfm?SearchCategory=Baseball&SearchTerm='+encodeURIComponent([year,name].filter(Boolean).join(' '));
};
window.renderDeepLinks=function renderDeepLinks(c){
  if(typeof renderCardLinks==='function')return renderCardLinks(c);
  return `<div class="deepLinks">
    <a href="${ebaySoldUrl(c)}" target="_blank" rel="noopener">eBay sold</a>
    <a href="${tcdbUrl(c)}" target="_blank" rel="noopener">TCDB</a>
  </div>`;
};

window.formatPsapop=function formatPsapop(pop){
  if(!pop)return '';
  const total=pop.total_population!=null?Number(pop.total_population).toLocaleString():'—';
  let html=`<div><b>PSA pop</b> total ${total}`;
  const grades=pop.grades||pop.grade_populations||pop.population_by_grade||[];
  if(Array.isArray(grades)&&grades.length){
    html+='<div class="popLadder">'+grades.map(g=>{
      const lab=g.grade||g.name||g.label||'?';
      const n=g.count!=null?g.count:(g.population!=null?g.population:g.total);
      return `<span>${esc(String(lab))}: <b>${n!=null?Number(n).toLocaleString():'—'}</b></span>`;
    }).join('')+'</div>';
  }else if(pop.parallels&&pop.parallels.length){
    html+=' · '+pop.parallels.length+' parallel pop rows';
  }
  html+='</div>';
  return html;
};

/* ---- Auto live-ish values ---- */
window.autoRefreshPricesIfNeeded=async function autoRefreshPricesIfNeeded(){
  if(!csKey()||state.meta._priceBusy)return;
  const days=3;
  const stale=state.cards.filter(c=>c.csId&&c.status==='have'&&priceAgeDays(c)>=days)
    .sort((a,b)=>valueOf(b)-valueOf(a)).slice(0,50);
  if(!stale.length)return;
  const last=state.meta.lastAutoPrice||0;
  if(Date.now()-last<6*3600e3)return; /* at most every 6h */
  state.meta._priceBusy=true;
  try{
    showToast('Updating values for '+stale.length+' cards…');
    const map=await csBulkPriceByIds(stale.map(c=>c.csId),{force:true});
    let n=0;
    for(const c of stale){if(map[c.csId]!=null&&applyCsPrice(c,map[c.csId],'cardsight'))n++;}
    state.meta.lastAutoPrice=Date.now();save();
    if(n)showToast('💰 Updated '+n+' values');
  }catch(e){}
  finally{state.meta._priceBusy=false;}
};

window.confettiBurst=function confettiBurst(){
  const layer=document.createElement('div');
  layer.className='confetti';
  const colors=['#4da3ff','#3ecf7a','#ffb84d','#ff5d5d','#c99cff'];
  for(let i=0;i<18;i++){
    const p=document.createElement('i');
    p.style.left=(20+Math.random()*60)+'%';
    p.style.background=colors[i%colors.length];
    p.style.animationDelay=(Math.random()*0.2)+'s';
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(()=>layer.remove(),900);
};

window.SETS=window.SETS||{year:String(new Date().getFullYear()),q:'',releases:[],release:null,sets:[],set:null,cards:[],skip:0,total:0,loading:false};
window.QUICK_PLAYERS=QUICK_PLAYERS;

window.renderSets=async function renderSets(){
  const S=SETS;
  $('view').innerHTML=`<div class="panel heroPanel">
    <div class="heroTitle">📚 Build a set</div>
    <div class="heroSub">Search a release (like Topps Chrome), open a checklist, tap Have / Want. Progress saves automatically.</div>
    <div class="boothBar">
      <input id="setYear" type="number" inputmode="numeric" placeholder="Year" value="${esc(S.year||'')}" style="width:88px">
      <input id="setQ" placeholder="Try: Topps Chrome, Bowman, Heritage…" value="${esc(S.q||'')}" autocomplete="off" style="flex:1">
      <button class="bigxl" id="setSearch" style="flex:none;box-shadow:none">Find sets</button>
    </div>
    <div class="pill-row" id="setPills"></div>
    <div id="boothBox" class="boothBox">
      <div class="ct">⚡ Booth mode — add by card #</div>
      <div class="boothBar">
        <input id="bnYear" placeholder="Year" value="${esc(S.year||'')}" style="width:72px">
        <input id="bnSet" list="dlBoothSet" placeholder="Set name" style="flex:1.4">
        <input id="bnNum" placeholder="#" style="width:72px">
        <button id="bnGo" class="bigim" style="flex:none">Go</button>
      </div>
      <datalist id="dlBoothSet"></datalist>
      <div id="bnHint" class="teach-hint" style="color:var(--dim);font-size:12px;margin-top:6px">Year + set + # → pick parallel → done</div>
    </div>
    <div id="setReleases" class="setList"></div>
    <div id="setSets" class="setList" style="display:none"></div>
    <div id="setCheck" style="display:none"></div>
  </div>`;
  const pills=$('setPills');
  [['2024 Topps Chrome','2024','Topps Chrome'],['2025 Bowman','2025','Bowman'],['2024 Topps','2024','Topps Series'],['2023 Heritage','2023','Heritage']].forEach(([lab,y,q])=>{
    const b=document.createElement('button'); b.className='pill'; b.type='button'; b.textContent=lab;
    b.onclick=()=>{$('setYear').value=y;$('setQ').value=q;setsSearchReleases();};
    pills.appendChild(b);
  });
  $('setSearch').onclick=()=>setsSearchReleases();
  $('setQ').onkeydown=e=>{if(e.key==='Enter')setsSearchReleases();};
  $('bnGo').onclick=boothFind;
  $('bnNum').onkeydown=e=>{if(e.key==='Enter')boothFind();};
  $('bnSet').oninput=()=>{
    const v=$('bnSet').value.trim();
    if(v.length<2)return;
    csFetchCached('/v1/autocomplete/sets?q='+encodeURIComponent(v),{},{ttlMs:CS_TTL_FREE,free:true})
      .then(j=>{$('dlBoothSet').innerHTML=(j.suggestions||[]).slice(0,12).map(s=>`<option value="${esc(s)}">`).join('');}).catch(()=>{});
  };
  if(S.release&&S.set){await setsPaintChecklist();return;}
  if(S.release){setsPaintSets();return;}
  if(S.releases.length)setsPaintReleases();
};

window.setsSearchReleases=async function setsSearchReleases(){
  const year=($('setYear')&&$('setYear').value)||SETS.year||'';
  const q=($('setQ')&&$('setQ').value.trim())||'';
  SETS.year=year;SETS.q=q;SETS.release=null;SETS.set=null;SETS.cards=[];
  if(q.length<2)return showToast('Type a release — try Topps Chrome');
  $('setReleases').innerHTML='<div class="empty soft">Searching…</div>';
  try{
    const qq=[year,q,'baseball'].filter(Boolean).join(' ');
    const j=await csFetchCached('/v1/catalog/search?type=release&take=24&q='+encodeURIComponent(qq),{},{ttlMs:CS_TTL_CAT});
    SETS.releases=(j.results||[]).filter(r=>r.type==='release'||r.id);
    setsPaintReleases();
    if(!SETS.releases.length)showToast('No releases — try a shorter name');
  }catch(e){showToast('Search failed: '+e.message);}
};

window.setsPaintReleases=function setsPaintReleases(){
  const el=$('setReleases'); if(!el)return;
  el.style.display='block';
  if($('setSets'))$('setSets').style.display='none';
  if($('setCheck'))$('setCheck').style.display='none';
  if(!SETS.releases.length){el.innerHTML='<div class="empty soft">No releases yet — try a pill above.</div>';return;}
  el.innerHTML=`<div class="ct">${SETS.releases.length} releases — tap one</div>`+SETS.releases.map((r,i)=>`
    <div class="setRow" data-ri="${i}">
      <div><b>${esc(r.name)}</b><div class="l2">${esc([r.year,r.manufacturerName].filter(Boolean).join(' · '))}</div></div>
      <span class="count">Open →</span>
    </div>`).join('');
  el.querySelectorAll('[data-ri]').forEach(b=>b.onclick=()=>setsOpenRelease(SETS.releases[+b.dataset.ri]));
};

window.setsOpenRelease=async function setsOpenRelease(r){
  SETS.release=r;SETS.set=null;SETS.cards=[];
  $('setReleases').style.display='none';
  const box=$('setSets'); box.style.display='block'; box.innerHTML='<div class="empty soft">Loading checklists…</div>';
  try{
    const d=await csFetchCached('/v1/catalog/releases/'+r.id,{},{ttlMs:CS_TTL_CAT});
    SETS.sets=d.sets||[];
    SETS.release={...r,...d,sets:undefined};
    setsPaintSets();
  }catch(e){box.innerHTML='<div class="empty">Failed: '+esc(e.message)+'</div>';}
};

window.setsPaintSets=function setsPaintSets(){
  const box=$('setSets'); if(!box)return;
  box.style.display='block';
  if($('setCheck'))$('setCheck').style.display='none';
  const r=SETS.release;
  const ownedSets=SETS.sets.filter(s=>ownCountInSet(s.id)>0).length;
  box.innerHTML=`
    <div class="toolbar">
      <button type="button" id="setBackRel">← Back</button>
      <div class="ct" style="margin:0">${esc(r.year||'')} ${esc(r.name||'')} · ${SETS.sets.length} checklists · ${ownedSets} started</div>
      <a class="count" href="${tcdbSetUrl(r.year,r.name)}" target="_blank" rel="noopener">TCDB ↗</a>
    </div>
    ${SETS.sets.map((s,i)=>{
      const have=ownCountInSet(s.id);
      const tot=s.cardCount||0;
      const pct=tot?Math.min(100,Math.round(have/tot*100)):0;
      return `<div class="setRow" data-si="${i}">
        <div style="flex:1;min-width:0">
          <b>${esc(s.name)}</b>
          <div class="l2">${tot} cards · ${s.parallelCount||0} parallels · you have ${have}</div>
          <div class="prog"><i style="width:${pct}%"></i></div>
        </div>
        <span class="count">${pct}%</span>
      </div>`;
    }).join('')}`;
  $('setBackRel').onclick=()=>{SETS.release=null;SETS.set=null;setsPaintReleases();$('setReleases').style.display='block';box.style.display='none';};
  box.querySelectorAll('[data-si]').forEach(b=>b.onclick=()=>setsOpenChecklist(SETS.sets[+b.dataset.si]));
};

window.setsOpenChecklist=async function setsOpenChecklist(s){
  SETS.set=s;SETS.skip=0;SETS.cards=[];
  await setsLoadCards(true);
};

window.setsLoadCards=async function setsLoadCards(reset){
  const s=SETS.set; if(!s)return;
  if(reset){SETS.skip=0;SETS.cards=[];}
  const box=$('setCheck'); box.style.display='block';
  if($('setSets'))$('setSets').style.display='none';
  if(reset)box.innerHTML='<div class="empty soft">Loading cards + photos…</div>';
  try{
    const take=50;
    const j=await csFetchCached('/v1/catalog/sets/'+s.id+'/cards?take='+take+'&skip='+SETS.skip,{},{ttlMs:CS_TTL_CAT});
    const batch=j.cards||[];
    SETS.total=j.total_count||s.cardCount||batch.length;
    SETS.cards=SETS.cards.concat(batch);
    SETS.skip+=batch.length;
    await setsPaintChecklist();
    csPrefetchImages(batch.map(c=>c.id),{toast:false});
  }catch(e){box.innerHTML='<div class="empty">Checklist failed: '+esc(e.message)+'</div>';}
};

window.setsPaintChecklist=async function setsPaintChecklist(){
  const s=SETS.set,r=SETS.release,box=$('setCheck'); if(!box||!s)return;
  const haveN=ownCountInSet(s.id);
  const tot=SETS.total||s.cardCount||SETS.cards.length;
  const pct=tot?Math.min(100,Math.round(haveN/tot*100)):0;
  const parTypes=s.parallelCount||0;
  const masterDenom=parTypes?tot*(parTypes+1):tot;
  const masterHave=ownParallelCountInSet(s.id);
  const masterPct=masterDenom?Math.min(100,Math.round(masterHave/masterDenom*100)):pct;
  if(pct>=100&&!state.meta['_setDone_'+s.id]){
    state.meta['_setDone_'+s.id]=1;save();
    confettiBurst();showToast('🏆 Set complete — nice!');
  }
  box.innerHTML=`
    <div class="toolbar">
      <button type="button" id="setBackSets">← Sets</button>
      <div style="flex:1">
        <div class="ct" style="margin:0">${esc(r&&r.year||'')} ${esc(r&&r.name||'')} · ${esc(s.name)}</div>
        <div class="prog fat"><i style="width:${pct}%"></i></div>
        <div class="l2" style="font-size:12px;color:var(--dim)">Base ${haveN}/${tot} (${pct}%) · Master-ish ${masterPct}%</div>
      </div>
    </div>
    <div class="toolbar">
      <button type="button" id="setWantMiss" class="bigim">⭐ Missing → Want</button>
      <button type="button" id="setHaveAll">+ Loaded → Have</button>
      <a href="${tcdbSetUrl(r&&r.year, (r&&r.name||'')+' '+(s.name||''))}" target="_blank" rel="noopener">TCDB ↗</a>
      <span class="count">${SETS.cards.length}${SETS.cards.length<tot?' / '+tot:''}</span>
    </div>
    <div class="checkList" id="checkBody"></div>
    <div style="text-align:center;margin-top:10px">
      <button id="setMore" style="display:${SETS.cards.length<tot?'inline-block':'none'}">More cards ↓</button>
    </div>`;
  const body=$('checkBody');
  body.innerHTML=SETS.cards.map((x,i)=>{
    const own=findOwned(x.id,'');
    const rc=(x.attributes||[]).some(a=>/^rc$|rookie/i.test(a));
    const pc=(x.parallels&&x.parallels.length)||0;
    return `<div class="checkRow ${own?'owned':''}">
      <div class="thumb" id="ck-${i}">🃏</div>
      <div class="rmain">
        <div class="l1">#${esc(x.number||'?')} ${esc(x.name||'')}${rc?'<span class="badge b-rc">RC</span>':''}${own?'<span class="badge b-own">HAVE ×'+(own.qty||1)+'</span>':''}</div>
        <div class="l2">${pc?pc+' parallels':''}${(x.attributes||[]).filter(a=>!/^rc$/i.test(a)).slice(0,3).map(a=>' · '+esc(a)).join('')}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
        <button data-h="${i}" class="tinyAdd">+Have</button>
        <button data-w="${i}" class="tinyAdd">⭐</button>
      </div>
    </div>`;
  }).join('');
  body.querySelectorAll('[data-h]').forEach(b=>b.onclick=async()=>{
    await addFromCatalogAdvanced(SETS.cards[+b.dataset.h],'have');
    setsPaintChecklist();
  });
  body.querySelectorAll('[data-w]').forEach(b=>b.onclick=async()=>{
    await addFromCatalogAdvanced(SETS.cards[+b.dataset.w],'want');
    setsPaintChecklist();
  });
  SETS.cards.forEach(async(x,i)=>{
    const el=$('ck-'+i);if(!el)return;
    const url=csImgSrc(await csImageData(x.id));
    if(url&&$('ck-'+i))$('ck-'+i).innerHTML=`<img src="${esc(url)}" loading="lazy">`;
  });
  $('setBackSets').onclick=()=>{SETS.set=null;setsPaintSets();};
  $('setMore').onclick=()=>setsLoadCards(false);
  $('setWantMiss').onclick=async()=>{
    const miss=SETS.cards.filter(x=>!findOwned(x.id,''));
    if(!miss.length)return showToast('You already have all loaded cards');
    if(!confirm('Add '+miss.length+' missing cards to Want?'))return;
    showToast('Adding '+miss.length+'…');
    for(const x of miss)await addFromCatalogAdvanced(x,'want',{skipPicker:true,parallel:null,skipDup:true,quiet:true});
    confettiBurst();showToast('⭐ '+miss.length+' on your want list');
    setsPaintChecklist();
  };
  $('setHaveAll').onclick=async()=>{
    if(!confirm('Add all '+SETS.cards.length+' loaded base cards to Have?'))return;
    for(const x of SETS.cards)await addFromCatalogAdvanced(x,'have',{skipPicker:true,parallel:null,quiet:true});
    confettiBurst();showToast('✔ Loaded cards added');
    setsPaintChecklist();
  };
};

window.boothFind=async function boothFind(){
  const year=($('bnYear')&&$('bnYear').value.trim())||'';
  const set=($('bnSet')&&$('bnSet').value.trim())||'';
  const num=($('bnNum')&&$('bnNum').value.trim())||'';
  if(!set||!num)return showToast('Need set name and card #');
  const hint=$('bnHint'); if(hint)hint.textContent='Searching…';
  try{
    const q=[year,set,('#'+num),'baseball'].filter(Boolean).join(' ');
    const j=await csFetchCached('/v1/catalog/search?type=card&take=8&q='+encodeURIComponent(q),{},{ttlMs:CS_TTL_CAT});
    let cards=(j.results||[]).map(r=>({
      id:r.id,name:r.name,releaseYear:r.year,releaseName:r.releaseName,setName:r.setName||r.name,
      number:num,manufacturerName:r.manufacturerName
    }));
    if(!cards.length){
      const j2=await csSearchBaseballCards([year,set,num].filter(Boolean).join(' '),{take:12});
      cards=(j2.cards||[]).filter(c=>String(c.number||'')===String(num)||String(c.number||'').replace(/^0+/,'')===String(num).replace(/^0+/,''));
      if(!cards.length)cards=j2.cards||[];
    }
    if(!cards.length){if(hint)hint.textContent='No match — try fewer words';return showToast('No card found for that #');}
    let x=cards.find(c=>String(c.number||'')===String(num))||cards[0];
    try{
      const d=await csFetchCached('/v1/catalog/cards/'+x.id,{},{ttlMs:CS_TTL_CARD});
      if(d)Object.assign(x,d);
    }catch(e){}
    if(hint)hint.textContent='Found: '+(x.name||'')+' #'+(x.number||num);
    const status=confirm('Add to Have?\n\nOK = Have · Cancel = Want')?'have':'want';
    await addFromCatalogAdvanced(x,status);
  }catch(e){showToast('Booth search failed: '+e.message);}
};

window.openFabMenu=function openFabMenu(){
  const existing=$('fabMenu'); if(existing){existing.remove();return;}
  const m=document.createElement('div'); m.id='fabMenu';
  m.innerHTML=`
    <button data-f="show">🃏 Show Mode</button>
    <button data-f="explore">🔍 Find a player</button>
    <button data-f="sets">📚 Build a set</button>
    <button data-f="add">＋ Blank card</button>
    <button data-f="want">⭐ New want</button>`;
  document.body.appendChild(m);
  m.querySelectorAll('button').forEach(b=>b.onclick=()=>{
    m.remove();
    const a=b.dataset.f;
    if(a==='show'){if(typeof openShowMode==='function')openShowMode();}
    else if(a==='explore'){tab='explore';render(); setTimeout(()=>{const i=$('exQ');if(i)i.focus();},100);}
    else if(a==='sets'){tab='sets';render();}
    else if(a==='add'){tab='have';addCard();}
    else if(a==='want'){tab='want';addCard();}
  });
  setTimeout(()=>document.addEventListener('click',function h(e){
    if(!m.contains(e.target)&&e.target.id!=='fab'){m.remove();document.removeEventListener('click',h);}
  }),0);
};

/* ---- Player catalog cascade (only real cards for that player) ---- */
window.PCAT={q:'',cards:[],total:0,year:'',brand:'',setName:'',loading:false};

window.csCardBrand=function csCardBrand(x){
  return (typeof csInferBrand==='function'?csInferBrand(x):'')||x.manufacturerName||x.releaseName||'Other';
};
window.loadPlayerCatalog=async function loadPlayerCatalog(player,{append=false}={}){
  const q=String(player||'').trim();
  if(q.length<2){PCAT.q='';PCAT.cards=[];PCAT.total=0;return PCAT;}
  if(!append || PCAT.q!==q){PCAT.q=q;PCAT.cards=[];PCAT.year='';PCAT.brand='';PCAT.setName='';}
  PCAT.loading=true;
  const skip=PCAT.cards.length;
  const j=await csSearchBaseballCards(q,{take:48,skip});
  const seen=new Set(PCAT.cards.map(c=>c.id));
  for(const c of (j.cards||[])){ if(c.id&&!seen.has(c.id)){PCAT.cards.push(c);seen.add(c.id);} }
  PCAT.total=j.total_count||PCAT.cards.length;
  PCAT.loading=false;
  return PCAT;
};
window.pcatFiltered=function pcatFiltered(){
  let list=PCAT.cards.slice();
  if(PCAT.year)list=list.filter(x=>String(x.releaseYear||x.year||'')===String(PCAT.year));
  if(PCAT.brand)list=list.filter(x=>csCardBrand(x)===PCAT.brand);
  if(PCAT.setName)list=list.filter(x=>{
    const sn=[x.releaseName,x.setName&&!/^base\b/i.test(String(x.setName||''))?x.setName:''].filter(Boolean).join(' ').trim()||x.setName||'';
    return sn===PCAT.setName;
  });
  return list;
};
window.pcatOptions=function pcatOptions(){
  const base=PCAT.cards;
  const years=[...new Set(base.map(x=>String(x.releaseYear||x.year||'')).filter(Boolean))].sort((a,b)=>b.localeCompare(a));
  let list=base;
  if(PCAT.year)list=list.filter(x=>String(x.releaseYear||x.year||'')===String(PCAT.year));
  const brands=[...new Set(list.map(csCardBrand).filter(Boolean))].sort();
  if(PCAT.brand)list=list.filter(x=>csCardBrand(x)===PCAT.brand);
  const sets=[...new Set(list.map(x=>{
    return [x.releaseName,x.setName&&!/^base\b/i.test(String(x.setName||''))?x.setName:''].filter(Boolean).join(' ').trim()||x.setName||'Set';
  }).filter(Boolean))].sort();
  return {years,brands,sets,cards:pcatFiltered()};
};
window.applyCatalogToSheet=async function applyCatalogToSheet(x,c,{skipPicker=false}={}){
  if(!x||!c)return;
  showToast('Filling every field from catalog…');
  const full=await csEnrichCatalogCard(x);
  let par=null;
  if(!skipPicker){
    const pick=await openParallelPicker(full,c.status||'have');
    if(pick===undefined)return;
    par=pick;
  }
  csHydrateCard(c,full,par);
  c.sport=BB_SPORT;
  save();
  try{
    const url=csImgSrc(await csImageData(full.id));
    if(url){
      if(url.startsWith('data:')){c.imgId=c.id;imgCache.set(c.id,url);await idb.put(c.id,url);}
      else c.imgUrl=url;
      save();
    }
  }catch(e){}
  if(typeof enrichPlayerFields==='function'&&c.player)await enrichPlayerFields(c,c.player).catch(()=>{});
  if(c.csId&&!(c.prices&&c.prices.length)){
    try{
      const map=await csBulkPriceByIds([c.csId]);
      if(map[c.csId]!=null)applyCsPrice(c,map[c.csId],'cardsight');
      save();
    }catch(e){}
  }
  if(typeof confettiBurst==='function')confettiBurst();
  showToast('✔ '+[c.player,c.year,c.brand,c.num?'#'+c.num:'',c.variant].filter(Boolean).join(' · '));
  openSheet();
};
window.renderPlayerCascade=async function renderPlayerCascade(player,c){
  const box=$('propStrip'); if(!box)return;
  const q=String(player||'').trim();
  if(q.length<2){box.hidden=true;box.innerHTML='';return;}
  box.hidden=false;
  box.innerHTML=`<div class="cascade">
    <div class="ct">Real cards for ${esc(q)} — pick year → brand → set → card</div>
    <div class="empty soft" id="casLoad">Loading catalog…</div>
  </div>`;
  try{
    if(PCAT.q!==q || !PCAT.cards.length) await loadPlayerCatalog(q);
    paintCascade(box,c);
    csPrefetchImages(pcatFiltered().slice(0,24).map(x=>x.id),{toast:false});
  }catch(e){
    box.innerHTML=`<div class="cascade"><div style="color:var(--amber);padding:8px">${esc(e.message||'Catalog error')}</div></div>`;
  }
};
function paintCascade(box,c){
  const opt=pcatOptions();
  const cards=opt.cards.slice(0,60);
  const setAllOn=!PCAT.setName?'on':'';
  box.innerHTML=`<div class="cascade">
    <div class="casHead">
      <div class="ct" style="margin:0">⚾ ${esc(PCAT.q)} · ${PCAT.cards.length}${PCAT.total>PCAT.cards.length?' / '+PCAT.total:''} catalog cards</div>
      <button type="button" id="casMore" ${PCAT.cards.length>=PCAT.total?'disabled':''}>Load more</button>
      <button type="button" id="casExplore" class="bigim">Full Find →</button>
    </div>
    <div class="casLabel">Year <span>(only years this player has)</span></div>
    <div class="pill-row" id="casYears">
      <button type="button" class="pill ${!PCAT.year?'on':''}" data-y="">All</button>
      ${opt.years.map(y=>`<button type="button" class="pill ${PCAT.year===y?'on':''}" data-y="${esc(y)}">${esc(y)}</button>`).join('')}
    </div>
    <div class="casLabel">Brand / release</div>
    <div class="pill-row" id="casBrands">
      <button type="button" class="pill ${!PCAT.brand?'on':''}" data-b="">All</button>
      ${opt.brands.map(b=>`<button type="button" class="pill ${PCAT.brand===b?'on':''}" data-b="${esc(b)}">${esc(b)}</button>`).join('')}
    </div>
    <div class="casLabel">Set</div>
    <div class="pill-row" id="casSets">
      <button type="button" class="pill ${setAllOn}" data-s="">All</button>
      ${opt.sets.slice(0,40).map(s=>`<button type="button" class="pill ${PCAT.setName===s?'on':''}" data-s="${esc(s)}">${esc(s.length>28?s.slice(0,27)+'…':s)}</button>`).join('')}
    </div>
    <div class="casLabel">${cards.length} card${cards.length===1?'':'s'} — tap one to fill year, brand, set, #, parallel, photo, price</div>
    <div class="casGrid" id="casGrid">
      ${cards.length?cards.map((x,i)=>{
        const rc=(x.attributes||[]).some(a=>/^rc$|rookie/i.test(a));
        const own=typeof findOwned==='function'&&findOwned(x.id,'');
        const brand=csCardBrand(x);
        const label=(x.name||'').includes(' - ')?(x.name||'').split(' - ').pop():(x.name||'');
        return `<button type="button" class="casCard" data-i="${i}">
          <div class="casImg" id="cas-img-${i}">🃏</div>
          <div class="casMeta">
            <b>#${esc(x.number||'?')} ${esc(label)}</b>
            <span>${esc([x.releaseYear,brand,x.setName&&!/^base\b/i.test(String(x.setName||''))?x.setName:x.releaseName].filter(Boolean).join(' · '))}</span>
            <span>${rc?'RC · ':''}${(x.parallels&&x.parallels.length)?(x.parallels.length+' parallels'):'tap for parallels'}${own?' · HAVE':''}</span>
          </div>
        </button>`;
      }).join(''):`<div class="empty soft">No cards for these filters — tap All on a row above.</div>`}
    </div>
  </div>`;

  const rebind=()=>paintCascade(box,c);
  box.querySelectorAll('#casYears .pill').forEach(b=>b.onclick=()=>{PCAT.year=b.dataset.y||'';PCAT.brand='';PCAT.setName='';rebind();});
  box.querySelectorAll('#casBrands .pill').forEach(b=>b.onclick=()=>{PCAT.brand=b.dataset.b||'';PCAT.setName='';rebind();});
  box.querySelectorAll('#casSets .pill').forEach(b=>b.onclick=()=>{PCAT.setName=b.dataset.s||'';rebind();});
  const more=$('casMore'); if(more) more.onclick=async()=>{
    more.disabled=true; more.textContent='Loading…';
    await loadPlayerCatalog(PCAT.q,{append:true});
    paintCascade(box,c);
  };
  const ex=$('casExplore'); if(ex) ex.onclick=()=>{closeSheet();goExplorePlayer(PCAT.q);};
  const list=opt.cards.slice(0,60);
  box.querySelectorAll('.casCard').forEach(b=>b.onclick=()=>applyCatalogToSheet(list[+b.dataset.i],c));
  list.forEach(async(x,i)=>{
    const el=$('cas-img-'+i); if(!el)return;
    const url=csImgSrc(await csImageData(x.id));
    if(url&&$('cas-img-'+i))$('cas-img-'+i).innerHTML=`<img src="${esc(url)}" loading="lazy" alt="">`;
  });
  syncSheetCascadeFields(opt,c);
}
window.syncSheetCascadeFields=function syncSheetCascadeFields(opt,c){
  const fill=(id,arr)=>{const el=$(id); if(!el)return; el.innerHTML=[...new Set(arr)].filter(Boolean).map(v=>`<option value="${esc(v)}">`).join('');};
  fill('dlCasYear',opt.years||[]);
  fill('dlCasBrand',opt.brands||[]);
  fill('dlCasSet',opt.sets||[]);
  fill('dlCasNum',(opt.cards||[]).map(x=>x.number).filter(Boolean).slice(0,200));
  /* if filters imply single values, auto-fill empty fields for ease */
  if(c&&PCAT.year&&!c.year){c.year=PCAT.year; const i=$('sheet')&&$('sheet').querySelector('[data-k="year"]'); if(i)i.value=c.year;}
  if(c&&PCAT.brand&&!c.brand){c.brand=PCAT.brand; const i=$('sheet')&&$('sheet').querySelector('[data-k="brand"]'); if(i)i.value=c.brand;}
};

})();
