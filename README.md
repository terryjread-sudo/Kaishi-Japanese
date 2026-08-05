# Kaishi Quest v9.0.8 — Corrected Social Release

Use this package to upgrade from the v9.0.7 release already installed.

## Upload these files

Upload the included website files over the existing repository files.

## Supabase update

You already ran the original `supabase-friends.sql`, which is fine.

Now run:

`supabase-v908-corrected-social.sql`

Run it once in the Supabase SQL Editor.

## Corrected friend flow

- The GitHub username friend-search form has been removed.
- Select another learner directly from the Community leaderboard.
- Their profile offers Add friend, Accept, Decline, Request sent or Unfriend depending on the relationship.
- The leaderboard remains opt-in by default for new users, with an opt-out available in Settings.

## Secure invitation links

Invite, WhatsApp, native sharing and Copy Link now create a secure one-time friendship URL.

When the recipient opens the link:

1. The token is retained before GitHub authentication.
2. They sign in or create their Kaishi Quest cloud account.
3. The token is redeemed after sign-in.
4. The two accounts become accepted friends.

Links expire after 30 days and can only be redeemed once.

The v9.0.7 first-launch welcome overlay remains included.

No email service, domain or Supabase Edge Function is required.
