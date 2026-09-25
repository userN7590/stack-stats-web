-- Read-only post-migration assertions. Safe for the hosted SQL Editor.
-- No credentials, user records, token hashes or telemetry are selected.
begin read only;
set local search_path = pg_catalog, public;
do $$
declare
  relation_name text;
  role_name text;
  item record;
  profile_policy record;
  permissive_count integer;
  layout_v1 jsonb := '{"version":1,"modules":[{"type":"links","visible":true,"size":"full"},{"type":"stats","visible":true,"size":"full","stats":["coding_minutes"]},{"type":"code_changes","visible":false,"size":"half"},{"type":"languages","visible":false,"size":"half"}]}';
  layout_v2 jsonb;
  owner_expressions text[] := array[
    'selectauth.uidasuid=user_id', 'selectauth.uid=user_id', 'auth.uid=user_id'
  ];
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
    ('sync_validate_day(jsonb)',false,false),
    ('update_profile_layout(jsonb)',false,true),
    ('profile_layout_is_valid(jsonb)',false,true),
    ('profile_layout_v1_is_valid(jsonb)',false,true),
    ('set_profile_updated_at()',false,false)
  ) as checks(signature,anon_allowed,authenticated_allowed) loop
    assert to_regprocedure('public.' || item.signature) is not null, 'Missing function: ' || item.signature;
    assert has_function_privilege('anon','public.' || item.signature,'EXECUTE')=item.anon_allowed, 'Incorrect anon grant: ' || item.signature;
    assert has_function_privilege('authenticated','public.' || item.signature,'EXECUTE')=item.authenticated_allowed, 'Incorrect authenticated grant: ' || item.signature;
  end loop;
  assert exists(select 1 from information_schema.columns where table_schema='public' and table_name='extension_connections' and column_name='scope'), 'Missing connection scope';
  assert exists(select 1 from information_schema.columns where table_schema='public' and table_name='extension_auth_codes' and column_name='scope'), 'Missing code scope';
  assert exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='profile_layout'
      and data_type='jsonb' and is_nullable='YES'
  ), 'Missing nullable profile_layout JSONB column';
  assert exists (
    select 1 from pg_constraint
    where conrelid='public.profiles'::regclass
      and conname='profiles_profile_layout_check' and contype='c' and convalidated
  ), 'Missing validated profile layout constraint';
  assert (select relrowsecurity from pg_class where oid='public.profiles'::regclass), 'Profiles RLS must remain enabled';
  -- Hosted Supabase may grant DML through default privileges. GRANT SELECT in
  -- our first migration does not revoke those pre-existing grants. Table ACLs
  -- say which commands are reachable, not which rows RLS allows them to change.
  -- Check the actual migration's policy contract, including inherited roles,
  -- PUBLIC and FOR ALL policies. Policy names alone are not a security check.
  foreach role_name in array array['anon', 'authenticated'] loop
    assert (select not rolsuper and not rolbypassrls from pg_roles where rolname = role_name),
      'Client role must not bypass RLS: ' || role_name;
    assert not pg_has_role(role_name, (select relowner from pg_class where oid = 'public.profiles'::regclass), 'USAGE'),
      'Client role must not own/inherit ownership of profiles: ' || role_name;
    assert has_schema_privilege(role_name, 'public', 'USAGE'), 'Missing public schema access: ' || role_name;

    for item in select * from (values
      ('SELECT', 'r'), ('INSERT', 'a'), ('UPDATE', 'w'), ('DELETE', 'd')
    ) as commands(privilege, command) loop
      if role_name = 'authenticated' or item.command = 'r' then
        -- Separate calls matter: a comma-separated privilege list means ANY,
        -- not ALL, in has_table_privilege().
        assert has_table_privilege(role_name, 'public.profiles', item.privilege),
          'Missing profile ' || item.privilege || ' grant: ' || role_name;
      end if;

      permissive_count := 0;
      for profile_policy in
        select p.polname, p.polpermissive,
          regexp_replace(lower(pg_get_expr(p.polqual, p.polrelid)), '[[:space:]()]', '', 'g') as using_expression,
          regexp_replace(lower(pg_get_expr(coalesce(p.polwithcheck, p.polqual), p.polrelid)), '[[:space:]()]', '', 'g') as check_expression
        from pg_policy p
        where p.polrelid = 'public.profiles'::regclass
          and p.polcmd::text in (item.command, '*')
          and exists (
            select 1 from unnest(p.polroles) as roles(role_oid)
            where case when role_oid = 0 then true
              else pg_has_role(role_name, role_oid, 'USAGE') end
          )
      loop
        if profile_policy.polpermissive then
          permissive_count := permissive_count + 1;
        end if;
        if role_name = 'anon' and item.command <> 'r' then
          -- Without an applicable permissive write policy, RLS denies every
          -- row regardless of table/column DML grants. Restrictive policies
          -- cannot independently grant access.
          assert not profile_policy.polpermissive,
            'Anonymous profile write policy is forbidden: ' || profile_policy.polname;
        elsif item.command = 'r' then
          assert coalesce(profile_policy.using_expression = 'true', false),
            'Public profile SELECT policy has changed: ' || profile_policy.polname;
        else
          -- Accept the original scalar-subquery auth.uid() and its direct
          -- equivalent, ignoring deparser whitespace/parentheses only. Reject
          -- unexpected expressions rather than guessing that they are safe.
          if item.command in ('w', 'd') then
            assert coalesce(profile_policy.using_expression = any(owner_expressions), false),
              'Profile write USING must match auth.uid() to user_id: ' || profile_policy.polname;
          end if;
          if item.command in ('a', 'w') then
            assert coalesce(profile_policy.check_expression = any(owner_expressions), false),
              'Profile write WITH CHECK must match auth.uid() to user_id: ' || profile_policy.polname;
          end if;
        end if;
      end loop;
      if role_name = 'authenticated' or item.command = 'r' then
        assert permissive_count > 0,
          'Missing applicable profile ' || item.privilege || ' policy: ' || role_name;
      end if;
    end loop;
  end loop;

  assert has_column_privilege('anon','public.profiles','profile_layout','SELECT'), 'Public profiles must read layouts';
  assert (select not prosecdef from pg_proc where oid='public.update_profile_layout(jsonb)'::regprocedure), 'Layout RPC must retain caller RLS';
  assert not exists (
    select 1 from pg_proc p,
      lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) as acl
    where p.oid = 'public.update_profile_layout(jsonb)'::regprocedure
      and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
  ), 'Layout RPC must not grant EXECUTE to PUBLIC';
  assert exists (
    select 1 from pg_trigger where tgrelid='public.profiles'::regclass
      and tgname='profiles_set_updated_at' and not tgisinternal
      and tgfoid='public.set_profile_updated_at()'::regprocedure
  ), 'Missing layout-aware profile timestamp trigger';
  -- Pure validation of synthetic configuration only; no profile data is read.
  assert public.profile_layout_is_valid(null), 'Default layout sentinel must remain supported';
  assert public.profile_layout_is_valid(layout_v1), 'Existing v1 layouts must remain valid';
  assert public.profile_layout_v1_is_valid(layout_v1), 'Legacy layout helper must preserve v1';
  layout_v2 := jsonb_set(jsonb_set(layout_v1, '{version}', '2'), '{modules}', layout_v1 -> 'modules' ||
    '[{"type":"visualization","id":"viz_verify","visible":true,"size":"half","config":{"version":1,"dataset":"language_share","renderer":"polar_area","appearance":{"palette":"neon"}}}]'::jsonb);
  assert public.profile_layout_is_valid(layout_v2), 'Visualization v2 configuration must be accepted';
  assert not public.profile_layout_v1_is_valid(layout_v2), 'Legacy helper must reject future layouts';
  assert not public.profile_layout_is_valid(jsonb_set(layout_v2, '{modules,4,config,renderer}', '"waterfall"')),
    'Incompatible visualization dataset and renderer must be rejected';
  assert not public.profile_layout_is_valid(jsonb_set(layout_v2, '{version}', '3')),
    'Unknown layout versions must be rejected on save';
  raise notice 'Auth/sync/layout/visualization schema, RLS and grants passed. Verify migration history and run the browser/editor E2E separately.';
end $$;

-- Metadata only. These ACL booleans may be true on hosted Supabase even though
-- the policies verified above deny anonymous INSERT/UPDATE/DELETE row access.
select role_name,
  has_table_privilege(role_name, 'public.profiles', 'SELECT') as table_select_grant,
  has_table_privilege(role_name, 'public.profiles', 'INSERT') as table_insert_grant,
  has_table_privilege(role_name, 'public.profiles', 'UPDATE') as table_update_grant,
  has_table_privilege(role_name, 'public.profiles', 'DELETE') as table_delete_grant,
  has_function_privilege(role_name, 'public.update_profile_layout(jsonb)', 'EXECUTE') as layout_rpc_execute
from (values ('anon'), ('authenticated')) as roles(role_name);
rollback;
