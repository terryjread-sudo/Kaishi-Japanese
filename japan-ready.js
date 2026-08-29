'use strict';
/*
  Japan Ready compatibility/audio patch for Kaishi Quest 11.16.6.
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

  function speakCheatSheet(text){
    const value=String(text||'').trim();
    if(!value || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance==='undefined') return false;
    try{
      const synth=window.speechSynthesis;
      // Keep the first speak() call directly inside the user's click handler.
      // This is important on Android Chrome where deferred speech can lose the
      // user-activation token.
      const utterance=new SpeechSynthesisUtterance(value);
      utterance.lang='ja-JP';
      utterance.rate=.88;
      utterance.pitch=1;
      const voices=synth.getVoices();
      const japanese=voices.find(v=>/^ja(?:-|_|$)/i.test(String(v.lang||'')))
        || voices.find(v=>/japanese|kyoko|haruka|nanami|sayaka|ayumi|ichiro|otoya|takumi/i.test(String(v.name||'')));
      if(japanese)utterance.voice=japanese;
      synth.resume?.();
      if(synth.speaking)synth.cancel();
      synth.resume?.();
      synth.speak(utterance);
      return true;
    }catch(error){
      console.warn('Japan Ready cheat-sheet speech failed',error);
      return false;
    }
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
    if(document.documentElement.dataset.kqCheatAudio==='3')return;
    document.documentElement.dataset.kqCheatAudio='3';
    const playButton=button=>{
      if(!button?.classList?.contains('cheat-audio'))return;
      const text=button.getAttribute('data-cheat-audio')||'';
      if(!text)return;
      speakCheatSheet(text);
    };
    // Capture the exact Japan Ready cheat-sheet control. Do not depend on the
    // campaign bridge state: the cheat sheet can be opened before that state
    // has finished initialising.
    let lastPointerButton=null,lastPointerAt=0;
    document.addEventListener('click',event=>{
      const button=event.target.closest?.('.cheat-audio');
      if(!button)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const now=Date.now();
      if(lastPointerButton===button&&now-lastPointerAt<600)return;
      playButton(button);
    },true);
    // Some Android builds dispatch pointerup reliably even when click is delayed.
    // Guard against double-speaking the same gesture.
    document.addEventListener('pointerup',event=>{
      const button=event.target.closest?.('.cheat-audio');
      if(!button)return;
      const now=Date.now();
      if(lastPointerButton===button&&now-lastPointerAt<450)return;
      lastPointerButton=button;lastPointerAt=now;
      playButton(button);
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
