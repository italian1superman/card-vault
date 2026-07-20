/* Card Vault — advanced hobbyist layer (prefetch, parallels, Sets, booth, pop, filters)
   Loaded after main inline script hooks; also safe if inlined. */
(function(){
'use strict';
if(typeof window==='undefined')return;

/* ---- Prefetch pool (free images) ---- */
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
  if(toast)showToast('Images ready · '+done+' cards · 0 billed');
  return done;
};

/* ---- Ownership helpers ---- */
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

/* ---- Hydrate + parallel picker ---- */
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
    if(d&&d.parallels){x.parallels=d.parallels;return d.parallels;}
  }catch(e){}
  return x.parallels||[];
};

window.openParallelPicker=function openParallelPicker(x,status){
  return new Promise(async(resolve)=>{
    const pars=await csEnsureParallels(x);
    if(!pars.length){resolve(null);return;}
    const bk=document.createElement('div');
    bk.className='parPickBk';
    bk.innerHTML=`<div class="parPick">
      <div class="ct">Pick parallel for ${esc(x.name||'card')}</div>
      <div class="parChips">
        <button type="button" data-p="base" class="parChip on">Base</button>
        ${pars.map((p,i)=>`<button type="button" data-p="${i}" class="parChip">${esc(p.name||'Parallel')}${p.numberedTo?' <span>/'+esc(String(p.numberedTo))+'</span>':''}</button>`).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button type="button" class="bigxl" id="parGo" style="flex:1;box-shadow:none">Add to ${status==='want'?'Want':'Have'}</button>
        <button type="button" id="parCancel">Cancel</button>
      </div>
    </div>`;
    document.body.appendChild(bk);
    let chosen=null;
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

window.addFromCatalogAdvanced=async function addFromCatalogAdvanced(x,status,{parallel,skipPicker,skipDup}={}){
  if(!x)return null;
  let par=parallel;
  if(par===undefined&&!skipPicker){
    const pick=await openParallelPicker(x,status);
    if(pick===undefined)return null; /* cancelled */
    par=pick;
  }
  const existing=findOwned(x.id,par&&par.id);
  if(existing&&!skipDup){
    const ans=confirm('Already in vault: '+ (existing.player||'')+' '+(existing.variant||'Base')+'.\n\nOK = +1 qty on existing\nCancel = add as separate copy');
    if(ans){
      existing.qty=(+existing.qty||1)+1;save();render();
      showToast('Qty now '+(existing.qty)+' · '+existing.player);
      return existing;
    }
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
  showToast((status==='want'?'⭐ Want: ':'✔ Have: ')+nc.player+(nc.variant?' · '+nc.variant:'')+(nc.csId?' · linked':''));
  return nc;
};

/* ---- Deep links ---- */
window.psaPopUrl=function psaPopUrl(c){
  const q=[c.year,c.setName,c.player,c.num].filter(Boolean).join(' ');
  return 'https://www.psacard.com/pop/'+(c.gradeCert?('cert/'+encodeURIComponent(c.gradeCert)):'search?q='+encodeURIComponent(q));
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

/* ---- PSA pop ladder ---- */
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

/* ---- Sets tab state ---- */
window.SETS=window.SETS||{year:'2024',q:'',releases:[],release:null,sets:[],set:null,cards:[],skip:0,total:0,loading:false};

window.renderSets=async function renderSets(){
  const S=SETS;
  $('view').innerHTML=`<div class="panel">
    <div class="ct">Sets checklist — TCDB-style (CardSight data)</div>
    <div class="boothBar">
      <input id="setYear" type="number" inputmode="numeric" placeholder="Year" value="${esc(S.year||'')}" style="width:88px">
      <input id="setQ" placeholder="Release — e.g. Topps Chrome" value="${esc(S.q||'')}" autocomplete="off" style="flex:1">
      <button class="bigim" id="setSearch" style="flex:none">Find</button>
    </div>
    <div id="boothBox" class="boothBox">
      <div class="ct">Booth mode — add by #</div>
      <div class="boothBar">
        <input id="bnYear" placeholder="Year" value="${esc(S.year||'')}" style="width:72px">
        <input id="bnSet" list="dlBoothSet" placeholder="Set / release" style="flex:1.4">
        <input id="bnNum" placeholder="#" style="width:72px">
        <button id="bnGo" class="bigxl" style="flex:none;box-shadow:none">Find #</button>
      </div>
      <datalist id="dlBoothSet"></datalist>
      <div id="bnHint" class="teach-hint" style="color:var(--dim);font-size:12px;margin-top:6px">Enter year + set + card number → pick parallel → Have/Want</div>
    </div>
    <div id="setReleases" class="setList"></div>
    <div id="setSets" class="setList" style="display:none"></div>
    <div id="setCheck" style="display:none"></div>
  </div>`;
  $('setSearch').onclick=()=>setsSearchReleases();
  $('setQ').onkeydown=e=>{if(e.key==='Enter')setsSearchReleases();};
  $('bnGo').onclick=boothFind;
  $('bnNum').onkeydown=e=>{if(e.key==='Enter')boothFind();};
  $('bnSet').oninput=()=>{
    const v=$('bnSet').value.trim();
    if(v.length<2)return;
    csFetchCached('/v1/autocomplete/sets?q='+encodeURIComponent(v),{},{ttlMs:CS_TTL_FREE,free:true})
      .then(j=>{
        const sug=j.suggestions||[];
        $('dlBoothSet').innerHTML=sug.slice(0,12).map(s=>`<option value="${esc(s)}">`).join('');
      }).catch(()=>{});
  };
  if(S.release&&S.set){await setsPaintChecklist();return;}
  if(S.release){setsPaintSets();return;}
  if(S.releases.length)setsPaintReleases();
};

window.setsSearchReleases=async function setsSearchReleases(){
  const year=($('setYear')&&$('setYear').value)||SETS.year||'';
  const q=($('setQ')&&$('setQ').value.trim())||'';
  SETS.year=year;SETS.q=q;SETS.release=null;SETS.set=null;SETS.cards=[];
  if(q.length<2)return alert('Type a release name (e.g. Topps Chrome)');
  $('setReleases').innerHTML='<div class="teach-hint">Searching releases…</div>';
  try{
    const qq=[year,q,'baseball'].filter(Boolean).join(' ');
    const j=await csFetchCached('/v1/catalog/search?type=release&take=24&q='+encodeURIComponent(qq),{},{ttlMs:CS_TTL_CAT});
    SETS.releases=(j.results||[]).filter(r=>r.type==='release'||r.id);
    setsPaintReleases();
  }catch(e){alert('Release search failed: '+e.message);}
};

window.setsPaintReleases=function setsPaintReleases(){
  const el=$('setReleases'); if(!el)return;
  el.style.display='block';
  if($('setSets'))$('setSets').style.display='none';
  if($('setCheck'))$('setCheck').style.display='none';
  if(!SETS.releases.length){el.innerHTML='<div class="empty">No releases found.</div>';return;}
  el.innerHTML=`<div class="ct">${SETS.releases.length} releases</div>`+SETS.releases.map((r,i)=>`
    <div class="setRow" data-ri="${i}">
      <div><b>${esc(r.name)}</b><div class="l2">${esc([r.year,r.manufacturerName].filter(Boolean).join(' · '))}</div></div>
      <span class="count">Open →</span>
    </div>`).join('');
  el.querySelectorAll('[data-ri]').forEach(b=>b.onclick=()=>setsOpenRelease(SETS.releases[+b.dataset.ri]));
};

window.setsOpenRelease=async function setsOpenRelease(r){
  SETS.release=r;SETS.set=null;SETS.cards=[];
  $('setReleases').style.display='none';
  const box=$('setSets'); box.style.display='block'; box.innerHTML='Loading sets…';
  try{
    const d=await csFetchCached('/v1/catalog/releases/'+r.id,{},{ttlMs:CS_TTL_CAT});
    SETS.sets=d.sets||[];
    SETS.release={...r,...d,sets:undefined};
    setsPaintSets();
  }catch(e){box.innerHTML='Failed: '+esc(e.message);}
};

window.setsPaintSets=function setsPaintSets(){
  const box=$('setSets'); if(!box)return;
  box.style.display='block';
  if($('setCheck'))$('setCheck').style.display='none';
  const r=SETS.release;
  const ownedSets=SETS.sets.filter(s=>ownCountInSet(s.id)>0).length;
  box.innerHTML=`
    <div class="toolbar">
      <button type="button" id="setBackRel">← Releases</button>
      <div class="ct" style="margin:0">${esc(r.year||'')} ${esc(r.name||'')} · ${SETS.sets.length} sets · ${ownedSets} started</div>
      <a class="count" href="${tcdbSetUrl(r.year,r.name)}" target="_blank" rel="noopener">TCDB ↗</a>
    </div>
    ${SETS.sets.map((s,i)=>{
      const have=ownCountInSet(s.id);
      const tot=s.cardCount||0;
      const pct=tot?Math.min(100,Math.round(have/tot*100)):0;
      return `<div class="setRow" data-si="${i}">
        <div style="flex:1;min-width:0">
          <b>${esc(s.name)}</b>
          <div class="l2">${tot} cards · ${s.parallelCount||0} parallel types · have ${have}</div>
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
  if(reset)box.innerHTML='Loading checklist…';
  try{
    const take=50;
    const j=await csFetchCached('/v1/catalog/sets/'+s.id+'/cards?take='+take+'&skip='+SETS.skip,{},{ttlMs:CS_TTL_CAT});
    const batch=j.cards||[];
    SETS.total=j.total_count||s.cardCount||batch.length;
    SETS.cards=SETS.cards.concat(batch);
    SETS.skip+=batch.length;
    await setsPaintChecklist();
    csPrefetchImages(batch.map(c=>c.id),{toast:SETS.cards.length<=50});
  }catch(e){box.innerHTML='Checklist failed: '+esc(e.message);}
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
  box.innerHTML=`
    <div class="toolbar">
      <button type="button" id="setBackSets">← Sets</button>
      <div style="flex:1">
        <div class="ct" style="margin:0">${esc(r&&r.year||'')} ${esc(r&&r.name||'')} · ${esc(s.name)}</div>
        <div class="prog" style="margin-top:6px"><i style="width:${pct}%"></i></div>
        <div class="l2" style="font-size:12px;color:var(--dim)">Base ${haveN}/${tot} (${pct}%) · Master-ish ${masterHave}/${masterDenom} (${masterPct}%)</div>
      </div>
    </div>
    <div class="toolbar">
      <button type="button" id="setWantMiss">⭐ Missing → Want</button>
      <button type="button" id="setHaveAll">+ All base → Have</button>
      <a href="${tcdbSetUrl(r&&r.year, (r&&r.name||'')+' '+(s.name||''))}" target="_blank" rel="noopener">TCDB ↗</a>
      <span class="count">${SETS.cards.length} loaded${SETS.cards.length<tot?' of '+tot:''}</span>
    </div>
    <div class="checkList" id="checkBody"></div>
    <div style="text-align:center;margin-top:10px">
      <button id="setMore" style="display:${SETS.cards.length<tot?'inline-block':'none'}">More ↓</button>
    </div>`;
  const body=$('checkBody');
  body.innerHTML=SETS.cards.map((x,i)=>{
    const own=findOwned(x.id,'');
    const rc=(x.attributes||[]).some(a=>/^rc$|rookie/i.test(a));
    const pc=(x.parallels&&x.parallels.length)||0;
    return `<div class="checkRow">
      <div class="thumb" id="ck-${i}">🃏</div>
      <div class="rmain">
        <div class="l1">#${esc(x.number||'?')} ${esc(x.name||'')}${rc?'<span class="badge b-rc">RC</span>':''}${own?'<span class="badge b-own">HAVE</span>':''}</div>
        <div class="l2">${pc?pc+' parallels':''}${(x.attributes||[]).filter(a=>!/^rc$/i.test(a)).slice(0,3).map(a=>' · '+esc(a)).join('')}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">
        <button data-h="${i}" style="padding:4px 8px">+Have</button>
        <button data-w="${i}" style="padding:4px 8px">⭐</button>
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
    if(!miss.length)return showToast('No missing among loaded cards');
    if(!confirm('Add '+miss.length+' missing base cards to Want?'))return;
    for(const x of miss)await addFromCatalogAdvanced(x,'want',{skipPicker:true,parallel:null,skipDup:true});
    showToast('Added '+miss.length+' to Want');
    setsPaintChecklist();
  };
  $('setHaveAll').onclick=async()=>{
    if(!confirm('Add all '+SETS.cards.length+' loaded base cards to Have? (duplicates ask per card)'))return;
    for(const x of SETS.cards)await addFromCatalogAdvanced(x,'have',{skipPicker:true,parallel:null});
    setsPaintChecklist();
  };
};

window.boothFind=async function boothFind(){
  const year=($('bnYear')&&$('bnYear').value.trim())||'';
  const set=($('bnSet')&&$('bnSet').value.trim())||'';
  const num=($('bnNum')&&$('bnNum').value.trim())||'';
  if(!set||!num)return alert('Need set name and card #');
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
    if(!cards.length){if(hint)hint.textContent='No match';return alert('No card found for that #');}
    const x=cards[0];
    if(cards.length>1){
      /* quick pick first exact number match */
      const exact=cards.find(c=>String(c.number||'')===String(num));
      if(exact)Object.assign(x,exact);
    }
    try{
      const d=await csFetchCached('/v1/catalog/cards/'+x.id,{},{ttlMs:CS_TTL_CARD});
      if(d)Object.assign(x,d);
    }catch(e){}
    if(hint)hint.textContent='Found: '+(x.name||'')+' #'+(x.number||num);
    const status=confirm('Add to Have? (Cancel = Want)')?'have':'want';
    await addFromCatalogAdvanced(x,status);
  }catch(e){alert('Booth search failed: '+e.message);}
};
})();
