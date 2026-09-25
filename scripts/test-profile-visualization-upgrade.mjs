// Disposable database only. Called immediately before the visualization
// migration, with the actual v1 migration chain already installed.
export async function testProfileVisualizationUpgrade(executeSql, migration, preflight, verifier) {
  if (!/^begin;\s/m.test(migration) || !/\ncommit;\s*$/.test(migration)) {
    throw new Error("Visualization migration must retain explicit transaction boundaries");
  }
  await executeSql(`
    insert into auth.users(id) values ('99999999-9999-4999-8999-999999999999');
    insert into public.profiles(user_id, username, profile_layout, lines_added, updated_at) values (
      '99999999-9999-4999-8999-999999999999', 'visualization_upgrade_fixture',
      '{"version":1,"modules":[{"type":"links","visible":true,"size":"full"},{"type":"stats","visible":true,"size":"full","stats":["coding_minutes"]},{"type":"code_changes","visible":false,"size":"half"},{"type":"languages","visible":false,"size":"half"}]}',
      123, '2026-01-01');
    create function auth.visualization_upgrade_snapshot() returns jsonb language sql as $snapshot$
      select jsonb_build_object(
        'profiles', (select jsonb_agg(to_jsonb(p) order by user_id) from public.profiles p),
        'tables', (select jsonb_agg(to_jsonb(c) order by c.oid) from pg_class c where c.relnamespace='public'::regnamespace),
        'policies', (select jsonb_agg(to_jsonb(p) order by p.oid) from pg_policy p),
        'constraints', (select jsonb_agg(to_jsonb(c) order by c.oid) from pg_constraint c where c.conrelid='public.profiles'::regclass),
        'rpc', (select to_jsonb(p) from pg_proc p where p.oid='public.update_profile_layout(jsonb)'::regprocedure),
        'validatorOid', 'public.profile_layout_is_valid(jsonb)'::regprocedure::oid
      );
    $snapshot$;
    create table auth.visualization_upgrade_snapshot as select
      auth.visualization_upgrade_snapshot() as value,
      pg_get_functiondef('public.profile_layout_is_valid(jsonb)'::regprocedure) as original_validator;
  `);
  await executeSql(preflight);
  console.log("PASS visualization preflight accepts the reported original-v1 production state");

  let failure;
  try {
    await executeSql(verifier);
  } catch (error) {
    failure = error;
  } finally {
    await executeSql("rollback;");
  }
  const verifierError = failure?.stderr?.toString() || failure?.message || "";
  if (!verifierError.includes("Missing function: profile_layout_v1_is_valid(jsonb)")) {
    throw new Error(`Expected the exact reported production mismatch, received: ${verifierError}`);
  }
  console.log("PASS v1-only schema reproduces the exact production verifier failure");

  // Run the actual file with a forced error AFTER its helper, replacement and
  // grants. The explicit transaction must undo every one of those statements.
  failure = undefined;
  try {
    await executeSql(migration.replace(/\ncommit;\s*$/, "\nselect 1 / 0;\ncommit;"));
  } catch (error) {
    failure = error;
  } finally {
    await executeSql("rollback;");
  }
  const errorText = failure?.stderr?.toString() || failure?.message || "";
  if (!errorText.includes("division by zero")) throw new Error(`Expected forced migration failure, received: ${errorText}`);
  await executeSql(`do $$ begin
    assert to_regprocedure('public.profile_layout_v1_is_valid(jsonb)') is null;
    assert pg_get_functiondef('public.profile_layout_is_valid(jsonb)'::regprocedure) =
      (select original_validator from auth.visualization_upgrade_snapshot);
    assert auth.visualization_upgrade_snapshot() = (select value from auth.visualization_upgrade_snapshot);
  end $$;`);
  await executeSql(preflight);
  console.log("PASS failed visualization transaction restores original v1 body, missing helper, rows, CHECK, RPC and RLS/grants");

  await executeSql(migration);
  await executeSql(`do $$ declare v1 jsonb; v2 jsonb; begin
    assert auth.visualization_upgrade_snapshot() = (select value from auth.visualization_upgrade_snapshot),
      'Upgrade must preserve rows, timestamps, CHECK binding, RPC, RLS and table grants';
    select profile_layout into v1 from public.profiles where username='visualization_upgrade_fixture';
    v2 := jsonb_set(v1, '{version}', '2');
    v2 := jsonb_set(v2, '{modules}', (v2->'modules') ||
      '[{"type":"visualization","id":"viz_upgrade","visible":true,"size":"half","config":{"version":1,"dataset":"language_share","renderer":"donut","appearance":{"palette":"stack"}}}]');
    assert public.profile_layout_v1_is_valid(v1);
    assert public.profile_layout_is_valid(v1);
    assert public.profile_layout_is_valid(v2);
    assert not public.profile_layout_v1_is_valid(v2);
    assert not public.profile_layout_is_valid(jsonb_set(v2, '{modules,4,config,renderer}', '"waterfall"'));
    assert not has_function_privilege('anon','public.profile_layout_v1_is_valid(jsonb)','EXECUTE');
    assert has_function_privilege('authenticated','public.profile_layout_v1_is_valid(jsonb)','EXECUTE');
  end $$;`);
  console.log("PASS complete visualization file upgrades v1 safely and preserves strict v1/v2 validation");

  // A completed upgrade is deliberately not replayable: CREATE FUNCTION has no
  // OR REPLACE. The read-only preflight must stop a second application early.
  failure = undefined;
  try {
    await executeSql(preflight);
  } catch (error) {
    failure = error;
  } finally {
    await executeSql("rollback;");
  }
  const preflightError = failure?.stderr?.toString() || failure?.message || "";
  if (!preflightError.includes("Preflight refused: the visualization helper already exists")) {
    throw new Error(`Preflight must reject a completed upgrade: ${preflightError}`);
  }
  console.log("PASS visualization preflight refuses an already upgraded schema");
  await executeSql(`
    delete from auth.users where id='99999999-9999-4999-8999-999999999999';
    drop table auth.visualization_upgrade_snapshot;
    drop function auth.visualization_upgrade_snapshot();
  `);
}
