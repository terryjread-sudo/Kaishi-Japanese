'use strict';

/*
 * Kaishi Quest v11.3.4 — Kotoba Colosseum UI patch
 *
 * - Keeps a reference to the Colosseum BGM so exiting can always stop it.
 * - Replaces the answer-choice area with feedback/Continue after an answer,
 *   avoiding a downward scroll.
 * - Routes battle exit to Activity Village while preserving battle-listen's
 *   own stopBgm() handler.
 */
(() => {
  const RELEASE='11.3.4';
  const trackedBgm=new Set();
  const BGM_NORMAL_VOLUME=0.12;
  const BGM_DUCK_VOLUME=0.015;
  let duckDepth=0;
  let duckRestoreTimer=null;

  function setTrackedBgmVolume(volume){
    trackedBgm.forEach(audio=>{
      try{
        if(!audio.paused) audio.volume=Math.max(0,Math.min(1,volume));
      }catch{}
    });
  }

  function duckBgm(){
    duckDepth++;
    if(duckRestoreTimer){
      clearTimeout(duckRestoreTimer);
      duckRestoreTimer=null;
    }
    setTrackedBgmVolume(BGM_DUCK_VOLUME);
  }

  function restoreBgm(delay=180){
    duckDepth=Math.max(0,duckDepth-1);
    if(duckDepth>0) return;
    if(duckRestoreTimer) clearTimeout(duckRestoreTimer);
    duckRestoreTimer=setTimeout(()=>{
      duckRestoreTimer=null;
      setTrackedBgmVolume(BGM_NORMAL_VOLUME);
    },delay);
  }

  // Track the non-DOM BGM Audio object and duck it while Japanese word audio plays.
  const originalPlay=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(...args){
    let src='';
    try{ src=String(this.currentSrc || this.src || ''); }catch{}
    const isBgm=src.includes('/battle-listen/bgm.mp3');
    const inBattle=Boolean(document.getElementById('listenBattle')?.classList.contains('active'));

    if(isBgm){
      trackedBgm.add(this);
      try{ this.volume=BGM_NORMAL_VOLUME; }catch{}
    }else if(inBattle && src){
      duckBgm();
      const finish=()=>restoreBgm();
      this.addEventListener('ended',finish,{once:true});
      this.addEventListener('pause',finish,{once:true});
      // Safety restore for audio formats/devices that fail to emit ended.
      setTimeout(()=>restoreBgm(),5000);
    }
    return originalPlay.apply(this,args);
  };

  // Also duck around speechSynthesis fallback used when no word-audio file exists.
  if(window.speechSynthesis && typeof window.speechSynthesis.speak==='function'){
    const originalSpeak=window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak=function(utterance){
      const inBattle=Boolean(document.getElementById('listenBattle')?.classList.contains('active'));
      if(inBattle && utterance){
        duckBgm();
        const originalEnd=utterance.onend;
        const originalError=utterance.onerror;
        utterance.onend=function(event){
          restoreBgm();
          if(typeof originalEnd==='function') originalEnd.call(this,event);
        };
        utterance.onerror=function(event){
          restoreBgm();
          if(typeof originalError==='function') originalError.call(this,event);
        };
        setTimeout(()=>restoreBgm(),5000);
      }
      return originalSpeak(utterance);
    };
  }

  function stopBattleMusic(){
    duckDepth=0;
    if(duckRestoreTimer){ clearTimeout(duckRestoreTimer); duckRestoreTimer=null; }
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
    const doneNow=document.getElementById('kbDone');
    if(doneNow && !doneNow.dataset.dailySummaryLogged){
      doneNow.dataset.dailySummaryLogged='1';
      window.KaishiDailySummary?.recordActivity?.('Kotoba Colosseum', {});
    }

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
