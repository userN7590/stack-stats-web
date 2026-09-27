import { putSyncDayV2 } from "@/lib/sync-api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function PUT(request: Request, context: { params: Promise<{ installationId: string; date: string }> }) {
 const { installationId, date } = await context.params;
 return putSyncDayV2(request, installationId, date);
}
