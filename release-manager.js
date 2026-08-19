'use strict';

/*
 * Kaishi Quest release manager — v11.8.34
 *
 * The header version badge is an active "check + refresh" control.
 * Clicking it:
 *   1. checks version.json without using browser/service-worker cache;
 *   2. asks the service worker to update;
 *   3. clears Kaishi shell/image caches (never learning/localStorage data);
 *   4. activates a waiting worker when present;
 *   5. reloads the app from a cache-busted URL.
 *
 * Every real release must increment CURRENT_VERSION and version.json and use
 * the same value in service-worker.js.
 */
(() => {
  const CURRENT_VERSION='11.8.34';
  const CACHE_PREFIXES=['kaishi-shell-','kaishi-images-'];
  let refreshing=false;

  window.KAISHI_RELEASE_VERSION=CURRENT_VERSION;

  function parseVersion(value='0.0.0'){
    return String(value).split('.').map(part=>Number.parseInt(part,10)||0).slice(0,3);
  }

  function compareVersions(a,b){
    const av=parseVersion(a),bv=parseVersion(b);
    for(let i=0;i<3;i++){
      if((av[i]||0)>(bv[i]||0)) return 1;
      if((av[i]||0)<(bv[i]||0)) return -1;
    }
    return 0;
  }

  function badge(){
    return document.getElementById('versionBadge') || document.querySelector('.version-badge');
  }

  function setBadge(text,busy=false){
    const el=badge();
    if(!el) return;
    el.textContent=text;
    el.setAttribute('aria-busy',String(busy));
  }

  function notify(message){
    try{
      if(typeof toast==='function'){ toast(message); return; }
    }catch{}
    const status=document.getElementById('updateStatus');
    if(status) status.textContent=message;
  }

  /*
   * v11.8.34 — Reading-from-Meaning correction review.
   *
   * app.js already renders an excellent Sensei correction panel for an
   * incorrect Reading-from-Meaning answer, but the shared bindChoices()
   * helper automatically advances after 900 ms. That makes the correct
   * reading flash green and disappear before the learner can study it.
   *
   * Override the helper without changing any other question behaviour:
   * - correct answers retain the existing short automatic transition;
   * - all non-reading choice questions retain the existing behaviour;
   * - an incorrect reading answer is graded immediately without advancing;
   * - the existing Sensei feedback remains visible until Continue is tapped.
   *
   * The call to grade(..., false) still goes through Adaptive Learning's
   * wrapped grade function, so mistake repair/retesting continues to work.
   */
  function installReadingReviewPause(){
    try{
      if(typeof bindChoices!=='function' || typeof grade!=='function') return;

      bindChoices=function(answer,skill,onReveal){
        document.querySelectorAll('.choice').forEach(button=>{
          button.onclick=()=>{
            if(revealed) return;
            revealed=true;

            const value=decodeURIComponent(button.dataset.answer);
            const ok=value===answer;

            button.classList.add(ok?'correct':'wrong');
            document.querySelectorAll('.choice').forEach(choice=>{
              if(decodeURIComponent(choice.dataset.answer)===answer){
                choice.classList.add('correct');
              }
              choice.disabled=true;
            });

            if(onReveal) onReveal(ok);

            const pauseForReadingReview=
              skill==='reading' &&
              !ok &&
              Boolean(document.getElementById('readingFeedback'));

            if(!pauseForReadingReview){
              setTimeout(
                ()=>grade(current.v,skill,ok?(hintUsed?2:3):1,ok),
                900
              );
              return;
            }

            // Record the mistake now, but deliberately leave this card open.
            grade(current.v,skill,1,false,false);

            const feedback=document.getElementById('readingFeedback');
            if(!feedback) return;

            let continueButton=document.getElementById('readingReviewContinue');
            if(!continueButton){
              continueButton=document.createElement('button');
              continueButton.id='readingReviewContinue';
              continueButton.type='button';
              continueButton.className='primary reveal';
              continueButton.textContent='Continue →';
              feedback.appendChild(continueButton);
            }

            continueButton.onclick=()=>next();
            feedback.scrollIntoView({behavior:'smooth',block:'nearest'});
            continueButton.focus({preventScroll:true});
          };
        });
      };
    }catch(error){
      console.warn('[Kaishi v11.8.34] Reading review pause could not be installed',error);
    }
  }

  async function fetchLatestVersion(){
    const response=await fetch(`version.json?check=${Date.now()}`,{
      cache:'no-store',
      headers:{'Cache-Control':'no-cache'}
    });
    if(!response.ok) throw new Error(`Version check failed (${response.status})`);
    return response.json();
  }

  async function clearKaishiCaches(){
    if(!('caches' in window)) return;
    const keys=await caches.keys();
    await Promise.all(
      keys.filter(key=>CACHE_PREFIXES.some(prefix=>key.startsWith(prefix)))
          .map(key=>caches.delete(key))
    );
  }

  async function updateServiceWorker(){
    if(!('serviceWorker' in navigator)) return null;
    const registration=await navigator.serviceWorker.getRegistration();
    if(!registration) return null;
    try{ await registration.update(); }catch{}
    return registration;
  }

  async function activateWaitingWorker(registration){
    const waiting=registration?.waiting;
    if(!waiting) return false;
    waiting.postMessage({type:'SKIP_WAITING'});
    await new Promise(resolve=>{
      const timeout=setTimeout(resolve,1200);
      navigator.serviceWorker.addEventListener('controllerchange',()=>{
        clearTimeout(timeout);
        resolve();
      },{once:true});
    });
    return true;
  }

  function reloadFresh(){
    const url=new URL(window.location.href);
    url.searchParams.set('kq-refresh',Date.now().toString());
    window.location.replace(url.toString());
  }

  async function checkAndRefresh(){
    if(refreshing) return;
    refreshing=true;
    const original=`v${CURRENT_VERSION}`;
    setBadge('Checking…',true);
    notify('Checking for a newer Kaishi Quest release…');

    try{
      const latest=await fetchLatestVersion();
      const latestVersion=String(latest?.version||CURRENT_VERSION);
      const newer=compareVersions(latestVersion,CURRENT_VERSION)>0;

      notify(newer
        ? `Kaishi Quest v${latestVersion} found. Refreshing app files…`
        : `v${CURRENT_VERSION} is current. Refreshing app files…`);

      const registration=await updateServiceWorker();
      await clearKaishiCaches();
      await activateWaitingWorker(registration);

      setBadge(newer?`v${latestVersion} ↻`:`v${CURRENT_VERSION} ↻`,true);
      setTimeout(reloadFresh,250);
    }catch(error){
      console.error('[Kaishi release check]',error);
      setBadge(original,false);
      notify('Could not check for updates. Please try again when online.');
      refreshing=false;
    }
  }

  function install(){
    installReadingReviewPause();

    const el=badge();
    if(el){
      el.textContent=`v${CURRENT_VERSION}`;
      el.setAttribute('role','button');
      el.setAttribute('tabindex','0');
      el.setAttribute('title','Check for updates and refresh');
      el.setAttribute('aria-label',`Kaishi Quest version ${CURRENT_VERSION}. Check for updates and refresh the app.`);
      el.style.cursor='pointer';
      el.addEventListener('click',checkAndRefresh);
      el.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key===' '){
          event.preventDefault();
          checkAndRefresh();
        }
      });
    }

    const settingsButton=document.getElementById('checkUpdateBtn');
    if(settingsButton){
      settingsButton.addEventListener('click',event=>{
        event.preventDefault();
        event.stopImmediatePropagation();
        checkAndRefresh();
      },true);
    }

    document.querySelectorAll('.version-badge').forEach(node=>node.textContent=`v${CURRENT_VERSION}`);
    const versionCard=document.querySelector('.version-card');
    if(versionCard){
      const strong=versionCard.querySelector('strong');
      if(strong) strong.textContent=`Kaishi Quest v${CURRENT_VERSION}`;
      const title=versionCard.querySelector('span');
      if(title) title.textContent='Reading Answer Review';
      const detail=versionCard.querySelector('small');
      if(detail) detail.textContent='Wrong Reading-from-Meaning answers now stay on screen so you can review and hear the correct Japanese before continuing.';
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',install,{once:true});
  }else install();
})();
