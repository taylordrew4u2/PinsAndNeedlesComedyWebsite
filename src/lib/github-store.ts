/**
 * GitHub as a content store.
 *
 * A free alternative to Vercel Blob that needs no card and no new account:
 * the site keeps content.json and every uploaded file in a small GitHub
 * repository, written through the Contents API. Saving becomes a commit, so
 * the edit history is a real history — a bad change can be read back out of
 * the repo.
 *
 * Two things this design has to get right:
 *
 * 1. The repo must be SEPARATE from the repo the site deploys from. Writing
 *    to the deploy repo would kick off a new build on every autosave.
 * 2. The repo should be PRIVATE, because content.json carries the Instagram
 *    access token. That rules out serving uploads straight from
 *    raw.githubusercontent.com, so uploads are served through the site's own
 *    /api/media route instead — see mediaUrl() below.
 */

export type GithubConfig = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  /** Base API URL. Only differs for GitHub Enterprise. */
  api: string;
};

const DEFAULT_API = "https://api.github.com";

/** Read the driver's configuration out of the environment. Null if unset. */
export function githubConfig(env: Record<string, string | undefined>): GithubConfig | null {
  const token = env.CONTENT_GITHUB_TOKEN?.trim();
  const slug = env.CONTENT_GITHUB_REPO?.trim();
  if (!token || !slug) return null;

  const [owner, repo] = slug.replace(/^https?:\/\/github\.com\//i, "").split("/");
  if (!owner || !repo) return null;

  return {
    token,
    owner,
    repo: repo.replace(/\.git$/, ""),
    branch: env.CONTENT_GITHUB_BRANCH?.trim() || "main",
    api: (env.CONTENT_GITHUB_API?.trim() || DEFAULT_API).replace(/\/+$/, ""),
  };
}

function headers(config: GithubConfig, accept: string) {
  return {
    Authorization: `Bearer ${config.token}`,
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "pins-and-needles-site",
  };
}

/**
 * Reads ask GitHub whether a file changed since the last read, and reuse
 * what they already have when it did not.
 *
 * During a show the projector, Run Show and every phone on the QR page all
 * poll, and together they come close to GitHub's 5,000-requests-an-hour
 * limit — past it, reads fail and the projector goes blank. A 304 "not
 * modified" answer does not count against that limit, and almost every poll
 * gets one. The answer is never stale: GitHub compares the ETag itself.
 */
const MAX_REMEMBERED = 2000;
/** Uploads go through here too; big images are re-read rather than held. */
const MAX_REMEMBERED_BYTES = 48 * 1024 * 1024;
const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
const remembered = new Map<string, { etag: string; value: unknown; size: number }>();
let rememberedBytes = 0;

function etagOf(response: Response): string {
  return (typeof response.headers?.get === "function" && response.headers.get("etag")) || "";
}

/** The request headers, asking "only if changed" when a copy is on hand. */
function conditional(config: GithubConfig, accept: string, key: string) {
  const known = remembered.get(key);
  return known ? { ...headers(config, accept), "If-None-Match": known.etag } : headers(config, accept);
}

function forget(key: string): void {
  const known = remembered.get(key);
  if (!known) return;
  rememberedBytes -= known.size;
  remembered.delete(key);
}

function remember(key: string, response: Response, value: unknown, size: number): void {
  forget(key);
  const etag = etagOf(response);
  if (!etag || size > MAX_ENTRY_BYTES) return;
  remembered.set(key, { etag, value, size });
  rememberedBytes += size;
  // Oldest first out, so a long night cannot grow this without bound.
  while (remembered.size > MAX_REMEMBERED || rememberedBytes > MAX_REMEMBERED_BYTES) {
    forget(remembered.keys().next().value as string);
  }
}

/** What a 304 means: the copy from the last read. Throws if there is none. */
function unchanged<T>(key: string): T {
  const known = remembered.get(key);
  if (!known) throw new Error("GitHub said not modified, but nothing was cached");
  return known.value as T;
}

/** Forget every remembered read. For tests. */
export function forgetReads(): void {
  remembered.clear();
  rememberedBytes = 0;
}

/** Reject anything that could climb out of the repo path we own. */
export function safePath(path: string): string {
  const clean = path
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");
  if (!clean) throw new Error("Empty storage path");
  return clean;
}

/**
 * The same path, safe to drop into a request URL.
 *
 * safePath keeps a caller inside the directory we own, but says nothing about
 * characters that mean something in a URL: a "?" or "#" in a filename would
 * otherwise start the query or the fragment early and change which ref the
 * request asks for. Segments are encoded one at a time so the separators
 * between them survive.
 */
export function urlPath(path: string): string {
  return safePath(path).split("/").map(encodeURIComponent).join("/");
}

export type Fetcher = typeof fetch;

/**
 * Read one file. Returns null content when the file does not exist yet,
 * which is the "fresh site" case rather than an error.
 *
 * The Contents API stops inlining content above 1MB, and content.json grows
 * past that as posts and shows pile up, so anything without inline content
 * is fetched a second time through the blobs API (good to 100MB).
 */
export async function readFile(
  config: GithubConfig,
  path: string,
  fetchImpl: Fetcher = fetch
): Promise<{ bytes: Buffer | null; sha: string | null }> {
  const url = `${config.api}/repos/${config.owner}/${config.repo}/contents/${urlPath(path)}?ref=${encodeURIComponent(config.branch)}`;
  const accept = "application/vnd.github.object+json";
  const key = `${accept} ${url}`;
  const response = await fetchImpl(url, {
    headers: conditional(config, accept, key),
    cache: "no-store",
  });

  if (response.status === 304) return unchanged(key);
  if (response.status === 404) {
    forget(key);
    return { bytes: null, sha: null };
  }
  if (!response.ok) {
    throw new Error(`GitHub read failed (${response.status}): ${await response.text()}`);
  }

  const meta = (await response.json()) as { content?: string; sha?: string; size?: number };
  const sha = meta.sha ?? null;

  if (meta.content) {
    const result = { bytes: Buffer.from(meta.content, "base64"), sha };
    remember(key, response, result, result.bytes.length);
    return result;
  }
  if (!sha || !meta.size) {
    const result = { bytes: Buffer.alloc(0), sha };
    remember(key, response, result, 0);
    return result;
  }

  const blob = await fetchImpl(`${config.api}/repos/${config.owner}/${config.repo}/git/blobs/${sha}`, {
    headers: headers(config, "application/vnd.github.raw"),
    cache: "no-store",
  });
  if (!blob.ok) {
    throw new Error(`GitHub blob read failed (${blob.status}): ${await blob.text()}`);
  }
  const result = { bytes: Buffer.from(await blob.arrayBuffer()), sha };
  remember(key, response, result, result.bytes.length);
  return result;
}

/**
 * Write one file, creating or updating it.
 *
 * GitHub rejects an update carrying a stale blob sha, which is exactly what
 * a second save landing during the first one looks like. That is a normal
 * race for an admin that autosaves, so a conflict re-reads the current sha
 * and tries once more rather than surfacing an error.
 */
export async function writeFile(
  config: GithubConfig,
  path: string,
  bytes: Buffer,
  message: string,
  knownSha: string | null,
  fetchImpl: Fetcher = fetch
): Promise<string> {
  const clean = safePath(path);
  const url = `${config.api}/repos/${config.owner}/${config.repo}/contents/${urlPath(clean)}`;

  const put = async (sha: string | null) => {
    const response = await fetchImpl(url, {
      method: "PUT",
      headers: { ...headers(config, "application/vnd.github+json"), "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        content: bytes.toString("base64"),
        branch: config.branch,
        ...(sha ? { sha } : {}),
      }),
    });
    return response;
  };

  let response = await put(knownSha);

  if (response.status === 409 || response.status === 422) {
    const current = await readFile(config, clean, fetchImpl);
    response = await put(current.sha);
  }

  if (!response.ok) {
    throw new Error(`GitHub write failed (${response.status}): ${await response.text()}`);
  }

  const body = (await response.json()) as { content?: { sha?: string } };
  return body.content?.sha ?? "";
}

/**
 * List the files directly inside one directory. An empty list when the
 * directory does not exist yet — a fresh site has no submissions folder.
 */
export async function listDir(
  config: GithubConfig,
  path: string,
  fetchImpl: Fetcher = fetch
): Promise<{ name: string; path: string; sha: string }[]> {
  const url = `${config.api}/repos/${config.owner}/${config.repo}/contents/${urlPath(path)}?ref=${encodeURIComponent(config.branch)}`;
  const accept = "application/vnd.github+json";
  const key = `${accept} ${url}`;
  const response = await fetchImpl(url, {
    headers: conditional(config, accept, key),
    cache: "no-store",
  });
  if (response.status === 304) return unchanged(key);
  if (response.status === 404) {
    forget(key);
    return [];
  }
  if (!response.ok) {
    throw new Error(`GitHub list failed (${response.status}): ${await response.text()}`);
  }
  const entries = (await response.json()) as { name: string; path: string; sha: string; type: string }[];
  const files = Array.isArray(entries)
    ? entries.filter((entry) => entry.type === "file").map(({ name, path, sha }) => ({ name, path, sha }))
    : [];
  remember(key, response, files, files.length * 160);
  return files;
}

/** Remove one file. Deleting something already gone is not an error. */
export async function deleteFile(
  config: GithubConfig,
  path: string,
  message: string,
  fetchImpl: Fetcher = fetch
): Promise<void> {
  const clean = safePath(path);
  const current = await readFile(config, clean, fetchImpl);
  if (!current.sha) return;
  const response = await fetchImpl(`${config.api}/repos/${config.owner}/${config.repo}/contents/${urlPath(clean)}`, {
    method: "DELETE",
    headers: { ...headers(config, "application/vnd.github+json"), "Content-Type": "application/json" },
    body: JSON.stringify({ message, sha: current.sha, branch: config.branch }),
  });
  if (response.status === 404) return;
  if (!response.ok) {
    throw new Error(`GitHub delete failed (${response.status}): ${await response.text()}`);
  }
}

/**
 * Public URL for an upload. It points at this site rather than at GitHub so
 * a private content repo still works; /api/media streams the bytes back and
 * marks them immutable, so the CDN serves them after the first hit.
 */
export function mediaUrl(key: string): string {
  return `/api/media/${key.split("/").map(encodeURIComponent).join("/")}`;
}

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  json: "application/json",
};

export function contentTypeFor(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

/**
 * Check that the configured repo and branch are actually usable.
 *
 * A 404 when reading content.json is ambiguous on its own: it means "nothing
 * saved here yet" for a working setup and "wrong repo, or a token that cannot
 * see it" for a broken one. Both then look like a fresh site while every save
 * fails. This asks the repo and the branch directly so the two can be told
 * apart, and returns a sentence naming the fix, or null when all is well.
 */
export async function checkAccess(
  config: GithubConfig,
  fetchImpl: Fetcher = fetch
): Promise<string | null> {
  const repo = await fetchImpl(`${config.api}/repos/${config.owner}/${config.repo}`, {
    headers: headers(config, "application/vnd.github+json"),
    cache: "no-store",
  });

  const where = `${config.owner}/${config.repo}`;

  if (repo.status === 401) {
    return `The GitHub token is not valid (401). Generate a new fine-grained token for ${where} with Contents: Read and write, update CONTENT_GITHUB_TOKEN, and redeploy.`;
  }
  if (repo.status === 404) {
    return `The repo ${where} could not be found with this token (404). Either CONTENT_GITHUB_REPO has the wrong owner/name, or the token was not granted access to that repository.`;
  }
  if (repo.status === 403) {
    return `The GitHub token is not allowed to use ${where} (403). Check that it lists that repository and has Contents: Read and write.`;
  }
  if (!repo.ok) {
    return `GitHub returned ${repo.status} for ${where}.`;
  }

  const info = (await repo.json()) as { permissions?: { push?: boolean }; default_branch?: string };
  if (info.permissions && info.permissions.push === false) {
    return `The GitHub token can read ${where} but not write to it. Edit the token's permissions so Contents is "Read and write", then redeploy.`;
  }

  const branch = await fetchImpl(
    `${config.api}/repos/${config.owner}/${config.repo}/branches/${encodeURIComponent(config.branch)}`,
    { headers: headers(config, "application/vnd.github+json"), cache: "no-store" }
  );

  if (branch.status === 404) {
    const suggestion = info.default_branch
      ? ` Its default branch is "${info.default_branch}" — either set CONTENT_GITHUB_BRANCH to that, or leave it unset if that is "main".`
      : " The repository has no commits yet: open it on github.com and add a README so a first branch exists.";
    return `The branch "${config.branch}" does not exist in ${where}.${suggestion}`;
  }
  if (!branch.ok) {
    return `GitHub returned ${branch.status} for the branch "${config.branch}" in ${where}.`;
  }

  return null;
}
