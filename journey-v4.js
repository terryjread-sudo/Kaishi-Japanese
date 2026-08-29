'use strict';
/*
 Kaishi Quest Journey 11.18.1
 Stability patch: the previous interaction layer observed the whole Journey
 subtree, including class/hidden attribute mutations. On mobile this could
 participate in a render/scroll feedback loop. This version performs a single
 enhancement pass and leaves DOM ownership to journey-v3.
*/
(() => {
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const getHistory=()=>{try{return typeof historyEntries==='function'?historyEntries():[]}catch{return []}};
  const getHistoryWords=e=>{try{return typeof historyEntryWords==='function'?historyEntryWords(e):[]}catch{return []}};

  function bestHistoryForChapter(chapter){
    let words=[]; try{words=typeof window.chapterWords==='function'?window.chapterWords(chapter):[]}catch{}
    const ids=new Set(words.map(w=>w?.id).filter(Boolean)); if(!ids.size)return null;
    let best=null,scoreBest=0;
    for(const entry of getHistory()){
      const ew=getHistoryWords(entry), overlap=ew.reduce((n,w)=>n+(ids.has(w.id)?1:0),0);
      if(!overlap)continue;
      const score=overlap/Math.max(1,Math.min(ids.size,ew.length));
      if(score>scoreBest||(score===scoreBest&&Number(entry.completedAt||0)>Number(best?.completedAt||0))){best=entry;scoreBest=score}
    }
    return best;
  }

  function startChapter(chapter){
    try{
      if(typeof startJourneyChapter==='function'){startJourneyChapter(Number(chapter));return true}
    }catch{}
    try{if(typeof toast==='function')toast('That lesson could not be started yet. Please try again.')}catch{}
    return false;
  }

  function showHistoryForChapter(chapter){
    const entry=bestHistoryForChapter(chapter);
    if(entry?.id&&typeof openHistoryEntryDialog==='function'){openHistoryEntryDialog(entry.id);return}
    let words=[];try{words=typeof window.chapterWords==='function'?window.chapterWords(Number(chapter)):[]}catch{}
    const stats=(()=>{try{return typeof chapterStats==='function'?chapterStats(Number(chapter))||{}:{}}catch{return {}}})();
    ensureFallbackLessonDialog();
    const d=$('#kqJourneyLessonDialog');
    $('#kqJourneyLessonDate').textContent='Lesson details';
    $('#kqJourneyLessonTitle').textContent=`Lesson ${Number(chapter)+1}`;
    $('#kqJourneyLessonStats').innerHTML=`<span><b>${words.length}</b> word${words.length===1?'':'s'}</span><span><b>${Math.round(Number(stats.percent)||0)}%</b> current progress</span>`;
    $('#kqJourneyLessonWords').innerHTML=words.length?words.map(w=>`<span lang="ja"><b>${esc(w.word)}</b><small>${esc(w.meaning)}</small></span>`).join(''):'<p class="muted">The lesson words are not available in this offline pack.</p>';
    $('#kqJourneyLessonRetry').onclick=()=>{d.close();startChapter(chapter)};
    if(!d.open)d.showModal();
  }

  function ensureFallbackLessonDialog(){
    if($('#kqJourneyLessonDialog'))return;
    document.body.insertAdjacentHTML('beforeend',`<dialog id="kqJourneyLessonDialog" class="kq-journey-lesson-dialog"><div class="kq-journey-lesson-inner"><button type="button" class="kq-journey-lesson-close" aria-label="Close">×</button><span id="kqJourneyLessonDate" class="eyebrow"></span><h2 id="kqJourneyLessonTitle"></h2><div id="kqJourneyLessonStats" class="history-entry-dialog-stats"></div><div id="kqJourneyLessonWords" class="history-entry-words"></div><div class="history-entry-dialog-actions"><button id="kqJourneyLessonClose" type="button">Close</button><button id="kqJourneyLessonRetry" class="primary" type="button">Retry this lesson</button></div></div></dialog>`);
    const close=()=>$('#kqJourneyLessonDialog')?.close();
    $('#kqJourneyLessonClose').onclick=close;
    $('.kq-journey-lesson-close').onclick=close;
  }

  function addStyles(){
    if($('#kqJourneyV4Styles'))return;
    const s=document.createElement('style');s.id='kqJourneyV4Styles';
    s.textContent=`.kq1710-action-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.kq1710-action-row .kq1710-action{margin-top:0}.kq1710-action.secondary{background:transparent}.kq-journey-lesson-dialog{width:min(92vw,620px);max-height:88vh;border:0;border-radius:24px;padding:0;box-shadow:0 24px 70px rgba(15,23,42,.25)}.kq-journey-lesson-inner{padding:24px;position:relative}.kq-journey-lesson-close{position:absolute;right:14px;top:12px;border:0;background:transparent;font-size:1.6rem;cursor:pointer}@media(max-width:560px){.kq1710-action-row{display:grid}.kq1710-action-row button{width:100%}.kq-journey-lesson-inner{padding:20px 16px}}`;
    document.head.appendChild(s);
  }

  function handle(button){
    const node=button.closest('.kq1710-node'),m=String(node?.dataset.kq1710Id||'').match(/^lesson-(\d+)$/);if(!m)return;
    const chapter=Number(m[1]),action=button.dataset.kqV4;
    if(action==='continue')startChapter(chapter);
    else if(action==='details')showHistoryForChapter(chapter);
    else if(action==='retry'){
      const entry=bestHistoryForChapter(chapter);
      if(entry?.id&&typeof redoHistoryEntry==='function')redoHistoryEntry(entry.id);else startChapter(chapter);
    }
  }

  function enhanceTimeline(){
    const track=$('#journeyHistoryTrack');if(!track)return;
    addStyles();
    track.querySelectorAll('.kq1710-node').forEach(node=>{
      const id=node.dataset.kq1710Id;if(!id||node.querySelector('.kq1710-action-row'))return;
      const m=String(id).match(/^lesson-(\d+)$/);if(!m)return;
      const chapter=Number(m[1]),current=node.classList.contains('current'),past=node.classList.contains('done')&&!current,card=node.querySelector('.kq1710-card');if(!card)return;
      const row=document.createElement('div');row.className='kq1710-action-row';
      if(current)row.innerHTML='<button type="button" class="primary kq1710-action" data-kq-v4="continue">Continue lesson</button>';
      else if(past)row.innerHTML='<button type="button" class="kq1710-action secondary" data-kq-v4="details">View lesson results</button><button type="button" class="primary kq1710-action" data-kq-v4="retry">Retry lesson</button>';
      else return;
      card.appendChild(row);
    });
    track.querySelectorAll('[data-kq-v4]').forEach(button=>{
      if(button.dataset.kqV4Bound)return;
      button.dataset.kqV4Bound='1';
      button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();handle(button)});
    });
  }

  function installActionGuard(){
    if(window.__kqJourneyV4Guard)return;
    window.__kqJourneyV4Guard=true;
    document.addEventListener('click',e=>{
      const button=e.target.closest?.('[data-kq-v4]');if(!button)return;
      e.preventDefault();e.stopImmediatePropagation();handle(button);
    },true);
  }

  function init(){
    addStyles();
    installActionGuard();
    // Do not observe #journey. journey-v3 owns rendering and observation;
    // watching its output here was the source of the mobile jump/feedback loop.
    requestAnimationFrame(()=>setTimeout(enhanceTimeline,0));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
