Kaishi Quest 11.25.27

Source-first drop-in release.

Changes:
- Removes ALL fetch interception from version.js.
- Restores version.js to a simple bootstrap/version-state role.
- Makes the application's runtime APP_VERSION derive from window.KAISHI_VERSION,
  avoiding a second hard-coded application version in app.js.
- Replaces all stale 11.3.0 references in index.html, including script/style
  cache-busters and the visible title/version badge.
- Keeps the existing app.js timeline/Journey functionality from the supplied
  latest source.
- No additional numbered patch file.

Replace:
- index.html
- app.js
- version.js
