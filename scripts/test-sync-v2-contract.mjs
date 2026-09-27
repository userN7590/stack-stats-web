import { readFileSync } from "node:fs";
// Same fixtures exercise the vendored TypeScript parser and independent SQL.
export async function testSyncV2Contract(executeSql) {
  const fixtures = JSON.parse(readFileSync(new URL("../tests/fixtures/sync-v2-contract.json", import.meta.url), "utf8"));
  for (const fixture of fixtures) {
    const payload = JSON.stringify(fixture.payload).replaceAll("'", "''");
    try { await executeSql(`do $$ begin assert public.sync_validate_day_v2('${payload}'::jsonb) is ${fixture.valid ? "true" : "false"}, 'SQL v2 contract fixture mismatch'; end $$;`); }
    catch (error) { throw new Error(`${fixture.name}: ${error.stderr?.toString() || error.message}`); }
  }
  console.log(`PASS ${fixtures.length} shared TypeScript/SQL v2 contract cases`);
}
