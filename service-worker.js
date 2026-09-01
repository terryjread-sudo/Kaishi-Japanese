'use strict';

/* Kaishi Quest Service Worker — 11.25.29. */
var VERSION = '11.25.29';
try {
  importScripts('./version.js');
  if (typeof APP_VERSION === 'string' && APP_VERSION.trim()) VERSION = APP_VERSION.trim();
} catch (e) {}

var SHELL_CACHE = 'kaishi-shell-' + VERSION;
var IMAGE_CACHE = 'kaishi-images-' + VERSION;
var OFFLINE_CACHE = 'kaishi-offline-' + VERSION;
var FORCE_OFFLINE = false;

function v(path) { return path + '?v=' + encodeURIComponent(VERSION); }

var SHELL = [
  './','./index.html',v('./version.js'),v('./journey.js'),v('./roadmap-engine.js'),v('./road-ahead.js'),
  v('./styles.css'),v('./sentence-lab.css'),v('./engagement-layer.css'),
  v('./pronunciation-coach.css'),v('./bonsai-progress.css'),v('./vms.css'),v('./app.js'),
  v('./vms.js'),v('./cloud.js'),v('./reporting.js'),v('./japan-ready.js'),v('./supabase-config.js'),
  v('./release-manager.js'),v('./battle-listen.js'),v('./kotoba-activity.js'),v('./dashboard-clarity.js'),
  v('./touch-enhancements.js'),v('./learning-ui.js'),v('./carousel-navigation.js'),v('./micro-practice.js'),
  v('./sentence-lab.js'),v('./engagement-layer.js'),v('./pronunciation-coach.js'),v('./bonsai-progress.js'),
  v('./adaptive-learning.js'),v('./adaptive-reinforcement.js'),v('./campfire-recall.js'),v('./word-rain.js'),
  v('./battle-ui-patch.js'),
  './data/japan-ready-v90.json','./data/sentence-lab.json','./data/vocabulary.json',
  './data/kana.json','./data/manga-stories.json','./data/conversations.json',
  './data/theatre-scenes.json','./data/grammar-path.json','./data/kanji-components.json',
  './memory-scenes.json','./data/anki-content-v72.json','./data/topics-v72.json',
  './data/learning-graph-v82.json','./visual-mnemonics.json',
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
      await Promise.all(SHELL.map(function(url) { return cache.add(url).catch(function(){return null;}); }));
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
    if (event.data && event.data.type === 'KAISHI_FORCE_OFFLINE') FORCE_OFFLINE = Boolean(event.data.enabled);
  } catch (e) {}
});

async function offlineMatch(request) {
  try { return await (await caches.open(OFFLINE_CACHE)).match(request,{ignoreSearch:true}); }
  catch (e) { return null; }
}
function isImage(request) {
  try { return request.destination === 'image'; } catch (e) { return false; }
}
self.addEventListener('fetch', function(event) {
  try {
    var request = event.request;
    if (!request || request.method !== 'GET') return;
    if (FORCE_OFFLINE) {
      event.respondWith(offlineMatch(request).then(function(hit) {
        return hit || caches.match(request).then(function(cached) {
          return cached || fetch(request);
        });
      }));
      return;
    }
    if (isImage(request)) {
      event.respondWith((async function() {
        var cached = await caches.match(request);
        if (cached) return cached;
        try {
          var response = await fetch(request);
          if (response && response.ok) {
            var cache = await caches.open(IMAGE_CACHE);
            await cache.put(request, response.clone());
          }
          return response;
        } catch (e) {
          return cached || Response.error();
        }
      })());
    }
  } catch (e) {}
});
