Kakashi-Web 11.25.21

Fixes lesson completeness plateauing around low percentages (for example,
Lesson 1 remaining around 39% after repeated successful reviews).

Root cause:
The earlier 11.25.9 completeness model existed as a separate historical patch
but was not loaded by the current source chain. The live Journey renderer could
therefore continue using its old equal-weight skill average.

11.25.21:
- Integrates the evidence-based completeness model into the existing
  patch-11.25.17 source that the current loader actually executes.
- Meaning + production are treated as core recall evidence.
- Listening/reading support the score without being able to block completion
  indefinitely.
- Strong repeated recall can close the remaining gap.
- Perfect core lesson performance reaches 100% after the intended 2 strong
  consolidation reviews; developing lessons have up to 4.
- Refreshes Journey after saves/answer events.
- Retains the known-good automatic fifth-card save-and-continue checkpoint.
- No new numbered patch overlay is introduced; patch-11.25.17 is updated in
  place because it is already the active legacy source loaded by the app.

Files:
- version.js
- patch-11.25.17.js
- road-ahead.js
- learning-plan-settings.js
- README-11.25.21.txt
