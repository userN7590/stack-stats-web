-- Disposable database only. Never run fixture SQL in a hosted project.
begin;

insert into auth.users(id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
insert into public.profiles(user_id, username, lines_added, lines_removed, bio, display_font, background_style, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', 'visual_one', 123, 45, 'Preserve manual data', 'terminal', 'aurora', '2026-01-01T00:00:00Z'),
  ('22222222-2222-4222-8222-222222222222', 'visual_two', 678, 90, null, 'modern', 'none', '2026-01-02T00:00:00Z');
insert into public.profile_languages(user_id, name, percentage)
values ('11111111-1111-4111-8111-111111111111', 'TypeScript', 100);
insert into public.sync_privacy(user_id, publish_profile, publish_languages)
values ('11111111-1111-4111-8111-111111111111', false, false);

create temporary table visualization_config(layout jsonb);
insert into visualization_config values ('{
  "version":2,
  "modules":[
    {"type":"links","visible":false,"size":"half"},
    {"type":"stats","visible":true,"size":"full","stats":["coding_minutes","lines_added"]},
    {"type":"languages","visible":true,"size":"half"},
    {"type":"code_changes","visible":false,"size":"full"},
    {"type":"visualization","id":"viz_languages","visible":true,"size":"half","config":{
      "version":1,"dataset":"language_share","renderer":"polar_area","appearance":{"palette":"neon"}
    }},
    {"type":"visualization","id":"viz_changes","visible":true,"size":"full","config":{
      "version":1,"dataset":"line_changes","renderer":"waterfall","appearance":{
        "palette":"custom","colors":["#55a7ff","#EEBB99"],"positive":"#77ff99","negative":"#ff6677"
      }
    }}
  ]
}');
grant select on visualization_config to anon, authenticated;

create function pg_temp.visualization_snapshot()
returns jsonb language sql security invoker set search_path = '' as $$
  select jsonb_build_object(
    'profiles', (select jsonb_agg(to_jsonb(p) - 'profile_layout' order by user_id) from public.profiles p),
    'languages', (select jsonb_agg(to_jsonb(l) order by id) from public.profile_languages l),
    'privacy', (select jsonb_agg(to_jsonb(p) order by user_id) from public.sync_privacy p),
    'days', (select jsonb_agg(to_jsonb(d) order by user_id, installation_id, date) from public.sync_days d),
    'connections', (select jsonb_agg(to_jsonb(c) order by id) from public.extension_connections c),
    'publicStats', public.sync_public_profile('visual_one')
  );
$$;
create temporary table visualization_baseline as select pg_temp.visualization_snapshot() as value;

do $$ begin
  assert public.profile_layout_is_valid(null);
  assert not has_function_privilege('anon', 'public.profile_layout_v1_is_valid(jsonb)', 'EXECUTE');
  assert has_function_privilege('authenticated', 'public.profile_layout_v1_is_valid(jsonb)', 'EXECUTE');
  assert (select not prosecdef from pg_proc where oid = 'public.profile_layout_is_valid(jsonb)'::regprocedure);
  assert (select not prosecdef from pg_proc where oid = 'public.profile_layout_v1_is_valid(jsonb)'::regprocedure);
  assert (select not prosecdef from pg_proc where oid = 'public.update_profile_layout(jsonb)'::regprocedure);
end $$;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
set local role authenticated;
do $$
declare
  layout jsonb := (select c.layout from visualization_config c);
  core jsonb := jsonb_set(layout #- '{modules,5}' #- '{modules,4}', '{version}', '1');
  sample jsonb;
  invalid jsonb;
  name text;
  changed integer;
begin
  assert public.profile_layout_is_valid(core), 'Original v1 choices stay accepted';
  assert public.profile_layout_v1_is_valid(core);
  assert not public.profile_layout_v1_is_valid(layout), 'Legacy helper retains strict v1 contract';
  assert public.profile_layout_is_valid(jsonb_set(core, '{version}', '2')), 'v2 allows zero visualizations';
  perform public.update_profile_layout(core);
  assert (select profile_layout from public.profiles where username = 'visual_one') = core;
  perform public.update_profile_layout(layout);
  perform public.update_profile_layout(layout); -- No-op save must preserve freshness.
  assert (select profile_layout from public.profiles where username = 'visual_one') = layout;
  assert (select profile_layout from public.profiles where username = 'visual_two') is null;

  foreach name in array array['bars', 'dots', 'radial_bars', 'polar_area', 'donut'] loop
    assert public.profile_layout_is_valid(jsonb_set(layout, '{modules,4,config,renderer}', to_jsonb(name))), 'All language renderers supported';
  end loop;
  foreach name in array array['stack', 'neon', 'ice', 'sunset', 'accessible', 'mono', 'custom'] loop
    assert public.profile_layout_is_valid(jsonb_set(layout, '{modules,4,config,appearance}', jsonb_build_object('palette', name))), 'Presets and defaulted custom appearance supported';
  end loop;
  assert public.profile_layout_is_valid(jsonb_set(layout, '{modules,4,config,appearance}', '{"palette":"custom","colors":["#000000"]}')),
    'SQL accepts syntactically valid colors; the renderer applies readability fallbacks';
  assert public.profile_layout_is_valid(jsonb_set(layout, '{modules,4,config,appearance}', jsonb_build_object('palette', 'custom', 'colors', (
    select jsonb_agg('#55a7ff'::text) from generate_series(1,8)
  )))), 'Eight custom categorical colors are allowed';
  sample := jsonb_set(layout, '{modules,1,visible}', 'false');
  sample := jsonb_set(sample, '{modules,2,visible}', 'false');
  assert public.profile_layout_is_valid(sample), 'Visible visualizations can accompany all-hidden core sections';
  perform public.update_profile_layout(sample);
  assert (select profile_layout from public.profiles where username = 'visual_one') = sample,
    'Validating hidden core sections must never change their persisted visibility';
  sample := jsonb_set(layout, '{modules}', (layout -> 'modules') || (
    select jsonb_agg(jsonb_set(layout #> '{modules,4}', '{id}', to_jsonb('viz_extra-' || n))) from generate_series(1,4) n
  ));
  assert public.profile_layout_is_valid(sample), 'Six independent visualizations are allowed';
  perform public.update_profile_layout(sample);
  assert (select profile_layout from public.profiles where username = 'visual_one') = sample,
    'Multiple instances with different IDs round trip independently';
  assert not public.profile_layout_is_valid(jsonb_set(sample, '{modules}', sample -> 'modules' ||
    jsonb_build_array(jsonb_set(layout #> '{modules,4}', '{id}', '"viz_seventh"')))), 'Seven visualizations are rejected';
  assert public.profile_layout_is_valid(jsonb_set(layout, '{modules,4,id}', to_jsonb('viz_' || repeat('a', 64)))), 'Maximum bounded identifier accepted';
  perform public.update_profile_layout(layout);

  foreach invalid in array array[
    layout || '{"version":1}', layout || '{"version":3}', layout || '{"version":"2"}', layout || '{"extra":true}',
    layout #- '{modules,0}', layout #- '{modules,0,visible}', layout #- '{modules,0,size}',
    jsonb_set(layout, '{modules,0,type}', '"languages"'),
    jsonb_set(layout, '{modules,0,type}', '"future_module"'),
    jsonb_set(layout, '{modules,1,size}', '"half"'),
    jsonb_set(layout, '{modules,1,stats}', '["coding_minutes","coding_minutes"]'),
    jsonb_set(layout, '{modules,1,stats}', '["future_metric"]'),
    jsonb_set(layout, '{modules,4}', 'null'),
    layout #- '{modules,4,id}', layout #- '{modules,4,config}', layout #- '{modules,4,size}',
    jsonb_set(layout, '{modules,4,id}', '"viz_changes"'),
    jsonb_set(layout, '{modules,4,id}', '"viz_"'),
    jsonb_set(layout, '{modules,4,id}', '"viz_UPPER"'),
    jsonb_set(layout, '{modules,4,id}', '"viz_../path"'),
    jsonb_set(layout, '{modules,4,id}', to_jsonb('viz_' || repeat('a', 65))),
    jsonb_set(layout, '{modules,4,visible}', 'null'),
    jsonb_set(layout, '{modules,4,visible}', '"true"'),
    jsonb_set(layout, '{modules,4,size}', '"huge"'),
    jsonb_set(layout, '{modules,4,privateData}', '{"project":"secret"}'),
    jsonb_set(layout, '{modules,4,config}', 'null'),
    layout #- '{modules,4,config,version}', layout #- '{modules,4,config,dataset}',
    layout #- '{modules,4,config,renderer}', layout #- '{modules,4,config,appearance}',
    jsonb_set(layout, '{modules,4,config,version}', '2'),
    jsonb_set(layout, '{modules,4,config,dataset}', '"weekday_hour_matrix"'),
    jsonb_set(layout, '{modules,4,config,renderer}', '"waterfall"'),
    jsonb_set(layout, '{modules,5,config,renderer}', '"donut"'),
    jsonb_set(layout, '{modules,4,config,renderer}', '"future_renderer"'),
    jsonb_set(layout, '{modules,4,config,from}', '"2026-01-01"'),
    jsonb_set(layout, '{modules,4,config,appearance}', 'null'),
    jsonb_set(layout, '{modules,4,config,appearance}', '{}'),
    jsonb_set(layout, '{modules,4,config,appearance}', '{"palette":"unknown"}'),
    jsonb_set(layout, '{modules,4,config,appearance}', '{"palette":"neon","colors":["#55a7ff"]}'),
    jsonb_set(layout, '{modules,4,config,appearance}', '{"palette":"neon","positive":"#55a7ff"}'),
    jsonb_set(layout, '{modules,4,config,appearance}', '{"palette":"custom","background":"#000000"}'),
    jsonb_set(layout, '{modules,4,config,appearance}', '{"palette":"custom","colors":[]}'),
    jsonb_set(layout, '{modules,4,config,appearance}', '{"palette":"custom","colors":null}'),
    jsonb_set(layout, '{modules,4,config,appearance}', '{"palette":"custom","colors":[null]}'),
    jsonb_set(layout, '{modules,4,config,appearance}', '{"palette":"custom","colors":["red"]}'),
    jsonb_set(layout, '{modules,4,config,appearance}', '{"palette":"custom","colors":["#abc"]}'),
    jsonb_set(layout, '{modules,4,config,appearance}', '{"palette":"custom","positive":null}'),
    jsonb_set(layout, '{modules,4,config,appearance}', '{"palette":"custom","negative":"url(https://example.com)"}'),
    jsonb_set(layout, '{modules,4,config,appearance}', jsonb_build_object('palette', 'custom', 'colors', (
      select jsonb_agg('#55a7ff'::text) from generate_series(1,9)
    ))),
    jsonb_set(layout, '{modules}', (select jsonb_agg(jsonb_set(item, '{visible}', 'false')) from jsonb_array_elements(layout -> 'modules') item))
  ] loop
    assert not public.profile_layout_is_valid(invalid), 'Invalid visualization config must fail the validator: ' || invalid;
    begin
      perform public.update_profile_layout(invalid);
      raise exception 'Invalid visualization passed the RPC: %', invalid;
    exception when sqlstate '22023' then null; end;
    begin
      update public.profiles set profile_layout = invalid where username = 'visual_one';
      raise exception 'Invalid visualization bypassed the table CHECK: %', invalid;
    exception when check_violation then null; end;
  end loop;
  assert (select profile_layout from public.profiles where username = 'visual_one') = layout, 'Rejected writes leave the saved draft intact';
  update public.profiles set profile_layout = layout where username = 'visual_two';
  get diagnostics changed = row_count;
  assert changed = 0, 'Visualization writes retain owner-scoped RLS';
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.update_profile_layout(layout);
    raise exception 'Missing owner identity accepted';
  exception when insufficient_privilege then null; end;
end $$;

set local role anon;
do $$
declare layout jsonb := (select c.layout from visualization_config c);
begin
  assert (select profile_layout from public.profiles where username = 'visual_one') = layout, 'Signed-out readers receive the persisted config';
  assert public.sync_public_profile('visual_one') is null, 'Adding a visualization cannot publish private activity';
  begin
    perform public.update_profile_layout(layout);
    raise exception 'Anonymous visualization save accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  assert pg_temp.visualization_snapshot() = (select value from visualization_baseline),
    'Presentation saves preserve timestamps, manual values, appearance, languages, privacy, telemetry, and connections';
  raise notice 'Visualization SQL assertions passed: v1/v2, strict config/compatibility/color checks, limits, RPC/CHECK parity, owner RLS, public reads, and data preservation.';
end $$;
rollback;
