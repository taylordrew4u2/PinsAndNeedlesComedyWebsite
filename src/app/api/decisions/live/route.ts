import { NextResponse } from "next/server";
import { readExplainer, readLiveSelection, readMenu, readSegment } from "@/lib/live-store";
import { segmentSelection, segmentStatus } from "@/lib/segment";
import { freshExplainer } from "@/lib/explainer";
import { publicSelection } from "@/lib/live-selection";
import { DEFAULT_MARQUEE } from "@/lib/drink-menu";
import { spaceOf } from "@/lib/space";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

/**
 * Deliberately public: only the single question explicitly selected by an
 * admin, whether the drink menu is up, its marquee while it is, and when
 * the host last started the "Intro" explainer (only if recent), and the
 * segment clock while one runs. `?mode=rehearsal` reads the
 * rehearsal's own screen instead.
 */
export async function GET(request: Request) {
  const space = spaceOf(new URL(request.url).searchParams.get("mode"));
  try {
    const [stored, menu, explainer, segment] = await Promise.all([readLiveSelection(space), readMenu(space), readExplainer(space), readSegment(space)]);
    const now = Date.now();
    // A running segment owns the screen: only the slot that is up now, never the ones still to come.
    const fromSegment = segmentSelection(segment, now);
    const selection = fromSegment === undefined ? stored : fromSegment;
    const status = segmentStatus(segment, now);
    return NextResponse.json({
      ...publicSelection(selection),
      menu: menu.on,
      marquee: menu.on ? menu.marquee || DEFAULT_MARQUEE : null,
      explainer: freshExplainer(explainer, now),
      segment: status.running ? { remainingMs: status.remainingMs, nextSwitchMs: status.nextSwitchMs } : null,
    }, { headers });
  } catch (error) {
    console.error("[live-show] read failed", error);
    return NextResponse.json({ question: null }, { status: 503, headers });
  }
}
