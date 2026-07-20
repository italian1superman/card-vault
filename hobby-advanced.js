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

window.csHydrateCard=function csHydrateCard(nc,x,par){
  FIELDS.forEach(f=>{if(!(f in nc))nc[f]=f==='qty'?1:'';});
  nc.sport=BB_SPORT;
  nc.player=x.name||x.player||nc.player||'';
  nc.year=x.releaseYear||x.year||nc.year||'';
  const setBits=[x.releaseName,x.setName&&!/^base\b/i.test(String(x.setName))?x.setName:''].filter(Boolean);
  nc.setName=setBits.join(' ').trim()||nc.setName||'';
  nc.num=x.number||x.num||nc.num||'';
  nc.csId=x.id||x.cardId||nc.csId||'';
  nc.brand=x.manufacturerName||x.brand||nc.brand||'';
  if(x.releaseId)nc.csReleaseId=x.releaseId;
  if(x.setId)nc.csSetId=x.setId;
  nc.rookie=!!(nc.rookie||(x.attributes||[]).some(a=>/^rc$|rookie/i.test(a)));
  const attrs=(x.attributes||[]).filter(a=>!/^rc$|rookie/i.test(a)&&!/^mlb-/i.test(a));
  if(attrs.length&&!nc.team){
    const teamish=attrs.find(a=>/^[A-Z]{2,3}$|^MLB-/i.test(a));
    if(teamish)nc.team=String(teamish).replace(/^MLB-/i,'');
  }
  if(par&&par.id){
    nc.variant=par.name||nc.variant||'';
    nc.csParallelId=par.id;
    if(par.numberedTo)nc.serial='/'+par.numberedTo;
  }else{
    nc.csParallelId='';
    if(!nc.variant)nc.variant='';
  }
  return nc;
};

window.csEnsureParallels=async function csEnsureParallels(x){
  if(x.parallels&&x.parallels.length)return x.parallels;
  if(!x.id)return [];
  try{
    const d=await csFetchCached('/v1/catalog/cards/'+x.id,{},{ttlMs:CS_TTL_CARD});
    if(d&&d.parallels){x.parallels=d.parallels;if(d.manufacturerName&&!x.manufacturerName)x.manufacturerName=d.manufacturerName;return d.parallels;}
  }catch(e){}
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
  try{
    const url=csImgSrc(await csImageData(x.id));
    if(url){
      if(url.startsWith('data:')){nc.imgId=nc.id;imgCache.set(nc.id,url);await idb.put(nc.id,url);save();}
      else {nc.imgUrl=url;save();}
    }
  }catch(e){}
  /* background price if linked and no price yet */
  if(nc.csId&&!nc.prices.length){
    csBulkPriceByIds([nc.csId]).then(map=>{
      if(map[nc.csId]!=null&&applyCsPrice(nc,map[nc.csId],'cardsight')){save(); if(tab==='dash'||sel===nc)render();}
    }).catch(()=>{});
  }
  if(!quiet){
    if(typeof confettiBurst==='function')confettiBurst();
    showToast((status==='want'?'⭐ Wanted: ':'✔ Added: ')+nc.player+(nc.variant?' · '+nc.variant:'')+(nc.num?' #'+nc.num:''));
  }
  return nc;
};

window.psaPopUrl=function psaPopUrl(c){
  const q=[c.year,c.setName,c.player,c.num].filter(Boolean).join(' ');
  return 'https://www.psacard.com/pop/search?q='+encodeURIComponent(q);
};
window.psaCertUrl=function psaCertUrl(cert){
  return 'https://www.psacard.com/cert/'+encodeURIComponent(String(cert||'').trim());
};
window.tcdbSetUrl=function tcdbSetUrl(year,name){
  return 'https://www.tcdb.com/Search.cfm?SearchTerm='+encodeURIComponent([year,name].filter(Boolean).join(' '));
};
window.renderDeepLinks=function renderDeepLinks(c){
  return `<div class="deepLinks">
    <a href="${ebaySoldUrl(c)}" target="_blank" rel="noopener">eBay sold</a>
    <a href="${ebayLiveUrl(c)}" target="_blank" rel="noopener">eBay live</a>
    <a href="${tcdbUrl(c)}" target="_blank" rel="noopener">TCDB</a>
    <a href="${psaPopUrl(c)}" target="_blank" rel="noopener">PSA</a>
    ${c.gradeCert?`<a href="${psaCertUrl(c.gradeCert)}" target="_blank" rel="noopener">Cert ${esc(c.gradeCert)}</a>`:''}
    <a href="${imgSearchUrl(c)}" target="_blank" rel="noopener">Images</a>
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
    <button data-f="explore">🔍 Find a player</button>
    <button data-f="sets">📚 Build a set</button>
    <button data-f="add">＋ Blank card</button>
    <button data-f="want">⭐ New want</button>`;
  document.body.appendChild(m);
  m.querySelectorAll('button').forEach(b=>b.onclick=()=>{
    m.remove();
    const a=b.dataset.f;
    if(a==='explore'){tab='explore';render(); setTimeout(()=>{const i=$('exQ');if(i)i.focus();},100);}
    else if(a==='sets'){tab='sets';render();}
    else if(a==='add'){tab='have';addCard();}
    else if(a==='want'){tab='want';addCard();}
  });
  setTimeout(()=>document.addEventListener('click',function h(e){
    if(!m.contains(e.target)&&e.target.id!=='fab'){m.remove();document.removeEventListener('click',h);}
  }),0);
};
})();
