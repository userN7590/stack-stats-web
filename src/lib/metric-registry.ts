/** Meaning lives here; presentation/layout never grants access to a dataset. */
export const publicMetricIds = [
  "activity.active_ms", "activity.edits", "activity.lines_added", "activity.lines_removed", "activity.net_lines", "activity.churn", "activity.file_days", "activity.active_days",
  "sessions.days", "sessions.starts", "sessions.completed", "sessions.active_ms", "sessions.average_ms", "sessions.longest_ms", "sessions.histogram",
  "languages.activity", "languages.count", "schedule.daily", "schedule.hourly_utc",
] as const;
export type PublicMetricId = typeof publicMetricIds[number];
export type MetricId = PublicMetricId | "sessions.incomplete_starts" | "sessions.shortest_ms" | "projects.activity" | "projects.known_count";
export type Unit = "milliseconds" | "count" | "lines" | "percent";
export type DateBasis = "collector-local" | "UTC";
export type Quality = "available" | "partial" | "unavailable";
export interface MetricDefinition {
  id: MetricId; definitionVersion: 1; label: string; description: string; unit: Unit;
  shape: "scalar" | "series" | "distribution" | "categories";
  source: "daily" | "sessionStartCohort" | "hourlyUtc";
  requiresWireVersion: "1" | "2"; dateBasis: DateBasis;
  merge: "sum" | "max" | "min" | "dateUnion" | "identityUnion" | "derived";
  privacyCategory: "totals" | "sessions" | "languages" | "projects" | "schedule";
  publication: "selectable" | "schedule-consent" | "private";
  compatiblePresentations: readonly string[]; caveats: readonly string[];
  emptyState: string; supportedPeriods: readonly string[];
}
const overlap = "Independent installations may observe overlapping activity; totals do not deduplicate physical work.";
const partial = "Retained observations are partial; missing history is not measured zero.";
function definition(id: MetricId, label: string, description: string, unit: Unit, options: Partial<MetricDefinition> = {}): MetricDefinition {
  return { id, definitionVersion: 1, label, description, unit, shape: "scalar", source: "daily", requiresWireVersion: "1", dateBasis: "collector-local", merge: "sum", privacyCategory: "totals", publication: "selectable", compatiblePresentations: ["number", "stat-grid"], caveats: [partial, overlap], emptyState: "No uploaded observations for this metric in this period.", supportedPeriods: ["7", "30", "90", "lifetime"], ...options };
}
const cohort = { source: "sessionStartCohort", requiresWireVersion: "2", privacyCategory: "sessions" } as const;
const definitions: MetricDefinition[] = [
  definition("activity.active_ms", "Coding time", "Evidence-backed inter-edit active milliseconds, not total working time.", "milliseconds"),
  definition("activity.edits", "Content changes", "Nonempty editor content-change records, not callbacks, batches, or keystrokes.", "count"),
  definition("activity.lines_added", "Lines added", "Gross editor line boundaries added, including undo/redo.", "lines"),
  definition("activity.lines_removed", "Lines removed", "Gross editor line boundaries removed, including undo/redo.", "lines"),
  definition("activity.net_lines", "Net line changes", "Summed additions minus removals; not repository growth.", "lines", { merge: "derived" }),
  definition("activity.churn", "Line churn", "Summed additions plus removals.", "lines", { merge: "derived" }),
  definition("activity.file_days", "File-days", "Distinct composite file identities per installation/day, then summed.", "count", { caveats: [partial, "No unique lifetime or cross-device file identity is uploaded."] }),
  definition("activity.active_days", "Active dates", "Union of recorded-local dates with positive edits or active time.", "count", { merge: "dateUnion" }),
  definition("sessions.days", "Session-days", "Daily session participation; a session spanning midnight can contribute twice.", "count", { privacyCategory: "sessions" }),
  definition("sessions.starts", "Session starts", "Starts assigned once to each session's original recorded-local start date.", "count", cohort),
  definition("sessions.incomplete_starts", "Incomplete session starts", "Start-cohort snapshots without final end reasons; not live presence.", "count", { ...cohort, publication: "private" }),
  definition("sessions.completed", "Completed sessions", "Finalized start-cohort samples, not session-days.", "count", cohort),
  definition("sessions.active_ms", "Completed-session active time", "Whole-session active time for finalized start cohorts, not elapsed wall time.", "milliseconds", cohort),
  definition("sessions.average_ms", "Average completed-session duration", "Total completed active milliseconds divided by completed count; null for no completed samples.", "milliseconds", { ...cohort, merge: "derived" }),
  definition("sessions.longest_ms", "Longest completed session", "Maximum whole-session active duration among finalized start cohorts.", "milliseconds", { ...cohort, merge: "max" }),
  definition("sessions.shortest_ms", "Shortest completed session", "Minimum nonempty completed-cohort active duration; zero is a valid sample.", "milliseconds", { ...cohort, merge: "min", publication: "private" }),
  definition("sessions.histogram", "Session duration distribution", "Nine fixed active-duration buckets; zero milliseconds has its own bucket. No exact median is available.", "count", { ...cohort, shape: "distribution", compatiblePresentations: ["histogram", "bars"] }),
  definition("languages.activity", "Language activity", "Counters grouped by normalized language ID; shares derive from the selected summed measure, never averaged percentages.", "count", { shape: "categories", privacyCategory: "languages", compatiblePresentations: ["list", "bars", "donut", "radial-bars"], merge: "identityUnion" }),
  definition("languages.count", "Languages used", "Distinct uploaded normalized language IDs, including other.", "count", { privacyCategory: "languages", merge: "identityUnion" }),
  definition("projects.activity", "Private project activity", "Top 128 known installation-scoped aliases; source overflow and selection remainder retain counters separately.", "count", { shape: "categories", privacyCategory: "projects", publication: "private", merge: "identityUnion", compatiblePresentations: ["list", "bars"], caveats: [partial, "Aliases cannot be merged across installations. Overflow can change the true ranking."] }),
  definition("projects.known_count", "Known project identities", "Union of installation plus alias. A lower bound when source overflow exists; not globally unique repositories.", "count", { privacyCategory: "projects", publication: "private", merge: "identityUnion" }),
  definition("schedule.daily", "Daily activity", "Activity grouped by recorded-local date; cannot rebin to a viewer-selected timezone.", "milliseconds", { shape: "series", privacyCategory: "schedule", publication: "schedule-consent", compatiblePresentations: ["sparkline", "bars", "calendar"], supportedPeriods: ["7", "30", "90"] }),
  definition("schedule.hourly_utc", "UTC hour-of-day activity", "Twenty-four UTC hour bins. Separate telemetry projection: never add to daily totals or fabricate missing bins.", "count", { shape: "distribution", source: "hourlyUtc", requiresWireVersion: "2", dateBasis: "UTC", privacyCategory: "schedule", publication: "schedule-consent", compatiblePresentations: ["heatmap", "radial-histogram"], caveats: [partial, overlap, "Optional, default-off uploads. Batch timestamps determine edit/line bins; frozen days reject late input."] }),
];
export const metricRegistry = Object.fromEntries(definitions.map(value => [value.id, value])) as Record<MetricId, MetricDefinition>;
export const datasetRegistry = {
  daily: { id: "daily", label: "Daily activity", dateBasis: "collector-local", metrics: ["activity.active_ms", "activity.edits", "activity.lines_added", "activity.lines_removed", "sessions.days", "activity.file_days"], presentations: ["sparkline", "calendar", "bars"] },
  languagesByDay: { id: "languagesByDay", label: "Daily language activity", dateBasis: "collector-local", metrics: ["languages.activity"], presentations: ["list", "stacked-bars"] },
  projectsByDay: { id: "projectsByDay", label: "Private daily project activity", dateBasis: "collector-local", metrics: ["projects.activity"], presentations: ["list", "bars"] },
  sessionStartCohorts: { id: "sessionStartCohorts", label: "Session start cohorts", dateBasis: "collector-local", metrics: ["sessions.starts", "sessions.completed", "sessions.histogram"], presentations: ["number", "histogram"] },
  hourlyUtc: { id: "hourlyUtc", label: "UTC day × hour activity", dateBasis: "UTC", metrics: ["schedule.hourly_utc"], presentations: ["heatmap", "waterfall", "ridgeline"] },
} as const;
