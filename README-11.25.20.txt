Kakashi-Web 11.25.20

Adds a manual Settings control:
  Learning plan -> Regenerate learning plan

Regeneration:
- Rebuilds the derived roadmap using current progress.
- Refreshes Journey path-ahead and Key Event rendering.
- Does NOT erase vocabulary progress, SRS history, mastery or lesson history.
- Shows a short confirmation notification.

Source-first:
- learning-plan-settings.js is a normal source module, not a numbered patch.
- version.js loads it as part of the normal source-module chain.
- No new numbered patch overlay is introduced.
- road-ahead.js is carried forward from 11.25.19.

Apply:
Replace the files in this ZIP at the repository root.
