import { NextResponse } from "next/server";
import { getContentStrict, patchContent } from "@/lib/store";
import { isFromPastShow, lastPastShowDate, parsePreload, pickRandom, submissionWindow } from "@/lib/decisions";
import { isAuthed } from "@/lib/auth";
import { addSubmission, getSubmission, listPile, markShown, putBack } from "@/lib/submissions";
import { clearLiveSelection, readLineup, readLiveSelection, readMenu, startExplainer, writeLineup, writeLiveSelection, writeMenu } from "@/lib/live-store";
import { MAX_PERFORMERS, SEGMENT_SLOTS, rearrange, segmentScreen, segmentStatus, slottedIds, startPerformer, stopAll, type Lineup, type PerformerInput } from "@/lib/segment";
import { cleanBartender, cleanColor, cleanHeadline, cleanMarquee, cleanNote, type MenuState } from "@/lib/drink-menu";
import { isMenuFont, isScriptFont } from "@/lib/menu-fonts";
import { drawable, selectionFor, type LiveSelection } from "@/lib/live-selection";
import { spaceOf, type Space } from "@/lib/space";
import { currentBuild } from "@/lib/build";
import type { Show, Submission } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
const ID = /^[A-Za-z0-9-]+$/;

/** Legacy mode parameters also use the live show. */
function spaceFrom(request: Request): Space {
  return spaceOf(new URL(request.url).searchParams.get("mode"));
}

/**
 * Questions from a show whose date has passed are dropped from the control
 * center, so each night starts fresh. The rehearsal space has no show clock
 * and keeps everything.
 */
/** What the control center needs to draw the lineup: every card, and the set running now. */
function lineupView(lineup: Lineup) {
  return { lineup, segment: segmentStatus(lineup, Date.now()) };
}

/** The drink menu as the control center shows it: which one is up, and the saved text and colour ("" for a default). */
function menuView(menu: MenuState) {
  return {
    menu: menu.on, menuStyle: menu.style, marquee: menu.marquee,
    menuColor: menu.color, menuHeadline: menu.headline, menuNote: menu.note, menuNoteColor: menu.noteColor,
    menuFont: menu.font, menuBartender: menu.bartender, menuBartenderFont: menu.bartenderFont, menuBartenderColor: menu.bartenderColor,
  };
}

function currentOnly(list: Submission[], shows: Show[], space: Space): Submission[] {
  if (space === "rehearsal") return list;
  const lastPast = lastPastShowDate(shows);
  return list.filter((item) => !isFromPastShow(item, lastPast));
}

/** The control center's view of the pile, split the way the page shows it. */
export async function GET(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const space = spaceFrom(request);
  try {
    const [pile, onScreen, content, menu, segment] = await Promise.all([listPile({}, space), readLiveSelection(space), getContentStrict(), readMenu(space), readLineup(space)]);
    const current = currentOnly(pile.submissions, content.shows, space);
    const now = Date.now();
    const status = segmentStatus(segment, now);
    const fromSegment = segmentScreen(segment, now)?.selection;
    // The slot that is up now counts as shown, the same as one the host picked.
    if (fromSegment) {
      const item = current.find((entry) => entry.id === fromSegment.submissionId);
      if (item && !item.shownAt) {
        await markShown(item.id, space).catch((error) => console.error("[run-show] mark segment shown failed", error));
        item.shownAt = new Date(now).toISOString();
      }
    }
    // Sitting in a performer's card: it lives there, not in the waiting list.
    const lined = slottedIds(segment);
    // A question left on the projector from a past show comes down too.
    let selected = onScreen;
    const onScreenItem = selected && pile.submissions.find((item) => item.id === selected?.submissionId);
    if (selected && onScreenItem && !current.includes(onScreenItem)) {
      await clearLiveSelection(selected.submissionId, space).catch((error) => console.error("[run-show] clear stale screen failed", error));
      selected = null;
    }
    const live = current.filter((item) => item.status !== "archived");
    if (status.running) selected = fromSegment ?? null;
    return NextResponse.json({
      // The deployment answering, so a Control Center left open across an update can say so.
      build: currentBuild(),
      lineup: segment,
      segment: status,
      // Waiting: never on screen and not in a card. Once a question has been up it moves to `shown`.
      submissions: live.filter((item) => !item.shownAt && item.id !== selected?.submissionId && !lined.has(item.id)),
      shown: live.filter((item) => item.shownAt || item.id === selected?.submissionId),
      archived: current.filter((item) => item.status === "archived"),
      truncated: pile.truncated,
      selected,
      ...menuView(menu),
      questionsOpen: content.weekly.enabled && submissionWindow(content.weekly, content.shows).open,
      manualOpen: content.weekly.enabled && content.weekly.alwaysOpen,
      pageLive: content.weekly.enabled,
    }, { headers });
  } catch (error) {
    console.error("[run-show] load failed", error);
    return NextResponse.json({ error: "Could not load questions. Try again." }, { status: 503, headers });
  }
}

/**
 * Put one question on the projector and record that it has been shown. A
 * question going up takes the drink menu down, so it is actually seen.
 */
async function show(submission: Submission | null, space: Space): Promise<LiveSelection | null> {
  const selected = submission ? selectionFor(submission) : null;
  await writeLiveSelection(selected, space);
  if (selected) {
    await writeMenu({ on: false }, space).catch((error) => console.error("[run-show] menu off failed", error));
  }
  if (submission) {
    // The screen already changed; a failed mark only leaves it in the list.
    await markShown(submission.id, space).catch((error) => console.error("[run-show] mark shown failed", error));
  }
  return selected;
}

export async function POST(request: Request) {
  if (!(await isAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const space = spaceFrom(request);
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Choose a question or clear the screen." }, { status: 400, headers });
  }
  if ("explainer" in body) {
    if (body.explainer !== true) {
      return NextResponse.json({ error: "Invalid intro request" }, { status: 400, headers });
    }
    try {
      // A one-shot: the live screen plays it once and goes back to what was up.
      return NextResponse.json({ explainer: await startExplainer(space) }, { headers });
    } catch (error) {
      console.error("[run-show] explainer failed", error);
      return NextResponse.json({ error: "Could not start the intro. Try again." }, { status: 503, headers });
    }
  }
  if ("menu" in body) {
    const style = "style" in body ? body.style : undefined;
    if (typeof body.menu !== "boolean" || (style !== undefined && style !== "standard" && style !== "custom")) {
      return NextResponse.json({ error: "Invalid menu setting" }, { status: 400, headers });
    }
    try {
      // Only which menu is up: the question underneath stays and returns when the menu comes down.
      const menu = await writeMenu(style ? { on: body.menu, style } : { on: body.menu }, space);
      return NextResponse.json(menuView(menu), { headers });
    } catch (error) {
      console.error("[run-show] menu failed", error);
      return NextResponse.json({ error: "Could not update the drink menu. Try again." }, { status: 503, headers });
    }
  }
  if ("marquee" in body) {
    if (typeof body.marquee !== "string") {
      return NextResponse.json({ error: "Invalid marquee" }, { status: 400, headers });
    }
    try {
      // Saved whether or not the menu is up; it only runs while the menu is on screen.
      const menu = await writeMenu({ marquee: cleanMarquee(body.marquee) }, space);
      return NextResponse.json(menuView(menu), { headers });
    } catch (error) {
      console.error("[run-show] marquee failed", error);
      return NextResponse.json({ error: "Could not update the marquee. Try again." }, { status: 503, headers });
    }
  }
  if ("customMenu" in body) {
    const look = body.customMenu as Record<string, unknown> | null;
    const badColor = (value: unknown) => typeof value !== "string" || Boolean(value.trim() && !cleanColor(value));
    // Optional fields may be left out (they keep what is saved); a font is "" for the default or a known id.
    const badOptional = (value: unknown, bad: (value: unknown) => boolean) => value !== undefined && bad(value);
    if (!look || typeof look !== "object" || typeof look.headline !== "string" || badColor(look.color)
      || badOptional(look.note, (value) => typeof value !== "string") || badOptional(look.noteColor, badColor)
      || badOptional(look.font, (value) => value !== "" && !isMenuFont(value))
      || badOptional(look.bartender, (value) => typeof value !== "string")
      || badOptional(look.bartenderFont, (value) => value !== "" && !isScriptFont(value))
      || badOptional(look.bartenderColor, badColor)) {
      return NextResponse.json({ error: "Invalid custom menu" }, { status: 400, headers });
    }
    try {
      // Saved whether or not it is up; empty text or colour means the default (and an empty note, none).
      const menu = await writeMenu({
        color: cleanColor(look.color), headline: cleanHeadline(look.headline),
        ...(look.note !== undefined ? { note: cleanNote(look.note) } : {}),
        ...(look.noteColor !== undefined ? { noteColor: cleanColor(look.noteColor) } : {}),
        ...(look.font !== undefined ? { font: look.font as string } : {}),
        ...(look.bartender !== undefined ? { bartender: cleanBartender(look.bartender) } : {}),
        ...(look.bartenderFont !== undefined ? { bartenderFont: look.bartenderFont as string } : {}),
        ...(look.bartenderColor !== undefined ? { bartenderColor: cleanColor(look.bartenderColor) } : {}),
      }, space);
      return NextResponse.json(menuView(menu), { headers });
    } catch (error) {
      console.error("[run-show] custom menu failed", error);
      return NextResponse.json({ error: "Could not save the custom menu. Try again." }, { status: 503, headers });
    }
  }
  if ("manualOpen" in body) {
    if (typeof body.manualOpen !== "boolean") {
      return NextResponse.json({ error: "Invalid question setting" }, { status: 400, headers });
    }
    try {
      // Only change question availability. Never write the projector selection or other page settings.
      const content = await patchContent({ weekly: {
        alwaysOpen: body.manualOpen,
        ...(body.manualOpen ? { enabled: true } : {}),
      } });
      return NextResponse.json({
        questionsOpen: content.weekly.enabled && submissionWindow(content.weekly, content.shows).open,
        manualOpen: content.weekly.enabled && content.weekly.alwaysOpen,
        pageLive: content.weekly.enabled,
      }, { headers });
    } catch (error) {
      console.error("[run-show] question setting failed", error);
      return NextResponse.json({ error: "Could not update questions. Try again." }, { status: 503, headers });
    }
  }
  if ("segment" in body) {
    if (body.segment !== "start" && body.segment !== "stop") {
      return NextResponse.json({ error: "Invalid set request" }, { status: 400, headers });
    }
    const performerId = "performerId" in body ? body.performerId : null;
    if (body.segment === "start" && (typeof performerId !== "string" || !ID.test(performerId))) {
      return NextResponse.json({ error: "Choose whose set to start." }, { status: 400, headers });
    }
    try {
      const lineup = await readLineup(space);
      if (body.segment === "stop") {
        const next = stopAll(lineup, Date.now());
        await writeLineup(next, space);
        return NextResponse.json(lineupView(next), { headers });
      }
      const next = startPerformer(lineup, performerId as string, Date.now());
      if (!next) return NextResponse.json({ error: "That performer is gone. Refresh and try again." }, { status: 404, headers });
      await writeLineup(next, space);
      // The set owns the screen now; when it ends, the screen is left clear.
      await writeLiveSelection(null, space).catch((error) => console.error("[run-show] clear for set failed", error));
      await writeMenu({ on: false }, space).catch((error) => console.error("[run-show] menu off failed", error));
      return NextResponse.json(lineupView(next), { headers });
    } catch (error) {
      console.error("[run-show] set failed", error);
      return NextResponse.json({ error: "Could not update the set. Try again." }, { status: 503, headers });
    }
  }
  if ("lineup" in body) {
    const raw = body.lineup;
    const valid = Array.isArray(raw) && raw.length <= MAX_PERFORMERS && raw.every((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const item = entry as Record<string, unknown>;
      return typeof item.id === "string" && ID.test(item.id) && item.id.length <= 40
        && (item.name === undefined || typeof item.name === "string")
        && Array.isArray(item.slots) && item.slots.length === SEGMENT_SLOTS
        && item.slots.every((id) => id === null || (typeof id === "string" && ID.test(id)));
    });
    if (!valid) return NextResponse.json({ error: "Invalid lineup" }, { status: 400, headers });
    try {
      const lineup = await readLineup(space);
      // Reuse what is already in a card; read only the questions newly dropped in.
      const known = new Map(lineup.performers.flatMap((performer) => performer.slots).filter((slot) => slot !== null).map((slot) => [slot.submissionId, slot]));
      const input: PerformerInput[] = await Promise.all((raw as { id: string; name?: string; slots: (string | null)[] }[]).map(async (entry) => ({
        id: entry.id,
        name: entry.name ?? "",
        slots: await Promise.all(entry.slots.map(async (id) => {
          if (id === null) return null;
          const have = known.get(id);
          if (have) return have;
          const submission = await getSubmission(id, space);
          return submission ? selectionFor(submission) : null;
        })),
      })));
      const next = rearrange(lineup, input, Date.now());
      await writeLineup(next, space);
      return NextResponse.json(lineupView(next), { headers });
    } catch (error) {
      console.error("[run-show] lineup failed", error);
      return NextResponse.json({ error: "Could not save the lineup. Try again." }, { status: 503, headers });
    }
  }
  if ("draw" in body) {
    try {
      // Read past the cache: a pile even slightly behind could hand the host
      // something already read out on stage.
      const [pile, current, content, segment] = await Promise.all([listPile({ fresh: true }, space), readLiveSelection(space), getContentStrict(), readLineup(space)]);
      if (segmentStatus(segment, Date.now()).running) return NextResponse.json({ error: "A set is running. Stop it to pick by hand." }, { status: 409, headers });
      const lined = slottedIds(segment);
      const picked = pickRandom(drawable(currentOnly(pile.submissions, content.shows, space), current?.submissionId).filter((item) => !lined.has(item.id)));
      if (!picked) return NextResponse.json({ error: "No questions waiting to draw." }, { status: 404, headers });
      const selected = await show(picked, space);
      return NextResponse.json({ selected, drawn: picked }, { headers });
    } catch (error) {
      console.error("[run-show] draw failed", error);
      return NextResponse.json({ error: "Could not draw a question. Try again." }, { status: 503, headers });
    }
  }
  if ("preload" in body) {
    const clean = parsePreload(body.preload);
    if (!clean) return NextResponse.json({ error: "Type at least one question." }, { status: 400, headers });
    try {
      // Straight into the pile: no QR window, no throttle. One at a time keeps
      // GitHub-driver commits from racing each other.
      const added: Submission[] = [];
      for (const decision of clean.decisions) added.push(await addSubmission(decision, clean.name, space));
      return NextResponse.json({ added }, { headers });
    } catch (error) {
      console.error("[run-show] preload failed", error);
      return NextResponse.json({ error: "Could not add those questions. Check the list and try again." }, { status: 503, headers });
    }
  }
  if ("putBack" in body) {
    const id = body.putBack;
    if (typeof id !== "string" || !ID.test(id)) {
      return NextResponse.json({ error: "Invalid question" }, { status: 400, headers });
    }
    try {
      const submission = await putBack(id, space);
      if (!submission) return NextResponse.json({ error: "That question is gone." }, { status: 404, headers });
      return NextResponse.json({ submission }, { headers });
    } catch (error) {
      console.error("[run-show] put back failed", error);
      return NextResponse.json({ error: "Could not put that question back. Try again." }, { status: 503, headers });
    }
  }
  if (!("submissionId" in body)) {
    return NextResponse.json({ error: "Choose a question or clear the screen." }, { status: 400, headers });
  }
  const id = body.submissionId;
  if (id !== null && (typeof id !== "string" || !ID.test(id))) {
    return NextResponse.json({ error: "Invalid question" }, { status: 400, headers });
  }
  try {
    if (segmentStatus(await readLineup(space), Date.now()).running) {
      return NextResponse.json({ error: "A set is running. Stop it to pick by hand." }, { status: 409, headers });
    }
    const submission = id === null ? null : await getSubmission(id, space);
    if (id !== null && (!submission || !selectionFor(submission))) {
      return NextResponse.json({ error: "That question is no longer available." }, { status: 404, headers });
    }
    return NextResponse.json({ selected: await show(submission, space) }, { headers });
  } catch (error) {
    console.error("[run-show] selection failed", error);
    return NextResponse.json({ error: "Could not update the live screen. Try again." }, { status: 503, headers });
  }
}
