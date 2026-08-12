KAISHI QUEST v11.8.1 — MICRO-PRACTICE FLOW & CAROUSEL ALIGNMENT
==================================================================

Copy the CONTENTS of this ZIP over the ROOT of the Kakashi-Web repository.

CRITICAL MICRO-PRACTICE FIX
---------------------------
v11.8.0 temporarily replaced #card.innerHTML for a Sensei micro-practice.
By the time that happened, the normal lesson had already rendered its next
card. Restoring a saved HTML string recreated the visuals but NOT the attached
JavaScript event handlers, so the lesson could appear normal and then get stuck.

v11.8.1 never touches the lesson card DOM.

The micro-practice is now a modal overlay:
  normal answer
  -> normal lesson progresses underneath
  -> Sensei micro-practice overlay
  -> learner answers
  -> Continue lesson
  -> overlay closes
  -> existing lesson card and handlers are still alive

DASHBOARD CAROUSEL
------------------
Japanese Journey and Japan Ready now:
- dynamically share the same height
- use safe top padding
- keep the active heading/icon fully visible
- hide the inactive neighbouring heading while it is only peeking
- show only a subtle neighbour edge on mobile
- keep both headings visible side-by-side on desktop

No Supabase migration is required.
