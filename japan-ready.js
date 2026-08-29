'use strict';
/*
  Japan Ready compatibility/audio patch for Kaishi Quest 11.16.3.
  The existing 11.16.2 loader remains responsible for loading the established
  Japan Ready implementation. This version additionally makes its cheat-sheet
  speech reliable when the browser has not populated Japanese voices yet.
*/
(() => {
  const COMMIT='2148988b621f01af1f0f808e2e0b6631bdf6e11f';
  const SOURCE=`https://raw.githubusercontent.com/terryjread-sudo/Kakashi-Web/${COMMIT}/japan-ready.js`;

  function addChooserButtons(){
    const heading=document.querySelector('#campaignChooser .campaign-chooser-heading');
    if(!heading || document.querySelector('#chooseJapanReadyCampaign')) return;
    const actions=document.createElement('div');
    actions.className='campaign-choice-actions';
    actions.innerHTML='<button id="chooseJourneyCampaign" type="button">📖 Journey</button><button id="chooseJapanReadyCampaign" type="button">✈️ Japan Ready</button>';
    heading.appendChild(actions);
  }

  let voicesReady=false;
  const loadVoices=()=>{
    try { speechSynthesis.getVoices(); } catch {}
    voicesReady=true;
  };
  if('speechSynthesis' in window){
    loadVoices();
    speechSynthesis.addEventListener?.('voiceschanged',loadVoices);
  }

  function speakCheatSheet(text){
    if(!text || !('speechSynthesis' in window)) return;
    const speak=()=>{
      try{
        const u=new SpeechSynthesisUtterance(String(text));
        u.lang='ja-JP';
        u.rate=.88;
        const voices=speechSynthesis.getVoices().filter(v=>String(v.lang||'').toLowerCase().startsWith('ja'));
        if(voices[0]) u.voice=voices[0];
        speechSynthesis.cancel();
        speechSynthesis.resume();
        speechSynthesis.speak(u);
      }catch(err){ console.warn('Japan Ready speech failed',err); }
    };
    // Android/Chrome can populate voices asynchronously. Give it one short
    // opportunity to do so, but still speak immediately if none are returned.
    const voices=speechSynthesis.getVoices();
    if(!voices.length && !voicesReady){
      let done=false;
      const once=()=>{if(done)return;done=true;speechSynthesis.removeEventListener?.('voiceschanged',once);speak()};
      speechSynthesis.addEventListener?.('voiceschanged',once);
      setTimeout(once,120);
    } else speak();
  }

  function installCheatAudio(){
    if(document.documentElement.dataset.kqCheatAudio==='1')return;
    document.documentElement.dataset.kqCheatAudio='1';
    document.addEventListener('click',event=>{
      const button=event.target.closest?.('[data-cheat-audio]');
      if(!button)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      speakCheatSheet(button.dataset.cheatAudio||'');
    },true);
  }

  async function run(){
    addChooserButtons();
    installCheatAudio();
    try{
      let response=await fetch(SOURCE,{cache:'no-store'});
      let src=await response.text();
      src=src.replace("$('#chooseJourneyCampaign').onclick=()=>setMode('journey');", "$('#chooseJourneyCampaign')?.addEventListener('click',()=>setMode('journey'));")
             .replace("$('#chooseJapanReadyCampaign').onclick=()=>setMode('japan-ready');", "$('#chooseJapanReadyCampaign')?.addEventListener('click',()=>setMode('japan-ready'));");
      const script=document.createElement('script');
      script.textContent=src;
      document.head.appendChild(script);
      installCheatAudio();
    }catch(error){
      console.error('Japan Ready compatibility loader failed',error);
      const t=document.querySelector('#campaignChooserText');
      if(t)t.textContent='Japan Ready could not be loaded. Please refresh when you are online.';
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
