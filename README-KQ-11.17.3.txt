Kaishi Quest v11.17.3 — Service Worker crash fix

ROOT CAUSE FOUND IN LIVE REPO:
service-worker.js imports version.js and immediately reads APP_VERSION.
The live version.js assigned APP_VERSION only to window. A service worker has
no window, so APP_VERSION was undefined and the worker could crash while
evaluating.

This patch:
- Makes APP_VERSION a true global in version.js.
- Keeps window.APP_VERSION for the normal application.
- Makes service-worker.js use a safe fallback if version.js cannot load.
- Makes install tolerant of individual missing/unavailable shell assets.
- Makes activation/cache/fetch paths defensive against rejected cache operations.
- Keeps version.js as the canonical version source.

Deploy:
  version.js
  service-worker.js

After deployment, the browser may need one refresh for the new worker to install.
If an old broken worker remains stuck, unregister that old worker once in the
browser's site/service-worker settings, then reload.
