Kaishi Quest v11.8.36 — Stable Update & Bonsai Fit

DROP-IN UPDATE
Replace these files in the ROOT of Kakashi-Web:
- release-manager.js
- bonsai-progress.js
- service-worker.js
- version.json

WHAT THIS FIXES

1. BONSAI IMAGE
The compact v11.8.35 layout made the sprite viewport too narrow on phones.
v11.8.36 keeps the card compact but gives the tree artwork enough horizontal
space so the stage image is not cut off.

2. STRAY "TAP FOR STATUS" TEXT
The v11.8.35 helper label could escape the card and appear near the page
header. It has been removed. The entire bonsai card is still tappable/clickable
(and keyboard accessible) to open the same condition explanation.

3. VERSION / REFRESH STABILITY
The repository's older app shell still registers service-worker.js using its
legacy APP_VERSION query. v11.8.36 now explicitly re-registers the service
worker with ?v=11.8.36 after the shell's load handler, so the current release
wins and remains pinned after refresh.

The release manager also rewrites the visible document title and version badge
to v11.8.36 on every load.

RETAINED FROM PREVIOUS RELEASES
- Reading-from-Meaning incorrect answers pause for review until Continue.
- Kaishi Theatre: Normal / Slow / Extra slow synchronized playback.
- Bonsai card itself opens the condition explanation.

No learner progress, mastery, streak, cloud data or Theatre content is changed.
