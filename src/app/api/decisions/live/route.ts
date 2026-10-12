import { NextResponse } from "next/server";
import { readExplainer, readLineup, readLiveSelection, readMenu } from "@/lib/live-store";
import { readDrinks } from "@/lib/live-store";
import { segmentScreen, segmentStatus } from "@/lib/segment";
import { freshExplainer } from "@/lib/explainer";
import { publicSelection } from "@/lib/live-selection";
import { customLook } from "@/lib/drink-menu";
import { liveMarquee, liveMarqueeLook } from "@/lib/drink-menu";
import { visibleMenu } from "@/lib/drink-list";
import { spaceOf } from "@/lib/space";
import { cleanBuild, currentBuild } from "@/lib/build";
import { Throttle, clientAddress } from "@/lib/throttle";
import { readMessage, readScreen, readSoundTest, writeScreenBuild } from "@/lib/live-store";
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
      marquee: liveMarquee(menu),
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
      // While a menu is up: how its marquee runs, and the drinks that show (none hidden, sold-out ones marked).
      marqueeLook: liveMarqueeLook(menu),
      drinks: menu.on ? visibleMenu(await readDrinks(space)) : null,
    }, { headers });
  } catch (error) {
    console.error("[live-show] read failed", error);
    return NextResponse.json({ question: null }, { status: 503, headers });
  }
}

/** A screen reports every few minutes at most; anything faster is not a screen. */
const reports = new Throttle(10, 10 * 60_000);

/**
 * The live screen saying which build it is running: it reports while it is
 * out of date and could not reload itself (in full screen, say), and once
 * more when it is up to date again, so the Control Center can tell the host
 * to reload the TV by hand between sets. Public like the GET, so it only
 * takes a build id, and writes only when the report is news.
 */
export async function POST(request: Request) {
  const space = spaceOf(new URL(request.url).searchParams.get("mode"));
  const address = clientAddress(request);
  if (reports.retryAfter(address)) return new NextResponse(null, { status: 429, headers });
  reports.record(address);
  let body: unknown;
  try { body = await request.json(); } catch {
    return new NextResponse(null, { status: 400, headers });
  }
  const build = cleanBuild((body as { build?: unknown } | null)?.build);
  if (!build || !currentBuild()) return new NextResponse(null, { status: 400, headers });
  try {
    await writeScreenBuild(build, space);
    return new NextResponse(null, { status: 204, headers });
  } catch (error) {
    console.error("[live-show] screen build report failed", error);
    return new NextResponse(null, { status: 503, headers });
  }
}
