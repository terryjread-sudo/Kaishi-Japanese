# Kaishi Quest v9.0.4 — Unified Study Modes dashboard

Upload these changed files to the repository root:

- `app.js`
- `index.html`
- `styles.css`
- `cloud.js`
- `service-worker.js`
- `japan-ready.js`
- `version.json`

## Main changes

- Fixed the blank page from the Study Modes Journey button.
- The Journey dashboard button now runs the same `continueJourney()` setup as the original working button.
- Renamed **Choose your adventure** to **Study modes**.
- Made the Study Modes card match the width of the dashboard.
- Embedded the existing Current Topic and Teacher recommendation experience directly into the Journey preview.
- Added a matching Aiko-led Japan Ready preview.
- Removed the duplicate standalone Journey panel.
- Added a short fade when switching modes.

No Supabase SQL changes are required.
