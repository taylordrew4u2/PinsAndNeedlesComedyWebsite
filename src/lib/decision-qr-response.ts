import "server-only";
import { NextResponse } from "next/server";
import { decisionQrKey } from "./decision-access";
import { decisionsQrSvg } from "./qr";
import { getContent } from "./store";
import { siteBase } from "./seo";

/** Same signed audience entry for admin downloads and the live screen's corner QR. */
export async function decisionQrResponse() {
  const { site } = await getContent();
  const base = siteBase(site.url);
  const key = decisionQrKey();
  if (!key) return NextResponse.json({ error: "QR unavailable" }, { status: 503 });
  if (!base) return NextResponse.json({ error: "Site URL is not set" }, { status: 400 });
  const svg = await decisionsQrSvg(`${base}/bad-decisions?qr=${key}`);
  return new NextResponse(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
