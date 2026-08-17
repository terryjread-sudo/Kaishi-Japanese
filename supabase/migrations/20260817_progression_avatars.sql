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
    'harajuku-girl',
    'harajuku-guy',
    'izakaya-cook'
  ));
