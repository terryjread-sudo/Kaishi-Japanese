-- Kaishi Japanese email preferences, owner mail tools and scheduled re-engagement.
-- Run after the existing social and admin SQL setup.

alter table public.kaishi_notification_preferences
  add column if not exists learning_email boolean not null default true;

create table if not exists public.kaishi_email_automation_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  last_run_week date,
  last_run_at timestamptz,
  last_sent_count integer not null default 0,
  last_result text,
  updated_at timestamptz not null default now()
);

insert into public.kaishi_email_automation_settings (singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.kaishi_email_send_log (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  sent_by uuid references auth.users(id) on delete set null,
  template_key text not null,
  campaign_key text,
  idempotency_key uuid,
  status text not null default 'attempting' check (status in ('attempting','sent','failed','skipped')),
  resend_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create unique index if not exists kaishi_email_send_campaign_unique
  on public.kaishi_email_send_log (recipient_id, template_key, campaign_key)
  where campaign_key is not null;

create unique index if not exists kaishi_email_send_idempotency_unique
  on public.kaishi_email_send_log (idempotency_key)
  where idempotency_key is not null;

create table if not exists public.kaishi_email_unsubscribe_tokens (
  token uuid primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

alter table public.kaishi_email_automation_settings enable row level security;
alter table public.kaishi_email_send_log enable row level security;
alter table public.kaishi_email_unsubscribe_tokens enable row level security;
revoke all on public.kaishi_email_automation_settings, public.kaishi_email_send_log, public.kaishi_email_unsubscribe_tokens from anon, authenticated;

create or replace function public.get_kaishi_email_preferences()
returns jsonb
language sql
security definer
set search_path=public
as $$
  select jsonb_build_object(
    'friend_request_email', coalesce((select friend_request_email from public.kaishi_notification_preferences where user_id=auth.uid()), true),
    'learning_email', coalesce((select learning_email from public.kaishi_notification_preferences where user_id=auth.uid()), true)
  );
$$;

create or replace function public.set_kaishi_learning_email_preference(enabled boolean)
returns void
language sql
security definer
set search_path=public
as $$
  insert into public.kaishi_notification_preferences(user_id,learning_email,updated_at)
  values(auth.uid(),coalesce(enabled,true),now())
  on conflict(user_id) do update
  set learning_email=excluded.learning_email,updated_at=now();
$$;

drop function if exists public.get_kaishi_admin_users();
create function public.get_kaishi_admin_users()
returns table (
  user_id uuid, github_login text, display_name text, avatar_key text,
  xp bigint, mastered integer, streak integer, opted_in boolean,
  created_at timestamptz, updated_at timestamptz, friend_count integer,
  last_sign_in_at timestamptz, learning_email boolean, contactable boolean
)
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  if not public.is_app_admin() then raise exception 'Owner access required.'; end if;
  return query
  select e.user_id,e.github_login,e.display_name,e.avatar_key,
         coalesce(e.xp,0)::bigint,coalesce(e.mastered,0)::integer,
         coalesce(e.streak,0)::integer,coalesce(e.opted_in,true),
         u.created_at,e.updated_at,public.kaishi_friend_count(e.user_id),
         u.last_sign_in_at,coalesce(p.learning_email,true),
         (u.email is not null and coalesce(p.learning_email,true))
  from public.leaderboard_entries e
  left join auth.users u on u.id=e.user_id
  left join public.kaishi_notification_preferences p on p.user_id=e.user_id
  order by coalesce(u.last_sign_in_at,u.created_at,e.updated_at) desc;
end;
$$;

create or replace function public.get_kaishi_email_automation_settings()
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare settings public.kaishi_email_automation_settings;
declare eligible integer:=0;
begin
  if not public.is_app_admin() then raise exception 'Owner access required.'; end if;
  select * into settings from public.kaishi_email_automation_settings where singleton=true;
  select count(*)::integer into eligible
  from auth.users u
  left join public.kaishi_notification_preferences p on p.user_id=u.id
  where u.email is not null
    and coalesce(p.learning_email,true)
    and u.last_sign_in_at <= now()-interval '7 days';
  return jsonb_build_object('enabled',settings.enabled,'last_run_at',settings.last_run_at,'last_sent_count',settings.last_sent_count,'last_result',settings.last_result,'eligible_count',eligible);
end;
$$;

create or replace function public.set_kaishi_email_automation_enabled(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_app_admin() then raise exception 'Owner access required.'; end if;
  update public.kaishi_email_automation_settings
  set enabled=coalesce(p_enabled,false),updated_at=now()
  where singleton=true;
  return public.get_kaishi_email_automation_settings();
end;
$$;

create or replace function public.claim_kaishi_reengagement_run(run_week date)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.kaishi_email_automation_settings
  set last_run_week=run_week,last_run_at=now(),last_sent_count=0,last_result='Running',updated_at=now()
  where singleton=true and enabled and (last_run_week is distinct from run_week);
  return found;
end;
$$;

create or replace function public.finish_kaishi_reengagement_run(sent_count integer, result text)
returns void
language sql
security definer
set search_path=public
as $$
  update public.kaishi_email_automation_settings
  set last_sent_count=greatest(0,coalesce(sent_count,0)),last_result=left(coalesce(result,''),500),updated_at=now()
  where singleton=true;
$$;

revoke all on function public.get_kaishi_email_preferences(), public.set_kaishi_learning_email_preference(boolean), public.get_kaishi_admin_users(), public.get_kaishi_email_automation_settings(), public.set_kaishi_email_automation_enabled(boolean), public.claim_kaishi_reengagement_run(date), public.finish_kaishi_reengagement_run(integer,text) from public;
grant execute on function public.get_kaishi_email_preferences(), public.set_kaishi_learning_email_preference(boolean), public.get_kaishi_admin_users(), public.get_kaishi_email_automation_settings(), public.set_kaishi_email_automation_enabled(boolean) to authenticated;
grant execute on function public.claim_kaishi_reengagement_run(date), public.finish_kaishi_reengagement_run(integer,text) to service_role;
