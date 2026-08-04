# Kaishi Quest v8.3.1 patch

This small patch fixes daily reviews reappearing after a page refresh.

## Upload these files to the repository root

- `app.js`
- `index.html`
- `version.json`

## Fixes

- Preserves today's daily review plan when Supabase progress is restored.
- Immediately sends completed answer state to cloud sync.
- Does not create another daily allocation after today's assigned reviews are complete.
- A new plan is created only after the local calendar date changes.

No Supabase SQL changes are required for v8.3.1.
