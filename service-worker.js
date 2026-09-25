'use strict';

/* Kaishi Japanese Service Worker — 11.164.0. */
var VERSION = '11.164.0';
try {
  importScripts('./version.js', './content-manifest.generated.js');
  if (typeof APP_VERSION === 'string' && APP_VERSION.trim()) VERSION = APP_VERSION.trim();
} catch (e) {}

var SHELL_CACHE = 'kaishi-shell-' + VERSION;
var IMAGE_CACHE = 'kaishi-images-' + VERSION;
var AUDIO_CACHE = 'kaishi-audio-' + VERSION;
var OFFLINE_CACHE = 'kaishi-offline-' + VERSION;
var FORCE_OFFLINE = false;

function v(path) { return path + '?v=' + encodeURIComponent(VERSION); }

var manifestFiles = self.KaishiContentManifest && self.KaishiContentManifest.coreFiles;
var SHELL = (manifestFiles || ['./','./index.html','./version.js','./app.js']).map(function(path) {
  return /\.(?:js|css)$/.test(path) ? v(path) : path;
});

self.addEventListener('install', function(event) {
  event.waitUntil((async function() {
    var cache;
    try {
      cache = await caches.open(SHELL_CACHE);
      var shell = SHELL;
      try { var manifest = await fetch('./offline-shell.json', {cache:'no-cache'}); if(manifest.ok) shell = await manifest.json(); } catch(e) {}
      await cache.addAll(shell);
      await self.skipWaiting();
    } catch (error) {
      // Never activate a release with a partially populated application shell.
      if (cache) await caches.delete(SHELL_CACHE).catch(function() {});
      throw error;
    }
  })());
});

self.addEventListener('activate', function(event) {
  event.waitUntil((async function() {
    try {
      var current = [SHELL_CACHE, IMAGE_CACHE, AUDIO_CACHE, OFFLINE_CACHE];
      var keys = await caches.keys();
      await Promise.all(keys.filter(function(key) {
        var runtime = key.indexOf('kaishi-shell-') === 0 || key.indexOf('kaishi-images-') === 0 || key.indexOf('kaishi-audio-') === 0;
        return runtime && current.indexOf(key) === -1;
      }).map(function(key) { return caches.delete(key); }));
      // Previous explicit offline packs are retained until the replacement is verified.
    } catch (e) {}
    try { await self.clients.claim(); } catch (e) {}
  })());
});

self.addEventListener('message', function(event) {
  try {
    if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
    if (event.data && event.data.type === 'KAISHI_FORCE_OFFLINE') FORCE_OFFLINE = Boolean(event.data.enabled);
    if (event.data && event.data.type === 'KAISHI_PACK_VERIFIED' && event.data.version === VERSION) {
      event.waitUntil(caches.keys().then(function(keys) {
        return Promise.all(keys.filter(function(key) {
          return key.indexOf('kaishi-offline-') === 0 && key !== OFFLINE_CACHE;
        }).map(function(key) { return caches.delete(key); }));
      }));
    }
  } catch (e) {}
});

async function offlineMatch(request) {
  try {
    // Bundled same-origin files are identical for module/CSS CORS requests and
    // the downloader's fetches, even when the server sends Vary: Origin.
    var hit = await (await caches.open(OFFLINE_CACHE)).match(request,{ignoreSearch:true,ignoreVary:true});
    if(hit) return hit;
    var keys = (await caches.keys()).filter(function(key){return key.indexOf('kaishi-offline-') === 0 && key !== OFFLINE_CACHE;}).reverse();
    for(var key of keys) { hit = await (await caches.open(key)).match(request,{ignoreSearch:true,ignoreVary:true}); if(hit) return hit; }
    return await caches.match(request,{ignoreSearch:true,ignoreVary:true});
  }
  catch (e) { return null; }
}
function isImage(request) {
  try { return request.destination === 'image'; } catch (e) { return false; }
}
function isAudio(request) {
  try { return request.destination === 'audio'; } catch (e) { return false; }
}
async function cacheFirst(request, cacheName) {
  var cached = await caches.match(request);
  if (cached) return cached;
  try {
    var response = await fetch(request);
    if (response && response.ok) {
      var cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    return cached || Response.error();
  }
}
self.addEventListener('fetch', function(event) {
  try {
    var request = event.request;
    if (!request || request.method !== 'GET') return;
    var url = new URL(request.url);
    if(url.origin !== self.location.origin) return;
    if(request.mode !== 'navigate' && !/\.(?:js|ts|css|json|html|webmanifest|png|jpe?g|webp|gif|svg|mp3|m4a|aac|ogg|wav)$/.test(url.pathname)) return;
    event.respondWith((async function(){
      var cached = await offlineMatch(request);
      if(!cached && request.mode === 'navigate') cached = await offlineMatch(new Request(new URL('./index.html',self.registration.scope)));
      if(FORCE_OFFLINE) return cached || Response.error();
      if(cached && !url.searchParams.has('offline-refresh') && (isImage(request)||isAudio(request))) return cached;
      try {
        var response = await fetch(request);
        if(response.ok) {
          var name = isImage(request)?IMAGE_CACHE:isAudio(request)?AUDIO_CACHE:SHELL_CACHE;
          await (await caches.open(name)).put(request,response.clone());
          return response;
        }
        return cached || response;
      }catch(e){return cached || Response.error();}
    })());
  } catch (e) {}
});
