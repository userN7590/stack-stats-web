import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageDonutChart } from "../src/components/profile/language-donut-chart";
import { ProfileView } from "../src/components/profile/profile-view";
import { getDefaultProfileLayout, type ProfileLayout, type StatId } from "../src/lib/profile-layout";
import { withSyncedProfile, type PublishedSync } from "../src/lib/synced-profile";
import type { PublicProfile } from "../src/lib/types";

const charts = vi.hoisted(() => ({ pie: vi.fn(), tooltip: vi.fn() }));

// Assert the chart's data/formatter boundary without requiring browser layout.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
  PieChart: ({ children }: { children: ReactNode }) => children,
  Pie: charts.pie,
  Tooltip: charts.tooltip,
  Cell: () => null,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({}) }));

const manual: PublicProfile = {
  user_id: "owner",
  username: "developer",
  display_name: "A Developer",
  bio: null,
  avatar_url: null,
  github_url: null,
  website_url: null,
  lines_added: 100,
  lines_removed: 20,
  files_changed: 10,
  edit_events: 30,
  projects_count: 2,
  coding_minutes: 60,
  display_font: "editorial",
  background_style: "none",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  languages: [{
    id: "manual-language",
    user_id: "owner",
    name: "Custom Manual Language",
    percentage: 100,
    created_at: "2026-01-01T00:00:00Z",
  }],
};
const published: PublishedSync = {
  activeMs: 300_000,
  editCount: 40,
  linesAdded: 200,
  linesRemoved: 30,
  fileDays: 20,
  projectCount: 3,
  recordCount: 1,
  updatedAt: "2026-09-24T00:00:00Z",
  languages: [
    { id: "javascriptreact", activeMs: 165_505, editCount: 22 },
    { id: "typescriptreact", activeMs: 134_495, editCount: 18 },
  ],
};

beforeEach(() => vi.clearAllMocks());

describe("profile presentation", () => {
  it("labels published sync consistently and displays friendly, rounded languages", () => {
    const profile = withSyncedProfile(manual, published);
    const html = renderToStaticMarkup(<ProfileView profile={profile} />);

    expect(html).toContain("Automatically tracked by Stack Stats");
    expect(html).toContain("Statistics are automatically tracked by Stack Stats.");
    expect(html).not.toMatch(/self-reported|entered and maintained|verified/i);
    expect(html).toContain("Synced Sep 24, 2026");
    expect(html).toContain("File-days");
    expect(html).toContain("Project identities");
    expect(html).toContain('aria-label="Language activity: React (JavaScript) 55.2%, React (TypeScript) 44.8%"');
    expect(html).toContain("55.2%</span>");
    expect(html).not.toContain("javascriptreact");
    expect(html).not.toContain("Custom Manual Language");
    expect(profile.languages[0].name).toBe("javascriptreact");
    expect(profile.languages[0].percentage).toBe(165_505 / 300_000 * 100);
    expect(manual.lines_added).toBe(100);
    expect(manual.languages[0].name).toBe("Custom Manual Language");
    expect(published.languages[0].id).toBe("javascriptreact");
  });

  it.each([null, { ...published, recordCount: 0 }])(
    "keeps manual wording and saved values when synced data is unavailable (%j)",
    (synced) => {
      const html = renderToStaticMarkup(
        <ProfileView profile={withSyncedProfile(manual, synced)} />,
      );
      expect(html).toContain("Self-reported aggregate data");
      expect(html).toContain("A self-reported percentage breakdown");
      expect(html).toContain("Statistics are entered and maintained by the profile owner.");
      expect(html).toContain("Updated Jan 1, 2026");
      expect(html).toContain("Custom Manual Language");
      expect(html).not.toContain("Automatically tracked");
    },
  );

  it.each([manual, withSyncedProfile(manual, published)])(
    "gives the owner one customization entry point and separate sync settings",
    (profile) => {
      const html = renderToStaticMarkup(<ProfileView profile={profile} isOwner />);
      expect(html.match(/Customize profile/g)).toHaveLength(1);
      expect(html).toMatch(/href="\/u\/developer\?customize=1"[^>]*>.*?Customize profile<\/a>/);
      expect(html).toMatch(/href="\/settings\/sync"[^>]*>Sync settings<\/a>/);
      expect(html).not.toMatch(/Edit (totals|languages|links|profile|appearance)/);
      expect(html).not.toContain("No links added yet.");
    },
  );

  it.each([
    { isOwner: false, isExample: false },
    { isOwner: false, isExample: true },
    { isOwner: true, isExample: true },
  ])("hides owner controls for visitors and examples (%j)", (props) => {
    const html = renderToStaticMarkup(<ProfileView profile={manual} {...props} />);
    expect(html).not.toContain("Customize profile");
    expect(html).not.toContain("Sync settings");
    expect(html).not.toContain("/dashboard?section=");
  });

  it("keeps unpublished synced languages hidden without showing saved manual languages", () => {
    const profile = withSyncedProfile(manual, { ...published, languages: [] });
    const visitor = renderToStaticMarkup(<ProfileView profile={profile} />);
    const owner = renderToStaticMarkup(<ProfileView profile={profile} isOwner />);
    expect(visitor).not.toContain("Language activity");
    expect(owner).toContain("No language activity is published.");
    for (const html of [visitor, owner]) {
      expect(html).not.toContain("Custom Manual Language");
      expect(html).not.toContain("self-reported");
    }
  });
});

function renderedSections(html: string) {
  return [...html.matchAll(/data-profile-section="([^"]+)"/g)].map((match) => match[1]);
}

function renderedStats(html: string) {
  return [...html.matchAll(/data-profile-stat="([^"]+)"/g)].map((match) => match[1]);
}

describe("modular profile presentation", () => {
  const withLinks = {
    ...manual,
    github_url: "https://github.com/developer",
    website_url: "https://developer.example",
  };
  const customized: ProfileLayout = {
    version: 1,
    modules: [
      { type: "languages", visible: true, size: "half" },
      { type: "links", visible: true, size: "half" },
      { type: "code_changes", visible: false, size: "full" },
      { type: "stats", visible: true, size: "full", stats: ["coding_minutes", "lines_removed"] },
    ],
  };

  it.each(["links", "languages"] as const)("shows a neutral empty state when only an empty %s section is selected", (type) => {
    const layout = getDefaultProfileLayout();
    layout.modules = layout.modules.map((module) => ({ ...module, visible: module.type === type }));
    const profile = withSyncedProfile({ ...manual, profile_layout: layout }, { ...published, languages: [] });
    const html = renderToStaticMarkup(<ProfileView profile={profile} />);
    expect(renderedSections(html)).toEqual([]);
    expect(html).toContain("No profile sections are available to display yet.");
    expect(html).not.toContain("Custom Manual Language");
  });

  it.each([false, true])("honors persisted section order, visibility, size, and selected stat order (owner=%s)", (isOwner) => {
    const profile = { ...withLinks, profile_layout: customized };
    const before = structuredClone(profile);
    const html = renderToStaticMarkup(<ProfileView profile={profile} isOwner={isOwner} />);
    expect(renderedSections(html)).toEqual(["languages", "links", "stats"]);
    expect(renderedStats(html)).toEqual(["coding_minutes", "lines_removed"]);
    expect(html).not.toContain("Code changes");
    expect(html).not.toContain("Lines added");
    expect(html).toContain("https://github.com/developer");
    expect(html).toContain("Custom Manual Language");
    const languageSection = html.match(/<section[^>]*data-profile-section="languages"[^>]*>/)?.[0];
    const statsSection = html.match(/<section[^>]*data-profile-section="stats"[^>]*>/)?.[0];
    expect(languageSection).toBeDefined();
    expect(languageSection).not.toContain("sm:col-span-2");
    expect(html).not.toContain("sm:grid-cols-[190px_1fr]");
    expect(statsSection).toContain("sm:col-span-2");
    expect(profile).toEqual(before);
  });

  it.each([
    { label: "missing", raw: undefined },
    { label: "null", raw: null },
    { label: "malformed", raw: { version: 1, modules: "broken" } },
    { label: "future", raw: { version: 3, modules: [{ type: "future_chart" }] } },
    { label: "unknown modules", raw: { version: 1, modules: [{ type: "unknown", visible: true }] } },
  ])("renders a complete default profile for $label configuration", ({ raw }) => {
    const html = renderToStaticMarkup(<ProfileView profile={{ ...withLinks, profile_layout: raw }} />);
    expect(renderedSections(html)).toEqual(["links", "stats", "code_changes", "languages"]);
    expect(renderedStats(html)).toEqual([
      "lines_added", "lines_removed", "files_changed", "edit_events", "projects_count", "coding_minutes",
    ]);
    expect(html).toContain("Custom Manual Language");
    expect(html).not.toContain("future_chart");
    expect(html).not.toContain("undefined");
  });

  it.each([
    { stats: ["coding_minutes"] },
    { stats: ["projects_count", "lines_removed"] },
    { stats: ["edit_events", "files_changed", "coding_minutes", "lines_added"] },
  ] satisfies { stats: StatId[] }[])("renders every selected stat without requiring exactly three cards (%j)", ({ stats }) => {
    const layout = getDefaultProfileLayout();
    const headline = layout.modules.find((module) => module.type === "stats")!;
    headline.stats = stats;
    const html = renderToStaticMarkup(<ProfileView profile={{ ...manual, profile_layout: layout }} />);
    expect(renderedStats(html)).toEqual(stats);
  });

  it("does not duplicate sections or stats when reading a recoverable older configuration", () => {
    const html = renderToStaticMarkup(<ProfileView profile={{
      ...withLinks,
      profile_layout: {
        version: 1,
        modules: [
          { type: "stats", visible: true, stats: ["coding_minutes", "coding_minutes", "future_metric", "lines_added"] },
          { type: "stats", visible: true, stats: ["edit_events"] },
          { type: "unknown", visible: true },
        ],
      },
    }} />);
    expect(renderedSections(html)).toEqual(["stats"]);
    expect(renderedStats(html)).toEqual(["coding_minutes", "lines_added"]);
    expect(html).not.toContain("future_metric");
  });

  it.each([
    { isOwner: false, isExample: false },
    { isOwner: false, isExample: true },
    { isOwner: true, isExample: true },
  ])("ignores customize requests outside the owner's real profile (%j)", (props) => {
    const html = renderToStaticMarkup(<ProfileView profile={withLinks} customize {...props} />);
    expect(renderedSections(html)).toEqual(["links", "stats", "code_changes", "languages"]);
    expect(html).not.toContain("Add section");
    expect(html).not.toContain("Save layout");
    expect(html).not.toContain("Cancel");
  });

  it("lets the owner customize the actual profile with section and stat controls", () => {
    const html = renderToStaticMarkup(<ProfileView profile={{ ...withLinks, profile_layout: customized }} isOwner customize />);
    expect(html).toContain("Make this profile yours");
    expect(html).toContain("Add section");
    expect(html).toContain("Save layout");
    expect(html).toContain("Cancel");
    expect(html).toContain("Preview");
    expect(html).toContain('aria-label="Shift Languages section down"');
    expect(html).toContain('aria-label="Drag Languages section to reorder"');
    expect(html).toContain("touch-none");
    expect(html).toContain("size-11");
    expect(html).not.toContain('aria-label="Hide Languages section"');
    expect(html).not.toContain('aria-label="Set half width"');
    expect(html).toContain('aria-label="Languages section options"');
    expect(html).toContain('aria-label="Move Coding time later"');
    expect(html).toContain("Choose stats · 2 of 6");
    expect(html).toContain("Sync settings");
    expect(html).toContain("/dashboard?section=appearance");
    expect(renderedSections(html)).toEqual(["languages", "links", "stats"]);
    expect(renderedStats(html)).toEqual(["coding_minutes", "lines_removed"]);
    expect(html).toContain("Custom Manual Language");
    expect(html).not.toContain('href="/u/developer?customize=1"');
  });

  it("keeps future saved layouts intact and disables modifying controls in the fallback editor", () => {
    const future = { version: 3, modules: [{ type: "future_chart", source: "future_source" }] };
    const before = structuredClone(future);
    const html = renderToStaticMarkup(<ProfileView profile={{ ...withLinks, profile_layout: future }} isOwner customize />);
    expect(html).toContain("This layout was saved with a newer version of Stack Stats.");
    expect(html).toContain('role="alert"');
    expect(html).toMatch(/<button\b[^>]*\bdisabled=""[^>]*>Save layout<\/button>/);
    expect(html).toMatch(/<button\b[^>]*\bdisabled=""[^>]*>.*?Add section<\/button>/);
    expect(html).not.toContain('aria-label="Languages section options"');
    expect(html).not.toContain('aria-label="Shift Languages section down"');
    expect(renderedSections(html)).toEqual(["links", "stats", "code_changes", "languages"]);
    expect(future).toEqual(before);
  });

  it("does not reveal unpublished languages or replace them with manual data in the editor", () => {
    const profile = withSyncedProfile({ ...manual, profile_layout: customized }, { ...published, languages: [] });
    const html = renderToStaticMarkup(<ProfileView profile={profile} isOwner customize />);
    expect(html).toContain('aria-label="Languages section options"');
    expect(html).toContain("No language activity is published.");
    expect(html).toContain("Manage what you publish in Sync settings.");
    expect(html).not.toContain("Custom Manual Language");
    expect(html).not.toContain("javascriptreact");
    expect(html).not.toContain("self-reported");
    expect(profile.languages).toEqual([]);
    expect(manual.languages[0].name).toBe("Custom Manual Language");
  });
});

describe("language chart presentation", () => {
  it("uses the same precision in the legend, accessible description, and tooltip without rounding chart data", () => {
    const percentage = 55.16842947293574;
    const languages = [{ name: "javascriptreact", percentage }];
    const html = renderToStaticMarkup(<LanguageDonutChart languages={languages} />);

    expect(html).toContain('aria-label="Language activity: React (JavaScript) 55.2%"');
    expect(html).toContain("55.2%</span>");
    expect(html).not.toContain(String(percentage));
    expect(charts.tooltip.mock.lastCall?.[0].formatter(percentage)).toEqual(["55.2%", "Activity"]);
    expect(charts.pie.mock.lastCall?.[0].data).toEqual([{ name: "React (JavaScript)", percentage }]);
    expect(languages).toEqual([{ name: "javascriptreact", percentage }]);
  });

  it("retains invalid-data filtering and the empty state", () => {
    const html = renderToStaticMarkup(<LanguageDonutChart languages={[
      { name: "", percentage: 100 },
      { name: "typescript", percentage: NaN },
      { name: "python", percentage: Infinity },
      { name: "css", percentage: -1 },
      { name: "html", percentage: 0 },
    ]} />);
    expect(html).toContain("No valid language activity to display.");
    expect(charts.pie).not.toHaveBeenCalled();
  });
});
