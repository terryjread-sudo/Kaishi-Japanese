'use strict';
const VERSION='11.0.1';
const SHELL_CACHE=`kaishi-shell-${VERSION}`;
const IMAGE_CACHE=`kaishi-images-${VERSION}`;
const MAX_RUNTIME_IMAGES=350;
const SHELL=[
 './','./index.html',`./styles.css?v=${VERSION}`,`./vms.css?v=${VERSION}`,
 `./app.js?v=${VERSION}`,`./vms.js?v=${VERSION}`,`./cloud.js?v=${VERSION}`,
 `./reporting.js?v=${VERSION}`,`./japan-ready.js?v=${VERSION}`,'./data/japan-ready-v90.json','./icons/icon-192.png','./icons/icon-512.png',
 `./media/guides/teacher-guide.webp?v=${VERSION}`,
 './media/activity-village/village-cat-idle.png?v=11.0.1',
 './media/activity-village/water-mask-rivers.png?v=11.0.1',
 './media/activity-village/water-mask-pools.png?v=11.0.1',
 './media/activity-village/water-mask-waterfalls.png?v=11.0.1',
 './media/activity-village/water-mask-sea.png?v=11.0.1',
 './media/activity-village/fog-heavy.png?v=11.0.1',
 './media/activity-village/fog-medium.png?v=11.0.1',
 './media/activity-village/fog-wisp.png?v=11.0.1',
 './media/activity-village/kaishi-village-map.webp?v=11.0.1','./media/activity-village/water-shimmer.png?v=11.0.1','./media/activity-village/petals.png?v=11.0.1','./media/activity-village/mist.png?v=11.0.1','./media/activity-village/ripple.png?v=11.0.1',
 './media/profiles/guest-learner.webp?v=11.0.1','./media/profiles/boy-base.webp','./media/profiles/girl-base.webp',
 './media/profiles/master-base.webp','./media/profiles/man-base.webp',
 './media/profiles/woman-base.webp'
];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(SHELL_CACHE)
  .then(cache=>Promise.allSettled(SHELL.map(url=>cache.add(url))))
  .then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys()
  .then(keys=>Promise.all(keys.filter(key=>(key.startsWith('kaishi-shell-')&&key!==SHELL_CACHE)||(key.startsWith('kaishi-images-')&&key!==IMAGE_CACHE)).map(key=>caches.delete(key))))
  .then(()=>self.clients.claim()));
});
function isImage(request){
 return request.destination==='image'||/\.(?:png|jpe?g|webp|gif|svg)(?:\?|$)/i.test(request.url);
}
async function trimImages(cache){
 const keys=await cache.keys();
 if(keys.length<=MAX_RUNTIME_IMAGES)return;
 await Promise.all(keys.slice(0,keys.length-MAX_RUNTIME_IMAGES).map(key=>cache.delete(key)));
}
async function cacheFirstImage(request){
 const cache=await caches.open(IMAGE_CACHE),cached=await cache.match(request);
 if(cached)return cached;
 const response=await fetch(request);
 if(response&&response.ok&&response.type!=='opaque'){
  await cache.put(request,response.clone());
  trimImages(cache);
 }
 return response;
}
async function networkFirst(request){
 const cache=await caches.open(SHELL_CACHE);
 try{
  const response=await fetch(request);
  if(response&&response.ok)cache.put(request,response.clone());
  return response;
 }catch(error){
  return(await cache.match(request))||Promise.reject(error);
 }
}
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 if(isImage(request)){event.respondWith(cacheFirstImage(request));return}
 if(url.pathname.endsWith('/version.json')){event.respondWith(networkFirst(request));return}
 if(['script','style','document'].includes(request.destination))event.respondWith(networkFirst(request));
});
