-- Read-only post-migration assertions. Safe for the hosted SQL Editor.
-- No credentials, user records, token hashes or telemetry are selected.
begin read only;
do $$
declare relation_name text; role_name text; item record;
begin
  assert exists (
    select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace
    where e.extname='pgcrypto' and n.nspname='extensions'
  ), 'pgcrypto must be installed in the extensions schema';
  foreach relation_name in array array[
    'extension_auth_codes','extension_connections','extension_access_tokens',
    'extension_refresh_history','sync_installations','sync_days','sync_privacy','sync_rate_limits'
  ] loop
    assert to_regclass('public.' || relation_name) is not null, 'Missing table: ' || relation_name;
    assert (select relrowsecurity from pg_class where oid=to_regclass('public.' || relation_name)), 'RLS disabled: ' || relation_name;
    foreach role_name in array array['anon','authenticated'] loop
      assert not has_table_privilege(role_name, 'public.' || relation_name, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
        'Unexpected direct access: ' || role_name || ' ' || relation_name;
    end loop;
  end loop;
  for item in select * from (values
    ('extension_authorize(text,text)',false,true),
    ('extension_authorize_stats(text,text)',false,true),
    ('extension_exchange(text,text,text)',true,true),
    ('extension_refresh(text)',true,true),
    ('extension_refresh_stats(text,text)',true,true),
    ('extension_account(text)',true,true),
    ('extension_revoke(text)',true,true),
    ('extension_revoke_all()',false,true),
    ('sync_put_day(text,uuid,date,jsonb)',true,true),
    ('sync_private_summary(text,date)',false,true),
    ('sync_get_privacy()',false,true),
    ('sync_set_privacy(boolean,boolean)',false,true),
    ('sync_public_profile(text)',true,true),
    ('sync_aggregate(uuid,date,date)',false,false),
    ('sync_validate_day(jsonb)',false,false)
  ) as checks(signature,anon_allowed,authenticated_allowed) loop
    assert to_regprocedure('public.' || item.signature) is not null, 'Missing function: ' || item.signature;
    assert has_function_privilege('anon','public.' || item.signature,'EXECUTE')=item.anon_allowed, 'Incorrect anon grant: ' || item.signature;
    assert has_function_privilege('authenticated','public.' || item.signature,'EXECUTE')=item.authenticated_allowed, 'Incorrect authenticated grant: ' || item.signature;
  end loop;
  assert exists(select 1 from information_schema.columns where table_schema='public' and table_name='extension_connections' and column_name='scope'), 'Missing connection scope';
  assert exists(select 1 from information_schema.columns where table_schema='public' and table_name='extension_auth_codes' and column_name='scope'), 'Missing code scope';
  raise notice 'Auth/sync schema, RLS and grants passed. Verify migration history and run the browser/editor E2E separately.';
end $$;
rollback;
