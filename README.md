# Kaishi Quest v9.0.6 — Learning Together

Upload all changed root files, preserving the `supabase/functions/friend-request-email/` folder.

## Supabase setup

1. Run `supabase-friends.sql` once in Supabase SQL Editor.
2. Deploy the Edge Function:
   `supabase functions deploy friend-request-email`
3. Add these Edge Function secrets:
   - `RESEND_API_KEY`
   - `KAISHI_APP_URL` — your GitHub Pages app URL
   - `KAISHI_FROM_EMAIL` — a verified Resend sender, such as `Kaishi Quest <friends@yourdomain.com>`

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.

## Email behaviour

Friend-request emails are enabled by default. Signed-in users can turn them off under **Settings → Cloud progress → Email me about friend requests**.

An email is sent only when the recipient:
- has a usable email address associated with Supabase authentication;
- has not disabled friend-request emails.

The on-screen friend request is created even if email delivery is unavailable.

## Included features

- Four kana choices in Live Conversation
- Wrong kana choices lower the earned score
- Friend requests by GitHub username
- Accept, decline and unfriend
- Recent-friend dashboard encouragement
- Friend-request email notification and opt-out
- Small spacing buffer inside the green Journey card
