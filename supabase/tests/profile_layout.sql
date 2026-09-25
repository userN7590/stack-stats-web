-- Disposable database only. Real database roles exercise grants and RLS; every
-- fixture and write is rolled back. Never run this file in a hosted project.
begin;

insert into auth.users(id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222'),
  ('33333333-3333-4333-8333-333333333333');
insert into public.profiles (
  user_id, username, bio, lines_added, lines_removed, files_changed,
  edit_events, projects_count, coding_minutes, display_font, background_style,
  updated_at
) values
  ('11111111-1111-4111-8111-111111111111', 'layout_one', 'Keep my manual values',
   123, 45, 6, 78, 9, 100, 'terminal', 'aurora', '2026-01-01T00:00:00Z'),
  ('22222222-2222-4222-8222-222222222222', 'layout_two', null,
   456, 0, 0, 0, 0, 0, 'editorial', 'none', '2026-01-02T00:00:00Z');
insert into public.profile_languages(user_id, name, percentage)
values ('11111111-1111-4111-8111-111111111111', 'TypeScript', 100);
insert into public.sync_installations(user_id, installation_id)
values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.sync_days(user_id, installation_id, date, revision, payload)
values (
  '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', current_date, 1,
  jsonb_build_object(
    'schemaVersion', '1', 'aggregationVersion', 1, 'date', current_date::text,
    'revision', 1, 'activeMs', 30000, 'editCount', 2, 'linesAdded', 4,
    'linesRemoved', 2, 'sessionCount', 1, 'fileCount', 1,
    'languages', jsonb_build_array(jsonb_build_object(
      'id', 'typescript', 'activeMs', 30000, 'editCount', 2, 'linesAdded', 4, 'linesRemoved', 2
    )),
    'projects', jsonb_build_array(jsonb_build_object(
      'id', repeat('a', 64), 'activeMs', 30000, 'editCount', 2, 'linesAdded', 4, 'linesRemoved', 2
    ))
  )
);
insert into public.sync_privacy(user_id, publish_profile, publish_languages)
values ('11111111-1111-4111-8111-111111111111', true, false);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
do $$ begin
  perform public.extension_exchange(
    public.extension_authorize(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      'vscode://undefined_publisher.stack-stats-vscode/auth/callback'
    ),
    'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
    'vscode://undefined_publisher.stack-stats-vscode/auth/callback'
  );
end $$;

create function pg_temp.profile_layout_snapshot()
returns jsonb language sql security invoker set search_path = '' as $$
  select jsonb_build_object(
    'profiles', (select jsonb_agg(to_jsonb(p) - 'profile_layout' order by user_id) from public.profiles p),
    'languages', (select jsonb_agg(to_jsonb(l) order by id) from public.profile_languages l),
    'installations', (select jsonb_agg(to_jsonb(i) order by user_id, installation_id) from public.sync_installations i),
    'days', (select jsonb_agg(to_jsonb(d) order by user_id, installation_id, date) from public.sync_days d),
    'privacy', (select jsonb_agg(to_jsonb(p) order by user_id) from public.sync_privacy p),
    'connections', (select jsonb_agg(to_jsonb(c) order by id) from public.extension_connections c),
    'access', (select jsonb_agg(to_jsonb(t) order by token_hash) from public.extension_access_tokens t),
    'publicStats', public.sync_public_profile('layout_one')
  );
$$;
create temporary table layout_test_baseline as select pg_temp.profile_layout_snapshot() as value;
create temporary table layout_test_config(layout jsonb);
insert into layout_test_config values ('{
  "version": 1,
  "modules": [
    {"type":"languages","visible":true,"size":"half"},
    {"type":"stats","visible":true,"size":"full","stats":["coding_minutes","lines_added"]},
    {"type":"links","visible":false,"size":"half"},
    {"type":"code_changes","visible":true,"size":"full"}
  ]
}');
grant select on layout_test_config to anon, authenticated;

do $$ begin
  assert (select bool_and(profile_layout is null) from public.profiles), 'Existing/new profiles must default to NULL';
  assert public.profile_layout_is_valid(null), 'NULL is the default-layout sentinel';
  assert not has_function_privilege('anon', 'public.update_profile_layout(jsonb)', 'EXECUTE');
  assert has_function_privilege('authenticated', 'public.update_profile_layout(jsonb)', 'EXECUTE');
  assert not has_table_privilege('anon', 'public.profiles', 'UPDATE');
  assert (select not prosecdef from pg_proc where oid = 'public.update_profile_layout(jsonb)'::regprocedure), 'RPC must honor caller RLS';
end $$;

set local role authenticated;
do $$
declare
  layout jsonb := (select c.layout from layout_test_config c);
  invalid jsonb;
  changed integer;
begin
  assert public.profile_layout_is_valid(jsonb_set(layout, '{modules,1,stats}', '["lines_added"]'));
  assert public.profile_layout_is_valid(jsonb_set(layout, '{modules,1,stats}', '["lines_added","lines_removed","files_changed","edit_events","projects_count","coding_minutes"]'));
  perform public.update_profile_layout(layout);
  assert (select profile_layout from public.profiles where username = 'layout_one') = layout;
  assert (select profile_layout from public.profiles where username = 'layout_two') is null;
  -- JSON array order, half/full sizes, visibility, and stat selection round trip.
  assert (select profile_layout #>> '{modules,0,type}' from public.profiles where username = 'layout_one') = 'languages';
  assert (select profile_layout #> '{modules,1,stats}' from public.profiles where username = 'layout_one') = '["coding_minutes","lines_added"]'::jsonb;
  perform public.update_profile_layout(layout); -- No-op saves preserve freshness too.

  foreach invalid in array array[
    'null'::jsonb, '[]'::jsonb, '{}'::jsonb,
    layout || '{"version":3}', layout || '{"version":"1"}',
    layout || '{"user_id":"22222222-2222-4222-8222-222222222222"}',
    layout - 'version', layout || '{"modules":null}', layout #- '{modules,3}',
    layout #- '{modules,0,visible}', layout #- '{modules,0,size}', layout #- '{modules,1,stats}',
    jsonb_set(layout, '{modules,0}', 'null'),
    jsonb_set(layout, '{modules,0,type}', '"heatmap"'),
    jsonb_set(layout, '{modules,0,type}', '"links"'),
    jsonb_set(layout, '{modules,0,visible}', '"true"'),
    jsonb_set(layout, '{modules,0,size}', '"huge"'),
    jsonb_set(layout, '{modules,0,stats}', '["lines_added"]'),
    jsonb_set(layout, '{modules,1,size}', '"half"'),
    jsonb_set(layout, '{modules,1,stats}', 'null'),
    jsonb_set(layout, '{modules,1,stats}', '[]'),
    jsonb_set(layout, '{modules,1,stats}', '["lines_added","lines_added"]'),
    jsonb_set(layout, '{modules,1,stats}', '["streak"]'),
    jsonb_set(layout, '{modules,1,stats}', '[1]'),
    jsonb_set(jsonb_set(jsonb_set(layout, '{modules,0,visible}', 'false'), '{modules,1,visible}', 'false'), '{modules,3,visible}', 'false')
  ] loop
    begin
      perform public.update_profile_layout(invalid);
      raise exception 'Invalid layout passed the RPC: %', invalid;
    exception when sqlstate '22023' then null; end;
    begin
      update public.profiles set profile_layout = invalid where username = 'layout_one';
      raise exception 'Invalid layout bypassed CHECK via direct update: %', invalid;
    exception when check_violation then null; end;
  end loop;
  assert (select profile_layout from public.profiles where username = 'layout_one') = layout, 'Rejected writes must preserve saved configuration';

  update public.profiles set profile_layout = layout where username = 'layout_two';
  get diagnostics changed = row_count;
  assert changed = 0, 'RLS must block changing another profile';
  perform public.update_profile_layout(null);
  assert (select profile_layout from public.profiles where username = 'layout_one') is null;
  -- Direct owner writes remain supported by the existing table grants.
  update public.profiles set profile_layout = layout where username = 'layout_one';
  assert (select profile_layout from public.profiles where username = 'layout_one') = layout;

  perform set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  perform public.update_profile_layout(layout);
  assert (select profile_layout from public.profiles where username = 'layout_two') = layout, 'RPC must derive the owner from auth.uid()';
  perform public.update_profile_layout(null);
  perform set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
  begin
    perform public.update_profile_layout(layout);
    raise exception 'Missing profile did not fail';
  exception when no_data_found then null; end;
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.update_profile_layout(layout);
    raise exception 'Missing identity did not fail';
  exception when insufficient_privilege then null; end;
end $$;

set local role anon;
do $$
declare layout jsonb := (select c.layout from layout_test_config c);
begin
  assert (select profile_layout from public.profiles where username = 'layout_one') = layout, 'Signed-out profiles must read the saved layout';
  assert public.sync_public_profile('layout_one')->'languages' = '[]'::jsonb, 'Layout cannot publish private languages';
  begin
    perform public.update_profile_layout(layout);
    raise exception 'Anonymous layout RPC accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set profile_layout = null where username = 'layout_one';
    raise exception 'Anonymous direct update accepted';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
do $$ begin
  assert pg_temp.profile_layout_snapshot() = (select value from layout_test_baseline),
    'Layout changes must preserve profile timestamps/manual values, languages, appearance, publication, telemetry, and linked accounts';
end $$;

-- Older forms still update their original columns without resetting the layout.
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
set local role authenticated;
do $$ begin
  perform public.update_profile_appearance('modern', 'blueprint');
  assert (select profile_layout from public.profiles where username = 'layout_one') = (select layout from layout_test_config);
  assert (select updated_at from public.profiles where username = 'layout_one') = now(), 'Existing appearance saves retain timestamp behavior';
  perform public.save_profile('layout_one', 'Updated name', 'Manual edit', null, null, null,
    321, 54, 6, 78, 9, 100, '[{"name":"TypeScript","percentage":100}]');
  assert (select profile_layout from public.profiles where username = 'layout_one') = (select layout from layout_test_config);
  assert (select lines_added from public.profiles where username = 'layout_one') = 321;
  assert (select display_font from public.profiles where username = 'layout_one') = 'modern';
end $$;
reset role;
do $$ begin
  raise notice 'Profile layout SQL assertions passed: strict validation, grants/RLS, ownership, public reads, default/reset, array order, data/freshness preservation, and existing form compatibility.';
end $$;
rollback;
