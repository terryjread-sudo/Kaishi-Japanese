'use strict';

/*
 * Kaishi Quest v11.8.1 — Learning UI & Daily Summary
 *
 * Adds:
 * - persistent Today summary available after activities are closed
 * - "Keep learning" choices after the 3-step daily route
 * - visible touch affordances on touch devices
 * - Japanese script colour cues (Kanji / Hiragana / Katakana)
 * - Kana correct/wrong feedback as a modal overlay, with manual Continue only
 */
(() => {
  const RELEASE='11.8.21';
  const DAY_KEY=()=>`kq-daily-summary-${typeof day==='function'?day():new Date().toISOString().slice(0,10)}`;
  let suppressColorObserver=false;

  const $=(s,r=document)=>r.querySelector(s);

  function loadDaily(){
    try{
      return JSON.parse(localStorage.getItem(DAY_KEY())) || null;
    }catch{return null}
  }
  function saveDaily(value){
    localStorage.setItem(DAY_KEY(),JSON.stringify(value));
  }

  function learningCounts(){
    const api=window.KaishiLearning;
    const counts={recognising:0,recall:0,usable:0};
    try{
      if(api?.wordsAtLeast){
        counts.recognising=api.wordsAtLeast('Recognising').length;
        counts.recall=api.wordsAtLeast('Recall').length;
        counts.usable=api.wordsAtLeast('Usable').length;
      }
    }catch{}
    return counts;
  }

  function introducedIds(){
    try{
      return vocab.filter(wordIntroduced).map(v=>v.id);
    }catch{return []}
  }

  function ensureDaily(){
    let data=loadDaily();
    if(!data){
      data={
        date:typeof day==='function'?day():new Date().toISOString().slice(0,10),
        createdAt:Date.now(),
        baseline:{
          introducedIds:introducedIds(),
          learning:learningCounts(),
          totalAnswers:Number(meta?.totalAnswers||0),
          totalCorrect:Number(meta?.totalCorrect||0),
          kanaAnswers:Number(meta?.kanaAnswers||0),
          kanaCorrect:Number(meta?.kanaCorrect||0)
        },
        answers:{total:0,correct:0,bySkill:{}},
        kana:{total:0,correct:0},
        missions:0,
        activities:[],
        events:[]
      };
      saveDaily(data);
    }
    return data;
  }

  function updateDaily(mutator){
    const data=ensureDaily();
    mutator(data);
    data.updatedAt=Date.now();
    saveDaily(data);
    refreshTodaySummary();
    document.dispatchEvent(new CustomEvent('kaishi:learning-updated'));
  }

  function recordActivity(name,stats={}){
    updateDaily(data=>{
      data.activities.push({name,stats,time:Date.now()});
      data.events.push({type:'activity',name,time:Date.now()});
    });
  }

  window.KaishiDailySummary={
    recordActivity,
    get:()=>ensureDaily(),
    refresh:()=>refreshTodaySummary()
  };

  // Record learning answers while preserving every existing grade wrapper.
  if(typeof grade==='function'){
    const previousGrade=grade;
    grade=function(v,skill,rating,ok,...rest){
      const result=previousGrade(v,skill,rating,ok,...rest);
      updateDaily(data=>{
        data.answers.total++;
        if(ok)data.answers.correct++;
        const row=data.answers.bySkill[skill]||(data.answers.bySkill[skill]={total:0,correct:0});
        row.total++;
        if(ok)row.correct++;
      });
      return result;
    };
  }

  function newWordsToday(data){
    const before=new Set(data.baseline?.introducedIds||[]);
    try{
      return vocab.filter(word=>wordIntroduced(word)&&!before.has(word.id));
    }catch{return []}
  }

  function learningDelta(data){
    const now=learningCounts();
    const before=data.baseline?.learning||{};
    return {
      now,
      recognising:now.recognising-Number(before.recognising||0),
      recall:now.recall-Number(before.recall||0),
      usable:now.usable-Number(before.usable||0)
    };
  }

  function todayAccuracy(data){
    const total=Number(data.answers?.total||0)+Number(data.kana?.total||0);
    const correct=Number(data.answers?.correct||0)+Number(data.kana?.correct||0);
    return total?Math.round(correct/total*100):null;
  }

  function activityNames(data){
    const counts=new Map();
    (data.activities||[]).forEach(item=>counts.set(item.name,(counts.get(item.name)||0)+1));
    return [...counts.entries()].map(([name,count])=>count>1?`${name} ×${count}`:name);
  }

  function ensureStyles(){
    if($('#learningUi117Styles'))return;
    const style=document.createElement('style');
    style.id='learningUi117Styles';
    style.textContent=`
      /* Japanese script colour language. Hiragana intentionally stays neutral. */
      .jp-script-kanji{font-weight:750}
      .jp-script-hira{color:inherit}
      .jp-script-kata{font-weight:700}
      .jp-script-light.jp-script-kanji{color:#efaa91}
      .jp-script-light.jp-script-kata{color:#7fd3c6}
      .jp-script-dark.jp-script-kanji{color:#9b543e}
      .jp-script-dark.jp-script-kata{color:#147a74}

      /* Persistent Today summary. */
      .today-summary-card{
        margin-top:14px;padding:16px;border-radius:20px;background:#fff;
        border:1px solid #e2e8f0;box-shadow:0 7px 22px #1725540d
      }
      .today-summary-head{display:flex;justify-content:space-between;gap:12px;align-items:center}
      .today-summary-head h3{margin:2px 0}
      .today-summary-mini{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
      .today-summary-mini span{padding:5px 9px;border-radius:999px;background:#f1f5f9;font-size:.76rem;font-weight:750}
      #todaySummaryDialog .daily-summary{padding:20px;display:grid;gap:16px}
      #todaySummaryDialog h2,#todaySummaryDialog h3{margin:0}
      .daily-summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
      .daily-summary-grid article{padding:12px;border-radius:14px;background:#f8fafc;text-align:center}
      .daily-summary-grid strong,.daily-summary-grid span{display:block}
      .daily-summary-grid strong{font-size:1.35rem}
      .daily-summary-grid span{font-size:.72rem;color:#64748b;margin-top:3px}
      .daily-summary-section{padding:13px;border-radius:15px;background:#f8fafc}
      .daily-summary-section p{margin:.35rem 0 0}
      .daily-summary-words{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
      .daily-summary-words span{padding:6px 9px;border-radius:10px;background:#fff;border:1px solid #e2e8f0}
      .daily-progress-deltas{display:grid;gap:7px;margin-top:9px}
      .daily-progress-deltas div{display:flex;justify-content:space-between;gap:12px}
      .delta-up{color:#15803d;font-weight:800}
      .daily-summary-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}

      /* Keep learning after the daily route. */
      .keep-learning-panel{
        margin-top:14px;padding:14px;border-radius:20px;
        background:linear-gradient(135deg,#eff6ff,#faf5ff);
        border:1px solid #c7d2fe
      }
      .keep-learning-panel h3{margin:.15rem 0}
      .keep-learning-panel p{margin:.2rem 0 .55rem;color:#64748b;font-size:.82rem}
      .keep-learning-actions{
        display:flex;gap:10px;overflow-x:auto;overflow-y:hidden;
        scroll-snap-type:x mandatory;scroll-padding-inline:10px;
        -webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;
        scrollbar-width:none;padding:2px 10px 4px
      }
      .keep-learning-actions::-webkit-scrollbar{display:none}
      .keep-learning-actions button{
        flex:0 0 calc(100% - 54px);min-width:0;max-width:calc(100% - 54px);
        min-height:94px;text-align:left;box-sizing:border-box;
        scroll-snap-align:center;scroll-snap-stop:always;
        padding:14px;border-radius:16px;overflow:hidden
      }
      .keep-learning-actions button strong,
      .keep-learning-actions button small{
        overflow-wrap:anywhere;word-break:normal
      }
      .keep-learning-actions button strong{display:block;font-size:1rem}
      .keep-learning-actions small{display:block;margin-top:4px;color:#64748b;font-size:.74rem;line-height:1.25}
      .keep-learning-dots{display:flex;justify-content:center;gap:6px;margin-top:8px}
      .keep-learning-dot{width:7px;height:7px;border-radius:50%;background:#cbd5e1;min-height:7px!important;padding:0!important}
      .keep-learning-dot.active{width:18px;border-radius:999px;background:#2563eb}
      @media(min-width:720px){
        .keep-learning-actions{display:grid;grid-template-columns:repeat(3,1fr);overflow:visible;padding-right:0}
        .keep-learning-actions button{min-width:0;max-width:none;min-height:92px;scroll-snap-align:start}
        .keep-learning-dots{display:none}
      }

      /* Visible touch affordances. */
      .touch-visual-hint{
        display:flex;align-items:center;justify-content:center;gap:7px;
        padding:8px 10px;border-radius:12px;background:#eff6ff;color:#1d4ed8;
        font-size:.76rem;font-weight:800;margin-top:8px
      }
      .wr-touch-coach{
        position:absolute;left:50%;top:48%;transform:translate(-50%,-50%);
        z-index:30;pointer-events:none;padding:10px 13px;border-radius:14px;
        background:#ffffffed;color:#1d4ed8;box-shadow:0 7px 20px #17255425;
        font-weight:850;text-align:center;animation:touchCoach 2.7s ease forwards
      }
      .wr-touch-coach span{display:block;font-size:1.7rem}
      @keyframes touchCoach{0%,65%{opacity:1}100%{opacity:0}}
      @media(prefers-reduced-motion:reduce){.wr-touch-coach{animation:none}}

      /* Kana feedback overlay. Manual Continue remains required. */
      #kanaFeedback:not([hidden]){
        position:fixed!important;left:50%!important;top:50%!important;
        transform:translate(-50%,-50%)!important;z-index:10000!important;
        width:min(90vw,430px)!important;margin:0!important;padding:22px!important;
        border-radius:22px!important;background:#fff!important;
        box-shadow:0 0 0 100vmax rgba(15,23,42,.65),0 20px 55px #0f172a55!important;
        text-align:center!important
      }
      #kanaFeedback .kana-answer span{display:block;font-size:3rem;font-weight:900}
      #kanaFeedback .kana-answer strong{display:block;font-size:1.25rem;margin-top:4px}
      #kanaFeedback #kanaNext{width:100%!important;margin-top:12px!important}
      body.kana-feedback-open{overflow:hidden}

      @media(max-width:560px){
        .daily-summary-grid{grid-template-columns:1fr 1fr}
        .keep-learning-actions,.daily-summary-actions{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(style);
  }

  /* ---------- Japanese script colouring ---------- */
  function parseRgb(value){
    const m=String(value||'').match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    return m?[Number(m[1]),Number(m[2]),Number(m[3])]:[23,32,51];
  }
  function textIsLight(parent){
    const [r,g,b]=parseRgb(getComputedStyle(parent).color);
    return (r*299+g*587+b*114)/1000 > 165;
  }
  function classify(ch){
    if(/\p{Script=Han}/u.test(ch))return 'kanji';
    if(/\p{Script=Katakana}/u.test(ch))return 'kata';
    if(/\p{Script=Hiragana}/u.test(ch))return 'hira';
    return '';
  }
  function colourTextNode(node){
    const parent=node.parentElement;
    if(!parent || parent.closest('script,style,textarea,input,option,pre,code,[data-jp-colored]'))return;
    const text=node.nodeValue||'';
    if(!/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text))return;

    const light=textIsLight(parent);
    const frag=document.createDocumentFragment();
    let buffer='',type='';

    const flush=()=>{
      if(!buffer)return;
      if(!type){frag.append(document.createTextNode(buffer))}
      else{
        const span=document.createElement('span');
        span.dataset.jpColored='1';
        span.className=`jp-script-${type} ${light?'jp-script-light':'jp-script-dark'}`;
        span.textContent=buffer;
        frag.append(span);
      }
      buffer='';type='';
    };

    for(const ch of text){
      const next=classify(ch);
      if(next===type){buffer+=ch}
      else{flush();type=next;buffer=ch}
    }
    flush();
    node.replaceWith(frag);
  }

  function colourJapanese(root=document.body){
    if(!root || suppressColorObserver)return;
    const walker=document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {acceptNode:n=>/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(n.nodeValue||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}
    );
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    if(!nodes.length)return;
    suppressColorObserver=true;
    nodes.forEach(colourTextNode);
    suppressColorObserver=false;
  }

  /* ---------- persistent Today summary ---------- */
  function ensureTodaySummaryCard(){
    if($('#todaySummaryCard'))return;
    const anchor=$('#dashboardLearning')||$('#campaignChooser');
    if(!anchor)return;
    const card=document.createElement('section');
    card.id='todaySummaryCard';
    card.className='today-summary-card';
    card.innerHTML=`
      <div class="today-summary-head">
        <div><span class="eyebrow">Today</span><h3>Your learning so far</h3></div>
        <button id="openTodaySummary" type="button">View summary</button>
      </div>
      <div id="todaySummaryMini" class="today-summary-mini"></div>
    `;
    anchor.insertAdjacentElement('afterend',card);
    $('#openTodaySummary').onclick=openTodaySummary;
  }

  function ensureSummaryDialog(){
    if($('#todaySummaryDialog'))return;
    const dialog=document.createElement('dialog');
    dialog.id='todaySummaryDialog';
    dialog.innerHTML='<section id="todaySummaryContent" class="daily-summary"></section>';
    document.body.appendChild(dialog);
  }

  function refreshTodaySummary(){
    ensureTodaySummaryCard();
    const data=ensureDaily();
    const words=newWordsToday(data);
    const accuracy=todayAccuracy(data);
    const activities=activityNames(data);
    const delta=learningDelta(data);

    const mini=$('#todaySummaryMini');
    if(mini){
      mini.innerHTML=`
        <span>📚 ${words.length} new word${words.length===1?'':'s'}</span>
        <span>✓ ${accuracy===null?'—':accuracy+'%'} accuracy</span>
        <span>🎮 ${activities.length} activit${activities.length===1?'y':'ies'}</span>
        <span>🧠 +${Math.max(0,delta.recall)} recall</span>
      `;
    }

    if($('#todaySummaryDialog')?.open)renderSummaryDialog();
  }

  function renderSummaryDialog(){
    ensureSummaryDialog();
    const data=ensureDaily();
    const words=newWordsToday(data);
    const accuracy=todayAccuracy(data);
    const activities=activityNames(data);
    const delta=learningDelta(data);
    const content=$('#todaySummaryContent');

    content.innerHTML=`
      <div>
        <span class="eyebrow">Today's learning summary</span>
        <h2>What you accomplished</h2>
      </div>

      <div class="daily-summary-grid">
        <article><strong>${words.length}</strong><span>New words</span></article>
        <article><strong>${data.answers.total+data.kana.total}</strong><span>Answers</span></article>
        <article><strong>${accuracy===null?'—':accuracy+'%'}</strong><span>Accuracy</span></article>
        <article><strong>${data.missions||0}</strong><span>Missions</span></article>
        <article><strong>${activities.length}</strong><span>Activities</span></article>
        <article><strong>${delta.now.usable}</strong><span>Usable words overall</span></article>
      </div>

      <section class="daily-summary-section">
        <h3>📚 What you learned</h3>
        ${
          words.length
            ? `<div class="daily-summary-words">${words.slice(0,12).map(w=>`<span><b lang="ja">${esc(w.word)}</b> · ${esc(w.meaning)}</span>`).join('')}</div>`
            : '<p>No new words yet today — reviews still strengthen what you already know.</p>'
        }
      </section>

      <section class="daily-summary-section">
        <h3>🎮 Activities completed</h3>
        <p>${activities.length?activities.map(esc).join(' · '):'No bonus activities completed yet today.'}</p>
      </section>

      <section class="daily-summary-section">
        <h3>📈 How your Japanese moved forward</h3>
        <div class="daily-progress-deltas">
          <div><span>Recognising</span><b>${delta.now.recognising} <span class="${delta.recognising>0?'delta-up':''}">${delta.recognising>0?`↑ ${delta.recognising}`:''}</span></b></div>
          <div><span>Recall</span><b>${delta.now.recall} <span class="${delta.recall>0?'delta-up':''}">${delta.recall>0?`↑ ${delta.recall}`:''}</span></b></div>
          <div><span>Usable</span><b>${delta.now.usable} <span class="${delta.usable>0?'delta-up':''}">${delta.usable>0?`↑ ${delta.usable}`:''}</span></b></div>
        </div>
      </section>

      <div class="daily-summary-actions">
        <button id="summaryKeepLearning" class="primary">Continue learning</button>
        <button id="summaryClose">Close</button>
      </div>
    `;
    $('#summaryClose').onclick=()=>$('#todaySummaryDialog').close();
    $('#summaryKeepLearning').onclick=()=>{
      $('#todaySummaryDialog').close();
      try{
        if(typeof openJourney==='function')openJourney('missions');
        else show('journey');
      }catch{show('journey')}
    };
    colourJapanese(content);
  }

  function openTodaySummary(){
    ensureSummaryDialog();
    renderSummaryDialog();
    $('#todaySummaryDialog').showModal();
  }

  /* ---------- after 3-step route ---------- */
  function routeComplete(){
    try{
      if(typeof journeyRouteProgress!=='function')return false;
      return !journeyRouteProgress().next;
    }catch{return false}
  }

  function ensureKeepLearning(){
    const route=$('#dailyRoute');
    if(!route)return;
    let panel=$('#keepLearningPanel');

    if(!routeComplete()){
      panel?.remove();
      return;
    }

    if(panel)return;
    panel=document.createElement('section');
    panel.id='keepLearningPanel';
    panel.className='keep-learning-panel';
    panel.innerHTML=`
      <span class="eyebrow">Today's route complete ✓</span>
      <h3>Keep learning?</h3>
      <p>Optional extras</p>
      <div id="keepLearningActions" class="keep-learning-actions">
        <button id="keepAnotherMission" class="primary">
          <strong>📖 Another Mission</strong>
          <small>Continue your topic</small>
        </button>
        <button id="keepReviews">
          <strong>🧠 Reviews</strong>
          <small>Strengthen due words</small>
        </button>
        <button id="keepPractice">
          <strong>🎯 Practice</strong>
          <small>Play a learning activity</small>
        </button>
      </div>
      <div id="keepLearningDots" class="keep-learning-dots" aria-hidden="true">
        <span class="keep-learning-dot active"></span>
        <span class="keep-learning-dot"></span>
        <span class="keep-learning-dot"></span>
      </div>
    `;
    route.insertAdjacentElement('afterend',panel);

    $('#keepAnotherMission').onclick=()=>{
      try{startTopicSession(currentTopic().id)}catch{el('continueJourney')?.click()}
    };
    $('#keepReviews').onclick=()=>$('#openReviews')?.click();
    $('#keepPractice').onclick=()=>{
      try{openJourney('practice')}catch{$('#openPracticeHub')?.click()}
    };
    wireKeepLearningCarousel();
  }

  /* ---------- touch affordance visuals ---------- */
  function touchCapable(){
    return navigator.maxTouchPoints>0 || window.matchMedia?.('(pointer: coarse)')?.matches || 'ontouchstart' in window;
  }

  function ensureTouchVisuals(){
    if(!touchCapable())return;

    const field=$('#wrPlayfield');
    if(field && !field.dataset.touchCoachShown){
      field.dataset.touchCoachShown='1';
      const coach=document.createElement('div');
      coach.className='wr-touch-coach';
      coach.innerHTML='<span>👆</span>Drag anywhere to move';
      field.appendChild(coach);
      field.addEventListener('pointerdown',()=>coach.remove(),{once:true});
      setTimeout(()=>coach.remove(),3000);
    }

    const kanaChoices=$('.kana-choices');
    if(kanaChoices && !kanaChoices.nextElementSibling?.classList?.contains('kana-touch-help')){
      const hint=document.createElement('div');
      hint.className='touch-visual-hint kana-touch-help';
      hint.textContent='👆 Tap an answer · long-press kana tiles where available to hear them';
      kanaChoices.insertAdjacentElement('afterend',hint);
    }
  }

  /* ---------- Kana overlay, no auto-progress ---------- */
  function patchKanaFeedback(){
    const feedback=$('#kanaFeedback');
    if(!feedback)return;
    const visible=!feedback.hidden;
    document.body.classList.toggle('kana-feedback-open',visible);
    if(!visible)return;

    const next=$('#kanaNext');
    if(next){
      next.textContent=next.textContent.includes('summary')?'View path summary':'Continue';
      // Existing app.js click handler remains untouched. Therefore the learner
      // must explicitly choose Continue; there is no timed auto progression.
    }
    colourJapanese(feedback);
  }

  function recordKanaFeedback(){
    const feedback=$('#kanaFeedback');
    if(!feedback || feedback.hidden || feedback.dataset.dailyLogged==='1')return;
    const ok=Boolean(feedback.querySelector('.game-result-correct'));
    feedback.dataset.dailyLogged='1';
    updateDaily(data=>{
      data.kana.total++;
      if(ok)data.kana.correct++;
    });
  }

  function observeMissionSummary(){
    const dialog=$('#missionSummaryDialog');
    if(!dialog)return;
    let wasOpen=dialog.hasAttribute('open');
    new MutationObserver(()=>{
      const isOpen=dialog.hasAttribute('open');
      if(isOpen&&!wasOpen){
        updateDaily(data=>data.missions++);
      }
      wasOpen=isOpen;
    }).observe(dialog,{attributes:true,attributeFilter:['open']});
  }

  function wireKeepLearningCarousel(){
    const strip=$('#keepLearningActions');
    const dots=[...document.querySelectorAll('#keepLearningDots .keep-learning-dot')];
    if(!strip || strip.dataset.carouselBound==='1')return;
    strip.dataset.carouselBound='1';

    let settle=null;
    strip.addEventListener('scroll',()=>{
      clearTimeout(settle);
      settle=setTimeout(()=>{
        const cards=[...strip.querySelectorAll('button')];
        if(!cards.length)return;
        const center=strip.scrollLeft + strip.clientWidth/2;
        let best=0,bestDist=Infinity;
        cards.forEach((card,i)=>{
          const c=card.offsetLeft + card.offsetWidth/2;
          const d=Math.abs(c-center);
          if(d<bestDist){best=i;bestDist=d}
        });
        dots.forEach((dot,i)=>dot.classList.toggle('active',i===best));
      },80);
    },{passive:true});
  }

  function install(){
    ensureStyles();
    ensureDaily();
    ensureTodaySummaryCard();
    ensureSummaryDialog();
    observeMissionSummary();

    colourJapanese(document.body);
    refreshTodaySummary();
    ensureKeepLearning();
    wireKeepLearningCarousel();
    ensureTouchVisuals();
    patchKanaFeedback();

    // Observe only small learning containers that are intentionally rebuilt.
    // v11.7.0 watched the entire document and rescanned all Japanese text on
    // routine navigation, which made screen changes feel sluggish on phones.
    const targeted=[
      '#card','#kanaCard','#wrCard','#kbCard','#cfCard',
      '#missionSummaryDialog','#dailyRoute','#journeyHome'
    ];
    targeted.forEach(selector=>{
      const root=$(selector);
      if(!root)return;
      new MutationObserver(()=>{
        requestAnimationFrame(()=>{
          colourJapanese(root);
          if(selector==='#kanaCard'){
            patchKanaFeedback();
            recordKanaFeedback();
            ensureTouchVisuals();
          }
          if(selector==='#dailyRoute')ensureKeepLearning();
        });
      }).observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class','open']});
    });

    document.addEventListener('kaishi:learning-updated',()=>{
      refreshTodaySummary();
      ensureKeepLearning();
      document.dispatchEvent(new CustomEvent('kaishi:dashboard-refresh'));
    });
    document.addEventListener('kaishi:activity-complete',()=>{
      refreshTodaySummary();
      document.dispatchEvent(new CustomEvent('kaishi:dashboard-refresh'));
    });

    window.addEventListener('focus',()=>{
      refreshTodaySummary();
      ensureKeepLearning();
    });
    window.addEventListener('pageshow',()=>{
      refreshTodaySummary();
      ensureKeepLearning();
      document.dispatchEvent(new CustomEvent('kaishi:dashboard-refresh'));
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',install,{once:true});
  }else install();
})();
