Kaishi Quest v11.25.5 — Lesson 2 stuck locked, and a silent-do-nothing Conversation chip
==========================================================================================

BASE VERSION: 11.25.4

Drop these 4 files into the repo root, overwriting the existing ones.

Both bugs fixed here are PRE-EXISTING app logic, unrelated to the Road
Ahead / roadmap feature work from v11.25.0-11.25.4. Neither is touched
by anything the roadmap engine or floating overlays do.

FILES IN THIS ZIP
------------------
  journey.js     (replace)
  app.js         (replace)
  version.js     (replace) — version bump to 11.25.5
  version.json   (replace) — changelog entry

BUG 1: Lesson 2 stays greyed out after finishing lesson 1
------------------------------------------------------------
Root cause: journey.js's currentChapter() determines the current lesson
two ways: (a) look at the daily route's steps for one that isn't
completed yet, or (b) if none is found (e.g. right after the route's
single lesson step was just marked complete, before a new one is
generated), fall back to scanning progress data directly to guess which
chapter is "current."

That fallback checked `Number(p.reps || 0) > 0` — but the real progress
model doesn't have a `reps` field anywhere. The app actually tracks
practice attempts under `p.skills[skill].attempts` (see
wordPracticeCount in app.js). So the fallback was almost entirely
relying on `p.stage > 0`, which apparently wasn't enough to reliably
detect "this chapter's words have been introduced," causing it to get
stuck reporting the same chapter as current indefinitely.

Fix: the fallback now calls the app's own authoritative
currentWordChapterIndex() (already used everywhere else — chapterStats,
chapterUnlocked, the daily route generator all agree with it) instead
of maintaining a second, independently-drifting implementation. The old
scan is kept as a last-resort fallback only if that function is
somehow unavailable.

BUG 2: "Conversation · <title>" chip in the session preview does nothing
---------------------------------------------------------------------------
Root cause: showJourneySessionPreview() in app.js finds a matching
conversation purely by content — "does any turn in this conversation
use one of this session's words" — with no check for whether that
conversation is actually unlocked. startConversation() correctly
refuses to open a locked conversation (conversations unlock in order,
each requiring the previous one completed) — but it does so by
silently returning, with no feedback to the person who tapped it.

Fix: the matching search (conversations.find(...)) now also requires
conversationUnlocked(itemIndex) to be true, so only a conversation that
can actually be opened is ever offered as a clickable chip.

TESTING DONE
-------------
- node --check on journey.js and app.js: clean.
- version.json validated as JSON.
- Traced both root causes by reading the actual functions involved
  (currentChapter/chapterFromId in journey.js; showJourneySessionPreview/
  startConversation/conversationUnlocked in app.js) rather than guessing.
- NOT tested in an actual browser / against real save data. Please
  confirm: (1) lesson 2 becomes the current/selectable lesson right
  after fully completing lesson 1's words+reviews, and (2) a
  Conversation chip only ever appears when it's actually unlocked, and
  opens correctly when tapped.
