import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claims: vi.fn(),
  profile: vi.fn(),
  languages: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: mocks.claims },
    from: mocks.from,
    rpc: mocks.rpc,
  }),
}));
vi.mock("@/components/profile/profile-view", () => ({ ProfileView: () => null }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("not-found"); },
}));

import PublicProfilePage from "../src/app/u/[username]/page";

const savedLayout = {
  version: 1,
  modules: [{ type: "languages", visible: false, size: "full" }],
};
const manualProfile = {
  user_id: "owner",
  username: "developer",
  display_name: "Developer",
  lines_added: 123,
  lines_removed: 12,
  files_changed: 3,
  edit_events: 9,
  projects_count: 2,
  coding_minutes: 60,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  profile_layout: savedLayout,
};
const manualLanguages = [{
  id: "manual-language",
  user_id: "owner",
  name: "Saved manual language",
  percentage: 100,
  created_at: "2026-01-01T00:00:00Z",
}];
const published = {
  activeMs: 300_000,
  editCount: 40,
  linesAdded: 200,
  linesRemoved: 30,
  fileDays: 20,
  projectCount: 3,
  recordCount: 1,
  updatedAt: "2026-09-24T00:00:00Z",
  languages: [],
};

function page(customize?: string | string[]) {
  return PublicProfilePage({
    params: Promise.resolve({ username: "Developer" }),
    searchParams: Promise.resolve(customize === undefined ? {} : { customize }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.claims.mockResolvedValue({ data: { claims: { sub: "owner" } }, error: null });
  mocks.profile.mockResolvedValue({ data: structuredClone(manualProfile), error: null });
  mocks.languages.mockResolvedValue({ data: structuredClone(manualLanguages), error: null });
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  mocks.eq.mockImplementation(() => ({ maybeSingle: mocks.profile, order: mocks.languages }));
  mocks.from.mockImplementation(() => ({ select: () => ({ eq: mocks.eq }) }));
});

describe("public profile customization entry", () => {
  it("opens customization only when the authenticated owner requests it", async () => {
    const result = await page("1");
    expect(result.props.isOwner).toBe(true);
    expect(result.props.customize).toBe(true);
    expect(mocks.eq).toHaveBeenCalledWith("username", "developer");
    expect(mocks.rpc).toHaveBeenCalledWith("sync_public_profile", { p_username: "developer" });
  });

  it.each([
    { customize: undefined },
    { customize: "0" },
    { customize: "true" },
    { customize: ["1", "1"] },
  ])(
    "retains the owner's normal public view for a non-exact request (%j)",
    async ({ customize }) => {
      const result = await page(customize);
      expect(result.props.isOwner).toBe(true);
      expect(result.props.customize).toBe(false);
    },
  );

  it.each([
    { data: null, error: null },
    { data: { claims: null }, error: null },
    { data: { claims: { sub: "another-owner" } }, error: null },
    { data: { claims: { sub: "owner" } }, error: { message: "Invalid or expired token" } },
  ])("does not expose editing for a visitor or invalid claims (%j)", async (claims) => {
    mocks.claims.mockResolvedValueOnce(claims);
    const result = await page("1");
    expect(result.props.isOwner).toBe(false);
    expect(result.props.customize).toBe(false);
    expect(result.props.profile.username).toBe("developer");
  });
});

describe("profile source and layout boundary", () => {
  it.each([
    { data: null, error: null },
    { data: null, error: { message: "RPC unavailable" } },
    { data: published, error: { message: "RPC failed" } },
    { data: { ...published, recordCount: 0 }, error: null },
  ])("preserves saved manual data and layout on publication fallback (%j)", async (response) => {
    mocks.rpc.mockResolvedValueOnce(response);
    const result = await page("1");
    expect(result.props.profile.lines_added).toBe(123);
    expect(result.props.profile.languages).toEqual(manualLanguages);
    expect(result.props.profile.profile_layout).toEqual(savedLayout);
    expect(result.props.profile.stats_source).toBeUndefined();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it.each(["owner", "another-owner", null])(
    "uses only published sync data for the %s view and never restores unpublished manual languages",
    async (viewer) => {
      mocks.claims.mockResolvedValueOnce({ data: { claims: viewer ? { sub: viewer } : null }, error: null });
      mocks.rpc.mockResolvedValueOnce({ data: published, error: null });
      const result = await page("1");
      expect(result.props.profile).toMatchObject({
        stats_source: "synced",
        lines_added: 200,
        languages: [],
        profile_layout: savedLayout,
      });
      expect(mocks.rpc).toHaveBeenCalledTimes(1);
      expect(mocks.rpc).toHaveBeenCalledWith("sync_public_profile", { p_username: "developer" });
      expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(["profiles", "profile_languages"]);
      expect(manualProfile.lines_added).toBe(123);
      expect(manualLanguages[0].name).toBe("Saved manual language");
    },
  );

  it("continues to support profiles created before appearance and layout settings", async () => {
    const legacy = { ...manualProfile, profile_layout: undefined };
    mocks.profile.mockResolvedValueOnce({ data: legacy, error: null });
    const result = await page();
    expect(result.props.profile.display_font).toBe("editorial");
    expect(result.props.profile.background_style).toBe("none");
    expect(result.props.profile.profile_layout).toBeUndefined();
    expect(result.props.profile.languages).toEqual(manualLanguages);
  });

  it("keeps missing profiles unavailable even when customization is requested", async () => {
    mocks.profile.mockResolvedValueOnce({ data: null, error: null });
    await expect(page("1")).rejects.toThrow("not-found");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
