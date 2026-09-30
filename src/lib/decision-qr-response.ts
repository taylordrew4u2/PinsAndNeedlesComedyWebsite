import "server-only";
import { NextResponse } from "next/server";
import { decisionQrKey } from "./decision-access";
import { decisionsQrSvg } from "./qr";
import { getContent } from "./store";
import { siteBase } from "./seo";
import { modeQuery, type Space } from "./space";

/** The fixed audience address, shared by admin downloads and the live screen's corner QR. */
export async function decisionQrResponse(space: Space = "live") {
  const { site } = await getContent();
  const base = siteBase(site.url);
  const key = decisionQrKey();
  if (!key) return NextResponse.json({ error: "QR unavailable" }, { status: 503 });
  if (!base) return NextResponse.json({ error: "Site URL is not set" }, { status: 400 });
  const svg = await decisionsQrSvg(`${base}/bad-decisions${modeQuery(space)}`);
  return new NextResponse(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
