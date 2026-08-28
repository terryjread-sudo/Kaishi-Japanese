# Kaishi Quest — Version Bump & Release Guide

As of v11.11.1, the version number lives in **one file**: `version.js`.
Nothing else needs the version number edited by hand.

## 1. Bump the version

Edit `version.js`:

```js
var APP_VERSION='11.11.2';
```

That's it for the number itself. `version.js` loads before every other
script (see the first `<script>` tag in `index.html`), so:

- **`app.js`** reads it as `APP_VERSION` — used for the header/about-screen
  badge (via `release-manager.js`), cache-busting on image/audio URLs, and
  the "What's new" / update-check logic.
- **`release-manager.js`** reads it as `window.APP_VERSION` and uses it for
  `document.title` and `#versionBadge`, kept in sync automatically on load.
- **`cloud.js`**, **`learning-ui.js`**, **`adaptive-reinforcement.js`** read
  it the same way for their own cache-busting / diagnostics needs.
- **`service-worker.js`** pulls it in with `importScripts('./version.js')`
  at the top of the file, and uses it to name its caches
  (`kaishi-shell-${VERSION}` etc.) — a version bump still correctly forces
  browsers to fetch fresh files and drop old caches on `activate`.
- **`index.html`**'s script tags carry no version query string at all —
  that's no longer needed for correctness, since the service worker already
  fetches scripts network-first and rotates its whole cache bucket on every
  version change. **You never need to touch `index.html` for a version
  bump.**

## 2. Describe the release (optional but recommended)

Edit `version.json` — this drives the "What's new" dialog shown on first
load after an update. It is **not** used to gate the version number
anymore (that's `version.js`'s job); `version.json`'s own `"version"` field
is just documentation for humans reading the file — keep it in sync, but
it no longer decides the app's real version.

```json
{
  "version": "11.11.2",
  "released": "2026-08-28",
  "title": "Short release title",
  "changes": [
    "First change, in one sentence.",
    "Second change, in one sentence."
  ]
}
```

## 3. Update the changelog comment (optional but recommended)

`release-manager.js` has a running changelog in its header comment block —
add a `- vX.Y.Z ...` line describing what shipped, for future reference.

## Deployment check

Push whichever files actually changed for the feature/fix itself, plus:
- `version.js` (always — this is the version bump)
- `version.json` (if you want the "What's new" dialog to describe the release)
- `release-manager.js` (if you added a changelog comment line)

You do **not** need to touch `app.js`, `service-worker.js`, or `index.html`
just to bump the version — only edit those if the release also changes
their actual behavior.

## Why this changed

Before v11.11.1, the version number was duplicated across `app.js`,
`service-worker.js`, `release-manager.js`, `version.json`, and every
`<script src="...?v=...">` tag in `index.html` — five-plus places to edit
by hand. Missing even one (as happened with the very release that
introduced this problem) meant part of the app kept announcing or serving
an old version. `version.js` removes that failure mode by being the only
place the number is ever written.
