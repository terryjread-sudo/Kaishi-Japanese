-- Allow the Journey milestone characters to be saved in signed-in profiles.
-- The unlock decision remains client-side and is retained in local/cloud progress.
alter table public.leaderboard_entries
  drop constraint if exists leaderboard_entries_avatar_key_check;

alter table public.leaderboard_entries
  add constraint leaderboard_entries_avatar_key_check
  check (avatar_key in (
    'boy',
    'girl',
    'master',
    'man',
    'woman',
    'journey-girl',
    'journey-boy',
    'journey-friend',
    'harajuku-girl',
    'harajuku-guy',
    'izakaya-cook'
  ));
