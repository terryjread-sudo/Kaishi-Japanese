KAISHI QUEST v11.4.1 — STARTUP FIX
=======================================

Copy the CONTENTS of this ZIP over the ROOT of the Kakashi-Web repository.

ROOT CAUSE
----------
v11.4.0 removed the old Village/Classic toggle and Activity Village checkbox
from index.html. The existing app.js still contains direct bindings:

  $('#activityViewToggle').onclick = ...
  $('#activityVillageMode').onchange = ...

Because those elements no longer existed, app.js threw a TypeError while
initialising. Execution stopped at that point, so the later main-page button
handlers were never attached.

FIX
---
v11.4.1 restores those two elements as hidden compatibility hooks. They cannot
be seen or used by the learner, but they allow the existing app.js startup
sequence to complete normally.

The app remains CLASSIC-ONLY:
- no animated Village view
- no Village/Classic toggle
- no Activity Village setting
- Classic Activity Landmarks are forced visible
- Practice Hub is forced visible

All v11.4.0 Adaptive Learning functionality remains included.

VERSION / CACHE
---------------
Release and service-worker caches are bumped to v11.4.1.

NO DATABASE MIGRATION
---------------------
No Supabase schema change is required.
Learner progress, streaks, settings and cloud progress are preserved.
