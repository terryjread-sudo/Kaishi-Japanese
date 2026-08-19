Kaishi Quest v11.8.34 — Reading Answer Review

Drop these three files into the ROOT of the Kakashi-Web repository, replacing the existing files:
- release-manager.js
- service-worker.js
- version.json

No app.js or index.html replacement is required.

What changed:
When a learner gets a "Reading from meaning" multiple-choice question wrong, the existing Sensei correction panel now remains visible. The wrong answer is recorded immediately, the correct pronunciation plays, and the learner must tap Continue before the next card appears.

Why this updates existing users:
service-worker.js is bumped to v11.8.34 and version.json advertises v11.8.34. The existing release-manager is already loaded by index.html and will detect the new release, clear old Kaishi caches and refresh. After refresh, the updated release-manager installs the corrected Reading-from-Meaning behaviour.
