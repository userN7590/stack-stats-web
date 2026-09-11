import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc, auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/supabase/env", () => ({ getSupabaseEnv: () => ({ url: "https://test.invalid", anonKey: "public-test-key" }) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: mocks.rpc }) }));
import { handleExtensionRequest } from "../src/lib/extension-api";

const redirectUri = "vscode://undefined_publisher.stack-stats-vscode/auth/callback";
const link = { challenge: "a".repeat(43), state: "b".repeat(64), redirectUri };
const post = (action: string, body: unknown, origin = "https://stackstats.dev") => new Request(`https://stackstats.dev/api/extension/${action}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); mocks.getUser.mockResolvedValue({ data: { user: { id: "existing-supabase-user" } }, error: null }); });
describe("extension HTTP authentication API", () => {
  it("requires same-origin, freshly authenticated browser approval", async () => {
    expect((await handleExtensionRequest(post("authorize", link, "https://evil.example"), "authorize")).status).toBe(403);
    expect(mocks.getUser).not.toHaveBeenCalled();
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "sensitive" } });
    const response = await handleExtensionRequest(post("authorize", link), "authorize");
    expect(response.status).toBe(401); expect(mocks.rpc).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain("sensitive");
  });
  it("returns only a short code callback after explicit approval", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: "c".repeat(64), error: null });
    const response = await handleExtensionRequest(post("authorize", link), "authorize");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const data = await response.json();
    expect(new URL(data.callbackUrl).searchParams.get("ss_state")).toBe(link.state);
    expect(mocks.rpc).toHaveBeenCalledWith("extension_authorize", { p_challenge: link.challenge, p_redirect_uri: redirectUri });
    expect(JSON.stringify(data)).not.toMatch(/accessToken|refreshToken/);
  });
  it("rejects unsupported callbacks, excess fields and oversized bodies before RPC", async () => {
    expect((await handleExtensionRequest(post("authorize", { ...link, redirectUri: "https://evil.example" }), "authorize")).status).toBe(400);
    expect((await handleExtensionRequest(post("exchange", { code: "c".repeat(64), verifier: "a".repeat(43), redirectUri, userId: "forged" }), "exchange")).status).toBe(400);
    expect((await handleExtensionRequest(post("refresh", { refreshToken: "a".repeat(9000) }), "refresh")).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires a bearer token and exposes only identity", async () => {
    expect((await handleExtensionRequest(new Request("https://stackstats.dev/api/extension/account"), "account")).status).toBe(401);
    mocks.rpc.mockResolvedValueOnce({ data: { userId: "11111111-1111-4111-8111-111111111111", username: "fil", displayName: "Fil", private_data: "omitted" }, error: null });
    const response = await handleExtensionRequest(new Request("https://stackstats.dev/api/extension/account", { headers: { authorization: `Bearer ${"a".repeat(64)}` } }), "account");
    expect(await response.json()).toEqual({ account: { userId: "11111111-1111-4111-8111-111111111111", username: "fil", displayName: "Fil", profileUrl: "https://stackstats.dev/u/fil" } });
  });
  it("maps revocation, rate limits and backend failures without leaking errors", async () => {
    for (const [code, expected] of [["28000", 401], ["54000", 429], ["XX000", 503]] as const) {
      mocks.rpc.mockResolvedValueOnce({ data: null, error: { code, message: "secret database details" } });
      const response = await handleExtensionRequest(post("refresh", { refreshToken: "a".repeat(64) }), "refresh");
      expect(response.status).toBe(expected); expect(await response.text()).not.toContain("secret");
    }
  });
  it("requires authenticated same-origin revocation for all devices, but token possession for one", async () => {
    expect((await handleExtensionRequest(post("revoke-all", {}, "https://evil.example"), "revoke-all")).status).toBe(403);
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect((await handleExtensionRequest(post("revoke-all", {}), "revoke-all")).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("extension_revoke_all", {});
    expect((await handleExtensionRequest(post("revoke", { refreshToken: "b".repeat(64) }), "revoke")).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("extension_revoke", { p_refresh_token: "b".repeat(64) });
  });
});
