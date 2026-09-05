'use strict';

/* Kaishi Japanese Service Worker — 11.60.0. */
var VERSION = '11.60.0';
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
               (key.indexOf('kaishi-audio-') === 0 && key !== AUDIO_CACHE) ||
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
    if (FORCE_OFFLINE) {
      event.respondWith(offlineMatch(request).then(function(hit) {
        return hit || caches.match(request).then(function(cached) {
          return cached || fetch(request);
        });
      }));
      return;
    }
    if (isImage(request)) {
      event.respondWith(cacheFirst(request, IMAGE_CACHE));
      return;
    }
    if (isAudio(request)) {
      event.respondWith(cacheFirst(request, AUDIO_CACHE));
    }
  } catch (e) {}
});
