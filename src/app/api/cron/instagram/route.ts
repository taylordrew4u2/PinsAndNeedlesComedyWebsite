import { NextResponse } from "next/server";
import { autoSyncInstagram } from "@/lib/instagram-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily backstop for the page-view sync, so new reels still get pulled on a
 * day nobody visits. Scheduled in vercel.json. When CRON_SECRET is set,
 * Vercel sends it as a bearer token and anything else is turned away; either
 * way the sync itself is throttled, so a stray hit costs one Instagram call.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  await autoSyncInstagram();
  return NextResponse.json({ ok: true });
}
