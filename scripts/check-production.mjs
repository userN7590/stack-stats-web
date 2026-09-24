// Unauthenticated route smoke test. No valid credentials, approval, or uploads.
import assert from "node:assert/strict";

const target = new URL(process.argv[2] ?? "https://stackstats.dev");
const publicOrigin = process.env.STACK_STATS_APP_ORIGIN ?? target.origin;
const continuation = "/extension/connect?" + new URLSearchParams({
  challenge: "a".repeat(43), state: "b".repeat(64), scope: "stats:write",
  redirectUri: "vscode://undefined_publisher.stack-stats-vscode/auth/callback?windowId=7",
});
const cases = [
  ["GET", continuation, 307],
  ["GET", "/login?next=" + encodeURIComponent(continuation), 200],
  ["GET", "/signup?next=" + encodeURIComponent(continuation), 200],
  ["GET", "/auth/callback?next=" + encodeURIComponent(continuation), 307],
  ["POST", "/api/extension/authorize", 403],
  ["POST", "/api/extension/exchange", 400],
  ["POST", "/api/extension/refresh", 400],
  ["POST", "/api/extension/revoke", 400],
  ["POST", "/api/extension/revoke-all", 403],
  ["GET", "/api/extension/account", 401],
  ["PUT", "/api/v1/sync/installations/11111111-1111-4111-8111-111111111111/days/2026-09-18", 401],
  ["GET", "/api/v1/sync/summary", 401],
  ["PUT", "/api/v1/sync/privacy", 403],
];
let failed = 0;
for (const [method, pathname, expected] of cases) {
  const url = new URL(pathname, target);
  try {
    const response = await fetch(url, {
      method, redirect: "manual", signal: AbortSignal.timeout(15_000),
      ...(method === "GET" ? {} : { headers: { "Content-Type": "application/json" }, body: "{}" }),
    });
    const content = await response.text();
    assert.equal(response.status, expected, `expected ${expected}, got ${response.status}`);
    if (pathname.startsWith("/api/") || pathname.startsWith("/auth/callback")) {
      assert.match(response.headers.get("cache-control") ?? "", /no-store/);
      assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    }
    if (pathname.startsWith("/api/")) assert.equal(typeof JSON.parse(content).error, "string");
    if (expected === 307) {
      const location = new URL(response.headers.get("location"), target);
      assert.equal(location.pathname, "/login");
      const resumed = new URL(location.searchParams.get("next"), target);
      assert.equal(resumed.pathname, "/extension/connect");
      assert.deepEqual(Object.fromEntries(resumed.searchParams), Object.fromEntries(new URL(continuation, target).searchParams));
      if (pathname.startsWith("/auth/callback")) assert.equal(location.origin, publicOrigin);
    }
    console.log(`PASS ${method} ${url.pathname} (${response.status})`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${method} ${url.pathname}: ${error.message}`);
  }
}
if (failed) process.exitCode = 1;
else console.log("Route checks passed. Authenticated browser/editor E2E and database checks are still required.");
