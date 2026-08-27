import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

function getSafeDestination(origin: string, requestedPath: string | null) {
  const fallback = new URL("/dashboard", origin);

  if (!requestedPath?.startsWith("/")) {
    return fallback;
  }

  const destination = new URL(requestedPath, origin);

  return destination.origin === origin ? destination : fallback;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const flowId = requestUrl.searchParams.get("sb_flow_id");
  const destination = getSafeDestination(
    requestUrl.origin,
    requestUrl.searchParams.get("next"),
  );

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(
        code,
        flowId ? { flowId } : undefined,
      );

      if (!error) {
        return NextResponse.redirect(destination);
      }
    } catch {
      // Fall through to a non-sensitive error state on the login page.
    }
  }

  const loginUrl = new URL("/login", requestUrl.origin);
  loginUrl.searchParams.set("error", "confirmation");

  return NextResponse.redirect(loginUrl);
}
