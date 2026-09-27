import { privateSyncV2 } from "@/lib/sync-v2-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return privateSyncV2(request, "datasets"); }
