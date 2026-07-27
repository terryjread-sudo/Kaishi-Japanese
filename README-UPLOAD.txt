# Kaishi Quest v4.2.0 — Mnemonic Review Workflow

This upload contains 26 files total, safely below the 100-file phone upload limit.

## Upload
Upload every file in this folder to the repository root, replacing files with the same names.

## What changed
- The original 20-card concept sheet was split into 20 individual WebP images.
- All 20 are marked `imageStatus: "approved"` because they were previously accepted.
- Mnemonic Studio can now:
  - edit meaning, sound mnemonic and story;
  - approve an image for the learner-facing app;
  - flag an image as `needs-regeneration`;
  - record regeneration instructions;
  - filter cards by review status;
  - export the complete JSON;
  - export only the regeneration queue.
- The main app displays enhanced artwork only when `imageStatus` is exactly `approved`.
- A card flagged for regeneration falls back to the app's existing Memory Scene.

## ChatGPT regeneration workflow
After exporting and uploading `visual-mnemonics.json`, ask ChatGPT to inspect the repository for:
`"imageStatus": "needs-regeneration"`

The `reviewNote` field tells ChatGPT what needs changing. After replacement artwork is generated, its image file and JSON entry can be updated, then reviewed again in Mnemonic Studio.

No AI is used by the finished learner-facing app.
