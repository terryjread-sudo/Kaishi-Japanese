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
      // Do this synchronously from the user's click. Android Chrome can reject
      // speech that is deferred with setTimeout, even when the original click
      // was a valid user gesture.
      synth.cancel();
      const u=new SpeechSynthesisUtterance(value);
      u.lang='ja-JP'; u.rate=.84; u.pitch=1;
      const voices=synth.getVoices();
      const jp=voices.find(v=>/^ja(?:-|_|$)/i.test(String(v.lang||'')))
        || voices.find(v=>/japanese|kyoko|haruka|nanami|ichiro|otoya|takumi/i.test(String(v.name||'')));
      if(jp) u.voice=jp;
      synth.resume?.();
      synth.speak(u);
      // A second resume is useful on Android when the engine has been paused,
      // but it must not delay the initial speak call.
      setTimeout(()=>{try{if(synth.paused)synth.resume()}catch{}},80);
      return true;
    }catch(err){console.warn('Japan Ready speech failed',err);return false}
  }

  function japaneseFromButton(button){
    const direct=button.dataset.cheatAudio||button.getAttribute('data-cheat-audio')||button.dataset.japanese||button.getAttribute('data-japanese');
    if(direct && /[\u3040-\u30ff\u3400-\u9fff]/.test(direct)) return direct;
    const labelled=button.getAttribute('aria-label')||button.getAttribute('title')||'';
    if(/[\u3040-\u30ff\u3400-\u9fff]/.test(labelled)) return labelled.match(/[\u3040-\u30ff\u3400-\u9fffー、。！？「」『』\s]+/g)?.join(' ').trim()||'';
    const host=button.closest('[data-japanese],.cheat-sheet-item,.cheat-sheet-card,.japan-cheat-card,.japan-scenario,.scenario-word-preview,.japan-ready-panel,#japanReady');
    const lang=host?.querySelector('[lang="ja"],[lang="ja-JP"],[data-japanese]');
    if(lang?.textContent && /[\u3040-\u30ff\u3400-\u9fff]/.test(lang.textContent)) return lang.textContent.trim();
    const text=host?.textContent||'';
    const matches=text.match(/[\u3040-\u30ff\u3400-\u9fffー、。！？「」『』]+/g);
    return matches?.join(' ').trim()||'';
  }

  function installCheatAudio(){
    if(document.documentElement.dataset.kqCheatAudio==='2')return;
    document.documentElement.dataset.kqCheatAudio='2';
    document.addEventListener('click',event=>{
      const button=event.target.closest?.('.cheat-audio,[data-cheat-audio],[data-japanese],[aria-label*="audio" i],[aria-label*="hear" i],[aria-label*="listen" i],[title*="audio" i],[title*="hear" i],[title*="listen" i]');
      if(!button)return;
      // Only take over Japan Ready controls. This prevents the compatibility
      // layer from interfering with Journey's other speech controls.
      try{if(window.KaishiJapanReadyBridge?.getMeta?.().activeCampaign!=='japan-ready')return}catch{return}
      const text=japaneseFromButton(button);
      if(!text)return;
      event.preventDefault();
      event.stopImmediatePropagation();
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
