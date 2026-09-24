import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Token endpoints validate scoped extension credentials, never browser cookies.
  const tokenApi = request.nextUrl.pathname.startsWith("/api/v1/sync/installations/") || /^\/api\/extension\/(exchange|refresh|account|revoke)$/.test(request.nextUrl.pathname);
  const response = tokenApi ? NextResponse.next() : await updateSession(request);
  if (request.nextUrl.pathname.startsWith("/extension/") || request.nextUrl.pathname.startsWith("/api/extension/") || request.nextUrl.pathname.startsWith("/api/v1/sync/")) {
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
