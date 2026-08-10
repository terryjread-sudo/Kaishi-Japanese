'use strict';

/*
 * Kaishi Quest v11.3.3 — Kotoba Colosseum UI patch
 *
 * - Keeps a reference to the Colosseum BGM so exiting can always stop it.
 * - Replaces the answer-choice area with feedback/Continue after an answer,
 *   avoiding a downward scroll.
 * - Routes battle exit to Activity Village while preserving battle-listen's
 *   own stopBgm() handler.
 */
(() => {
  const RELEASE='11.3.3';
  const trackedBgm=new Set();

  // Track the non-DOM Audio object created by battle-listen.js.
  const originalPlay=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(...args){
    try{
      const src=String(this.currentSrc || this.src || '');
      if(src.includes('/battle-listen/bgm.mp3')) trackedBgm.add(this);
    }catch{}
    return originalPlay.apply(this,args);
  };

  function stopBattleMusic(){
    trackedBgm.forEach(audio=>{
      try{
        audio.pause();
        audio.currentTime=0;
        audio.volume=0;
      }catch{}
    });
  }

  window.addEventListener('pagehide',stopBattleMusic);

  function compactAnsweredRound(){
    const card=document.getElementById('kbCard');
    if(!card) return;

    const feedback=card.querySelector('#kbFeedback');
    if(!feedback || feedback.hidden) return;
    if(feedback.dataset.inPlace==='1') return;
    feedback.dataset.inPlace='1';

    const choices=card.querySelector('.kb-choices');
    const listen=card.querySelector('#kbListen');
    const question=[...card.querySelectorAll('h2')].find(h=>h.textContent.includes('What does it mean'));

    // Put the normal feedback box exactly where the choices were.
    if(choices){
      choices.insertAdjacentElement('beforebegin',feedback);
      choices.remove();
    }
    if(listen) listen.remove();
    if(question) question.remove();

    feedback.hidden=false;
    feedback.style.marginTop='12px';

    const next=feedback.querySelector('#kbNext');
    if(next){
      next.style.width='100%';
      next.style.marginTop='10px';
    }
  }

  function patchExitButtons(){
    const back=document.getElementById('kbBack');
    if(back && !back.dataset.musicStopPatched){
      back.dataset.musicStopPatched='1';
      // capture phase guarantees music is stopped even if another handler changes screens.
      back.addEventListener('click',stopBattleMusic,true);
    }

    const done=document.getElementById('kbDone');
    if(done && !done.dataset.activityVillagePatched){
      done.dataset.activityVillagePatched='1';
      done.textContent='Return to Activity Village';
      done.addEventListener('click',()=>{
        stopBattleMusic();
        setTimeout(()=>{
          try{ if(typeof show==='function') show('journey'); }catch{}
        },0);
      });
    }
  }

  function patchCard(){
    compactAnsweredRound();
    patchExitButtons();
  }

  function install(){
    patchExitButtons();

    const root=document.getElementById('listenBattle') || document.body;
    const observer=new MutationObserver(()=>requestAnimationFrame(patchCard));
    observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});

    document.addEventListener('click',event=>{
      if(event.target.closest('#kbBack,#kbDone')) stopBattleMusic();
      // Run after answer resolution has populated feedback.
      if(event.target.closest('.kb-choice')) setTimeout(compactAnsweredRound,0);
    },true);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',install,{once:true});
  }else install();
})();
