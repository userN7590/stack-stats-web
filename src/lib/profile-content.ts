import { z } from "zod";
import { datasetRegistry, metricRegistry, publicMetricIds, type PublicMetricId, type Unit } from "@/lib/metric-registry";
import { appearanceSchema, type ChartAppearance } from "@/lib/visualization";
import { activityShares, type ActivityCategory, type HourlyActivity } from "@/lib/sync-datasets";
import { getLanguageDisplayName } from "@/lib/language-display";
import type { PublicProfile } from "@/lib/types";

export const contentSizes = ["full", "two_thirds", "half", "third"] as const;
export const scalarMetricIds = publicMetricIds.filter(id => metricRegistry[id].shape === "scalar");
const scalarMetric = z.enum(publicMetricIds).refine(id => metricRegistry[id].shape === "scalar");
export const measures = ["activeMs", "editCount", "linesAdded", "linesRemoved"] as const;
export const measureLabels = { activeMs: "Coding time", editCount: "Content changes", linesAdded: "Lines added", linesRemoved: "Lines removed" };
export type Measure = typeof measures[number];
export type DataShape = "shares" | "daily-series" | "duration-buckets" | "utc-hours" | "utc-day-hours";

// The dataset identity survives new presentations. Shape describes the approved
// projection, not everything available through the owner's private dataset API.
export const profileDatasets = {
  "languages.activity": { dataset: datasetRegistry.languagesByDay.id, shape: "shares", renderers: ["list", "bars", "dots", "donut", "radial_bars", "polar_area"] },
  "schedule.daily": { dataset: datasetRegistry.daily.id, shape: "daily-series", renderers: ["line", "bars"] },
  "sessions.histogram": { dataset: datasetRegistry.sessionStartCohorts.id, shape: "duration-buckets", renderers: ["histogram"] },
  "schedule.hourly_utc": { dataset: datasetRegistry.hourlyUtc.id, shape: "utc-hours", renderers: ["heatmap"] },
} as const;
export type DatasetMetric = keyof typeof profileDatasets;
export const datasetMetricIds = publicMetricIds.filter((id): id is DatasetMetric => Object.hasOwn(profileDatasets, id));
export const contentRenderers = {
  list: { label: "Quantitative list", shape: "shares", presentation: "list" },
  bars: { label: "Bars", shape: ["shares", "daily-series"], presentation: "bars" },
  dots: { label: "Dots", shape: "shares", presentation: "dots" },
  donut: { label: "Donut", shape: "shares", presentation: "donut" },
  radial_bars: { label: "Orbital rings", shape: "shares", presentation: "radial-bars" },
  polar_area: { label: "Language bloom", shape: "shares", presentation: "polar-area" },
  line: { label: "Line", shape: "daily-series", presentation: "line" },
  histogram: { label: "Histogram", shape: "duration-buckets", presentation: "histogram" },
  heatmap: { label: "UTC hour heatmap", shape: "utc-hours", presentation: "heatmap" },
} as const;
export type ContentRenderer = keyof typeof contentRenderers;
export function compatibleContentRenderers(metric: DatasetMetric): ContentRenderer[] {
  const source = profileDatasets[metric];
  return source.renderers.filter(renderer => {
    const entry = contentRenderers[renderer];
    const shapes: readonly string[] = typeof entry.shape === "string" ? [entry.shape] : entry.shape;
    return shapes.includes(source.shape) && metricRegistry[metric].compatiblePresentations.includes(entry.presentation);
  });
}
const datasetConfig = z.strictObject({
  dataset: z.enum(["daily", "languagesByDay", "sessionStartCohorts", "hourlyUtc"]),
  metric: z.enum(["languages.activity", "schedule.daily", "sessions.histogram", "schedule.hourly_utc"]),
  renderer: z.enum(["list", "bars", "dots", "donut", "radial_bars", "polar_area", "line", "histogram", "heatmap"]),
  measure: z.enum(measures),
  appearance: appearanceSchema,
}).refine(config => profileDatasets[config.metric].dataset === config.dataset &&
  compatibleContentRenderers(config.metric).includes(config.renderer) &&
  (config.metric !== "sessions.histogram" || config.measure === "activeMs"), "Choose a presentation supported by this data.");
export type DatasetConfig = z.infer<typeof datasetConfig>;
export function defaultDatasetConfig(metric: DatasetMetric, appearance: ChartAppearance = { palette: "stack" }): DatasetConfig {
  return { dataset: profileDatasets[metric].dataset, metric, renderer: compatibleContentRenderers(metric)[0], measure: "activeMs", appearance };
}

// Links are never fetched or embedded by the server. This bounded HTTPS grammar
// is also enforced by SQL; it excludes credentials, IP literals, HTML and scripts.
export const externalUrlPattern = /^https:\/\/(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}(?::443)?(?:[/?#][^\s\\<>"\u0000-\u001f\u007f]*)?$/;
export const externalUrlSchema = z.string().max(2048).regex(externalUrlPattern);
const base = { id: z.string().regex(/^sec_[a-z0-9-]{1,64}$/), visible: z.boolean(), size: z.enum(contentSizes) };
export const contentModuleSchema = z.discriminatedUnion("type", [
  z.strictObject({ ...base, type: z.literal("single_stat"), metric: scalarMetric.nullable(), style: z.enum(["number", "label", "context"]) }),
  z.strictObject({ ...base, type: z.literal("stat_grid"), columns: z.union([z.literal(2), z.literal(3)]), rows: z.union([z.literal(2), z.literal(3)]), cells: z.array(scalarMetric.nullable()).min(4).max(9) })
    .refine(value => value.cells.length === value.columns * value.rows, "Choose one metric or empty space for each grid cell."),
  z.strictObject({ ...base, type: z.literal("dataset"), config: datasetConfig.nullable() }),
  z.strictObject({ ...base, type: z.literal("link_collection"), links: z.array(z.strictObject({ label: z.string().trim().min(1).max(80), url: externalUrlSchema })).max(8) }),
  z.strictObject({ ...base, type: z.literal("document"), title: z.string().trim().min(1).max(100), url: z.union([z.literal(""), externalUrlSchema]) }),
]);
export type ContentModule = z.infer<typeof contentModuleSchema>;
export type ContentType = ContentModule["type"];
export function newContentModule(type: ContentType, id: string): ContentModule {
  const common = { id, visible: true, size: "full" as const };
  switch (type) {
    case "single_stat": return { ...common, type, metric: null, style: "label" };
    case "stat_grid": return { ...common, type, columns: 2, rows: 2, cells: [null, null, null, null] };
    case "dataset": return { ...common, type, config: null };
    case "document": return { ...common, type, title: "Document", url: "" };
    case "link_collection": return { ...common, type, links: [] };
  }
}

export function publicMetricState(profile: PublicProfile, id: PublicMetricId) {
  const metric = profile.published_metrics?.metrics.find(value => value.id === id);
  if (!metric) return { status: "not-published" as const, message: "Not published", metric: undefined };
  if (metric.quality === "unavailable" || (metricRegistry[id].shape === "scalar" ? metric.value == null : metric.dataset == null)) {
    return { status: "unavailable" as const, message: "Unavailable", metric };
  }
  return { status: "ready" as const, message: metric.quality === "partial" ? "Partial observations" : "Uploaded observations", metric };
}
export function formatMetricValue(value: number, unit: Unit): string {
  if (unit !== "milliseconds") return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
  if (value === 0) return "0s";
  if (value < 1000) return "<1s";
  if (value < 60_000) return `${Math.floor(value / 1000)}s`;
  const minutes = Math.floor(value / 60_000);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60).toLocaleString("en-US")}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
}
export type DataPoint = { id: string; label: string; value: number };
export function datasetPoints(profile: PublicProfile, config: DatasetConfig): DataPoint[] {
  const state = publicMetricState(profile, config.metric);
  if (state.status !== "ready") return [];
  const data = state.metric!.dataset;
  switch (config.metric) {
    case "languages.activity": return activityShares(data as ActivityCategory[], config.measure).filter(row => row[config.measure] > 0)
      .map(row => ({ id: row.id, label: getLanguageDisplayName(row.id), value: row.percentage }));
    case "sessions.histogram": return (data as number[]).map((value, index) => ({ id: String(index), label: ["0ms", ">0–<1m", "1–<5m", "5–<15m", "15–<30m", "30–<60m", "1–<2h", "2–<4h", "4h+"][index], value }));
    case "schedule.daily": return (data as ({ date: string } & Record<Measure, number>)[]).map(row => ({ id: row.date, label: row.date, value: row[config.measure] })).sort((a, b) => a.id.localeCompare(b.id));
    case "schedule.hourly_utc": {
      const field = { activeMs: "activeMsByHour", editCount: "editCountByHour", linesAdded: "linesAddedByHour", linesRemoved: "linesRemovedByHour" } as const;
      return (data as HourlyActivity)[field[config.measure]].map((value, index) => ({ id: String(index), label: `${String(index).padStart(2, "0")}:00 UTC`, value }));
    }
  }
}
