Kaishi Quest v11.22.0 — Activity-rich learning path

BASE: v11.21.0

Replace/add ONLY these files:
  1. app.js                 replace the existing app.js
  2. version.js             replace the existing version.js
  3. data/activity-expansion-v11.22.json   add this new file

What this patch does
--------------------
- Keeps the stable single Journey renderer from v11.21.0.
- Adds content-aware immersive activity options to the Journey session preview.
- Direct lesson activities remain the existing learning-engine skills: listening,
  reading, production/recall, picture and sentence/context when supported.
- If a suitable conversation is available for the current lesson words, the
  preview offers a direct launch into that conversation. Completing it returns
  to the Journey.
- If suitable Manga exists, the preview offers the Manga gateway. The existing
  Manga library/selection remains intact; after the chosen story, the learner
  can return to the Journey.
- Immersive activities are optional and are never forced when suitable content
  does not exist.
- Adds 10 new conversation scenarios and 10 new grammar lessons through a
  separate data file, roughly doubling the current conversation and grammar
  catalogues without touching the existing content files.
- Listening and production do not have a finite catalogue of 'entries': they are
  generated dynamically from vocabulary, so their useful expansion comes from
  adding more varied prompts/selection logic rather than duplicating records.
- Activity Village remains out of the learning path and is not used by this
  feature.

Activity routing audited
------------------------
Manga: selection gateway -> selected story -> story summary -> replay/library.
Conversation: selection library -> selected conversation -> summary -> replay/library.
Theatre: selection library -> selected scene -> five-act experience -> summary/library.
Picture: direct session -> question loop -> normal study session completion.
Karuta: direct game -> card loop -> summary -> Journey practice when exited.
Battle: direct decay-review session -> battle summary -> games/weak-word review.

This patch does not force Karuta/Battle into the core lesson path. They remain
better suited to optional/side-quest use.

Validation
----------
- app.js: node --check PASS
- version.js: node --check PASS
- activity-expansion-v11.22.json: python JSON validation PASS
