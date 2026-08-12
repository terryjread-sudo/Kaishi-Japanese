'use strict';

/*
 * Kotoba Colosseum Activity Village integration
 * Kaishi Quest v11.5.0
 *
 * The launcher is deliberately independent of app.js's Activity Village
 * renderer so a re-render cannot permanently remove the new activity.
 */
(() => {
  const RELEASE_VERSION='11.5.0';
  const REQUIRED_WORDS=8;

  function introducedCount(){
    try{
      if(!Array.isArray(vocab) || typeof wordIntroduced!=='function') return 0;
      const stateFn=window.KaishiLearning?.wordState;
      return vocab.filter(word=>
        wordIntroduced(word) &&
        (!stateFn || stateFn(word)!=='New')
      ).length;
    }catch{ return 0; }
  }

  function isReady(){ return introducedCount()>=REQUIRED_WORDS; }

  function readinessText(){
    const count=introducedCount();
    if(count>=REQUIRED_WORDS) return `${count} battle-ready words · Ready to enter`;
    const remaining=REQUIRED_WORDS-count;
    return `${count} / ${REQUIRED_WORDS} battle-ready words · Strengthen ${remaining} more`;
  }

  function ensureStyles(){
    if(document.getElementById('kotobaActivityStyles')) return;
    const style=document.createElement('style');
    style.id='kotobaActivityStyles';
    style.textContent=`
      #villageCat,.village-cat{display:none!important;visibility:hidden!important;pointer-events:none!important}
      .kotoba-launcher{margin:0!important;border:1px solid rgba(99,102,241,.25)!important;display:flex}
      .kotoba-classic-landmark{
        width:100%!important;min-height:0!important;padding:18px!important;border-radius:22px!important;
        background:linear-gradient(135deg,#eef2ff,#fff7ed)!important;
        box-shadow:0 10px 28px rgba(30,41,59,.10)!important;
      }
      .kotoba-classic-landmark .kotoba-launch-row{align-items:center!important}
      .kotoba-classic-landmark .kotoba-open{margin-left:auto!important}
      .kotoba-launch-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;width:100%}
      .kotoba-launch-icon{font-size:2rem}
      .kotoba-launch-copy{flex:1;min-width:170px}
      .kotoba-launch-copy h3{margin:.15rem 0}
      .kotoba-launch-copy p{margin:.25rem 0}
    `;
    document.head.appendChild(style);
  }

  function makeLauncher(id, compact=false){
    const card=document.createElement('article');
    card.id=id;
    card.className='kotoba-launcher card';
    card.innerHTML=`
      <div class="kotoba-launch-row">
        <div class="kotoba-launch-icon" aria-hidden="true">⚔️</div>
        <div class="kotoba-launch-copy">
          <span class="eyebrow">New activity · Listening battle</span>
          <h3>Kotoba Colosseum · 言葉コロシアム</h3>
          ${compact?'':'<p>Listen to Japanese and command a three-character party against yōkai. Only words you have already met are used.</p>'}
          <small class="kotoba-status">Checking readiness…</small>
        </div>
        <button class="kotoba-open battle-mode" type="button">Checking…</button>
      </div>`;
    return card;
  }

  function ensureScreen(){
    if(document.getElementById('listenBattle')) return;
    const section=document.createElement('section');
    section.id='listenBattle';
    section.className='screen';
    section.setAttribute('aria-hidden','true');
    section.innerHTML=`
      <div class="study-top">
        <button id="kbBack">← Activity Village</button>
        <h2>Kotoba Colosseum · 言葉コロシアム</h2>
      </div>
      <article class="card kb-wrap" id="kbCard"></article>`;
    const games=document.getElementById('games');
    if(games) games.insertAdjacentElement('afterend',section);
    else document.querySelector('main')?.appendChild(section);
  }

  function ensureWireTarget(){
    // battle-listen.js looks for this exact ID when it initialises.
    if(document.getElementById('kotobaColosseumMode')) return;
    const hidden=document.createElement('button');
    hidden.id='kotobaColosseumMode';
    hidden.type='button';
    hidden.hidden=true;
    document.body.appendChild(hidden);
  }

  function ensureLaunchers(){
    // Show as a proper Classic Activity Landmark, inside the same pathRoad
    // container used by the existing landmark cards.
    const pathRoad=document.getElementById('pathRoad');
    if(pathRoad && !document.getElementById('kotobaClassicLauncher')){
      const card=makeLauncher('kotobaClassicLauncher',true);
      card.classList.add('journey-landmark','kotoba-classic-landmark');
      pathRoad.appendChild(card);
    }
    updateReadiness();
  }

  function updateReadiness(){
    const count=introducedCount();
    const ready=count>=REQUIRED_WORDS;
    document.querySelectorAll('.kotoba-launcher').forEach(card=>{
      const status=card.querySelector('.kotoba-status');
      const button=card.querySelector('.kotoba-open');
      if(status) status.textContent=readinessText();
      if(button){
        button.disabled=!ready;
        button.setAttribute('aria-disabled',String(!ready));
        button.textContent=ready?'⚔️ Enter Colosseum':`🔒 ${Math.max(0,REQUIRED_WORDS-count)} more`;
      }
    });
  }

  function launch(){
    if(!isReady()) return;
    const target=document.getElementById('kotobaColosseumMode');
    if(target && typeof target.onclick==='function'){
      target.onclick();
      return;
    }
    // Give battle-listen.js a moment if it is still parsing/loading.
    setTimeout(()=>{
      const retry=document.getElementById('kotobaColosseumMode');
      if(retry && typeof retry.onclick==='function') retry.onclick();
    },150);
  }

  function wire(){
    document.addEventListener('click',event=>{
      if(event.target.closest('.kotoba-open')){
        event.preventDefault();
        launch();
      }
    });

    // IMPORTANT: do not overwrite battle-listen's kbBack onclick because that
    // handler calls stopBgm(). Let it run first, then route from legacy Games
    // back to Journey / Activity Village.
    setTimeout(()=>{
      const back=document.getElementById('kbBack');
      if(back && !back.dataset.kotobaJourneyReturn){
        back.dataset.kotobaJourneyReturn='1';
        back.addEventListener('click',()=>{
          setTimeout(()=>{
            try{ if(typeof show==='function') show('journey'); }catch{}
          },0);
        });
      }
    },600);
  }

  function install(){
    ensureStyles();
    document.getElementById('villageCat')?.remove();
    ensureScreen();
    ensureWireTarget();
    ensureLaunchers();
    wire();

    // app.js can rebuild Activity Village DOM. Only restore launchers when
    // one has actually been removed. Do NOT call ensureLaunchers() on every
    // subtree mutation: updating launcher text itself creates childList
    // mutations and caused the v11.3.1 infinite MutationObserver loop.
    const journey=document.getElementById('journey');
    if(journey){
      let restoreQueued=false;
      const observer=new MutationObserver(()=>{
        const missing=
          !document.getElementById('kotobaClassicLauncher');
        if(!missing || restoreQueued) return;
        restoreQueued=true;
        requestAnimationFrame(()=>{
          restoreQueued=false;
          ensureLaunchers();
        });
      });
      observer.observe(journey,{childList:true,subtree:true});
    }

    [250,750,1500,3000,5000].forEach(ms=>setTimeout(ensureLaunchers,ms));
    window.addEventListener('focus',ensureLaunchers);
    window.addEventListener('pageshow',ensureLaunchers);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',install,{once:true});
  }else install();
})();
