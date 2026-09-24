import { formatCodingTime, formatNumber } from "@/lib/format";
import type { StatId } from "@/lib/profile-layout";
import type { PublicProfile } from "@/lib/types";

export type ProfileMetric = { label: string; value: string };

/** Receives the already-public profile: presentation never queries private telemetry. */
export function getProfileMetrics(profile: PublicProfile): Record<StatId, ProfileMetric> {
  const synced = profile.stats_source === "synced";
  return {
    lines_added: { label: "Lines added", value: formatNumber(profile.lines_added) },
    lines_removed: { label: "Lines removed", value: formatNumber(profile.lines_removed) },
    files_changed: { label: synced ? "File-days" : "Files changed", value: formatNumber(profile.files_changed) },
    edit_events: { label: "Edit events", value: formatNumber(profile.edit_events) },
    projects_count: { label: synced ? "Project identities" : "Projects", value: formatNumber(profile.projects_count) },
    coding_minutes: { label: "Coding time", value: formatCodingTime(profile.coding_minutes) },
  };
}
