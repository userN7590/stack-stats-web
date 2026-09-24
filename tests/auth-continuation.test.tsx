import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), profile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: mocks.getUser },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.profile }) }) }),
}) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(url); } }));
import LoginPage from "../src/app/login/page";
import SignupPage from "../src/app/signup/page";
import ExtensionConnectPage from "../src/app/extension/connect/page";

const request = {
  challenge: "a".repeat(43), state: "b".repeat(64),
  redirectUri: "vscode://undefined_publisher.stack-stats-vscode/auth/callback?windowId=7",
  scope: "stats:write",
};
const next = "/extension/connect?" + new URLSearchParams(request);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  mocks.profile.mockResolvedValue({ data: { username: "test_owner" }, error: null });
});

describe("login, signup and profile setup continuation", () => {
  it("preserves the full request on both auth forms and alternate auth links", async () => {
    for (const [Page, alternate] of [[LoginPage, "/signup"], [SignupPage, "/login"]] as const) {
      const page = await Page({ searchParams: Promise.resolve({ next }) });
      expect(page.props.children.props.next).toBe(next);
      const url = new URL(page.props.alternateHref, "https://stackstats.dev");
      expect(url.pathname).toBe(alternate);
      expect(url.searchParams.get("next")).toBe(next);
    }
  });
  it("sends a signed-out editor request to login with the scope and callback intact", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    try {
      await ExtensionConnectPage({ searchParams: Promise.resolve(request) });
      expect.fail("Expected a login redirect");
    } catch (error) {
      const login = new URL((error as Error).message, "https://stackstats.dev");
      expect(login.pathname).toBe("/login");
      const resumed = new URL(login.searchParams.get("next")!, login.origin);
      expect(Object.fromEntries(resumed.searchParams)).toEqual(request);
    }
  });
  it("uses existing profile setup and returns to approval when a new user saves", async () => {
    mocks.profile.mockResolvedValueOnce({ data: null, error: null });
    const page = await ExtensionConnectPage({ searchParams: Promise.resolve(request) });
    const form = page.props.children.props.children[1];
    expect(form.props.initialProfile).toBeNull();
    expect(form.props.section).toBe("identity");
    const resumed = new URL(form.props.successDestination, "https://stackstats.dev");
    expect(Object.fromEntries(resumed.searchParams)).toEqual(request);
  });
  it("does not turn identity linking into stats consent", async () => {
    const identity = { challenge: request.challenge, state: request.state, redirectUri: request.redirectUri };
    const page = await ExtensionConnectPage({ searchParams: Promise.resolve(identity) });
    expect(page.props.children.props.request.scope).toBeUndefined();
    expect(page.props.children.props.request).toEqual(identity);
    const scoped = await ExtensionConnectPage({ searchParams: Promise.resolve(request) });
    expect(scoped.props.children.props.request.scope).toBe("stats:write");
  });
});
