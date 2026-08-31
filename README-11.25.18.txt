Kakashi-Web 11.25.18

Release purpose
---------------
Fix the Journey timeline data model so major Key Events (especially SRS
Battle) are independent timeline items rather than lesson activities.

Source-first policy
-------------------
This release updates the original source files:
- roadmap-engine.js
- journey-key-events.js
- version.js

The existing checkpoint source patch remains because the current repository
still loads that implementation for the lesson checkpoint. It is updated
in-place as patch-11.25.17.js and is NOT a new patch layer.

Key Event model
---------------
- SRS Battle remains a PATH_MILESTONES milestone.
- It is exported through roadmap.keyEvents.
- It is NOT assigned to lesson.event.
- It is rendered AFTER its ordering-anchor lesson, as a sibling timeline item.
- The lesson before/after it therefore remains a normal lesson.
- The event's chapter index is an ordering anchor only, not ownership.

Immersive lesson model
----------------------
Lesson immersive activities remain in:
  lesson.contentActivities
  lesson.coreActivities

They are not converted into Key Events.

Checkpoint
----------
The known-good 11.25.17 checkpoint handler is retained:
  fifth card -> saveMissionResume() -> Saving progress bubble -> continue

No dialog suppression is used and next() is not replaced.

Files
-----
roadmap-engine.js
journey-key-events.js
version.js
patch-11.25.17.js
README-11.25.18.txt
