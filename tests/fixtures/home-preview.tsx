// Synthetic browser-test content only. The Phase 9D runner creates and removes
// its temporary local route; this fixture is never imported by a product route.
import { HomeView } from "@/components/home/home-view";
import { exampleProfile } from "@/lib/example-profile";
import { withPublishedMetrics } from "@/lib/synced-profile";
import type { PublicProfile } from "@/lib/types";

const hours = (fill: (hour: number) => number) => Array.from({ length: 24 }, (_, hour) => fill(hour));
const scalar = (id: string, unit: "milliseconds" | "count" | "lines", value: number) => ({ id, definitionVersion: 1, unit, quality: "partial", dateBasis: "collector-local", value }) as never;

/**
 * Synthetic stand-in for the live @fil card: plausible published values run
 * through the same public-projection adapter as production. Not production data.
 */
export const syntheticLiveProfile: PublicProfile = withPublishedMetrics({
  ...exampleProfile, user_id: "fixture-fil", username: "fil", display_name: "fil", bio: "I love building projects!",
}, { schemaVersion: "2", metrics: [
  scalar("activity.active_ms", "milliseconds", 151_860_000),
  scalar("activity.lines_added", "lines", 18_420),
  scalar("activity.edits", "count", 9_310),
  scalar("activity.file_days", "count", 412),
  { id: "languages.activity", definitionVersion: 1, unit: "count", quality: "partial", dateBasis: "collector-local", dataset: [
    { id: "typescript", activeMs: 88_000_000, editCount: 5_200, linesAdded: 10_900, linesRemoved: 3_100 },
    { id: "python", activeMs: 41_000_000, editCount: 2_600, linesAdded: 5_100, linesRemoved: 1_900 },
    { id: "css", activeMs: 22_860_000, editCount: 1_510, linesAdded: 2_420, linesRemoved: 800 },
  ] },
  { id: "schedule.hourly_utc", definitionVersion: 1, unit: "count", quality: "partial", dateBasis: "UTC", dataset: {
    source: "telemetry-v2", dateBasis: "UTC",
    activeMsByHour: hours((hour) => [0, 0, 0, 0, 0, 0, 0, 2, 9, 16, 18, 14, 7, 11, 17, 19, 15, 9, 5, 6, 9, 10, 5, 1][hour] * 300_000),
    editCountByHour: hours(() => 0), linesAddedByHour: hours(() => 0), linesRemovedByHour: hours(() => 0),
  } },
] });

/** Homepage composition for browser tests: ?auth=1 (signed in), ?live=0 (persona fallback). */
export async function HomePreview({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const live = params.live !== "0";
  return (
    <HomeView
      viewer={params.auth === "1" ? { signedIn: true, username: "phase9d" } : { signedIn: false, username: null }}
      example={{ profile: live ? syntheticLiveProfile : exampleProfile, live }}
    />
  );
}
