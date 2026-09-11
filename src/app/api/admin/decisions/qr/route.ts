import { decisionQrKey } from "@/lib/decision-access";
import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { decisionsQrSvg } from "@/lib/qr";
import { getContent } from "@/lib/store";

export const dynamic = "force-dynamic";

/** The QR code for the current /bad-decisions URL, as print-ready SVG. */
export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { site } = await getContent();
  const base = (site.url || "").replace(/\/+$/, "");
  const key = decisionQrKey();
  if (!key) return NextResponse.json({ ok: false, error: "ADMIN_SECRET is not configured" }, { status: 503 });
  const target = base ? `${base}/bad-decisions?qr=${key}` : "";
  if (!target) {
    return NextResponse.json({ ok: false, error: "Site URL is not set" }, { status: 400 });
  }

  const svg = await decisionsQrSvg(target);
  return new NextResponse(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
  });
}
