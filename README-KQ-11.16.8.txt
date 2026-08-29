Kaishi Quest v11.16.8 — Journey Timeline Data Fix

Drop-in patch based on the current 11.16.7 Journey patch.

Files:
- version.js
- journey-v3.js

What this fixes:
- The Journey timeline is now built from the full persistent lesson/chapter curriculum,
  rather than dailyJourneyRoute, which intentionally contains only today's/current lesson.
- Shows up to 3 completed lessons behind the current point and 4 lessons ahead.
- Keeps the current lesson in the same continuous timeline.
- Side quests and retries stored in the live Journey route are inserted immediately after
  the lesson they belong to.
- Does not manufacture history from sessionHistory; completed lesson status comes from
  the lesson/chapter mastery model.
- Keeps the existing Journey launch route and learning engine intact.
- Bumps the single-source version contract to 11.16.8.

Japan Ready is not structurally changed by this patch.
