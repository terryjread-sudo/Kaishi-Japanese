Kaishi Quest 11.25.28

Drop-in source release based on the latest supplied main files.

Core repair:
- version.js is a simple bootstrap only; no fetch interception or data-fetch
  monitoring.
- APP_VERSION is defined once by version.js and consumed by app.js/service-worker.js.
- service-worker cache namespace is 11.25.28, preventing the old 11.19.1 shell
  from being reused as the current application shell.
- vocabulary/deck data remains in the service-worker shell list.
- index.html uses 11.25.28 cache-busters and visible version.
- no additional numbered patch file.

Replace:
- index.html
- app.js
- version.js
- service-worker.js
