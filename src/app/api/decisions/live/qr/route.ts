import { getContent } from "@/lib/store";
import { decisionQrResponse } from "@/lib/decision-qr-response";
import { spaceOf } from "@/lib/space";

export const dynamic = "force-dynamic";

/**
 * Public by design: the audience scans this from the live show screen. The
 * rehearsal screen's QR (`?mode=rehearsal`) opens the practice form.
 */
export async function GET(request: Request) {
  const space = spaceOf(new URL(request.url).searchParams.get("mode"));
  if (space === "live" && !(await getContent()).weekly.enabled) return new Response(null, { status: 404 });
  return decisionQrResponse(space);
}
