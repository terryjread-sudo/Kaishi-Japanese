# Kaishi Quest v8.3.0 patch

This is a small changed-files patch for learning-card reports and the owner Admin area.

## Upload these files

Upload or replace the files in the repository root:

- `app.js`
- `index.html`
- `styles.css`
- `version.json`
- `reporting.js`

Keep `supabase-learning-reports.sql` for the one-time Supabase setup. It does not need to be hosted by the website.

## Supabase setup

1. Sign in to Kaishi Quest once using the GitHub account `terryjread-sudo`.
2. Open the Supabase project.
3. Open **SQL Editor**.
4. Create a new query.
5. Paste the complete contents of `supabase-learning-reports.sql`.
6. Run the query.
7. Confirm the final diagnostic query shows your GitHub login with `is_admin = true`.

## Behaviour

- The Report issue button appears only for signed-in users.
- A user can submit at most three reports per UTC day.
- Only the registered administrator can read, update, export or delete reports.
- The Admin button appears in Settings only after Supabase confirms administrator access.
- CSV export can mark only the exported report IDs as reviewed, preventing them from appearing in the default unreviewed export again.
