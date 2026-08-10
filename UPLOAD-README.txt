KAISHI QUEST v11.3.1
=====================

Copy the CONTENTS of this ZIP over the root of the Kakashi-Web repository.

OVERWRITE
---------
index.html
supabase-config.js
kotoba-activity.js
service-worker.js
version.json

NEW
---
release-manager.js

WHAT THIS RELEASE DOES
----------------------
1. Kotoba Colosseum is made visible from Activity Village:
   - a launcher below the Activity View toolbar,
   - a launcher in Classic Activity Village,
   - a marker on the animated village map.

2. The village cat is removed.

3. Version/cache handling is now release-based:
   - v11.3.1 is shown in the header and Settings.
   - JS/CSS/release assets use ?v=11.3.1.
   - service-worker caches are named kaishi-shell-11.3.1
     and kaishi-images-11.3.1.
   - old Kaishi caches are removed when the new worker activates.
   - version.json is always requested network-first/no-store.

4. Clicking the HEADER VERSION BADGE now:
   - checks version.json from the network,
   - asks the service worker to update,
   - clears Kaishi app caches (NOT user progress),
   - activates a waiting worker if one exists,
   - reloads the app with a cache-busting URL.

The Settings 'Check for updates' button is routed through the same mechanism.

USER DATA
---------
The refresh process does NOT clear localStorage, vocabulary progress, streaks,
settings, authentication data, or cloud progress. It only clears Kaishi shell
and image Cache Storage entries.

FUTURE RELEASE RULE
-------------------
For every release, increment the semantic version and update the same version in:
  index.html asset query strings
  release-manager.js CURRENT_VERSION
  service-worker.js VERSION
  version.json

Do not publish changed app files under an unchanged version number.
