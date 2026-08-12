KAISHI QUEST v11.6.0 — TOUCH INTERACTION UPDATE
===================================================

Copy the CONTENTS of this ZIP over the ROOT of the Kakashi-Web repository.

NEW FILE
--------
touch-enhancements.js

TOUCH ENHANCEMENTS
------------------
Kaishi detects touch/coarse-pointer capability rather than checking whether the
device is Android, iPhone, tablet, etc. Mouse and keyboard behaviour remains.

DASHBOARD
---------
Swipe horizontally across the non-button area of the Study Modes card:
  swipe left  -> Japan Ready
  swipe right -> Journey

The visible Journey / Japan Ready buttons remain available.

CAMPFIRE RECALL
---------------
After Reveal:
  swipe right -> I knew it
  swipe left  -> Didn't know

"Almost" remains a normal visible button. This avoids using vertical swipe,
which would interfere with page scrolling.

JAPAN READY KANA BUILDER
------------------------
- normal tap still selects a kana
- long press reads the kana aloud without entering it
- drag a kana tile onto the built-answer area to select it

KOTOBA RAIN / COLOSSEUM
-----------------------
Where navigator.vibrate() is supported:
- short haptic on correct
- double haptic pattern on wrong

Rain retains direct finger tracking of the platform.

TOUCH TARGETS
-------------
Coarse-pointer devices receive larger button/choice/kana targets and slightly
more spacing. Desktop mouse layouts are unchanged.

IMPORTANT
---------
These are progressive enhancements. No learning, SRS, mission, Japan Ready,
cloud or Supabase data structures are changed.

VERSION / CACHE
---------------
Release and service-worker references are bumped to v11.6.0.
touch-enhancements.js is included in the new shell cache.

No Supabase migration is required.
