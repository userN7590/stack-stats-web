// Always creates a disposable database. Never reads production credentials.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { testProductionVerifier } from "./test-production-verifier.mjs";

const container = `stack-stats-test-${randomUUID()}`;
const docker = (args, input) => execFileSync("docker", args, { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
const sql = input => docker(["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"], input);
try {
  docker(["run", "--detach", "--rm", "--name", container, "--network", "none",
    "--tmpfs", "/var/lib/postgresql/data", "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:16-alpine"]);
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    // The image's temporary initialization server uses a Unix socket only.
    // Wait for TCP so we cannot race its shutdown before the final server starts.
    try { docker(["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]); ready = true; break; }
    catch { await setTimeout(100); }
  }
  if (!ready) throw new Error("Disposable PostgreSQL did not become ready");
  // Minimal Supabase identity/roles for SQL tests; this is not hosted Auth E2E.
  sql(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth, extensions to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  for (const directory of ["migrations", "tests"]) {
    const location = new URL(`../supabase/${directory}/`, import.meta.url);
    for (const filename of readdirSync(location).filter(name => name.endsWith(".sql")).sort()) {
      sql(readFileSync(new URL(filename, location), "utf8"));
      console.log(`PASS ${directory}/${filename}`);
      if (filename === "20260827000100_add_profile_appearance.sql") {
        sql(`
          insert into auth.users(id) values('99999999-9999-4999-8999-999999999999');
          insert into public.profiles(user_id,username,lines_added,bio)
            values('99999999-9999-4999-8999-999999999999','upgrade_fixture',321,'Preserve me');
          insert into public.profile_languages(user_id,name,percentage)
            values('99999999-9999-4999-8999-999999999999','TypeScript',100);
          create table auth.audit_snapshot as select to_jsonb(p) profile from public.profiles p;
        `);
      }
      if (filename === "20260909000000_extension_identity.sql") {
        sql(`
          select set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',false);
          create table auth.audit_identity as select public.extension_exchange(
            public.extension_authorize('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM','vscode://undefined_publisher.stack-stats-vscode/auth/callback'),
            'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk','vscode://undefined_publisher.stack-stats-vscode/auth/callback'
          ) pair;
        `);
      }
      if (filename === "20260910000000_profile_sync.sql") {
        sql(`
          do $$ declare pair jsonb; begin
            assert (select to_jsonb(p) from public.profiles p where username='upgrade_fixture')=(select profile from auth.audit_snapshot);
            assert (select percentage from public.profile_languages where name='TypeScript')=100;
            select a.pair into pair from auth.audit_identity a;
            assert not public.extension_refresh(pair->>'refreshToken') ? 'syncGrant';
            begin
              perform public.sync_put_day(pair->>'accessToken','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',current_date,'{}');
              raise exception 'Existing identity grant was upgraded';
            exception when sqlstate '42501' then null; end;
          end $$;
          delete from auth.users where id='99999999-9999-4999-8999-999999999999';
          drop table auth.audit_snapshot, auth.audit_identity;
        `);
        console.log("PASS upgrade preserves existing profile, languages and identity-only credentials");
      }
    }
  }
  const verifier = readFileSync(new URL("../supabase/verify-production.sql", import.meta.url), "utf8");
  sql(verifier);
  console.log("PASS production schema/permission assertions");
  await testProductionVerifier(sql, verifier);
} catch (error) {
  console.error(error.stderr?.toString() || error.message);
  process.exitCode = 1;
} finally {
  try { docker(["rm", "--force", container]); } catch { /* Startup may have failed. */ }
}
