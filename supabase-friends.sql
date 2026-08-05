create table if not exists public.kaishi_friend_requests(id uuid primary key default gen_random_uuid(),sender_id uuid not null references auth.users(id) on delete cascade,recipient_id uuid not null references auth.users(id) on delete cascade,status text not null default 'pending' check(status in('pending','accepted','declined')),created_at timestamptz not null default now(),responded_at timestamptz,unique(sender_id,recipient_id),check(sender_id<>recipient_id));alter table public.kaishi_friend_requests enable row level security;drop policy if exists "friend requests visible to participants" on public.kaishi_friend_requests;create policy "friend requests visible to participants" on public.kaishi_friend_requests for select to authenticated using(auth.uid()=sender_id or auth.uid()=recipient_id);revoke all on public.kaishi_friend_requests from anon,authenticated;create or replace function public.send_kaishi_friend_request(target_login text) returns uuid language plpgsql security definer set search_path=public as $$declare target_id uuid;request_id uuid;begin select user_id into target_id from public.leaderboard_entries where lower(github_login)=lower(trim(target_login)) limit 1;if target_id is null then raise exception 'No signed-in Kaishi Quest user was found with that GitHub username.';end if;if target_id=auth.uid() then raise exception 'You cannot add yourself.';end if;insert into public.kaishi_friend_requests(sender_id,recipient_id,status) values(auth.uid(),target_id,'pending') on conflict(sender_id,recipient_id) do update set status='pending',created_at=now(),responded_at=null returning id into request_id;return request_id;end$$;create or replace function public.respond_kaishi_friend_request(request_id uuid,accept_request boolean) returns void language plpgsql security definer set search_path=public as $$begin update public.kaishi_friend_requests set status=case when accept_request then 'accepted' else 'declined' end,responded_at=now() where id=request_id and recipient_id=auth.uid() and status='pending';if not found then raise exception 'Friend request not found.';end if;end$$;create or replace function public.remove_kaishi_friend(friend_user_id uuid) returns void language plpgsql security definer set search_path=public as $$begin delete from public.kaishi_friend_requests where status='accepted' and ((sender_id=auth.uid() and recipient_id=friend_user_id) or (sender_id=friend_user_id and recipient_id=auth.uid()));end$$;create or replace function public.get_kaishi_friends() returns table(relationship_status text,request_id uuid,user_id uuid,github_login text,display_name text,avatar_key text,streak integer,xp integer,last_active_at timestamptz) language sql security definer set search_path=public as $$with relationships as(select case when r.status='pending' and r.recipient_id=auth.uid() then 'pending_incoming' when r.status='pending' and r.sender_id=auth.uid() then 'pending_outgoing' else r.status end relationship_status,r.id request_id,case when r.sender_id=auth.uid() then r.recipient_id else r.sender_id end friend_id from public.kaishi_friend_requests r where r.sender_id=auth.uid() or r.recipient_id=auth.uid()) select rel.relationship_status,rel.request_id,e.user_id,e.github_login,e.display_name,e.avatar_key,coalesce(e.streak,0)::integer,coalesce(e.xp,0)::integer,e.updated_at from relationships rel join public.leaderboard_entries e on e.user_id=rel.friend_id where rel.relationship_status in('accepted','pending_incoming','pending_outgoing') order by case when rel.relationship_status='pending_incoming' then 0 else 1 end,e.updated_at desc;$$;grant execute on function public.send_kaishi_friend_request(text) to authenticated;grant execute on function public.respond_kaishi_friend_request(uuid,boolean) to authenticated;grant execute on function public.remove_kaishi_friend(uuid) to authenticated;grant execute on function public.get_kaishi_friends() to authenticated;

-- Friend-request email preference: enabled by default.
create table if not exists public.kaishi_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  friend_request_email boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.kaishi_notification_preferences enable row level security;
revoke all on public.kaishi_notification_preferences from anon, authenticated;

create or replace function public.get_kaishi_email_preferences()
returns jsonb
language sql
security definer
set search_path=public
as $$
  select jsonb_build_object(
    'friend_request_email',
    coalesce(
      (select friend_request_email from public.kaishi_notification_preferences where user_id=auth.uid()),
      true
    )
  );
$$;

create or replace function public.set_kaishi_friend_email_preference(enabled boolean)
returns void
language sql
security definer
set search_path=public
as $$
  insert into public.kaishi_notification_preferences(user_id,friend_request_email,updated_at)
  values(auth.uid(),coalesce(enabled,true),now())
  on conflict(user_id) do update
  set friend_request_email=excluded.friend_request_email,updated_at=now();
$$;

grant execute on function public.get_kaishi_email_preferences() to authenticated;
grant execute on function public.set_kaishi_friend_email_preference(boolean) to authenticated;
