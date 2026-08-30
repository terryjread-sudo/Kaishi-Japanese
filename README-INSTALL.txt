Kaishi Quest v11.25.2 — Journey-ahead list wasn't resyncing with the bubble
=============================================================================

BASE VERSION: 11.25.1

Drop these 3 files into the repo root, overwriting the existing ones.
Nothing else from v11.25.1 changed.

FILES IN THIS ZIP
------------------
  roadmap-engine.js  (replace)
  version.js         (replace) — version bump to 11.25.2
  version.json        (replace) — changelog entry

WHAT WAS FIXED
---------------
Reported symptom: the Road Ahead bubble said "Picture Matching in 2
lessons," but that event never appeared on the corresponding lesson in
the "Your journey ahead" timeline list.

Root cause: "Your journey ahead" (renderJourneyPathAhead in app.js) is
rendered once, whenever you open the Journey screen (openJourney() calls
renderJourney() then show('journey')). If that happens before the
roadmap-engine.js / road-ahead.js script pair has finished loading —
very plausible right after the app opens — window.KaishiRoadmap doesn't
exist yet, so the list quietly renders with zero event badges. Nothing
ever told it to re-render once the roadmap data actually arrived.

The Road Ahead bubble never showed this bug because it's the *last*
script in the load chain (journey.js -> roadmap-engine.js ->
road-ahead.js) — by the time it's even capable of rendering anything,
the roadmap has already been computed. The two consumers weren't
actually inconsistent in what data they had access to; one of them just
had no way of knowing new data had arrived.

Fix: roadmap-engine.js's refresh() now calls
window.renderJourneyPathAhead() (if present) right after it finishes
computing the roadmap for the first time. This doesn't touch the
Journey renderer, completion state, or the daily route — it just
re-runs the same read-only list-rendering function app.js already
calls on every Journey visit, so the list can never end up stuck
showing a stale, roadmap-less render.

TESTING DONE
-------------
- node --check on roadmap-engine.js and version.js: clean.
- version.json validated as JSON.
- Re-ran the Node vm harness from the v11.25.0/11.25.1 patches: roadmap
  computation, milestone estimates, and per-lesson activity eligibility
  are all unaffected (only the notification-on-compute behaviour was
  added). Confirmed the new refreshPathAheadList() call is a no-op (via
  try/catch) when window.renderJourneyPathAhead isn't defined, so this
  is safe to load standalone or before app.js in any edge case.
- NOT tested: an actual browser session. If the mismatch persists after
  installing this, please check Admin Centre -> Roadmap / Lesson
  mapping logs — every lesson's event assignment (or lack of one) is
  now logged there and will show exactly which chapter index got which
  event, which is the fastest way to pin down anything further.
