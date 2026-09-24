import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { driver, requireGithub } from "./store";
import { readFile as githubRead, writeFile as githubWrite } from "./github-store";
import { parseSelection, type LiveSelection } from "./live-selection";
import { storagePrefix, type Space } from "./space";

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
