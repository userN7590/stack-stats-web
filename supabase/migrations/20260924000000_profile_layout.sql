begin;

-- NULL means the application's default layout. Existing profile data is not
-- rewritten, and older clients may continue inserting/saving profiles unchanged.
alter table public.profiles
  add column profile_layout jsonb default null;

create function public.profile_layout_is_valid(p_layout jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  stat jsonb;
  module_type text;
  stat_id text;
  module_types text[] := array[]::text[];
  stat_ids text[];
  visible_count integer := 0;
begin
  if p_layout is null then return true; end if;
  if jsonb_typeof(p_layout) <> 'object' then return false; end if;
  if not (p_layout ?& array['version', 'modules'])
    or p_layout - array['version', 'modules'] <> '{}'::jsonb
    or p_layout -> 'version' <> '1'::jsonb
    or jsonb_typeof(p_layout -> 'modules') <> 'array'
  then return false; end if;
  if jsonb_array_length(p_layout -> 'modules') <> 4 then return false; end if;

  for item in select value from jsonb_array_elements(p_layout -> 'modules') loop
    if jsonb_typeof(item) <> 'object' then return false; end if;
    module_type := item ->> 'type';
    if module_type is null
      or module_type not in ('links', 'stats', 'code_changes', 'languages')
      or module_type = any(module_types)
      or jsonb_typeof(item -> 'visible') is distinct from 'boolean'
      or item ->> 'size' is null
      or item ->> 'size' not in ('full', 'half')
    then return false; end if;
    module_types := array_append(module_types, module_type);
    if item -> 'visible' = 'true'::jsonb then
      visible_count := visible_count + 1;
    end if;

    if module_type = 'stats' then
      if item - array['type', 'visible', 'size', 'stats'] <> '{}'::jsonb
        or item ->> 'size' <> 'full'
        or jsonb_typeof(item -> 'stats') is distinct from 'array'
      then return false; end if;
      if jsonb_array_length(item -> 'stats') not between 1 and 6 then return false; end if;
      stat_ids := array[]::text[];
      for stat in select value from jsonb_array_elements(item -> 'stats') loop
        if jsonb_typeof(stat) <> 'string' then return false; end if;
        stat_id := stat #>> '{}';
        if stat_id not in (
          'lines_added', 'lines_removed', 'files_changed',
          'edit_events', 'projects_count', 'coding_minutes'
        ) or stat_id = any(stat_ids) then return false; end if;
        stat_ids := array_append(stat_ids, stat_id);
      end loop;
    elsif item - array['type', 'visible', 'size'] <> '{}'::jsonb then
      return false;
    end if;
  end loop;
  return visible_count > 0;
end;
$$;

alter table public.profiles
  add constraint profiles_profile_layout_check
  check (public.profile_layout_is_valid(profile_layout));

-- A layout-only edit must not make old manual totals appear freshly updated.
-- All other profile updates keep the existing timestamp behavior. The generic
-- set_updated_at function remains unchanged for any other callers.
create function public.set_profile_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.profile_layout is distinct from old.profile_layout
    and to_jsonb(new) - 'profile_layout' = to_jsonb(old) - 'profile_layout'
  then
    new.updated_at := old.updated_at;
  else
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_profile_updated_at();

create function public.update_profile_layout(p_layout jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if not public.profile_layout_is_valid(p_layout) then
    raise exception 'Invalid profile layout.' using errcode = '22023';
  end if;

  perform 1 from public.profiles where user_id = current_user_id for update;
  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;
  update public.profiles
  set profile_layout = p_layout
  where user_id = current_user_id and profile_layout is distinct from p_layout;
end;
$$;

-- The pure validator also runs in the owner's CHECK constraint. No additional
-- profile/table grants or RLS policies are necessary; existing ownership applies.
revoke all on function public.profile_layout_is_valid(jsonb) from public, anon;
grant execute on function public.profile_layout_is_valid(jsonb) to authenticated;
revoke all on function public.set_profile_updated_at() from public, anon, authenticated;
revoke all on function public.update_profile_layout(jsonb) from public, anon;
grant execute on function public.update_profile_layout(jsonb) to authenticated;

commit;
