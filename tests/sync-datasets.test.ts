import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { SYNC_LANGUAGES } from "../src/lib/sync-contract";
import { privateMetrics, privateDataset, publishedMetrics, activityShares } from "../src/lib/sync-datasets";
import { metricRegistry, publicMetricIds, datasetRegistry } from "../src/lib/metric-registry";
import { withPublishedMetrics, withSyncedProfile } from "../src/lib/synced-profile";
import { getProfileMetrics } from "../src/lib/profile-metrics";
import { getVisualizationDataset } from "../src/lib/visualization";
import { ExtensionConsent } from "../src/components/auth/extension-consent";
import { SyncPrivacyForm } from "../src/components/dashboard/sync-privacy";
import type { PublicProfile } from "../src/lib/types";
const counts = { activeMs: 90000, editCount: 6, linesAdded: 12, linesRemoved: 6 };
const zero = { activeMs: 0, editCount: 0, linesAdded: 0, linesRemoved: 0 };
const coverage = { source: "sessions-v1", dateBasis: "collector-local", historyCompleteness: "unknown", partial: true, recordCount: 3, v1Records: 1, v2Records: 2,
  firstUploadedDate: "2026-09-27", lastUploadedDate: "2026-09-27", uploadedDates: 1, firstObservedDate: "2026-09-27", lastObservedDate: "2026-09-27", earliestUploadFromDate: "2026-06-30", latestUploadFromDate: "2026-06-30", hourlyRecords: 0, hourlyDates: 0, frozenHourlyRecords: 0, lateInputIgnoredRecords: 0 };
const summary = { schemaVersion: "2", from: "2026-09-01", to: "2026-09-30", ...counts, fileDays: 3, sessionDays: 3, sessionStarts: 3, incompleteSessionStarts: 0, activeDays: 1, languageCount: 1,
  projectKnownCount: 3, projectIdentityComplete: true, projectOverflow: { projectDays: 0, ...zero }, projectSelectionRemainder: { knownIdentities: 0, ...zero },
  sessionDurations: { count: 3, activeMs: 120000, editCount: 7, linesAdded: 14, linesRemoved: 5, minActiveMs: 30000, maxActiveMs: 60000, averageActiveMs: 40000, histogram: [0,2,1,0,0,0,0,0,0] },
  languages: [{ id: "typescript", ...counts }], projects: [], hourlyUtc: null, coverage };
const manual = { username: "owner", user_id: "owner", lines_added: 999, lines_removed: 888, edit_events: 777, coding_minutes: 666, files_changed: 555, projects_count: 444, created_at: "2026-01-01", updated_at: "2026-01-01", languages: [{ id: "private-manual", name: "Saved manual", percentage: 100 }] } as PublicProfile;
const published = (metrics: unknown[]) => ({ schemaVersion: "2", metrics });
const scalar = (id = "activity.active_ms", value: number | null = 90000) => ({ id, definitionVersion: 1, unit: "milliseconds", quality: "partial", dateBasis: "collector-local", value });
describe("semantic metric and dataset adapters", () => {
  it("keeps the SQL publication and language allowlists aligned with the web registry and protocol", () => {
    const migration = readFileSync("supabase/migrations/20260927000000_sync_daily_v2.sql", "utf8");
    const registry = migration.split("create function public.sync_public_metric_ids()")[1].split("$$;")[0];
    expect([...registry.matchAll(/'([a-z_]+\.[a-z_]+)'/g)].map(match => match[1])).toEqual([...publicMetricIds]);
    const languages = migration.match(/string_to_array\('([^']+)',' '\)/)?.[1].split(" ");
    expect(languages?.sort()).toEqual([...SYNC_LANGUAGES].sort());
  });
  it("keeps independent populations, units, quality and source coverage", () => {
    const result = privateMetrics(summary);
    const metric = (id: string) => result.metrics.find(m => m.id === id)!;
    expect(metric("activity.active_ms").value).toBe(90000);
    expect(metric("sessions.active_ms").value).toBe(120000);
    expect(metric("sessions.average_ms").value).toBe(40000);
    expect(metric("sessions.longest_ms").value).toBe(60000);
    expect(metric("sessions.histogram").dataset).toEqual([0,2,1,0,0,0,0,0,0]);
    expect(metric("schedule.hourly_utc")).toMatchObject({ dataset: null, quality: "unavailable", dateBasis: "UTC" });
    expect(result.coverage).toEqual(coverage);
    expect(result.metrics.every(m => m.quality !== "available")).toBe(true);
  });
  it("never invents v2 sessions from v1 session-days", () => {
    const result = privateMetrics({ ...summary, sessionStarts: null, incompleteSessionStarts: null, sessionDurations: null, coverage: { ...coverage, v1Records: 3, v2Records: 0 } });
    expect(result.metrics.find(m => m.id === "sessions.days")).toMatchObject({ value: 3, quality: "partial" });
    expect(result.metrics.find(m => m.id === "sessions.starts")).toMatchObject({ value: null, quality: "unavailable" });
    expect(result.metrics.find(m => m.id === "sessions.histogram")).toMatchObject({ dataset: null, quality: "unavailable" });
  });
  it("distinguishes measured empty cohorts, unavailable history, and real zero duration", () => {
    const empty = privateMetrics({ ...summary, sessionStarts: 0, incompleteSessionStarts: 0, sessionDurations: { count: 0, ...zero, minActiveMs: null, maxActiveMs: null, averageActiveMs: null, histogram: Array(9).fill(0) } });
    expect(empty.metrics.find(m => m.id === "sessions.completed")).toMatchObject({ value: 0, quality: "partial" });
    expect(empty.metrics.find(m => m.id === "sessions.average_ms")).toMatchObject({ value: null, quality: "unavailable" });
    const noRows = privateMetrics({ ...summary, coverage: { ...coverage, recordCount: 0, v1Records: 0, v2Records: 0 } });
    expect(noRows.metrics.every(m => m.quality === "unavailable")).toBe(true);
    const zeroDuration = privateMetrics({ ...summary, sessionDurations: { count: 1, ...zero, minActiveMs: 0, maxActiveMs: 0, averageActiveMs: 0, histogram: [1,0,0,0,0,0,0,0,0] } });
    expect(zeroDuration.metrics.find(m => m.id === "sessions.longest_ms")).toMatchObject({ value: 0, quality: "partial" });
  });
  it("preserves overflow and selection remainder instead of a false exact project count", () => {
    const result = privateMetrics({ ...summary, projectIdentityComplete: false, projectKnownCount: 130, projectOverflow: { projectDays: 3, ...counts }, projectSelectionRemainder: { knownIdentities: 2, ...counts } });
    expect(result.metrics.find(m => m.id === "projects.activity")?.dataset).toMatchObject({ identityComplete: false, overflow: { projectDays: 3 }, selectionRemainder: { knownIdentities: 2 } });
    expect(metricRegistry["projects.known_count"].description).toContain("lower bound");
  });
  it("keeps UTC dates and null rows without generating missing historical bins", () => {
    const value = { schemaVersion: "2", dataset: "hourlyUtc", from: "2026-09-21", to: "2026-09-27", dateBasis: "UTC", rows: [{ date: "2026-09-27", hourlyUtc: null, coverage }], coverage };
    const missing = privateDataset(value);
    expect(missing.quality).toBe("unavailable"); expect(missing.rows).toHaveLength(1);
    const hourly = { source: "telemetry-v2", dateBasis: "UTC", activeMsByHour: Array(24).fill(0), editCountByHour: Array(24).fill(0), linesAddedByHour: Array(24).fill(0), linesRemovedByHour: Array(24).fill(0) };
    const observed = privateDataset({ ...value, coverage: { ...coverage, hourlyRecords: 1, hourlyDates: 1 }, rows: [{ ...value.rows[0], hourlyUtc: hourly }] });
    expect(observed.quality).toBe("partial");
    expect(() => privateDataset({ ...value, dateBasis: "collector-local" })).toThrow();
    expect(datasetRegistry.hourlyUtc.presentations).toContain("ridgeline");
  });
  it("derives shares using an explicit measure and deterministic lexical ties", () => {
    const rows = [{ id: "typescript", activeMs: 10, editCount: 1, linesAdded: 3, linesRemoved: 0 }, { id: "javascript", activeMs: 10, editCount: 3, linesAdded: 1, linesRemoved: 0 }];
    expect(activityShares(rows, "activeMs").map(r => [r.id, r.percentage])).toEqual([["javascript",50],["typescript",50]]);
    expect(activityShares(rows, "editCount")[0].percentage).toBe(75);
    expect(activityShares(rows, "linesRemoved").every(r => r.percentage === 0)).toBe(true);
  });
  it("rejects precision loss and unknown server fields at the adapter boundary", () => {
    expect(() => privateMetrics({ ...summary, activeMs: Number.MAX_SAFE_INTEGER + 1 })).toThrow();
    expect(() => privateMetrics({ ...summary, sourceCode: "not allowed" })).toThrow();
  });
});
describe("publication is independent of layout", () => {
  it("exposes only selected values, preserving saved manual objects", () => {
    const profile = withPublishedMetrics(manual, published([scalar()]));
    const metrics = getProfileMetrics(profile);
    expect(profile.coding_minutes).toBe(1); expect(metrics.lines_added.value).toBe("Not published");
    expect(metrics.projects_count.value).toBe("Not published"); expect(profile.languages).toEqual([]);
    expect(getVisualizationDataset(profile, "line_changes").rows).toEqual([]);
    expect(getVisualizationDataset(profile, "language_share").rows).toEqual([]);
    expect(manual.lines_added).toBe(999);
  });
  it("empty or malformed v2 publication never falls back to manual telemetry", () => {
    for (const value of [published([]), published([{ ...scalar(), coverage }]), published([{ ...scalar(), id: "projects.activity" }])]) {
      const profile = withPublishedMetrics(manual, value);
      expect(profile.stats_source).toBe("synced"); expect(getProfileMetrics(profile).coding_minutes.value).toBe("Not published");
      expect(profile.languages).toEqual([]);
    }
  });
  it("validates public units, allowed IDs, selected dataset shapes and duplicate IDs", () => {
    expect(publishedMetrics(published([scalar()]))?.metrics).toHaveLength(1);
    expect(() => publishedMetrics(published([scalar(), scalar()]))).toThrow();
    expect(() => publishedMetrics(published([{ ...scalar(), unit: "count" }]))).toThrow();
    expect(() => publishedMetrics(published([{ ...scalar(), dateBasis: "UTC" }]))).toThrow();
    expect(() => publishedMetrics(published([{ id: "languages.activity", definitionVersion: 1, unit: "count", quality: "partial", dateBasis: "collector-local", dataset: [{ id: "typescript", ...counts, installationId: "secret" }] }]))).toThrow();
    expect(publicMetricIds.every(id => metricRegistry[id].publication !== "private")).toBe(true);
    expect(metricRegistry["schedule.hourly_utc"].publication).toBe("schedule-consent");
  });
  it("does not display an exact legacy project count when overflow exists", () => {
    const profile = withSyncedProfile(manual, { ...counts, recordCount: 1, fileDays: 2, projectCount: null, updatedAt: null, languages: [] });
    expect(getProfileMetrics(profile).projects_count.value).toBe("Unavailable");
  });
  it("richer consent is visible and unchecked, and identity consent does not offer upload approval", () => {
    const request = { challenge: "a".repeat(43), state: "b".repeat(64), redirectUri: "vscode://undefined_publisher.stack-stats-vscode/auth/callback", scope: "stats:write" as const };
    const rich = renderToStaticMarkup(createElement(ExtensionConsent, { request, username: "owner", cancelUrl: "/" }));
    expect(rich).toContain('type="checkbox"'); expect(rich).not.toContain("checked="); expect(rich).toContain("off by default"); expect(rich).toContain("completed-session");
    const identity = renderToStaticMarkup(createElement(ExtensionConsent, { request: { ...request, scope: undefined }, username: "owner", cancelUrl: "/" }));
    expect(identity).not.toContain('type="checkbox"');
  });
  it("versioned privacy shows selected permissions without offering legacy broad publication", () => {
    const html = renderToStaticMarkup(createElement(SyncPrivacyForm, { initial: { publicationVersion: 2, publishProfile: true, publishLanguages: false, metricIds: ["activity.active_ms"], publishSchedule: false } }));
    expect(html).toContain("Selected metrics: Coding time"); expect(html).not.toContain("Also publish the synced language breakdown");
  });
});
