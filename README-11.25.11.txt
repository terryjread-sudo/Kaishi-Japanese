Kakashi-Web 11.25.11 — source release

This ZIP contains ONLY the files changed/added for this release.

Replace/add these files at the repository root:
  1. version.js
  2. roadmap-engine.js
  3. road-ahead.js
  4. journey-key-events.js (new)

Main changes:
- Key milestones such as SRS Decay Battle are represented as first-class Journey events.
- Milestones are separate from the lesson that follows them.
- Listening is no longer promoted as the roadmap headline because it is routine.
- Distinctive activities such as Picture Matching, Karuta and Kanji Gate can be highlighted.
- Road Ahead follows the same priority.
- Version is 11.25.11.

Important:
- This release does not replace journey.js; it augments the existing Journey renderer with a small
  source module for key-event presentation.
- It does not alter lesson ordering, SRS scoring, mastery rules, or lesson execution.
