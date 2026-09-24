import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ claims: vi.fn(), profile: vi.fn(), languages: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: mocks.claims },
    from: () => ({ select: () => ({ eq: () => ({
      maybeSingle: mocks.profile,
      order: mocks.languages,
    }) }) }),
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({}),
  redirect: (url: string) => { throw new Error(`redirect:${url}`); },
}));
vi.mock("@/components/dashboard/profile-form", () => ({ ProfileForm: () => null }));
vi.mock("@/components/dashboard/appearance-form", () => ({ AppearanceForm: () => null }));

import DashboardPage from "../src/app/dashboard/page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.claims.mockResolvedValue({ data: { claims: { sub: "owner" } }, error: null });
  mocks.profile.mockResolvedValue({ data: { user_id: "owner", username: "developer" }, error: null });
  mocks.languages.mockResolvedValue({ data: [], error: null });
});

describe("existing profile settings navigation", () => {
  const sections = ["identity", "links", "stats", "languages", "appearance"];

  it.each(sections)("keeps every editor reachable from the %s section", async (section) => {
    const html = renderToStaticMarkup(await DashboardPage({ searchParams: Promise.resolve({ section }) }));
    expect(html).toContain('aria-label="Profile settings"');
    for (const target of sections) {
      expect(html).toContain(`href="/dashboard?section=${target}"`);
    }
    const activeLink = html.match(/<a\b[^>]*>/g)?.find(
      (tag) => tag.includes(`href="/dashboard?section=${section}"`),
    );
    expect(activeLink).toContain('aria-current="page"');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain("Manual totals");
    expect(html).toContain("Manual languages");
    expect(html).toContain('href="/settings/sync"');
  });

  it("preserves the bare dashboard redirect to the existing profile", async () => {
    await expect(DashboardPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/u/developer");
  });

  it("still requires authentication for the customization destination", async () => {
    mocks.claims.mockResolvedValueOnce({ data: { claims: null }, error: null });
    await expect(DashboardPage({ searchParams: Promise.resolve({ section: "identity" }) })).rejects.toThrow("redirect:/login");
    expect(mocks.profile).not.toHaveBeenCalled();
  });
});
