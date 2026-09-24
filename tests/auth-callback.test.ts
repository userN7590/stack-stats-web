import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ exchange: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession: mocks.exchange } }),
}));
import { GET } from "../src/app/auth/callback/route";

const continuation = "/extension/connect?scope=stats%3Awrite&state=" + "a".repeat(64)
  + "&challenge=" + "b".repeat(43)
  + "&redirectUri=" + encodeURIComponent("vscode://undefined_publisher.stack-stats-vscode/auth/callback?windowId=7");

beforeEach(() => {
  vi.stubEnv("STACK_STATS_APP_ORIGIN", "https://stackstats.dev");
  mocks.exchange.mockReset().mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("confirmation callback", () => {
  it("returns to the complete extension request on the public origin behind a proxy", async () => {
    const url = new URL("http://localhost:3000/auth/callback");
    url.search = new URLSearchParams({ code: "confirmation-code", sb_flow_id: "flow", next: continuation }).toString();
    const response = await GET(new Request(url, { headers: { "x-forwarded-host": "evil.example" } }));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://stackstats.dev" + continuation);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(mocks.exchange).toHaveBeenCalledWith("confirmation-code", { flowId: "flow" });
  });

  it("keeps the continuation on exchange failure so login can resume approval", async () => {
    mocks.exchange.mockResolvedValueOnce({ error: { message: "private detail" } });
    const response = await GET(new Request("http://localhost:3000/auth/callback?code=expired&next=" + encodeURIComponent(continuation)));
    const location = new URL(response.headers.get("location")!);
    expect(location.origin).toBe("https://stackstats.dev");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe(continuation);
    expect(location.searchParams.get("error")).toBe("confirmation");
    expect(location.toString()).not.toContain("private detail");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects external continuations and preserves ordinary dashboard signup", async () => {
    for (const next of ["//evil.example", "/\\evil.example", "https://evil.example", "/dashboard"]) {
      const response = await GET(new Request("https://stackstats.dev/auth/callback?code=ok&next=" + encodeURIComponent(next)));
      expect(response.headers.get("location")).toBe("https://stackstats.dev/dashboard");
    }
  });

  it("honors an explicitly configured local origin for development", async () => {
    vi.stubEnv("STACK_STATS_APP_ORIGIN", "http://localhost:3000");
    const response = await GET(new Request("http://127.0.0.1:3000/auth/callback?code=ok"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });
});
