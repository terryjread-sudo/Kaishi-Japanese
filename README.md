# Kaishi Quest v8.3.3 patch

## Upload these files to the repository root

- `app.js`
- `index.html`
- `cloud.js`
- `service-worker.js`
- `version.json`

## Image performance

Common graphics and viewed learning images are cached locally. Images for the next three cards are preloaded while the current card is displayed. The runtime image cache is limited to roughly 350 images.

The first visit after uploading installs the service worker. Repeated images and later visits should load faster.

## Cloud conflict fix

Routine refreshes, tab changes and token refreshes no longer repeatedly open the progress-choice dialog. The app records a fingerprint after each successful sync and automatically keeps whichever side changed. The chooser remains for genuine independent conflicts and manual **Sync or restore now**.

No Supabase SQL changes are required.
