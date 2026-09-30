import "server-only";
import { NextResponse } from "next/server";
import { lockedDecisionQr } from "./decision-qr-lock";
import { decisionsQrSvg } from "./qr";
import { modeQuery, type Space } from "./space";

/** Same permanent audience entry for admin downloads and the live screen's corner QR. */
export async function decisionQrResponse(space: Space = "live") {
  const locked = await lockedDecisionQr();
  if (!locked) return NextResponse.json({ error: "QR unavailable" }, { status: 503 });
  const svg = await decisionsQrSvg(`${locked.url}${modeQuery(space, "&")}`);
  return new NextResponse(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
