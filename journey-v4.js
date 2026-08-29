'use strict';
/*
 Kaishi Quest Journey 11.19.1
 Journey interaction layer.

 Important stability rules:
 - journey-v3 owns the base timeline rendering.
 - this file adds interactions only once; it does NOT attach a second click
   listener to the same buttons (that previously caused expand/close in one tap).
 - the old v3 current-lesson button is replaced by one v4 button so there is
   exactly one Continue lesson CTA.
 - previewing a future lesson marks the timeline as user-scrolled, preventing
   v3's automatic current-lesson centering from jumping the viewport.
*/
(() => {
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const getHistory=()=>{try{return typeof historyEntries==='function'?historyEntries():[]}catch{return []}};
  const getHistoryWords=e=>{try{return typeof historyEntryWords==='function'?historyEntryWords(e):[]}catch{return []}};
  const getHistoryAccuracy=e=>{try{return typeof historyEntryAccuracy==='function'?historyEntryAccuracy(e):null}catch{return null}};

  function chapterHistory(chapter){
    let words=[];try{words=typeof chapterWords==='function'?(chapterWords(Number(chapter))||[]):[]}catch{}
    const ids=new Set(words.map(w=>w?.id).filter(Boolean));
    if(!ids.size)return null;
    let best=null,bestOverlap=0;
    for(const entry of getHistory()){
      const ew=getHistoryWords(entry);
      const overlap=ew.reduce((n,w)=>n+(ids.has(w.id)?1:0),0);
      if(overlap>bestOverlap||(overlap===bestOverlap&&overlap&&Number(entry.completedAt||0)>Number(best?.completedAt||0))){
        best=entry;bestOverlap=overlap;
      }
    }
    return best;
  }

  function retryChapter(chapter){
    const entry=chapterHistory(chapter);
    if(entry?.id&&typeof redoHistoryEntry==='function'){
      redoHistoryEntry(entry.id);
      return true;
    }
    try{
      const words=typeof chapterWords==='function'?(chapterWords(Number(chapter))||[]):[];
      const ids=words.map(w=>w?.id).filter(Boolean);
      if(ids.length&&typeof makeTargetedMasterySession==='function'){
        activityReturnScreen='journey';
        makeTargetedMasterySession(ids,'retain',`Retry · Lesson ${Number(chapter)+1}`);
        return true;
      }
    }catch{}
    try{if(typeof toast==='function')toast('This lesson cannot be retried because its words are unavailable.')}catch{}
    return false;
  }

  function historyDetails(chapter){
    const entry=chapterHistory(chapter);
    if(!entry)return null;
    return {entry,words:getHistoryWords(entry),accuracy:getHistoryAccuracy(entry)};
  }

  function addStyles(){
    if($('#kqJourneyV4Styles'))return;
    const s=document.createElement('style');s.id='kqJourneyV4Styles';
    s.textContent=`
      .kq1710-action-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
      .kq1710-action-row .kq1710-action{margin-top:0}
      .kq1710-action.secondary{background:transparent}
      .kq1710-detail{margin-top:12px;padding-top:12px;border-top:1px solid rgba(0,0,0,.1)}
      .kq1710-detail[hidden]{display:none!important}
      .kq1710-detail-stats{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
      .kq1710-detail-stats span{padding:6px 9px;border-radius:999px;background:rgba(37,99,235,.08);font-size:.82rem;font-weight:700}
      .kq1710-word-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:8px}
      .kq1710-word{display:flex;justify-content:space-between;gap:8px;padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.035)}
      .kq1710-word small{opacity:.7;text-align:right}
      .kq1710-preview{font-size:.9rem}
      .kq1710-milestone{display:flex;gap:14px;align-items:center;margin:10px 4px 14px 50px;padding:13px 15px;border:2px solid rgba(234,179,8,.45);border-radius:16px;background:rgba(234,179,8,.07)}
      .kq1710-milestone strong{display:block}.kq1710-milestone p{margin:3px 0 0;opacity:.75}
      .kq1710-milestone .boss-badge{font-size:.72rem;font-weight:800;letter-spacing:.04em}
      @media(max-width:560px){
        .kq1710-action-row{display:grid}.kq1710-action-row button{width:100%}
        .kq1710-word-list{grid-template-columns:1fr}
        .kq1710-milestone{margin-left:48px}
      }
    `;
    document.head.appendChild(s);
  }

  function lessonNumber(node){
    const m=String(node?.dataset.kq1710Id||'').match(/^lesson-(\d+)$/);
    return m?Number(m[1]):null;
  }

  function makeDetails(node,chapter,kind){
    const old=node.querySelector('.kq1710-detail');if(old)return old;
    const detail=document.createElement('div');detail.className='kq1710-detail';detail.hidden=true;
    if(kind==='past'){
      const info=historyDetails(chapter);
      if(info){
        const {words,accuracy}=info;
        detail.innerHTML=`<div class="kq1710-detail-stats"><span>${words.length} word${words.length===1?'':'s'}</span>${accuracy!==null&&accuracy!==undefined?`<span>${esc(accuracy)}% accuracy</span>`:''}</div><div class="kq1710-word-list">${words.length?words.map(w=>`<span class="kq1710-word"><b lang="ja">${esc(w.word)}</b><small>${esc(w.meaning)}</small></span>`).join(''):'<p class="muted">The original words are no longer available.</p>'}</div><div class="kq1710-action-row"><button type="button" class="kq1710-action secondary" data-kq-v4="details-dialog">Open full results</button><button type="button" class="primary kq1710-action" data-kq-v4="retry">Retry lesson</button></div>`;
      }else{
        let words=[];try{words=typeof chapterWords==='function'?(chapterWords(chapter)||[]):[]}catch{}
        detail.innerHTML=`<div class="kq1710-detail-stats"><span>${words.length} word${words.length===1?'':'s'} in this lesson</span></div><div class="kq1710-word-list">${words.map(w=>`<span class="kq1710-word"><b lang="ja">${esc(w.word)}</b><small>${esc(w.meaning)}</small></span>`).join('')}</div><div class="kq1710-action-row"><button type="button" class="primary kq1710-action" data-kq-v4="retry">Retry lesson</button></div>`;
      }
    }else{
      let words=[],topic=null;
      try{
        words=typeof chapterWords==='function'?(chapterWords(chapter)||[]):[];
        topic=words[0]&&typeof topicForWord==='function'?topicForWord(words[0]):null;
      }catch{}
      detail.innerHTML=`<div class="kq1710-preview"><strong>Coming next</strong>${topic?.title?`<p>${esc(topic.title)}</p>`:''}<p>${words.length?`You’ll meet ${words.slice(0,3).map(w=>`<b lang="ja">${esc(w.word)}</b> <span>${esc(w.meaning)}</span>`).join(' · ')}${words.length>3?' · and more':''}`:'The lesson content will be revealed when you reach it.'}</p><p><b>Why it’s next:</b> it builds naturally on the Japanese you’ve just learned.</p></div>`;
    }
    node.querySelector('.kq1710-card')?.appendChild(detail);
    return detail;
  }

  function addLessonControls(node){
    const chapter=lessonNumber(node);if(chapter===null)return;
    const card=node.querySelector('.kq1710-card');if(!card)return;

    // v3 already renders its own current button. Remove it and replace it with
    // one v4-controlled button so there is never a duplicate and v3's legacy
    // click delegate cannot swallow the action.
    node.querySelectorAll('[data-kq1710="continue"]').forEach(b=>b.remove());

    const current=node.classList.contains('current');
    const past=node.classList.contains('done')&&!current;
    const future=node.classList.contains('future');

    const existing=node.querySelector('.kq1710-v4-controls');
    if(existing){
      existing.hidden=false;
      return;
    }

    const controls=document.createElement('div');
    controls.className='kq1710-action-row kq1710-v4-controls';

    if(current)
      controls.innerHTML='<button type="button" class="primary kq1710-action" data-kq-v4="continue">Continue lesson</button>';
    else if(past)
      controls.innerHTML='<button type="button" class="kq1710-action secondary" data-kq-v4="expand">View lesson results</button><button type="button" class="primary kq1710-action" data-kq-v4="retry">Retry lesson</button>';
    else if(future)
      controls.innerHTML='<button type="button" class="kq1710-action secondary" data-kq-v4="preview">Preview lesson</button>';
    else return;

    card.appendChild(controls);
  }

  function insertMilestones(track){
    track.querySelectorAll('.kq1710-milestone').forEach(el=>el.remove());
    const lessons=[...track.querySelectorAll('.kq1710-node')].filter(n=>lessonNumber(n)!==null);
    lessons.forEach((node,i)=>{
      const chapter=lessonNumber(node);if(chapter===null)return;
      let label='',title='',copy='',icon='🏆';
      if((chapter+1)%5===0){
        label='MILESTONE';title=`${chapter+1} lessons on your Journey`;copy='You’ve reached a meaningful checkpoint. Keep the rhythm going.';
      }
      const next=lessons[i+1];const nextChapter=lessonNumber(next);let boundary=false;
      try{
        if(nextChapter!==null){
          const a=chapterWords(chapter)||[],b=chapterWords(nextChapter)||[];
          const ta=a[0]&&topicForWord(a[0])?.id,tb=b[0]&&topicForWord(b[0])?.id;
          boundary=Boolean(ta&&tb&&ta!==tb);
        }
      }catch{}
      if(boundary){
        label='CHAPTER BOSS';title='Boss challenge ahead';copy='Complete the lessons above, then prove what you know with a topic challenge.';icon='⚔️';
      }
      if(!label)return;
      const m=document.createElement('div');m.className='kq1710-milestone';m.dataset.afterChapter=String(chapter);
      m.innerHTML=`<div aria-hidden="true" style="font-size:1.5rem">${icon}</div><div><span class="boss-badge">${label}</span><strong>${esc(title)}</strong><p>${esc(copy)}</p></div>`;
      node.after(m);
    });
  }

  function enhance(){
    const track=$('#journeyHistoryTrack');if(!track)return;
    addStyles();

    track.querySelectorAll('.kq1710-node').forEach(node=>{
      addLessonControls(node);
      const chapter=lessonNumber(node);if(chapter===null)return;
      const current=node.classList.contains('current');
      const past=node.classList.contains('done')&&!current;
      const future=node.classList.contains('future');
      if(past&&!node.querySelector('.kq1710-detail'))makeDetails(node,chapter,'past');
      if(future&&!node.querySelector('.kq1710-detail'))makeDetails(node,chapter,'future');
    });

    insertMilestones(track);
  }

  function continueLesson(){
    try{
      const btn=$('#continueJourney');
      if(btn){btn.click();return true;}
    }catch{}
    try{
      const chapter=Number((document.querySelector('.kq1710-node.current')?.dataset.kq1710Id||'').replace('lesson-',''));
      if(Number.isFinite(chapter)&&typeof startTopicSession==='function'){
        startTopicSession();
        return true;
      }
    }catch{}
    try{if(typeof toast==='function')toast('The next lesson is still loading. Please try again.')}catch{}
    return false;
  }

  function action(button){
    const node=button.closest('.kq1710-node');
    const chapter=lessonNumber(node);if(chapter===null)return;
    const track=$('#journeyHistoryTrack');
    const a=button.dataset.kqV4;

    if(a==='expand'||a==='preview'){
      // Once the learner intentionally opens a timeline card, never let the
      // base renderer auto-center the current lesson over their interaction.
      if(track)track.dataset.kq1710UserScrolled='1';
      const kind=a==='expand'?'past':'future';
      const d=makeDetails(node,chapter,kind);
      const opening=d.hidden;
      d.hidden=!opening;
      button.textContent=opening?(kind==='past'?'Hide lesson results':'Hide preview'):(kind==='past'?'View lesson results':'Preview lesson');
      return;
    }
    if(a==='retry'){retryChapter(chapter);return}
    if(a==='details-dialog'){
      const info=historyDetails(chapter);
      if(info?.entry?.id&&typeof openHistoryEntryDialog==='function')openHistoryEntryDialog(info.entry.id);
      return;
    }
    if(a==='continue'){continueLesson()}
  }

  function installGuard(){
    if(window.__kqJourneyV4Guard)return;
    window.__kqJourneyV4Guard=true;
    document.addEventListener('click',e=>{
      const b=e.target.closest?.('[data-kq-v4]');
      if(!b)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      action(b);
    },true);
  }

  function observeTrack(){
    const track=$('#journeyHistoryTrack');if(!track||track.dataset.kqV4Observed)return;
    track.dataset.kqV4Observed='1';
    let enhancing=false;
    const obs=new MutationObserver(mutations=>{
      if(enhancing)return;
      const relevant=mutations.some(m=>m.type==='childList'&&[...m.addedNodes].some(n=>n.nodeType===1&&!n.classList?.contains('kq1710-detail')&&!n.classList?.contains('kq1710-action-row')&&!n.classList?.contains('kq1710-milestone')));
      if(!relevant)return;
      enhancing=true;
      requestAnimationFrame(()=>{try{enhance()}finally{enhancing=false}});
    });
    obs.observe(track,{childList:true});
  }

  function init(){
    installGuard();
    const run=()=>{enhance();observeTrack()};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(run,0),{once:true});
    else setTimeout(run,0);
  }
  init();
})();
