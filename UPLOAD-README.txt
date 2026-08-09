KAISHI QUEST v11.3.0 — KOTOBA COLOSSEUM UPDATE
===============================================

Extract/copy the CONTENTS of this ZIP over the ROOT of the existing
Kakashi-Web repository, preserving the folder structure.

OVERWRITTEN FILES
-----------------
supabase-config.js
  - Keeps the existing public Supabase configuration unchanged.
  - Hides the village cat.
  - Adds Kotoba Colosseum to Games.
  - Adds the battle screen and loads battle-listen.js.
  - Updates the displayed release version to v11.3.0.

service-worker.js
  - Bumps the app/cache version from 11.2.3 to 11.3.0.
  - Creates fresh shell/image cache names.
  - Adds battle-listen.js to the shell cache.
  - Removes the old village-cat asset from the shell precache list.

version.json
  - Announces v11.3.0 and the Kotoba Colosseum release notes.

NEW FILES
---------
battle-listen.js
media/battle-listen/kitsune.png
media/battle-listen/kappa.png
media/battle-listen/tanuki.png
media/battle-listen/karakasa.png
media/battle-listen/party-warrior.png
media/battle-listen/party-mage.png
media/battle-listen/party-guardian.png
media/battle-listen/arena-backdrop.jpg
media/battle-listen/bgm.mp3

NOT CHANGED
-----------
app.js
index.html
styles.css
vocabulary/SRS data
database schema

The existing SRS Decay Battle remains available so you can compare it with
Kotoba Colosseum before deciding whether to replace it.
