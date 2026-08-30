Kaishi Quest v11.23.0 — Corrected Road Ahead patch

BASE:
- v11.22.0
- Commit: 1ab2a412cf0ace7a77a68b57aeec875e18a9fcac

IMPORTANT:
- This patch is intentionally additive.
- It does NOT replace journey.js from v11.22.0.
- It preserves the v11.22.0 activity integration and stable Journey renderer.
- Replace only:
    1. version.js
    2. add road-ahead.js
- Keep all other v11.22.0 files unchanged.

FEATURE:
- Adds a compact "What's ahead" indicator beneath the Journey.
- Finds the next unfinished special activity/milestone from the existing Journey route.
- Falls back to a topic boundary or progress checkpoint.
- Shows the number of lessons remaining.
- Does not add a second Journey renderer.
- Does not use MutationObserver or DOM polling.
- Re-renders only after relevant Journey navigation.

VERSION:
11.23.0
