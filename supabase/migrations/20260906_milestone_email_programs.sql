-- Phase 2: learner-earned milestone email programs.
-- Milestone campaign keys include the client-maintained progress cycle, so a
-- learner who resets their progress can earn the same milestones again.
alter table public.kaishi_email_automation_programs
  drop constraint if exists kaishi_email_automation_programs_program_key_check;
alter table public.kaishi_email_automation_programs
  add constraint kaishi_email_automation_programs_program_key_check
  check (program_key in (
    'reengagement','weekly_recap','monthly_sensei_letter','onboarding_nudge',
    'milestone_first_lesson','milestone_ten_mastered',
    'milestone_chapter_complete','milestone_streak'
  ));

insert into public.kaishi_email_automation_programs(program_key,enabled)
values
  ('milestone_first_lesson',false),
  ('milestone_ten_mastered',false),
  ('milestone_chapter_complete',false),
  ('milestone_streak',false)
on conflict(program_key) do nothing;
