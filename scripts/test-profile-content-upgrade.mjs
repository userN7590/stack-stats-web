// Disposable database only; run immediately before the Phase 9C migration.
export async function testProfileContentUpgrade(sql, migration, preflight) {
  if (!/^begin;\s/m.test(migration) || !/\ncommit;\s*$/.test(migration)) throw new Error("Profile content migration must be transactional");
  await sql(`
    insert into auth.users(id) values ('77777777-7777-4777-8777-777777777771'), ('77777777-7777-4777-8777-777777777772');
    insert into public.profiles(user_id,username,profile_layout) values
      ('77777777-7777-4777-8777-777777777771','content_upgrade_v1','{"version":1,"modules":[{"type":"links","visible":true,"size":"full"},{"type":"stats","visible":true,"size":"full","stats":["coding_minutes"]},{"type":"code_changes","visible":false,"size":"half"},{"type":"languages","visible":false,"size":"half"}]}');
    insert into public.profiles(user_id,username,profile_layout) select
      '77777777-7777-4777-8777-777777777772','content_upgrade_v2', jsonb_set(jsonb_set(profile_layout,'{version}','2'),'{modules}',profile_layout->'modules' || '[{"type":"visualization","id":"viz_old","visible":true,"size":"half","config":{"version":1,"dataset":"language_share","renderer":"dots","appearance":{"palette":"custom","colors":["#abcdef"]}}}]') from public.profiles where username='content_upgrade_v1';
    create function auth.content_upgrade_snapshot() returns jsonb language sql as $snapshot$
      select jsonb_build_object(
        'profiles',(select jsonb_agg(to_jsonb(p) order by user_id) from public.profiles p),
        'privacy',(select jsonb_agg(to_jsonb(p) order by user_id) from public.sync_privacy p),
        'tables',(select jsonb_agg(to_jsonb(c) order by c.oid) from pg_class c where c.relnamespace='public'::regnamespace),
        'policies',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_policy p),
        'constraints',(select jsonb_agg(to_jsonb(c) order by c.oid) from pg_constraint c where c.conrelid='public.profiles'::regclass),
        'rpc',(select to_jsonb(p) from pg_proc p where p.oid='public.update_profile_layout(jsonb)'::regprocedure),
        'validatorOid','public.profile_layout_is_valid(jsonb)'::regprocedure::oid);
    $snapshot$;
    create table auth.content_upgrade_snapshot as select auth.content_upgrade_snapshot() value,
      (select prosrc from pg_proc where oid='public.profile_layout_is_valid(jsonb)'::regprocedure) original_body;
  `);
  await sql(preflight);
  let failed = false;
  try { await sql(migration.replace(/\ncommit;\s*$/, "\nselect 1 / 0;\ncommit;")); }
  catch (error) { if (!(error.stderr?.toString() || error.message).includes("division by zero")) throw error; failed = true; }
  finally { await sql("rollback;"); }
  if (!failed) throw new Error("Forced migration failure must roll back");
  await sql(`do $$ begin
    assert to_regprocedure('public.profile_layout_v2_is_valid(jsonb)') is null;
    assert to_regprocedure('public.profile_external_link_is_valid(text)') is null;
    assert (select prosrc from pg_proc where oid='public.profile_layout_is_valid(jsonb)'::regprocedure)=(select original_body from auth.content_upgrade_snapshot);
    assert auth.content_upgrade_snapshot()=(select value from auth.content_upgrade_snapshot);
  end $$;`);
  await sql(preflight);
  await sql(migration);
  await sql(`do $$ begin
    assert auth.content_upgrade_snapshot()=(select value from auth.content_upgrade_snapshot), 'Upgrade must preserve rows, publication, table ACL/RLS, CHECK OID and RPC';
    assert (select prosrc from pg_proc where oid='public.profile_layout_v2_is_valid(jsonb)'::regprocedure)=(select original_body from auth.content_upgrade_snapshot), 'V2 helper must retain the original implementation verbatim';
    assert not exists(select 1 from public.profiles where not public.profile_layout_is_valid(profile_layout));
  end $$;`);
  failed = false;
  try { await sql(preflight); } catch (error) { if (!(error.stderr?.toString() || error.message).includes("already installed or partial")) throw error; failed = true; }
  finally { await sql("rollback;"); }
  if (!failed) throw new Error("Preflight must refuse replay");
  await sql(`delete from auth.users where id in ('77777777-7777-4777-8777-777777777771','77777777-7777-4777-8777-777777777772'); drop table auth.content_upgrade_snapshot; drop function auth.content_upgrade_snapshot();`);
  console.log("PASS profile content upgrade/rollback preserves v1/v2 layouts, data, publication, CHECK, RPC, grants and RLS");
}
