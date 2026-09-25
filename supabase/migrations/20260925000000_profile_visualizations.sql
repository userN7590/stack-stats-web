begin;

-- Keep the exact v1 contract for existing clients and saved profiles. Replacing
-- the original validator in place preserves the CHECK constraint's function OID;
-- simply renaming it would leave the constraint attached to the v1-only body.
create function public.profile_layout_v1_is_valid(p_layout jsonb)
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

create or replace function public.profile_layout_is_valid(p_layout jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  config jsonb;
  appearance jsonb;
  color jsonb;
  key text;
  module_id text;
  module_ids text[] := array[]::text[];
  core_modules jsonb := '[]'::jsonb;
  visualization_count integer := 0;
  visible_count integer := 0;
begin
  if p_layout is null then return true; end if;
  if jsonb_typeof(p_layout) is distinct from 'object' then return false; end if;
  if p_layout -> 'version' = '1'::jsonb then
    return public.profile_layout_v1_is_valid(p_layout);
  end if;
  if not (p_layout ?& array['version', 'modules'])
    or p_layout - array['version', 'modules'] <> '{}'::jsonb
    or p_layout -> 'version' is distinct from '2'::jsonb
    or jsonb_typeof(p_layout -> 'modules') is distinct from 'array'
  then return false; end if;
  if jsonb_array_length(p_layout -> 'modules') not between 4 and 10 then return false; end if;

  for item in select value from jsonb_array_elements(p_layout -> 'modules') loop
    if jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item -> 'visible') is distinct from 'boolean'
    then return false; end if;
    if item -> 'visible' = 'true'::jsonb then visible_count := visible_count + 1; end if;

    if item ->> 'type' in ('stats', 'code_changes', 'languages', 'links') then
      core_modules := core_modules || jsonb_build_array(item);
    elsif item ->> 'type' = 'visualization' then
      visualization_count := visualization_count + 1;
      if visualization_count > 6
        or not (item ?& array['type', 'id', 'visible', 'size', 'config'])
        or item - array['type', 'id', 'visible', 'size', 'config'] <> '{}'::jsonb
        or jsonb_typeof(item -> 'id') is distinct from 'string'
        or jsonb_typeof(item -> 'size') is distinct from 'string'
        or item ->> 'size' not in ('full', 'half')
      then return false; end if;
      module_id := item ->> 'id';
      if module_id !~ '^viz_[a-z0-9-]{1,64}$' or module_id = any(module_ids) then return false; end if;
      module_ids := array_append(module_ids, module_id);

      config := item -> 'config';
      if jsonb_typeof(config) is distinct from 'object' then return false; end if;
      if not (config ?& array['version', 'dataset', 'renderer', 'appearance'])
        or config - array['version', 'dataset', 'renderer', 'appearance'] <> '{}'::jsonb
        or config -> 'version' is distinct from '1'::jsonb
      then return false; end if;
      if config ->> 'dataset' = 'language_share' then
        if coalesce(config ->> 'renderer', '') not in ('bars', 'dots', 'radial_bars', 'polar_area', 'donut') then return false; end if;
      elsif config ->> 'dataset' = 'line_changes' then
        if config ->> 'renderer' is distinct from 'waterfall' then return false; end if;
      else return false;
      end if;

      appearance := config -> 'appearance';
      if jsonb_typeof(appearance) is distinct from 'object' then return false; end if;
      if appearance ->> 'palette' = 'custom' then
        if appearance - array['palette', 'colors', 'positive', 'negative'] <> '{}'::jsonb then return false; end if;
        if appearance ? 'colors' then
          if jsonb_typeof(appearance -> 'colors') is distinct from 'array' then return false; end if;
          if jsonb_array_length(appearance -> 'colors') not between 1 and 8 then return false; end if;
          for color in select value from jsonb_array_elements(appearance -> 'colors') loop
            if jsonb_typeof(color) is distinct from 'string'
              or color #>> '{}' !~ '^#[0-9A-Fa-f]{6}$'
            then return false; end if;
          end loop;
        end if;
        foreach key in array array['positive', 'negative'] loop
          if appearance ? key and (
            jsonb_typeof(appearance -> key) is distinct from 'string'
            or appearance ->> key !~ '^#[0-9A-Fa-f]{6}$'
          ) then return false; end if;
        end loop;
      elsif coalesce(appearance ->> 'palette', '') in ('stack', 'neon', 'ice', 'sunset', 'accessible', 'mono') then
        if appearance - 'palette' <> '{}'::jsonb then return false; end if;
      else return false;
      end if;
    else return false;
    end if;
  end loop;

  -- Validate every core row using the unchanged v1 rules. A v2 profile may hide
  -- all core sections when a visualization is visible; adjust only this local
  -- validation copy. The actual stored visibility and all existing rows stay put.
  if jsonb_array_length(core_modules) <> 4 or visible_count = 0 then return false; end if;
  return public.profile_layout_v1_is_valid(jsonb_build_object(
    'version', 1, 'modules', jsonb_set(core_modules, '{0,visible}', 'true'::jsonb)
  ));
end;
$$;

revoke all on function public.profile_layout_v1_is_valid(jsonb) from public, anon;
grant execute on function public.profile_layout_v1_is_valid(jsonb) to authenticated;
-- CREATE OR REPLACE retains the existing validator's grants. Reassert the
-- intended roles without changing any profile grants, policies, or save RPC.
revoke all on function public.profile_layout_is_valid(jsonb) from public, anon;
grant execute on function public.profile_layout_is_valid(jsonb) to authenticated;

commit;
