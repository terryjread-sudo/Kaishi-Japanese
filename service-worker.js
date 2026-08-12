'use strict';

const VERSION='11.7.2';
const SHELL_CACHE=`kaishi-shell-${VERSION}`;
const IMAGE_CACHE=`kaishi-images-${VERSION}`;
const MAX_RUNTIME_IMAGES=350;

const v=path=>`${path}?v=${VERSION}`;

const SHELL=[
  './',
  './index.html',
  v('./styles.css'),
  v('./vms.css'),
  v('./app.js'),
  v('./vms.js'),
  v('./cloud.js'),
  v('./reporting.js'),
  v('./japan-ready.js'),
  v('./supabase-config.js'),
  v('./release-manager.js'),
  v('./battle-listen.js'),
  v('./kotoba-activity.js'),
  v('./dashboard-clarity.js'),
  v('./touch-enhancements.js'),
  v('./learning-ui.js'),
  v('./carousel-navigation.js'),
  v('./adaptive-learning.js'),
  v('./campfire-recall.js'),
  v('./word-rain.js'),
  v('./battle-ui-patch.js'),
  './data/japan-ready-v90.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  v('./media/guides/teacher-guide.webp'),
  v('./media/profiles/guest-learner.webp'),
  v('./media/profiles/boy-base.webp'),
  v('./media/profiles/girl-base.webp'),
  v('./media/profiles/master-base.webp'),
  v('./media/profiles/man-base.webp'),
  v('./media/profiles/woman-base.webp')
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache=>Promise.allSettled(SHELL.map(url=>cache.add(url))))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys.filter(key=>
          (key.startsWith('kaishi-shell-')&&key!==SHELL_CACHE)||
          (key.startsWith('kaishi-images-')&&key!==IMAGE_CACHE)
        ).map(key=>caches.delete(key))
      ))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING') self.skipWaiting();
});

function isImage(request){
  return request.destination==='image'||/\.(?:png|jpe?g|webp|gif|svg)(?:\?|$)/i.test(request.url);
}

async function trimImages(cache){
  const keys=await cache.keys();
  if(keys.length<=MAX_RUNTIME_IMAGES) return;
  await Promise.all(keys.slice(0,keys.length-MAX_RUNTIME_IMAGES).map(key=>cache.delete(key)));
}

async function cacheFirstImage(request){
  const cache=await caches.open(IMAGE_CACHE);
  const cached=await cache.match(request);
  if(cached) return cached;
  const response=await fetch(request,{cache:'no-cache'});
  if(response&&response.ok&&response.type!=='opaque'){
    await cache.put(request,response.clone());
    trimImages(cache);
  }
  return response;
}

async function networkFirst(request){
  const cache=await caches.open(SHELL_CACHE);
  try{
    const response=await fetch(request,{cache:'no-cache'});
    if(response&&response.ok) await cache.put(request,response.clone());
    return response;
  }catch(error){
    return (await cache.match(request))||Promise.reject(error);
  }
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;

  // version.json must always be checked against the network first.
  if(url.pathname.endsWith('/version.json')){
    event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>caches.match(request)));
    return;
  }

  if(isImage(request)){
    event.respondWith(cacheFirstImage(request));
    return;
  }

  if(['script','style','document'].includes(request.destination)){
    event.respondWith(networkFirst(request));
  }
});
