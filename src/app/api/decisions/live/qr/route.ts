import { getContent } from "@/lib/store";
import { decisionQrResponse, qrSvgResponse } from "@/lib/decision-qr-response";
import { validQrLinkSig } from "@/lib/qr-link";
import { spaceOf } from "@/lib/space";

export const dynamic = "force-dynamic";

/**
 * Public by design: the audience scans this from the live show screen. With
 * no `to`, the Bad Decisions question form, as it always was (the rehearsal
 * screen's QR, `?mode=rehearsal`, opens the practice form).
 *
 * With `to` and `sig`, a code for the host's own link, but only one the
 * live screen's poll signed with the admin secret: so this route never puts
 * this site's name on a code for anyone else's link, and never reads a
 * record to know what to draw. The address fixes the picture, so it is
 * cached for good; a new link (or a new secret) is a new address. A `to`
 * without a good signature is turned away, never drawn.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const to = params.get("to");
  if (to !== null) {
    if (!validQrLinkSig(to, params.get("sig"))) return new Response(null, { status: 404 });
    return qrSvgResponse(to, "public, max-age=31536000, immutable");
  }
  const space = spaceOf(params.get("mode"));
  if (space === "live" && !(await getContent()).weekly.enabled) return new Response(null, { status: 404 });
  return decisionQrResponse(space);
}
