import { z } from "zod";
import { anonymousClient, body } from "@/lib/extension-api";
import { appOrigin, authJson } from "@/lib/extension-auth";
import { validSyncDate, syncInstallationPattern } from "@/lib/sync-contract";
import { createClient } from "@/lib/supabase/server";
import { publicMetricIds } from "@/lib/metric-registry";

function failure(code?: string) {
  const errors: Record<string, [string, number]> = { "28000": ["unauthorized", 401], "42501": ["insufficient_scope", 403], "22023": ["invalid_request", 400], "54000": ["dataset_limit", 413] };
  const [error, status] = errors[code ?? ""] ?? ["temporarily_unavailable", 503];
  return authJson({ error }, status);
}
export async function syncCapabilities(request: Request): Promise<Response> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer [a-f0-9]{64}$/.test(authorization)) return failure("28000");
  if (new URL(request.url).search) return failure("22023");
  try {
    const { data, error } = await anonymousClient().rpc("sync_capabilities", { p_access_token: authorization.slice(7) });
    if (error) return failure(error.code);
    const capabilities = z.object({ schemaVersion: z.literal("1"), dailyVersions: z.union([z.tuple([z.literal("1")]), z.tuple([z.literal("1"), z.literal("2")])]) }).strict().safeParse(data);
    return capabilities.success ? authJson(capabilities.data) : failure();
  } catch { return failure(); }
}
export const datasetIds = ["daily", "languagesByDay", "projectsByDay", "sessionStartCohorts", "hourlyUtc"] as const;
export async function privateSyncV2(request: Request, product: "summary" | "datasets" | "export" = "summary"): Promise<Response> {
  const query = new URL(request.url).searchParams;
  const keys = product === "export" ? ["afterDate", "afterInstallation"] : product === "datasets" ? ["period", "to", "dataset"] : ["period", "to"];
  if ([...query.keys()].some(key => !keys.includes(key) || query.getAll(key).length !== 1)) return failure("22023");
  const period = query.get("period") ?? "30", to = query.get("to"), dataset = query.get("dataset");
  let args: Record<string, string>;
  if (product === "export") {
    const date = query.get("afterDate"), installation = query.get("afterInstallation");
    if ((date === null) !== (installation === null) || (date !== null && !validSyncDate(date)) || (installation !== null && !syncInstallationPattern.test(installation))) return failure("22023");
    args = date && installation ? { p_after_date: date, p_after_installation: installation } : {};
  } else {
    if (!(product === "datasets" ? ["7", "30", "90"] : ["7", "30", "90", "lifetime"]).includes(period) || (to !== null && !validSyncDate(to)) || (product === "datasets" && !datasetIds.includes(dataset as typeof datasetIds[number]))) return failure("22023");
    args = { p_period: period, ...(to ? { p_to: to } : {}), ...(product === "datasets" ? { p_to: to ?? new Date().toISOString().slice(0, 10), p_dataset: dataset! } : {}) };
  }
  try {
    const supabase = await createClient();
    const user = await supabase.auth.getUser();
    if (user.error || !user.data.user) return failure("28000");
    const result = await supabase.rpc(product === "export" ? "sync_export_v2" : product === "datasets" ? "sync_private_datasets_v2" : "sync_private_summary_v2", args);
    return result.error ? failure(result.error.code) : authJson(result.data);
  } catch { return failure(); }
}
const privacySchema = z.object({ schemaVersion: z.literal("2"), publishProfile: z.boolean(), metricIds: z.array(z.enum(publicMetricIds)).max(128), publishSchedule: z.boolean() }).strict()
  .refine(value => new Set(value.metricIds).size === value.metricIds.length && (value.publishSchedule || value.metricIds.every(id => !id.startsWith("schedule."))));
export async function syncPrivacyV2(request: Request): Promise<Response> {
  try {
    if (request.method !== "GET" && request.headers.get("origin") !== appOrigin()) return authJson({ error: "invalid_origin" }, 403);
    if (new URL(request.url).search) return failure("22023");
    const input = request.method === "GET" ? null : privacySchema.parse(await body(request));
    const supabase = await createClient();
    const user = await supabase.auth.getUser();
    if (user.error || !user.data.user) return failure("28000");
    const result = input ? await supabase.rpc("sync_set_privacy_v2", { p_publish_profile: input.publishProfile, p_metric_ids: input.metricIds, p_publish_schedule: input.publishSchedule }) : await supabase.rpc("sync_get_privacy_v2");
    return result.error ? failure(result.error.code) : authJson(input ? { saved: true } : result.data);
  } catch (error) {
    return failure(error instanceof z.ZodError || error instanceof SyntaxError || (error instanceof Error && error.message === "invalid_request") ? "22023" : undefined);
  }
}
export async function eraseSyncData(request: Request): Promise<Response> {
  try {
    if (request.headers.get("origin") !== appOrigin()) return authJson({ error: "invalid_origin" }, 403);
    if (new URL(request.url).search) return failure("22023");
    z.object({ confirmation: z.literal("delete-cloud-sync-data") }).strict().parse(await body(request));
    const supabase = await createClient();
    const user = await supabase.auth.getUser();
    if (user.error || !user.data.user) return failure("28000");
    const result = await supabase.rpc("sync_erase_cloud_data");
    return result.error ? failure(result.error.code) : authJson({ deleted: true, uploadGrantsRevoked: true });
  } catch (error) {
    return failure(error instanceof z.ZodError || error instanceof SyntaxError || (error instanceof Error && error.message === "invalid_request") ? "22023" : undefined);
  }
}
