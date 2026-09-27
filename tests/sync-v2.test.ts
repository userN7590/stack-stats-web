import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import fixtures from "./fixtures/sync-v2-contract.json";
import { parseSyncDayV2 } from "../src/lib/stack-stats-protocol/sync-v2";
import { parseSyncDay } from "../src/lib/sync-contract";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc, auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/supabase/env", () => ({ getSupabaseEnv: () => ({ url: "https://test.invalid", anonKey: "public-test-key" }) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: mocks.rpc }) }));
import { putSyncDay, putSyncDayV2 } from "../src/lib/sync-api";
import { syncCapabilities, privateSyncV2, syncPrivacyV2, eraseSyncData } from "../src/lib/sync-v2-api";
import { handleExtensionRequest } from "../src/lib/extension-api";
const install = "11111111-1111-4111-8111-111111111111";
const token = "a".repeat(64);
const base = parseSyncDayV2(fixtures[0].payload);
function request(path: string, payload?: unknown, method = "GET", origin = "https://stackstats.dev") {
  return new Request(`https://stackstats.dev${path}`, { method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", origin }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  mocks.rpc.mockResolvedValue({ data: { schemaVersion: "2", installationId: install, date: base.date, revision: base.revision, unchanged: false }, error: null });
});
describe("exact v2 protocol", () => {
  it.each(fixtures)("$name (valid=$valid)", ({ payload, valid }) => {
    if (valid) expect(parseSyncDayV2(payload)).toEqual(payload);
    else expect(() => parseSyncDayV2(payload)).toThrow();
  });
  it("rejects byte overflow and sparse arrays", () => {
    expect(() => parseSyncDayV2({ ...base, private: "x".repeat(65536) })).toThrow();
    expect(() => parseSyncDayV2({ ...base, languages: Array(1) })).toThrow();
    expect(() => parseSyncDayV2({ ...base, sessionDurations: { ...base.sessionDurations, histogram: Array(9) } })).toThrow();
  });
  it("keeps the old v1 file and the vendored v1 bundle identical", () => {
    expect(readFileSync("src/lib/stack-stats-protocol/sync.ts", "utf8")).toBe(readFileSync("src/lib/sync-contract.ts", "utf8"));
  });
  it("pins the exact Phase 9A v2 source (update only with an upstream contract review)", () => {
    const digest = createHash("sha256").update(readFileSync("src/lib/stack-stats-protocol/sync-v2.ts")).digest("hex");
    expect(digest).toBe("3a6871fcaed82adcbb1d58db8aee5c8f43a9b661cf2b600c1a26a3106d7a569f");
  });
});
describe("v2 upload and negotiation", () => {
  it("uses the canonical writer and validates exact v2 acknowledgement", async () => {
    const result = await putSyncDayV2(request("/api/v2/sync/day", base, "PUT"), install, base.date);
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(await result.json()).toMatchObject({ schemaVersion: "2", revision: 2 });
    expect(mocks.rpc).toHaveBeenCalledWith("sync_put_day", { p_access_token: token, p_installation_id: install, p_date: base.date, p_payload: base });
    expect(mocks.getUser).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValueOnce({ data: { installationId: install, date: base.date, revision: 2 }, error: null });
    expect((await putSyncDayV2(request("/day", base, "PUT"), install, base.date)).status).toBe(503);
  });
  it("rejects v2 on the v1 route and v1 on the v2 route", async () => {
    expect((await putSyncDay(request("/day", base, "PUT"), install, base.date)).status).toBe(400);
    const v1 = { schemaVersion: "1", aggregationVersion: 1, revision: 1, date: base.date, activeMs: 0, editCount: 0, linesAdded: 0, linesRemoved: 0, sessionCount: 0, fileCount: 0, languages: [], projects: [] };
    expect(parseSyncDay(v1)).toEqual(v1);
    expect((await putSyncDayV2(request("/day", v1, "PUT"), install, base.date)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(fixtures.filter(fixture => !fixture.valid))("rejects malformed $name before RPC", async ({ payload }) => {
    expect((await putSyncDayV2(request("/day", payload, "PUT"), install, base.date)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires bearer, route date match and bounded bytes", async () => {
    expect((await putSyncDayV2(new Request("https://stackstats.dev/day", { method: "PUT" }), install, base.date)).status).toBe(401);
    expect((await putSyncDayV2(request("/day", base, "PUT"), install, "2026-09-26")).status).toBe(400);
    expect((await putSyncDayV2(request("/day", { ...base, private: "x".repeat(65536) }, "PUT"), install, base.date)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([["version_downgrade", 409], ["revision_conflict", 409], ["stale_revision", 409], ["rate_limited", 429], ["installation_limit", 422]])("maps %s without revealing payload", async (error, status) => {
    mocks.rpc.mockResolvedValueOnce({ data: { error, revision: 7 }, error: null });
    const result = await putSyncDayV2(request("/day", base, "PUT"), install, base.date);
    expect(result.status).toBe(status);
    expect(await result.json()).toEqual({ error, revision: 7 });
  });
  it.each([["28000", 401], ["42501", 403], ["XX000", 503]])("maps %s auth/scope failures", async (code, status) => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code, message: "secret database details" } });
    const result = await putSyncDayV2(request("/day", base, "PUT"), install, base.date);
    expect(result.status).toBe(status); expect(await result.text()).not.toContain("secret");
  });
  it.each([["1"], ["1", "2"]])("advertises only the grant's validated daily versions %s", async (...versions) => {
    // it.each passes each row's strings as separate arguments.
    const dailyVersions = versions.filter(value => typeof value === "string");
    mocks.rpc.mockResolvedValueOnce({ data: { schemaVersion: "1", dailyVersions }, error: null });
    const result = await syncCapabilities(request("/api/v1/sync/capabilities"));
    expect(result.status).toBe(200); expect(await result.json()).toEqual({ schemaVersion: "1", dailyVersions });
    expect(mocks.rpc).toHaveBeenCalledWith("sync_capabilities", { p_access_token: token });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it.each([{ schemaVersion: "1", dailyVersions: ["2"] }, { schemaVersion: "1", dailyVersions: ["1", "3"] }, { schemaVersion: "1", dailyVersions: ["1", "2"], userId: "private" }])("fails closed on an unexpected capability response", async data => {
    mocks.rpc.mockResolvedValueOnce({ data, error: null });
    expect((await syncCapabilities(request("/capabilities"))).status).toBe(503);
  });
  it("richer consent requires a separate explicit browser field", async () => {
    const input = { challenge: "a".repeat(43), state: "b".repeat(64), redirectUri: "vscode://undefined_publisher.stack-stats-vscode/auth/callback", scope: "stats:write", statsSchemaVersion: 2 };
    mocks.rpc.mockResolvedValueOnce({ data: token, error: null });
    expect((await handleExtensionRequest(request("/api/extension/authorize", input, "POST"), "authorize")).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("extension_authorize_stats_v2", { p_challenge: input.challenge, p_redirect_uri: input.redirectUri });
    mocks.rpc.mockClear();
    expect((await handleExtensionRequest(request("/api/extension/authorize", { ...input, scope: undefined }, "POST"), "authorize")).status).toBe(400);
    expect((await handleExtensionRequest(request("/api/extension/authorize", input, "POST", "https://evil.invalid"), "authorize")).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
describe("owner-only v2 data and privacy routes", () => {
  it("derives owner in SQL and accepts bounded independent datasets", async () => {
    expect((await privateSyncV2(request("/datasets?dataset=hourlyUtc&period=7&to=2026-09-27"), "datasets")).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("sync_private_datasets_v2", { p_dataset: "hourlyUtc", p_period: "7", p_to: "2026-09-27" });
    expect((await privateSyncV2(request("/summary?period=lifetime"))).status).toBe(200);
    for (const query of ["dataset=raw", "dataset=daily&period=lifetime", "dataset=daily&userId=foreign", "dataset=daily&to=2026-02-30", "dataset=daily&dataset=hourlyUtc"]) {
      expect((await privateSyncV2(request(`/datasets?${query}`), "datasets")).status).toBe(400);
    }
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await privateSyncV2(request("/summary"))).status).toBe(401);
  });
  it("maps bounded dataset errors explicitly", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { code: "54000" }, data: null });
    expect((await privateSyncV2(request("/datasets?dataset=projectsByDay"), "datasets")).status).toBe(413);
  });
  it("enforces selected metrics, schedule opt-in and same-origin changes", async () => {
    const privacy = { schemaVersion: "2", publishProfile: true, metricIds: ["activity.active_ms"], publishSchedule: false };
    expect((await syncPrivacyV2(request("/privacy", privacy, "PUT"))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("sync_set_privacy_v2", { p_publish_profile: true, p_metric_ids: privacy.metricIds, p_publish_schedule: false });
    for (const metricIds of [["projects.activity"], ["unknown"], ["schedule.daily"], ["activity.edits", "activity.edits"]]) {
      expect((await syncPrivacyV2(request("/privacy", { ...privacy, metricIds }, "PUT"))).status).toBe(400);
    }
    expect((await syncPrivacyV2(request("/privacy", privacy, "PUT", "https://evil.invalid"))).status).toBe(403);
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await syncPrivacyV2(request("/privacy"))).status).toBe(401);
  });
  it("exports by bounded cursor and requires explicit authenticated erasure", async () => {
    expect((await privateSyncV2(request("/export?afterDate=2026-09-27"), "export")).status).toBe(400);
    expect((await privateSyncV2(request(`/export?afterDate=2026-09-27&afterInstallation=${install}`), "export")).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("sync_export_v2", { p_after_date: "2026-09-27", p_after_installation: install });
    expect((await eraseSyncData(request("/data", {}, "DELETE"))).status).toBe(400);
    expect((await eraseSyncData(request("/data?userId=foreign", { confirmation: "delete-cloud-sync-data" }, "DELETE"))).status).toBe(400);
    expect((await eraseSyncData(request("/data", { confirmation: "delete-cloud-sync-data" }, "DELETE", "https://evil.invalid"))).status).toBe(403);
    expect((await eraseSyncData(request("/data", { confirmation: "delete-cloud-sync-data" }, "DELETE"))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("sync_erase_cloud_data");
  });
});
