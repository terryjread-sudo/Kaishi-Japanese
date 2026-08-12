'use strict';

/*
 * Kaishi Quest release manager — v11.6.0
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
 * the same value in index.html and service-worker.js.
 */
(() => {
  const CURRENT_VERSION='11.6.0';
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
      // Short delay lets status/toast render before navigation.
      setTimeout(reloadFresh,250);
    }catch(error){
      console.error('[Kaishi release check]',error);
      setBadge(original,false);
      notify('Could not check for updates. Please try again when online.');
      refreshing=false;
    }
  }

  function install(){
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

    // Make the Settings "Check for updates" button use the same reliable flow,
    // overriding the older app.js updater if present.
    const settingsButton=document.getElementById('checkUpdateBtn');
    if(settingsButton){
      settingsButton.addEventListener('click',event=>{
        event.preventDefault();
        event.stopImmediatePropagation();
        checkAndRefresh();
      },true);
    }

    // Correct old hard-coded version text in existing UI.
    document.querySelectorAll('.version-badge').forEach(node=>node.textContent=`v${CURRENT_VERSION}`);
    const versionCard=document.querySelector('.version-card');
    if(versionCard){
      const strong=versionCard.querySelector('strong');
      if(strong) strong.textContent=`Kaishi Quest v${CURRENT_VERSION}`;
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',install,{once:true});
  }else install();
})();
