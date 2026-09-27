import type { PublicProfile } from "@/lib/types";
import { publishedMetrics, selectedMetric, type ActivityCategory, type PublishedMetrics } from "@/lib/sync-datasets";
import type { PublicMetricId } from "@/lib/metric-registry";
export interface PublishedSync {
  activeMs: number; editCount: number; linesAdded: number; linesRemoved: number;
  fileDays: number; projectCount: number | null; recordCount: number; updatedAt: string | null;
  languages: { id: string; activeMs: number; editCount: number }[];
}
/** Explicit publication replaces displayed totals, never adds to manual data. */
export function withSyncedProfile(profile: PublicProfile, synced: PublishedSync | null): PublicProfile {
  if (!synced || !synced.recordCount) return profile;
  const totalTime = synced.languages.reduce((sum, row) => sum + row.activeMs, 0);
  const totalEdits = synced.languages.reduce((sum, row) => sum + row.editCount, 0);
  return { ...profile, stats_source: "synced", lines_added: synced.linesAdded, lines_removed: synced.linesRemoved,
    files_changed: synced.fileDays, edit_events: synced.editCount, projects_count: synced.projectCount ?? 0, project_count_incomplete: synced.projectCount === null,
    coding_minutes: Math.floor(synced.activeMs / 60_000), updated_at: synced.updatedAt ?? profile.updated_at,
    languages: synced.languages.map(row => ({ id: row.id, user_id: profile.user_id, name: row.id,
      percentage: totalTime ? row.activeMs / totalTime * 100 : totalEdits ? row.editCount / totalEdits * 100 : 0, created_at: profile.created_at })) };
}

/** Limited publication never fills unselected telemetry slots from manual values. */
export function withPublishedMetrics(profile: PublicProfile, input: unknown): PublicProfile {
  let publication: PublishedMetrics;
  try { publication = publishedMetrics(input) ?? { schemaVersion: "2", metrics: [] }; }
  catch { publication = { schemaVersion: "2", metrics: [] }; }
  const value = (id: PublicMetricId) => selectedMetric(publication, id)?.value ?? 0;
  const languageMetric = selectedMetric(publication, "languages.activity");
  const languages = languageMetric?.quality !== "unavailable" && Array.isArray(languageMetric?.dataset) ? languageMetric.dataset as ActivityCategory[] : [];
  const totalTime = languages.reduce((sum, row) => sum + row.activeMs, 0), totalEdits = languages.reduce((sum, row) => sum + row.editCount, 0);
  return { ...profile, stats_source: "synced", published_metrics: publication,
    lines_added: value("activity.lines_added"), lines_removed: value("activity.lines_removed"),
    edit_events: value("activity.edits"), files_changed: value("activity.file_days"), coding_minutes: Math.floor(value("activity.active_ms") / 60_000), projects_count: 0,
    languages: languages.map(row => ({ id: row.id, user_id: profile.user_id, name: row.id, created_at: profile.created_at,
      percentage: totalTime ? row.activeMs / totalTime * 100 : totalEdits ? row.editCount / totalEdits * 100 : 0 })) };
}
export function publishedLinesAvailable(profile: PublicProfile): boolean {
  return !profile.published_metrics || ["activity.lines_added", "activity.lines_removed"].every(id => {
    const metric = selectedMetric(profile.published_metrics!, id as PublicMetricId);
    return metric?.quality !== "unavailable" && typeof metric?.value === "number";
  });
}
