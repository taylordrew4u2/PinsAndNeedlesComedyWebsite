import { getContent } from "@/lib/store";
import { decisionQrResponse } from "@/lib/decision-qr-response";

export const dynamic = "force-dynamic";

/** Public by design: the audience scans this from the live show screen. */
export async function GET() {
  if (!(await getContent()).weekly.enabled) return new Response(null, { status: 404 });
  return decisionQrResponse();
}
