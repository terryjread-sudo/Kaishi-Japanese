import { catalogSchema, groupCoverage, selectPack } from '../domains/offline/coverage';
import type { OfflineCatalog, Pack } from '../domains/offline/coverage';
import { cacheDownloadPort, downloadAssets, offlineRepository, removeOfflineCaches, verifyAssets } from '../platform/offline-download';
import { loadContent } from '../platform/content';
import { deviceStorage } from '../platform/storage';

const bytes=(value:number)=>value<1048576?`${Math.round(value/1024)} KB`:`${(value/1048576).toFixed(1)} MB`;
export function createOfflineUI(version:string) {
  const repository=offlineRepository();const storage=deviceStorage();let catalog:OfflineCatalog|undefined,selected:Pack=repository.load()?.pack||'essential',busy=false,controller:AbortController|undefined;
  const forceOfflineKey='kq-force-offline';
  const forceOffline=()=>storage.getItem(forceOfflineKey)==='1';
  let loading:Promise<void>|undefined;
  const q=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T|null;
  const publish=()=>window.dispatchEvent(new Event('kaishi-offline-status'));
  const assets=()=>{const b=window.KaishiJapanReadyBridge;return catalog?selectPack(catalog,selected,b?.getVocab().filter(w=>b.wordIntroduced(w)).map(w=>w.id)||[]):[];};
  function paint(state=repository.load()) {
    const el=q('offlineCoverage');if(!el)return;
    const required=assets(),sameVersion=state?.version===version,verified=sameVersion?state.verified:{},missing=required.filter(a=>verified[a.url]===undefined),size=required.reduce((sum,a)=>sum+a.bytes,0);
    const status=!state?'Not downloaded':!sameVersion?'Update available — previous pack retained':state.status==='unverified'?'Needs verification':missing.length?'Partial':'Ready';
    const stateNode=q('offlinePackState');if(stateNode)stateNode.textContent=status;
    const progress=q('offlinePackProgressText');if(progress)progress.textContent=`${required.length-missing.length} / ${required.length} required files verified · ${bytes(Object.values(verified).reduce((sum,n)=>sum+n,0))} downloaded`;
    const estimate=q('offlineEstimate');if(estimate)estimate.textContent=`Estimated pack size: ${bytes(size)}. ${catalog?.production?'':'Offline reopening must be tested on the production build.'}`;
    const table=document.createElement('table');table.innerHTML='<thead><tr><th>Lesson or scenario</th><th>Text</th><th>Images</th><th>Audio</th></tr></thead>';
    const body=document.createElement('tbody');
    for(const group of catalog?.groups||[]){const row=document.createElement('tr'),title=document.createElement('th');title.scope='row';title.textContent=group.title;row.append(title);for(const item of groupCoverage(group,verified,catalog!)){const cell=document.createElement('td');cell.textContent=item.kind==='audio'&&group.speechOnly?'Device voice':item.total?`${item.ready}/${item.total}`:'—';row.append(cell);}body.append(row);}
    table.append(body);el.replaceChildren(table);
    const retry=q<HTMLButtonElement>('downloadOfflinePack');if(retry){retry.disabled=busy;retry.textContent=state&&sameVersion&&missing.length?'Retry missing files':state?'Update offline content':'Download for offline use';}
    const cancel=q('offlineCancel');if(cancel)cancel.hidden=!busy;
    const missingHost=q('offlineMissing');if(missingHost){missingHost.replaceChildren();const heading=document.createElement('summary');heading.textContent=`${missing.length} missing files`;missingHost.append(heading);const list=document.createElement('ul');for(const asset of missing.slice(0,100)){const li=document.createElement('li');li.textContent=asset.url;list.append(li);}if(missing.length>100){const note=document.createElement('p');note.textContent='Showing the first 100. Retry checks every missing file.';missingHost.append(note);}missingHost.append(list);}
    const toggle=q<HTMLButtonElement>('forceOfflineToggle');const statusEl=q('forceOfflineStatus');const forced=forceOffline();const online=!forced&&navigator.onLine!==false;if(toggle){toggle.setAttribute('aria-checked',String(forced));toggle.classList.toggle('is-forced',forced);toggle.innerHTML=`<span class="offline-status-dot ${online?'is-online':'is-offline'}" aria-hidden="true"></span><span>${forced?'Offline mode enabled':'Force offline mode'}</span>`;}if(statusEl)statusEl.textContent=online?'Online — downloads and live content available':'Offline — using downloaded content where available';
  }
  async function load() {
    if(loading)return loading;
    loading=(async()=>{try{catalog=await loadContent('offline-catalog.json',catalogSchema);const state=repository.load();if(state?.version===version){const required=state.required.length?catalog.assets.filter(a=>state.required.includes(a.url)):assets();const verified=await verifyAssets(required,version);const missing=required.filter(a=>verified[a.url]===undefined);repository.save({...state,required:required.map(a=>a.url),verified,failed:missing.map(a=>a.url),status:missing.length?'partial':'ready'});}paint();}catch{const message=q('offlinePackProgressText');if(message)message.textContent='Could not load offline coverage. Connect and retry.';}finally{loading=undefined;}})();return loading;
  }
  async function download(pack:Pack=selected) {
    if(busy)return;selected=pack;if(!catalog)await load();if(!catalog)return;
    busy=true;controller=new AbortController();paint();let failure='';
    try{
      const port=await cacheDownloadPort(version,repository.save,controller.signal);
      const state=await downloadAssets(assets(),version,selected,port,state=>{const message=q('offlinePackProgressText');if(message)message.textContent=`${Object.keys(state.verified).length} / ${state.required.length} files verified · ${state.failed.length} unavailable`;},controller.signal);
      // Cache the catalog too so a cold offline start can display verified coverage.
      const cache=await caches.open(`kaishi-offline-${version}`);await cache.put(new URL('offline-catalog.json',document.baseURI),new Response(JSON.stringify(catalog),{headers:{'Content-Type':'application/json'}}));
      if(state.status==='ready'&&catalog.production)navigator.serviceWorker?.controller?.postMessage({type:'KAISHI_PACK_VERIFIED',version});
    }catch(error){failure=error instanceof Error?`Download stopped: ${error.message}. You can retry.`:'Download stopped. You can retry.';}
    finally{busy=false;paint();const message=q('offlinePackProgressText');if(failure&&message)message.textContent=failure;publish();}
  }
  async function remove() { if(busy||!confirm('Remove downloaded offline content? Learning progress will be kept.'))return;await removeOfflineCaches();repository.remove();paint();publish(); }
  function install() {
    if(q('offlineModeCard'))return;
    const target=q('checkUpdateBtn');if(!target)return;
    const host=document.createElement('section');host.id='offlineModeCard';host.className='offline-mode-card';
    host.innerHTML='<h3>Offline learning</h3><p>Download Japan Ready and its travel cheat sheet before travelling.</p><label>Content pack <select id="offlinePackSelect"><option value="essential">Essential Pack — Japan Ready and travel cheat sheet</option><option value="standard">Standard Pack — next lesson, introduced words and travel text</option><option value="full">Full Pack — all bundled learning media</option></select></label><p id="offlineEstimate"></p><strong id="offlinePackState">Checking…</strong><p id="offlinePackProgressText" role="status"></p><button id="downloadOfflinePack" class="primary">Download for offline use</button><button id="offlineCancel" hidden>Pause download</button><button id="removeOfflinePack">Remove offline content</button><details class="offline-coverage"><summary>Coverage by lesson and scenario</summary><div id="offlineCoverage"></div></details><details id="offlineMissing"></details><p>Recorded audio works when downloaded. Travel voices depend on Japanese speech installed on this device; speech recognition may need a connection. Text remains usable without audio.</p>';
    const toggle=document.createElement('button');toggle.id='forceOfflineToggle';toggle.type='button';toggle.setAttribute('role','switch');const status=document.createElement('p');status.id='forceOfflineStatus';host.append(toggle,status);
    target.before(host);const select=q<HTMLSelectElement>('offlinePackSelect');if(select){select.value=selected;select.onchange=()=>{selected=select.value as Pack;paint();};}
    toggle.onclick=()=>{storage.setItem(forceOfflineKey,forceOffline()?'0':'1');paint();publish();};
    addEventListener('online',()=>paint());addEventListener('offline',()=>paint());
    const button=q<HTMLButtonElement>('downloadOfflinePack');if(button)button.onclick=()=>{void download()};const cancel=q<HTMLButtonElement>('offlineCancel');if(cancel)cancel.onclick=()=>controller?.abort();const removeButton=q<HTMLButtonElement>('removeOfflinePack');if(removeButton)removeButton.onclick=()=>{void remove()};
    void load();
  }
  return {install,download,remove,state:repository.load,render:()=>{install();paint();},isOutdated:()=>{const state=repository.load();return Boolean(state&&state.version!==version);}};
}
