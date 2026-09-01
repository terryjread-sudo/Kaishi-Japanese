Kakashi-Web 11.25.25

Drop-in source release. Replace the files in the repository root with the files in this ZIP.

Fixes:
- Restores the normal core deck startup sequence.
- Adds a minimal version.js before app.js; it contains version state only and cannot interfere with deck boot.
- Bumps APP_VERSION/KAISHI_VERSION to 11.25.25.
- Prevents duplicate init races with a coreInitialised guard.
- Dispatches kaishi:core-ready only after all core deck data has loaded; derived Journey rendering then proceeds.
- Retains the 11.25.23 Journey/timeline behaviour already integrated in app.js, including scroll-state protection and standalone event handling.
- Strengthens the Journey scroll guard without adding a patch overlay.
- Retains Settings reset -> export-before-reset flow.
- Retains Journey-aware owner/admin controls.
- Updates first-party cache-busting to 11.25.25.

No additional numbered patch file is included.
