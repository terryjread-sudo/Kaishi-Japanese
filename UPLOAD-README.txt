KAISHI QUEST v11.3.3 — KOTOBA COLOSSEUM POLISH
==================================================

Copy the CONTENTS of this ZIP over the ROOT of the Kakashi-Web repository.

OVERWRITE / ADD
---------------
index.html
kotoba-activity.js
battle-ui-patch.js          (new)
release-manager.js
service-worker.js
version.json
media/battle-listen/*.png   (transparent-background replacements)

CHANGES
-------
- Kotoba Colosseum now sits inside the normal Activity Village activity grid
  rather than appearing as a large separate card above it.
- Its village-map launcher is reduced to a normal landmark-sized label.
- Black rectangular backgrounds have been removed from the party and monster
  sprites.
- Once an answer is scored, the answer choices are replaced in-place by the
  normal result/word/Next Turn feedback box. No scrolling down to Continue.
- Back to Activity Village and the battle-summary exit both stop/reset BGM.
- Full version/cache bump to v11.3.3.

No Supabase/database migration is required.
Learner progress/localStorage/cloud progress is not cleared.
