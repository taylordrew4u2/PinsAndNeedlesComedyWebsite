/**
 * A small stand-in for GitHub's Contents API, so the simulator can run the
 * site on the same storage driver production uses without touching the real
 * content repo.
 *
 * It behaves the way the site depends on GitHub behaving: ETags with 304
 * "not modified" answers, sha-checked writes and deletes that refuse a stale
 * sha with 409, and directory listings. It counts what it serves so the
 * simulator can report how much of the night's polling was free.
 */
import http from "node:http";
import crypto from "node:crypto";

export function startFakeGithub() {
  const files = new Map(); // path -> { content: Buffer, sha }
  const stats = { requests: 0, notModified: 0, counted: 0, conflicts: 0 };
  let version = 0;
  const shaOf = (buffer) =>
    crypto.createHash("sha1").update(buffer).update(String(++version)).digest("hex");

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { "content-type": "application/json", ...headers });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };

  const server = http.createServer(async (req, res) => {
    stats.requests++;
    const url = new URL(req.url, "http://fake");
    const match = url.pathname.match(/^\/repos\/[^/]+\/[^/]+\/contents\/(.*)$/);
    if (!match) return send(res, 404, { message: "Not Found" });
    const path = decodeURIComponent(match[1]);
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const input = raw ? JSON.parse(raw) : {};
    const file = files.get(path);

    if (req.method === "GET") {
      let payload;
      let etag;
      if (file) {
        etag = `"${file.sha}"`;
        payload = {
          type: "file", name: path.split("/").pop(), path, sha: file.sha,
          size: file.content.length, content: file.content.toString("base64"),
        };
      } else {
        const children = [...files.entries()].filter(
          ([p]) => p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes("/")
        );
        if (!children.length) {
          stats.counted++;
          return send(res, 404, { message: "Not Found" });
        }
        payload = children.map(([p, v]) => ({ type: "file", name: p.split("/").pop(), path: p, sha: v.sha }));
        etag = `"${crypto.createHash("sha1").update(JSON.stringify(payload)).digest("hex")}"`;
      }
      if (req.headers["if-none-match"] === etag) {
        stats.notModified++;
        return send(res, 304, undefined, { etag });
      }
      stats.counted++;
      return send(res, 200, payload, { etag });
    }

    stats.counted++;
    if (req.method === "PUT") {
      if (file && input.sha !== file.sha) {
        stats.conflicts++;
        return send(res, 409, { message: `${path} is at ${file.sha} but expected ${input.sha}` });
      }
      if (!file && input.sha) {
        stats.conflicts++;
        return send(res, 422, { message: "sha given for a file that does not exist" });
      }
      const content = Buffer.from(input.content || "", "base64");
      const sha = shaOf(content);
      files.set(path, { content, sha });
      return send(res, file ? 200 : 201, { content: { sha, path } });
    }
    if (req.method === "DELETE") {
      if (!file) return send(res, 404, { message: "Not Found" });
      if (input.sha !== file.sha) {
        stats.conflicts++;
        return send(res, 409, { message: "sha does not match" });
      }
      files.delete(path);
      return send(res, 200, { commit: {} });
    }
    return send(res, 405, { message: "Method not allowed" });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        stats,
        paths: () => [...files.keys()],
        read: (path) => {
          const file = files.get(path);
          return file ? JSON.parse(file.content.toString("utf8")) : null;
        },
        write: (path, value) => {
          const content = Buffer.from(JSON.stringify(value));
          files.set(path, { content, sha: shaOf(content) });
        },
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}
