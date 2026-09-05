-- Owner-visible operational logs for email delivery and Supabase client issues.
create table if not exists public.kaishi_admin_event_log (
  id uuid primary key default gen_random_uuid(),
  event_kind text not null check (event_kind in ('supabase_issue')),
  severity text not null default 'error' check (severity in ('info','warning','error')),
  message text not null check (char_length(message) between 1 and 1000),
  context text,
  details jsonb not null default '{}'::jsonb,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists kaishi_admin_event_log_recent_idx on public.kaishi_admin_event_log(created_at desc);
alter table public.kaishi_admin_event_log enable row level security;
revoke all on public.kaishi_admin_event_log from anon, authenticated;

create or replace function public.log_kaishi_supabase_issue(p_message text,p_context text default null,p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  insert into public.kaishi_admin_event_log(event_kind,severity,message,context,details,user_id)
  values ('supabase_issue','error',left(trim(p_message),1000),left(coalesce(p_context,''),120),coalesce(p_details,'{}'::jsonb),auth.uid());
end; $$;

create or replace function public.get_kaishi_email_log(p_limit integer default 100)
returns table(recipient_name text,recipient_login text,template_key text,campaign_key text,status text,error_message text,created_at timestamptz,sent_at timestamptz)
language plpgsql security definer set search_path=public,auth as $$
begin
  if not public.is_app_admin() then raise exception 'Owner access required.'; end if;
  return query select coalesce(e.display_name,u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name','learner'),coalesce(e.github_login,u.raw_user_meta_data->>'user_name'),l.template_key,l.campaign_key,l.status,l.error_message,l.created_at,l.sent_at
  from public.kaishi_email_send_log l
  left join public.leaderboard_entries e on e.user_id=l.recipient_id
  left join auth.users u on u.id=l.recipient_id
  order by l.created_at desc limit greatest(1,least(coalesce(p_limit,100),250));
end; $$;

create or replace function public.get_kaishi_supabase_issue_log(p_limit integer default 100)
returns table(severity text,message text,context text,details jsonb,created_at timestamptz,github_login text)
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_app_admin() then raise exception 'Owner access required.'; end if;
  return query select l.severity,l.message,l.context,l.details,l.created_at,e.github_login
  from public.kaishi_admin_event_log l left join public.leaderboard_entries e on e.user_id=l.user_id
  where l.event_kind='supabase_issue' order by l.created_at desc limit greatest(1,least(coalesce(p_limit,100),250));
end; $$;

revoke all on function public.log_kaishi_supabase_issue(text,text,jsonb),public.get_kaishi_email_log(integer),public.get_kaishi_supabase_issue_log(integer) from public;
grant execute on function public.log_kaishi_supabase_issue(text,text,jsonb),public.get_kaishi_email_log(integer),public.get_kaishi_supabase_issue_log(integer) to authenticated;
notify pgrst, 'reload schema';
