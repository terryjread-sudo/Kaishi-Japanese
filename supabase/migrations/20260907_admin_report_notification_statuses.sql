-- Only open learning-card reports should appear in the owner's attention notification.
-- Reviewed, fixed, duplicate, and not-an-issue reports have all been resolved.

create or replace function public.get_kaishi_admin_notification_counts()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare report_count integer := 0;
begin
  if not public.is_app_admin() then
    raise exception 'Owner access required.';
  end if;

  select count(*)::integer into report_count
  from public.learning_card_reports
  where coalesce(status, 'new') = 'new';

  return jsonb_build_object('unreviewed_reports', report_count);
end;
$$;

revoke all on function public.get_kaishi_admin_notification_counts() from public;
grant execute on function public.get_kaishi_admin_notification_counts() to authenticated;
