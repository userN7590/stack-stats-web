// Run only against the disposable database created by test-database.mjs.
// Each scenario rolls back its grants, policies, roles, and test records.
export async function testProductionVerifier(executeSql, verifier) {
  const body = verifier
    .replace(/^begin read only;$/m, "")
    .replace(/^rollback;$/m, "");
  const scenarios = [
    { name: "explicit grants", setup: "" },
    {
      name: "hosted DML grants with RLS denial",
      setup: `grant insert, update, delete on public.profiles to anon;
        do $$ begin
          assert has_table_privilege('anon', 'public.profiles', 'INSERT,UPDATE,DELETE'),
            'Fixture must reproduce the old verifier failure';
        end $$;`,
    },
    { name: "PUBLIC DML grants with RLS denial", setup: "grant insert, update, delete on public.profiles to public;" },
    {
      name: "inherited DML grants with RLS denial",
      setup: "create role verifier_group; grant verifier_group to anon; grant insert, update, delete on public.profiles to verifier_group;",
    },
    { name: "disabled RLS", setup: "alter table public.profiles disable row level security;", error: "Profiles RLS must remain enabled" },
    { name: "RLS bypass role", setup: "alter role anon bypassrls;", error: "Client role must not bypass RLS" },
    { name: "table ownership membership", setup: "create role verifier_owner; alter table public.profiles owner to verifier_owner; grant verifier_owner to anon;", error: "Client role must not own/inherit ownership" },
    ...["insert", "update", "delete", "all"].map((command) => ({
      name: `anonymous ${command} policy`,
      setup: `create policy verifier_unsafe on public.profiles for ${command} to anon ${command === "insert" ? "with check (true)" : "using (true)"};`,
      error: "Anonymous profile write policy is forbidden",
    })),
    { name: "PUBLIC write policy", setup: "create policy verifier_unsafe on public.profiles for delete to public using (true);", error: "Anonymous profile write policy is forbidden" },
    {
      name: "inherited role write policy",
      setup: "create role verifier_group; grant verifier_group to anon; create policy verifier_unsafe on public.profiles for delete to verifier_group using (true);",
      error: "Anonymous profile write policy is forbidden",
    },
    { name: "owner INSERT predicate drift", setup: 'alter policy "Users can insert their own profile" on public.profiles with check (true);', error: "Profile write WITH CHECK must match" },
    { name: "owner UPDATE USING drift", setup: 'alter policy "Users can update their own profile" on public.profiles using (true);', error: "Profile write USING must match" },
    { name: "owner UPDATE CHECK drift", setup: 'alter policy "Users can update their own profile" on public.profiles with check (true);', error: "Profile write WITH CHECK must match" },
    { name: "owner DELETE predicate drift", setup: 'alter policy "Users can delete their own profile" on public.profiles using (true);', error: "Profile write USING must match" },
    { name: "extra permissive owner policy", setup: "create policy verifier_unsafe on public.profiles for update to authenticated using (true) with check (true);", error: "Profile write USING must match" },
    { name: "missing owner policy", setup: 'drop policy "Users can delete their own profile" on public.profiles;', error: "Missing applicable profile DELETE policy" },
    { name: "missing owner table grant", setup: "revoke delete on public.profiles from authenticated;", error: "Missing profile DELETE grant" },
    { name: "missing public SELECT grant", setup: "revoke select on public.profiles from anon;", error: "Missing profile SELECT grant" },
    { name: "public SELECT predicate drift", setup: 'alter policy "Profiles are publicly readable" on public.profiles using (false);', error: "Public profile SELECT policy has changed" },
    { name: "restrictive SELECT blocks public rows", setup: "create policy verifier_restrictive on public.profiles as restrictive for select to anon using (false);", error: "Public profile SELECT policy has changed" },
    { name: "anonymous RPC execution", setup: "grant execute on function public.update_profile_layout(jsonb) to anon;", error: "Incorrect anon grant: update_profile_layout" },
    { name: "PUBLIC RPC execution", setup: "grant execute on function public.update_profile_layout(jsonb) to public;", error: "Incorrect anon grant: update_profile_layout" },
    { name: "missing owner RPC execution", setup: "revoke execute on function public.update_profile_layout(jsonb) from authenticated;", error: "Incorrect authenticated grant: update_profile_layout" },
    { name: "RPC bypasses caller RLS", setup: "alter function public.update_profile_layout(jsonb) security definer;", error: "Layout RPC must retain caller RLS" },
    {
      name: "missing visualization v1 dependency",
      setup: "drop function public.profile_layout_v1_is_valid(jsonb);",
      error: "Missing function: profile_layout_v1_is_valid(jsonb)",
    },
    {
      name: "renamed visualization v1 dependency",
      setup: "alter function public.profile_layout_v1_is_valid(jsonb) rename to verifier_old_layout_helper;",
      error: "Missing function: profile_layout_v1_is_valid(jsonb)",
    },
    {
      name: "wrong helper argument type does not satisfy the contract",
      setup: `drop function public.profile_layout_v1_is_valid(jsonb);
        create function public.profile_layout_v1_is_valid(json) returns boolean
          language sql as 'select true';`,
      error: "Missing function: profile_layout_v1_is_valid(jsonb)",
    },
    {
      name: "missing authenticated helper execution",
      setup: "revoke execute on function public.profile_layout_v1_is_valid(jsonb) from authenticated;",
      error: "Incorrect authenticated grant: profile_layout_v1_is_valid(jsonb)",
    },
    {
      name: "actual public reads, anonymous denial, and owner-scoped writes with hosted grants",
      setup: `
        grant insert, update, delete on public.profiles to anon;
        insert into auth.users(id) values
          ('aaaaaaaa-1111-4111-8111-111111111111'),
          ('bbbbbbbb-2222-4222-8222-222222222222'),
          ('cccccccc-3333-4333-8333-333333333333');
        insert into public.profiles(user_id, username) values
          ('aaaaaaaa-1111-4111-8111-111111111111', 'verifier_a'),
          ('bbbbbbbb-2222-4222-8222-222222222222', 'verifier_b');
        set local role anon;
        do $$ declare changed integer; begin
          assert (select count(*) from public.profiles where username in ('verifier_a', 'verifier_b')) = 2;
          begin
            insert into public.profiles(user_id, username) values ('cccccccc-3333-4333-8333-333333333333', 'verifier_c');
            raise exception 'Anonymous insert succeeded';
          exception when insufficient_privilege then
            assert sqlerrm like '%row-level security%', 'Insert must be denied by RLS despite its ACL';
          end;
          update public.profiles set bio = 'forbidden' where username = 'verifier_a';
          get diagnostics changed = row_count; assert changed = 0;
          delete from public.profiles where username = 'verifier_a';
          get diagnostics changed = row_count; assert changed = 0;
        end $$;
        reset role;
        select set_config('request.jwt.claim.sub', 'aaaaaaaa-1111-4111-8111-111111111111', true);
        set local role authenticated;
        do $$ declare changed integer; begin
          update public.profiles set bio = 'allowed' where username = 'verifier_a';
          get diagnostics changed = row_count; assert changed = 1;
          update public.profiles set bio = 'forbidden' where username = 'verifier_b';
          get diagnostics changed = row_count; assert changed = 0;
          begin
            insert into public.profiles(user_id, username) values ('cccccccc-3333-4333-8333-333333333333', 'verifier_c');
            raise exception 'Cross-owner insert succeeded';
          exception when insufficient_privilege then
            assert sqlerrm like '%row-level security%';
          end;
          begin
            update public.profiles set user_id = 'cccccccc-3333-4333-8333-333333333333' where username = 'verifier_a';
            raise exception 'Cross-owner reassignment succeeded';
          exception when insufficient_privilege then
            assert sqlerrm like '%row-level security%';
          end;
          delete from public.profiles where username = 'verifier_b';
          get diagnostics changed = row_count; assert changed = 0;
          delete from public.profiles where username = 'verifier_a';
          get diagnostics changed = row_count; assert changed = 1;
          insert into public.profiles(user_id, username) values ('aaaaaaaa-1111-4111-8111-111111111111', 'verifier_a');
        end $$;
        reset role;
      `,
    },
  ];

  for (const scenario of scenarios) {
    let failure;
    try {
      await executeSql(`begin;\n${scenario.setup}\n${body}\nrollback;`);
    } catch (error) {
      failure = error;
    } finally {
      // Needed by embedded/single-connection test runtimes after an assertion;
      // harmless for the Docker adapter, whose failed psql session rolls back.
      await executeSql("rollback;");
    }
    if (scenario.error) {
      const message = failure?.stderr?.toString() || failure?.message || "";
      if (!message.includes(scenario.error)) {
        throw new Error(`${scenario.name}: expected rejection containing '${scenario.error}', received '${message || "no rejection"}'`);
      }
    } else if (failure) {
      throw failure;
    }
    console.log(`PASS verifier: ${scenario.name}`);
  }
  return scenarios.length;
}
