KAISHI QUEST v11.3.2 — EMERGENCY LAUNCH FIX
================================================

Overwrite the files in the repo root with the contents of this ZIP.

ROOT CAUSE FIXED
----------------
v11.3.1 added a MutationObserver that called ensureLaunchers() for every
Activity Village subtree mutation. ensureLaunchers() updates text in the same
subtree, which generates another mutation. That can create a continuous
observer loop and make the site appear not to launch / freeze.

v11.3.2 only calls ensureLaunchers() when a Kotoba launcher is genuinely
missing, and queues the restore once per animation frame.

FILES
-----
index.html
kotoba-activity.js
release-manager.js
service-worker.js
supabase-config.js
version.json

The version badge remains clickable and performs the update/cache refresh flow.

IMPORTANT
---------
This refresh only clears Kaishi Cache Storage entries. It does not clear
localStorage learner progress, streaks, settings, or cloud progress.
