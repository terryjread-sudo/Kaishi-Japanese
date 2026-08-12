KAISHI QUEST v11.7.1 — NAVIGATION PERFORMANCE & CAROUSEL
============================================================

Copy the CONTENTS of this ZIP over the ROOT of the Kakashi-Web repository.

NEW FILE
--------
carousel-navigation.js

PERFORMANCE FIX
---------------
v11.7.0 added two expensive background behaviours:
- dashboard refresh every 2.5 seconds
- a MutationObserver watching the whole document and potentially recolouring
  Japanese text across the whole page after routine DOM changes

v11.7.1 removes both.

Dashboard / Today data now refreshes on meaningful events and page lifecycle
events. Japanese recolouring is limited to learning/game containers that are
actually rebuilt.

JOURNEY / JAPAN READY
---------------------
The explicit:
  "Swipe here to switch Journey / Japan Ready"
message is removed.

The study mode area now uses a native horizontal scroll-snap carousel:
- current card occupies about 90% of the width
- part of the neighbouring card remains visible
- two small page indicators sit underneath
- swiping uses native browser scrolling for better performance
- tapping a page dot changes mode
- existing Journey / Japan Ready application state is still updated underneath

This follows the common mobile pattern where a partially visible next card
signals that more content exists horizontally.

RETAINED
--------
- persistent Today summary
- Keep Learning after the three-step route
- Kanji / Hiragana / Katakana visual colour cues
- Kana result overlay with manual Continue
- Kotoba Rain 0-second finish fix
- v11.6 touch interactions
- v11.5 dashboard clarity
- v11.4 adaptive learning

VERSION / CACHE
---------------
Release and service-worker references are bumped to v11.7.1.

No Supabase migration is required.
