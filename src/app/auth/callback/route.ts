import { NextResponse } from "next/server";
import { safeAuthDestination } from "@/lib/auth-destination";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const flowId = requestUrl.searchParams.get("sb_flow_id");
  const destination = new URL(safeAuthDestination(requestUrl.searchParams.get("next")), requestUrl.origin);

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
  loginUrl.searchParams.set("next", `${destination.pathname}${destination.search}`);

  return NextResponse.redirect(loginUrl);
}
