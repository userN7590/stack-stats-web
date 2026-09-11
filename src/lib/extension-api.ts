import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { accountResponse, appOrigin, authJson, callbackUrl, exchangeSchema, linkSchema, refreshSchema, tokenSchema, validRedirect } from "@/lib/extension-auth";

export function anonymousClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createSupabaseClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
export async function body(request: Request, limit = 8192) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("invalid_request");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid_request");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.length;
      if (size > limit) { await reader.cancel(); throw new Error("invalid_request"); }
      chunks.push(next.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { reader.releaseLock(); }
}

export async function handleExtensionRequest(request: Request, action: "authorize" | "exchange" | "refresh" | "account" | "revoke" | "revoke-all"): Promise<Response> {
  try {
    const browser = action === "authorize" || action === "revoke-all";
    if (browser && request.headers.get("origin") !== appOrigin()) return authJson({ error: "invalid_origin" }, 403);
    const supabase = browser ? await createClient() : anonymousClient();
    if (browser) {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return authJson({ error: "sign_in_required" }, 401);
    }
    let name: string; let args: Record<string, string> = {}; let link: ReturnType<typeof linkSchema.parse> | undefined;
    if (action === "authorize") {
      link = linkSchema.parse(await body(request));
      if (!validRedirect(link.redirectUri)) return authJson({ error: "invalid_redirect" }, 400);
      name = link.scope === "stats:write" ? "extension_authorize_stats" : "extension_authorize"; args = { p_challenge: link.challenge, p_redirect_uri: link.redirectUri };
    } else if (action === "exchange") {
      const data = exchangeSchema.parse(await body(request));
      if (!validRedirect(data.redirectUri)) return authJson({ error: "invalid_redirect" }, 400);
      name = "extension_exchange"; args = { p_code: data.code, p_verifier: data.verifier, p_redirect_uri: data.redirectUri };
    } else if (action === "refresh" || action === "revoke") {
      const data = refreshSchema.parse(await body(request));
      name = action === "refresh" ? data.nextRefreshToken ? "extension_refresh_stats" : "extension_refresh" : "extension_revoke";
      args = { p_refresh_token: data.refreshToken, ...(action === "refresh" && data.nextRefreshToken ? { p_next_refresh_token: data.nextRefreshToken } : {}) };
    } else if (action === "account") {
      const authorization = request.headers.get("authorization") ?? "";
      if (!/^Bearer [a-f0-9]{64}$/.test(authorization)) return authJson({ error: "unauthorized" }, 401);
      name = "extension_account"; args = { p_access_token: authorization.slice(7) };
    } else { name = "extension_revoke_all"; }
    const { data, error } = await supabase.rpc(name, args);
    if (error) {
      if (error.code === "28000") return authJson({ error: "unauthorized" }, 401);
      if (error.code === "54000") return authJson({ error: "rate_limited" }, 429);
      if (error.code === "P0002") return authJson({ error: "profile_required" }, 409);
      return authJson({ error: "temporarily_unavailable" }, 503);
    }
    if (action === "refresh" && data === null) return authJson({ error: "unauthorized" }, 401);
    if (action === "authorize") return authJson({ callbackUrl: callbackUrl(link!.redirectUri, link!.state, { code: tokenSchema.parse(data) }) });
    if (action === "account") return authJson({ account: accountResponse(data) });
    if (action === "exchange" || action === "refresh") return authJson({ ...data, account: accountResponse(data.account) });
    return authJson({ revoked: true });
  } catch (error) {
    // Never include request bodies, callback codes, credentials or DB errors.
    if (error instanceof SyntaxError || (error instanceof Error && (error.name === "ZodError" || error.message === "invalid_request"))) return authJson({ error: "invalid_request" }, 400);
    return authJson({ error: "temporarily_unavailable" }, 503);
  }
}
