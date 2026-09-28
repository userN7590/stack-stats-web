import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ claims: vi.fn(), rpc: vi.fn(), query: vi.fn(), from: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: mocks.claims }, from: mocks.from, rpc: mocks.rpc }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({}) }));

import Home from "../src/app/page";
import { activityStats } from "../src/components/home/home-fingerprint";
import { HomeView } from "../src/components/home/home-view";
import { buildFingerprint, representativeFingerprint } from "../src/lib/activity-fingerprint";
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
  it("shows what Stack Stats is: headline, one sentence, profile cards, activity", async () => {
    const html = await home();
    const text = html.replace(/<[^>]+>/g, " ");
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html.replace(/<[^>]+>/g, "")).toContain("Your development.One profile.");
    expect(html).toContain("Stack Stats tracks your coding in VS Code and turns it into a profile you can share.");
    expect(html).toMatch(/href="\/signup"[^>]*>Create your profile/);
    expect(html).toMatch(/aria-label="Log in"/);
    expect(html.match(/data-profile-card=/g)).toHaveLength(5);
    expect(html).toContain("data-fingerprint");
    expect(html).toContain("30 days of coding · example data");
    expect(html).not.toContain("Use my activity");
    // Hero, activity and final call to action; no numbered explainer sections.
    expect(html.match(/<h2/g)).toHaveLength(2);
    expect(text).toContain("Your work leaves a pattern.");
    expect(text).toContain("What does your coding look like?");
  });

  it("no longer explains the ingestion pipeline or repeats privacy lists", async () => {
    const text = (await home()).replace(/<[^>]+>/g, " ");
    for (const removed of ["Capture", "captured quietly", "Daily aggregate", "Private sync", "Never uploaded", "Uploaded as daily aggregates",
      "Proof", "resume claims", "Private by default", "Metric by metric", "Revocable", "RIDGE = ", "Values by date", "Highlighted:", "not your activity", "Raw activity becomes"]) {
      expect(text, removed).not.toContain(removed);
    }
  });

  it("personalizes only the CTA and an explicit owner control for signed-in viewers", async () => {
    mocks.claims.mockResolvedValue({ data: { claims: { sub: "viewer-id" } }, error: null });
    tables({ signedInUsername: "dev" });
    const html = await home();
    expect(html).toMatch(/href="\/u\/dev"[^>]*>View \/u\/dev/);
    expect(html).toContain("Use my activity");
    expect(html).toContain('title="Loads your private hourly activity into this page only"');
    // The fingerprint itself is still the example in server markup.
    expect(html).toContain("30 days of coding · example data");
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

  it("fronts the card stack with the live @fil profile through its public projection", async () => {
    const html = await home();
    expect(mocks.rpc).toHaveBeenCalledWith("sync_public_profile_v2", { p_username: "fil" });
    const cards = html.match(/<li class="pcard[\s\S]*?<\/li>/g)!;
    // First in reading order, frontmost in the composition, and a link to the real profile.
    expect(cards[0]).toMatch(/class="pcard pcard-front"/);
    expect(cards[0]).toMatch(/href="\/u\/fil"/);
    expect(cards[0]).toContain(">Live<");
    expect(cards[0]).toContain("2h"); // Published coding time.
    expect(html).not.toContain("987,654"); // Unpublished manual value never fills a v2 slot.
    expect(html).toMatch(/href="\/u\/fil"[^>]*>View @fil’s profile/);
  });

  it("labels every other card as a fictional example", async () => {
    const cards = (await home()).match(/<li class="pcard[\s\S]*?<\/li>/g)!.slice(1);
    expect(cards).toHaveLength(4);
    for (const card of cards) {
      expect(card).toMatch(/^<li class="pcard"/);
      expect(card).toMatch(/<article class="pcard-body" aria-label="Example profile \(fictional\): /);
      expect(card).toContain(">Example<");
      expect(card).toMatch(/@example-[a-z]+/);
      expect(card).not.toMatch(/href=/);
    }
  });

  it("falls back to the labelled example persona when the live profile is unavailable", async () => {
    tables({ filError: { message: "offline" } });
    const html = await home();
    const front = html.match(/<li class="pcard pcard-front"[\s\S]*?<\/li>/)![0];
    expect(front).toContain("Alex Rivera");
    expect(front).toContain(">Example<");
    expect(front).toMatch(/href="\/example"/);
    expect(html).toMatch(/href="\/example"[^>]*>View example profile/);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("keeps one hero annotation and the quiet structural system", () => {
    const html = renderToStaticMarkup(<HomeView viewer={{ signedIn: false, username: null }} example={{ profile: exampleProfile, live: false }} />);
    expect(html).toContain("nav-rails");
    expect(html.match(/class="site-frame/g)!.length).toBeGreaterThanOrEqual(4);
    expect(html).toContain('class="site-guides"');
    const sketches = html.match(/<svg[^>]*data-sketch=""[^>]*>/g)!;
    // Only the pair of braces around “development.”; no loop around “profile”.
    expect(sketches).toHaveLength(2);
    for (const svg of sketches) expect(svg).toMatch(/aria-hidden="true"[^>]*class="sketch sketch-pen[^"]*hero-brace/);
    expect(html).not.toMatch(/hero-loop|sketch-node/);
  });

  it("derives the activity statistics from the displayed model only", () => {
    expect(activityStats(representativeFingerprint()).map((stat) => stat.value)).toEqual(["135h 7m", "27/30", "10:00", "8h 24m"]);
    const own = buildFingerprint([
      { date: "2026-09-01", hours: Array.from({ length: 24 }, (_, hour) => (hour === 21 ? 3_000_000 : 0)) },
      { date: "2026-09-02", hours: null },
    ], { from: "2026-09-01", to: "2026-09-03" });
    // Unavailable and missing dates never count as active or as zero-time days.
    expect(activityStats(own).map((stat) => stat.value)).toEqual(["50m", "1/3", "21:00", "50m"]);
    const html = renderToStaticMarkup(<HomeView viewer={{ signedIn: false, username: null }} example={{ profile: exampleProfile, live: false }} />);
    expect(html).toMatch(/<dl class="activity-stats md:col-span-4" aria-label="Example: 30 days">/);
  });

  it("renders identical markup on repeated renders", () => {
    const view = () => renderToStaticMarkup(<HomeView viewer={{ signedIn: true, username: "dev" }} example={{ profile: exampleProfile, live: false }} />);
    expect(view()).toBe(view());
  });

  it("keeps copy short and free of generic SaaS language", () => {
    const source = readFileSync("src/components/home/home-view.tsx", "utf8");
    expect(source).not.toMatch(/\bAI\b|revolutionary|supercharge|unlock|next-generation/i);
    const html = renderToStaticMarkup(<HomeView viewer={{ signedIn: false, username: null }} example={{ profile: exampleProfile, live: false }} />);
    const visible = html.replace(/<div class="sr-only">[\s\S]*?<\/div>/, "").replace(/<(svg|title|desc)[\s\S]*?<\/\1>/g, "").replace(/<[^>]+>/g, " ");
    expect(visible.split(/\s+/).filter(Boolean).length).toBeLessThan(420);
  });
});
