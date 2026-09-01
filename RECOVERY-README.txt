Kaishi Quest 11.25.31 recovery package

Authoritative restoration:
- app.js and index.html must be restored exactly from commit db970185a1ac232979aa2e1c84a38436125c6253 (11.25.0).
- version.js is bumped to 11.25.31.
- service-worker.js retains the 11.25.28 simplified service worker.
- journey.js retains the 11.25.29 Continue-route fix.
- 11.25.25–11.25.27 and 11.25.30 startup patches are intentionally not carried forward.

To restore app.js and index.html:
git checkout db970185a1ac232979aa2e1c84a38436125c6253 -- app.js index.html

Then copy the included files into the repo root.
