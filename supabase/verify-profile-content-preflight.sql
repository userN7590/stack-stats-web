-- Read-only. Run the entire file before installing Phase 9C.
begin read only;
set local search_path = pg_catalog, public;
do $$ declare v1 jsonb := '{"version":1,"modules":[{"type":"links","visible":true,"size":"full"},{"type":"stats","visible":true,"size":"full","stats":["coding_minutes"]},{"type":"code_changes","visible":false,"size":"half"},{"type":"languages","visible":false,"size":"half"}]}'; v2 jsonb; begin
  assert to_regprocedure('public.profile_layout_v1_is_valid(jsonb)') is not null, 'Missing visualization prerequisite: v1 helper';
  assert to_regprocedure('public.profile_layout_is_valid(jsonb)') is not null, 'Missing layout validator';
  assert to_regprocedure('public.sync_public_profile_v2(text,text,date)') is not null, 'Phase 9B must be installed first';
  assert to_regprocedure('public.profile_layout_v2_is_valid(jsonb)') is null and to_regprocedure('public.profile_external_link_is_valid(text)') is null, 'Phase 9C is already installed or partial; inspect before replaying';
  assert public.profile_layout_v1_is_valid(v1) and public.profile_layout_is_valid(v1), 'Existing v1 contract is broken';
  v2 := jsonb_set(jsonb_set(v1,'{version}','2'),'{modules}',v1 -> 'modules' || '[{"type":"visualization","id":"viz_check","visible":true,"size":"half","config":{"version":1,"dataset":"language_share","renderer":"donut","appearance":{"palette":"stack"}}}]');
  assert public.profile_layout_is_valid(v2), 'Visualization migration is not fully installed';
  assert not public.profile_layout_is_valid(jsonb_set(v2,'{modules,4,config,renderer}','"waterfall"')), 'Existing chart validation is weakened';
  assert not public.profile_layout_is_valid(jsonb_set(v2,'{version}','3')), 'Unexpected v3 validator; inspect migration state';
  assert (select relrowsecurity from pg_class where oid='public.profiles'::regclass), 'Profiles RLS must remain enabled';
  assert (select not prosecdef from pg_proc where oid='public.update_profile_layout(jsonb)'::regprocedure), 'Layout RPC must use caller RLS';
  assert not has_function_privilege('anon','public.update_profile_layout(jsonb)','EXECUTE') and has_function_privilege('authenticated','public.update_profile_layout(jsonb)','EXECUTE'), 'Layout RPC grants changed';
  assert exists(select 1 from pg_constraint c join pg_depend d on d.classid='pg_constraint'::regclass and d.objid=c.oid where c.conrelid='public.profiles'::regclass and c.conname='profiles_profile_layout_check' and c.convalidated and d.refobjid='public.profile_layout_is_valid(jsonb)'::regprocedure::oid), 'Layout CHECK must reference the active validator';
  raise notice 'Phase 9C prerequisites passed. Run the entire profile_content migration, then verify-production.sql.';
end $$;
rollback;
