import type { PublicProfile } from "@/lib/types";
export interface PublishedSync {
  activeMs: number; editCount: number; linesAdded: number; linesRemoved: number;
  fileDays: number; projectCount: number; recordCount: number; updatedAt: string | null;
  languages: { id: string; activeMs: number; editCount: number }[];
}
/** Explicit publication replaces displayed totals, never adds to manual data. */
export function withSyncedProfile(profile: PublicProfile, synced: PublishedSync | null): PublicProfile {
  if (!synced || !synced.recordCount) return profile;
  const totalTime = synced.languages.reduce((sum, row) => sum + row.activeMs, 0);
  const totalEdits = synced.languages.reduce((sum, row) => sum + row.editCount, 0);
  return { ...profile, stats_source: "synced", lines_added: synced.linesAdded, lines_removed: synced.linesRemoved,
    files_changed: synced.fileDays, edit_events: synced.editCount, projects_count: synced.projectCount,
    coding_minutes: Math.floor(synced.activeMs / 60_000), updated_at: synced.updatedAt ?? profile.updated_at,
    languages: synced.languages.map(row => ({ id: row.id, user_id: profile.user_id, name: row.id,
      percentage: totalTime ? row.activeMs / totalTime * 100 : totalEdits ? row.editCount / totalEdits * 100 : 0, created_at: profile.created_at })) };
}
