import { describe,it,expect,vi } from 'vitest';
import { downloadAssets, offlineRepository } from './offline-download';
import type { DownloadPort } from './offline-download';
const assets=[{url:'index.html',bytes:10,kind:'text' as const},{url:'word.mp3',bytes:20,kind:'audio' as const}];
describe('verified offline downloads',()=>{
  it('reports partial failures and retries only the missing files',async()=>{
    const saved=new Map<string,number>();let fail=true;
    const fetch=vi.fn(async(asset:typeof assets[number])=>{if(asset.url==='word.mp3'&&fail)throw new Error('offline');saved.set(asset.url,asset.bytes);return asset.bytes;});
    const port:DownloadPort={cached:async a=>saved.get(a.url)??null,fetchAndCache:fetch,persist:()=>{}};
    const partial=await downloadAssets(assets,'v1','standard',port,()=>{});expect(partial.status).toBe('partial');expect(partial.failed).toEqual(['word.mp3']);
    fail=false;fetch.mockClear();const ready=await downloadAssets(assets,'v1','standard',port,()=>{});expect(ready.status).toBe('ready');expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('retains verified files when quota stops a download',async()=>{
    const port:DownloadPort={cached:async a=>a.url==='index.html'?10:null,fetchAndCache:async()=>{throw new DOMException('Full','QuotaExceededError')},persist:()=>{}};
    const state=await downloadAssets(assets,'v1','essential',port,()=>{});expect(state.verified['index.html']).toBe(10);expect(state.status).toBe('partial');
  });
  it('migrates legacy pack names and ISO timestamps without claiming coverage',()=>{
    localStorage.clear();localStorage.setItem('kq-offline-pack',JSON.stringify({version:'v1',pack:'complete',downloadedAt:'2026-09-06T10:00:00.000Z'}));
    const state=offlineRepository().load();expect(state?.pack).toBe('full');expect(state?.status).toBe('unverified');expect(state?.downloadedAt).toBeGreaterThan(0);
  });
  it('a paused download remains partial',async()=>{
    const controller=new AbortController();controller.abort();const fetch=vi.fn();
    const state=await downloadAssets(assets,'v1','essential',{cached:async()=>null,fetchAndCache:fetch,persist:()=>{}},()=>{},controller.signal);expect(state.status).toBe('partial');expect(fetch).not.toHaveBeenCalled();
  });
});
