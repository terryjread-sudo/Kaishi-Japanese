Kaishi Quest v11.25.4 — Roadmap events now show on the actual Journey card timeline
=====================================================================================

BASE VERSION: 11.25.3

Drop these 4 files into the repo root, overwriting the existing ones.

FILES IN THIS ZIP
------------------
  journey.js          (replace)
  roadmap-engine.js   (replace)
  version.js          (replace) — version bump to 11.25.4
  version.json        (replace) — changelog entry

WHAT WAS FIXED
---------------
Reported: the Road Ahead bubble says "Picture Matching in 1 lesson," but
the same event doesn't appear on the timeline.

Root cause: there are two different "future lessons" UI elements in
this app —
  1. journey.js's card-based "Your Journey" timeline (Continue/Preview
     buttons, the one visible in the screenshot) — this is what the
     user actually looks at and calls "the timeline."
  2. app.js's separate, less visible "#journeyPathAhead" compact list.

The v11.25.0 patch only added the event badge to #2. journey.js's own
renderer (#1) was deliberately left untouched at the time, per the
original implementation plan's instruction not to rewrite the existing
Journey renderer. That was the right call for anything structural, but
it also meant the one list people actually look at never got the badge.

Fix: nodeHTML() in journey.js — the function that builds each lesson's
card — now looks up window.KaishiRoadmap.get() for future-lesson cards
only, and if that chapter has a mapped event, renders a small badge
inside the card (after the existing title/detail, before the existing
action buttons). Nothing about the card's classes, buttons, retry
logic, or the timeline's single-DOM-write render() function changed —
this is the same category of change as the original #journeyPathAhead
badge: additive only, no new render loop, no observer.

journey.js also now exposes window.KaishiJourneyRender (its internal
render function) so roadmap-engine.js can trigger a resync of this
timeline too, the same way it already does for the compact list — this
covers the case where Journey was opened before the roadmap had
finished its first computation.

TESTING DONE
-------------
- node --check on journey.js and roadmap-engine.js: clean.
- version.json validated as JSON.
- Re-ran the Node vm harness for roadmap-engine.js: unaffected (the new
  window.KaishiJourneyRender call is a defensive no-op when undefined,
  confirmed in the mock environment where it isn't defined).
- NOT tested in an actual browser. Please confirm the badge now shows
  on the correct future lesson's card in "Your Journey," matching what
  the Road Ahead bubble reports.
