import "server-only";
import { clearLiveSelection } from "./live-store";
import { promises as fs } from "node:fs";
import path from "node:path";
import { driver, requireGithub } from "./store";
import {
  deleteFile as githubDelete,
  listDir as githubList,
  readFile as githubRead,
  writeFile as githubWrite,
} from "./github-store";
import { countIdsSince, sortSubmissions, submissionId } from "./decisions";
import { mapWithLimit, planReads, pruneTo, type PileEntry } from "./pile";
import { storagePrefix, type Space } from "./space";
import type { Submission, SubmissionStatus } from "./types";

/**
 * Audience submissions for the weekly show.
 *
 * Each submission is its own file, never a line inside content.json. Forty
 * people scanning the same QR code during the bar hour means writes land
 * within milliseconds of each other, and a single shared file — even with a
 * retry on conflict — would lose some of them. A fresh file per submission
 * has nothing to conflict with, on every driver:
 *
 *  - "fs"     ./data/submissions/<id>.json
 *  - "github" submissions/<id>.json in the content repo (one commit each)
 *  - "blob"   submissions/<id>.json in the Blob store
 *
 * Ids start with the timestamp, so listings come back in order and the
 * admin can cap how many it reads.
 *
 * The dress rehearsal keeps its own pile under rehearsal/submissions/, so
 * practice never mixes with the real one. Every function here takes the
 * space last and defaults to the live show.
 */

function dirOf(space: Space): string {
  return `${storagePrefix(space)}submissions`;
}

function localDirOf(space: Space): string {
  return path.join(process.cwd(), "data", dirOf(space));
}

/** How many the admin reads at most. Archive after each show keeps this small. */
const LIST_LIMIT = 500;

/**
 * How many files to read at once.
 *
 * Not a throughput knob — a burst cap. Asking a host for hundreds of files
 * simultaneously is what trips burst protection, and GitHub answers that with
 * a 403 that reads like a bad token rather than a rate limit.
 */
const READ_CONCURRENCY = 6;

/** Writes are commits on the GitHub driver, so they go slower than reads. */
const WRITE_CONCURRENCY = 3;

/**
 * How many to archive in one request.
 *
 * Archiving is one write per submission, and on the GitHub driver each write
 * is a commit. A season's pile is more of those than fit in a serverless
 * function's time budget, so the work is handed back with a count of what is
 * left and the caller asks again — which matters most precisely when the pile
 * has grown, since archiving is the thing that shrinks it.
 */
const ARCHIVE_BATCH = 150;

/**
 * What a listing can return before it is quietly leaving files out: both the
 * GitHub contents API and a Blob listing stop at a thousand entries.
 */
const LISTING_CEILING = 1000;

/**
 * Submissions already read, against the store's own version token for each.
 *
 * The Tonight panel polls every fifteen seconds all night; without this, every
 * poll re-read every file. An entry is only reused when the listing still
 * reports the exact same content token, so a submission another instance drew
 * comes back changed and is re-read — the cache can go stale in memory but
 * never in an answer.
 */
const caches: Record<Space, Map<string, { version: string; submission: Submission }>> = {
  live: new Map(),
  rehearsal: new Map(),
};

function fileFor(id: string, space: Space): string {
  if (!/^[A-Za-z0-9-]+$/.test(id)) throw new Error("Bad submission id");
  return `${dirOf(space)}/${id}.json`;
}

async function write(submission: Submission, knownSha: string | null, space: Space): Promise<void> {
  const json = JSON.stringify(submission, null, 2);
  const key = fileFor(submission.id, space);

  if (driver === "github") {
    await githubWrite(
      requireGithub(),
      key,
      Buffer.from(json, "utf8"),
      knownSha ? `Update submission ${submission.id}` : `New submission ${submission.id}`,
      knownSha
    );
    return;
  }
  if (driver === "blob") {
    // Private: unlike content.json, these carry people's names and decisions.
    const { put } = await import("@vercel/blob");
    await put(key, json, {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
    return;
  }
  await fs.mkdir(localDirOf(space), { recursive: true });
  const target = path.join(localDirOf(space), `${submission.id}.json`);
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(tmp, json, "utf8");
  await fs.rename(tmp, target);
}

function parse(bytes: string | Buffer): Submission | null {
  try {
    const value = JSON.parse(bytes.toString()) as Partial<Submission>;
    if (!value || typeof value.id !== "string" || typeof value.decision !== "string") return null;
    return {
      id: value.id,
      decision: value.decision,
      name: typeof value.name === "string" ? value.name : "",
      createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
      status: value.status === "drawn" || value.status === "archived" ? value.status : "open",
      drawnAt: typeof value.drawnAt === "string" ? value.drawnAt : "",
    };
  } catch {
    return null;
  }
}

async function readOne(id: string, space: Space): Promise<{ submission: Submission | null; sha: string | null }> {
  const key = fileFor(id, space);
  if (driver === "github") {
    const { bytes, sha } = await githubRead(requireGithub(), key);
    return { submission: bytes ? parse(bytes) : null, sha };
  }
  if (driver === "blob") {
    const { get } = await import("@vercel/blob");
    const result = await get(key, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return { submission: null, sha: null };
    return { submission: parse(await new Response(result.stream).text()), sha: null };
  }
  try {
    return { submission: parse(await fs.readFile(path.join(localDirOf(space), `${id}.json`), "utf8")), sha: null };
  } catch {
    return { submission: null, sha: null };
  }
}

/** Read one id without exposing the rest of the pile. */
export async function getSubmission(id: string, space: Space = "live"): Promise<Submission | null> {
  return (await readOne(id, space)).submission;
}

export async function addSubmission(
  decision: string,
  name: string,
  space: Space = "live"
): Promise<Submission> {
  const now = new Date();
  const submission: Submission = {
    id: submissionId(now),
    decision,
    name,
    createdAt: now.toISOString(),
    status: "open",
    drawnAt: "",
  };
  await write(submission, null, space);
  return submission;
}

/**
 * Everything in the store, oldest first, each with a token that changes when
 * its file does — a content sha on GitHub, the upload time and size on Blob.
 * One listing call however big the pile is.
 *
 * The local driver reports no token: reading a file off the disk beside the
 * process costs nothing worth avoiding, and claiming a file had not changed
 * without the store saying so would be a guess.
 */
async function listEntries(space: Space): Promise<{ entries: PileEntry[]; truncated: boolean }> {
  const DIR = dirOf(space);
  let entries: PileEntry[] = [];

  if (driver === "github") {
    entries = (await githubList(requireGithub(), DIR))
      .filter((entry) => entry.name.endsWith(".json"))
      .map((entry) => ({ id: entry.name.slice(0, -5), version: entry.sha }));
  } else if (driver === "blob") {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: `${DIR}/`, limit: LISTING_CEILING });
    entries = blobs
      .filter((blob) => blob.pathname.endsWith(".json"))
      .map((blob) => ({
        id: blob.pathname.slice(DIR.length + 1, -5),
        version: `${new Date(blob.uploadedAt).getTime()}:${blob.size}`,
      }));
  } else {
    try {
      entries = (await fs.readdir(localDirOf(space)))
        .filter((name) => name.endsWith(".json"))
        .map((name) => ({ id: name.slice(0, -5), version: "" }));
    } catch {
      entries = [];
    }
  }

  entries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { entries, truncated: entries.length >= LISTING_CEILING };
}

/**
 * The ids in the store, oldest first. One directory listing and nothing else.
 */
export async function listSubmissionIds(space: Space = "live"): Promise<string[]> {
  return (await listEntries(space)).entries.map((entry) => entry.id);
}

/**
 * The pile the admin reads: newest first, capped at LIST_LIMIT, and whether
 * the store had more to say than it could list.
 *
 * Only files the listing reports as changed are actually read, so a night of
 * polling costs one call plus whatever genuinely moved. Pass `fresh` to skip
 * that and read everything — the draw does, because picking from a pile that
 * is even slightly behind could hand the host a submission already read out.
 */
async function load(entries: PileEntry[], fresh: boolean, space: Space): Promise<Submission[]> {
  const loaded = caches[space];
  const plan = planReads(entries, (id) => (fresh ? undefined : loaded.get(id)?.version));
  const versions = new Map(entries.map((entry) => [entry.id, entry.version]));

  const fetched = await mapWithLimit(plan.read, READ_CONCURRENCY, async (id) => {
    const { submission } = await readOne(id, space);
    const version = versions.get(id) || "";
    // Remembered only when the store can tell us later that it changed.
    if (submission && version) loaded.set(id, { version, submission });
    else loaded.delete(id);
    return submission;
  });

  return [...plan.reuse.map((id) => loaded.get(id)?.submission), ...fetched].filter(
    (entry): entry is Submission => Boolean(entry)
  );
}

export async function listPile(
  options: { fresh?: boolean } = {},
  space: Space = "live"
): Promise<{ submissions: Submission[]; truncated: boolean }> {
  const { entries, truncated } = await listEntries(space);
  // Newest ids sort last; keep the most recent LIST_LIMIT.
  const submissions = await load(entries.slice(-LIST_LIMIT), Boolean(options.fresh), space);

  pruneTo(caches[space], entries);
  return { submissions: sortSubmissions(submissions), truncated: truncated || entries.length > LIST_LIMIT };
}

/** Every stored submission, newest first, capped at LIST_LIMIT. */
export async function listSubmissions(
  options: { fresh?: boolean } = {},
  space: Space = "live"
): Promise<Submission[]> {
  return (await listPile(options, space)).submissions;
}

/**
 * How many have come in since `since` — the number the public page shows.
 *
 * Deliberately built from the listing alone: the ids carry their own
 * timestamps, so counting tonight's pile costs one call rather than one call
 * per submission. The admin, which needs the actual text, still reads
 * everything — it is one person, once a night, not a room full of phones.
 */
export async function countSince(since: Date | null, space: Space = "live"): Promise<number> {
  return countIdsSince(await listSubmissionIds(space), since);
}

export async function setStatus(
  id: string,
  status: SubmissionStatus,
  space: Space = "live"
): Promise<Submission | null> {
  const { submission, sha } = await readOne(id, space);
  if (!submission) return null;
  return writeStatus(submission, status, sha, space);
}

async function writeStatus(
  submission: Submission,
  status: SubmissionStatus,
  sha: string | null,
  space: Space
): Promise<Submission> {
  const next: Submission = {
    ...submission,
    status,
    drawnAt: status === "drawn" ? new Date().toISOString() : submission.drawnAt,
  };
  // Drop it before the write: what is in memory is about to be a version behind.
  caches[space].delete(submission.id);
  await write(next, sha, space);
  return next;
}

export async function deleteSubmission(id: string, space: Space = "live"): Promise<void> {
  const key = fileFor(id, space);
  await clearLiveSelection(id, space);
  caches[space].delete(id);
  if (driver === "github") {
    await githubDelete(requireGithub(), key, `Delete submission ${id}`);
    return;
  }
  if (driver === "blob") {
    const { del } = await import("@vercel/blob");
    await del(key);
    return;
  }
  await fs.rm(path.join(localDirOf(space), `${id}.json`), { force: true });
}

/**
 * Wipes the rehearsal: every practice question and its projector. Only ever
 * touches the rehearsal space, so the live pile cannot be reached from here.
 */
export async function clearRehearsal(): Promise<number> {
  await clearLiveSelection(undefined, "rehearsal");
  const { entries } = await listEntries("rehearsal");
  // One at a time: on GitHub each delete is a commit, and parallel commits to
  // one branch conflict.
  for (const entry of entries) await deleteSubmission(entry.id, "rehearsal");
  return entries.length;
}

/**
 * After a show: everything open or drawn becomes archived, so next week starts
 * from zero.
 *
 * Looks at the whole store rather than the newest LIST_LIMIT — this is the
 * thing that keeps the pile small, so what it can see must not itself be
 * capped; it used to stop at 500 and quietly leave the rest live. The listing
 * has already told us each file's sha, so each one is a single write instead
 * of a read and a write, and they go out a few at a time.
 *
 * Returns how many are still waiting: one call archives at most ARCHIVE_BATCH,
 * because sequential round trips over a season's pile ran past the function's
 * own time limit.
 */
export async function archiveAll(limit = ARCHIVE_BATCH): Promise<{ archived: number; remaining: number }> {
  await clearLiveSelection();
  const { entries } = await listEntries("live");
  const shas = new Map(entries.map((entry) => [entry.id, entry.version]));
  const live = (await load(entries, false, "live")).filter(
    (submission) => submission.status !== "archived"
  );

  const batch = live.slice(0, Math.max(1, limit));
  await mapWithLimit(batch, WRITE_CONCURRENCY, (submission) =>
    // On GitHub the version is the blob sha the write needs; elsewhere it is
    // not, and the driver ignores it.
    writeStatus(submission, "archived", driver === "github" ? shas.get(submission.id) ?? null : null, "live")
  );

  return { archived: batch.length, remaining: live.length - batch.length };
}
