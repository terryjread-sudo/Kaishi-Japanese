'use strict';
(() => {
  const KEY='kq-micro-practice-v1', COOLDOWN=4;
  let st={difficulty:{},last:-99,n:0};
  try{st={...st,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{}
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(st))}catch{}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const k=(id,skill)=>`${id}:${skill}`;

  function unlocked(name){
    try{
      if(typeof adventureUnlocked==='function') return !!adventureUnlocked(name);
      if(typeof isActivityUnlocked==='function') return !!isActivityUnlocked(name);
    }catch{}
    return name==='listening'||name==='meaning';
  }
  function modeFor(skill){
    const s=String(skill||'').toLowerCase();
    if(s.includes('listen')&&unlocked('listening'))return 'listening';
    if((s.includes('production')||s.includes('recall'))&&unlocked('campfire'))return 'recall';
    if((s.includes('sentence')||s.includes('context'))&&unlocked('theatre'))return 'context';
    return unlocked('listening')?'listening':'meaning';
  }
  function distractors(word){
    try{return vocab.filter(v=>v.id!==word.id && (typeof wordIntroduced!=='function'||wordIntroduced(v))).sort(()=>Math.random()-.5).slice(0,2)}
    catch{return []}
  }
  function speak(text){
    try{
      if(typeof speakJapanese==='function'){speakJapanese(text);return}
      if(!window.speechSynthesis)return;
      speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text);u.lang='ja-JP';u.rate=.82;speechSynthesis.speak(u);
    }catch{}
  }
  function render(word,skill,mode){
    const host=document.getElementById('card'); if(!host)return;
    const original=host.innerHTML;
    const options=[word,...distractors(word)].sort(()=>Math.random()-.5);
    const title={listening:'Listening Station',recall:'Campfire Recall',context:'Theatre Practice',meaning:'Quick Repair'}[mode];
    const prompt=mode==='recall'?`How do you say “${esc(word.meaning)}”?`
      :mode==='listening'?'Listen, then choose the meaning.'
      :mode==='context'?`Which meaning fits <b lang="ja">${esc(word.word)}</b>?`
      :`What does <b lang="ja">${esc(word.word)}</b> mean?`;
    host.innerHTML=`<section class="micro-practice-card">
      <span class="eyebrow">Sensei noticed a tricky word</span><h2>${title}</h2><p>${prompt}</p>
      ${mode==='listening'?'<button id="microPlay" class="primary">🔊 Play word</button>':''}
      <div class="micro-practice-choices">${options.map(v=>`<button data-mid="${esc(v.id)}">${esc(mode==='recall'?(v.word||v.kana):(v.meaning||v.word))}</button>`).join('')}</div>
      <div id="microResult" hidden></div></section>`;
    if(mode==='listening'){document.getElementById('microPlay').onclick=()=>speak(word.word||word.kana);setTimeout(()=>speak(word.word||word.kana),150)}
    host.querySelectorAll('[data-mid]').forEach(b=>b.onclick=()=>{
      const ok=b.dataset.mid===String(word.id);
      host.querySelectorAll('[data-mid]').forEach(x=>x.disabled=true);
      const r=document.getElementById('microResult');r.hidden=false;
      r.innerHTML=`<p><strong>${ok?'✓ That helped.':'Not quite.'}</strong><br><span lang="ja">${esc(word.word)}</span> = ${esc(word.meaning)}</p><button id="microContinue" class="primary">Continue lesson</button>`;
      if(ok)st.difficulty[k(word.id,skill)]=Math.max(0,(st.difficulty[k(word.id,skill)]||0)-2);
      save();
      document.getElementById('microContinue').onclick=()=>{host.innerHTML=original;document.dispatchEvent(new CustomEvent('kaishi:micro-practice-complete',{detail:{wordId:word.id,skill,ok,mode}}))};
    });
  }
  function maybe(word,skill){
    if(!word?.id)return;
    const score=st.difficulty[k(word.id,skill)]||0;
    if(score<2||st.n-st.last<COOLDOWN)return;
    st.last=st.n;save();setTimeout(()=>render(word,skill,modeFor(skill)),120);
  }
  if(typeof grade==='function'){
    const prev=grade;
    grade=function(v,skill,rating,ok,...rest){
      const out=prev(v,skill,rating,ok,...rest);st.n++;
      if(v?.id){
        const id=k(v.id,skill),old=st.difficulty[id]||0;
        st.difficulty[id]=ok?Math.max(0,old-1):Math.min(6,old+1);save();
        if(!ok)maybe(v,skill);
      }
      return out;
    };
  }
  const style=document.createElement('style');
  style.textContent=`.micro-practice-card{padding:18px;border-radius:22px;background:linear-gradient(145deg,#fff7ed,#fff);border:1px solid #fed7aa}.micro-practice-card h2{margin:.25rem 0}.micro-practice-choices{display:grid;gap:9px;margin-top:14px}.micro-practice-choices button{min-height:54px}#microResult{margin-top:14px;padding:12px;border-radius:14px;background:#f8fafc}`;
  document.head.appendChild(style);
})();
