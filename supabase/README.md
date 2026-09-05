# Kaishi Japanese cloud setup

The application is already configured with the project's public Supabase URL
and publishable key. Never commit the GitHub OAuth client secret, database
password, or a Supabase secret/service-role key.

## One-time Supabase setup

1. In **Authentication → URL Configuration**, set the Site URL to:
   `https://www.kaishi.uk/`
2. Add these Redirect URLs:
   - `https://www.kaishi.uk/`
   - `https://kaishi.uk/` (only while it redirects to the canonical `www` address)
   - `https://terryjread-sudo.github.io/Kaishi-Japanese/` (legacy GitHub Pages address)
   - `http://localhost:8000/`
   - `http://127.0.0.1:8000/`
3. In **Authentication → Providers → GitHub**, enable GitHub and save the
   OAuth client ID and secret in Supabase only. The GitHub OAuth app callback URL
   remains `https://wcnsvwbhfstgadqnaarr.supabase.co/auth/v1/callback`; do not
   replace it with the Kaishi domain.
4. Open **SQL Editor**, paste the complete contents of
   `migrations/20260731_cloud_progress.sql`, and run it once.
5. Then run `migrations/20260731_profile_streak_rescue.sql` to add profile
   character choices and streak display. If this is a fresh installation, it is
   still safe to run the second migration after the first.
6. Run `migrations/20260817_progression_avatars.sql` to allow the Harajuku Girl,
   Harajuku Guy, and Izakaya Cook keys in saved cloud and community profiles.

The migration creates private progress storage, public opt-in leaderboard
entries, Row Level Security policies, and the learner-controlled cloud-account
deletion function.

## Security model

- Guest progress remains in the browser's local storage.
- Signed-in users can read and write only their own progress row.
- Anyone can read leaderboard rows only when the owner has opted in.
- The leaderboard never exposes per-word learning progress or settings.
- Deleting a cloud account removes the Supabase Auth user and cascades to both
  Kaishi Japanese data tables while leaving local browser progress untouched.
