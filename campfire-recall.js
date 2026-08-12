'use strict';

/*
 * Kaishi Quest v11.7.1 — Campfire Recall
 * Short optional, no-choice retrieval practice.
 */
(() => {
  let run=null;

  function ensureScreen(){
    const screen=document.getElementById('campfireRecall');
    const card=document.getElementById('cfCard');
    if(screen && card) return true;
    console.error('[Campfire Recall] Required static screen markup is missing');
    toast('Campfire Recall could not open — please refresh Kaishi Quest');
    return false;
  }

  function ensureStyles(){
    if(document.getElementById('campfireStyles')) return;
    const style=document.createElement('style');
    style.id='campfireStyles';
    style.textContent=`
      .cf-card{max-width:700px;margin-inline:auto;text-align:center}
      .cf-flame{font-size:3.2rem;margin:8px 0}
      .cf-counter{font-size:.8rem;color:#64748b}
      .cf-prompt{font-size:clamp(1.7rem,7vw,3rem);font-weight:900;margin:22px 0 10px}
      .cf-instruction{color:#64748b;margin-bottom:20px}
      .cf-reveal{width:100%;padding:16px}
      .cf-answer{margin:18px 0;padding:18px;border-radius:18px;background:#fff7ed;border:1px solid #fdba74}
      .cf-answer .jp{font-size:2rem;font-weight:900}
      .cf-answer .reading{color:#64748b;margin-top:4px}
      .cf-answer .meaning{font-size:1.05rem;margin-top:8px}
      .cf-grade{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:14px}
      .cf-grade button{padding:13px 8px}
      .cf-summary-grid{display:grid;gap:8px;margin:14px 0}
      .cf-summary-item{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;border-radius:12px;background:#f8fafc;text-align:left}
      @media(max-width:480px){.cf-grade{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function fillWords(ids=[]){
    const seen=vocab.filter(wordIntroduced);
    const selected=[];
    ids.forEach(id=>{
      const word=seen.find(v=>v.id===id);
      if(word&&!selected.includes(word)) selected.push(word);
    });

    const weak=[...seen]
      .filter(word=>!selected.includes(word))
      .sort((a,b)=>{
        const pa=progress[a.id]?.skills||{},pb=progress[b.id]?.skills||{};
        const sa=Math.min(
          Number(pa.meaning?.strength||0),
          Number(pa.listening?.strength||0),
          Number(pa.production?.strength||0)
        );
        const sb=Math.min(
          Number(pb.meaning?.strength||0),
          Number(pb.listening?.strength||0),
          Number(pb.production?.strength||0)
        );
        return sa-sb;
      });

    selected.push(...weak.slice(0,Math.max(0,3-selected.length)));
    return selected.slice(0,4);
  }

  function start(ids=[],options={}){
    if(!ensureScreen()) return;
    ensureStyles();
    const words=fillWords(ids);
    if(!words.length){
      toast('Learn a few words first, then Campfire Recall will be ready');
      return;
    }
    run={
      words,
      index:0,
      results:[],
      source:options.source||'bonus'
    };
    show('campfireRecall');
    renderRound();
  }

  function promptFor(word,index){
    const modes=['production','listening','meaning'];
    const skill=modes[index%modes.length];
    if(skill==='production'){
      return {
        skill,
        prompt:esc(word.meaning),
        instruction:'Think it or say the Japanese aloud. No answer choices.',
        answer:`<div class="jp">${esc(word.word)}</div><div class="reading">${esc(word.reading||'')}</div><div class="meaning">${esc(word.meaning)}</div>`
      };
    }
    if(skill==='listening'){
      return {
        skill,
        prompt:'🔊 Listen',
        instruction:'What does the Japanese word mean?',
        answer:`<div class="jp">${esc(word.word)}</div><div class="reading">${esc(word.reading||'')}</div><div class="meaning">${esc(word.meaning)}</div>`
      };
    }
    return {
      skill,
      prompt:esc(word.word),
      instruction:'What does this word mean?',
      answer:`<div class="jp">${esc(word.word)}</div><div class="reading">${esc(word.reading||'')}</div><div class="meaning">${esc(word.meaning)}</div>`
    };
  }

  function playWord(word){
    if(word.wordAudio) play(word.wordAudio);
    else speakJapanese(word.word);
  }

  function renderRound(){
    const word=run.words[run.index];
    if(!word){
      renderSummary();
      return;
    }
    const item=promptFor(word,run.index);
    run.current={word,...item};

    document.getElementById('cfCard').innerHTML=`
      <div class="cf-counter">${run.index+1} / ${run.words.length}</div>
      <div class="cf-flame">🔥</div>
      <span class="eyebrow">No-choice retrieval</span>
      <div class="cf-prompt">${item.prompt}</div>
      <p class="cf-instruction">${item.instruction}</p>
      ${item.skill==='listening'?'<button id="cfListen" type="button">🔊 Hear it again</button>':''}
      <button id="cfReveal" class="primary cf-reveal" type="button">Reveal answer</button>
      <section id="cfAnswer" class="cf-answer" hidden></section>
    `;

    if(item.skill==='listening'){
      document.getElementById('cfListen').onclick=()=>playWord(word);
      setTimeout(()=>playWord(word),250);
    }

    document.getElementById('cfReveal').onclick=()=>reveal();
  }

  function reveal(){
    const answer=document.getElementById('cfAnswer');
    const revealButton=document.getElementById('cfReveal');
    if(!answer||!run.current) return;
    revealButton.hidden=true;
    answer.hidden=false;
    answer.innerHTML=`
      ${run.current.answer}
      <button id="cfHearAnswer" type="button">🔊 Listen</button>
      <p>How well did you recall it?</p>
      <div class="cf-grade">
        <button data-cf-grade="4" class="primary">✓ I knew it</button>
        <button data-cf-grade="3">≈ Almost</button>
        <button data-cf-grade="1">↻ Didn't know</button>
      </div>
    `;
    document.getElementById('cfHearAnswer').onclick=()=>playWord(run.current.word);
    answer.querySelectorAll('[data-cf-grade]').forEach(button=>{
      button.onclick=()=>score(Number(button.dataset.cfGrade));
    });
  }

  function score(rating){
    const {word,skill}=run.current;
    const ok=rating>1;
    grade(word,skill,rating,ok,false);
    run.results.push({id:word.id,rating,skill});
    run.index++;
    renderRound();
  }

  function renderSummary(){
    const knew=run.results.filter(item=>item.rating===4).length;
    const almost=run.results.filter(item=>item.rating===3).length;
    const missed=run.results.filter(item=>item.rating===1).length;
    const byId=new Map(vocab.map(word=>[word.id,word]));
    window.KaishiDailySummary?.recordActivity?.('Campfire Recall', {
      total: run.results.length,
      confident: knew,
      almost,
      missed,
      accuracy: run.results.length ? Math.round(((knew + almost) / run.results.length) * 100) : 0
    });

    document.getElementById('cfCard').innerHTML=`
      <div class="cf-flame">🔥</div>
      <span class="eyebrow">Campfire complete</span>
      <h2>${knew}/${run.results.length} recalled confidently</h2>
      <p>${missed?`${missed} word${missed===1?'':'s'} will be prioritised for earlier review.`:'Everything survived the memory check.'}</p>
      <div class="cf-summary-grid">
        ${run.results.map(result=>{
          const word=byId.get(result.id);
          const mark=result.rating===4?'✓':result.rating===3?'≈':'↻';
          return `<div class="cf-summary-item"><span>${mark} <b>${esc(word?.word||'')}</b></span><span>${esc(word?.meaning||'')}</span></div>`;
        }).join('')}
      </div>
      <button id="cfDone" class="primary" type="button">Finish</button>
    `;
    document.getElementById('cfDone').onclick=()=>show('journey');
    updateHome();
  }

  function stop(){
    show('journey');
  }

  function install(){
    ensureScreen();
    ensureStyles();
    const back=document.getElementById('cfBack');
    if(back) back.onclick=stop;
  }

  window.KaishiCampfire={start,stop};

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',install,{once:true});
  }else install();
})();
