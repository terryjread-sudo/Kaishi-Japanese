# Kaishi Quest — Version Bump & Release Guide

To release a new version of Kaishi Quest, ensure the version number is updated in the following **5 core locations**:

## Core Version Locations

1. **`release-manager.js`**
   - Line 22: `const CURRENT_VERSION = '11.8.46';`
   - Update header comment changelog at top of file.

2. **`app.js`**
   - Line 3: `const APP_VERSION = '11.8.46';`

3. **`service-worker.js`**
   - Line 3: `const VERSION = '11.8.46';`

4. **`version.json`**
   - `"version": "11.8.46"`
   - Add title and list of changes for the release.

5. **`index.html`**
   - `<title>Kaishi Quest • v11.8.46</title>`
   - `<span id="versionBadge" ...>v11.8.46</span>`
   - Script & stylesheet query params: `?v=11.8.46` (e.g. `app.js?v=11.8.46`, `styles.css?v=11.8.46`).

---

## Deployment Check

After bumping versions, push all updated files:
- `release-manager.js`
- `app.js`
- `service-worker.js`
- `version.json`
- `index.html`
- `styles.css`

`release-manager.js` will automatically enforce `v${CURRENT_VERSION}` on `#versionBadge` and `document.title` in real time on application load.
