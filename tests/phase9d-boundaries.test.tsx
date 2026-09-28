import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({}) }));

import { ProfileView } from "@/components/profile/profile-view";
import { exampleProfile } from "@/lib/example-profile";
import { metricRegistry } from "@/lib/metric-registry";
import { contentRenderers, defaultDatasetConfig, profileDatasets } from "@/lib/profile-content";
import { getDefaultProfileLayout } from "@/lib/profile-layout";
import type { PublicProfile } from "@/lib/types";

function files(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("public/private fingerprint boundary", () => {
  it("has no public renderer or dataset that claims the private day × hour shape", () => {
    for (const renderer of Object.values(contentRenderers)) {
      const shapes: readonly string[] = typeof renderer.shape === "string" ? [renderer.shape] : renderer.shape;
      expect(shapes).not.toContain("utc-day-hours");
    }
    for (const source of Object.values(profileDatasets)) expect(source.shape).not.toBe("utc-day-hours");
    expect(metricRegistry["schedule.hourly_utc"].compatiblePresentations).not.toContain("waterfall");
    expect(metricRegistry["schedule.hourly_utc"].compatiblePresentations).not.toContain("ridgeline");
  });

  it("keeps owner-only loading out of every public profile route and component", () => {
    // Homepage profile cards render only the public projection or labelled examples.
    const publicSources = [...files("src/app/u"), ...files("src/components/profile"), "src/lib/public-profile.ts", "src/lib/synced-profile.ts", "src/lib/profile-content.ts", "src/lib/profile-layout.ts",
      "src/components/home/profile-cards.tsx", "src/lib/example-developers.ts"];
    for (const path of publicSources) {
      const source = readFileSync(path, "utf8");
      expect(source, path).not.toContain("owner-fingerprint");
      expect(source, path).not.toContain("/api/v2/sync/datasets");
      expect(source, path).not.toMatch(/sync_private_(summary|datasets)/);
    }
    // The homepage server component never imports the owner loader directly.
    expect(readFileSync("src/app/page.tsx", "utf8")).not.toContain("owner-fingerprint");
    expect(readFileSync("src/components/home/home-view.tsx", "utf8")).not.toContain("owner-fingerprint");
    // Owner data loads only from an explicit click handler, never on mount.
    const owner = readFileSync("src/components/home/home-fingerprint.tsx", "utf8");
    expect(owner.match(/loadOwnerFingerprint\(/g)).toHaveLength(1);
    expect(owner).toMatch(/async function loadMine\(\) \{\s*setOwner\(\{ status: "loading" \}\);\s*setOwner\(await loadOwnerFingerprint\(\)\);/);
    expect(owner).toContain("onClick={loadMine}");
    expect(owner).not.toMatch(/useEffect/);
  });

  it("renders no fingerprint in public profiles, even with published hourly bins", () => {
    const hourly: PublicProfile = {
      ...exampleProfile, stats_source: "synced",
      published_metrics: { schemaVersion: "2", metrics: [{ id: "schedule.hourly_utc", definitionVersion: 1, unit: "count", quality: "partial", dateBasis: "UTC",
        dataset: { source: "telemetry-v2", dateBasis: "UTC", activeMsByHour: Array(24).fill(60_000), editCountByHour: Array(24).fill(0), linesAddedByHour: Array(24).fill(0), linesRemovedByHour: Array(24).fill(0) } }] },
      profile_layout: { version: 3, modules: [{ type: "dataset", id: "sec_hours", visible: true, size: "full", config: defaultDatasetConfig("schedule.hourly_utc") }] },
    };
    const html = renderToStaticMarkup(<ProfileView profile={hourly} />);
    expect(html).toContain('data-renderer="heatmap"');
    expect(html).not.toContain("data-fingerprint");
  });
});

describe("profile visual polish (Phase 9D)", () => {
  it("continues the frame rails through navigation and marks the header rule", () => {
    const html = renderToStaticMarkup(<ProfileView profile={{ ...exampleProfile, profile_layout: getDefaultProfileLayout() }} />);
    expect(html).toContain("nav-rails");
    expect(html).toContain("profile-frame");
    expect(html.match(/profile-mark profile-mark-(left|right)/g)).toHaveLength(2);
    expect(html).toContain("Developer profile");
    expect(html).toContain("/u/alex");
    // Legacy v1 sections are unchanged.
    for (const heading of ["Development totals", "Code changes", "Language activity", "Links"]) expect(html).toContain(heading);
  });

  it("labels the example profile as representative data", () => {
    const html = renderToStaticMarkup(<ProfileView profile={exampleProfile} isExample />);
    expect(html).toContain("Example profile · representative data");
    expect(html).not.toContain("Customize profile");
  });

  it("caps dataset chart scaling so axis text stays near its design size", () => {
    const profile: PublicProfile = {
      ...exampleProfile, stats_source: "synced",
      published_metrics: { schemaVersion: "2", metrics: [{ id: "schedule.daily", definitionVersion: 1, unit: "milliseconds", quality: "partial", dateBasis: "collector-local",
        dataset: [{ date: "2026-09-01", activeMs: 60_000, editCount: 1, linesAdded: 1, linesRemoved: 0 }] }] },
      profile_layout: { version: 3, modules: [{ type: "dataset", id: "sec_daily", visible: true, size: "full", config: defaultDatasetConfig("schedule.daily") }] },
    };
    const html = renderToStaticMarkup(<ProfileView profile={profile} />);
    expect(html).toMatch(/<svg viewBox="0 0 510 265" preserveAspectRatio="xMinYMin meet"[^>]*class="block max-h-\[340px\] w-full"/);
  });
});
