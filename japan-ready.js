'use strict';
/*
  Japan Ready compatibility/audio patch for Kaishi Quest 11.16.4.
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
    const value=String(text||'').trim();
    if(!value || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance==='undefined') return false;
    try{
      const synth=window.speechSynthesis;
      const speak=()=>{
        try{
          synth.cancel();
          const u=new SpeechSynthesisUtterance(value);
          u.lang='ja-JP';
          u.rate=.84;
          u.pitch=1;
          const voices=synth.getVoices();
          const jp=voices.find(v=>/^ja(-|_|$)/i.test(String(v.lang||'')))||voices.find(v=>/japanese|kyoko|haruka|nanami/i.test(String(v.name||'')));
          if(jp)u.voice=jp;
          synth.resume?.();
          // Chrome on Android can ignore a speech call made immediately after
          // cancel(). A tiny delay keeps the call within the original click flow
          // while avoiding that race.
          setTimeout(()=>{try{synth.resume?.();synth.speak(u)}catch(err){console.warn('Japan Ready speech failed',err)}},40);
        }catch(err){console.warn('Japan Ready speech setup failed',err)}
      };
      const voices=synth.getVoices();
      if(!voices.length){
        const once=()=>{synth.removeEventListener?.('voiceschanged',once);speak()};
        synth.addEventListener?.('voiceschanged',once,{once:true});
        setTimeout(()=>{try{synth.removeEventListener?.('voiceschanged',once)}catch{};speak()},250);
      }else speak();
      return true;
    }catch(err){console.warn('Japan Ready speech unavailable',err);return false}
  }

  function installCheatAudio(){
    if(document.documentElement.dataset.kqCheatAudio==='1')return;
    document.documentElement.dataset.kqCheatAudio='1';
    document.addEventListener('click',event=>{
      const button=event.target.closest?.('.cheat-audio,[data-cheat-audio]');
      if(!button)return;
      const text=button.dataset.cheatAudio||button.getAttribute('data-cheat-audio');
      if(!text)return;
      event.preventDefault();
      event.stopPropagation();
      speakCheatSheet(text);
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
