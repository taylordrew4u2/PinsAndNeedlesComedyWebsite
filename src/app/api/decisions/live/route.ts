import { NextResponse } from "next/server";
import { readExplainer, readLiveSelection, readMenu } from "@/lib/live-store";
import { freshExplainer } from "@/lib/explainer";
import { publicSelection } from "@/lib/live-selection";
import { DEFAULT_MARQUEE } from "@/lib/drink-menu";
import { spaceOf } from "@/lib/space";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

/**
 * Deliberately public: only the single question explicitly selected by an
 * admin, whether the drink menu is up, its marquee while it is, and when
 * the host last started the "Intro" explainer (only if recent). `?mode=rehearsal` reads the
 * rehearsal's own screen instead.
 */
export async function GET(request: Request) {
  const space = spaceOf(new URL(request.url).searchParams.get("mode"));
  try {
    const [selection, menu, explainer] = await Promise.all([readLiveSelection(space), readMenu(space), readExplainer(space)]);
    return NextResponse.json({ ...publicSelection(selection), menu: menu.on, marquee: menu.on ? menu.marquee || DEFAULT_MARQUEE : null, explainer: freshExplainer(explainer, Date.now()) }, { headers });
  } catch (error) {
    console.error("[live-show] read failed", error);
    return NextResponse.json({ question: null }, { status: 503, headers });
  }
}
