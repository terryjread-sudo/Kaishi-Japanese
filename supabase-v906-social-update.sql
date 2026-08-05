-- Safe to run after supabase-friends.sql
drop function if exists public.get_kaishi_email_preferences();
drop function if exists public.set_kaishi_friend_email_preference(boolean);
drop table if exists public.kaishi_notification_preferences;

alter table public.leaderboard_entries alter column opted_in set default true;

create table if not exists public.kaishi_friend_invites(
 token uuid primary key default gen_random_uuid(),
 inviter_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default(now()+interval '30 days'),
 redeemed_by uuid references auth.users(id) on delete set null,
 redeemed_at timestamptz
);
alter table public.kaishi_friend_invites enable row level security;
revoke all on public.kaishi_friend_invites from anon,authenticated;

create or replace function public.create_kaishi_friend_invite() returns uuid
language plpgsql security definer set search_path=public as $$
declare invite_token uuid;
begin
 if auth.uid() is null then raise exception 'Not signed in.'; end if;
 insert into public.kaishi_friend_invites(inviter_id) values(auth.uid()) returning token into invite_token;
 return invite_token;
end $$;

create or replace function public.redeem_kaishi_friend_invite(invite_token uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare invite_row public.kaishi_friend_invites%rowtype; inviter_login text;
begin
 if auth.uid() is null then raise exception 'Not signed in.'; end if;
 select * into invite_row from public.kaishi_friend_invites where token=invite_token for update;
 if invite_row.token is null then raise exception 'Invite link is invalid.'; end if;
 if invite_row.redeemed_at is not null then raise exception 'Invite link has already been used.'; end if;
 if invite_row.expires_at<now() then raise exception 'Invite link has expired.'; end if;
 if invite_row.inviter_id=auth.uid() then raise exception 'You cannot redeem your own invite.'; end if;

 insert into public.kaishi_friend_requests(sender_id,recipient_id,status,responded_at)
 values(invite_row.inviter_id,auth.uid(),'accepted',now())
 on conflict(sender_id,recipient_id) do update set status='accepted',responded_at=now();

 update public.kaishi_friend_invites set redeemed_by=auth.uid(),redeemed_at=now() where token=invite_token;
 select github_login into inviter_login from public.leaderboard_entries where user_id=invite_row.inviter_id;
 return jsonb_build_object('inviter_login',inviter_login);
end $$;

grant execute on function public.create_kaishi_friend_invite() to authenticated;
grant execute on function public.redeem_kaishi_friend_invite(uuid) to authenticated;
