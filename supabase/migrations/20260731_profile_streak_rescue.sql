-- Adds Kaishi character selection and public streak display to an existing setup.
-- Safe to run after 20260731_cloud_progress.sql.

alter table public.leaderboard_entries
  add column if not exists avatar_key text not null default 'boy',
  add column if not exists streak integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leaderboard_entries_avatar_key_check') then
    alter table public.leaderboard_entries
      add constraint leaderboard_entries_avatar_key_check
      check (avatar_key in ('boy','girl','master','man','woman'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leaderboard_entries_streak_check') then
    alter table public.leaderboard_entries
      add constraint leaderboard_entries_streak_check check (streak >= 0);
  end if;
end $$;
