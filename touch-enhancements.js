'use strict';

/*
 * Kaishi Quest v11.8.1 — Touch Enhancements
 *
 * Progressive enhancement only:
 * - no device sniffing
 * - mouse/keyboard controls remain unchanged
 * - gestures duplicate visible controls rather than hiding functionality
 */
(() => {
  const RELEASE='11.8.10';
  const coarse=window.matchMedia?.('(pointer: coarse)');
  const noHover=window.matchMedia?.('(hover: none)');
  const touchCapable=Boolean(
    navigator.maxTouchPoints>0 ||
    coarse?.matches ||
    'ontouchstart' in window
  );

  if(!touchCapable) return;

  document.documentElement.classList.add('kaishi-touch');
  if(coarse?.matches) document.documentElement.classList.add('kaishi-coarse-pointer');
  if(noHover?.matches) document.documentElement.classList.add('kaishi-no-hover');

  function $(selector,root=document){ return root.querySelector(selector); }
  function vibrate(pattern){
    try{
      if(typeof navigator.vibrate==='function') navigator.vibrate(pattern);
    }catch{}
  }

  function ensureStyles(){
    if($('#touchEnhancementStyles')) return;
    const style=document.createElement('style');
    style.id='touchEnhancementStyles';
    style.textContent=`
      .kaishi-touch button,.kaishi-touch [role="button"]{-webkit-tap-highlight-color:transparent}
      .kaishi-touch .wr-playfield,
      .kaishi-touch .kb-field,
      .kaishi-touch .kb-menu,
      .kaishi-touch .kana-builder-choices{
        -webkit-user-select:none;user-select:none
      }

      /* Larger targets only on coarse pointers. */
      .kaishi-coarse-pointer button{min-height:46px}
      .kaishi-coarse-pointer .dashboard-nav button{min-height:72px}
      .kaishi-coarse-pointer .choice,
      .kaishi-coarse-pointer .kb-choice,
      .kaishi-coarse-pointer .kb-menu button{padding-block:16px}
      .kaishi-coarse-pointer [data-kana]{min-width:54px;min-height:54px}

      /* Dashboard swipe feedback. */
      .campaign-preview{touch-action:pan-y}
      .campaign-preview.touch-swiping{transition:none!important}
      .campaign-preview.touch-snap{transition:transform .16s ease!important}

      /* Campfire swipe grading. */
      #cfCard{touch-action:pan-y;will-change:transform}
      #cfCard.cf-touch-dragging{transition:none!important}
      #cfCard.cf-touch-snap{transition:transform .17s ease!important}
      #cfCard.cf-touch-right{box-shadow:0 10px 32px #16a34a40!important}
      #cfCard.cf-touch-left{box-shadow:0 10px 32px #dc262640!important}
      .cf-touch-hint{
        margin:8px 0 0;text-align:center;color:#64748b;font-size:.72rem
      }

      /* Kana drag interaction. */
      [data-kana].touch-kana-dragging{
        position:relative;z-index:20;transform:scale(1.08);
        box-shadow:0 10px 24px #17255435!important
      }
      #kanaBuilderAnswer.touch-kana-target{
        outline:3px solid #60a5fa;outline-offset:3px;background:#eff6ff!important
      }

      /* Make touch-first game controls less cramped. */
      .kaishi-coarse-pointer .wr-controls{gap:14px}
      .kaishi-coarse-pointer .wr-controls button{min-height:58px}
      .kaishi-coarse-pointer .kb-party-row{gap:18px}
      .kaishi-coarse-pointer .kb-hero{width:84px}
    `;
    document.head.appendChild(style);
  }

  /* ---------------------------------------------------------------
   * 1. Dashboard Journey / Japan Ready navigation is handled by the
   * native scroll-snap carousel in carousel-navigation.js.
   * ------------------------------------------------------------- */
  function installDashboardSwipe(){}

  /* ---------------------------------------------------------------
   * 2. Campfire Recall: swipe right = I knew it, left = Didn't know.
   * "Almost" remains a visible button to avoid stealing vertical scroll.
   * ------------------------------------------------------------- */
  function ensureCampfireHint(){
    const answer=$('#cfAnswer');
    if(!answer || answer.hidden || answer.querySelector('.cf-touch-hint')) return;
    const hint=document.createElement('p');
    hint.className='cf-touch-hint';
    hint.textContent='Touch: swipe right for “I knew it”, left for “Didn’t know”, or use the buttons.';
    answer.appendChild(hint);
  }

  function installCampfireSwipe(){
    const card=$('#cfCard');
    if(!card || card.dataset.touchSwipe==='1') return;
    card.dataset.touchSwipe='1';

    let startX=0,startY=0,dx=0,tracking=false,pointerId=null;

    card.addEventListener('pointerdown',event=>{
      if(event.pointerType==='mouse') return;
      if(event.target.closest('button,a,input')) return;
      const answer=$('#cfAnswer');
      if(!answer || answer.hidden || !answer.querySelector('[data-cf-grade]')) return;
      tracking=true;
      pointerId=event.pointerId;
      startX=event.clientX;
      startY=event.clientY;
      dx=0;
      card.classList.add('cf-touch-dragging');
    });

    card.addEventListener('pointermove',event=>{
      if(!tracking || event.pointerId!==pointerId) return;
      const dy=event.clientY-startY;
      dx=event.clientX-startX;
      if(Math.abs(dy)>Math.abs(dx)*1.35){
        tracking=false;
        card.style.transform='';
        card.classList.remove('cf-touch-dragging','cf-touch-left','cf-touch-right');
        return;
      }
      const limited=Math.max(-90,Math.min(90,dx));
      card.style.transform=`translateX(${limited}px) rotate(${limited/24}deg)`;
      card.classList.toggle('cf-touch-right',limited>35);
      card.classList.toggle('cf-touch-left',limited<-35);
    });

    const finish=event=>{
      if(!tracking || (event && event.pointerId!==pointerId)) return;
      tracking=false;
      const chosen=dx>=75 ? '4' : dx<=-75 ? '1' : null;
      card.classList.remove('cf-touch-dragging','cf-touch-left','cf-touch-right');
      card.classList.add('cf-touch-snap');
      card.style.transform='';
      setTimeout(()=>card.classList.remove('cf-touch-snap'),180);

      if(chosen){
        const button=card.querySelector(`[data-cf-grade="${chosen}"]`);
        if(button){
          vibrate(chosen==='4'?20:[24,35,24]);
          button.click();
        }
      }
    };
    card.addEventListener('pointerup',finish);
    card.addEventListener('pointercancel',()=>finish());
  }

  /* ---------------------------------------------------------------
   * 3. Japan Ready kana builder:
   * - long-press a kana to hear it
   * - drag a tile to the answer area to select it
   * Normal tap-to-select remains unchanged.
   * ------------------------------------------------------------- */
  const kanaLongPressed=new WeakSet();

  function speakKana(text){
    if(!text) return;
    try{
      if(typeof speakJapanese==='function'){
        speakJapanese(text);
        return;
      }
    }catch{}
    try{
      if(!('speechSynthesis' in window)) return;
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(text);
      u.lang='ja-JP';
      u.rate=.84;
      speechSynthesis.speak(u);
    }catch{}
  }

  function installKanaTouch(){
    if(document.documentElement.dataset.kanaTouch==='1') return;
    document.documentElement.dataset.kanaTouch='1';

    let active=null;
    let startX=0,startY=0,moved=false,longTimer=null;

    document.addEventListener('pointerdown',event=>{
      if(event.pointerType==='mouse') return;
      const button=event.target.closest('[data-kana]');
      if(!button) return;

      active=button;
      startX=event.clientX;
      startY=event.clientY;
      moved=false;

      clearTimeout(longTimer);
      longTimer=setTimeout(()=>{
        if(!active || moved) return;
        kanaLongPressed.add(active);
        speakKana(active.dataset.kana);
        vibrate(16);
        active.classList.add('touch-kana-dragging');
      },480);
    },true);

    document.addEventListener('pointermove',event=>{
      if(!active) return;
      const dist=Math.hypot(event.clientX-startX,event.clientY-startY);
      if(dist>9){
        moved=true;
        clearTimeout(longTimer);
        active.classList.add('touch-kana-dragging');
        $('#kanaBuilderAnswer')?.classList.add('touch-kana-target');
      }
    },true);

    document.addEventListener('pointerup',event=>{
      if(!active) return;
      clearTimeout(longTimer);

      const button=active;
      const wasMoved=moved;
      const x=event.clientX,y=event.clientY;
      active=null;
      moved=false;

      button.classList.remove('touch-kana-dragging');
      const target=$('#kanaBuilderAnswer');
      target?.classList.remove('touch-kana-target');

      if(wasMoved && target){
        const rect=target.getBoundingClientRect();
        const dropped=x>=rect.left && x<=rect.right && y>=rect.top && y<=rect.bottom;
        if(dropped){
          vibrate(14);
          button.click();
        }
      }
    },true);

    document.addEventListener('pointercancel',()=>{
      clearTimeout(longTimer);
      active?.classList.remove('touch-kana-dragging');
      active=null;
      $('#kanaBuilderAnswer')?.classList.remove('touch-kana-target');
    },true);

    // A long press is for audio only, not for entering the kana.
    document.addEventListener('click',event=>{
      const button=event.target.closest('[data-kana]');
      if(button && kanaLongPressed.has(button)){
        kanaLongPressed.delete(button);
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },true);
  }

  /* ---------------------------------------------------------------
   * 4. Games: optional haptic feedback where the browser supports it.
   * Rain already tracks the finger directly; this makes catches tactile.
   * Colosseum gets the same feedback without altering battle mechanics.
   * ------------------------------------------------------------- */
  function installGameHaptics(){
    if(document.documentElement.dataset.gameHaptics==='1') return;
    document.documentElement.dataset.gameHaptics='1';

    const seen=new WeakMap();
    const observer=new MutationObserver(mutations=>{
      for(const mutation of mutations){
        const node=mutation.target;
        if(!(node instanceof HTMLElement)) continue;

        if(node.id==='wrPlatform'){
          const now=node.className;
          const before=seen.get(node)||'';
          seen.set(node,now);
          if(now!==before){
            if(node.classList.contains('wr-correct') && !before.includes('wr-correct')) vibrate(18);
            if(node.classList.contains('wr-wrong') && !before.includes('wr-wrong')) vibrate([24,35,24]);
          }
        }

        if(node.classList.contains('kb-choice')){
          const now=node.className;
          const before=seen.get(node)||'';
          seen.set(node,now);
          if(now!==before){
            if(node.classList.contains('correct') && !before.includes('correct')) vibrate(18);
            if(node.classList.contains('wrong') && !before.includes('wrong')) vibrate([25,30,25]);
          }
        }
      }
    });
    observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
  }

  function refreshDynamicEnhancements(){
    installDashboardSwipe();
    installCampfireSwipe();
    ensureCampfireHint();
  }

  function install(){
    ensureStyles();
    installDashboardSwipe();
    installCampfireSwipe();
    installKanaTouch();
    installGameHaptics();

    // Campfire's answer panel is rebuilt each round, so refresh small
    // enhancements when screens change without touching learning state.
    const observer=new MutationObserver(()=>requestAnimationFrame(refreshDynamicEnhancements));
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class']});

    [300,900,1800].forEach(ms=>setTimeout(refreshDynamicEnhancements,ms));
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',install,{once:true});
  }else install();
})();
