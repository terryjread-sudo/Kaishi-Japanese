Kaishi Quest v11.25.0 — Rolling Roadmap, Floating Road Ahead & Admin Log Filters
==================================================================================

BASE VERSION: 11.24.0

Drop every file in this zip into the repo root, overwriting the existing
files of the same name, plus one new file (roadmap-engine.js).

FILES IN THIS ZIP
------------------
  version.js            (replace) — version bump to 11.25.0 + loads roadmap-engine.js
                                     before road-ahead.js
  version.json           (replace) — "What's new" changelog entry
  roadmap-engine.js      (NEW)     — computes the rolling 10-lesson roadmap
  road-ahead.js          (replace) — rewritten as two floating overlays
  app.js                 (replace) — renderJourneyPathAhead() widened to 10 lessons
                                     and now shows mapped events, when they exist
  release-manager.js     (replace) — Admin Centre log categories + window.kaishiLog
  index.html             (replace) — admin log filter dropdown markup added
  styles.css             (replace) — styles for the new event badge + log filter
  service-worker.js      (replace) — precache list corrected to the files actually
                                     used (journey.js, roadmap-engine.js, road-ahead.js
                                     — the old list referenced journey-v3.js /
                                     journey-v4.js, which are dead files nothing
                                     loads; road-ahead.js was missing from precache
                                     entirely)

WHAT CHANGED (functionally)
----------------------------
1. Roadmap engine (roadmap-engine.js, new)
   - Rolling 10-lesson horizon computed from the real lesson sequence
     (chapterWords / wordChapterCount / currentWordChapterIndex) — same
     source of truth the daily Journey already uses.
   - For each future lesson: topic, word count, completion state, and
     content-eligible activities (Picture Matching / Listening / Karuta /
     Kanji Gate), each checked against that lesson's ACTUAL words (scene
     art present? audio present? kanji present?) — never invented.
   - Manga / Conversation / Theatre are never bound to a specific lesson's
     words (they're library/selection screens, not direct launches) — they
     only ever appear as an estimated "upcoming milestone" event.
   - Milestone unlock estimates use the app's own cumulative-words-per-
     lesson assumption; anything that also depends on play-based metrics
     (listening attempts, tested answers, conversations completed) is
     labelled `estimated: true` with a `note` explaining the rest of the
     condition, rather than silently guessing it.
   - Regenerates only when the current lesson changes. Persists to
     meta.journeyRoadmap via the app's existing save() — no new storage
     system. Logs to Admin Centre under 'roadmap', 'lesson-mapping', and
     'activity' categories.
   - Does not touch dailyJourneyRoute, completion, retry, or ordering.

2. Road Ahead — now genuinely floating (road-ahead.js, rewritten)
   - Bottom-left bubble: reads the roadmap's first upcoming event (or a
     generic "N lessons mapped ahead" fallback) — position: fixed, safe-
     area aware, pointer-events: none (never blocks taps).
   - Top-left "← Dashboard" button: calls the app's existing show('home').
   - Both are pure overlays appended to document.body, not to #journey's
     DOM — the Journey renderer's own markup is completely untouched.
   - Visibility is driven by wrapping the real global show() function
     once (previous version wrapped a window.showScreen that doesn't
     exist in this codebase, so its visibility hook never actually fired).
   - No MutationObserver, no animation-frame polling loop.

3. "Your journey ahead" list (app.js, renderJourneyPathAhead — surgical edit only)
   - Horizon widened from 8 to 10 lessons.
   - Each list item now shows an event badge (🏆/🎧/🌄/🎴/🗺️ + label) when
     the roadmap engine has mapped one — gracefully absent if the engine
     hasn't loaded (e.g. slow network), so this never breaks the list.
   - The interactive Journey/Continue/retry/completion logic elsewhere in
     app.js is completely untouched.

4. Admin Centre diagnostics (release-manager.js + index.html)
   - Log entries now carry a filterable category group; a new dropdown
     (All / Offline / Roadmap / Lesson mapping / Activities / Journey /
     System) next to "Clear logs" filters the viewer live.
   - Existing offline-detection logging is unchanged in content, just
     grouped under "Offline".
   - kaishiLog is now exposed as window.kaishiLog so other feature
     scripts can log to the same viewer.

TESTING DONE
-------------
- `node --check` passed clean on every changed/new .js file (syntax).
- roadmap-engine.js's core logic was run standalone against a mocked
  30-lesson vocabulary set (mixed audio/art/kanji coverage) via Node's
  `vm` module: produced a correctly bounded 10-lesson roadmap, sane
  milestone estimates with correct `estimated`/`note` flags, correct
  per-lesson activity eligibility + reasons, correct topic-boundary
  detection, valid diagnostic log lines, and a valid persisted
  meta.journeyRoadmap object — no exceptions.
- index.html verified for balanced <select>/<label> tags around the new
  filter dropdown; version.json verified as valid JSON.
- NOT tested: an actual browser session against live app.js state
  (SRS progress, real vocabulary.json, real service worker install/
  activate cycle). Please run the manual checklist from the original
  implementation plan (Journey rendering, Road Ahead bubble, Dashboard
  button, Admin log filter, progression) before treating this as final.

WHY journey-v3.js / journey-v4.js WEREN'T TOUCHED
---------------------------------------------------
They exist in the repo but nothing in index.html or the dynamic loader
in version.js references them — journey.js is the actual active
renderer. Per the plan's own rule ("trace the actual code, don't assume
filenames"), they were left alone; only the service worker's precache
list (which incorrectly listed them) was corrected to precache the
files that are actually loaded.
