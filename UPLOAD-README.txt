KAISHI QUEST v11.4.0 — ADAPTIVE LEARNING UPDATE
====================================================

Copy the CONTENTS of this ZIP over the ROOT of the Kakashi-Web repository.

NEW FILES
---------
adaptive-learning.js
campfire-recall.js
word-rain.js

OVERWRITE
---------
index.html
kotoba-activity.js
release-manager.js
service-worker.js
version.json

The package also retains the v11.3.x battle sprite/background fixes already
present in the patch set.

LEARNING CHANGES
----------------
1. WORD LEARNING STATES
   Each introduced word is interpreted as:
   New -> Recognising -> Recall -> Usable
   using the existing per-skill strength/attempt data.

2. ADAPTIVE JOURNEY MISSIONS
   Strong learners receive a little more new material.
   Learners with weak strength or a large due backlog receive fewer new words
   and more reviews.
   Weak older-topic vocabulary is deliberately mixed into later missions.

3. MISTAKE REPAIR
   A failed answer in the normal Journey inserts one delayed retest of the same
   word/skill roughly four cards later. It does not endlessly reinsert failures.

4. SENSEI INSIGHT
   Journey/Home receives a short specific learning insight based on the current
   topic's weakest skill and active-recall/usable word counts.

5. OPTIONAL END-OF-SESSION BONUS
   Journey completion now offers:
     - Campfire Recall: no-choice retrieval, Reveal, then
       I knew it / Almost / Didn't know.
     - Kotoba Rain: 60-second fast recognition using today's words first.

   Both are optional. Finishing the Journey mission never depends on playing
   either bonus.

6. KOTOBA RAIN
   Uses today's/new/missed words when launched as a mission bonus.
   Correct arcade catches grade as moderate evidence (rating 3), not the same
   as confident unaided recall.
   Missed words can go straight into Campfire Recall.

7. KOTOBA COLOSSEUM
   Requires 8 battle-ready learned words rather than simply 4 introduced words.

CLASSIC ACTIVITY LANDMARKS ONLY
-------------------------------
The animated Village view, toggle and setting are removed from the UI.
The existing Classic Activity Landmarks are the only Journey activity view.
The animated village image/resident assets are no longer precached by the
service worker.

CACHE / VERSION
---------------
Release: v11.4.0
Service worker cache names and versioned asset URLs are bumped to v11.4.0.
The clickable header version badge/update refresh system remains in place.

NO DATABASE MIGRATION
---------------------
No Supabase schema change is required.
Learner progress, streaks, settings and cloud progress are preserved.
