'use strict';

/*
 * Kaishi Quest v11.8.1 — Adaptive Micro-Practice
 *
 * Important: interventions are now overlays. The underlying lesson card is
 * never replaced, so its original event handlers and progression state remain
 * intact while Sensei inserts a short repair question.
 */
(() => {
  const KEY='kq-micro-practice-v1';
  const COOLDOWN=4;
  let st={difficulty:{},last:-99,n:0,active:false};
  try{st={...st,...JSON.parse(localStorage.getItem(KEY)||'{}'),active:false}}catch{}

  const save=()=>{try{
    const copy={...st,active:false};
    localStorage.setItem(KEY,JSON.stringify(copy));
  }catch{}};

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
  const key=(id,skill)=>`${id}:${skill}`;

  function unlocked(name){
    try{
      if(typeof adventureUnlocked==='function') return !!adventureUnlocked(name);
      if(typeof isActivityUnlocked==='function') return !!isActivityUnlocked(name);
    }catch{}
    // These fallbacks use normal lesson mechanics rather than launching a
    // locked activity screen.
    return name==='listening'||name==='meaning';
  }

  function modeFor(skill){
    const s=String(skill||'').toLowerCase();
    if(s.includes('listen')&&unlocked('listening')) return 'listening';
    if((s.includes('production')||s.includes('recall'))&&unlocked('campfire')) return 'recall';
    if((s.includes('sentence')||s.includes('context'))&&unlocked('theatre')) return 'context';
    return unlocked('listening')?'listening':'meaning';
  }

  function distractors(word){
    try{
      return vocab
        .filter(v=>v.id!==word.id && (typeof wordIntroduced!=='function'||wordIntroduced(v)))
        .sort(()=>Math.random()-.5)
        .slice(0,2);
    }catch{return []}
  }

  function speak(text){
    try{
      if(typeof speakJapanese==='function'){
        speakJapanese(text);
        return;
      }
      if(!window.speechSynthesis)return;
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(text);
      u.lang='ja-JP';
      u.rate=.82;
      speechSynthesis.speak(u);
    }catch{}
  }

  function removeOverlay(){
    document.getElementById('microPracticeOverlay')?.remove();
    document.body.classList.remove('micro-practice-open');
    st.active=false;
  }

  function render(word,skill,mode){
    if(st.active || !word?.id)return false;
    removeOverlay();

    const options=[word,...distractors(word)].sort(()=>Math.random()-.5);
    const title={
      listening:'Listening Station',
      recall:'Campfire Recall',
      context:'Theatre Practice',
      meaning:'Quick Repair'
    }[mode];

    const prompt=mode==='recall'
      ? `How do you say “${esc(word.meaning)}”?`
      : mode==='listening'
        ? 'Listen, then choose the meaning.'
        : mode==='context'
          ? `Which meaning fits <b lang="ja">${esc(word.word)}</b>?`
          : `What does <b lang="ja">${esc(word.word)}</b> mean?`;

    const overlay=document.createElement('div');
    overlay.id='microPracticeOverlay';
    overlay.className='micro-practice-overlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label',`${title} micro-practice`);
    overlay.innerHTML=`
      <section class="micro-practice-card">
        <span class="eyebrow">Sensei noticed a tricky word</span>
        <h2>${esc(title)}</h2>
        <p>${prompt}</p>
        ${mode==='listening'
          ? '<button id="microPlay" class="primary" type="button">🔊 Play word</button>'
          : ''}
        <div class="micro-practice-choices">
          ${options.map(v=>`
            <button type="button" data-mid="${esc(v.id)}">
              ${esc(mode==='recall'?(v.word||v.kana):(v.meaning||v.word))}
            </button>`).join('')}
        </div>
        <div id="microResult" hidden></div>
      </section>`;

    document.body.appendChild(overlay);
    document.body.classList.add('micro-practice-open');
    st.active=true;

    if(mode==='listening'){
      document.getElementById('microPlay').onclick=()=>speak(word.word||word.kana);
      setTimeout(()=>{
        if(st.active) speak(word.word||word.kana);
      },150);
    }

    overlay.querySelectorAll('[data-mid]').forEach(button=>{
      button.onclick=()=>{
        const ok=button.dataset.mid===String(word.id);
        overlay.querySelectorAll('[data-mid]').forEach(x=>x.disabled=true);

        const result=overlay.querySelector('#microResult');
        result.hidden=false;
        result.innerHTML=`
          <p class="${ok?'micro-correct':'micro-wrong'}">
            <strong>${ok?'✓ That helped.':'Not quite.'}</strong><br>
            <span lang="ja">${esc(word.word)}</span> = ${esc(word.meaning)}
          </p>
          <button id="microContinue" class="primary" type="button">Continue lesson</button>`;

        if(ok){
          st.difficulty[key(word.id,skill)]=Math.max(
            0,
            (st.difficulty[key(word.id,skill)]||0)-2
          );
        }
        save();

        overlay.querySelector('#microContinue').onclick=()=>{
          removeOverlay();

          // The normal lesson has already progressed/rendered underneath the
          // overlay. Do not reconstruct its HTML. Just return focus to the
          // active card so all native handlers remain alive.
          const card=document.getElementById('card');
          const focusable=card?.querySelector('button:not([disabled]),input:not([disabled])');
          focusable?.focus?.({preventScroll:true});

          document.dispatchEvent(new CustomEvent(
            'kaishi:micro-practice-complete',
            {detail:{wordId:word.id,skill,ok,mode}}
          ));
        };
      };
    });

    return true;
  }

  function maybe(word,skill){
    if(!word?.id || st.active)return;
    const score=st.difficulty[key(word.id,skill)]||0;
    if(score<2 || st.n-st.last<COOLDOWN)return;
    st.last=st.n;
    save();

    // Give the normal grade handler time to progress to/render the next card,
    // then place Sensei's repair over it without modifying that card.
    setTimeout(()=>{
      if(!st.active)render(word,skill,modeFor(skill));
    },180);
  }

  if(typeof grade==='function'){
    const previousGrade=grade;
    grade=function(v,skill,rating,ok,...rest){
      const output=previousGrade(v,skill,rating,ok,...rest);
      st.n++;

      if(v?.id){
        const id=key(v.id,skill);
        const old=st.difficulty[id]||0;
        st.difficulty[id]=ok?Math.max(0,old-1):Math.min(6,old+1);
        save();
        if(!ok)maybe(v,skill);
      }
      return output;
    };
  }

  const style=document.createElement('style');
  style.id='microPracticeStyles';
  style.textContent=`
    body.micro-practice-open{overflow:hidden}
    .micro-practice-overlay{
      position:fixed;inset:0;z-index:12000;
      display:grid;place-items:center;
      padding:max(20px,env(safe-area-inset-top)) 18px max(20px,env(safe-area-inset-bottom));
      background:rgba(15,23,42,.62);
      backdrop-filter:blur(2px)
    }
    .micro-practice-card{
      width:min(92vw,520px);max-height:88vh;overflow:auto;
      padding:20px;border-radius:22px;
      background:linear-gradient(145deg,#fff7ed,#fff);
      border:1px solid #fed7aa;
      box-shadow:0 22px 60px rgba(15,23,42,.35)
    }
    .micro-practice-card h2{margin:.25rem 0}
    .micro-practice-card p{line-height:1.45}
    .micro-practice-choices{display:grid;gap:9px;margin-top:14px}
    .micro-practice-choices button{min-height:54px;font-size:1rem}
    #microResult{
      margin-top:14px;padding:12px;border-radius:14px;background:#f8fafc
    }
    #microResult #microContinue{width:100%;margin-top:10px}
    .micro-correct{color:#166534}.micro-wrong{color:#991b1b}
  `;
  document.head.appendChild(style);

  window.addEventListener('pagehide',removeOverlay);
})();
