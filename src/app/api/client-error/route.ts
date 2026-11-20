import { NextResponse } from "next/server";
import { cleanReport } from "@/lib/client-error";
import { Throttle, clientAddress } from "@/lib/throttle";

export const dynamic = "force-dynamic";

/** A few reports per browser, and a ceiling for everyone, so a broken page or a bad actor cannot flood the log. */
const perAddress = new Throttle(20, 15 * 60_000);
const everyone = new Throttle(300, 15 * 60_000);
const MAX_BYTES = 8_000;

/** Crash reports from visitors' browsers (see ErrorReporter), written to the server log for Vercel's runtime logs. */
export async function POST(request: Request) {
  const address = clientAddress(request);
  if (perAddress.retryAfter(address) || everyone.retryAfter("*")) return new NextResponse(null, { status: 204 });
  const text = await request.text().catch(() => "");
  if (!text || text.length > MAX_BYTES) return new NextResponse(null, { status: 204 });
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return new NextResponse(null, { status: 204 }); }
  const report = cleanReport(raw, request.headers.get("user-agent"));
  if (report) {
    perAddress.record(address);
    everyone.record("*");
    console.error("[client-error]", JSON.stringify(report));
  }
  return new NextResponse(null, { status: 204 });
}
