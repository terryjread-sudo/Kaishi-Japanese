# Kaishi Quest v9.0.7 — First-launch Welcome

Upload the included files over v9.0.6.

## New behaviour

When Kaishi Quest launches and no Kaishi Quest data exists in local storage, a welcome overlay appears.

It advertises:

- Adventure Journey
- Live Conversations
- Japan Ready
- Travel Cheat Sheet
- Streaks and progress
- Learn Together

The learner can choose:

- **Start exploring**
- **Sign in to save progress**

Once dismissed, the overlay stores `kaishi_first_launch_seen=1` and will not appear again on that browser.

No additional Supabase SQL is required for v9.0.7.
