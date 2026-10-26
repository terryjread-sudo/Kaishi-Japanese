-- Daily word email program. Kept as a separate migration so existing deployments
-- can add the program without rerunning historical email migrations.
alter table public.kaishi_email_automation_programs
  drop constraint if exists kaishi_email_automation_programs_program_key_check;

alter table public.kaishi_email_automation_programs
  add constraint kaishi_email_automation_programs_program_key_check
  check (program_key in (
    'reengagement','weekly_recap','monthly_sensei_letter','onboarding_nudge',
    'daily_word',
    'milestone_first_lesson','milestone_ten_mastered',
    'milestone_chapter_complete','milestone_streak'
  ));

insert into public.kaishi_email_automation_programs(program_key, enabled)
values ('daily_word', false)
on conflict (program_key) do nothing;
