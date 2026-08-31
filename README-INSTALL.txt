Kaishi Quest v11.25.6 — Next lesson now unlocks immediately, not the following day
======================================================================================

BASE VERSION: 11.25.5

Drop these 3 files into the repo root, overwriting the existing ones.

FILES IN THIS ZIP
------------------
  app.js         (replace)
  version.js     (replace) — version bump to 11.25.6
  version.json   (replace) — changelog entry

CONFIRMED INTENDED DESIGN (from discussion)
---------------------------------------------
- Once a lesson has been completed at least once, the NEXT lesson
  should be available straight away, same day.
- Mastery of a lesson's words (repeated practice, spaced review) is
  meant to pace out day-to-day. That's already how it works, via each
  word's own SRS `due` timestamp set in grade() — nothing needed there.

WHAT WAS ACTUALLY WRONG
-------------------------
ensureDailyJourneyRoute() cached the daily route keyed only on
`date === day()` (plus a couple of other invalidation keys unrelated to
progress). So even though currentWordChapterIndex() correctly flips to
the next chapter the moment the current one hits chapterStats().complete
(introduce + review each word twice — achievable in one sitting), the
CACHED route object kept serving the old, now-fully-completed lesson
until the calendar date actually rolled over. That's what was making
lesson 2 (and beyond) look unavailable same-day, and it's separate from
(and was masking/conflicting with) the v11.25.5 journey.js fix, which
only corrected journey.js's own timeline, not this underlying route
generator that the rest of the app (the daily-mission UI) still reads.

THE FIX
--------
ensureDailyJourneyRoute()'s cache-hit condition now also requires
`meta.dailyJourneyRoute.chapter === currentWordChapterIndex()`. Any
time the live current chapter has moved past what's cached, it
regenerates immediately — same day, no waiting for `day()` to change.
Date is still tracked and still triggers regeneration on its own (e.g.
first open of a new day), this just adds progress advancement as an
equally valid trigger.

This also means journey.js's v11.25.5 fix and this route generator now
agree in every case, not just after a day rolls over — the "Your
Journey" timeline and the app's own daily-mission UI will both reflect
the new current lesson the moment it's actually unlocked.

NOTED FOR A FUTURE PATCH (not in this zip)
---------------------------------------------
Per the same conversation: conversation/listening-style immersive
activities should unlock based on vocabulary readiness (most/all of an
activity's target words already introduced), not purely sequential
completion of earlier activities as conversationUnlocked() currently
requires. Not implemented here — flagged for the next patch.

TESTING DONE
-------------
- node --check on app.js: clean.
- version.json validated as JSON.
- Traced the exact cache-key logic in ensureDailyJourneyRoute() and
  confirmed chapterStats()/chapterNaturallyUnlocked()/
  currentWordChapterIndex() have no date dependency of their own — the
  date-only cache key was the sole source of the day-delay.
- NOT tested in an actual browser / against real save data. Please
  confirm: completing a lesson's words+reviews makes the next lesson
  available immediately, in the same session, without needing to wait
  until the next day.
