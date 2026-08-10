'use strict';

/*
 * Kotoba Colosseum Activity Village integration
 * Kaishi Quest v11.3.1
 *
 * The launcher is deliberately independent of app.js's Activity Village
 * renderer so a re-render cannot permanently remove the new activity.
 */
(() => {
  const RELEASE_VERSION='11.3.1';
  const REQUIRED_WORDS=4;

  function introducedCount(){
    try{
      return Array.isArray(vocab) && typeof wordIntroduced==='function'
        ? vocab.filter(wordIntroduced).length : 0;
    }catch{ return 0; }
  }

  function isReady(){ return introducedCount()>=REQUIRED_WORDS; }

  function readinessText(){
    const count=introducedCount();
    if(count>=REQUIRED_WORDS) return `${count} introduced words · Ready to enter`;
    const remaining=REQUIRED_WORDS-count;
    return `${count} / ${REQUIRED_WORDS} introduced words · Learn ${remaining} more to unlock`;
  }

  function ensureStyles(){
    if(document.getElementById('kotobaActivityStyles')) return;
    const style=document.createElement('style');
    style.id='kotobaActivityStyles';
    style.textContent=`
      #villageCat,.village-cat{display:none!important;visibility:hidden!important;pointer-events:none!important}
      .kotoba-launcher{margin:14px 0!important;border:2px solid rgba(251,191,36,.45)!important}
      .kotoba-launch-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
      .kotoba-launch-icon{font-size:2rem}
      .kotoba-launch-copy{flex:1;min-width:210px}
      .kotoba-launch-copy h3{margin:.15rem 0}
      .kotoba-launch-copy p{margin:.25rem 0}
      #kotobaMapHotspot{
        position:absolute!important;left:50%!important;bottom:4%!important;transform:translateX(-50%)!important;
        z-index:40!important;width:min(86%,360px)!important;padding:10px 14px!important;
        border-radius:14px!important;border:2px solid rgba(251,191,36,.8)!important;
        background:rgba(15,23,42,.94)!important;color:#fff!important;
        box-shadow:0 8px 24px rgba(0,0,0,.35)!important;text-align:left!important
      }
      #kotobaMapHotspot strong,#kotobaMapHotspot small{display:block!important}
      #kotobaMapHotspot small{opacity:.82;margin-top:2px}
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
    // Visible regardless of map/classic mode.
    const toolbar=document.querySelector('.activity-view-toolbar');
    if(toolbar && !document.getElementById('kotobaPrimaryLauncher')){
      toolbar.insertAdjacentElement('afterend',makeLauncher('kotobaPrimaryLauncher'));
    }

    // Also show inside the classic Activity Village list.
    const hub=document.getElementById('practiceHub');
    if(hub && !document.getElementById('kotobaClassicLauncher')){
      hub.appendChild(makeLauncher('kotobaClassicLauncher',true));
    }

    // And add a marker directly on the animated village.
    const stage=document.querySelector('.village-map-stage');
    if(stage && !document.getElementById('kotobaMapHotspot')){
      const button=document.createElement('button');
      button.id='kotobaMapHotspot';
      button.type='button';
      button.innerHTML='<strong>⚔️ Kotoba Colosseum</strong><small>Checking readiness…</small>';
      stage.appendChild(button);
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
    const map=document.getElementById('kotobaMapHotspot');
    if(map){
      map.disabled=!ready;
      map.querySelector('small').textContent=readinessText();
    }
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
      if(event.target.closest('.kotoba-open,#kotobaMapHotspot')){
        event.preventDefault();
        launch();
      }
    });

    // battle-listen's own Back/Done defaults point at the hidden legacy Games
    // page, so keep the main Back button returning to Journey.
    setTimeout(()=>{
      const back=document.getElementById('kbBack');
      if(back) back.onclick=()=>{
        try{ if(typeof show==='function') show('journey'); }catch{}
      };
    },600);
  }

  function install(){
    ensureStyles();
    document.getElementById('villageCat')?.remove();
    ensureScreen();
    ensureWireTarget();
    ensureLaunchers();
    wire();

    // app.js can rebuild Activity Village DOM. Restore our launchers if needed.
    const journey=document.getElementById('journey');
    if(journey){
      new MutationObserver(()=>ensureLaunchers()).observe(journey,{childList:true,subtree:true});
    }

    [250,750,1500,3000,5000].forEach(ms=>setTimeout(ensureLaunchers,ms));
    window.addEventListener('focus',ensureLaunchers);
    window.addEventListener('pageshow',ensureLaunchers);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',install,{once:true});
  }else install();
})();
