Kaishi Quest v11.16.6 release patch

Based on the live 11.16.5 Journey/Japan Ready patch state.

IMPORTANT VERSION CONTRACT
- version.js is the only application version file to edit for a release.
- APP_VERSION is the canonical variable expected by app.js and release-manager.js.
- KAISHI_VERSION is retained only as a backwards-compatible alias.
- Do not manually edit version.json, index.html script versions, or release-manager.js for the version bump; the repository release workflow handles generated/versioned output.

Journey/dashboard
- Journey remains the default single-path dashboard.
- Japan Ready remains a separate path and only becomes the active dashboard campaign after an explicit Japan Ready selection.
- Hides any legacy dashboard Practice/Activity Village entry if an older cached layout exposes it.
- Preserves the unified Journey timeline: several completed lessons behind, current lesson, several lessons ahead, and required side quests inserted inline when triggered.
- Side quests remain required reinforcement steps followed by a retry of the same lesson.

Japan Ready
- Keeps the existing Japan Ready implementation/content separate.
- Cheat-sheet audio now targets the exact .cheat-audio controls and reads their data-cheat-audio Japanese text directly.
- Speech is started directly from the pointer/click gesture and no longer depends on the campaign bridge being ready.
- Japanese voice selection is opportunistic; speech still works with the browser's default voice if a Japanese voice has not been enumerated.

Drop-in files
- version.js
- journey-v3.js
- japan-ready.js
