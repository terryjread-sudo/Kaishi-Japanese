Kaishi Quest v11.24.0 — Rolling Road Ahead patch

BASE:
- v11.23.0

FILES:
- version.js (replace)
- road-ahead.js (replace)

DO NOT replace journey.js.

CHANGE:
- Road Ahead now uses a rolling 10-lesson horizon.
- It searches only that horizon for real, route-defined special events.
- It never invents a named special event.
- If no event exists within the horizon, it reports that the next lessons are mapped out.
- As the learner progresses, the horizon naturally advances with them.
- The Journey renderer remains untouched; no MutationObserver or DOM polling is introduced.

NOTE:
This does not manufacture future special events. For an event to be advertised, the
existing Journey route must contain a future step anchored to a lesson within the
10-lesson horizon.
