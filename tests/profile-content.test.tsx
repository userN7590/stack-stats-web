import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import fixtures from "./fixtures/profile-content.json";
import { ProfileContent } from "@/components/profile/profile-content";
import { ProfileContentEditor, MetricSelect } from "@/components/profile/profile-content-editor";
import { ProfileModules } from "@/components/profile/profile-modules";
import { ProfileSectionPicker } from "@/components/profile/profile-section-picker";
import { ProfileView } from "@/components/profile/profile-view";
import { SyncPrivacyForm } from "@/components/dashboard/sync-privacy";
import { compatibleContentRenderers, contentModuleSchema, datasetPoints, defaultDatasetConfig, formatMetricValue, newContentModule, publicMetricState, scalarMetricIds, type ContentModule, type DatasetMetric } from "@/lib/profile-content";
import { addContentModule, addVisualization, getDefaultProfileLayout, getDefaultLayoutForProfile, getProfileLayout, getModuleKey, hasUnsupportedVisualizations, moveModuleTo, normalizeProfileLayout, profileLayoutSchema, removeModule, replaceContentModule, setModuleSize, setModuleVisibility } from "@/lib/profile-layout";
import { metricRegistry, type PublicMetricId } from "@/lib/metric-registry";
import { withPublishedMetrics } from "@/lib/synced-profile";
import type { MetricResult } from "@/lib/sync-datasets";
import type { PublicProfile } from "@/lib/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({}) }));
const manual: PublicProfile = {
  user_id: "owner", username: "example", display_name: "Developer", bio: null, avatar_url: null,
  github_url: null, website_url: null, lines_added: 999, lines_removed: 33, files_changed: 10,
  edit_events: 100, projects_count: 3, coding_minutes: 200, display_font: "editorial", background_style: "none",
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", languages: [],
};
function metric(id: PublicMetricId, fields: Partial<MetricResult>): MetricResult {
  return { id, definitionVersion: 1, unit: metricRegistry[id].unit, dateBasis: metricRegistry[id].dateBasis, quality: "partial", ...fields };
}
function published(metrics: MetricResult[]) { return withPublishedMetrics(manual, { schemaVersion: "2", metrics }); }
const profile = published([
  metric("activity.active_ms", { value: 150_000 }), metric("activity.edits", { value: 0 }),
  metric("sessions.average_ms", { value: null, quality: "unavailable" }),
  metric("languages.activity", { dataset: [
    { id: "typescriptreact", activeMs: 10, editCount: 2, linesAdded: 4, linesRemoved: 1 },
    { id: "javascriptreact", activeMs: 20, editCount: 1, linesAdded: 4, linesRemoved: 3 },
  ] }),
]);
function section(type: ContentModule["type"]) { return newContentModule(type, "sec_test"); }

describe("v3 client and SQL contract", () => {
  it("defaults fresh selected publication to actual available metrics without rewriting saved legacy layouts", () => {
    const fresh = getProfileLayout(profile);
    expect(fresh.version).toBe(3);
    expect(fresh.modules[0]).toMatchObject({ type: "stat_grid", cells: ["activity.active_ms", "activity.edits", null, null] });
    expect(getDefaultLayoutForProfile(manual)).toEqual(getDefaultProfileLayout());
    expect(getProfileLayout({ ...profile, profile_layout: getDefaultProfileLayout() })).toEqual(getDefaultProfileLayout());
    expect(profileLayoutSchema.safeParse(fresh).success).toBe(true);
  });
  it.each(fixtures)("$name", ({ layout, valid }) => expect(profileLayoutSchema.safeParse(layout).success).toBe(valid));
  it("retains every legacy field, chart appearance and order when adding content", () => {
    const original = addVisualization(getDefaultProfileLayout(), "viz_legacy");
    const next = addContentModule(original, "single_stat", "sec_new");
    expect(next.version).toBe(3); expect(next.modules.slice(0, -1)).toEqual(original.modules);
    expect(normalizeProfileLayout(JSON.parse(JSON.stringify(next)))).toEqual(next);
    expect(original.version).toBe(2);
  });
  it("supports hidden slots, drag order, each span, independent identities and removal", () => {
    let layout = addContentModule(addContentModule(getDefaultProfileLayout(), "single_stat", "sec_first"), "single_stat", "sec_second");
    layout = setModuleVisibility(layout, "sec_first", false);
    const moved = moveModuleTo(layout, "sec_second", "links");
    expect(moved.modules[0]).toMatchObject({ id: "sec_second" });
    expect(moved.modules[4]).toMatchObject({ id: "sec_first", visible: false });
    for (const size of ["full", "half", "third", "two_thirds"] as const) {
      const sized = setModuleSize(moved, "sec_first", size);
      expect(setModuleVisibility(sized, "sec_first", true).modules[4]).toMatchObject({ size, visible: true });
      expect(profileLayoutSchema.safeParse(sized).success).toBe(true);
    }
    expect(removeModule(moved, "sec_first").modules.map(getModuleKey)).not.toContain("sec_first");
    const only = { version: 3 as const, modules: [section("single_stat")] };
    expect(removeModule(only, "sec_test")).toBe(only);
  });
  it("locks editing of future or damaged v3 semantics without exposing hidden defaults", () => {
    const raw = { version: 3, modules: [{ type: "future_shape", id: "sec_future", visible: true }, { ...section("single_stat"), visible: false }] };
    expect(hasUnsupportedVisualizations(raw)).toBe(true);
    const layout = normalizeProfileLayout(raw);
    expect(layout.modules).toHaveLength(1); expect(layout.modules[0].visible).toBe(false);
    const html = renderToStaticMarkup(<ProfileView profile={{ ...profile, profile_layout: raw }} isOwner customize />);
    expect(html).toContain("Editing is unavailable"); expect(html).not.toContain('data-profile-section="stats"');
  });
  it("does not save an incompatible presentation or private metric", () => {
    const layout = addContentModule(getDefaultProfileLayout(), "dataset", "sec_test");
    const bad = { ...section("dataset"), config: { ...defaultDatasetConfig("schedule.daily"), renderer: "donut" } };
    expect(replaceContentModule(layout, bad as ContentModule)).toBe(layout);
  });
});

describe("published data presentation", () => {
  it("never uses manual or legacy totals as a richer metric fallback", () => {
    expect(publicMetricState(manual, "activity.lines_added").status).toBe("not-published");
    expect(publicMetricState(profile, "activity.lines_added").status).toBe("not-published");
    expect(publicMetricState(profile, "activity.edits").status).toBe("ready");
    expect(publicMetricState(profile, "sessions.average_ms").status).toBe("unavailable");
    const content = { ...section("single_stat"), type: "single_stat" as const, metric: "activity.lines_added" as const, style: "label" as const };
    const html = renderToStaticMarkup(<ProfileContent profile={profile} module={content} />);
    expect(html).toContain("Not published"); expect(html).not.toContain("999");
  });
  it("shows zero, partial coverage, description and accessible number-only labels", () => {
    const content = { ...section("single_stat"), type: "single_stat" as const, metric: "activity.edits" as const, style: "number" as const };
    const html = renderToStaticMarkup(<ProfileContent profile={profile} module={content} />);
    expect(html).toContain('>0</p>'); expect(html).toContain('class="sr-only">Content changes');
    expect(html).toContain("Partial observations"); expect(html).toContain("Automatically tracked by Stack Stats");
    expect(html).toContain("not callbacks, batches, or keystrokes");
  });
  it("formats fractional durations and negative net changes consistently", () => {
    expect(formatMetricValue(89_543.987, "milliseconds")).toBe("1m");
    expect(formatMetricValue(0, "milliseconds")).toBe("0s");
    expect(formatMetricValue(0.5, "milliseconds")).toBe("<1s");
    expect(formatMetricValue(3_661_999, "milliseconds")).toBe("1h 1m");
    expect(formatMetricValue(-1234, "lines")).toBe("-1,234");
  });
  it("renders independent grid cells, empty cells and unavailable values", () => {
    const content = contentModuleSchema.parse({ ...section("stat_grid"), cells: ["activity.edits", "sessions.average_ms", null, "activity.edits"] });
    const html = renderToStaticMarkup(<ProfileContent profile={profile} module={content} />);
    expect(html.match(/data-metric="activity.edits"/g)).toHaveLength(2);
    expect(html).toContain("Unavailable"); expect(html).toContain("No stat selected");
    expect(html).toContain('data-columns="2"');
  });
  it("recomputes language shares by the selected measure, retaining human names", () => {
    const config = defaultDatasetConfig("languages.activity");
    const timed = datasetPoints(profile, config);
    const edited = datasetPoints(profile, { ...config, measure: "editCount" });
    expect(timed[0].label).toBe("React (JavaScript)"); expect(edited[0].label).toBe("React (TypeScript)");
    expect(timed[0].value).toBeCloseTo(66.6666667);
    const html = renderToStaticMarkup(<ProfileContent profile={profile} module={{ ...section("dataset"), type: "dataset", config }} />);
    expect(html).toContain("66.7%"); expect(html).not.toContain("66.666");
  });
  it.each(["languages.activity", "schedule.daily", "sessions.histogram", "schedule.hourly_utc"] as DatasetMetric[])("only registers real presentations for %s", id => {
    expect(compatibleContentRenderers(id).length).toBeGreaterThan(0);
    for (const renderer of compatibleContentRenderers(id)) expect(contentModuleSchema.safeParse({ ...section("dataset"), config: { ...defaultDatasetConfig(id), renderer } }).success).toBe(true);
    expect(compatibleContentRenderers(id)).not.toContain("waterfall");
  });
  it("does not connect daily gaps or fabricate unobserved dates", () => {
    const daily = published([metric("schedule.daily", { dataset: [
      { date: "2026-09-01", activeMs: 10, editCount: 1, linesAdded: 0, linesRemoved: 0 },
      { date: "2026-09-03", activeMs: 20, editCount: 2, linesAdded: 0, linesRemoved: 0 },
    ] })]);
    const config = defaultDatasetConfig("schedule.daily");
    const html = renderToStaticMarkup(<ProfileContent profile={daily} module={{ ...section("dataset"), type: "dataset", config }} />);
    expect(html).toContain("Gaps are missing observations"); expect(html).not.toContain("2026-09-02");
    expect(html.match(/<circle /g)).toHaveLength(2); expect(html).not.toContain('stroke-width="2"');
  });
  it("distinguishes unavailable hourly history from 24 observed zero bins", () => {
    const config = defaultDatasetConfig("schedule.hourly_utc");
    const content = { ...section("dataset"), type: "dataset" as const, config };
    const unavailable = published([metric("schedule.hourly_utc", { quality: "unavailable", dataset: null })]);
    expect(renderToStaticMarkup(<ProfileContent profile={unavailable} module={content} />)).toContain("Unavailable");
    const zero = published([metric("schedule.hourly_utc", { dataset: { source: "telemetry-v2", dateBasis: "UTC", activeMsByHour: Array(24).fill(0), editCountByHour: Array(24).fill(0), linesAddedByHour: Array(24).fill(0), linesRemovedByHour: Array(24).fill(0) } })]);
    const html = renderToStaticMarkup(<ProfileContent profile={zero} module={content} />);
    expect(html).toContain("All observed bins are zero"); expect(html).not.toContain("Unavailable");
    expect(html).toContain("23:00 UTC"); expect(html).not.toContain("NaN");
  });
  it("renders zero-sample histograms without division errors or inferred median", () => {
    const histogram = published([metric("sessions.histogram", { dataset: Array(9).fill(0) })]);
    const html = renderToStaticMarkup(<ProfileContent profile={histogram} module={{ ...section("dataset"), type: "dataset", config: defaultDatasetConfig("sessions.histogram") }} />);
    expect(html).toContain("All observed values are zero"); expect(html).toContain("not density"); expect(html).not.toContain("NaN");
  });
  it("uses identical approved rendering for preview and visitors", () => {
    const layout = profileLayoutSchema.parse({ version: 3, modules: [{ ...section("single_stat"), metric: "activity.active_ms" }] });
    expect(renderToStaticMarkup(<ProfileModules profile={profile} layout={layout} />)).toBe(renderToStaticMarkup(<ProfileModules profile={profile} layout={layout} isOwner />));
  });
});

describe("data-first editing and privacy", () => {
  it("groups new sections by data, media, other and retains restoration", () => {
    const html = renderToStaticMarkup(<ProfileSectionPicker modules={getDefaultProfileLayout().modules} onChoose={() => {}} onClose={() => {}} onAddContent={() => {}} />);
    for (const label of ["Single stat", "Stat grid", "Dataset visualization", "Document / PDF", "Links"]) expect(html).toContain(`aria-label="Add ${label}"`);
    expect(html).toContain("Image · Not available yet"); expect(html).not.toContain('aria-label="Add visualization"');
  });
  it("excludes private metrics and disables unpublished/unavailable choices", () => {
    const html = renderToStaticMarkup(<MetricSelect profile={profile} value={null} label="Stat" onChange={() => {}} />);
    expect(html).not.toContain("projects."); expect(scalarMetricIds).not.toContain("sessions.histogram");
    expect(html).toMatch(/<option[^>]*value="activity.lines_added"[^>]*disabled/);
    expect(html).toMatch(/<option[^>]*value="sessions.average_ms"[^>]*disabled/);
    expect(html).toContain('<option value="activity.edits">');
  });
  it("provides publication guidance, labeled controls and conservative stat styles", () => {
    const html = renderToStaticMarkup(<ProfileContentEditor profile={profile} module={section("single_stat")} disabled={false} onChange={() => {}} onClose={() => {}} />);
    expect(html).toContain("/settings/sync#publication"); expect(html).toContain("never publish additional data");
    expect(html).toContain("Number + context"); expect(html).not.toContain("Sparkline");
  });
  it("requires explicit schedule permission and keeps private projects out of publication", () => {
    const html = renderToStaticMarkup(<SyncPrivacyForm initial={{ publicationVersion: 2, publishProfile: true, publishLanguages: false, metricIds: [] }} availableMetricIds={["activity.active_ms", "schedule.daily"]} />);
    expect(html).toContain("Additional schedule permission required"); expect(html).not.toContain("Private project activity");
    expect(html).toContain("These can reveal my work schedule");
  });
  it("renders external documents without embeds, HTML execution or automatic requests", () => {
    const content = contentModuleSchema.parse({ ...section("document"), title: "<script>paper</script>", url: "https://example.com/paper.pdf" });
    const html = renderToStaticMarkup(<ProfileContent profile={profile} module={content} />);
    expect(html).toContain("&lt;script&gt;"); expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toMatch(/<(iframe|object|img|script)/);
  });
});
