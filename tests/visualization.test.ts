import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { annularSector, polarRadius, VisualizationChart } from "../src/components/profile/visualizations/visualization-chart";
import { withSyncedProfile, type PublishedSync } from "../src/lib/synced-profile";
import type { PublicProfile } from "../src/lib/types";
import {
  appearanceSchema,
  appearanceWarnings,
  colorContrast,
  compatibleRenderers,
  datasetIds,
  defaultVisualizationConfig,
  getVisualizationDataset,
  normalizeVisualizationConfig,
  palettes,
  rendererIds,
  resolveAppearance,
  visualizationConfigSchema,
  type ChartAppearance,
  type DatasetId,
  type RendererId,
  type VisualizationConfig,
} from "../src/lib/visualization";

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
  languages: [],
};

function withLanguages(entries: [string, number][]): PublicProfile {
  return {
    ...manual,
    languages: entries.map(([name, percentage], index) => ({
      id: `language-${index}`,
      user_id: manual.user_id,
      name,
      percentage,
      created_at: manual.created_at,
    })),
  };
}

const languageProfile = withLanguages([["javascriptreact", 55.16842947293574], ["typescriptreact", 44.83157052706426]]);
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

function configFor(renderer: RendererId): VisualizationConfig {
  return {
    ...defaultVisualizationConfig(renderer === "waterfall" ? "line_changes" : "language_share"),
    renderer,
  };
}

function chartHtml(renderer: RendererId, profile: PublicProfile = languageProfile, thumbnail = false): string {
  const config = configFor(renderer);
  return renderToStaticMarkup(createElement(VisualizationChart, {
    config,
    dataset: getVisualizationDataset(profile, config.dataset),
    thumbnail,
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("visualization configuration and compatibility", () => {
  const allowed: Record<DatasetId, RendererId[]> = {
    language_share: ["bars", "dots", "radial_bars", "polar_area", "donut"],
    line_changes: ["waterfall"],
  };

  it.each(datasetIds)("offers only semantically compatible charts for %s", (dataset) => {
    expect(compatibleRenderers(dataset)).toEqual(allowed[dataset]);
    expect(visualizationConfigSchema.safeParse(defaultVisualizationConfig(dataset)).success).toBe(true);
  });

  it.each(datasetIds.flatMap((dataset) => rendererIds.map((renderer) => ({ dataset, renderer }))))(
    "validates the entire chart/data pair $dataset / $renderer",
    ({ dataset, renderer }) => {
      const config = { ...defaultVisualizationConfig(dataset), renderer };
      const expected = allowed[dataset].includes(renderer);
      expect(visualizationConfigSchema.safeParse(config).success).toBe(expected);
      expect(normalizeVisualizationConfig(config)).toEqual(expected ? config : null);
    },
  );

  it.each([
    { version: 2 },
    { dataset: "daily_coding_time" },
    { renderer: "future_surface" },
    { privateSummary: true },
    { renderer: undefined },
  ])("does not repair unknown chart semantics or unexpected fields: %j", (change) => {
    const config = { ...defaultVisualizationConfig(), ...change };
    expect(visualizationConfigSchema.safeParse(config).success).toBe(false);
    expect(normalizeVisualizationConfig(config)).toBeNull();
  });

  it.each([null, undefined, [], "chart", 42])("rejects malformed config %j", (raw) => {
    expect(normalizeVisualizationConfig(raw)).toBeNull();
  });

  it.each([undefined, null, { palette: "future_palette" }, { palette: "custom", colors: ["url(javascript:alert(1))"] }])(
    "repairs appearance damage without changing the chart or dataset: %j",
    (appearance) => {
      const raw = { ...defaultVisualizationConfig("line_changes"), appearance };
      expect(normalizeVisualizationConfig(raw)).toEqual(defaultVisualizationConfig("line_changes"));
      expect(raw.appearance).toEqual(appearance);
    },
  );

  it("cannot repair an incompatible pair merely by repairing its palette", () => {
    expect(normalizeVisualizationConfig({
      ...defaultVisualizationConfig("line_changes"), renderer: "polar_area", appearance: null,
    })).toBeNull();
  });
});

describe("visualization palettes", () => {
  it.each(Object.entries(palettes))("keeps preset %s valid, bounded, and visible against the chart background", (id, palette) => {
    const appearance = appearanceSchema.parse({ palette: id });
    const resolved = resolveAppearance(appearance);
    expect(resolved.colors).toEqual(palette.colors);
    expect(resolved.colors).toHaveLength(8);
    for (const color of [...resolved.colors, resolved.positive, resolved.negative]) {
      expect(colorContrast(color)).toBeGreaterThanOrEqual(3);
    }
    expect(appearanceWarnings(appearance)).toEqual([]);
  });

  it("allows a partial custom palette and fills only missing channels", () => {
    const appearance = appearanceSchema.parse({ palette: "custom", colors: ["#FFFFFF", "#AACCFF"], negative: "#FFDDAA" });
    const resolved = resolveAppearance(appearance);
    expect(resolved.colors.slice(0, 2)).toEqual(["#FFFFFF", "#AACCFF"]);
    expect(resolved.colors.slice(2)).toEqual(palettes.stack.colors.slice(2));
    expect(resolved.positive).toBe(palettes.stack.positive);
    expect(resolved.negative).toBe("#FFDDAA");
  });

  it("supports custom mode before the owner changes any color", () => {
    const appearance = appearanceSchema.parse({ palette: "custom" });
    expect(resolveAppearance(appearance)).toEqual(resolveAppearance({ palette: "stack" }));
    expect(appearanceWarnings(appearance)).toEqual([]);
  });

  it.each([
    { colors: [] },
    { colors: Array.from({ length: 9 }, () => "#FFFFFF") },
    { colors: ["#FFF"] },
    { colors: ["red"] },
    { colors: ["#FFFFFFFF"] },
    { colors: ["#GGGGGG"] },
    { positive: "rgb(255,0,0)" },
    { negative: "url(https://example.com/image)" },
    { colors: [null] },
    { background: "#FFFFFF" },
  ])("rejects unsupported custom appearance input %j", (fields) => {
    expect(appearanceSchema.safeParse({ palette: "custom", ...fields }).success).toBe(false);
  });

  it("rejects color overrides accidentally attached to a named preset", () => {
    expect(appearanceSchema.safeParse({ palette: "neon", colors: ["#FFFFFF"] }).success).toBe(false);
  });

  it("warns about dark choices while replacing only unreadable channels", () => {
    const appearance: ChartAppearance = { palette: "custom", colors: ["#11110D", "#FFFFFF"], positive: "#000000", negative: "#FFDDAA" };
    const resolved = resolveAppearance(appearance);
    expect(resolved.colors[0]).toBe(palettes.stack.colors[0]);
    expect(resolved.colors[1]).toBe("#FFFFFF");
    expect(resolved.positive).toBe(palettes.stack.positive);
    expect(resolved.negative).toBe("#FFDDAA");
    expect(appearanceWarnings(appearance)).toEqual([expect.stringContaining("readable defaults")]);
    expect(appearance.colors).toEqual(["#11110D", "#FFFFFF"]);
  });

  it("does not mutate preset colors through a resolved appearance", () => {
    const resolved = resolveAppearance({ palette: "stack" });
    resolved.colors[0] = "#FFFFFF";
    expect(resolveAppearance({ palette: "stack" }).colors[0]).toBe("#55A7FF");
  });

  it("handles invalid contrast inputs without passing them through", () => {
    expect(colorContrast("#11110D")).toBeCloseTo(1);
    expect(colorContrast("#FFFFFF")).toBeGreaterThan(15);
    expect(colorContrast("url(bad)")).toBe(0);
  });
});

describe("public visualization dataset adapters", () => {
  it("preserves manual numbers and source language without mutating stored language IDs", () => {
    const before = structuredClone(languageProfile);
    const dataset = getVisualizationDataset(languageProfile, "language_share");
    expect(dataset.sourceLabel).toBe("Self-reported profile data");
    expect(dataset.note).toContain("Percentages entered by the profile owner");
    expect(dataset.rows[0]).toEqual({ id: "language-0", label: "React (JavaScript)", value: 55.16842947293574 });
    expect(dataset.rows[1].label).toBe("React (TypeScript)");
    expect(languageProfile).toEqual(before);
  });

  it("takes published sync totals rather than adding saved manual values", () => {
    const profile = withSyncedProfile(languageProfile, published);
    const changes = getVisualizationDataset(profile, "line_changes");
    expect(changes.rows.map((row) => row.value)).toEqual([200, -30]);
    expect(changes.sourceLabel).toBe("Automatically tracked by Stack Stats");
    expect(changes.note).toContain("not repository size");
    expect(getVisualizationDataset(profile, "language_share").note).toContain("tracked time, or edit count");
    expect(profile.languages[0].name).toBe("javascriptreact");
  });

  it.each([null, { ...published, recordCount: 0 }])("preserves the existing manual fallback when no sync is published", (sync) => {
    const profile = withSyncedProfile(languageProfile, sync);
    expect(getVisualizationDataset(profile, "line_changes").rows.map((row) => row.value)).toEqual([100, -20]);
    expect(getVisualizationDataset(profile, "language_share").sourceLabel).toBe("Self-reported profile data");
  });

  it("does not restore manual languages when synced language publication is disabled", () => {
    const profile = withSyncedProfile(languageProfile, { ...published, languages: [] });
    const dataset = getVisualizationDataset(profile, "language_share");
    expect(dataset.rows).toEqual([]);
    expect(dataset.emptyMessage).toBe("No language activity is published.");
    expect(dataset.sourceLabel).toBe("Automatically tracked by Stack Stats");
    expect(chartHtml("polar_area", profile)).not.toContain("React");
  });

  it("uses the already-public projection without fetching or reading attached private information", () => {
    const fetch = vi.fn(() => { throw new Error("A profile visualization must not fetch private data"); });
    vi.stubGlobal("fetch", fetch);
    const profile = { ...languageProfile };
    Object.defineProperty(profile, "privateSummary", { get() { throw new Error("Private summary read"); } });
    for (const id of datasetIds) {
      expect(getVisualizationDataset(profile, id).rows.length).toBeGreaterThan(0);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("represents missing manual percentage as Unspecified instead of renormalizing known shares", () => {
    const dataset = getVisualizationDataset(withLanguages([["TypeScript", 40], ["Python", 20]]), "language_share");
    expect(dataset.rows).toEqual([
      { id: "language-0", label: "TypeScript", value: 40 },
      { id: "language-1", label: "Python", value: 20 },
      { id: "unassigned-share", label: "Unspecified", value: 40 },
    ]);
    expect(dataset.note).toContain("does not represent additional tracked activity");
    expect(dataset.rows.reduce((sum, row) => sum + row.value, 0)).toBe(100);
  });

  it("groups more than eight categories without dropping their measured share", () => {
    const profile = withLanguages(Array.from({ length: 10 }, (_, index) => [`Language ${index}`, index + 1]));
    const dataset = getVisualizationDataset(profile, "language_share");
    expect(dataset.rows).toHaveLength(8);
    expect(dataset.rows.slice(0, 7).map((row) => row.value)).toEqual([10, 9, 8, 7, 6, 5, 4]);
    expect(dataset.rows[7]).toEqual({ id: "remaining-share", label: "Other shares", value: 51 });
    expect(dataset.note).toContain("Unspecified is the remainder of 100%");
    expect(dataset.note).toContain("combines 4 remaining entries");
    expect(dataset.rows.reduce((sum, row) => sum + row.value, 0)).toBe(100);
    expect(profile.languages).toHaveLength(10);
  });

  it("keeps all eight categories when no grouping is necessary", () => {
    const dataset = getVisualizationDataset(withLanguages(Array.from({ length: 8 }, (_, index) => [`Language ${index}`, 12.5])), "language_share");
    expect(dataset.rows).toHaveLength(8);
    expect(dataset.rows.some((row) => row.id === "remaining-share")).toBe(false);
  });

  it.each([-1, 101, Number.NaN, Number.POSITIVE_INFINITY])("declines a language chart with an invalid share %s", (percentage) => {
    const dataset = getVisualizationDataset(withLanguages([["Python", 50], ["Rust", percentage]]), "language_share");
    expect(dataset.rows).toEqual([]);
    expect(dataset.emptyMessage).toContain("cannot be displayed reliably");
  });

  it("declines an overfull language total rather than scaling it down to 100%", () => {
    const dataset = getVisualizationDataset(withLanguages([["Python", 70], ["Rust", 40]]), "language_share");
    expect(dataset.rows).toEqual([]);
    expect(dataset.emptyMessage).toContain("exceed 100%");
  });

  it("accepts the existing manual rounding tolerance with an explicit adjustment note", () => {
    const profile = withLanguages([["TypeScript", 50.005], ["Python", 50]]);
    const dataset = getVisualizationDataset(profile, "language_share");
    expect(dataset.rows).toHaveLength(2);
    expect(dataset.rows.reduce((sum, row) => sum + row.value, 0)).toBeCloseTo(100, 10);
    expect(dataset.note).toMatch(/round|adjust|normaliz/i);
    expect(profile.languages.map((language) => language.percentage)).toEqual([50.005, 50]);
    expect(chartHtml("donut", profile)).toContain("<svg");
  });

  it("rejects totals beyond the manual rounding tolerance", () => {
    expect(getVisualizationDataset(withLanguages([["TypeScript", 50.011], ["Python", 50]]), "language_share").rows).toEqual([]);
  });

  it("declines a positive language share with no usable label", () => {
    expect(getVisualizationDataset(withLanguages([[" ", 100]]), "language_share").rows).toEqual([]);
  });

  it.each([{ entries: [] }, { entries: [["Python", 0]] }] as { entries: [string, number][] }[])("keeps empty and zero-only language activity empty", ({ entries }) => {
    const dataset = getVisualizationDataset(withLanguages(entries), "language_share");
    expect(dataset.rows).toEqual([]);
    expect(dataset.emptyMessage).toBe("No language activity has been added yet.");
    expect(dataset.rows.some((row) => row.label === "Unspecified")).toBe(false);
  });

  it("omits legitimate zero shares without changing other language measurements", () => {
    const dataset = getVisualizationDataset(withLanguages([["Python", 100], ["Rust", 0]]), "language_share");
    expect(dataset.rows).toEqual([{ id: "language-0", label: "Python", value: 100 }]);
  });

  it.each([
    { lines_added: 0, lines_removed: 0 },
    { lines_added: -1, lines_removed: 10 },
    { lines_added: 10, lines_removed: -1 },
    { lines_added: Number.NaN, lines_removed: 10 },
    { lines_added: 10, lines_removed: Number.POSITIVE_INFINITY },
  ])("does not fabricate line-change geometry for invalid or empty totals %j", (totals) => {
    const dataset = getVisualizationDataset({ ...manual, ...totals }, "line_changes");
    expect(dataset.rows).toEqual([]);
    expect(dataset.emptyMessage).toContain("No added or removed lines");
  });
});

describe("visualization geometry and server rendering", () => {
  it("serializes identical SVG paths despite sub-pixel trigonometric differences across JS engines", () => {
    const expected = annularSector(26, polarRadius(14.1, 44.6), 0.7, 1.8);
    const sin = Math.sin;
    const cos = Math.cos;
    vi.spyOn(Math, "sin").mockImplementation((angle) => sin(angle) + 1e-15);
    vi.spyOn(Math, "cos").mockImplementation((angle) => cos(angle) - 1e-15);
    expect(annularSector(26, polarRadius(14.1, 44.6), 0.7, 1.8)).toBe(expected);
  });

  it("makes colored polar sector area proportional to value despite the central hole", () => {
    const innerSquared = polarRadius(0, 100) ** 2;
    const maxAreaFactor = polarRadius(100, 100) ** 2 - innerSquared;
    expect(polarRadius(0, 100)).toBe(26);
    expect(polarRadius(100, 100)).toBe(126);
    for (const value of [0.01, 1, 10, 25, 50, 75]) {
      expect((polarRadius(value, 100) ** 2 - innerSquared) / maxAreaFactor).toBeCloseTo(value / 100, 10);
    }
  });

  it("preserves polar relative area when the largest category is below 100%", () => {
    const area = (value: number) => polarRadius(value, 60) ** 2 - 26 ** 2;
    expect(area(15) / area(30)).toBeCloseTo(0.5, 10);
    expect(area(30) / area(60)).toBeCloseTo(0.5, 10);
  });

  it("uses nondegenerate arcs for a one-language full circle", () => {
    const path = annularSector(79, 128, -Math.PI / 2, Math.PI * 1.5);
    expect(path.match(/ A /g)).toHaveLength(4);
    expect(path).not.toMatch(/NaN|Infinity|undefined/);
    const half = annularSector(79, 128, -Math.PI / 2, Math.PI / 2);
    expect(half).not.toBe(path);
  });

  it.each(rendererIds)("server-renders %s with a title, chart label, and finite geometry", (renderer) => {
    const html = chartHtml(renderer);
    const expectedTitle = renderer === "waterfall" ? "Code changes" : "Language activity";
    expect(html).toContain('role="img"');
    expect(html).toContain('viewBox="0 0 440 300"');
    expect(html).toContain(`: ${expectedTitle}.`);
    expect(html).toContain(`<title>${expectedTitle}</title>`);
    expect(html).toContain("<figcaption");
    expect(html).not.toMatch(/NaN|Infinity|undefined/);
    expect(html).not.toContain("<canvas");
    if (renderer !== "waterfall") {
      expect(html).toContain("React (JavaScript): 55.2%");
      expect(html).toContain("React (TypeScript): 44.8%");
      expect(html).not.toContain("55.16842947293574%");
    }
  });

  it.each(["polar_area", "donut"] as const)("renders a single complete language in %s", (renderer) => {
    const html = chartHtml(renderer, withLanguages([["Rust", 100]]));
    expect(html).toContain("Rust: 100.0%");
    expect(html).toContain("<path");
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it("keeps unknown-language text escaped in accessible labels", () => {
    const html = chartHtml("bars", withLanguages([["<script>alert(1)</script>", 100]]));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("describes radial angle encoding without presenting ring size as data", () => {
    expect(chartHtml("radial_bars")).toContain("ring radius is decorative, not a second measure");
  });

  it.each([
    { added: 100, removed: 150, net: "-50" },
    { added: 0, removed: 75, net: "-75" },
    { added: 75, removed: 0, net: "75" },
    { added: 75, removed: 75, net: "0" },
  ])("keeps waterfall signed and finite with $added additions / $removed removals", ({ added, removed, net }) => {
    const html = chartHtml("waterfall", { ...manual, lines_added: added, lines_removed: removed });
    expect(html).toContain(`<title>Edit balance: ${net} lines</title>`);
    expect(html).toContain("not repository growth");
    expect(html).not.toMatch(/NaN|Infinity/);
    expect(html).not.toContain(">-0<");
    const heights = [...html.matchAll(/<rect[^>]*height="([^"]+)"/g)].map((match) => Number(match[1]));
    expect(heights).toHaveLength(3);
    expect(heights.every((height) => Number.isFinite(height) && height >= 0 && height <= 180)).toBe(true);
  });

  it("uses supplied signed appearance colors in the waterfall", () => {
    const config: VisualizationConfig = { ...configFor("waterfall"), appearance: { palette: "custom", positive: "#FFFFFF", negative: "#FFDDAA" } };
    const html = renderToStaticMarkup(createElement(VisualizationChart, { config, dataset: getVisualizationDataset(manual, "line_changes") }));
    expect(html).toContain('fill="#FFFFFF"');
    expect(html).toContain('fill="#FFDDAA"');
  });

  it("renders an empty state instead of an invented chart", () => {
    const html = chartHtml("donut", manual);
    expect(html).toContain("No language activity has been added yet.");
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("Unspecified");
  });

  it("retains the accessible image label and title in chart-choice thumbnails", () => {
    const html = chartHtml("polar_area", languageProfile, true);
    expect(html).toContain('role="img"');
    expect(html).toContain("<title>Language activity</title>");
    expect(html).not.toContain("<figcaption");
  });
});
