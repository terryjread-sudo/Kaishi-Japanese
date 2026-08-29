'use strict';
/*
  Japan Ready compatibility loader for Kaishi Quest 11.16.2.
  11.16.1 removed the two campaign chooser buttons from index.html while
  japan-ready.js still binds them directly. That null dereference stops its
  init() before the Japan Ready data is rendered.

  This loader restores those controls, then evaluates the exact 11.16.1
  Japan Ready implementation from the live commit after making its bindings
  null-safe. This keeps Japan Ready's existing behaviour intact while allowing
  the main Journey to remain a single path.
*/
(() => {
  const COMMIT='2148988b621f01af1f0f808e2e0b6631bdf6e11f';
  const SOURCE=`https://raw.githubusercontent.com/terryjread-sudo/Kakashi-Web/${COMMIT}/japan-ready.js`;
  const addChooserButtons=()=>{
    const heading=document.querySelector('#campaignChooser .campaign-chooser-heading');
    if(!heading || document.querySelector('#chooseJapanReadyCampaign')) return;
    const actions=document.createElement('div');
    actions.className='campaign-choice-actions';
    actions.innerHTML='<button id="chooseJourneyCampaign" type="button">📖 Journey</button><button id="chooseJapanReadyCampaign" type="button">✈️ Japan Ready</button>';
    heading.appendChild(actions);
  };
  const run=async()=>{
    addChooserButtons();
    try{
      let src=await (await fetch(SOURCE,{cache:'no-store'})).text();
      src=src.replace("$('#chooseJourneyCampaign').onclick=()=>setMode('journey');", "$('#chooseJourneyCampaign')?.addEventListener('click',()=>setMode('journey'));")
             .replace("$('#chooseJapanReadyCampaign').onclick=()=>setMode('japan-ready');", "$('#chooseJapanReadyCampaign')?.addEventListener('click',()=>setMode('japan-ready'));");
      const script=document.createElement('script');
      script.textContent=src;
      document.head.appendChild(script);
    }catch(e){
      console.error('Japan Ready compatibility loader failed',e);
      const t=document.querySelector('#campaignChooserText'); if(t)t.textContent='Japan Ready is temporarily unavailable. Please refresh once the app has loaded.';
    }
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
})();
