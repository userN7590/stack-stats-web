import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmationCallbackPath, safeAuthDestination } from "../src/lib/auth-destination";
import { accountResponse, appOrigin, callbackUrl, exchangeSchema, linkSchema, validRedirect } from "../src/lib/extension-auth";

const redirect = "vscode://undefined_publisher.stack-stats-vscode/auth/callback";
afterEach(() => vi.unstubAllEnvs());
describe("extension authentication boundaries", () => {
  it("only accepts exact registered redirects and an explicitly configured extra URI", () => {
    expect(validRedirect(redirect)).toBe(true);
    expect(validRedirect(`${redirect}?windowId=1`)).toBe(true);
    for (const suffix of ["?windowId=evil", "?windowId=1&windowId=2", "?windowId=1&next=https://evil.example", "?other=1"]) expect(validRedirect(redirect + suffix)).toBe(false);
    for (const invalid of [redirect + "/evil", redirect + "?code=stolen", redirect + "#fragment", "https://evil.example", "vscode://another.extension/auth/callback", "javascript:alert(1)"]) expect(validRedirect(invalid)).toBe(false);
    vi.stubEnv("STACK_STATS_EXTENSION_REDIRECT_URIS", '["https://specific.example/callback"]');
    expect(validRedirect("https://specific.example/callback")).toBe(true);
    expect(validRedirect("https://other.specific.example/callback")).toBe(false);
    vi.stubEnv("STACK_STATS_EXTENSION_REDIRECT_URIS", "invalid"); expect(validRedirect(redirect)).toBe(false);
  });
  it("validates S256/state/verifier shapes and rejects extra credential fields", () => {
    const request = { challenge: "a".repeat(43), state: "b".repeat(64), redirectUri: redirect };
    expect(linkSchema.safeParse(request).success).toBe(true);
    expect(linkSchema.safeParse({ ...request, access_token: "secret" }).success).toBe(false);
    expect(exchangeSchema.safeParse({ code: "c".repeat(64), verifier: "a".repeat(43), redirectUri: redirect }).success).toBe(true);
    expect(exchangeSchema.safeParse({ code: "short", verifier: "short", redirectUri: redirect }).success).toBe(false);
    const callback = new URL(callbackUrl(redirect, request.state, { code: "c".repeat(64) }));
    expect([...callback.searchParams.keys()].sort()).toEqual(["code", "ss_state"]);
  });
  it("keeps login/signup destinations internal and preserves extension continuation", () => {
    const next = `/extension/connect?state=${"a".repeat(64)}`;
    expect(safeAuthDestination(next)).toBe(next);
    for (const invalid of ["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", "/\nmalicious", ["/dashboard"], undefined]) expect(safeAuthDestination(invalid)).toBe("/dashboard");
  });
  it("preserves the original signup callback allowlist and safely carries extension continuation", () => {
    expect(confirmationCallbackPath(undefined)).toBe("/auth/callback?next=/dashboard");
    const next = "/extension/connect?state=abc&challenge=def";
    const url = new URL(confirmationCallbackPath(next), "https://stackstats.dev");
    expect(url.searchParams.get("next")).toBe(next);
    expect([...url.searchParams.keys()]).toEqual(["next"]);
  });
  it("returns only supported account fields and a canonical profile URL", () => {
    const identity = accountResponse({ userId: "11111111-1111-4111-8111-111111111111", username: "fil", displayName: null, token: "not returned", lines_added: 900 });
    expect(identity).toEqual({ userId: "11111111-1111-4111-8111-111111111111", username: "fil", displayName: null, profileUrl: "https://stackstats.dev/u/fil" });
    expect(() => accountResponse({ ...identity, username: "../evil" })).toThrow();
  });
  it("rejects untrusted application origins", () => {
    expect(appOrigin()).toBe("https://stackstats.dev");
    vi.stubEnv("STACK_STATS_APP_ORIGIN", "http://evil.example"); expect(() => appOrigin()).toThrow();
    vi.stubEnv("STACK_STATS_APP_ORIGIN", "https://stackstats.dev/path"); expect(() => appOrigin()).toThrow();
  });
  it("never permits localhost as the production application origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const origin of ["http://localhost:3000", "http://127.0.0.1:3000"]) {
      vi.stubEnv("STACK_STATS_APP_ORIGIN", origin);
      expect(() => appOrigin()).toThrow();
    }
  });
});
