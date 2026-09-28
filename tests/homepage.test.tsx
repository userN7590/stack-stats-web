import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ claims: vi.fn(), rpc: vi.fn(), query: vi.fn(), from: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: mocks.claims }, from: mocks.from, rpc: mocks.rpc }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({}) }));

import Home from "../src/app/page";
import { HomeView } from "../src/components/home/home-view";
import { exampleProfile } from "../src/lib/example-profile";

const fil = {
  user_id: "fil-id", username: "fil", display_name: "fil", bio: "I love building projects!", avatar_url: null, github_url: null, website_url: null,
  lines_added: 987_654, lines_removed: 12, files_changed: 3, edit_events: 9, projects_count: 2, coding_minutes: 60,
  display_font: "editorial", background_style: "none", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};
const publication = { schemaVersion: "2", metrics: [{ id: "activity.active_ms", definitionVersion: 1, unit: "milliseconds", quality: "partial", dateBasis: "collector-local", value: 7_200_000 }] };

function tables({ signedInUsername = null as string | null, filError = null as unknown, filProfile = fil as unknown } = {}) {
  mocks.from.mockImplementation((table: string) => ({
    select: () => ({
      eq: (column: string, value: string) => {
        mocks.query(table, column, value);
        if (table === "profiles" && column === "user_id") return { maybeSingle: async () => ({ data: signedInUsername ? { username: signedInUsername } : null, error: null }) };
        if (table === "profiles") return { maybeSingle: async () => ({ data: filError ? null : filProfile, error: filError }) };
        return { order: async () => ({ data: [], error: null }) };
      },
    }),
  }));
}
async function home() {
  return renderToStaticMarkup(await Home());
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.claims.mockResolvedValue({ data: null, error: null });
  mocks.rpc.mockResolvedValue({ data: publication, error: null });
  tables();
});

describe("homepage", () => {
  it("renders the anonymous editorial story with a representative fingerprint", async () => {
    const html = await home();
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html.replace(/<[^>]+>/g, "")).toContain("Your development.One profile.");
    expect(html).toContain("Create a public profile for the work behind your code.");
    expect(html).toMatch(/href="\/signup"[^>]*>Create your profile/);
    expect(html).toMatch(/aria-label="Log in"/);
    expect(html).toContain("not your activity");
    expect(html).toContain("data-fingerprint");
    expect(html).not.toContain("Show my last 30 days");
    for (const section of ["01", "02", "03", "04"]) expect(html).toContain(`>${section}</span>`);
    expect(html.match(/<h2/g)!.length).toBeGreaterThanOrEqual(4);
  });

  it("personalizes only the CTA and an explicit owner control for signed-in viewers", async () => {
    mocks.claims.mockResolvedValue({ data: { claims: { sub: "viewer-id" } }, error: null });
    tables({ signedInUsername: "dev" });
    const html = await home();
    expect(html).toMatch(/href="\/u\/dev"[^>]*>View your profile/);
    expect(html).toContain("Show my last 30 days");
    expect(html).toContain("Loads your private hourly activity into this page only.");
    // The fingerprint itself is still the representative example in server markup.
    expect(html).toContain("not your activity");
  });

  it("never requests private sync data while rendering, signed in or not", async () => {
    for (const claims of [null, { claims: { sub: "viewer-id" } }]) {
      mocks.claims.mockResolvedValue({ data: claims, error: null });
      tables({ signedInUsername: "dev" });
      await home();
    }
    const names = mocks.rpc.mock.calls.map(([name]) => name);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((name) => name === "sync_public_profile_v2" || name === "sync_public_profile")).toBe(true);
    expect(mocks.query.mock.calls.map(([table]) => table).every((table) => table === "profiles" || table === "profile_languages")).toBe(true);
  });

  it("shows the live example through the same public projection as /u/fil", async () => {
    const html = await home();
    expect(mocks.rpc).toHaveBeenCalledWith("sync_public_profile_v2", { p_username: "fil" });
    expect(html).toContain("Live public profile");
    expect(html).toContain("2h"); // Published coding time.
    expect(html).not.toContain("987,654"); // Unpublished manual value never fills a v2 slot.
    expect(html).toContain("Not published");
  });

  it("falls back to the labelled example persona when the live profile is unavailable", async () => {
    tables({ filError: { message: "offline" } });
    const html = await home();
    expect(html).toContain("Alex Rivera");
    expect(html).toContain("Example profile · representative");
    expect(html).toMatch(/href="\/example"/);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("uses the shared structural system and decorative-only annotations", () => {
    const html = renderToStaticMarkup(<HomeView viewer={{ signedIn: false, username: null }} example={{ profile: exampleProfile, live: false }} />);
    expect(html).toContain('class="relative z-30 border-b border-[#2b2a24] "');
    expect(html).toContain("nav-rails");
    expect(html.match(/class="site-frame/g)!.length).toBeGreaterThanOrEqual(6);
    expect(html).toContain('class="site-guides"');
    expect(html).toContain("frame-mark");
    const sketches = html.match(/<svg[^>]*data-sketch=""[^>]*>/g)!;
    // Occasional, not everywhere: hero braces + loop, one underline, one chart arrow.
    expect(sketches).toHaveLength(5);
    for (const svg of sketches) expect(svg).toMatch(/aria-hidden="true"/);
  });

  it("renders identical markup on repeated renders", () => {
    const view = () => renderToStaticMarkup(<HomeView viewer={{ signedIn: true, username: "dev" }} example={{ profile: exampleProfile, live: false }} />);
    expect(view()).toBe(view());
  });

  it("keeps every factual claim tied to the documented upload contract", () => {
    const source = readFileSync("src/components/home/home-view.tsx", "utf8");
    const consent = readFileSync("src/components/auth/extension-consent.tsx", "utf8");
    for (const never of ["file names", "prompts", "raw events", "project names"]) expect(consent.toLowerCase()).toContain(never);
    expect(source).toContain('"Source code", "File names", "Prompts", "Raw editor events", "Project names"');
    expect(source).not.toMatch(/\bAI\b|revolutionary|supercharge|unlock/i);
  });
});
