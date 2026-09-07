import type { DownloadState, OfflineAsset, Pack } from '../domains/offline/coverage';
import { downloadStateSchema } from '../domains/offline/coverage';
import { offlinePackSchema } from '../domains/offline/offline-pack';
import { createVersionedRepository, deviceStorage } from './storage';

export interface DownloadPort {
  cached(asset:OfflineAsset):Promise<number|null>;
  fetchAndCache(asset:OfflineAsset):Promise<number>;
  persist(state:DownloadState):void;
}
export async function downloadAssets(assets:OfflineAsset[],version:string,pack:Pack,port:DownloadPort,onProgress:(state:DownloadState)=>void,signal?:AbortSignal) {
  const state:DownloadState={version,pack,downloadedAt:Date.now(),required:assets.map(a=>a.url),verified:{},failed:[],status:'partial'};
  port.persist(state);
  for(const asset of assets){
    if(signal?.aborted)break;
    try{state.verified[asset.url]=await port.cached(asset)??await port.fetchAndCache(asset);}
    catch(error){state.failed.push(asset.url);if(error instanceof Error&&error.name==='QuotaExceededError'){port.persist(state);onProgress(state);break;}}
    port.persist(state);onProgress(state);
  }
  state.failed=state.required.filter(url=>state.verified[url]===undefined);
  state.status=state.failed.length?'partial':'ready';port.persist(state);onProgress(state);return state;
}

export function offlineRepository() {
  const storage=deviceStorage();
  const repository=createVersionedRepository({storage,key:'kq-offline-state-v2',version:2,schema:downloadStateSchema});
  const existing=repository.load();
  if(!existing){try{const old=offlinePackSchema.safeParse(JSON.parse(storage.getItem('kq-offline-pack')||'null'));if(old.success)repository.save({version:old.data.version,pack:old.data.pack,downloadedAt:old.data.downloadedAt||0,required:[],verified:{},failed:[],status:'unverified'});}catch{/* Corrupt legacy metadata is ignored. */}}
  return {load:repository.load,save:(state:DownloadState)=>{repository.save(state);storage.setItem('kq-offline-pack',JSON.stringify({pack:state.pack,version:state.version,downloadedAt:state.downloadedAt,failed:state.failed.length,status:state.status}));},remove:()=>{repository.remove();storage.removeItem('kq-offline-pack');}};
}

async function responseSize(response:Response|undefined,asset:OfflineAsset):Promise<number|null> {
  if(!response?.ok)return null;
  const contentType=response.headers.get('content-type')||'';
  if(contentType.includes('text/html')&&!asset.url.endsWith('.html'))return null;
  const buffer=await response.clone().arrayBuffer(),bytes=buffer.byteLength;
  if(asset.sha256){const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))).map(b=>b.toString(16).padStart(2,'0')).join('');if(hash!==asset.sha256)return null;}
  return bytes>0&&(asset.bytes===0||asset.bytes===bytes)?bytes:null;
}
export async function cacheDownloadPort(version:string,persist:(state:DownloadState)=>void,signal?:AbortSignal):Promise<DownloadPort> {
  const cache=await caches.open(`kaishi-offline-${version}`);
  return {
    persist,
    cached:async asset=>responseSize(await cache.match(new URL(asset.url,document.baseURI),{ignoreSearch:true}),asset),
    fetchAndCache:async asset=>{
      const url=new URL(asset.url,document.baseURI),fresh=new URL(url);fresh.searchParams.set('offline-refresh',version);const response=await fetch(fresh,{cache:'no-cache',signal});
      const size=await responseSize(response,asset);if(size===null)throw new Error(`Unavailable: ${asset.url}`);
      await cache.put(url,response);return size;
    },
  };
}
export async function verifyAssets(assets:OfflineAsset[],version:string) {
  const port=await cacheDownloadPort(version,()=>{}),verified:Record<string,number>={};
  for(const asset of assets){const size=await port.cached(asset);if(size!==null)verified[asset.url]=size;}
  return verified;
}
export async function removeOfflineCaches() { for(const name of await caches.keys())if(name.startsWith('kaishi-offline-'))await caches.delete(name); }
