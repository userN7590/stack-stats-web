import { readFileSync } from "node:fs";

// The same fixtures are parsed by the client schema tests and real PostgreSQL.
export async function testProfileContentContract(executeSql) {
  const fixtures = JSON.parse(readFileSync(new URL("../tests/fixtures/profile-content.json", import.meta.url), "utf8"));
  for (const fixture of fixtures) {
    const value = JSON.stringify(fixture.layout).replaceAll("'", "''");
    try {
      await executeSql(`do $$ begin assert public.profile_layout_is_valid('${value}'::jsonb) is ${fixture.valid ? "true" : "false"}; end $$;`);
    } catch (error) {
      throw new Error(`Profile content SQL contract: ${fixture.name}: ${error.stderr?.toString() || error.message}`);
    }
  }
  console.log(`PASS ${fixtures.length} shared profile content SQL/TypeScript fixtures`);
}
