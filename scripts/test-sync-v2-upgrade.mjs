// Disposable database only, at the exact pre-v2 point in the migration chain.
export async function testSyncV2Upgrade(executeSql, migration, preflight) {
  await executeSql(`
    insert into auth.users(id) values('99999999-9999-4999-8999-999999999999');
    insert into public.profiles(user_id,username,lines_added) values('99999999-9999-4999-8999-999999999999','sync_v2_upgrade',321);
    select set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',false);
    create table auth.sync_v2_pair as select public.extension_exchange(
      public.extension_authorize_stats('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM','vscode://undefined_publisher.stack-stats-vscode/auth/callback'),
      'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk','vscode://undefined_publisher.stack-stats-vscode/auth/callback') pair;
    select public.extension_authorize_stats('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM','vscode://undefined_publisher.stack-stats-vscode/auth/callback');
    select public.sync_set_privacy(true,true);
    select public.sync_put_day((select pair->>'accessToken' from auth.sync_v2_pair),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',current_date,
      jsonb_build_object('schemaVersion','1','aggregationVersion',1,'date',current_date::text,'revision',7,
      'activeMs',0,'editCount',0,'linesAdded',0,'linesRemoved',0,'sessionCount',0,'fileCount',0,'languages','[]'::jsonb,'projects','[]'::jsonb));
    create function auth.sync_v2_snapshot() returns jsonb language sql as $snapshot$
      select jsonb_build_object(
        'profiles',(select jsonb_agg(to_jsonb(p) order by user_id) from public.profiles p),
        'days',(select jsonb_agg(to_jsonb(d) order by user_id,installation_id,date) from public.sync_days d),
        'codes',(select jsonb_agg(to_jsonb(c)-array['stats_schema_version','stats_consent_at'] order by code_hash) from public.extension_auth_codes c),
        'connections',(select jsonb_agg(to_jsonb(c)-array['stats_schema_version','stats_consent_at'] order by id) from public.extension_connections c),
        'privacy',(select jsonb_agg(to_jsonb(p)-array['publication_version','published_metrics','publish_schedule'] order by user_id) from public.sync_privacy p),
        'policies',(select jsonb_agg(to_jsonb(p) order by oid) from pg_policy p),
        'grants',(select jsonb_agg(jsonb_build_array(oid,relacl,relrowsecurity) order by oid) from pg_class where relnamespace='public'::regnamespace));
    $snapshot$;
    create table auth.sync_v2_before as select auth.sync_v2_snapshot() value;
  `);
  await executeSql(preflight);
  let failure;
  try { await executeSql(migration.replace(/\ncommit;\s*$/, "\nselect 1 / 0;\ncommit;")); }
  catch (error) { failure = error; }
  finally { await executeSql("rollback;"); }
  if (!(failure?.stderr?.toString() || failure?.message || "").includes("division by zero")) throw new Error("Expected forced v2 migration rollback");
  await executeSql(preflight);
  await executeSql(`do $$ begin assert auth.sync_v2_snapshot()=(select value from auth.sync_v2_before); end $$;`);
  console.log("PASS sync v2 preflight and complete migration rollback preserve actual v1 state");
  await executeSql(migration);
  await executeSql(`do $$ begin
    assert auth.sync_v2_snapshot()=(select value from auth.sync_v2_before), 'Upgrade changed pre-existing data, grants, or RLS';
    assert not exists(select 1 from public.extension_connections where stats_schema_version<>1 or stats_consent_at is not null);
    assert not exists(select 1 from public.extension_auth_codes where stats_schema_version<>1 or stats_consent_at is not null);
    assert not exists(select 1 from public.sync_privacy where publication_version<>1 or published_metrics<>'[]'::jsonb or publish_schedule);
    assert public.sync_capabilities((select pair->>'accessToken' from auth.sync_v2_pair))->'dailyVersions'='["1"]'::jsonb;
    assert public.sync_public_profile('sync_v2_upgrade')->>'recordCount'='1';
  end $$;
  delete from auth.users where id='99999999-9999-4999-8999-999999999999';
  drop table auth.sync_v2_pair,auth.sync_v2_before;
  drop function auth.sync_v2_snapshot();
  select set_config('request.jwt.claim.sub','',false);`);
  console.log("PASS sync v2 upgrade preserves saved v1 rows, consent scopes and publication behavior");
}
