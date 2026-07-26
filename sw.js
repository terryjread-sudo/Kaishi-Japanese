const C='kaishi-v3-4-2';
const CORE=['./','index.html','styles.css','app.js','manifest.webmanifest','version.json','memory-scenes.json','scene-pack-01.webp','scene-pack-02.webp','scene-pack-03.webp','data/vocabulary.json','icons/icon-192.png','icons/icon-512.png'];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(C).then(c=>c.addAll(C)));
});

self.addEventListener('activate',e=>e.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)))),
  self.clients.claim()
])));

self.addEventListener('message',e=>{
  if(e.data?.type==='SKIP_WAITING')self.skipWaiting();
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin)return;

  if(e.request.mode==='navigate'){
    e.respondWith(
      fetch(e.request,{cache:'no-store'})
        .then(r=>{
          const copy=r.clone();
          caches.open(C).then(c=>c.put('index.html',copy));
          return r;
        })
        .catch(()=>caches.match('index.html'))
    );
    return;
  }

  if(u.pathname.endsWith('/version.json')||u.pathname.endsWith('/sw.js')||u.pathname.endsWith('/app.js')||u.pathname.endsWith('/styles.css')){
    e.respondWith(
      fetch(e.request,{cache:'no-store'})
        .then(r=>{
          const copy=r.clone();
          caches.open(C).then(c=>c.put(e.request,copy));
          return r;
        })
        .catch(()=>caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{
      const copy=r.clone();
      caches.open(C).then(c=>c.put(e.request,copy));
      return r;
    }))
  );
});
