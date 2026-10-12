import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { driver, requireGithub } from "./store";
import { readFile as githubRead, writeFile as githubWrite } from "./github-store";
import { parseSelection, type LiveSelection } from "./live-selection";
import { parseMenuState, type MenuState } from "./drink-menu";
import { parseExplainer } from "./explainer";
import { parseLineup, type Lineup } from "./segment";
import { storagePrefix, type Space } from "./space";
import { changedScreen, parseScreenSettings, type ScreenSettings } from "./screen-settings";
import { parseMessage, type ScreenMessage } from "./screen-message";

/** live-show/selection.json for the show; rehearsal/live-show/… for practice. */
function keyOf(space: Space): string {
  return `${storagePrefix(space)}live-show/selection.json`;
}

/**
 * One small JSON record under live-show/, on whichever driver holds content.
 * Null when it has never been written.
 */
export async function readRecord(key: string): Promise<unknown> {
  let bytes: string;
  if (driver === "github") {
    const result = await githubRead(requireGithub(), key);
    if (!result.bytes) return null;
    bytes = result.bytes.toString("utf8");
  } else if (driver === "blob") {
    const { get } = await import("@vercel/blob");
    const result = await get(key, { access: "private", useCache: false });
    if (!result) return null;
    if (result.statusCode !== 200) throw new Error(`${key} unavailable`);
    bytes = await new Response(result.stream).text();
  } else {
    try {
      bytes = await fs.readFile(path.join(process.cwd(), "data", key), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  return JSON.parse(bytes);
}

export async function writeRecord(key: string, value: unknown, message: string): Promise<void> {
  const json = JSON.stringify(value);
  if (driver === "github") {
    const config = requireGithub();
    const { sha } = await githubRead(config, key);
    await githubWrite(config, key, Buffer.from(json), message, sha);
  } else if (driver === "blob") {
    const { put } = await import("@vercel/blob");
    await put(key, json, {
      access: "private", contentType: "application/json", addRandomSuffix: false,
      allowOverwrite: true, cacheControlMaxAge: 0,
    });
  } else {
    const file = path.join(process.cwd(), "data", key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, json, "utf8");
      await fs.rename(temporary, file);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }
}

/** This separate, durable record survives deployments and serverless instances. */
export async function readLiveSelection(space: Space = "live"): Promise<LiveSelection | null> {
  return parseSelection(await readRecord(keyOf(space)));
}

export async function writeLiveSelection(selection: LiveSelection | null, space: Space = "live"): Promise<void> {
  await writeRecord(keyOf(space), selection, space === "rehearsal" ? "Update rehearsal screen" : "Update live show selection");
}

export async function clearLiveSelection(submissionId?: string, space: Space = "live"): Promise<void> {
  const current = await readLiveSelection(space);
  if (current && (!submissionId || current.submissionId === submissionId)) {
    await writeLiveSelection(null, space);
  }
}

/** live-show/menu.json: whether the drink menu is up, and its marquee. */
function menuKeyOf(space: Space): string {
  return `${storagePrefix(space)}live-show/menu.json`;
}

export async function readMenu(space: Space = "live"): Promise<MenuState> {
  return parseMenuState(await readRecord(menuKeyOf(space)));
}

/** Change one part of the menu record and keep the rest, so the marquee and the custom look outlive the menu going down. */
export async function writeMenu(change: Partial<MenuState>, space: Space = "live"): Promise<MenuState> {
  const next = parseMenuState({ ...(await readMenu(space)), ...change });
  const message = "marquee" in change ? "Update the drink menu marquee"
    : "color" in change || "headline" in change || "note" in change || "font" in change || "bartender" in change ? "Update the custom drink menu"
    : next.on ? `Put the ${next.style} drink menu on screen` : "Take the drink menu off screen";
  await writeRecord(menuKeyOf(space), next, message);
  return next;
}

/** live-show/explainer.json: when the host last started the "Intro" explainer. */
function explainerKeyOf(space: Space): string {
  return `${storagePrefix(space)}live-show/explainer.json`;
}

export async function readExplainer(space: Space = "live"): Promise<string | null> {
  return parseExplainer(await readRecord(explainerKeyOf(space)));
}

export async function startExplainer(space: Space = "live"): Promise<string> {
  const at = new Date().toISOString();
  await writeRecord(explainerKeyOf(space), { at }, "Play the Bad Decisions intro");
  return at;
}

/** live-show/segment.json: the performers' timed sets — names, questions, and when each ran. */
function segmentKeyOf(space: Space): string {
  return `${storagePrefix(space)}live-show/segment.json`;
}

export async function readLineup(space: Space = "live"): Promise<Lineup> {
  return parseLineup(await readRecord(segmentKeyOf(space)));
}

export async function writeLineup(lineup: Lineup, space: Space = "live"): Promise<void> {
  await writeRecord(segmentKeyOf(space), lineup, "Update the performer lineup");
}

/** live-show/screen.json: the host's settings for how the live screen behaves and what its fixed words say. */
function screenKeyOf(space: Space): string {
  return `${storagePrefix(space)}live-show/screen.json`;
}

export async function readScreen(space: Space = "live"): Promise<ScreenSettings> {
  return parseScreenSettings(await readRecord(screenKeyOf(space)));
}

/** Change some settings and keep the rest. Only what differs from the defaults is stored, and a save that changes nothing writes nothing. */
export async function writeScreen(change: Partial<ScreenSettings>, space: Space = "live"): Promise<ScreenSettings> {
  const current = await readScreen(space);
  const next = parseScreenSettings({ ...current, ...change });
  const stored = changedScreen(next);
  if (JSON.stringify(stored) !== JSON.stringify(changedScreen(current))) {
    await writeRecord(screenKeyOf(space), stored, "Update the live screen settings");
  }
  return next;
}

/** live-show/message.json: the host's own message, its colour, and whether it is up. */
function messageKeyOf(space: Space): string {
  return `${storagePrefix(space)}live-show/message.json`;
}

export async function readMessage(space: Space = "live"): Promise<ScreenMessage> {
  return parseMessage(await readRecord(messageKeyOf(space)));
}

export async function writeMessage(message: ScreenMessage, space: Space = "live"): Promise<void> {
  await writeRecord(messageKeyOf(space), message, message.on ? "Put a message on the live screen" : "Take the message off the live screen");
}

/** Take the message down, keeping its words for next time. Writes only when one is up. */
export async function clearMessage(space: Space = "live"): Promise<void> {
  const current = await readMessage(space);
  if (current.on) await writeMessage({ ...current, on: false }, space);
}

/** live-show/sound-test.json: when the host last pressed "Test sound". */
function soundTestKeyOf(space: Space): string {
  return `${storagePrefix(space)}live-show/sound-test.json`;
}

export async function readSoundTest(space: Space = "live"): Promise<string | null> {
  // The same one-shot shape as the explainer's record: { at }.
  return parseExplainer(await readRecord(soundTestKeyOf(space)));
}

export async function startSoundTest(space: Space = "live"): Promise<string> {
  const at = new Date().toISOString();
  await writeRecord(soundTestKeyOf(space), { at }, "Test the live screen's sound");
  return at;
}

/**
 * live-show/screen-build.json: the build the live screen last said it is
 * running, so the Control Center can tell the host when the TV is out of date
 * and could not reload itself (it was in full screen, say).
 */
function screenBuildKeyOf(space: Space): string {
  return `${storagePrefix(space)}live-show/screen-build.json`;
}

export async function readScreenBuild(space: Space = "live"): Promise<unknown> {
  return readRecord(screenBuildKeyOf(space));
}

/** How long a report stands before the same screen saying the same thing is written again. */
const SCREEN_BUILD_REWRITE_MS = 4 * 60_000;

/**
 * Note which build a live screen is running. A screen reports every few
 * minutes while it is out of date, and once more when it is up to date
 * again: a report the record already holds, made recently, writes nothing.
 */
export async function writeScreenBuild(build: string, space: Space = "live"): Promise<void> {
  const current = await readScreenBuild(space) as { build?: unknown; at?: unknown } | null;
  const at = typeof current?.at === "string" ? Date.parse(current.at) : NaN;
  if (current?.build === build && Date.now() - at < SCREEN_BUILD_REWRITE_MS) return;
  await writeRecord(screenBuildKeyOf(space), { build, at: new Date().toISOString() }, "Note the live screen's version");
}
