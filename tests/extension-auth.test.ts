import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmationCallbackPath, safeAuthDestination } from "../src/lib/auth-destination";
import { accountResponse, appOrigin, callbackUrl, exchangeSchema, linkSchema, validRedirect } from "../src/lib/extension-auth";

const redirect = "vscode://StackStats.stack-stats-vscode/auth/callback";
const nativeRedirects = ["vscode", "vscode-insiders", "cursor", "windsurf"].flatMap(scheme =>
  ["StackStats", "stackstats", "undefined_publisher"].map(publisher => `${scheme}://${publisher}.stack-stats-vscode/auth/callback`));
afterEach(() => vi.unstubAllEnvs());
describe("extension authentication boundaries", () => {
  it.each(nativeRedirects)("accepts the exact release or temporary beta callback %s", nativeRedirect => {
    for (const suffix of ["", "?windowId=0", "?windowId=1", "?windowId=9876543210"]) {
      const expected = nativeRedirect + suffix;
      expect(validRedirect(expected)).toBe(true);
      // The enclosing browser URL encodes its redirectUri exactly once. The
      // decoded parameter is the complete callback, including its query boundary.
      const browserUrl = new URL("https://stackstats.dev/extension/connect");
      browserUrl.searchParams.set("redirectUri", expected);
      expect(validRedirect(browserUrl.searchParams.get("redirectUri")!)).toBe(true);
      if (suffix) expect(browserUrl.search).toContain("%3FwindowId%3D");
      const callback = new URL(callbackUrl(expected, "b".repeat(64), { code: "c".repeat(64) }));
      expect(callback.searchParams.get("windowId")).toBe(suffix ? suffix.split("=")[1] : null);
      expect(callback.searchParams.get("ss_state")).toBe("b".repeat(64));
      expect(callback.searchParams.get("code")).toBe("c".repeat(64));
    }
  });
  it.each(nativeRedirects)("rejects malformed, injected and encoded queries on %s", nativeRedirect => {
    for (const suffix of ["?", "?windowId=", "?windowId=-1", "?windowId=1.5", "?windowId=12345678901",
      "?windowId=evil", "?windowId=1&windowId=2", "?windowId=1&next=https://evil.example", "?other=1",
      "?windowId=1&", "?windowId=1;code=stolen", "?windowId=1?code=stolen", "?WindowId=1",
      "?window%49d=1", "?windowId=%31", "?windowId=%2531", "?windowId=1%26code%3Dstolen",
      "?windowId=1%2526code%253Dstolen", "%3FwindowId%3D1", "%253FwindowId%253D1",
      "?code=stolen", "?ss_state=stolen", "?error=access_denied", "?windowId=1#fragment", "#fragment", "#",
      "?windowId=1\n", "?windowId=1\t", "?windowId=1 "]) {
      expect(validRedirect(nativeRedirect + suffix), suffix).toBe(false);
    }
  });
  it("rejects look-alike identities, case changes and normalized or encoded path separators", () => {
    for (const invalid of ["https://evil.example", "javascript:alert(1)", "not a URI",
      "https://StackStats.stack-stats-vscode/auth/callback", "vscode-insider://StackStats.stack-stats-vscode/auth/callback",
      ...["WrongPublisher.stack-stats-vscode", "StackStats.stack-stats-vscode.evil", "evil.StackStats.stack-stats-vscode",
        "StackStatsX.stack-stats-vscode", "StackStats.stack-stats-vscode-extra", "StackStats.another-extension",
        "Stackstats.stack-stats-vscode", "STACKSTATS.stack-stats-vscode", "StackStats.Stack-Stats-Vscode",
        "Undefined_publisher.stack-stats-vscode", "StackStats.stack-stats-vscode:80", "StackStats.stack-stats-vscode@evil.example",
        "evil@StackStats.stack-stats-vscode", "StackStats%2Estack-stats-vscode"].map(authority => `vscode://${authority}/auth/callback?windowId=1`),
      ...["/auth/callback/evil", "/auth/callback/", "/AUTH/callback", "/auth/x/../callback", "/auth/%2e/callback",
        "/auth%2fcallback", "/auth%252fcallback", "/auth\\callback", "//auth/callback"].map(path => `vscode://StackStats.stack-stats-vscode${path}?windowId=1`),
      "VSCODE://StackStats.stack-stats-vscode/auth/callback?windowId=1", ` ${redirect}?windowId=1`,
      `\n${redirect}?windowId=1`, `vs\tcode://StackStats.stack-stats-vscode/auth/callback?windowId=1`,
      encodeURIComponent(redirect), encodeURIComponent(encodeURIComponent(redirect))]) {
      expect(validRedirect(invalid), invalid).toBe(false);
      expect(() => callbackUrl(invalid, "b".repeat(64), { error: "access_denied" })).toThrow("Invalid redirect");
    }
  });
  it("permits configured extra URIs only exactly, without automatic windowId support", () => {
    vi.stubEnv("STACK_STATS_EXTENSION_REDIRECT_URIS", '["https://specific.example/callback"]');
    expect(validRedirect("https://specific.example/callback")).toBe(true);
    expect(validRedirect("https://other.specific.example/callback")).toBe(false);
    expect(validRedirect("https://specific.example/callback?windowId=1")).toBe(false);
    for (const invalid of ["https://user:password@specific.example/callback", "https://specific.example/callback#fragment",
      "https://specific.example/callback?code=stolen", "https://specific.example/callback?ss_state=stolen", "https://specific.example/callback?error=stolen"]) {
      vi.stubEnv("STACK_STATS_EXTENSION_REDIRECT_URIS", JSON.stringify([invalid]));
      expect(validRedirect(invalid)).toBe(false);
    }
    for (const config of ["invalid", "{}", '[null]', '[1]']) {
      vi.stubEnv("STACK_STATS_EXTENSION_REDIRECT_URIS", config);
      expect(validRedirect(redirect)).toBe(false);
    }
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
