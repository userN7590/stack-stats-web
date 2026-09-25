import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ProfileSectionPicker } from "@/components/profile/profile-section-picker";
import { ProfileView } from "@/components/profile/profile-view";
import { addVisualization, getDefaultProfileLayout, getModuleKey, hasUnsupportedVisualizations, moveModule, moveModuleTo, normalizeProfileLayout, profileLayoutSchema, removeVisualization, setModuleSize, setModuleVisibility, setVisualizationConfig } from "@/lib/profile-layout";
import { defaultVisualizationConfig } from "@/lib/visualization";
import { withSyncedProfile } from "@/lib/synced-profile";
import type { PublicProfile } from "@/lib/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({}) }));
const profile: PublicProfile = {
  user_id: "owner", username: "example", display_name: "Developer", bio: null, avatar_url: null,
  github_url: null, website_url: null, lines_added: 240, lines_removed: 300, files_changed: 10,
  edit_events: 100, projects_count: 3, coding_minutes: 200, display_font: "editorial", background_style: "none",
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  languages: [{ id: "ts", user_id: "owner", name: "typescript", percentage: 100, created_at: "2026-01-01T00:00:00Z" }],
};

function visualizationOnly() {
  let layout = addVisualization(getDefaultProfileLayout(), "viz_first");
  for (const section of getDefaultProfileLayout().modules) layout = setModuleVisibility(layout, section.type, false);
  return layout;
}

describe("persisted visualization layouts", () => {
  it("keeps v1 layouts unchanged and upgrades only when a visualization is added", () => {
    const original = getDefaultProfileLayout();
    expect(normalizeProfileLayout(original)).toEqual(original);
    expect(original.version).toBe(1);
    const next = addVisualization(original, "viz_first");
    expect(next.version).toBe(2);
    expect(next.modules.slice(0, 4)).toEqual(original.modules);
    expect(normalizeProfileLayout(JSON.parse(JSON.stringify(next)))).toEqual(next);
    expect(profileLayoutSchema.parse(next)).toEqual(next);
    expect(profileLayoutSchema.safeParse({ ...next, version: 1 }).success).toBe(false);
  });

  it("gives repeated visualizations independent identity, order, appearance and size", () => {
    const layout = addVisualization(addVisualization(getDefaultProfileLayout(), "viz_first"), "viz_second");
    const moved = moveModuleTo(layout, "viz_second", "links");
    expect(moved.modules.map(getModuleKey)).toEqual(["viz_second", "links", "stats", "code_changes", "languages", "viz_first"]);
    expect(moveModule(moved, "viz_second", 1).modules[1]).toEqual(moved.modules[0]);
    const hidden = setModuleVisibility(setModuleSize(moved, "viz_second", "half"), "viz_second", false);
    const updated = setVisualizationConfig(hidden, "viz_first", { ...defaultVisualizationConfig(), renderer: "dots", appearance: { palette: "neon" } });
    const restored = setModuleVisibility(updated, "viz_second", true);
    expect(restored.modules[0]).toMatchObject({ id: "viz_second", size: "half", config: { renderer: "polar_area", appearance: { palette: "stack" } } });
    expect(restored.modules.at(-1)).toMatchObject({ id: "viz_first", config: { renderer: "dots", appearance: { palette: "neon" } } });
    expect(profileLayoutSchema.safeParse(restored).success).toBe(true);
    expect(layout.modules[4]).toMatchObject({ size: "full", visible: true });
  });

  it("bounds saved visualizations and rejects duplicate IDs or incompatible configurations", () => {
    let layout = getDefaultProfileLayout();
    for (let i = 0; i < 6; i++) layout = addVisualization(layout, `viz_${i}`);
    expect(addVisualization(layout, "viz_extra")).toBe(layout);
    expect(addVisualization(layout, "viz_0")).toBe(layout);
    expect(profileLayoutSchema.safeParse(layout).success).toBe(true);
    expect(profileLayoutSchema.safeParse({ ...layout, modules: [...layout.modules.slice(0, -1), layout.modules[4]] }).success).toBe(false);
    const broken = structuredClone(layout);
    const item = broken.modules[4];
    if (item.type === "visualization") item.config.renderer = "waterfall";
    expect(profileLayoutSchema.safeParse(broken).success).toBe(false);
    expect(addVisualization(getDefaultProfileLayout(), "links")).toEqual(getDefaultProfileLayout());
  });

  it("can remove a visualization but preserves the last visible section", () => {
    const only = visualizationOnly();
    expect(removeVisualization(only, "viz_first")).toBe(only);
    expect(removeVisualization(addVisualization(only, "viz_second"), "viz_first").modules.some((section) => getModuleKey(section) === "viz_first")).toBe(false);
  });

  it("omits unknown renderer semantics and prevents destructive saves without revealing hidden core sections", () => {
    const raw = structuredClone(visualizationOnly());
    const item = raw.modules[4];
    if (item.type !== "visualization") throw Error("Expected fixture");
    const unknown = { ...raw, modules: [...raw.modules.slice(0, 4), { ...item, config: { ...item.config, renderer: "future_surface" } }] };
    const before = JSON.stringify(unknown);
    expect(hasUnsupportedVisualizations(unknown)).toBe(true);
    const normalized = normalizeProfileLayout(unknown);
    expect(normalized.modules.every((section) => !section.visible)).toBe(true);
    const html = renderToStaticMarkup(<ProfileView profile={{ ...profile, profile_layout: unknown }} isOwner customize />);
    expect(html).toContain("your saved layout stays intact");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save layout<\/button>/);
    expect(html).not.toContain("future_surface");
    expect(html).not.toContain("Development totals");
    expect(JSON.stringify(unknown)).toBe(before);
  });
});

describe("visualization integration", () => {
  it("offers Visualization alongside hidden sections and disables creation at the limit", () => {
    let layout = getDefaultProfileLayout();
    const render = () => renderToStaticMarkup(<ProfileSectionPicker modules={layout.modules} onChoose={() => {}} onAddVisualization={() => {}} onClose={() => {}} />);
    expect(render()).toContain('aria-label="Add visualization"');
    for (let i = 0; i < 6; i++) layout = addVisualization(layout, `viz_${i}`);
    expect(render()).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Add visualization"/);
  });

  it("renders public data, exact labels and colors without exposing editor controls", () => {
    const layout = visualizationOnly();
    const html = renderToStaticMarkup(<ProfileView profile={{ ...profile, profile_layout: layout }} />);
    expect(html).toContain('data-visualization="polar_area"');
    expect(html).toContain("Self-reported profile data");
    expect(html).toContain("TypeScript");
    expect(html).toContain("100.0%");
    expect(html).toContain("<table");
    expect(html).not.toContain("Chart style &amp; colors");
    expect(html).not.toContain("Save layout");
  });

  it("does not restore saved manual languages when synced languages are unpublished", () => {
    const synced = withSyncedProfile({ ...profile, profile_layout: visualizationOnly() }, {
      activeMs: 10, editCount: 10, linesAdded: 20, linesRemoved: 2, fileDays: 1, projectCount: 1, recordCount: 1,
      updatedAt: "2026-09-25T00:00:00Z", languages: [],
    });
    for (const isOwner of [false, true]) {
      const html = renderToStaticMarkup(<ProfileView profile={synced} isOwner={isOwner} customize={isOwner} />);
      expect(html).toContain("No language activity is published.");
      expect(html).not.toContain("TypeScript");
      expect(html).not.toContain("100.0%");
    }
  });

  it("preserves manual fallback and denies editor controls to visitors", () => {
    const fallback = withSyncedProfile({ ...profile, profile_layout: visualizationOnly() }, null);
    const html = renderToStaticMarkup(<ProfileView profile={fallback} customize />);
    expect(html).toContain("Self-reported profile data");
    expect(html).toContain("TypeScript");
    expect(html).not.toContain("Add visualization");
    expect(html).not.toContain("Chart style &amp; colors");
  });
});
