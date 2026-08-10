KAISHI QUEST v11.4.2 — BONUS SCREEN FIX
============================================

Copy the CONTENTS of this ZIP over the ROOT of the Kakashi-Web repository.

ROOT CAUSE
----------
app.js captures the application's screens once, immediately at startup:

  const screens=[...document.querySelectorAll('.screen')];

v11.4.0/11.4.1 created Campfire Recall dynamically after app.js had already
captured that list, while Kotoba Rain did not have its required #wordRain /
#wrCard screen markup at all.

So show('wordRain') / show('campfireRecall') could not activate those bonus
screens correctly. Kotoba Rain then tried to render into a missing #wrCard,
producing the blank page you saw.

FIX
---
v11.4.2 puts BOTH bonus screens directly in index.html before app.js runs:

  #wordRain / #wrCard
  #campfireRecall / #cfCard

They are now part of app.js's normal screen navigation from startup.

Defensive checks have also been added so a missing bonus screen can never fail
silently as a blank screen again.

RETAINED
--------
- Classic Activity Landmarks only
- Adaptive Journey missions
- New / Recognising / Recall / Usable word states
- same-session mistake repair
- Campfire Recall
- Kotoba Rain session bonus
- Rain -> quick review missed words
- Kotoba Colosseum
- clickable version/update refresh

VERSION / CACHE
---------------
Release and service-worker cache references are bumped to v11.4.2.

No Supabase migration is required.
