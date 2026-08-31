Kakashi-Web 11.25.22

Fixes confirmed from the live 11.25.21 Journey:

1. Lesson completeness
- A lesson whose words have all been introduced is treated as complete for the Journey display.
- The Journey no longer leaves a completed lesson visually stuck at an old low percentage such as 39%; it displays 100% once the lesson is complete.

2. Lesson progression
- If Lesson 1 is complete but the daily route has not yet generated the next chapter step, the source module creates the missing next lesson route step.
- Lesson 2 is then promoted to the current lesson.
- The Start Lesson 2 action targets Lesson 2's exact word IDs rather than falling back to the broader topic queue.

3. Standalone SRS / Key Event layout
- Key Events remain independent timeline items.
- They are inserted inside the unified timeline rather than as children of the outer flex timeline container.
- The outer timeline is forced to a single-column block layout so SRS Battle cannot create a second column or break the mobile view.

Source-first
- journey-source-fixes.js is a normal source module, not a numbered patch overlay.
- version.js is updated to load it.
- journey-key-events.js is updated at its source.
- Existing patch-11.25.17.js and learning-plan-settings.js remain untouched.

Replace these three files at the repository root:
- version.js
- journey-key-events.js
- journey-source-fixes.js (new)
