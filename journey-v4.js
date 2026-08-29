'use strict';
/* Kaishi Quest Journey 11.19.3 — stable interaction layer. */
(() => {
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const wordsFor=c=>{try{return typeof chapterWords==='function'?(chapterWords(c)||[]):[]}catch{return[]}};
  const history=()=>{try{return typeof historyEntries==='function'?historyEntries():[]}catch{return[]}};
  const entryWords=e=>{try{return typeof historyEntryWords==='function'?historyEntryWords(e):[]}catch{return[]}};
  const entryAccuracy=e=>{try{return typeof historyEntryAccuracy==='function'?historyEntryAccuracy(e):null}catch{return null}};
  const chapter=n=>{const m=String(n?.dataset?.kq1710Id||'').match(/^lesson-(\d+)$/);return m?Number(m[1]):null};

  function historyFor(c){
    const ids=new Set(wordsFor(c).map(w=>w?.id).filter(Boolean)); if(!ids.size)return null;
    let best=null,score=0;
    for(const e of history()){
      const s=entryWords(e).reduce((n,w)=>n+(ids.has(w?.id)?1:0),0);
      if(s>score||(s===score&&s&&Number(e.completedAt||0)>Number(best?.completedAt||0))){best=e;score=s;}
    }
    return best;
  }

  function styles(){
    if($('#kqJourneyV4Styles'))return;
    const s=document.createElement('style');s.id='kqJourneyV4Styles';s.textContent=`
      /* v3 renders a legacy CTA. Keep it in the DOM for compatibility but never
         let it appear beside the single v4 CTA. */
      #journeyHistoryTrack [data-kq1710="continue"]{display:none!important}
      .kq1710-v4-controls{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
      .kq1710-panel-backdrop{position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.42);display:flex;align-items:flex-end;justify-content:center;padding:18px}
      .kq1710-panel{width:min(680px,100%);max-height:min(78vh,720px);overflow:auto;background:#fff;border-radius:24px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.25);position:relative}
      .kq1710-panel-close{position:absolute;right:14px;top:12px;border:0;background:transparent;font-size:28px;line-height:1;cursor:pointer}
      .kq1710-panel h3{margin:6px 42px 14px 0}.kq1710-detail-stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.kq1710-detail-stats span{padding:6px 10px;border-radius:999px;background:rgba(37,99,235,.08);font-weight:700;font-size:.85rem}
      .kq1710-word-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.kq1710-word{display:flex;justify-content:space-between;gap:8px;padding:9px 10px;border-radius:10px;background:rgba(0,0,0,.04)}.kq1710-word small{opacity:.7;text-align:right}
      @media(max-width:560px){.kq1710-word-list{grid-template-columns:1fr}.kq1710-panel-backdrop{padding:10px}.kq1710-panel{border-radius:20px}}
    `;document.head.appendChild(s);
  }

  function restorePosition(track,top,pageY){
    if(!track)return;
    requestAnimationFrame(()=>{
      try{track.scrollTop=top}catch{}
      try{window.scrollTo({top:pageY,behavior:'auto'})}catch{}
    });
  }

  function panel(kind,node,c){
    document.querySelectorAll('.kq1710-panel-backdrop').forEach(x=>x.remove());
    const track=$('#journeyHistoryTrack'), top=track?.scrollTop||0, pageY=window.scrollY||0;
    if(track)track.dataset.kq1710UserScrolled='1';
    const p=document.createElement('div');p.className='kq1710-panel-backdrop';
    p.innerHTML='<section class="kq1710-panel" role="dialog" aria-modal="true"><button class="kq1710-panel-close" type="button" aria-label="Close">×</button><span class="eyebrow"></span><h3></h3><div class="kq1710-panel-body"></div></section>';
    document.body.appendChild(p);
    p.querySelector('.eyebrow').textContent=kind==='past'?'Lesson results':'Upcoming lesson';
    p.querySelector('h3').textContent=node?.querySelector('.kq1710-card strong')?.textContent||`Lesson ${c+1}`;
    const body=p.querySelector('.kq1710-panel-body');

    if(kind==='past'){
      const e=historyFor(c), ws=e?entryWords(e):wordsFor(c), acc=e?entryAccuracy(e):null;
      body.innerHTML=`<div class="kq1710-detail-stats"><span>${ws.length} word${ws.length===1?'':'s'}</span>${acc!==null&&acc!==undefined?`<span>${esc(acc)}% accuracy</span>`:''}</div><div class="kq1710-word-list">${ws.map(w=>`<div class="kq1710-word"><b lang="ja">${esc(w.word)}</b><small>${esc(w.meaning)}</small></div>`).join('')||'<p class="muted">No word-level results are available for this lesson.</p>'}</div><div class="kq1710-v4-controls"><button type="button" class="primary" data-panel-action="retry">Retry lesson</button>${e?.id?'<button type="button" data-panel-action="full">Open full results</button>':''}</div>`;
      body.querySelector('[data-panel-action="retry"]')?.addEventListener('click',()=>{
        if(e?.id&&typeof redoHistoryEntry==='function'){redoHistoryEntry(e.id);return;}
        try{const ids=ws.map(w=>w?.id).filter(Boolean);if(ids.length&&typeof makeTargetedMasterySession==='function'){activityReturnScreen='journey';makeTargetedMasterySession(ids,'retain',`Retry · Lesson ${c+1}`)}}catch{}
      });
      body.querySelector('[data-panel-action="full"]')?.addEventListener('click',()=>{if(e?.id&&typeof openHistoryEntryDialog==='function')openHistoryEntryDialog(e.id)});
    }else{
      const ws=wordsFor(c);let topic=null;try{topic=ws[0]&&typeof topicForWord==='function'?topicForWord(ws[0]):null}catch{}
      body.innerHTML=`<p><b>What you’ll learn:</b> ${ws.slice(0,4).map(w=>`<b lang="ja">${esc(w.word)}</b> ${esc(w.meaning)}`).join(' · ')||'The lesson content will be revealed when you reach it.'}</p>${topic?.title?`<p><b>Topic:</b> ${esc(topic.title)}</p>`:''}<p><b>Why it’s next:</b> it builds on what you’ve just learned.</p>`;
    }

    const close=()=>{p.remove();restorePosition(track,top,pageY)};
    p.querySelector('.kq1710-panel-close').addEventListener('click',close);
    p.addEventListener('click',e=>{if(e.target===p)close()});
    restorePosition(track,top,pageY);
  }

  function continueLesson(){
    const node=document.querySelector('.kq1710-node.current');
    let topicId=null;
    try{const c=chapter(node),ws=wordsFor(c);topicId=ws[0]&&typeof topicForWord==='function'?topicForWord(ws[0])?.id:null}catch{}
    try{if(typeof startTopicSession==='function'){startTopicSession(topicId||undefined);return true}}catch(e){console.error('Journey continue failed',e)}
    try{const legacy=$('#continueJourney');if(legacy){legacy.click();return true}}catch{}
    return false;
  }

  function ensureControls(){
    const track=$('#journeyHistoryTrack');if(!track)return;
    track.querySelectorAll('.kq1710-node').forEach(node=>{
      const c=chapter(node);if(c===null)return;
      const card=node.querySelector('.kq1710-card');if(!card)return;

      /* Critical: do not remove/recreate controls. The previous implementation
         caused MutationObserver feedback and forced the Journey to re-render. */
      if(card.querySelector(':scope > .kq1710-v4-controls'))return;

      const current=node.classList.contains('current');
      const past=node.classList.contains('done')&&!current;
      const future=node.classList.contains('future');
      const row=document.createElement('div');row.className='kq1710-v4-controls';

      if(current)row.innerHTML='<button type="button" class="primary" data-kq-v4="continue">Continue lesson</button>';
      else if(past)row.innerHTML='<button type="button" data-kq-v4="results">View lesson results</button><button type="button" class="primary" data-kq-v4="retry">Retry lesson</button>';
      else if(future)row.innerHTML='<button type="button" data-kq-v4="preview">Preview lesson</button>';
      else return;

      card.appendChild(row);
    });
  }

  function handle(button){
    const node=button.closest('.kq1710-node'),c=chapter(node);if(c===null)return;
    const track=$('#journeyHistoryTrack'),top=track?.scrollTop||0,pageY=window.scrollY||0;
    if(button.dataset.kqV4==='continue'){button.disabled=true;continueLesson();setTimeout(()=>{button.disabled=false},500);return}
    if(button.dataset.kqV4==='retry'){
      const e=historyFor(c);
      if(e?.id&&typeof redoHistoryEntry==='function')redoHistoryEntry(e.id);
      else{try{const ids=wordsFor(c).map(w=>w?.id).filter(Boolean);if(ids.length&&typeof makeTargetedMasterySession==='function'){activityReturnScreen='journey';makeTargetedMasterySession(ids,'retain',`Retry · Lesson ${c+1}`)}}catch{}}
      return;
    }
    if(button.dataset.kqV4==='results'){panel('past',node,c);return}
    if(button.dataset.kqV4==='preview'){if(track)track.dataset.kq1710UserScrolled='1';panel('future',node,c);restorePosition(track,top,pageY);return}
  }

  function install(){
    styles();
    if(window.__kqJourneyV4Installed)return;
    window.__kqJourneyV4Installed=true;

    document.addEventListener('click',e=>{
      const b=e.target.closest?.('[data-kq-v4]');if(!b)return;
      e.preventDefault();e.stopImmediatePropagation();handle(b);
    },true);

    const run=()=>{try{ensureControls()}catch(e){console.error('Journey controls failed',e)}};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,0),{once:true});else setTimeout(run,0);

    /* Do not observe #journeyHistoryTrack. v3 renders that subtree and an
       observer which also writes to it creates the exact scroll-jump loop seen
       in the screenshots. Poll only for a newly-rendered Journey. */
    window.__kqJourneyV4Timer=setInterval(run,1000);
    window.addEventListener('pageshow',run);
  }
  install();
})();
