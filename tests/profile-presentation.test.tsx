import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageDonutChart } from "../src/components/profile/language-donut-chart";
import { ProfileView } from "../src/components/profile/profile-view";
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
      expect(html).toMatch(/href="\/dashboard\?section=identity"[^>]*>.*?Customize profile<\/a>/);
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
