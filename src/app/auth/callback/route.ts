import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedPath = requestUrl.searchParams.get("next") ?? "/dashboard";
  const next =
    requestedPath.startsWith("/") && !requestedPath.startsWith("//")
      ? requestedPath
      : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const forwardedProtocol = request.headers.get("x-forwarded-proto") ?? "https";

      if (process.env.NODE_ENV === "development") {
        return NextResponse.redirect(`${requestUrl.origin}${next}`);
      }

      if (forwardedHost) {
        return NextResponse.redirect(`${forwardedProtocol}://${forwardedHost}${next}`);
      }

      return NextResponse.redirect(`${requestUrl.origin}${next}`);
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}/login?error=confirmation`);
}
