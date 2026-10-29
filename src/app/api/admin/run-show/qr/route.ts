import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { qrSvgResponse } from "@/lib/decision-qr-response";
import { cleanQrLink } from "@/lib/screen-qr";

export const dynamic = "force-dynamic";

/**
 * The Control Center's preview of a code for a link the host has typed,
 * saved or not, so they can point their phone at it before it goes up.
 * Signed-in only: the public route draws only links the server signed.
 */
export async function GET(request: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const link = cleanQrLink(new URL(request.url).searchParams.get("to"));
  if (!link) {
    return NextResponse.json({ ok: false, error: "That isn't a web address a code can be made from. It needs to start with https://" }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  }
  return qrSvgResponse(link, "private, no-store");
}
