import { handleExtensionRequest } from "@/lib/extension-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleExtensionRequest(request, "refresh");
}
