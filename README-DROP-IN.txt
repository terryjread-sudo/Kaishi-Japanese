Kaishi Quest v11.8.40 — Offline Detection & Forced Offline Mode

Replace:
- release-manager.js
- bonsai-progress.js
- service-worker.js
- version.json

Settings → Offline Mode now includes Force offline mode.

When enabled, Kaishi behaves as if there is no internet even if Wi-Fi/mobile
data is available. The service worker will serve downloaded offline content
and normal local caches only. Missing content gets a clear offline response
instead of attempting a network request.

Kaishi also detects real connectivity changes and displays an offline banner.

IMPORTANT: Download an Essential, Standard or Full Offline Pack first if you
want to use Kaishi with no internet. Forced offline mode does not download
anything itself.

Learning progress is retained. Cloud sync and online-only features resume
after connectivity returns and forced offline mode is disabled.
