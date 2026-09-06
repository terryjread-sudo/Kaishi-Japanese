-- Revisioned learner-progress writes prevent stale devices overwriting newer work.

alter table public.user_progress
  add column if not exists revision bigint not null default 0,
  add column if not exists reset_generation integer not null default 0;

create or replace function public.save_kaishi_progress(
  p_payload jsonb,
  p_schema_version integer,
  p_expected_revision bigint,
  p_reset_generation integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_row public.user_progress%rowtype;
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select * into current_row from public.user_progress where user_id = caller for update;
  if not found then
    if coalesce(p_expected_revision, 0) <> 0 or coalesce(p_reset_generation, 0) <> 0 then
      return jsonb_build_object('status', 'conflict', 'revision', 0, 'reset_generation', 0);
    end if;
    insert into public.user_progress(user_id, schema_version, payload, revision, reset_generation)
      values (caller, greatest(1, p_schema_version), coalesce(p_payload, '{}'::jsonb), 1, 0)
      returning * into current_row;
    return jsonb_build_object('status', 'saved', 'revision', current_row.revision, 'reset_generation', current_row.reset_generation);
  end if;
  if current_row.revision <> coalesce(p_expected_revision, 0) or current_row.reset_generation <> coalesce(p_reset_generation, 0) then
    return jsonb_build_object('status', 'conflict', 'revision', current_row.revision, 'reset_generation', current_row.reset_generation, 'payload', current_row.payload);
  end if;
  update public.user_progress
    set payload = coalesce(p_payload, '{}'::jsonb), schema_version = greatest(1, p_schema_version), revision = current_row.revision + 1
    where user_id = caller
    returning * into current_row;
  return jsonb_build_object('status', 'saved', 'revision', current_row.revision, 'reset_generation', current_row.reset_generation);
end;
$$;

create or replace function public.reset_kaishi_progress(p_payload jsonb, p_schema_version integer)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_row public.user_progress%rowtype;
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select * into current_row from public.user_progress where user_id = caller for update;
  if not found then
    insert into public.user_progress(user_id, schema_version, payload, revision, reset_generation)
      values (caller, greatest(1, p_schema_version), coalesce(p_payload, '{}'::jsonb), 1, 1)
      returning * into current_row;
  else
    update public.user_progress
      set payload = coalesce(p_payload, '{}'::jsonb), schema_version = greatest(1, p_schema_version), revision = current_row.revision + 1, reset_generation = current_row.reset_generation + 1
      where user_id = caller
      returning * into current_row;
  end if;
  return jsonb_build_object('status', 'reset', 'revision', current_row.revision, 'reset_generation', current_row.reset_generation);
end;
$$;

revoke all on function public.save_kaishi_progress(jsonb, integer, bigint, integer), public.reset_kaishi_progress(jsonb, integer) from public, anon;
grant execute on function public.save_kaishi_progress(jsonb, integer, bigint, integer), public.reset_kaishi_progress(jsonb, integer) to authenticated;
