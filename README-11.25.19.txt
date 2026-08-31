Kakashi-Web 11.25.19

Fix: Road Ahead was only reading lesson.event. In 11.25.18, SRS Battle was
correctly moved to roadmap.keyEvents as an independent Journey event, but
Road Ahead was not updated to read that new collection.

11.25.19 changes:
- road-ahead.js now reads both lesson immersive events and independent keyEvents.
- SRS Battle can therefore appear in Road Ahead when it is within the horizon.
- Key Events remain independent of lessons.
- Road Ahead still prioritises immersive side quests and distinctive lesson
  activities over milestones, with topic changes as fallback.
- version.js is updated to 11.25.19.

Apply:
Replace the files in the ZIP at the repository root.

No new patch overlay is introduced by this release.
