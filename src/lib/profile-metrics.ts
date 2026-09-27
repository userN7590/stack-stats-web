import { formatCodingTime, formatNumber } from "@/lib/format";
import type { StatId } from "@/lib/profile-layout";
import type { PublicProfile } from "@/lib/types";
import { selectedMetric } from "@/lib/sync-datasets";
import type { PublicMetricId } from "@/lib/metric-registry";

export type ProfileMetric = { label: string; value: string };

/** Receives the already-public profile: presentation never queries private telemetry. */
export function getProfileMetrics(profile: PublicProfile): Record<StatId, ProfileMetric> {
  const synced = profile.stats_source === "synced";
  const metrics = {
    lines_added: { label: "Lines added", value: formatNumber(profile.lines_added) },
    lines_removed: { label: "Lines removed", value: formatNumber(profile.lines_removed) },
    files_changed: { label: synced ? "File-days" : "Files changed", value: formatNumber(profile.files_changed) },
    edit_events: { label: synced ? "Content changes" : "Edit events", value: formatNumber(profile.edit_events) },
    projects_count: { label: synced ? "Project identities" : "Projects", value: profile.project_count_incomplete ? "Unavailable" : formatNumber(profile.projects_count) },
    coding_minutes: { label: "Coding time", value: formatCodingTime(profile.coding_minutes) },
  };
  if (profile.published_metrics) {
    const mapping: Partial<Record<StatId, PublicMetricId>> = { lines_added: "activity.lines_added", lines_removed: "activity.lines_removed", files_changed: "activity.file_days", edit_events: "activity.edits", coding_minutes: "activity.active_ms" };
    for (const id of Object.keys(metrics) as StatId[]) {
      const metricId = mapping[id], metric = metricId ? selectedMetric(profile.published_metrics, metricId) : undefined;
      if (!metric) metrics[id].value = "Not published";
      else if (metric.quality === "unavailable" || metric.value == null) metrics[id].value = "Unavailable";
    }
  }
  return metrics;
}
