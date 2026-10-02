import { z } from "zod";

export const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const linkSchema = z.object({
  scope: z.literal("stats:write").optional(),
  statsSchemaVersion: z.literal(2).optional(),
  challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  state: z.string().regex(/^[a-f0-9]{64}$/),
  redirectUri: z.string().max(2048),
}).strict().refine(value => value.statsSchemaVersion === undefined || value.scope === "stats:write");
export const exchangeSchema = z.object({ code: tokenSchema, verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/), redirectUri: z.string().max(2048) }).strict();
export const refreshSchema = z.object({ refreshToken: tokenSchema, nextRefreshToken: tokenSchema.optional() }).strict();

export function appOrigin(): string {
  const origin = process.env.STACK_STATS_APP_ORIGIN ?? "https://stackstats.dev";
  const url = new URL(origin);
  if (url.origin !== origin || (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) throw new Error("Invalid application origin");
  return origin;
}

const nativeRedirects = ["vscode", "vscode-insiders", "cursor", "windsurf"].flatMap(scheme => [
  `${scheme}://StackStats.stack-stats-vscode/auth/callback`,
  // VS Code Uri.toString(true) lowercases the authority on the wire.
  `${scheme}://stackstats.stack-stats-vscode/auth/callback`,
  // Temporary beta/VSIX compatibility; removal is tracked in MARKETPLACE_AUTH_060.md.
  `${scheme}://undefined_publisher.stack-stats-vscode/auth/callback`,
]);

export function validRedirect(value: string): boolean {
  try {
    if (value.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(value)) return false;
    const extra: unknown = JSON.parse(process.env.STACK_STATS_EXTENSION_REDIRECT_URIS ?? "[]");
    if (!Array.isArray(extra) || !extra.every(uri => typeof uri === "string")) return false;
    const url = new URL(value);
    if (url.username || url.password || url.hash || url.searchParams.has("code") || url.searchParams.has("ss_state") || url.searchParams.has("error")) return false;
    if (extra.includes(value)) return true;
    // asExternalUri adds this native editor routing parameter. Permit only one
    // bounded numeric window ID on a byte-for-byte known native callback. Do not
    // normalize paths, casing or percent escapes before comparing the allowlist.
    const queryStart = value.indexOf("?");
    const base = queryStart === -1 ? value : value.slice(0, queryStart);
    return nativeRedirects.includes(base)
      && (queryStart === -1 || /^\?windowId=[0-9]{1,10}$/.test(value.slice(queryStart)));
  } catch { return false; }
}

export function callbackUrl(redirectUri: string, state: string, result: { code: string } | { error: "access_denied" }): string {
  if (!validRedirect(redirectUri)) throw new Error("Invalid redirect");
  const url = new URL(redirectUri);
  url.searchParams.set("ss_state", state);
  for (const [key, value] of Object.entries(result)) url.searchParams.set(key, value);
  return url.toString();
}

export function accountResponse(value: Record<string, unknown>) {
  const username = z.string().regex(/^[a-z0-9][a-z0-9_-]{2,29}$/).parse(value.username);
  return { userId: z.uuid().parse(value.userId), username,
    displayName: z.string().max(60).nullable().parse(value.displayName),
    profileUrl: `https://stackstats.dev/u/${username}` };
}

export const privateHeaders = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
export function authJson(body: unknown, status = 200): Response { return Response.json(body, { status, headers: privateHeaders }); }
