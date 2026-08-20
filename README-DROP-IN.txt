Kaishi Quest v11.8.38 — Cache & Offline Data

Replace these ROOT files:
- release-manager.js
- bonsai-progress.js
- service-worker.js
- version.json

NEW SETTINGS PANEL
Settings now includes "Cache & Offline Data".

It displays:
- current app release
- active service-worker status
- service-worker script/version query
- number of cached shell files
- number of cached image files
- total cached files
- approximate cache size
- exact Kaishi cache names

CLEAR CACHED FILES
The button deletes ONLY caches whose names begin:
- kaishi-shell-
- kaishi-images-

It does NOT clear localStorage and does NOT delete:
- vocabulary/learning progress
- mastered words
- streaks
- learner settings
- Japan Ready progress
- cloud account/progress

The panel can be refreshed at any time, which should also make future
service-worker/update debugging much easier.

All v11.8.37 features are retained.
