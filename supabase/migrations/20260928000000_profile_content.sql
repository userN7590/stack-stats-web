begin;

-- Additive Phase 9C migration. Do not replay applied layout migrations.
-- No rows, publication settings, table grants, RLS policies or RPC are changed.
do $$ begin
  assert to_regprocedure('public.profile_layout_v1_is_valid(jsonb)') is not null,
    'Phase 9C requires the completed profile visualization migration';
  assert to_regprocedure('public.sync_public_profile_v2(text,text,date)') is not null,
    'Phase 9C requires Phase 9B';
  assert to_regprocedure('public.profile_layout_v2_is_valid(jsonb)') is null,
    'Phase 9C already installed or partially applied; inspect state before replaying';
end $$;

-- Preserve v1/v2 validation verbatim. Replace the dispatcher in place so the
-- existing profiles CHECK constraint retains its function OID.
create function public.profile_layout_v2_is_valid(p_layout jsonb)
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

create function public.profile_external_link_is_valid(p_url text)
returns boolean language sql immutable security invoker set search_path = '' as $$
  select coalesce(length(p_url) between 1 and 2048
    and p_url ~ '^https://([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}(:443)?([/?#][^[:space:][:cntrl:]\\<>"]*)?$', false)
$$;

create or replace function public.profile_layout_is_valid(p_layout jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare
  item jsonb; cell jsonb; link jsonb; config jsonb;
  kind text; identity text; metric text;
  ids text[] := array[]::text[];
  visible_count integer := 0;
  legacy jsonb := '[]'; defaults jsonb := '[{"type":"links","visible":true,"size":"full"},{"type":"stats","visible":false,"size":"full","stats":["coding_minutes"]},{"type":"code_changes","visible":false,"size":"full"},{"type":"languages","visible":false,"size":"full"}]';
  scalar_ids text[] := array['activity.active_ms','activity.edits','activity.lines_added','activity.lines_removed','activity.net_lines','activity.churn','activity.file_days','activity.active_days','sessions.days','sessions.starts','sessions.completed','sessions.active_ms','sessions.average_ms','sessions.longest_ms','languages.count'];
begin
  if p_layout is null then return true; end if;
  if jsonb_typeof(p_layout) is distinct from 'object' then return false; end if;
  if p_layout -> 'version' in ('1'::jsonb, '2'::jsonb) then return public.profile_layout_v2_is_valid(p_layout); end if;
  if p_layout -> 'version' is distinct from '3'::jsonb
    or not (p_layout ?& array['version','modules']) or p_layout - array['version','modules'] <> '{}'
    or jsonb_typeof(p_layout -> 'modules') is distinct from 'array' then return false; end if;
  if jsonb_array_length(p_layout -> 'modules') not between 1 and 20 then return false; end if;
  for item in select value from jsonb_array_elements(p_layout -> 'modules') loop
    if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item -> 'visible') is distinct from 'boolean' then return false; end if;
    if item -> 'visible' = 'true' then visible_count := visible_count + 1; end if;
    kind := item ->> 'type';
    if kind is null then return false; end if;
    if kind in ('stats','languages','links','code_changes') then identity := kind;
    else
      if jsonb_typeof(item -> 'id') is distinct from 'string' then return false; end if;
      identity := item ->> 'id';
    end if;
    if identity = any(ids) then return false; end if;
    ids := array_append(ids, identity);
    if kind in ('stats','languages','links','code_changes','visualization') then
      legacy := legacy || jsonb_build_array(item);
      continue;
    end if;
    if identity !~ '^sec_[a-z0-9-]{1,64}$'
      or not (item ?& array['type','id','visible','size'])
      or jsonb_typeof(item -> 'size') is distinct from 'string'
      or item ->> 'size' not in ('full','two_thirds','half','third') then return false; end if;
    if kind = 'single_stat' then
      if not (item ?& array['metric','style']) or item - array['type','id','visible','size','metric','style'] <> '{}'
        or coalesce(item ->> 'style','') not in ('number','label','context') then return false; end if;
      if item -> 'metric' <> 'null'::jsonb and (jsonb_typeof(item -> 'metric') <> 'string' or not ((item ->> 'metric') = any(scalar_ids))) then return false; end if;
    elsif kind = 'stat_grid' then
      if not (item ?& array['columns','rows','cells']) or item - array['type','id','visible','size','columns','rows','cells'] <> '{}'
        or item -> 'columns' not in ('2'::jsonb,'3'::jsonb) or item -> 'rows' not in ('2'::jsonb,'3'::jsonb)
        or jsonb_typeof(item -> 'cells') is distinct from 'array' then return false; end if;
      if jsonb_array_length(item -> 'cells') <> (item ->> 'columns')::integer * (item ->> 'rows')::integer then return false; end if;
      for cell in select value from jsonb_array_elements(item -> 'cells') loop
        if cell <> 'null'::jsonb and (jsonb_typeof(cell) <> 'string' or not ((cell #>> '{}') = any(scalar_ids))) then return false; end if;
      end loop;
    elsif kind = 'dataset' then
      if not (item ? 'config') or item - array['type','id','visible','size','config'] <> '{}' then return false; end if;
      config := item -> 'config';
      if config <> 'null'::jsonb then
        if jsonb_typeof(config) <> 'object' or not (config ?& array['dataset','metric','renderer','measure','appearance'])
          or config - array['dataset','metric','renderer','measure','appearance'] <> '{}'
          or coalesce(config ->> 'measure','') not in ('activeMs','editCount','linesAdded','linesRemoved') then return false; end if;
        metric := config ->> 'metric';
        if metric = 'languages.activity' then
          if config ->> 'dataset' is distinct from 'languagesByDay' or coalesce(config ->> 'renderer','') not in ('list','bars','dots','donut','radial_bars','polar_area') then return false; end if;
        elsif metric = 'schedule.daily' then
          if config ->> 'dataset' is distinct from 'daily' or coalesce(config ->> 'renderer','') not in ('line','bars') then return false; end if;
        elsif metric = 'sessions.histogram' then
          if config ->> 'dataset' is distinct from 'sessionStartCohorts' or config ->> 'renderer' is distinct from 'histogram' or config ->> 'measure' <> 'activeMs' then return false; end if;
        elsif metric = 'schedule.hourly_utc' then
          if config ->> 'dataset' is distinct from 'hourlyUtc' or config ->> 'renderer' is distinct from 'heatmap' then return false; end if;
        else return false; end if;
        -- Reuse the exact palette/color validation contract without changing it.
        if not public.profile_layout_v2_is_valid(jsonb_build_object('version',2,'modules', defaults || jsonb_build_array(jsonb_build_object(
          'type','visualization','id','viz_palette','visible',true,'size','full','config',jsonb_build_object('version',1,'dataset','language_share','renderer','bars','appearance',config -> 'appearance'))))) then return false; end if;
      end if;
    elsif kind = 'document' then
      if not (item ?& array['title','url']) or item - array['type','id','visible','size','title','url'] <> '{}'
        or jsonb_typeof(item -> 'title') is distinct from 'string' or length(btrim(item ->> 'title')) not between 1 and 100
        or jsonb_typeof(item -> 'url') is distinct from 'string' then return false; end if;
      if item ->> 'url' <> '' and not public.profile_external_link_is_valid(item ->> 'url') then return false; end if;
    elsif kind = 'link_collection' then
      if not (item ? 'links') or item - array['type','id','visible','size','links'] <> '{}'
        or jsonb_typeof(item -> 'links') is distinct from 'array' then return false; end if;
      if jsonb_array_length(item -> 'links') > 8 then return false; end if;
      for link in select value from jsonb_array_elements(item -> 'links') loop
        if jsonb_typeof(link) <> 'object' or not (link ?& array['label','url']) or link - array['label','url'] <> '{}'
          or jsonb_typeof(link -> 'label') is distinct from 'string' or length(btrim(link ->> 'label')) not between 1 and 80
          or jsonb_typeof(link -> 'url') is distinct from 'string' or not public.profile_external_link_is_valid(link ->> 'url') then return false; end if;
      end loop;
    else return false; end if;
  end loop;
  if visible_count = 0 then return false; end if;
  -- Missing legacy singletons are allowed in v3. Pad this validation copy only;
  -- do not add sections to stored layouts or change their visibility.
  for item in select value from jsonb_array_elements(defaults) loop
    if not ((item ->> 'type') = any(ids)) then legacy := legacy || jsonb_build_array(item); end if;
  end loop;
  legacy := jsonb_set(legacy, '{0,visible}', 'true');
  return public.profile_layout_v2_is_valid(jsonb_build_object('version',2,'modules',legacy));
end $$;

revoke all on function public.profile_layout_v2_is_valid(jsonb) from public, anon;
revoke all on function public.profile_external_link_is_valid(text) from public, anon;
revoke all on function public.profile_layout_is_valid(jsonb) from public, anon;
grant execute on function public.profile_layout_v2_is_valid(jsonb) to authenticated;
grant execute on function public.profile_external_link_is_valid(text) to authenticated;
grant execute on function public.profile_layout_is_valid(jsonb) to authenticated;
commit;
