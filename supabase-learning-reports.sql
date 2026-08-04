-- Kaishi Quest v8.3.0
-- Learning-card reports, per-user daily limits and owner-only administration.
-- Run once in Supabase: SQL Editor -> New query -> Run.

create extension if not exists pgcrypto;

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;

create table if not exists public.learning_card_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  github_login text not null,

  word_id text,
  japanese text,
  reading text,
  english text,
  topic_id text,

  page_type text not null default 'learning-card',
  activity_type text,
  card_context jsonb not null default '{}'::jsonb,

  category text not null check (category in (
    'japanese_wrong',
    'english_wrong',
    'audio_wrong',
    'mnemonic_wrong',
    'graphical_issue',
    'answer_options_wrong',
    'other'
  )),
  description varchar(300),

  app_version varchar(30),
  viewport_width integer,
  viewport_height integer,

  status text not null default 'new' check (status in (
    'new','reviewed','fixed','duplicate','not_an_issue'
  )),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  exported_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learning_card_reports_user_created_idx
  on public.learning_card_reports (user_id, created_at desc);

create index if not exists learning_card_reports_status_created_idx
  on public.learning_card_reports (status, created_at desc);

create index if not exists learning_card_reports_category_idx
  on public.learning_card_reports (category);

alter table public.learning_card_reports enable row level security;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated;

-- Register the existing GitHub account as the administrator.
-- This selects the unique Supabase Auth UUID belonging to @terryjread-sudo.
insert into public.app_admins (user_id)
select id
from auth.users
where lower(coalesce(
  raw_user_meta_data ->> 'user_name',
  raw_user_meta_data ->> 'preferred_username',
  raw_user_meta_data ->> 'login',
  ''
)) = 'terryjread-sudo'
on conflict (user_id) do nothing;

drop policy if exists "Admins can read learning reports" on public.learning_card_reports;
create policy "Admins can read learning reports"
on public.learning_card_reports
for select
to authenticated
using ((select public.is_app_admin()));

drop policy if exists "Admins can update learning reports" on public.learning_card_reports;
create policy "Admins can update learning reports"
on public.learning_card_reports
for update
to authenticated
using ((select public.is_app_admin()))
with check ((select public.is_app_admin()));

drop policy if exists "Admins can delete learning reports" on public.learning_card_reports;
create policy "Admins can delete learning reports"
on public.learning_card_reports
for delete
to authenticated
using ((select public.is_app_admin()));

-- Learners submit only through this function. There is deliberately no
-- direct INSERT policy on learning_card_reports.
create or replace function public.submit_learning_card_report(
  p_word_id text,
  p_japanese text,
  p_reading text,
  p_english text,
  p_topic_id text,
  p_page_type text,
  p_activity_type text,
  p_card_context jsonb,
  p_category text,
  p_description text,
  p_app_version text,
  p_viewport_width integer,
  p_viewport_height integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_login text;
  v_count integer;
  v_report_id uuid;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to report an issue.';
  end if;

  if p_category not in (
    'japanese_wrong','english_wrong','audio_wrong','mnemonic_wrong',
    'graphical_issue','answer_options_wrong','other'
  ) then
    raise exception 'Invalid report category.';
  end if;

  -- Serialise submissions from the same user so simultaneous requests
  -- cannot bypass the three-per-day limit.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select lower(coalesce(
    raw_user_meta_data ->> 'user_name',
    raw_user_meta_data ->> 'preferred_username',
    raw_user_meta_data ->> 'login',
    split_part(email, '@', 1),
    'learner'
  ))
  into v_login
  from auth.users
  where id = v_user_id;

  select count(*)
  into v_count
  from public.learning_card_reports
  where user_id = v_user_id
    and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
    and created_at < (date_trunc('day', now() at time zone 'UTC') + interval '1 day') at time zone 'UTC';

  if v_count >= 3 then
    raise exception 'Daily report limit reached.';
  end if;

  if exists (
    select 1
    from public.learning_card_reports
    where user_id = v_user_id
      and word_id is not distinct from nullif(left(p_word_id, 150), '')
      and page_type = coalesce(nullif(left(p_page_type, 100), ''), 'learning-card')
      and activity_type is not distinct from nullif(left(p_activity_type, 100), '')
      and category = p_category
      and status in ('new','reviewed')
  ) then
    raise exception 'You have already reported this issue.';
  end if;

  insert into public.learning_card_reports (
    user_id, github_login,
    word_id, japanese, reading, english, topic_id,
    page_type, activity_type, card_context,
    category, description,
    app_version, viewport_width, viewport_height
  )
  values (
    v_user_id, left(v_login, 100),
    nullif(left(p_word_id, 150), ''),
    nullif(left(p_japanese, 300), ''),
    nullif(left(p_reading, 300), ''),
    nullif(left(p_english, 500), ''),
    nullif(left(p_topic_id, 150), ''),
    coalesce(nullif(left(p_page_type, 100), ''), 'learning-card'),
    nullif(left(p_activity_type, 100), ''),
    coalesce(p_card_context, '{}'::jsonb),
    p_category,
    left(nullif(trim(p_description), ''), 300),
    nullif(left(p_app_version, 30), ''),
    greatest(0, least(coalesce(p_viewport_width, 0), 10000)),
    greatest(0, least(coalesce(p_viewport_height, 0), 10000))
  )
  returning id into v_report_id;

  return jsonb_build_object(
    'id', v_report_id,
    'remaining', greatest(0, 2 - v_count)
  );
end;
$$;

revoke all on function public.submit_learning_card_report(
  text,text,text,text,text,text,text,jsonb,text,text,text,integer,integer
) from public;

grant execute on function public.submit_learning_card_report(
  text,text,text,text,text,text,text,jsonb,text,text,text,integer,integer
) to authenticated;

-- Keep updated_at accurate for admin status changes.
create or replace function public.set_learning_report_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists learning_card_reports_updated_at
on public.learning_card_reports;

create trigger learning_card_reports_updated_at
before update on public.learning_card_reports
for each row execute function public.set_learning_report_updated_at();

-- Diagnostic query: this should return one row after the owner has signed in
-- to Kaishi Quest through GitHub at least once.
select
  u.id as supabase_user_id,
  coalesce(
    u.raw_user_meta_data ->> 'user_name',
    u.raw_user_meta_data ->> 'preferred_username',
    u.raw_user_meta_data ->> 'login'
  ) as github_login,
  (a.user_id is not null) as is_admin
from auth.users u
left join public.app_admins a on a.user_id = u.id
where lower(coalesce(
  u.raw_user_meta_data ->> 'user_name',
  u.raw_user_meta_data ->> 'preferred_username',
  u.raw_user_meta_data ->> 'login',
  ''
)) = 'terryjread-sudo';
