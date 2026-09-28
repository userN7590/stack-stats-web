import { buildFingerprint, fingerprintDaysFromHourlyRows, type FingerprintModel } from "@/lib/activity-fingerprint";

/**
 * Existing owner-only endpoint (Phase 9B): browser-session authenticated,
 * `Cache-Control: no-store`, scoped by the database to the signed-in owner.
 * The result lives only in the owner's page memory: it is never rendered on
 * the server, stored, published or passed to a public profile.
 */
export const OWNER_FINGERPRINT_URL = "/api/v2/sync/datasets?dataset=hourlyUtc&period=30";

export type OwnerFingerprintResult =
  | { status: "ready" | "empty"; model: FingerprintModel }
  | { status: "signed-out" | "not-permitted" | "unavailable" };

export async function loadOwnerFingerprint(fetcher: typeof fetch = fetch): Promise<OwnerFingerprintResult> {
  let response: Response;
  try {
    response = await fetcher(OWNER_FINGERPRINT_URL, { cache: "no-store", credentials: "same-origin", headers: { accept: "application/json" } });
  } catch {
    return { status: "unavailable" };
  }
  if (response.status === 401) return { status: "signed-out" };
  if (response.status === 403) return { status: "not-permitted" };
  if (!response.ok) return { status: "unavailable" };
  try {
    // Strict private-dataset validation, loaded only when an owner asks.
    const { privateDataset } = await import("@/lib/sync-datasets");
    const dataset = privateDataset(await response.json());
    if (dataset.dataset !== "hourlyUtc") return { status: "unavailable" };
    const model = buildFingerprint(fingerprintDaysFromHourlyRows(dataset.rows), { from: dataset.from, to: dataset.to });
    return { status: model.observedDays ? "ready" : "empty", model };
  } catch {
    return { status: "unavailable" };
  }
}
