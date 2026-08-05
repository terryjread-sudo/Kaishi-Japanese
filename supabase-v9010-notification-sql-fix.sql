-- Kaishi Quest v9.0.10 SQL compatibility fix
drop function if exists public.get_kaishi_admin_users();

create function public.get_kaishi_admin_users()
returns table (
 user_id uuid, github_login text, display_name text, avatar_key text,
 xp bigint, mastered integer, streak integer, opted_in boolean,
 created_at timestamptz, updated_at timestamptz, friend_count integer
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
        u.created_at,e.updated_at,public.kaishi_friend_count(e.user_id)
 from public.leaderboard_entries e
 left join auth.users u on u.id=e.user_id
 order by coalesce(u.created_at,e.updated_at) desc;
end;
$$;
revoke all on function public.get_kaishi_admin_users() from public;
grant execute on function public.get_kaishi_admin_users() to authenticated;

drop function if exists public.get_kaishi_admin_notification_counts();

create function public.get_kaishi_admin_notification_counts()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare report_count integer:=0;
begin
 if not public.is_app_admin() then raise exception 'Owner access required.'; end if;
 select count(*)::integer into report_count
 from public.learning_card_reports
 where coalesce(status,'new') not in ('reviewed','resolved','closed');
 return jsonb_build_object('unreviewed_reports',report_count);
end;
$$;
revoke all on function public.get_kaishi_admin_notification_counts() from public;
grant execute on function public.get_kaishi_admin_notification_counts() to authenticated;
