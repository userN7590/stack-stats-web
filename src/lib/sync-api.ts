import { z } from "zod";
import { anonymousClient, body } from "@/lib/extension-api";
import { appOrigin, authJson } from "@/lib/extension-auth";
import { parseSyncDay, syncInstallationPattern, validSyncDate, SYNC_MAX_BYTES } from "@/lib/sync-contract";
import { createClient } from "@/lib/supabase/server";

export async function putSyncDay(request: Request, installationId: string, date: string): Promise<Response> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer [a-f0-9]{64}$/.test(authorization)) return authJson({ error: "unauthorized" }, 401);
  if (!syncInstallationPattern.test(installationId) || !validSyncDate(date)) return authJson({ error: "invalid_request" }, 400);
  let payload;
  try { payload = parseSyncDay(await body(request, SYNC_MAX_BYTES)); }
  catch { return authJson({ error: "invalid_request" }, 400); }
  if (payload.date !== date) return authJson({ error: "invalid_request" }, 400);
  try {
    const { data, error } = await anonymousClient().rpc("sync_put_day", { p_access_token: authorization.slice(7), p_installation_id: installationId, p_date: date, p_payload: payload });
    if (error) return authJson({ error: error.code === "28000" ? "unauthorized" : error.code === "42501" ? "insufficient_scope" : "temporarily_unavailable" }, error.code === "28000" ? 401 : error.code === "42501" ? 403 : 503);
    if (data?.error) {
      const statuses: Record<string, number> = { stale_revision: 409, revision_conflict: 409, invalid_request: 400, installation_limit: 422, rate_limited: 429 };
      return authJson({ error: data.error, ...(data.revision ? { revision: data.revision } : {}) }, statuses[data.error] ?? 503);
    }
    return authJson(data);
  } catch { return authJson({ error: "temporarily_unavailable" }, 503); }
}
const privacySchema = z.object({ publishProfile: z.boolean(), publishLanguages: z.boolean() }).strict();
export async function syncPrivacy(request: Request): Promise<Response> {
  if (request.headers.get("origin") !== appOrigin()) return authJson({ error: "invalid_origin" }, 403);
  try {
    const input = privacySchema.parse(await body(request));
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return authJson({ error: "unauthorized" }, 401);
    const result = await supabase.rpc("sync_set_privacy", { p_publish_profile: input.publishProfile, p_publish_languages: input.publishLanguages });
    if (result.error) return authJson({ error: "temporarily_unavailable" }, 503);
    return authJson({ saved: true });
  } catch (error) { return authJson({ error: "invalid_or_unavailable" }, error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 503); }
}
export async function privateSyncSummary(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const period = url.searchParams.get("period") ?? "30";
  const to = url.searchParams.get("to");
  if (!["7", "30", "90", "lifetime"].includes(period) || (to !== null && !validSyncDate(to)) || [...url.searchParams.keys()].some(key => !["period", "to"].includes(key))) return authJson({ error: "invalid_request" }, 400);
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return authJson({ error: "unauthorized" }, 401);
    const result = await supabase.rpc("sync_private_summary", { p_period: period, ...(to ? { p_to: to } : {}) });
    return result.error ? authJson({ error: "temporarily_unavailable" }, 503) : authJson(result.data);
  } catch { return authJson({ error: "temporarily_unavailable" }, 503); }
}
