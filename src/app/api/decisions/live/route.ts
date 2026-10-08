import { NextResponse } from "next/server";
import { readExplainer, readLineup, readLiveSelection, readMenu } from "@/lib/live-store";
import { segmentScreen, segmentStatus } from "@/lib/segment";
import { freshExplainer } from "@/lib/explainer";
import { publicSelection } from "@/lib/live-selection";
import { DEFAULT_MARQUEE, customLook } from "@/lib/drink-menu";
import { spaceOf } from "@/lib/space";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

/**
 * Deliberately public: only the single question explicitly selected by an
 * admin, whether the drink menu is up (and, for the custom one, its colour
 * and the line above the QR), its marquee while it is, and when
 * the host last started the "Intro" explainer (only if recent), and the
 * performer on stage and the set clock while a timed set runs. `?mode=rehearsal` reads the
 * rehearsal's own screen instead.
 */
export async function GET(request: Request) {
  const space = spaceOf(new URL(request.url).searchParams.get("mode"));
  try {
    const [stored, menu, explainer, lineup] = await Promise.all([readLiveSelection(space), readMenu(space), readExplainer(space), readLineup(space)]);
    const now = Date.now();
    // A running set owns the screen: the performer's name, then only the slot that is up now — never the ones still to come.
    const screen = segmentScreen(lineup, now);
    const selection = screen === undefined ? stored : screen.selection;
    const status = segmentStatus(lineup, now);
    return NextResponse.json({
      ...publicSelection(selection),
      menu: menu.on,
      marquee: menu.on ? menu.marquee || DEFAULT_MARQUEE : null,
      menuCustom: menu.on ? customLook(menu) : null,
      explainer: freshExplainer(explainer, now),
      performer: screen?.performer ?? null,
      segment: status.running ? { remainingMs: status.remainingMs, nextSwitchMs: status.nextSwitchMs } : null,
    }, { headers });
  } catch (error) {
    console.error("[live-show] read failed", error);
    return NextResponse.json({ question: null }, { status: 503, headers });
  }
}
