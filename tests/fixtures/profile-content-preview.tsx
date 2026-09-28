"use client";
// Synthetic browser-test content only. The test runner creates and removes its
// temporary local route; this fixture is never imported by a product route.
import { useState } from "react";
import { ProfileView } from "@/components/profile/profile-view";
import { SyncPrivacyForm } from "@/components/dashboard/sync-privacy";
import { defaultDatasetConfig } from "@/lib/profile-content";
import { metricRegistry, publicMetricIds } from "@/lib/metric-registry";
import { getDefaultProfileLayout, type ProfileLayout } from "@/lib/profile-layout";
import type { PublicProfile } from "@/lib/types";

const profile: PublicProfile = {
  user_id: "11111111-1111-4111-8111-111111111111", username: "phase9c", display_name: "Mira Chen", bio: "Building tools for people who build. Open-source software, developer experience, and the work behind the code.", avatar_url: null,
  github_url: "https://github.com/example", website_url: "https://example.com", lines_added: 4200, lines_removed: 321, files_changed: 40, edit_events: 1200, projects_count: 2, coding_minutes: 630,
  display_font: "editorial", background_style: "none", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-27T00:00:00Z", stats_source: "synced", languages: [],
  published_metrics: { schemaVersion: "2", metrics: publicMetricIds.map(id => {
    const definition = metricRegistry[id];
    const common = { id, definitionVersion: 1 as const, unit: definition.unit, dateBasis: definition.dateBasis, quality: "partial" as const };
    if (definition.shape === "scalar") return { ...common, value: definition.unit === "milliseconds" ? 151_200_000 : id === "activity.active_days" ? 18 : id === "sessions.completed" ? 27 : id === "activity.lines_removed" ? 321 : id === "activity.lines_added" ? 2402 : id === "activity.edits" ? 891 : 32 };
    if (id === "languages.activity") return { ...common, dataset: ["typescript", "javascriptreact", "python", "css", "rust"].map((language, index) => ({ id: language, activeMs: [300, 230, 120, 80, 40][index], editCount: index + 1, linesAdded: 4, linesRemoved: 1 })) };
    if (id === "sessions.histogram") return { ...common, dataset: [1, 2, 7, 12, 10, 6, 3, 2, 1] };
    if (id === "schedule.daily") return { ...common, dataset: [1, 2, 4, 5, 6, 7, 9].map((day, index) => ({ date: `2026-09-${String(day).padStart(2, "0")}`, activeMs: [320, 490, 210, 620, 540, 30, 290][index] * 60_000, editCount: 23, linesAdded: 10, linesRemoved: 2 })) };
    return { ...common, dataset: { source: "telemetry-v2" as const, dateBasis: "UTC" as const, activeMsByHour: Array.from({ length: 24 }, (_, hour) => hour > 8 && hour < 19 ? (19 - hour) * 80_000 : 0), editCountByHour: Array(24).fill(0), linesAddedByHour: Array(24).fill(0), linesRemovedByHour: Array(24).fill(0) } };
  }) },
};
const layout: ProfileLayout = { version: 3, modules: [
  { type: "single_stat", id: "sec_time", visible: true, size: "third", metric: "activity.active_ms", style: "label" },
  { type: "single_stat", id: "sec_days", visible: true, size: "third", metric: "activity.active_days", style: "label" },
  { type: "single_stat", id: "sec_sessions", visible: true, size: "third", metric: "sessions.completed", style: "label" },
  { type: "dataset", id: "sec_languages", visible: true, size: "two_thirds", config: { ...defaultDatasetConfig("languages.activity"), renderer: "polar_area" } },
  { type: "dataset", id: "sec_hours", visible: true, size: "third", config: defaultDatasetConfig("schedule.hourly_utc") },
  { type: "stat_grid", id: "sec_grid", visible: true, size: "full", columns: 3, rows: 2, cells: ["activity.lines_added", "activity.lines_removed", "activity.edits", "sessions.starts", "languages.count", "activity.file_days"] },
  { type: "dataset", id: "sec_daily", visible: true, size: "full", config: defaultDatasetConfig("schedule.daily") },
  { type: "dataset", id: "sec_histogram", visible: true, size: "half", config: defaultDatasetConfig("sessions.histogram") },
  { type: "link_collection", id: "sec_links", visible: true, size: "half", links: [{ label: "GitHub", url: "https://github.com/example" }, { label: "Research & projects", url: "https://example.com/research" }] },
] };

export function ProfileContentPreview() {
  const [view, setView] = useState("owner");
  const lowMetrics = profile.published_metrics!.metrics.filter(metric => metric.id !== "activity.active_days").map(metric => {
    if (metric.id === "activity.active_ms") return { ...metric, value: 0 };
    if (metric.id === "sessions.completed") return { ...metric, value: null, quality: "unavailable" as const };
    if (metric.id === "schedule.hourly_utc") return { ...metric, dataset: null, quality: "unavailable" as const };
    if (metric.id === "schedule.daily") return { ...metric, dataset: [{ date: "2026-09-01", activeMs: 0, editCount: 0, linesAdded: 0, linesRemoved: 0 }] };
    if (metric.id === "sessions.histogram") return { ...metric, dataset: Array(9).fill(0) };
    if (metric.id === "languages.activity") return { ...metric, dataset: [] };
    return metric;
  });
  const current = { ...profile, profile_layout: view === "legacy" ? getDefaultProfileLayout() : layout, ...(view === "empty" ? { published_metrics: { schemaVersion: "2" as const, metrics: [] } } : view === "low" ? { published_metrics: { schemaVersion: "2" as const, metrics: lowMetrics } } : {}) };
  return <>
    <nav aria-label="Test fixture controls" className="flex flex-wrap gap-4 bg-black p-4 text-white">{["owner", "public", "empty", "low", "legacy", "privacy"].map(mode => <button type="button" key={mode} onClick={() => setView(mode)}>Test {mode}</button>)}</nav>
    {view === "privacy" ? <div className="mx-auto max-w-2xl bg-[#11110d] p-8 text-[#edeae0]"><SyncPrivacyForm initial={{ publishProfile: true, publishLanguages: false, publicationVersion: 2, metricIds: ["activity.active_ms"], publishSchedule: false }} availableMetricIds={[...publicMetricIds]} /></div> : <ProfileView key={view} profile={current} isOwner={view !== "public"} customize={view !== "public"} />}
  </>;
}
