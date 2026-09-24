import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkAccess,
  contentTypeFor,
  forgetReads,
  githubConfig,
  listDir,
  mediaUrl,
  readFile,
  safePath,
  urlPath,
  writeFile,
} from "../src/lib/github-store.ts";

const config = { token: "t", owner: "o", repo: "r", branch: "main", api: "https://api.github.com" };

/** A stand-in for GitHub: records calls and replays queued responses. */
function fakeGithub(responses: { status: number; body: unknown; raw?: Buffer }[]) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  let index = 0;
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const next = responses[Math.min(index++, responses.length - 1)];
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.body,
      text: async () => JSON.stringify(next.body),
      arrayBuffer: async () => (next.raw ?? Buffer.alloc(0)),
    };
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

test("githubConfig needs both a token and a repo", () => {
  assert.equal(githubConfig({}), null);
  assert.equal(githubConfig({ CONTENT_GITHUB_TOKEN: "t" }), null);
  assert.equal(githubConfig({ CONTENT_GITHUB_REPO: "o/r" }), null);
});

test("githubConfig parses owner/repo and defaults the branch", () => {
  assert.deepEqual(githubConfig({ CONTENT_GITHUB_TOKEN: "t", CONTENT_GITHUB_REPO: "o/r" }), {
    token: "t",
    owner: "o",
    repo: "r",
    branch: "main",
    api: "https://api.github.com",
  });
});

test("githubConfig accepts a pasted GitHub URL and a .git suffix", () => {
  assert.deepEqual(
    githubConfig({
      CONTENT_GITHUB_TOKEN: "t",
      CONTENT_GITHUB_REPO: "https://github.com/taylordrew4u2/site-content.git",
      CONTENT_GITHUB_BRANCH: "content",
    }),
    {
      token: "t",
      owner: "taylordrew4u2",
      repo: "site-content",
      branch: "content",
      api: "https://api.github.com",
    }
  );
});

test("safePath strips anything that climbs out of the repo", () => {
  assert.equal(safePath("uploads/photo.png"), "uploads/photo.png");
  assert.equal(safePath("uploads/../../etc/passwd"), "uploads/etc/passwd");
  assert.equal(safePath("./uploads//a.png"), "uploads/a.png");
  assert.throws(() => safePath("../.."), /Empty storage path/);
});

test("a missing file reads as empty rather than as an error", async () => {
  const { fetchImpl } = fakeGithub([{ status: 404, body: { message: "Not Found" } }]);
  assert.deepEqual(await readFile(config, "content/content.json", fetchImpl), {
    bytes: null,
    sha: null,
  });
});

test("a small file comes back from the inline base64", async () => {
  const { fetchImpl } = fakeGithub([
    { status: 200, body: { content: Buffer.from('{"a":1}').toString("base64"), sha: "abc", size: 7 } },
  ]);
  const { bytes, sha } = await readFile(config, "content/content.json", fetchImpl);
  assert.equal(bytes?.toString("utf8"), '{"a":1}');
  assert.equal(sha, "abc");
});

test("a file over 1MB falls through to the blobs API", async () => {
  // GitHub stops inlining content above 1MB and returns metadata only, which
  // is exactly what content.json does once enough posts and shows pile up.
  const big = Buffer.from('{"big":true}');
  const { fetchImpl, calls } = fakeGithub([
    { status: 200, body: { content: "", sha: "deadbeef", size: 2_000_000 } },
    { status: 200, body: {}, raw: big },
  ]);
  const { bytes } = await readFile(config, "content/content.json", fetchImpl);
  assert.equal(bytes?.toString("utf8"), '{"big":true}');
  assert.match(calls[1].url, /\/git\/blobs\/deadbeef$/);
});

test("a read failure that is not a 404 raises", async () => {
  const { fetchImpl } = fakeGithub([{ status: 401, body: { message: "Bad credentials" } }]);
  await assert.rejects(() => readFile(config, "content/content.json", fetchImpl), /401/);
});

test("writing sends the branch, the message and the sha it was given", async () => {
  const { fetchImpl, calls } = fakeGithub([{ status: 200, body: { content: { sha: "new" } } }]);
  const sha = await writeFile(config, "content/content.json", Buffer.from("hi"), "msg", "old", fetchImpl);
  assert.equal(sha, "new");
  assert.equal(calls[0].method, "PUT");
  assert.deepEqual(calls[0].body, {
    message: "msg",
    content: Buffer.from("hi").toString("base64"),
    branch: "main",
    sha: "old",
  });
});

test("a first write sends no sha, so GitHub creates the file", async () => {
  const { fetchImpl, calls } = fakeGithub([{ status: 200, body: { content: { sha: "first" } } }]);
  await writeFile(config, "content/content.json", Buffer.from("hi"), "msg", null, fetchImpl);
  assert.equal("sha" in (calls[0].body as object), false);
});

test("a stale sha is re-read and the write retried once", async () => {
  // Two autosaves landing back to back is the normal case for an admin that
  // saves on its own, so a conflict has to resolve itself rather than surface.
  const { fetchImpl, calls } = fakeGithub([
    { status: 409, body: { message: "is at 111 but expected 222" } },
    { status: 200, body: { content: Buffer.from("{}").toString("base64"), sha: "fresh", size: 2 } },
    { status: 200, body: { content: { sha: "saved" } } },
  ]);
  const sha = await writeFile(config, "content/content.json", Buffer.from("hi"), "msg", "stale", fetchImpl);
  assert.equal(sha, "saved");
  assert.equal(calls.length, 3);
  assert.equal((calls[2].body as { sha: string }).sha, "fresh");
});

test("a write that keeps failing raises rather than reporting success", async () => {
  const { fetchImpl } = fakeGithub([
    { status: 422, body: { message: "conflict" } },
    { status: 200, body: { content: "", sha: "s", size: 0 } },
    { status: 403, body: { message: "Resource not accessible by personal access token" } },
  ]);
  await assert.rejects(
    () => writeFile(config, "content/content.json", Buffer.from("hi"), "msg", "x", fetchImpl),
    /403/
  );
});

test("uploads are served from this site, not from the private repo", () => {
  assert.equal(mediaUrl("abc-123-poster.png"), "/api/media/abc-123-poster.png");
});

test("content types cover what the uploader accepts", () => {
  assert.equal(contentTypeFor("a/b/c.webp"), "image/webp");
  assert.equal(contentTypeFor("clip.MP4"), "video/mp4");
  assert.equal(contentTypeFor("noextension"), "application/octet-stream");
});

test("checkAccess names a repo the token cannot see", async () => {
  // The failure that looks exactly like a healthy empty repo: reading
  // content.json 404s, so the site serves defaults and every save fails.
  const { fetchImpl } = fakeGithub([{ status: 404, body: { message: "Not Found" } }]);
  const problem = await checkAccess(config, fetchImpl);
  assert.match(problem ?? "", /could not be found with this token/);
  assert.match(problem ?? "", /o\/r/);
});

test("checkAccess names a bad or expired token", async () => {
  const { fetchImpl } = fakeGithub([{ status: 401, body: { message: "Bad credentials" } }]);
  assert.match((await checkAccess(config, fetchImpl)) ?? "", /not valid \(401\)/);
});

test("checkAccess catches a read-only token before a save silently fails", async () => {
  const { fetchImpl } = fakeGithub([
    { status: 200, body: { permissions: { push: false }, default_branch: "main" } },
  ]);
  assert.match((await checkAccess(config, fetchImpl)) ?? "", /read .* but not write/);
});

test("checkAccess spots a branch that does not exist and suggests the real one", async () => {
  const { fetchImpl } = fakeGithub([
    { status: 200, body: { permissions: { push: true }, default_branch: "master" } },
    { status: 404, body: { message: "Branch not found" } },
  ]);
  const problem = await checkAccess(config, fetchImpl);
  assert.match(problem ?? "", /branch "main" does not exist/);
  assert.match(problem ?? "", /default branch is "master"/);
});

test("checkAccess explains an empty repo with no commits at all", async () => {
  const { fetchImpl } = fakeGithub([
    { status: 200, body: { permissions: { push: true } } },
    { status: 404, body: { message: "Branch not found" } },
  ]);
  assert.match((await checkAccess(config, fetchImpl)) ?? "", /no commits yet.*add a README/s);
});

test("checkAccess stays quiet when everything is in order", async () => {
  const { fetchImpl } = fakeGithub([
    { status: 200, body: { permissions: { push: true }, default_branch: "main" } },
    { status: 200, body: { name: "main" } },
  ]);
  assert.equal(await checkAccess(config, fetchImpl), null);
});

test("urlPath keeps a filename from rewriting the request it appears in", () => {
  // safePath keeps a caller inside the directory we own, but says nothing
  // about characters that mean something in a URL. Unencoded, the "?" below
  // starts the query early and the ref the request asked for is replaced.
  const built = (path: string) => `https://api.github.com/repos/o/r/contents/${urlPath(path)}?ref=main`;

  assert.equal(new URL(built("uploads/a.png")).searchParams.get("ref"), "main");
  assert.equal(new URL(built("uploads/x?ref=other")).searchParams.get("ref"), "main");
  assert.equal(new URL(built("uploads/x#frag")).searchParams.get("ref"), "main");
  assert.equal(new URL(built("uploads/x&y=1")).searchParams.get("ref"), "main");
});

test("urlPath encodes each segment but keeps the separators", () => {
  assert.equal(urlPath("uploads/a b.png"), "uploads/a%20b.png");
  assert.equal(urlPath("uploads/caf\u00e9.png"), "uploads/caf%C3%A9.png");
  assert.equal(urlPath("uploads/x?y#z"), "uploads/x%3Fy%23z");
  // Still refuses to climb out, and still keeps the path shape.
  assert.equal(urlPath("uploads/../../etc/passwd"), "uploads/etc/passwd");
});

/**
 * A stand-in for GitHub that honours If-None-Match: it answers 304 when the
 * caller already holds the current version, the way the real API does.
 */
function etagGithub() {
  const state = { etag: '"v1"', body: { content: Buffer.from("one").toString("base64"), sha: "s1", size: 3 } as unknown, status: 200 };
  const sent: (string | undefined)[] = [];
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    const asked = (init?.headers as Record<string, string> | undefined)?.["If-None-Match"];
    sent.push(asked);
    const status = state.status === 200 && asked === state.etag ? 304 : state.status;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers(status === 200 ? { etag: state.etag } : {}),
      json: async () => state.body,
      text: async () => JSON.stringify(state.body),
      arrayBuffer: async () => Buffer.alloc(0),
    };
  }) as unknown as typeof fetch;
  return { fetchImpl, state, sent };
}

test("an unchanged file is not downloaded again: GitHub answers 304 and the copy is reused", async () => {
  forgetReads();
  const { fetchImpl, sent } = etagGithub();
  const first = await readFile(config, "live-show/selection.json", fetchImpl);
  const second = await readFile(config, "live-show/selection.json", fetchImpl);
  assert.deepEqual(sent, [undefined, '"v1"']);
  assert.equal(second.bytes?.toString(), "one");
  assert.equal(second.sha, first.sha);
});

test("a changed file is read fresh, never served from the old copy", async () => {
  forgetReads();
  const { fetchImpl, state } = etagGithub();
  await readFile(config, "live-show/selection.json", fetchImpl);
  state.etag = '"v2"';
  state.body = { content: Buffer.from("two").toString("base64"), sha: "s2", size: 3 };
  const next = await readFile(config, "live-show/selection.json", fetchImpl);
  assert.equal(next.bytes?.toString(), "two");
  assert.equal(next.sha, "s2");
});

test("a deleted file reads as missing and its old copy is dropped", async () => {
  forgetReads();
  const { fetchImpl, state, sent } = etagGithub();
  await readFile(config, "live-show/selection.json", fetchImpl);
  state.status = 404;
  assert.deepEqual(await readFile(config, "live-show/selection.json", fetchImpl), { bytes: null, sha: null });
  state.status = 200;
  await readFile(config, "live-show/selection.json", fetchImpl);
  assert.equal(sent.at(-1), undefined);
});

test("listings are reused on 304 too", async () => {
  forgetReads();
  const { fetchImpl, state, sent } = etagGithub();
  state.body = [{ name: "a.json", path: "submissions/a.json", sha: "x", type: "file" }, { name: "d", path: "submissions/d", sha: "y", type: "dir" }];
  const first = await listDir(config, "submissions", fetchImpl);
  const second = await listDir(config, "submissions", fetchImpl);
  assert.deepEqual(second, [{ name: "a.json", path: "submissions/a.json", sha: "x" }]);
  assert.deepEqual(second, first);
  assert.equal(sent.at(-1), '"v1"');
});

test("a big upload is not held in memory, so the next read downloads it again", async () => {
  forgetReads();
  const { fetchImpl, state, sent } = etagGithub();
  state.body = { content: Buffer.alloc(9 * 1024 * 1024).toString("base64"), sha: "big", size: 9 * 1024 * 1024 };
  await readFile(config, "uploads/huge.png", fetchImpl);
  await readFile(config, "uploads/huge.png", fetchImpl);
  assert.deepEqual(sent, [undefined, undefined]);
});
