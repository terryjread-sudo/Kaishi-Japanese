'use strict';
/* Kaishi Quest Journey 11.19.2 — stable Journey interaction layer. */
(() => {
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const getHistory=()=>{try{return typeof historyEntries==='function'?historyEntries():[]}catch{return[]}};
  const getWords=e=>{try{return typeof historyEntryWords==='function'?historyEntryWords(e):[]}catch{return[]}};
  const getAccuracy=e=>{try{return typeof historyEntryAccuracy==='function'?historyEntryAccuracy(e):null}catch{return null}};
  const lessonNumber=n=>{const m=String(n?.dataset?.kq1710Id||'').match(/^lesson-(\d+)$/);return m?Number(m[1]):null};
  const chapterWordsSafe=c=>{try{return typeof chapterWords==='function'?(chapterWords(c)||[]):[]}catch{return[]}};

  function historyForChapter(chapter){
    const words=chapterWordsSafe(chapter), ids=new Set(words.map(w=>w?.id).filter(Boolean));
    if(!ids.size)return null;
    let best=null,score=0;
    for(const e of getHistory()){
      const overlap=getWords(e).reduce((n,w)=>n+(ids.has(w?.id)?1:0),0);
      if(overlap>score || (overlap===score&&overlap&&Number(e.completedAt||0)>Number(best?.completedAt||0))){best=e;score=overlap}
    }
    return best;
  }

  function restorePosition(track,top,pageY){
    if(!track)return;
    const restore=()=>{
      try{track.scrollTop=top}catch{}
      try{window.scrollTo({top:pageY,behavior:'auto'})}catch{}
    };
    [0,1,2,4,8,16,32,64,120,250,500].forEach(ms=>setTimeout(restore,ms));
  }

  function openPanel(kind,node,chapter){
    document.querySelectorAll('.kq1710-panel-backdrop').forEach(x=>x.remove());
    const track=$('#journeyHistoryTrack'), top=track?.scrollTop||0, pageY=window.scrollY||window.pageYOffset||0;
    if(track)track.dataset.kq1710UserInteracting='1';
    const panel=document.createElement('div');
    panel.className='kq1710-panel-backdrop';
    panel.innerHTML=`<section class="kq1710-panel" role="dialog" aria-modal="true" aria-labelledby="kq1710PanelTitle"><button class="kq1710-panel-close" type="button" aria-label="Close">×</button><span class="eyebrow">${kind==='past'?'Lesson results':'Upcoming lesson'}</span><h3 id="kq1710PanelTitle"></h3><div class="kq1710-panel-body"></div></section>`;
    document.body.appendChild(panel);
    const title=panel.querySelector('#kq1710PanelTitle'), body=panel.querySelector('.kq1710-panel-body');
    title.textContent=node?.querySelector('.kq-timeline-card strong,.kq1710-card strong')?.textContent||`Lesson ${chapter+1}`;
    if(kind==='past'){
      const entry=historyForChapter(chapter), words=entry?getWords(entry):chapterWordsSafe(chapter), acc=entry?getAccuracy(entry):null;
      body.innerHTML=`<div class="kq1710-detail-stats"><span>${words.length} word${words.length===1?'':'s'}</span>${acc!==null&&acc!==undefined?`<span>${esc(acc)}% accuracy</span>`:''}</div><div class="kq1710-word-list">${words.map(w=>`<div class="kq1710-word"><b lang="ja">${esc(w.word)}</b><small>${esc(w.meaning)}</small></div>`).join('')||'<p class="muted">No word-level results are available for this lesson.</p>'}</div><div class="kq1710-action-row"><button type="button" class="primary" data-kq-panel="retry">Retry lesson</button>${entry?.id?'<button type="button" data-kq-panel="full">Open full results</button>':''}</div>`;
      panel.querySelector('[data-kq-panel="retry"]')?.addEventListener('click',()=>{if(entry?.id&&typeof redoHistoryEntry==='function'){redoHistoryEntry(entry.id)}else{try{const ids=words.map(w=>w?.id).filter(Boolean);if(ids.length&&typeof makeTargetedMasterySession==='function'){activityReturnScreen='journey';makeTargetedMasterySession(ids,'retain',`Retry · Lesson ${chapter+1}`)}}catch{}}});
      panel.querySelector('[data-kq-panel="full"]')?.addEventListener('click',()=>{if(entry?.id&&typeof openHistoryEntryDialog==='function')openHistoryEntryDialog(entry.id)});
    }else{
      const words=chapterWordsSafe(chapter); let topic=null;try{topic=words[0]&&typeof topicForWord==='function'?topicForWord(words[0]):null}catch{}
      body.innerHTML=`<p><b>What you’ll learn:</b> ${words.slice(0,4).map(w=>`<b lang="ja">${esc(w.word)}</b> ${esc(w.meaning)}`).join(' · ')||'The lesson content will be revealed when you reach it.'}</p>${topic?.title?`<p><b>Topic:</b> ${esc(topic.title)}</p>`:''}<p><b>Why it’s next:</b> it builds on the Japanese you’ve just learned.</p>`;
    }
    const close=()=>{panel.remove();restorePosition(track,top,pageY)};
    panel.querySelector('.kq1710-panel-close').addEventListener('click',close);
    panel.addEventListener('click',e=>{if(e.target===panel)close()});
    restorePosition(track,top,pageY);
  }

  function addStyles(){
    if($('#kqJourneyV4Styles'))return;
    const s=document.createElement('style');s.id='kqJourneyV4Styles';s.textContent=`
      .kq1710-action-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
      .kq1710-panel-backdrop{position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.42);display:flex;align-items:flex-end;justify-content:center;padding:18px}
      .kq1710-panel{width:min(680px,100%);max-height:min(78vh,720px);overflow:auto;background:#fff;border-radius:24px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.25);position:relative}
      .kq1710-panel-close{position:absolute;right:14px;top:12px;border:0;background:transparent;font-size:28px;line-height:1;cursor:pointer}
      .kq1710-panel h3{margin:6px 42px 14px 0}.kq1710-detail-stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.kq1710-detail-stats span{padding:6px 10px;border-radius:999px;background:rgba(37,99,235,.08);font-weight:700;font-size:.85rem}
      .kq1710-word-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.kq1710-word{display:flex;justify-content:space-between;gap:8px;padding:9px 10px;border-radius:10px;background:rgba(0,0,0,.04)}.kq1710-word small{opacity:.7;text-align:right}
      @media(max-width:560px){.kq1710-word-list{grid-template-columns:1fr}.kq1710-panel-backdrop{padding:10px}.kq1710-panel{border-radius:20px}}
    `;document.head.appendChild(s);
  }

  function currentLesson(){return document.querySelector('.kq1710-node.current')}

  function continueLesson(){
    const node=currentLesson();
    let topicId=null;try{const c=lessonNumber(node),w=chapterWordsSafe(c);topicId=w[0]&&typeof topicForWord==='function'?topicForWord(w[0])?.id:null}catch{}
    try{
      if(typeof startTopicSession==='function'){
        startTopicSession(topicId||undefined);
        return true;
      }
    }catch(e){console.error('Journey continue failed',e)}
    try{
      const legacy=$('#continueJourney');
      if(legacy){legacy.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));return true}
    }catch{}
    try{if(typeof toast==='function')toast('The lesson is still loading. Please try again.')}catch{}
    return false;
  }

  function ensureControls(){
    const track=$('#journeyHistoryTrack');if(!track)return;
    // Do not append expansion content into the track: the legacy renderer watches
    // that subtree and will immediately rebuild it. Controls are lightweight and
    // are safe to add once; delegated handling below owns their clicks.
    track.querySelectorAll('.kq1710-v4-controls').forEach(x=>x.remove());
    track.querySelectorAll('.kq1710-node').forEach(node=>{
      const chapter=lessonNumber(node);if(chapter===null)return;
      const card=node.querySelector('.kq1710-card,.kq-timeline-card');if(!card)return;
      const current=node.classList.contains('current'), past=node.classList.contains('done')&&!current, future=node.classList.contains('future');
      const row=document.createElement('div');row.className='kq1710-action-row kq1710-v4-controls';
      if(current)row.innerHTML='<button type="button" class="primary" data-kq-v4="continue">Continue lesson</button>';
      else if(past)row.innerHTML='<button type="button" data-kq-v4="results">View lesson results</button><button type="button" class="primary" data-kq-v4="retry">Retry lesson</button>';
      else if(future)row.innerHTML='<button type="button" data-kq-v4="preview">Preview lesson</button>';
      else return;
      card.appendChild(row);
    });
  }

  function handle(button){
    const node=button.closest('.kq1710-node'), chapter=lessonNumber(node);if(chapter===null)return;
    const track=$('#journeyHistoryTrack'), top=track?.scrollTop||0, pageY=window.scrollY||window.pageYOffset||0;
    if(track){track.dataset.kqAutoCenter='1';track.dataset.kq1710UserInteracting='1'}
    if(button.dataset.kqV4==='continue'){continueLesson();restorePosition(track,top,pageY);return}
    if(button.dataset.kqV4==='retry'){
      const entry=historyForChapter(chapter);if(entry?.id&&typeof redoHistoryEntry==='function')redoHistoryEntry(entry.id);else{try{const ids=chapterWordsSafe(chapter).map(w=>w?.id).filter(Boolean);if(ids.length&&typeof makeTargetedMasterySession==='function'){activityReturnScreen='journey';makeTargetedMasterySession(ids,'retain',`Retry · Lesson ${chapter+1}`)}}catch{}}
      return;
    }
    if(button.dataset.kqV4==='results'){openPanel('past',node,chapter);return}
    if(button.dataset.kqV4==='preview'){openPanel('future',node,chapter);return}
  }

  function install(){
    addStyles();
    if(window.__kqJourneyV4Installed)return;window.__kqJourneyV4Installed=true;
    document.addEventListener('click',e=>{
      const b=e.target.closest?.('[data-kq-v4]');if(!b)return;
      e.preventDefault();e.stopImmediatePropagation();handle(b);
    },true);
    const run=()=>{try{ensureControls()}catch(e){console.error('Journey controls failed',e)}};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,0),{once:true});else setTimeout(run,0);
    const target=$('#journeyHistoryTrack');
    if(target){
      const obs=new MutationObserver(()=>{setTimeout(run,0)});
      obs.observe(target,{childList:true,subtree:false});
    }
  }
  install();
})();
