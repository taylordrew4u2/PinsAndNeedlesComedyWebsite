import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { defaultContent } from "./defaults";
import { merge } from "./merge";
import { upgradeBrandCopy } from "./brand-copy";
import { healAssetPaths } from "./assets";
import {
  checkAccess as githubCheckAccess,
  githubConfig,
  mediaUrl,
  readFile as githubRead,
  writeFile as githubWrite,
} from "./github-store";
import type { Content } from "./types";

/**
 * Content storage.
 *
 * Three drivers, all free:
 *  - "fs"     (default) writes ./data/content.json and ./public/uploads/*.
 *             Works locally, in a Codespace, in Docker, or on any VPS, but
 *             not on Vercel, where the filesystem is read-only.
 *  - "github" keeps content.json and every upload in a private GitHub repo,
 *             writing through the Contents API. Free with no card and no new
 *             account, and every save is a commit you can read back. Turns on
 *             automatically when CONTENT_GITHUB_TOKEN and CONTENT_GITHUB_REPO
 *             are both present.
 *  - "blob"   uses Vercel Blob. Turns on automatically when
 *             BLOB_READ_WRITE_TOKEN is present.
 *
 * When more than one is configured, CONTENT_DRIVER decides; otherwise GitHub
 * wins over Blob, since configuring it is the deliberate act.
 */
export type Driver = "fs" | "blob" | "github";

const github = githubConfig(process.env);

export const driver: Driver =
  (process.env.CONTENT_DRIVER as Driver | undefined) ??
  (github ? "github" : process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "fs");

const DATA_DIR = path.join(process.cwd(), "data");
const CONTENT_FILE = path.join(DATA_DIR, "content.json");
const BLOB_KEY = "content/content.json";
const GITHUB_CONTENT_PATH = "content/content.json";

/** Blob sha of the content file as last read, so writes are not blind. */
let githubSha: string | null = null;

export function requireGithub() {
  if (!github) {
    throw new Error(
      "The GitHub content store is selected but CONTENT_GITHUB_TOKEN / CONTENT_GITHUB_REPO are not set."
    );
  }
  return github;
}

/**
 * Fill in fields that were added to list items after content was first saved,
 * and repoint any asset path that has since become an SVG.
 *
 * merge() handles new top-level and nested object keys, but arrays replace
 * wholesale, so a Show saved before `series` existed comes back without it —
 * and a cover image saved before the artwork was traced still points at a
 * .webp that is no longer in the repository.
 */
function normalize(content: Content): Content {
  const healed = healAssetPaths(upgradeBrandCopy(content, defaultContent));
  return {
    ...healed,
    shows: healed.shows.map((show) => ({ ...show, series: show.series ?? "" })),
  };
}

/** Short-lived cache so one page render does not re-read storage per section. */
let cache: { value: Content; at: number } | null = null;
const TTL_MS = driver === "blob" ? 3_000 : 500;

async function readRaw(): Promise<unknown> {
  if (driver === "github") {
    const { bytes, sha } = await githubRead(requireGithub(), GITHUB_CONTENT_PATH);
    githubSha = sha;
    if (!bytes || bytes.length === 0) return null;
    return JSON.parse(bytes.toString("utf8"));
  }
  if (driver === "blob") {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: BLOB_KEY, limit: 1 });
    const entry = blobs.find((b) => b.pathname === BLOB_KEY);
    if (!entry) return null;
    const res = await fetch(entry.url, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  }
  try {
    return JSON.parse(await fs.readFile(CONTENT_FILE, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Load content, reporting whether storage was actually readable.
 *
 * The distinction matters: "nothing stored yet" is a fresh site and the
 * defaults are the right answer, but "the read blew up" means we do not know
 * what is stored — and writing on top of that guess would destroy it.
 */
async function load(): Promise<{ value: Content; readable: boolean }> {
  if (cache && Date.now() - cache.at < TTL_MS) return { value: cache.value, readable: true };

  let stored: unknown = null;
  try {
    stored = await readRaw();
  } catch (error) {
    console.error("[store] read failed, serving defaults for this request:", error);
    // Deliberately not cached: a transient failure must not pin the defaults
    // in front of real content for the whole TTL.
    return { value: defaultContent, readable: false };
  }

  const value = normalize(stored ? merge(defaultContent, stored) : defaultContent);
  cache = { value, at: Date.now() };
  return { value, readable: true };
}

export async function getContent(): Promise<Content> {
  return (await load()).value;
}

/**
 * Same as getContent(), but throws instead of silently falling back to the
 * defaults when storage cannot actually be read. Anything that is about to
 * write a full snapshot on top of "current content" — like the Instagram
 * sync route — must start from this, not getContent(): reading the defaults
 * during a transient storage hiccup and saving on top of them would wipe
 * every real field on the site.
 */
export async function getContentStrict(): Promise<Content> {
  const { value, readable } = await load();
  if (!readable) throw new Error("Storage is not readable right now");
  return value;
}

export async function saveContent(next: Content): Promise<Content> {
  const value: Content = { ...next, updatedAt: new Date().toISOString() };
  const json = JSON.stringify(value, null, 2);

  if (driver === "github") {
    githubSha = await githubWrite(
      requireGithub(),
      GITHUB_CONTENT_PATH,
      Buffer.from(json, "utf8"),
      `Update site content ${value.updatedAt}`,
      githubSha
    );
  } else if (driver === "blob") {
    const { put } = await import("@vercel/blob");
    await put(BLOB_KEY, json, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
  } else {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${CONTENT_FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmp, json, "utf8");
    await fs.rename(tmp, CONTENT_FILE); // atomic: never leaves a half-written file
  }

  cache = { value, at: Date.now() };
  return value;
}

/** Apply a partial patch on top of what is stored. Used by the auto-saving admin. */
export async function patchContent(patch: unknown): Promise<Content> {
  const { value, readable } = await load();
  if (!readable) {
    // Merging onto the defaults here would write them over whatever is really
    // stored. Fail instead; the admin surfaces it and retries.
    throw new Error("Refusing to save: existing content could not be read");
  }
  return saveContent(merge(value, patch));
}

/** Store an uploaded file and return its public URL. */
export async function saveUpload(
  filename: string,
  bytes: Buffer,
  contentType: string
): Promise<string> {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80) || "upload";
  const key = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${safe}`;

  if (driver === "github") {
    await githubWrite(
      requireGithub(),
      `uploads/${key}`,
      bytes,
      `Upload ${safe}`,
      null
    );
    return mediaUrl(key);
  }

  if (driver === "blob") {
    const { put } = await import("@vercel/blob");
    const result = await put(`uploads/${key}`, bytes, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    return result.url;
  }

  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, key), bytes);
  return `/uploads/${key}`;
}

/**
 * A message to show in the admin when saving cannot work, or null when it can.
 *
 * Two different failures look identical from the admin — a deployment with no
 * storage configured at all, and one whose storage is configured but not
 * answering — and both show the site's defaults while silently discarding
 * edits. So this reports on what actually happened on a real read rather than
 * on configuration alone.
 */
export async function storageWarning(): Promise<string | null> {
  if (driver === "fs" && process.env.VERCEL) {
    return "This deployment has no content store, so nothing you change here will save. Set CONTENT_GITHUB_TOKEN and CONTENT_GITHUB_REPO in the Vercel project settings (see the README), or add a Vercel Blob store, then redeploy.";
  }

  const { value, readable } = await load();

  // A GitHub 404 reads as "nothing saved yet", which is right for a fresh
  // repo and wrong for a misconfigured one — and both would otherwise sit
  // here silently while every save failed. Ask the repo directly.
  if (driver === "github" && readable && value.updatedAt === defaultContent.updatedAt) {
    try {
      const problem = await githubCheckAccess(requireGithub());
      if (problem) return `Saving will not work yet. ${problem}`;
    } catch (error) {
      console.error("[store] GitHub access check failed:", error);
    }
  }

  if (!readable) {
    const where =
      driver === "github"
        ? `the GitHub repo ${github?.owner}/${github?.repo}`
        : driver === "blob"
          ? "the Vercel Blob store"
          : "local storage";
    return `Saving is turned off because ${where} could not be read. The site is showing its built-in defaults right now — nothing you have saved before is lost, but nothing new can be saved until that store answers again. Check the credentials for it in the Vercel project settings, then redeploy.`;
  }

  return null;
}
