const C='kaishi-v3-4-0';
const CORE=['./','index.html','styles.css','app.js','manifest.webmanifest','version.json','memory-scenes.json','scene-pack-01.webp','scene-pack-02.webp','scene-pack-03.webp','data/vocabulary.json','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(C))));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([
  caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))),
  self.clients.claim()
])));
self.addEventListener('message',e=>{if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.origin===location.origin&&(u.pathname.endsWith('/version.json')||u.pathname.endsWith('/sw.js'))){
    e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(x=>{
    if(u.origin===location.origin&&e.request.method==='GET'){const y=x.clone();caches.open(C).then(c=>c.put(e.request,y))}
    return x;
  }).catch(()=>caches.match('index.html'))));
});
