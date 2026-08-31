Kakashi-Web 11.25.13 release

IMPORTANT
---------
Do not apply 11.25.12. This release replaces the relevant existing source
files instead of adding another patch overlay.

Updated source files:
- version.js
- patch-11.25.7.js
- roadmap-engine.js

Fixes:
1. Fifth-card checkpoint:
   The checkpoint branch is changed at next() so it performs the existing
   saveMissionResume(), shows a brief "Saving progress" bubble, and returns
   through the normal next() flow. It does NOT suppress dialog.showModal().
   This is intended to remove the freeze seen at card 5.

2. Picture Matching:
   It is no longer injected into every lesson. It is scheduled on a cadence
   and only when the lesson has suitable picture assets.

3. Roadmap:
   The roadmap uses the same lesson scheduler for immersive activities.
   Listening is not a headline. Picture Matching is only shown when actually
   scheduled.

4. SRS Battle:
   Key Events are preserved as separate Journey events from PATH_MILESTONES.
   SRS Battle is not converted into a lesson activity and is not displaced by
   Picture Matching.

5. Lesson 5:
   There is no Lesson 5 milestone. The fifth-card point is only a save point.

6. Sentence Understanding / Audio Reflex:
   These are supported as lesson activity candidates only if a real
   KaishiLessonActivities adapter is present. The patch will never fabricate
   an unsupported lesson card.

INSTALL
-------
Replace the three existing files in the repository root with the files in
this ZIP. Do not add patch-11.25.12.js.

The old patch-11.25.12.js may remain in the repository, but version.js no
longer loads it. It can be deleted separately if desired.
