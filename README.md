# Kaishi Quest v9.0.6 — Learning Together

This revised package removes all email functionality.

You already ran `supabase-friends.sql`, which is fine. Keep it in place.

Now run `supabase-v906-social-update.sql`. It:
- removes unused email preference objects;
- defaults new users into the leaderboard;
- preserves existing opt-in and opt-out choices;
- adds secure one-time friend invite links.

Community Challenge users are clickable. Their profile offers Add friend, Accept, Decline or Unfriend depending on the relationship.

Invite links expire after 30 days and can be redeemed once. When the recipient opens the link and signs in, the two users become friends automatically.

No domain, Resend account or Edge Function is required.
