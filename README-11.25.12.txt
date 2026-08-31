Kakashi-Web 11.25.12

SOURCE BASIS
------------
Built from the repository's current main source, including the existing
11.25.7 lesson scheduler/checkpoint architecture and the current 11.25.11
version loader.

FILES IN THIS RELEASE
---------------------
version.js
patch-11.25.12.js
README-11.25.12.txt

WHAT CHANGED
------------
1. Lesson activity scheduling and roadmap signalling now share one registry.
   The roadmap does not infer an activity merely because assets exist.

2. Listening remains a normal lesson activity but is not promoted as a
   special roadmap headline.

3. Picture Matching remains a real lesson-integrated activity.

4. Kanji Gate is not advertised or inserted unless a real lesson adapter
   exists. This prevents the previous "Kanji Gate next" false promise.

5. Sentence Understanding and Audio Reflex Match are registered as lesson
   activity types, but are inserted only when their real renderer adapters
   are present as:
       window.KaishiLessonActivities.sentenceUnderstanding
       window.KaishiLessonActivities.audioReflex
   This is intentional: the patch never creates an unsupported skill card
   that could freeze a lesson.

6. Karuta, Theatre and Manga remain optional immersive side quests unless
   explicitly integrated by a real lesson adapter.

7. SRS Battle remains separate from the lesson and is not treated as a
   Lesson 5 milestone.

8. The Lesson 5 milestone is removed. The existing fifth-card checkpoint is
   now a silent automatic save with a short "Saving progress" bubble.
   The checkpoint dialog is suppressed without replacing next().

INSTALL
-------
Drop these files into the repository root, replacing version.js and adding
patch-11.25.12.js.

This release intentionally does not replace journey.js or the large
application source files.
