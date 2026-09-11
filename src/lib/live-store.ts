import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { driver, requireGithub } from "./store";
import { readFile as githubRead, writeFile as githubWrite } from "./github-store";
import { parseSelection, type LiveSelection } from "./live-selection";

const KEY = "live-show/selection.json";
const FILE = path.join(process.cwd(), "data", KEY);

/** This separate, durable record survives deployments and serverless instances. */
export async function readLiveSelection(): Promise<LiveSelection | null> {
  let bytes: string;
  if (driver === "github") {
    const result = await githubRead(requireGithub(), KEY);
    if (!result.bytes) return null;
    bytes = result.bytes.toString("utf8");
  } else if (driver === "blob") {
    const { get } = await import("@vercel/blob");
    const result = await get(KEY, { access: "private", useCache: false });
    if (!result) return null;
    if (result.statusCode !== 200) throw new Error("Live selection unavailable");
    bytes = await new Response(result.stream).text();
  } else {
    try {
      bytes = await fs.readFile(FILE, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  return parseSelection(JSON.parse(bytes));
}

export async function writeLiveSelection(selection: LiveSelection | null): Promise<void> {
  const json = JSON.stringify(selection);
  if (driver === "github") {
    const config = requireGithub();
    const { sha } = await githubRead(config, KEY);
    await githubWrite(config, KEY, Buffer.from(json), "Update live show selection", sha);
  } else if (driver === "blob") {
    const { put } = await import("@vercel/blob");
    await put(KEY, json, {
      access: "private", contentType: "application/json", addRandomSuffix: false,
      allowOverwrite: true, cacheControlMaxAge: 0,
    });
  } else {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    const temporary = `${FILE}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, json, "utf8");
      await fs.rename(temporary, FILE);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }
}

export async function clearLiveSelection(submissionId?: string): Promise<void> {
  const current = await readLiveSelection();
  if (current && (!submissionId || current.submissionId === submissionId)) {
    await writeLiveSelection(null);
  }
}
