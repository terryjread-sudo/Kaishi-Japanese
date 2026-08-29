'use strict';

/* Kaishi Quest v11.17.3 — fail-safe Service Worker. */
var VERSION = '11.17.3';
try {
  importScripts('./version.js');
  if (typeof APP_VERSION === 'string' && APP_VERSION.trim()) VERSION = APP_VERSION.trim();
} catch (e) {
  try { console.warn('[Kaishi SW] version.js failed; using fallback version', e); } catch (_) {}
}

var SHELL_CACHE = 'kaishi-shell-' + VERSION;
var IMAGE_CACHE = 'kaishi-images-' + VERSION;
var OFFLINE_CACHE = 'kaishi-offline-' + VERSION;
var FORCE_OFFLINE = false;
var MAX_RUNTIME_IMAGES = 350;

function v(path) { return path + '?v=' + encodeURIComponent(VERSION); }

var SHELL = [
  './','./index.html',
  v('./styles.css'),v('./sentence-lab.css'),v('./engagement-layer.css'),
  v('./pronunciation-coach.css'),v('./bonsai-progress.css'),v('./vms.css'),
  v('./app.js'),v('./vms.js'),v('./cloud.js'),v('./reporting.js'),
  v('./japan-ready.js'),v('./supabase-config.js'),v('./release-manager.js'),
  v('./battle-listen.js'),v('./kotoba-activity.js'),v('./dashboard-clarity.js'),
  v('./touch-enhancements.js'),v('./learning-ui.js'),v('./carousel-navigation.js'),
  v('./micro-practice.js'),v('./sentence-lab.js'),v('./engagement-layer.js'),
  v('./pronunciation-coach.js'),v('./bonsai-progress.js'),v('./adaptive-learning.js'),
  v('./adaptive-reinforcement.js'),v('./campfire-recall.js'),v('./word-rain.js'),
  v('./battle-ui-patch.js'),
  './data/japan-ready-v90.json','./data/sentence-lab.json',
  './data/vocabulary.json','./data/kana.json','./data/manga-stories.json',
  './data/conversations.json','./data/theatre-scenes.json','./data/grammar-path.json',
  './data/kanji-components.json','./memory-scenes.json','./data/anki-content-v72.json',
  './data/topics-v72.json','./data/learning-graph-v82.json','./visual-mnemonics.json',
  './icons/icon-192.png','./icons/icon-512.png',
  v('./media/guides/teacher-guide.webp'),v('./media/guides/sensei/sensei-welcoming.webp'),
  v('./media/guides/sensei/sensei-explaining.webp'),v('./media/guides/sensei/sensei-celebrating.webp'),
  v('./media/guides/sensei/sensei-encouraging.webp'),v('./media/guides/sensei/sensei-pointing.webp'),
  v('./media/guides/sensei/sensei-analysing.webp'),v('./media/sentence-lab/sentence-lab-hero.webp'),
  v('./media/bonsai/bonsai-growth-stages.png'),v('./media/bonsai/bonsai-condition-overlays.png'),
  v('./media/profiles/guest-learner.webp'),v('./media/profiles/boy-base.webp'),
  v('./media/profiles/girl-base.webp'),v('./media/profiles/master-base.webp'),
  v('./media/profiles/man-base.webp'),v('./media/profiles/woman-base.webp')
];

self.addEventListener('install', function(event) {
  event.waitUntil((async function() {
    try {
      var cache = await caches.open(SHELL_CACHE);
      await Promise.all(SHELL.map(function(url) {
        return cache.add(url).catch(function() { return null; });
      }));
    } catch (e) {}
    try { await self.skipWaiting(); } catch (e) {}
  })());
});

self.addEventListener('activate', function(event) {
  event.waitUntil((async function() {
    try {
      var keys = await caches.keys();
      await Promise.all(keys.filter(function(key) {
        return (key.indexOf('kaishi-shell-') === 0 && key !== SHELL_CACHE) ||
               (key.indexOf('kaishi-images-') === 0 && key !== IMAGE_CACHE) ||
               (key.indexOf('kaishi-offline-') === 0 && key !== OFFLINE_CACHE);
      }).map(function(key) { return caches.delete(key).catch(function(){return false;}); }));
    } catch (e) {}
    try { await self.clients.claim(); } catch (e) {}
  })());
});

self.addEventListener('message', function(event) {
  try {
    if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
    if (event.data && event.data.type === 'KAISHI_FORCE_OFFLINE')
      FORCE_OFFLINE = Boolean(event.data.enabled);
  } catch (e) {}
});

async function offlineMatch(request) {
  try { return await (await caches.open(OFFLINE_CACHE)).match(request,{ignoreSearch:true}); }
  catch (e) { return null; }
}
function isImage(request) {
  return request.destination === 'image' || /\.(?:png|jpe?g|webp|gif|svg)(?:\?|$)/i.test(request.url);
}
async function networkFirst(request) {
  try {
    var cache = await caches.open(SHELL_CACHE);
    try {
      var response = await fetch(request,{cache:'no-cache'});
      if (response && response.ok) { try { await cache.put(request,response.clone()); } catch(e) {} }
      return response;
    } catch (e) {
      return (await cache.match(request,{ignoreSearch:true})) ||
             (await offlineMatch(request)) || fetch(request);
    }
  } catch (e) { return fetch(request); }
}
async function cacheImage(request) {
  try {
    var cache = await caches.open(IMAGE_CACHE);
    var hit = await cache.match(request);
    if (hit) return hit;
    var response = await fetch(request,{cache:'no-cache'});
    if (response && response.ok && response.type !== 'opaque') {
      try { await cache.put(request,response.clone()); } catch(e) {}
    }
    return response;
  } catch (e) {
    return (await offlineMatch(request)) || fetch(request);
  }
}
async function networkOffline(request) {
  try { return await fetch(request,{cache:'no-cache'}); }
  catch (e) { return (await offlineMatch(request)) || fetch(request); }
}

self.addEventListener('fetch', function(event) {
  var request = event.request;
  if (!request || request.method !== 'GET') return;

  if (FORCE_OFFLINE) {
    event.respondWith((async function() {
      var offline = await offlineMatch(request);
      if (offline) return offline;
      try { var cached = await caches.match(request); if (cached) return cached; } catch(e) {}
      return new Response('Kaishi is in forced offline mode.', {
        status:503, headers:{'Content-Type':'text/plain; charset=utf-8'}
      });
    })());
    return;
  }

  var url;
  try { url = new URL(request.url); } catch(e) { return; }
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(fetch(request,{cache:'no-store'}).catch(function() {
      return caches.match(request).then(function(r) {
        return r || new Response(JSON.stringify({version:VERSION}), {
          headers:{'Content-Type':'application/json'}
        });
      });
    }));
    return;
  }
  if (isImage(request) || url.pathname.indexOf('/media/kanji-strokes/') !== -1) {
    event.respondWith(cacheImage(request)); return;
  }
  if (['script','style','document'].indexOf(request.destination) !== -1) {
    event.respondWith(networkFirst(request)); return;
  }
  event.respondWith(networkOffline(request));
});
