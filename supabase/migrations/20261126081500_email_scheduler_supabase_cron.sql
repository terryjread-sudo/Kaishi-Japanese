-- Keep all learner email programs on Supabase Cron. The Edge Function applies
-- per-program Europe/London schedule checks and database claims prevent duplicates.
-- Store the same random value in Edge Function secret KAISHI_EMAIL_CRON_SECRET
-- and Vault secret kaishi_email_cron_secret before applying this migration.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'kaishi-email-program-scheduler',
  '*/5 * * * *',
  $cron$
    select net.http_post(
      url := 'https://wcnsvwbhfstgadqnaarr.supabase.co/functions/v1/email-program-scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-kaishi-cron-secret',
        (select decrypted_secret
         from vault.decrypted_secrets
         where name = 'kaishi_email_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  $cron$
);
