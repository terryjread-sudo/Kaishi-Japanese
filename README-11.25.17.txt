# Kaishi Quest v11.25.17 drop-in patch

Replace the existing `version.js` and add `patch-11.25.17.js` to the repository root.

Changes:

- Checkpoint 5 no longer opens the save/continue dialog.
- Progress is automatically saved.
- A brief "Saving progress" bubble is shown.
- The lesson immediately advances to the next card.
- The duplicate upcoming immersive-activity notice in the Journey timeline is hidden; the Road Ahead floating notification remains.
- A skill/card is promoted to 100% after 3 attempts where all 3 were correct.

The patch deliberately replaces `showMissionCheckpoint()` itself. It does not open a dialog and then attempt to suppress it.

Version: 11.25.17
