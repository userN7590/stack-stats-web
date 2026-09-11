import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseSyncDay } from "../src/lib/sync-contract";
import { withSyncedProfile, type PublishedSync } from "../src/lib/synced-profile";
import type { PublicProfile } from "../src/lib/types";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc, auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/supabase/env", () => ({ getSupabaseEnv: () => ({ url: "https://test.invalid", anonKey: "public-test-key" }) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: mocks.rpc }) }));
import { putSyncDay, syncPrivacy, privateSyncSummary } from "../src/lib/sync-api";
import { handleExtensionRequest } from "../src/lib/extension-api";
const install = "11111111-1111-4111-8111-111111111111";
const day = { schemaVersion: "1", aggregationVersion: 1, date: "2026-09-10", revision: 1, activeMs: 30_000, editCount: 2, linesAdded: 4, linesRemoved: 2, fileCount: 1, sessionCount: 1,
  languages: [{ id: "typescript", activeMs: 30_000, editCount: 2, linesAdded: 4, linesRemoved: 2 }], projects: [{ id: "a".repeat(64), activeMs: 30_000, editCount: 2, linesAdded: 4, linesRemoved: 2 }] };
const request = (value: unknown = day, token = "a".repeat(64)) => new Request(`https://stackstats.dev/api/v1/sync/installations/${install}/days/${day.date}`, { method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(value) });
beforeEach(() => { vi.clearAllMocks(); mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null }); mocks.rpc.mockResolvedValue({ data: { installationId: install, date: day.date, revision: 1 }, error: null }); });
describe("daily sync API", () => {
  it("validates strict body, dates, ordering and counters before RPC", async () => {
    expect(parseSyncDay(day)).toMatchObject(day);
    for (const value of [{ ...day, userId: "forged" }, { ...day, filename: "secret" }, { ...day, activeMs: -1 }, { ...day, date: "2026-02-30" }, { ...day, languages: [] }, { ...day, projects: [...day.projects, ...day.projects] }]) {
      expect((await putSyncDay(request(value), install, day.date)).status).toBe(400);
    }
    expect((await putSyncDay(request({ ...day, source: "x".repeat(70_000) }), install, day.date)).status).toBe(400);
    expect((await putSyncDay(request(), "../owner", day.date)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("accepts only token authentication, derives ownership in RPC, and disables caching", async () => {
    expect((await putSyncDay(request(day, ""), install, day.date)).status).toBe(401);
    const result = await putSyncDay(request(), install, day.date);
    expect(result.status).toBe(200); expect(result.headers.get("cache-control")).toBe("no-store");
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("sync_put_day", { p_access_token: "a".repeat(64), p_installation_id: install, p_date: day.date, p_payload: day });
  });
  it("distinguishes stale revisions, conflicts, limits, forbidden scope and expired credentials", async () => {
    for (const [error, status] of [["stale_revision", 409], ["revision_conflict", 409], ["rate_limited", 429], ["installation_limit", 422]] as const) {
      mocks.rpc.mockResolvedValueOnce({ data: { error, revision: 7 }, error: null });
      const response = await putSyncDay(request(), install, day.date); expect(response.status).toBe(status);
    }
    for (const [code, status] of [["28000", 401], ["42501", 403], ["XX000", 503]] as const) {
      mocks.rpc.mockResolvedValueOnce({ data: null, error: { code, message: "private details" } });
      const response = await putSyncDay(request(), install, day.date); expect(response.status).toBe(status); expect(await response.text()).not.toContain("private details");
    }
  });
  it("requires a new browser approval for stats scope and routes rotating refresh separately", async () => {
    const body = { challenge: "a".repeat(43), state: "b".repeat(64), redirectUri: "vscode://undefined_publisher.stack-stats-vscode/auth/callback", scope: "stats:write" };
    mocks.rpc.mockResolvedValueOnce({ data: "c".repeat(64), error: null });
    const result = await handleExtensionRequest(new Request("https://stackstats.dev/api/extension/authorize", { method: "POST", headers: { origin: "https://stackstats.dev", "content-type": "application/json" }, body: JSON.stringify(body) }), "authorize");
    expect(result.status).toBe(200); expect(mocks.rpc).toHaveBeenCalledWith("extension_authorize_stats", { p_challenge: body.challenge, p_redirect_uri: body.redirectUri });
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null });
    const refresh = await handleExtensionRequest(new Request("https://stackstats.dev/api/extension/refresh", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken: "a".repeat(64), nextRefreshToken: "b".repeat(64) }) }), "refresh");
    expect(refresh.status).toBe(401); expect(mocks.rpc).toHaveBeenCalledWith("extension_refresh_stats", { p_refresh_token: "a".repeat(64), p_next_refresh_token: "b".repeat(64) });
  });
});
describe("private summaries and explicit publication", () => {
  it("requires fresh cookie auth and exact origin for changing publication", async () => {
    expect((await syncPrivacy(request())).status).toBe(403);
    const privacy = () => new Request("https://stackstats.dev/api/v1/sync/privacy", { method: "PUT", headers: { "content-type": "application/json", origin: "https://stackstats.dev" }, body: JSON.stringify({ publishProfile: true, publishLanguages: false }) });
    expect((await syncPrivacy(privacy())).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("sync_set_privacy", { p_publish_profile: true, p_publish_languages: false });
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null }); expect((await syncPrivacy(privacy())).status).toBe(401);
  });
  it("private query accepts only bounded windows, never a caller-supplied account", async () => {
    expect((await privateSyncSummary(new Request("https://stackstats.dev/api/v1/sync/summary?userId=another"))).status).toBe(400);
    expect((await privateSyncSummary(new Request("https://stackstats.dev/api/v1/sync/summary?period=365"))).status).toBe(400);
    expect((await privateSyncSummary(new Request("https://stackstats.dev/api/v1/sync/summary?period=90&to=2026-09-10"))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("sync_private_summary", { p_period: "90", p_to: "2026-09-10" });
  });
  it("preserves manual values, replaces rather than adds, and never falls back to manual languages while publishing sync", () => {
    const manual = { user_id: "owner", lines_added: 100, files_changed: 10, created_at: "2026-01-01", updated_at: "2026-01-01", languages: [{ name: "Manual", percentage: 100 }] } as PublicProfile;
    const published: PublishedSync = { ...day, recordCount: 1, fileDays: 2, projectCount: 1, updatedAt: "2026-09-10", languages: [] };
    expect(withSyncedProfile(manual, null)).toBe(manual);
    expect(withSyncedProfile(manual, { ...published, recordCount: 0 })).toBe(manual);
    const result = withSyncedProfile(manual, published);
    expect(result.lines_added).toBe(4); expect(result.files_changed).toBe(2); expect(result.stats_source).toBe("synced"); expect(result.languages).toEqual([]);
    expect(manual.lines_added).toBe(100);
    expect(withSyncedProfile(manual, { ...published, languages: [{ id: "typescript", activeMs: 0, editCount: 2 }] }).languages[0]?.percentage).toBe(100);
  });
});
