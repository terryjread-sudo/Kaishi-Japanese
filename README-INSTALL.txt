Kaishi Quest v11.25.1 — Road Ahead bubble fixes
=================================================

BASE VERSION: 11.25.0

Drop these 3 files into the repo root, overwriting the existing ones.
Nothing else from v11.25.0 changed.

FILES IN THIS ZIP
------------------
  road-ahead.js   (replace)
  version.js      (replace) — version bump to 11.25.1
  version.json    (replace) — changelog entry

WHAT WAS FIXED
---------------
1. Bubble not hiding when leaving the Journey screen
   Root cause: the bubble's CSS rule set `display:flex` directly on its
   #id selector. That selector's specificity is higher than the browser's
   built-in `[hidden]{display:none}` rule, so setting `bubble.hidden =
   true` in JS had no visual effect — the bubble stayed on screen.
   Fix: added an explicit `#kqRoadAheadBubble[hidden]{display:none}` rule
   (and the same for the Dashboard button, defensively, even though it
   wasn't actually broken) so the hidden attribute always wins.

2. "In N lessons" off-by-one
   Root cause: the bubble computed its lesson count as
   `lessonNumber - currentLesson`, mixing a 1-indexed lesson number with
   a 0-indexed chapter index. A lesson that was actually 1 lesson away
   was reported as "in 2 lessons."
   Fix: now uses `chapterIndex - currentLesson` (both 0-indexed), which
   matches how the "Your journey ahead" list itself positions events —
   so the bubble's count and the list now agree. The event was always on
   the correct lesson in the list; only the bubble's stated count was off.

TESTING DONE
-------------
- node --check on road-ahead.js and version.js: clean.
- version.json validated as JSON.
- Re-ran the roadmap-engine.js Node harness from the v11.25.0 patch —
  event mapping unaffected (that logic wasn't touched).
- Verified the offset math directly with a small standalone script:
  chapterIndex=5, currentLesson=4 => offset=1 (previously would have
  been lessonNumber=6, currentLesson=4 => offset=2, the reported bug).
- NOT tested: an actual browser session (can't run one here). Please
  verify in-app that the bubble now disappears on leaving Journey and
  that its "in N lessons" text matches the same lesson's position in the
  "Your journey ahead" list.
