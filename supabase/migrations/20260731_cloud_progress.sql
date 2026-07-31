-- Kaishi Quest optional cloud progress and community leaderboard.
-- Run this entire file once in the Supabase SQL Editor.

create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null default 2 check (schema_version > 0),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.leaderboard_entries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  github_login text not null,
  display_name text not null,
  avatar_url text,
  opted_in boolean not null default false,
  xp bigint not null default 0 check (xp >= 0),
  mastered integer not null default 0 check (mastered >= 0),
  accuracy integer not null default 0 check (accuracy between 0 and 100),
  reviews integer not null default 0 check (reviews >= 0),
  monsters_defeated integer not null default 0 check (monsters_defeated >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists leaderboard_entries_rank_idx
  on public.leaderboard_entries (opted_in, xp desc, mastered desc);

create or replace function public.set_kaishi_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_progress_updated_at on public.user_progress;
create trigger user_progress_updated_at
before update on public.user_progress
for each row execute function public.set_kaishi_updated_at();

drop trigger if exists leaderboard_entries_updated_at on public.leaderboard_entries;
create trigger leaderboard_entries_updated_at
before update on public.leaderboard_entries
for each row execute function public.set_kaishi_updated_at();

alter table public.user_progress enable row level security;
alter table public.leaderboard_entries enable row level security;

drop policy if exists "Users read their own progress" on public.user_progress;
create policy "Users read their own progress"
on public.user_progress for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users insert their own progress" on public.user_progress;
create policy "Users insert their own progress"
on public.user_progress for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their own progress" on public.user_progress;
create policy "Users update their own progress"
on public.user_progress for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete their own progress" on public.user_progress;
create policy "Users delete their own progress"
on public.user_progress for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Public reads opted-in leaderboard entries" on public.leaderboard_entries;
create policy "Public reads opted-in leaderboard entries"
on public.leaderboard_entries for select
to anon, authenticated
using (opted_in or (select auth.uid()) = user_id);

drop policy if exists "Users insert their own leaderboard entry" on public.leaderboard_entries;
create policy "Users insert their own leaderboard entry"
on public.leaderboard_entries for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their own leaderboard entry" on public.leaderboard_entries;
create policy "Users update their own leaderboard entry"
on public.leaderboard_entries for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete their own leaderboard entry" on public.leaderboard_entries;
create policy "Users delete their own leaderboard entry"
on public.leaderboard_entries for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.user_progress from anon;
grant select, insert, update, delete on public.user_progress to authenticated;
grant select on public.leaderboard_entries to anon;
grant select, insert, update, delete on public.leaderboard_entries to authenticated;
