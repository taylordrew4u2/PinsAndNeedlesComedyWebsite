import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { driver, requireGithub } from "./store";
import { createFile as githubCreate, readFile as githubRead, writeFile as githubWrite } from "./github-store";
import { parseSelection, type LiveSelection } from "./live-selection";
import { parseMenuState, type MenuState } from "./drink-menu";
import { parseDrinkList, type DrinkList } from "./drink-list";
import { parseExplainer } from "./explainer";
import { parseLineup, type Lineup } from "./segment";
import { storagePrefix, type Space } from "./space";

/** live-show/selection.json for the show; rehearsal/live-show/… for practice. */
function keyOf(space: Space): string {
  return `${storagePrefix(space)}live-show/selection.json`;
}

/** A record's stored JSON, or undefined when it has never been written. */
async function readStored(key: string): Promise<unknown> {
  let bytes: string;
  if (driver === "github") {
    const result = await githubRead(requireGithub(), key);
    if (!result.bytes) return undefined;
    bytes = result.bytes.toString("utf8");
  } else if (driver === "blob") {
    const { get } = await import("@vercel/blob");
    const result = await get(key, { access: "private", useCache: false });
    if (!result) return undefined;
    if (result.statusCode !== 200) throw new Error(`${key} unavailable`);
    bytes = await new Response(result.stream).text();
  } else {
    try {
      bytes = await fs.readFile(path.join(process.cwd(), "data", key), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }
  return JSON.parse(bytes);
}

/**
 * One small JSON record under live-show/, on whichever driver holds content.
 * Null when it has never been written.
 */
export async function readRecord(key: string): Promise<unknown> {
  return (await readStored(key)) ?? null;
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
  const message = "marquee" in change || "marqueeOn" in change ? "Update the drink menu marquee"
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

/** live-show/drinks.json: the host's drink list, shared by both menus. Never written (or null) is the printed menu. */
function drinksKeyOf(space: Space): string {
  return `${storagePrefix(space)}live-show/drinks.json`;
}

/** Drinks records this server has already tried to put in place, so a write that fails is not retried on every poll. */
const placed = new Set<string>();

/**
 * Never saving the list is the normal case, but on GitHub reading a file
 * that is not there is never free: a 404 carries no ETag, so it cannot get
 * the free "not modified" answer, and the Control Center, the projector and
 * its mirror would each spend counted requests on it every few seconds. So
 * the first read that finds it missing saves `null` (the printed menu) in its
 * place, and from then on polls are answered 304. Create-only: a list the
 * host saved in the same moment is kept, not written over.
 */
export async function readDrinks(space: Space = "live"): Promise<DrinkList | null> {
  const key = drinksKeyOf(space);
  const stored = await readStored(key);
  if (stored === undefined && driver === "github" && !placed.has(key)) {
    placed.add(key);
    // The read still answers if this fails; another server tries again.
    await githubCreate(requireGithub(), key, Buffer.from("null"), "Start the drink list at the printed menu")
      .catch((error) => console.error("[live-store] drink list placeholder failed", error));
  }
  return parseDrinkList(stored ?? null);
}

/** Null puts the printed menu back. */
export async function writeDrinks(list: DrinkList | null, space: Space = "live"): Promise<void> {
  await writeRecord(drinksKeyOf(space), list, list ? "Update the drink list" : "Put the printed drink list back");
}
