import { z } from "zod";
import { datasetRegistry, metricRegistry, publicMetricIds, type MetricId, type PublicMetricId, type Quality } from "@/lib/metric-registry";
import { validSyncDate, SYNC_LANGUAGES } from "@/lib/sync-contract";

const number = z.number().finite().min(0).max(Number.MAX_SAFE_INTEGER);
const count = number.int();
const date = z.string().refine(validSyncDate);
const counters = { activeMs: count, editCount: count, linesAdded: count, linesRemoved: count };
const category = z.object({ id: z.string(), ...counters }).strict();
const language = category.extend({ id: z.string().refine(id => SYNC_LANGUAGES.includes(id)) });
const hours = z.object({ source: z.literal("telemetry-v2"), dateBasis: z.literal("UTC"), activeMsByHour: z.array(count).length(24), editCountByHour: z.array(count).length(24), linesAddedByHour: z.array(count).length(24), linesRemovedByHour: z.array(count).length(24) }).strict();
const cohort = z.object({ count, ...counters, minActiveMs: count.nullable(), maxActiveMs: count.nullable(), averageActiveMs: number.nullable(), histogram: z.array(count).length(9) }).strict();
const coverageSchema = z.object({ source: z.literal("sessions-v1"), dateBasis: z.literal("collector-local"), historyCompleteness: z.literal("unknown"), partial: z.literal(true),
  recordCount: count, v1Records: count, v2Records: count, firstUploadedDate: date.nullable(), lastUploadedDate: date.nullable(), uploadedDates: count,
  firstObservedDate: date.nullable(), lastObservedDate: date.nullable(), earliestUploadFromDate: date.nullable(), latestUploadFromDate: date.nullable(),
  hourlyRecords: count, hourlyDates: count, frozenHourlyRecords: count, lateInputIgnoredRecords: count }).strict();
export type Coverage = z.infer<typeof coverageSchema>;
export type ActivityCategory = z.infer<typeof language>;
export type HourlyActivity = z.infer<typeof hours>;
const project = category.extend({ id: z.string().regex(/^[a-f0-9]{64}$/), installationId: z.uuid() });
const projectOverflow = z.object({ projectDays: count, ...counters }).strict();
const remainder = z.object({ knownIdentities: count, ...counters }).strict();
const summarySchema = z.object({ schemaVersion: z.literal("2"), from: date, to: date, ...counters,
  fileDays: count, sessionDays: count, sessionStarts: count.nullable(), incompleteSessionStarts: count.nullable(), activeDays: count, languageCount: count,
  projectKnownCount: count, projectIdentityComplete: z.boolean(), projectOverflow, projectSelectionRemainder: remainder,
  sessionDurations: cohort.nullable(), languages: z.array(language).max(128), projects: z.array(project).max(128), hourlyUtc: hours.nullable(), coverage: coverageSchema }).strict();
export type PrivateSummaryV2 = z.infer<typeof summarySchema>;
export type MetricData = ActivityCategory[] | HourlyActivity | number[] | { date: string; activeMs: number; editCount: number; linesAdded: number; linesRemoved: number }[]
  | { projects: z.infer<typeof project>[]; identityComplete: boolean; overflow: z.infer<typeof projectOverflow>; selectionRemainder: z.infer<typeof remainder> };
export interface MetricResult {
  id: MetricId; definitionVersion: 1; unit: "milliseconds" | "count" | "lines" | "percent";
  quality: Quality; dateBasis: "collector-local" | "UTC";
  value?: number | null; dataset?: MetricData | null;
}
export function privateMetrics(input: unknown): { metrics: MetricResult[]; coverage: Coverage; period: { from: string; to: string } } {
  const s = summarySchema.parse(input);
  if (!Number.isSafeInteger(s.linesAdded + s.linesRemoved)) throw new Error("Aggregate exceeds exact numeric range");
  const scalar: Partial<Record<MetricId, number | null>> = {
    "activity.active_ms": s.activeMs, "activity.edits": s.editCount, "activity.lines_added": s.linesAdded, "activity.lines_removed": s.linesRemoved,
    "activity.net_lines": s.linesAdded - s.linesRemoved, "activity.churn": s.linesAdded + s.linesRemoved,
    "activity.file_days": s.fileDays, "activity.active_days": s.activeDays, "sessions.days": s.sessionDays,
    "sessions.starts": s.sessionStarts, "sessions.incomplete_starts": s.incompleteSessionStarts,
    "sessions.completed": s.sessionDurations?.count ?? null, "sessions.active_ms": s.sessionDurations?.activeMs ?? null,
    "sessions.average_ms": s.sessionDurations?.averageActiveMs ?? null, "sessions.longest_ms": s.sessionDurations?.maxActiveMs ?? null,
    "sessions.shortest_ms": s.sessionDurations?.minActiveMs ?? null, "languages.count": s.languageCount, "projects.known_count": s.projectKnownCount,
  };
  const datasets: Partial<Record<MetricId, MetricData | null>> = {
    "languages.activity": s.languages, "sessions.histogram": s.sessionDurations?.histogram ?? null, "schedule.hourly_utc": s.hourlyUtc,
    "projects.activity": { projects: s.projects, identityComplete: s.projectIdentityComplete, overflow: s.projectOverflow, selectionRemainder: s.projectSelectionRemainder },
  };
  const metrics = (Object.keys(metricRegistry) as MetricId[]).filter(id => id !== "schedule.daily").map(id => {
    const definition = metricRegistry[id];
    const value = scalar[id], dataset = datasets[id];
    const missing = s.coverage.recordCount === 0 || (definition.requiresWireVersion === "2" && s.coverage.v2Records === 0)
      || (definition.shape === "scalar" ? value == null : dataset == null);
    return { id, definitionVersion: 1 as const, unit: definition.unit, dateBasis: definition.dateBasis, quality: missing ? "unavailable" as const : "partial" as const,
      ...(definition.shape === "scalar" ? { value: missing ? null : value } : { dataset: missing ? null : dataset }) };
  });
  return { metrics, coverage: s.coverage, period: { from: s.from, to: s.to } };
}
const daily = z.object({ date, ...counters, sessionDays: count, fileDays: count, coverage: coverageSchema }).strict();
const dailyLanguage = language.extend({ date });
const dailyProject = z.object({ date, id: z.string().regex(/^[a-f0-9]{64}$/).nullable(), installationId: z.uuid(), ...counters, overflow: z.boolean(), overflowProjectDays: count }).strict();
const dailyCohort = z.object({ date, sessionStarts: count.nullable(), incompleteSessionStarts: count.nullable(), sessionDurations: cohort.nullable(), coverage: coverageSchema }).strict();
const dailyHours = z.object({ date, hourlyUtc: hours.nullable(), coverage: coverageSchema }).strict();
const envelope = { schemaVersion: z.literal("2"), from: date, to: date, coverage: coverageSchema };
const datasetSchema = z.discriminatedUnion("dataset", [
  z.object({ ...envelope, dataset: z.literal("daily"), dateBasis: z.literal("collector-local"), rows: z.array(daily).max(90) }).strict(),
  z.object({ ...envelope, dataset: z.literal("languagesByDay"), dateBasis: z.literal("collector-local"), rows: z.array(dailyLanguage).max(10000) }).strict(),
  z.object({ ...envelope, dataset: z.literal("projectsByDay"), dateBasis: z.literal("collector-local"), rows: z.array(dailyProject).max(10000) }).strict(),
  z.object({ ...envelope, dataset: z.literal("sessionStartCohorts"), dateBasis: z.literal("collector-local"), rows: z.array(dailyCohort).max(90) }).strict(),
  z.object({ ...envelope, dataset: z.literal("hourlyUtc"), dateBasis: z.literal("UTC"), rows: z.array(dailyHours).max(90) }).strict(),
]);
/** A row with hourlyUtc:null is unavailable; absent dates are never filled in. */
export function privateDataset(input: unknown) {
  const dataset = datasetSchema.parse(input);
  const observed = dataset.dataset === "hourlyUtc" ? dataset.coverage.hourlyRecords : dataset.dataset === "sessionStartCohorts" ? dataset.coverage.v2Records : dataset.coverage.recordCount;
  return { ...dataset, definition: datasetRegistry[dataset.dataset], quality: observed ? "partial" as const : "unavailable" as const };
}
const publicBase = z.object({ id: z.enum(publicMetricIds), definitionVersion: z.literal(1), unit: z.enum(["milliseconds", "count", "lines", "percent"]),
  quality: z.enum(["available", "partial", "unavailable"]), dateBasis: z.enum(["collector-local", "UTC"]), value: z.number().finite().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER).nullable().optional(), dataset: z.unknown().optional() }).strict();
export type PublishedMetrics = { schemaVersion: "2"; metrics: MetricResult[] };
/** Validate only an explicit publication result, never a private summary. */
export function publishedMetrics(input: unknown): PublishedMetrics | null {
  if (input == null) return null;
  const data = z.object({ schemaVersion: z.literal("2"), metrics: z.array(publicBase).max(publicMetricIds.length) }).strict().parse(input);
  if (new Set(data.metrics.map(m => m.id)).size !== data.metrics.length) throw new Error("Duplicate published metric");
  return { schemaVersion: "2", metrics: data.metrics.map(m => {
    const definition = metricRegistry[m.id];
    if (m.unit !== definition.unit || m.dateBasis !== definition.dateBasis) throw new Error("Published metric definition mismatch");
    if (definition.shape === "scalar") {
      if (m.value === undefined || m.dataset !== undefined) throw new Error("Invalid published scalar");
      return { ...m, dataset: undefined };
    }
    if (m.value !== undefined || m.dataset === undefined) throw new Error("Invalid published dataset");
    const schemas = { "languages.activity": z.array(language).max(128), "sessions.histogram": z.array(count).length(9),
      "schedule.hourly_utc": hours, "schedule.daily": z.array(z.object({ date, ...counters }).strict()).max(90) };
    const schema = schemas[m.id as keyof typeof schemas];
    return { ...m, dataset: schema.nullable().parse(m.dataset) };
  }) };
}
export function selectedMetric(publication: PublishedMetrics, id: PublicMetricId) {
  return publication.metrics.find(metric => metric.id === id);
}

/** Choose the measure explicitly; recompute shares after grouping counters. */
export function activityShares(rows: ActivityCategory[], measure: keyof Pick<ActivityCategory, "activeMs" | "editCount" | "linesAdded" | "linesRemoved">) {
  const total = rows.reduce((sum, row) => sum + row[measure], 0);
  if (!Number.isSafeInteger(total) || total < 0) throw new Error("Activity measure exceeds exact numeric range");
  return rows.map(row => ({ ...row, percentage: total ? row[measure] / total * 100 : 0 }))
    .sort((a, b) => b[measure] - a[measure] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
