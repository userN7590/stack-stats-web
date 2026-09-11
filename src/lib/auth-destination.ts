/** Only local application destinations survive login/signup/confirmation. */
export function safeAuthDestination(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return "/dashboard";
  try {
    const url = new URL(value, "https://stackstats.dev");
    return url.origin === "https://stackstats.dev" ? `${url.pathname}${url.search}` : "/dashboard";
  } catch { return "/dashboard"; }
}

/** Preserve the existing exact Supabase allowlist URL for ordinary signup. */
export function confirmationCallbackPath(next: unknown): string {
  const destination = safeAuthDestination(next);
  return `/auth/callback?next=${destination === "/dashboard" ? "/dashboard" : encodeURIComponent(destination)}`;
}
