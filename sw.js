// Kaishi Quest v4.0.0
// Offline caching is intentionally disabled while the direct-image release is validated.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
