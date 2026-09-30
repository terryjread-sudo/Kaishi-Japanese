-- Owner-managed live application controls with public read access and rollback history.

create table if not exists public.kaishi_runtime_configuration (
  id text primary key check (id = 'live'),
  config jsonb not null check (jsonb_typeof(config) = 'object' and pg_column_size(config) <= 32768),
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.kaishi_runtime_configuration_history (
  id bigint generated always as identity primary key,
  revision bigint not null,
  config jsonb not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null
);

create index if not exists kaishi_runtime_configuration_history_recent_idx
  on public.kaishi_runtime_configuration_history(changed_at desc);

alter table public.kaishi_runtime_configuration enable row level security;
alter table public.kaishi_runtime_configuration_history enable row level security;
revoke all on public.kaishi_runtime_configuration, public.kaishi_runtime_configuration_history from anon, authenticated;

insert into public.kaishi_runtime_configuration(id, config, revision)
values ('live', jsonb_build_object(
  'schemaVersion', 1,
  'announcement', jsonb_build_object('enabled', false, 'title', '', 'message', '', 'linkLabel', '', 'linkUrl', ''),
  'features', jsonb_build_object('games', true, 'signalDesk', true, 'deviceRepair', true, 'japanReady', true, 'community', true),
  'gameHub', jsonb_build_object(
    'heading', 'Choose a Japanese challenge',
    'introduction', 'Each game strengthens your Kaishi learning record.',
    'signalTitle', 'Section K · Signal Desk',
    'signalDescription', 'Decode Japanese intercepts, apply a changing codebook, and decide what must be escalated.',
    'deviceTitle', 'Device Repair',
    'deviceDescription', 'Restore a detailed cassette player with words you have already learned.'
  ),
  'support', jsonb_build_object('enabled', false, 'label', 'Contact Kaishi support', 'url', '')
), 1)
on conflict (id) do nothing;

create or replace function public.get_kaishi_runtime_config()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('config', config, 'revision', revision, 'updated_at', updated_at)
  from public.kaishi_runtime_configuration where id = 'live';
$$;

create or replace function public.set_kaishi_runtime_config(p_config jsonb, p_expected_revision bigint default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare current_row public.kaishi_runtime_configuration%rowtype;
begin
  if not public.is_app_admin() then raise exception 'Owner access required.'; end if;
  if jsonb_typeof(p_config) <> 'object' or pg_column_size(p_config) > 32768 then raise exception 'Invalid runtime configuration.'; end if;
  select * into current_row from public.kaishi_runtime_configuration where id = 'live' for update;
  if p_expected_revision is not null and current_row.revision <> p_expected_revision then raise exception 'The live configuration changed in another session. Reload before publishing.'; end if;
  insert into public.kaishi_runtime_configuration_history(revision, config, changed_by) values (current_row.revision, current_row.config, auth.uid());
  update public.kaishi_runtime_configuration set config = p_config, revision = current_row.revision + 1, updated_at = now(), updated_by = auth.uid() where id = 'live';
  return public.get_kaishi_runtime_config();
end;
$$;

create or replace function public.get_kaishi_runtime_config_history(p_limit integer default 20)
returns table(revision bigint, config jsonb, changed_at timestamptz, changed_by text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then raise exception 'Owner access required.'; end if;
  return query select h.revision, h.config, h.changed_at, coalesce(e.github_login, h.changed_by::text)
  from public.kaishi_runtime_configuration_history h
  left join public.leaderboard_entries e on e.user_id = h.changed_by
  order by h.changed_at desc limit greatest(1, least(coalesce(p_limit, 20), 100));
end;
$$;

create or replace function public.rollback_kaishi_runtime_config(p_revision bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare snapshot jsonb; current_row public.kaishi_runtime_configuration%rowtype;
begin
  if not public.is_app_admin() then raise exception 'Owner access required.'; end if;
  select h.config into snapshot from public.kaishi_runtime_configuration_history h where h.revision = p_revision order by h.changed_at desc limit 1;
  if snapshot is null then raise exception 'That configuration revision is no longer available.'; end if;
  select * into current_row from public.kaishi_runtime_configuration where id = 'live' for update;
  insert into public.kaishi_runtime_configuration_history(revision, config, changed_by) values (current_row.revision, current_row.config, auth.uid());
  update public.kaishi_runtime_configuration set config = snapshot, revision = current_row.revision + 1, updated_at = now(), updated_by = auth.uid() where id = 'live';
  return public.get_kaishi_runtime_config();
end;
$$;

revoke all on function public.get_kaishi_runtime_config(), public.set_kaishi_runtime_config(jsonb,bigint), public.get_kaishi_runtime_config_history(integer), public.rollback_kaishi_runtime_config(bigint) from public;
grant execute on function public.get_kaishi_runtime_config() to anon, authenticated;
grant execute on function public.set_kaishi_runtime_config(jsonb,bigint), public.get_kaishi_runtime_config_history(integer), public.rollback_kaishi_runtime_config(bigint) to authenticated;
