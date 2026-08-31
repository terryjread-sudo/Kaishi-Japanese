# Kaishi Quest v11.25.8 patch

**Base:** v11.25.7

## Install

Drop these two files into the repository root, replacing the existing `version.js` and adding/replacing `patch-11.25.8.js`:

- `version.js`
- `patch-11.25.8.js`

Keep the existing v11.25.7 files in place unless `patch-11.25.8.js` is replacing the patch file you were using for the checkpoint UX.

## Checkpoint UX fix

The v11.25.7 approach tried to suppress the checkpoint dialog after it had been opened. v11.25.8 does **not** do that.

Instead, it patches the lesson's `next()` checkpoint branch itself:

1. The existing checkpoint condition is still reached.
2. `saveMissionResume()` runs automatically.
3. A small, non-blocking **Saving progress** bubble appears for about 1.6 seconds.
4. The checkpoint decision dialog is never opened.
5. The lesson continues immediately.
6. Normal exit/resume protection remains unchanged.

The patch searches the runtime `next()` function for the actual `CHECKPOINT_INTERVAL` branch and replaces only that branch's UI action with automatic save + notification. It fails closed if that expected checkpoint branch cannot be identified.

## Version

`11.25.8`
