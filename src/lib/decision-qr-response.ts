import "server-only";
import { NextResponse } from "next/server";
import { decisionsQrSvg, qrSvg } from "./qr";
import { modeQuery, type Space } from "./space";

/**
 * The one address every Bad Decisions QR opens. Fixed, not derived from the
 * site URL or a key, so a printed or on-screen code never goes stale.
 */
export const DECISIONS_QR_URL = "https://pinsandneedlescomedy.com/bad-decisions";

/** Same permanent audience entry for admin downloads and the live screen's corner QR. */
export async function decisionQrResponse(space: Space = "live") {
  const svg = await decisionsQrSvg(`${DECISIONS_QR_URL}${modeQuery(space)}`);
  return new NextResponse(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}

/**
 * A code for any address the caller has already checked (a host's signed
 * link, or one the signed-in host is previewing), cached as the caller says.
 */
export async function qrSvgResponse(url: string, cacheControl: string) {
  const svg = await qrSvg(url);
  return new NextResponse(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": cacheControl, "X-Robots-Tag": "noindex, nofollow" },
  });
}
