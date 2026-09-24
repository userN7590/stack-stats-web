import { NextResponse } from "next/server";
import { safeAuthDestination } from "@/lib/auth-destination";
import { appOrigin, privateHeaders } from "@/lib/extension-auth";

import { createClient } from "@/lib/supabase/server";

// Auth redirects must run per request, including callbacks without a code.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const flowId = requestUrl.searchParams.get("sb_flow_id");
  // Use the configured public origin even when the hosting proxy presents an
  // internal host. Never trust forwarded host headers for auth redirects.
  const origin = appOrigin();
  const destination = new URL(safeAuthDestination(requestUrl.searchParams.get("next")), origin);

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(
        code,
        flowId ? { flowId } : undefined,
      );

      if (!error) {
        return NextResponse.redirect(destination, { headers: privateHeaders });
      }
    } catch {
      // Fall through to a non-sensitive error state on the login page.
    }
  }

  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "confirmation");
  loginUrl.searchParams.set("next", `${destination.pathname}${destination.search}`);

  return NextResponse.redirect(loginUrl, { headers: privateHeaders });
}
