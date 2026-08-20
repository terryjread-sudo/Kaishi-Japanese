Kaishi Quest v11.8.35 — Theatre Speed & Compact Bonsai

This drop-in BUILDS ON the previous v11.8.34 reading-review release.

Replace these files in the ROOT of Kakashi-Web:
- release-manager.js
- bonsai-progress.js
- service-worker.js
- version.json

THEATRE
- Adds Normal, Slow and Extra slow controls.
- Slow changes both speech rate and the Theatre timeline, so camera cuts,
  character speech animation and the progress bar stay synchronized.
- The selected speed is remembered locally for later Theatre performances.
- Other Japanese audio activities keep their normal existing speed.

BONSAI
- The separate information icon is hidden.
- Tap/click the Bonsai card itself to open the existing condition explanation.
- Keyboard users can press Enter or Space on the card.
- The card is substantially shorter, particularly on mobile.
- No learning/growth/streak calculations were changed.

READING REVIEW
- Retains the v11.8.34 fix where an incorrect Reading-from-Meaning answer
  remains visible until the learner taps Continue.

CACHE/UPDATE
- service-worker.js and version.json are bumped to v11.8.35.
