import { NextResponse } from "next/server";
import { readExplainer, readLineup, readLiveSelection, readMenu } from "@/lib/live-store";
import { segmentScreen, segmentStatus } from "@/lib/segment";
import { freshExplainer } from "@/lib/explainer";
import { publicSelection } from "@/lib/live-selection";
import { DEFAULT_MARQUEE, customLook } from "@/lib/drink-menu";
import { spaceOf } from "@/lib/space";
import { currentBuild } from "@/lib/build";
import { readMessage, readScreen, readSoundTest } from "@/lib/live-store";
import { changedScreen, freshSoundTest } from "@/lib/screen-settings";
import { publicMessage } from "@/lib/screen-message";

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
    // The host's screen settings, message and sound test, read alongside the rest and awaited below (a failure there still answers 503).
    const screenReads = Promise.all([readScreen(space), readMessage(space), readSoundTest(space)]);
    screenReads.catch(() => {});
    const [stored, menu, explainer, lineup] = await Promise.all([readLiveSelection(space), readMenu(space), readExplainer(space), readLineup(space)]);
    const now = Date.now();
    // A running set owns the screen: the performer's name, then only the slot that is up now — never the ones still to come.
    const screen = segmentScreen(lineup, now);
    const selection = screen === undefined ? stored : screen.selection;
    const status = segmentStatus(lineup, now);
    const [screenSettings, message, soundTest] = await screenReads;
    return NextResponse.json({
      ...publicSelection(selection),
      menu: menu.on,
      marquee: menu.on ? menu.marquee || DEFAULT_MARQUEE : null,
      menuCustom: menu.on ? customLook(menu) : null,
      explainer: freshExplainer(explainer, now),
      performer: screen?.performer ?? null,
      // The deployment answering, so a screen left open across an update knows to reload.
      build: currentBuild(),
      segment: status.running ? { remainingMs: status.remainingMs, nextSwitchMs: status.nextSwitchMs } : null,
      // Only the settings the host changed ({} draws the screen as it always was), their message while it is up, and a recent sound test.
      screen: changedScreen(screenSettings),
      message: publicMessage(message),
      soundTest: freshSoundTest(soundTest, now),
    }, { headers });
  } catch (error) {
    console.error("[live-show] read failed", error);
    return NextResponse.json({ question: null }, { status: 503, headers });
  }
}
