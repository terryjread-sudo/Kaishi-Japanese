# Kaishi Quest v9.0.11 — Dismiss Fix

Upload these files over v9.0.10.

This patch fixes both dismiss controls:

- the X on the dashboard friend motivation strip;
- Dismiss on accepted-friend notifications in the notification popup.

Both now use persistent delegated click handling, remove the item immediately, and store the dismissal in local storage.

No Supabase SQL is required.
