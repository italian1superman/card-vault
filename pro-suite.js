/* Card Vault — binders, show mode, insights, share */
(function(){
'use strict';
if(typeof window==='undefined')return;

window.BINDER_ID = window.BINDER_ID || 'all';

window.logActivity=function logActivity(type,text,cardId){
  try{
    state.meta=state.meta||{};
    state.meta.activity=state.meta.activity||[];
    state.meta.activity.unshift({t:Date.now(),type,text,cardId:cardId||''});
    state.meta.activity=state.meta.activity.slice(0,50);
    save();
  }catch(e){}
};

window.smartBinders=function smartBinders(){
  return [
    {id:'all',label:'All',fn:()=>true},
    {id:'rc',label:'Rookies',fn:c=>!!c.rookie},
    {id:'graded',label:'Graded',fn:c=>c.grade&&!/^raw$/i.test(String(c.grade))},
    {id:'numbered',label:'Numbered',fn:c=>!!c.serial},
    {id:'auto',label:'Autos',fn:c=>/auto|autograph|\bau\b/i.test([c.variant,c.notes,c.setName].join(' '))},
    {id:'mem',label:'Relics',fn:c=>/mem|relic|patch|jersey/i.test([c.variant,c.notes].join(' '))},
    {id:'high',label:'$100+',fn:c=>valueOf(c)>=100},
    {id:'deals',label:'🔥 Deals',fn:c=>typeof dealHit==='function'&&dealHit(c)},
    {id:'stale',label:'Stale $',fn:c=>c.status==='have'&&c.csId&&typeof priceAgeDays==='function'&&priceAgeDays(c)>=3},
    {id:'noprice',label:'No price',fn:c=>c.status==='have'&&latestPrice(c)==null},
    {id:'want',label:'Wants',fn:c=>c.status==='want'}
  ];
};

window.applyBinder=function applyBinder(cards){
  const b=smartBinders().find(x=>x.id===BINDER_ID)||smartBinders()[0];
  return (cards||[]).filter(b.fn);
};

window.binderCounts=function binderCounts(cards){
  const out={};
  for(const b of smartBinders())out[b.id]=(cards||[]).filter(b.fn).length;
  return out;
};

window.collectionInsights=function collectionInsights(){
  const have=state.cards.filter(c=>c.status==='have');
  const want=state.cards.filter(c=>c.status==='want');
  const val=have.reduce((s,c)=>s+valueOf(c)*(+c.qty||1),0);
  const cost=have.reduce((s,c)=>s+(+c.cost||0)*(+c.qty||1),0);
  const byPlayer={};
  for(const c of have){
    const k=c.player||'—';
    byPlayer[k]=(byPlayer[k]||0)+valueOf(c)*(+c.qty||1);
  }
  const topPlayer=Object.entries(byPlayer).sort((a,b)=>b[1]-a[1])[0];
  const conc=val&&topPlayer?Math.round(topPlayer[1]/val*100):0;
  const graded=have.filter(c=>c.grade&&!/^raw$/i.test(String(c.grade))).length;
  const unpriced=have.filter(c=>latestPrice(c)==null).length;
  const stale=have.filter(c=>c.csId&&priceAgeDays(c)>=3).length;
  const deals=want.filter(dealHit).length;
  const roi=have.filter(c=>+c.cost>0&&latestPrice(c)!=null)
    .map(c=>({c,roi:((latestPrice(c)-c.cost)/c.cost)*100,pl:(latestPrice(c)-c.cost)*(+c.qty||1)}))
    .sort((a,b)=>b.pl-a.pl);
  const week=have.map(c=>{
    const d=typeof deltaDays==='function'?deltaDays(c,7):null;
    return d==null?null:{c,d};
  }).filter(Boolean).sort((a,b)=>Math.abs(b.d)-Math.abs(a.d));
  return {
    have:have.length,want:want.length,val,cost,pl:val-cost,
    topPlayer:topPlayer?topPlayer[0]:'—',conc,graded,gradedPct:have.length?Math.round(graded/have.length*100):0,
    unpriced,stale,deals,
    roiTop:roi.slice(0,5),
    movers7:week.slice(0,5),
    activity:(state.meta&&state.meta.activity)||[]
  };
};

window.cardShareText=function cardShareText(c){
  const v=latestPrice(c);
  const lines=[
    [c.year,c.brand,c.player,c.num?('#'+c.num):'',c.variant].filter(Boolean).join(' '),
    c.setName?('Set: '+c.setName):'',
    c.grade?('Grade: '+c.grade+(c.gradeCert?(' · cert '+c.gradeCert):'')):'',
    c.serial?('Serial: /'+String(c.serial).replace(/^\//,'')):'',
    v!=null?('Market: $'+Number(v).toFixed(2)):'',
    +c.cost?('Cost: $'+Number(c.cost).toFixed(2)):'',
    typeof ebaySoldUrl==='function'?('eBay sold: '+ebaySoldUrl(c)):'',
    typeof tcdbUrl==='function'?('TCDB: '+tcdbUrl(c)):''
  ].filter(Boolean);
  return lines.join('\n');
};

window.shareCard=async function shareCard(c){
  const text=cardShareText(c);
  try{
    if(navigator.share){await navigator.share({title:c.player||'Card',text});showToast('Shared ✔');return;}
  }catch(e){ if(e&&e.name==='AbortError')return; }
  try{
    await navigator.clipboard.writeText(text);
    showToast('Copied card details + links');
  }catch(e){
    prompt('Copy this:',text);
  }
};

window.renderValueHero=function renderValueHero(c){
  const v=latestPrice(c);
  const cost=+c.cost||0;
  const pl=v!=null&&cost?v-cost:null;
  const gp=typeof gainPct==='function'?gainPct(c):null;
  return `<div class="valueHero">
    <div class="vhCell"><div class="k">Market</div><div class="v">${v!=null?money(v):'—'}</div></div>
    <div class="vhCell"><div class="k">Cost</div><div class="v">${cost?money(cost):'—'}</div></div>
    <div class="vhCell"><div class="k">P/L</div><div class="v ${pl==null?'':(pl>=0?'pos':'neg')}">${pl==null?'—':((pl>=0?'+':'')+money(pl))}</div></div>
    <div class="vhCell"><div class="k">ROI</div><div class="v ${gp==null?'':(gp>=0?'pos':'neg')}">${gp==null?'—':((gp>=0?'+':'')+gp.toFixed(0)+'%')}</div></div>
  </div>
  <div class="vhActions">
    <button type="button" id="vhSold" class="bigim">eBay sold</button>
    <button type="button" id="vh130">130 Point</button>
    <button type="button" id="vhPrice" ${csKey()?'':'disabled'}>🤖 Price</button>
    <button type="button" id="vhShare">Share</button>
  </div>`;
};

window.openShowMode=function openShowMode(){
  const bk=document.createElement('div');
  bk.className='showModeBk';
  bk.innerHTML=`<div class="showMode">
    <div class="casHead">
      <div>
        <div class="heroTitle" style="font-size:18px">🃏 Show Mode</div>
        <div class="heroSub" style="margin:0">Type a player (and optional #) to see if it’s already in your vault.</div>
      </div>
      <button type="button" id="smClose">✕</button>
    </div>
    <div class="boothBar">
      <input id="smQ" placeholder="Player — e.g. Elly De La Cruz" style="flex:1.4" autocomplete="off">
      <input id="smNum" placeholder="#" style="width:72px">
      <button type="button" class="bigxl" id="smGo" style="box-shadow:none">Check</button>
    </div>
    <div id="smOut" class="empty soft">Type a player (and optional #) — we'll show catalog matches and whether they're already in your vault.</div>
  </div>`;
  document.body.appendChild(bk);
  const close=()=>bk.remove();
  $('smClose').onclick=close;
  bk.addEventListener('click',e=>{if(e.target===bk)close();});
  const run=async()=>{
    const q=($('smQ').value||'').trim();
    const num=($('smNum').value||'').trim();
    if(q.length<2)return showToast('Type a player name');
    $('smOut').innerHTML='<div class="empty soft">Searching…</div>';
    try{
      let cards=[];
      if(num){
        const j=await csFetchCached('/v1/catalog/search?type=card&take=12&q='+encodeURIComponent([q,('#'+num),'baseball'].join(' ')),{},{ttlMs:CS_TTL_CAT});
        cards=(j.results||[]).map(r=>({id:r.id,name:r.name,releaseYear:r.year,releaseName:r.releaseName,setName:r.setName,number:num,manufacturerName:r.manufacturerName}));
      }
      if(!cards.length){
        const j=await csSearchBaseballCards(q,{take:24});
        cards=j.cards||[];
        if(num)cards=cards.filter(x=>String(x.number||'')===String(num)||!num)||cards;
      }
      if(!cards.length){$('smOut').innerHTML='<div class="empty soft">No catalog hits.</div>';return;}
      $('smOut').innerHTML=`<div class="casGrid">${cards.slice(0,24).map((x,i)=>{
        const own=findOwned(x.id,'');
        const ownedAny=state.cards.filter(c=>c.csId===x.id&&c.status!=='sold');
        return `<div class="casCard smHit ${own||ownedAny.length?'owned':''}">
          <div class="casImg" id="sm-img-${i}">🃏</div>
          <div class="casMeta">
            <b>${own||ownedAny.length?'HAVE':'NEW'} · #${esc(x.number||'?')} ${esc(x.name||'')}</b>
            <span>${esc([x.releaseYear,x.releaseName||x.setName].filter(Boolean).join(' · '))}</span>
            <span>${ownedAny.length?('In vault ×'+ownedAny.reduce((s,c)=>s+(+c.qty||1),0)):'Not in vault'}</span>
            <div class="pa" style="margin-top:6px;display:flex;gap:4px">
              <button type="button" data-h="${i}">+Have</button>
              <button type="button" data-w="${i}">⭐</button>
              <button type="button" data-o="${i}">Open</button>
            </div>
          </div>
        </div>`;
      }).join('')}</div>`;
      const list=cards.slice(0,24);
      $('smOut').querySelectorAll('[data-h]').forEach(b=>b.onclick=async()=>{
        await addFromCatalogAdvanced(list[+b.dataset.h],'have');
        logActivity('add','Show Mode +Have '+(list[+b.dataset.h].name||''), '');
        run();
      });
      $('smOut').querySelectorAll('[data-w]').forEach(b=>b.onclick=async()=>{
        await addFromCatalogAdvanced(list[+b.dataset.w],'want');
        run();
      });
      $('smOut').querySelectorAll('[data-o]').forEach(b=>b.onclick=()=>{
        const x=list[+b.dataset.o];
        const hit=state.cards.find(c=>c.csId===x.id);
        if(hit){sel=hit;close();openSheet();}
        else showToast('Not in vault — tap +Have first');
      });
      list.forEach(async(x,i)=>{
        const url=csImgSrc(await csImageData(x.id));
        if(url&&$('sm-img-'+i))$('sm-img-'+i).innerHTML=`<img src="${esc(url)}" loading="lazy">`;
      });
    }catch(e){$('smOut').innerHTML=`<div class="empty" style="color:var(--amber)">${esc(e.message)}</div>`;}
  };
  $('smGo').onclick=run;
  $('smQ').onkeydown=e=>{if(e.key==='Enter')run();};
  $('smNum').onkeydown=e=>{if(e.key==='Enter')run();};
  setTimeout(()=>$('smQ').focus(),100);
};

window.renderBinderBar=function renderBinderBar(scopeCards){
  const counts=binderCounts(scopeCards);
  return `<div class="pill-row binderRow" id="binderRow">
    ${smartBinders().map(b=>`<button type="button" class="pill ${BINDER_ID===b.id?'on':''}" data-binder="${b.id}">${esc(b.label)} <span class="bc">${counts[b.id]||0}</span></button>`).join('')}
    <button type="button" class="pill showPill" id="btnShowMode">🃏 Show Mode</button>
  </div>`;
};

window.wireBinderBar=function wireBinderBar(after){
  const row=$('binderRow'); if(!row)return;
  row.querySelectorAll('[data-binder]').forEach(b=>b.onclick=()=>{
    window.BINDER_ID=b.dataset.binder; if(after)after(); else render();
  });
  const sm=$('btnShowMode'); if(sm) sm.onclick=()=>openShowMode();
};

window.renderInsightsPanel=function renderInsightsPanel(){
  const i=collectionInsights();
  if(!i.have&&!i.want)return '';
  return `<div class="panel insights">
    <div class="ct">Collection</div>
    <div class="insightGrid">
      <div class="insight"><b>${i.gradedPct}%</b><span>graded</span></div>
      <div class="insight"><b>${i.conc}%</b><span>in ${esc(i.topPlayer)}</span></div>
      <div class="insight"><b>${i.unpriced}</b><span>need price</span></div>
      <div class="insight"><b>${i.stale}</b><span>stale comps</span></div>
      <div class="insight"><b>${i.deals}</b><span>want deals</span></div>
      <div class="insight"><b class="${i.pl>=0?'pos':'neg'}">${i.pl>=0?'+':''}${money0(i.pl)}</b><span>unrealized</span></div>
    </div>
    ${i.roiTop.length?`<div class="ct" style="margin-top:10px">Best P/L</div>
      <div class="insightList">${i.roiTop.map(r=>`<button type="button" class="insightRow" data-id="${r.c.id}">
        <span>${esc(r.c.player||'card')}</span>
        <b class="${r.pl>=0?'pos':'neg'}">${r.pl>=0?'+':''}${money0(r.pl)}</b>
      </button>`).join('')}</div>`:''}
    ${i.activity.length?`<div class="ct" style="margin-top:10px">Recent activity</div>
      <div class="insightList dim">${i.activity.slice(0,6).map(a=>`<div class="insightRow static"><span>${esc(a.text)}</span><span class="m">${new Date(a.t).toLocaleDateString()}</span></div>`).join('')}</div>`:''}
    <div class="home-actions" style="margin-top:10px">
      <button type="button" class="bigim" id="iqShow">🃏 Show Mode</button>
      <button type="button" id="iqPhotos">🖼 Fill photos</button>
      <button type="button" id="iqMlb">⚾ MLB stats</button>
      <button type="button" id="iqGh">⚾ Stats JSON</button>
      <button type="button" id="iqStale">♻ Refresh values</button>
      <button type="button" id="iqUnpriced">Price gaps</button>
    </div>
  </div>`;
};

window.wireInsightsPanel=function wireInsightsPanel(){
  document.querySelectorAll('.insightRow[data-id]').forEach(b=>b.onclick=()=>{
    sel=state.cards.find(c=>c.id===b.dataset.id); if(sel)openSheet();
  });
  const s=$('iqShow'); if(s)s.onclick=()=>openShowMode();
  const ph=$('iqPhotos'); if(ph)ph.onclick=()=>{if(typeof fillMissingPhotos==='function')fillMissingPhotos();};
  const im=$('iqMlb'); if(im)im.onclick=()=>{if(typeof importAllMlbStats==='function')importAllMlbStats().catch(e=>alert(e.message));};
  const ig=$('iqGh'); if(ig)ig.onclick=()=>{if(typeof openGitHubPanel==='function')openGitHubPanel();};
  const r=$('iqStale'); if(r)r.onclick=()=>refreshStalePrices();
  const u=$('iqUnpriced'); if(u)u.onclick=()=>{window.BINDER_ID='noprice';tab='have';render();};
};

})();
