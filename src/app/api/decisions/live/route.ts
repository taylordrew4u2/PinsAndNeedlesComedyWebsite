import { NextResponse } from "next/server";
import { readLiveSelection } from "@/lib/live-store";
import { publicSelection } from "@/lib/live-selection";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

/** Deliberately public: only the single question explicitly selected by an admin. */
export async function GET() {
  try {
    return NextResponse.json(publicSelection(await readLiveSelection()), { headers });
  } catch (error) {
    console.error("[live-show] read failed", error);
    return NextResponse.json({ question: null }, { status: 503, headers });
  }
}
