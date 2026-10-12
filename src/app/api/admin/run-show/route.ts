import { NextResponse } from "next/server";
import { getContentStrict, patchContent } from "@/lib/store";
import { isFromPastShow, lastPastShowDate, parsePreload, pickRandom, submissionWindow } from "@/lib/decisions";
import { isAuthed } from "@/lib/auth";
import { addSubmission, getSubmission, listPile, markShown, putBack } from "@/lib/submissions";
import { clearLiveSelection, readLineup, readLiveSelection, readMenu, startExplainer, writeLineup, writeLiveSelection, writeMenu } from "@/lib/live-store";
import { DEFAULT_TIMING, MAX_PERFORMERS, QUESTIONS_MAX, clearFinished, parseCardTiming, parseTiming, rearrange, segmentScreen, segmentStatus, setCardTiming, setLineupTiming, slotCountFor, slottedIds, startPerformer, stopAll, type Lineup, type PerformerInput } from "@/lib/segment";
import { readDrinks, writeDrinks } from "@/lib/live-store";
import { cleanBartender, cleanColor, cleanHeadline, cleanMarquee, cleanNote, type MenuState } from "@/lib/drink-menu";
import { WORDING_KEYS, isMarqueeSpeed, wordingChange } from "@/lib/drink-menu";
import { cleanDrinkListInput, defaultDrinkList, parseDrinkList, sameList, setSoldOut } from "@/lib/drink-list";
import { isMenuFont, isScriptFont } from "@/lib/menu-fonts";
import { drawable, selectionFor, type LiveSelection } from "@/lib/live-selection";
import { spaceOf, type Space } from "@/lib/space";
import { currentBuild, staleScreen } from "@/lib/build";
import { clearMessage, readMessage, readScreen, readScreenBuild, startSoundTest, writeMessage, writeScreen } from "@/lib/live-store";
import { parseScreenChange } from "@/lib/screen-settings";
import { applyMessage, parseMessageChange } from "@/lib/screen-message";
import type { Show, Submission } from "@/lib/types";
import { closeQuestions, closedByHost } from "@/lib/decisions";
import { editSubmission } from "@/lib/submissions";
import { copiesOnly, lineupAfterEdit, parseQuestionEdit, selectionAfterEdit } from "@/lib/questions";

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
    marqueeOn: menu.marqueeOn, marqueeSpeed: menu.marqueeSpeed, marqueeColor: menu.marqueeColor,
    menuQrCaption: menu.qrCaption, menuQrTitle: menu.qrTitle, menuQrLink: menu.qrLink, menuBartenderLabel: menu.bartenderLabel,
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
    // The live screen's settings and the host's message, read alongside the rest and awaited below (a failure there still answers 503).
    const screenReads = Promise.all([readScreen(space), readMessage(space)]);
    screenReads.catch(() => {});
    // Which build the TV last said it runs. Only a hint for the host: a failed read just shows no hint.
    const screenBuild = readScreenBuild(space).catch(() => null);
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
    const [screen, message] = await screenReads;
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
      // The live screen's settings ("" words are the defaults) and the host's message, up or saved for later.
      screen,
      message,
      // The TV is running an older version of the site and could not reload itself: the host reloads it between sets.
      staleScreen: staleScreen(await screenBuild, currentBuild(), now),
      // The host pressed "Close questions now" and it still holds.
      manualClosed: content.weekly.enabled && closedByHost(content.weekly),
      // The host's drink list, null for the printed menu.
      drinks: await readDrinks(space),
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
  // The question goes up first, then the menu and message come down. A poll in between sees the new question
  // still covered, and the live screen holds its countdown and sting until it is uncovered. The other order
  // would flash the old question back up for a moment.
  await writeLiveSelection(selected, space);
  if (selected) {
    await writeMenu({ on: false }, space).catch((error) => console.error("[run-show] menu off failed", error));
    await clearMessage(space).catch((error) => console.error("[run-show] message off failed", error));
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
      if (body.menu) await clearMessage(space).catch((error) => console.error("[run-show] message off failed", error));
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
      || badOptional(look.bartenderColor, badColor)
      || WORDING_KEYS.some((key) => badOptional(look[key], (value) => typeof value !== "string"))) {
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
        ...wordingChange(look),
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
        // Open now, or back to the schedule: either way a "Close questions now" ends.
        closedUntil: "",
      } });
      return NextResponse.json({
        questionsOpen: content.weekly.enabled && submissionWindow(content.weekly, content.shows).open,
        manualOpen: content.weekly.enabled && content.weekly.alwaysOpen,
        pageLive: content.weekly.enabled,
        manualClosed: false,
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
      await clearMessage(space).catch((error) => console.error("[run-show] message off failed", error));
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
        && Array.isArray(item.slots) && item.slots.length >= 1 && item.slots.length <= QUESTIONS_MAX
        && item.slots.every((id) => id === null || (typeof id === "string" && ID.test(id)));
    });
    if (!valid) return NextResponse.json({ error: "Invalid lineup" }, { status: 400, headers });
    try {
      const lineup = await readLineup(space);
      // Each card comes back with as many slots as it holds now; a different count was made against a lineup that has since changed.
      if ((raw as { id: string; slots: unknown[] }[]).some((entry) => entry.slots.length !== slotCountFor(lineup, entry.id))) {
        return NextResponse.json({ error: "The lineup just changed. Look it over and try again." }, { status: 409, headers });
      }
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
      // The question the host has open in an editor stays in the pile until they save or cancel.
      const skip = "skip" in body && typeof body.skip === "string" ? body.skip : "";
      const picked = pickRandom(drawable(currentOnly(pile.submissions, content.shows, space), current?.submissionId).filter((item) => !lined.has(item.id) && item.id !== skip));
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
  if ("screen" in body) {
    const change = parseScreenChange(body.screen);
    if (!change) return NextResponse.json({ error: "Invalid screen settings" }, { status: 400, headers });
    try {
      // Merged into what is saved, so changing one setting keeps the rest. The live screen picks it up on its next poll.
      return NextResponse.json({ screen: await writeScreen(change, space) }, { headers });
    } catch (error) {
      console.error("[run-show] screen settings failed", error);
      return NextResponse.json({ error: "Could not save the live screen settings. Try again." }, { status: 503, headers });
    }
  }
  if ("message" in body) {
    const change = parseMessageChange(body.message);
    if (!change) return NextResponse.json({ error: "Invalid message" }, { status: 400, headers });
    try {
      const current = await readMessage(space);
      const next = applyMessage(current, change);
      if (change.on && !next.on) return NextResponse.json({ error: "Type a message first." }, { status: 400, headers });
      if (JSON.stringify(next) !== JSON.stringify(current)) await writeMessage(next, space);
      // The message and the drink menu take turns: putting the message up takes the menu down.
      const menu = next.on ? await readMenu(space) : null;
      if (menu?.on) await writeMenu({ on: false }, space);
      return NextResponse.json({ message: next, ...(next.on ? { menu: false } : {}) }, { headers });
    } catch (error) {
      console.error("[run-show] message failed", error);
      return NextResponse.json({ error: "Could not update the message. Try again." }, { status: 503, headers });
    }
  }
  if ("soundTest" in body) {
    if (body.soundTest !== true) {
      return NextResponse.json({ error: "Invalid sound test" }, { status: 400, headers });
    }
    try {
      // A one-shot, like the Intro: the live screen plays the sting once and nothing else changes.
      return NextResponse.json({ soundTest: await startSoundTest(space) }, { headers });
    } catch (error) {
      console.error("[run-show] sound test failed", error);
      return NextResponse.json({ error: "Could not test the sound. Try again." }, { status: 503, headers });
    }
  }
  if ("lineupTiming" in body) {
    // null is the standard twelve minutes.
    const timing = body.lineupTiming === null ? DEFAULT_TIMING : parseTiming(body.lineupTiming);
    if (!timing) return NextResponse.json({ error: "Invalid set timing" }, { status: 400, headers });
    try {
      const lineup = await readLineup(space);
      // Cards following the lineup's timing fit it; the set on stage keeps the timing it started with.
      const next = setLineupTiming(lineup, timing, Date.now());
      if (JSON.stringify(next) !== JSON.stringify(lineup)) await writeLineup(next, space);
      return NextResponse.json(lineupView(next), { headers });
    } catch (error) {
      console.error("[run-show] set timing failed", error);
      return NextResponse.json({ error: "Could not save the set timing. Try again." }, { status: 503, headers });
    }
  }
  if ("cardTiming" in body) {
    const wanted = parseCardTiming(body.cardTiming);
    if (!wanted) return NextResponse.json({ error: "Invalid set timing" }, { status: 400, headers });
    try {
      const lineup = await readLineup(space);
      const next = setCardTiming(lineup, wanted.performerId, wanted.timing, Date.now());
      if (next === "gone") return NextResponse.json({ error: "That performer is gone. Refresh and try again." }, { status: 404, headers });
      if (next === "running") return NextResponse.json({ error: "That set is running. Change its timing after it ends." }, { status: 409, headers });
      if (JSON.stringify(next) !== JSON.stringify(lineup)) await writeLineup(next, space);
      return NextResponse.json(lineupView(next), { headers });
    } catch (error) {
      console.error("[run-show] card timing failed", error);
      return NextResponse.json({ error: "Could not save the set timing. Try again." }, { status: 503, headers });
    }
  }
  if ("clearFinished" in body) {
    if (body.clearFinished !== true) return NextResponse.json({ error: "Invalid lineup" }, { status: 400, headers });
    try {
      const lineup = await readLineup(space);
      // Cards whose set has run go; never the one on stage, never one still to go.
      const next = clearFinished(lineup, Date.now());
      if (next.performers.length !== lineup.performers.length) await writeLineup(next, space);
      return NextResponse.json(lineupView(next), { headers });
    } catch (error) {
      console.error("[run-show] clear finished failed", error);
      return NextResponse.json({ error: "Could not clear the finished cards. Try again." }, { status: 503, headers });
    }
  }
  if ("manualClosed" in body) {
    if (typeof body.manualClosed !== "boolean") {
      return NextResponse.json({ error: "Invalid question setting" }, { status: 400, headers });
    }
    try {
      // Like manualOpen, only question availability. The close holds until the
      // end of tonight's window, worked out from the settings as they are now.
      const current = await getContentStrict();
      const content = await patchContent({ weekly: body.manualClosed ? closeQuestions(current.weekly, current.shows) : { closedUntil: "" } });
      return NextResponse.json({
        questionsOpen: content.weekly.enabled && submissionWindow(content.weekly, content.shows).open,
        manualOpen: content.weekly.enabled && content.weekly.alwaysOpen,
        pageLive: content.weekly.enabled,
        manualClosed: content.weekly.enabled && closedByHost(content.weekly),
      }, { headers });
    } catch (error) {
      console.error("[run-show] close questions failed", error);
      return NextResponse.json({ error: "Could not update questions. Try again." }, { status: 503, headers });
    }
  }
  if ("editQuestion" in body) {
    const edit = parseQuestionEdit(body.editQuestion);
    if (!edit) return NextResponse.json({ error: "Write the question first." }, { status: 400, headers });
    try {
      const stored = await editSubmission(edit.submissionId, edit.change, space);
      // Deleted from the pile but still up in a running set: its copies still take the fix.
      const submission = stored ?? copiesOnly(edit.submissionId, edit.change);
      if (!submission) return NextResponse.json({ error: "That question is gone." }, { status: 404, headers });
      // The projector and the performer cards hold their own copies: bring
      // them up to date so the screen shows the fix on its next poll.
      const [selection, lineup] = await Promise.all([readLiveSelection(space), readLineup(space)]);
      if (!stored && selection?.submissionId !== submission.id && !slottedIds(lineup).has(submission.id)) {
        return NextResponse.json({ error: "That question is gone." }, { status: 404, headers });
      }
      const screen = selectionAfterEdit(selection, submission);
      if (screen) await writeLiveSelection(screen, space);
      const cards = lineupAfterEdit(lineup, submission);
      if (cards) await writeLineup(cards, space);
      return NextResponse.json({ submission }, { headers });
    } catch (error) {
      console.error("[run-show] edit question failed", error);
      return NextResponse.json({ error: "Could not save that question. Try again." }, { status: 503, headers });
    }
  }
  if ("restore" in body) {
    const id = body.restore;
    if (typeof id !== "string" || !ID.test(id)) {
      return NextResponse.json({ error: "Invalid question" }, { status: 400, headers });
    }
    try {
      // Out of the archive and back to waiting: open again, never shown.
      const submission = await putBack(id, space);
      if (!submission) return NextResponse.json({ error: "That question is gone." }, { status: 404, headers });
      return NextResponse.json({ submission }, { headers });
    } catch (error) {
      console.error("[run-show] restore failed", error);
      return NextResponse.json({ error: "Could not bring that question back. Try again." }, { status: 503, headers });
    }
  }
  if ("marqueeStyle" in body) {
    const style = body.marqueeStyle as Record<string, unknown> | null;
    if (!style || typeof style !== "object" || typeof style.on !== "boolean" || !isMarqueeSpeed(style.speed)
      || typeof style.color !== "string" || Boolean(style.color.trim() && !cleanColor(style.color))) {
      return NextResponse.json({ error: "Invalid marquee setting" }, { status: 400, headers });
    }
    try {
      // On or off, speed and colour together; the text stays as it is. Off, the menu fills the screen.
      const menu = await writeMenu({ marqueeOn: style.on, marqueeSpeed: style.speed, marqueeColor: cleanColor(style.color) }, space);
      return NextResponse.json(menuView(menu), { headers });
    } catch (error) {
      console.error("[run-show] marquee style failed", error);
      return NextResponse.json({ error: "Could not update the marquee. Try again." }, { status: 503, headers });
    }
  }
  if ("soldOut" in body) {
    const mark = body.soldOut as Record<string, unknown> | null;
    if (!mark || typeof mark !== "object" || typeof mark.id !== "string" || !ID.test(mark.id) || typeof mark.on !== "boolean") {
      return NextResponse.json({ error: "Invalid sold-out mark" }, { status: 400, headers });
    }
    try {
      // Just this one drink, on the list as saved now: a mark made from another screen a moment ago stays.
      const next = setSoldOut((await readDrinks(space)) ?? defaultDrinkList(), mark.id, mark.on);
      if (!next) return NextResponse.json({ error: "That drink is no longer on the list. Refresh and try again." }, { status: 404, headers });
      await writeDrinks(next, space);
      return NextResponse.json({ drinks: next }, { headers });
    } catch (error) {
      console.error("[run-show] sold out failed", error);
      return NextResponse.json({ error: "Could not save the drink list. Try again." }, { status: 503, headers });
    }
  }
  if ("drinks" in body) {
    // A whole list, three columns within the limits; null puts the printed menu back.
    const list = body.drinks === null ? null : cleanDrinkListInput(body.drinks);
    // The list the editor last saw saved (null: the printed menu), when it says; left out, nothing is checked.
    const from = "from" in body ? body.from : undefined;
    if ((body.drinks !== null && !list) || (from !== undefined && from !== null && !parseDrinkList(from))) {
      return NextResponse.json({ error: "Invalid drink list" }, { status: 400, headers });
    }
    try {
      // Changed from another screen since the editor last looked (a sold-out tap, say): saving would quietly undo that.
      if (from !== undefined && !sameList((await readDrinks(space)) ?? defaultDrinkList(), parseDrinkList(from) ?? defaultDrinkList())) {
        return NextResponse.json({ error: "The drink list was just changed on another screen. Look it over and press Save again." }, { status: 409, headers });
      }
      // Both menus draw from it, so a menu that is up changes with it.
      await writeDrinks(list, space);
      return NextResponse.json({ drinks: list }, { headers });
    } catch (error) {
      console.error("[run-show] drinks failed", error);
      return NextResponse.json({ error: "Could not save the drink list. Try again." }, { status: 503, headers });
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
